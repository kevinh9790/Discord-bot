#!/usr/bin/env node
/**
 * generateTestChat.js
 *
 * Generates a long, realistic game-dev Discord chat using Gemma3 via the
 * Google Generative AI API, then feeds it to discoverTopics() to smoke-test
 * the pipeline with large inputs.
 *
 * Usage:
 *   node scripts/generateTestChat.js [options]
 *
 * Options:
 *   --count=N       Total messages to generate (default: 300)
 *   --topics=N      Number of interleaved topics (default: 3)
 *   --model=NAME    Gemma model name (default: gemma-3-27b-it)
 *   --out=PATH      Save generated messages to JSON (default: /tmp/testchat.json)
 *   --replay=PATH   Skip generation, load messages from a previous --out file
 *   --timeout=MS    discoverTopics timeout in ms (default: 120000)
 *   --no-discover   Skip discoverTopics call (generation/replay only)
 */

require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const llmService = require('../utils/llmService.js');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
    process.argv.slice(2)
        .filter(a => a.startsWith('--'))
        .map(a => {
            const [k, ...v] = a.slice(2).split('=');
            return [k, v.length ? v.join('=') : true];
        })
);

const COUNT       = parseInt(args.count   || '300');
const NUM_TOPICS  = parseInt(args.topics  || '3');
const MODEL       = args.model   || 'gemini-2.0-flash';
const OUT_PATH    = args.out     || '/tmp/testchat.json';
const REPLAY_PATH = args.replay  || null;
const DO_DISCOVER = args['no-discover'] !== true;
const TIMEOUT_MS  = args.timeout ? parseInt(args.timeout) : 120000;

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY && !REPLAY_PATH) {
    console.error('❌ GEMINI_API_KEY not set in .env');
    process.exit(1);
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// ---------------------------------------------------------------------------
// Topic seed list
// ---------------------------------------------------------------------------
const TOPIC_SEEDS = [
    'Unity DOTS ECS 架構討論',
    'Shader Graph 半透明材質問題',
    'Godot 4 GDScript vs C# 效能比較',
    '獨立遊戲行銷策略：Steam Next Fest 心得',
    '像素風格角色動畫製作流程',
    'FMOD 音效整合與動態音樂切換',
    'Game Jam 結束後的後製討論',
    'Unreal Engine Nanite 使用心得',
    'AI 輔助程式碼生成在遊戲開發中的應用',
    '社群外包插畫師合作注意事項',
    '訂披薩晚餐要點什麼',    // intentional off-topic
    '今天天氣好熱要去哪玩',  // intentional off-topic
];

const FAKE_USERS = [
    'Alice_Dev', 'Bob_Pixelart', 'Carol_Sound', 'Dave_Design',
    'Eve_Indie', 'Frank_Engine', 'Grace_Shader', 'Hank_PM',
];

// ---------------------------------------------------------------------------
// Generate messages for a single topic via Gemma3
// ---------------------------------------------------------------------------
async function generateTopicMessages(topicName, count) {
    const model = genAI.getGenerativeModel({
        model: MODEL,
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        author:  { type: SchemaType.STRING },
                        content: { type: SchemaType.STRING },
                    },
                    required: ['author', 'content'],
                },
            },
        },
    });

    const prompt = `
你是一個模擬 Discord 遊戲開發社群對話的工具。
請為主題「${topicName}」生成 ${count} 則真實感十足的繁體中文對話訊息。

要求：
- 對話要自然、有來有往，像真正的開發者在討論
- 可以包含技術細節、問題、解決方案、個人經驗分享
- 偶爾可以有表情符號或口語化表達
- author 從以下清單中選取：${FAKE_USERS.join(', ')}
- 每則 content 長度 10~120 字
`.trim();

    console.log(`  Generating ${count} messages for: ${topicName}`);
    const result = await model.generateContent(prompt);
    const messages = JSON.parse(result.response.text());

    if (!Array.isArray(messages)) throw new Error('Model did not return an array');
    return messages.slice(0, count);
}

// ---------------------------------------------------------------------------
// Interleave batches with realistic timestamps
// ---------------------------------------------------------------------------
function buildMessageList(topicBatches, windowDays = 7) {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const start = now - windowMs;

    const all = [];
    let idCounter = 1000000000000;

    for (const { topic, messages } of topicBatches) {
        const centre = start + Math.random() * windowMs;
        const spread = (windowMs / topicBatches.length) * 0.4;

        for (const msg of messages) {
            const jitter = (Math.random() - 0.5) * 2 * spread;
            const timestamp = Math.max(start, Math.min(now, centre + jitter));
            all.push({
                id:         String(idCounter++),
                timestamp:  Math.round(timestamp),
                authorName: msg.author,
                content:    msg.content,
                _topic:     topic,  // debug label, stripped before discoverTopics
            });
        }
    }

    return all.sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    if (REPLAY_PATH) {
        console.log(`\n📂 Replaying messages from ${REPLAY_PATH}`);
        const messages = JSON.parse(fs.readFileSync(REPLAY_PATH, 'utf8'));
        console.log(`   Loaded ${messages.length} messages`);
        if (DO_DISCOVER) await runDiscovery(messages);
        return;
    }

    console.log(`\n🎲 Generating test chat`);
    console.log(`   Model:   ${MODEL}`);
    console.log(`   Topics:  ${NUM_TOPICS}  |  Total messages: ${COUNT}`);

    const shuffled = [...TOPIC_SEEDS].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, NUM_TOPICS);
    const perTopic = Math.ceil(COUNT / NUM_TOPICS);

    const topicBatches = [];
    for (const topic of chosen) {
        const messages = await generateTopicMessages(topic, perTopic);
        topicBatches.push({ topic, messages });
    }

    const allMessages = buildMessageList(topicBatches);
    console.log(`\n✅ Generated ${allMessages.length} messages across ${NUM_TOPICS} topics`);

    fs.writeFileSync(OUT_PATH, JSON.stringify(allMessages, null, 2));
    console.log(`💾 Saved to ${OUT_PATH}`);

    if (DO_DISCOVER) await runDiscovery(allMessages);
}

async function runDiscovery(messages) {
    console.log(`\n🔍 Running discoverTopics (${messages.length} messages)...`);

    const clean = messages.map(({ _topic, ...m }) => m);

    const start = Date.now();
    const clusters = await llmService.discoverTopics(clean, { timeout: TIMEOUT_MS });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\n⏱  Completed in ${elapsed}s`);
    console.log(`\n📊 discoverTopics result (${clusters.length} clusters):\n`);

    for (const c of clusters) {
        const marker = c.isRelevant ? '✅' : '⬜';
        console.log(`${marker} [${c.confidence.toFixed(2)}] ${c.topic}`);
        console.log(`   category: ${c.category}  |  messages: ${c.messageIds.length}`);
        console.log(`   reason: ${c.reason}`);
        console.log();
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
