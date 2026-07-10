// utils/llmService.js
/**
 * LLM Service - Abstraction layer for different LLM providers
 * Supports Gemini (primary), OpenAI, and Claude (future)
 */

const config = require('../config/config.js');
const GeminiProvider = require('./providers/geminiProvider.js');

let currentProvider = null;

/**
 * Initialize LLM service with specified provider
 * @param {string} providerName - Provider name: 'gemini', 'openai', 'claude'
 * @returns {boolean} True if initialization successful
 */
function initialize(providerName = 'gemini') {
    try {
        const llmConfig = config.LLM_SUMMARY || {};

        if (!llmConfig.enabled) {
            console.warn('[LLMService] LLM Summary feature is disabled in config');
            return false;
        }

        const provider = providerName || llmConfig.provider || 'gemini';
        const apiKey = llmConfig.apiKeys[provider];

        if (!apiKey) {
            console.error(`[LLMService] No API key found for provider: ${provider}`);
            return false;
        }

        // Factory pattern to create provider instances
        currentProvider = createProvider(provider, apiKey);

        if (!currentProvider) {
            console.error(`[LLMService] Failed to create provider: ${provider}`);
            return false;
        }

        console.log(`[LLMService] Initialized with provider: ${provider}`);
        return true;
    } catch (error) {
        console.error('[LLMService] Initialization failed:', error);
        return false;
    }
}

/**
 * Create a provider instance based on provider name
 * @private
 * @param {string} providerName - Provider name
 * @param {string} apiKey - API key for provider
 * @returns {Object} Provider instance or null
 */
function createProvider(providerName, apiKey) {
    switch (providerName.toLowerCase()) {
        case 'gemini':
            return new GeminiProvider(apiKey);
        default:
            console.error(`[LLMService] Unknown provider: ${providerName}`);
            return null;
    }
}

/**
 * Perform quick relevance check on a conversation
 * @param {Array} messages - Formatted messages array
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Result with {isRelevant, confidence, category, reason}
 */
async function quickRelevanceCheck(messages, _options = {}) {
    try {
        if (!currentProvider) {
            if (!initialize()) {
                throw new Error('LLM provider not initialized');
            }
        }

        const llmConfig = config.LLM_SUMMARY || {};
        const formattedMessages = require('./conversationCollector.js').formatForLLM(messages);

        // Read relevance check prompt
        const fs = require('fs');
        const path = require('path');
        const promptPath = path.join(__dirname, '../config/prompts/relevanceCheck.txt');
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');

        const userMessage = `以下是一段討論對話，請判斷是否與遊戲開發相關：\n\n${formattedMessages}\n\n訊息數量: ${messages.length}\n參與者: ${require('./conversationCollector.js').getUniqueAuthorsCount(messages)}人`;

        // Token Counting & Dry Run
        const tokenCount = await currentProvider.countTokens(systemPrompt, userMessage, {
            model: llmConfig.models?.relevanceCheck || 'gemini-2.0-flash'
        });
        
        console.log(`[LLM Token Cost] Relevance Check: ${tokenCount} tokens | Est. Cost: $${(tokenCount / 1000000 * 0.35).toFixed(6)} (Flash)`);

        if (llmConfig.dryRun) {
            console.log('[LLM Dry Run] Skipping actual API call for relevance check.');
            return {
                isRelevant: true, // Default to true to test workflow
                confidence: 0.99,
                category: 'technics',
                reason: 'Dry Run Mode: Simulated positive relevance check',
                tokenCount: tokenCount
            };
        }

        const response = await currentProvider.chat(
            systemPrompt,
            userMessage,
            {
                model: llmConfig.models?.relevanceCheck || 'gemini-2.0-flash',
                timeout: llmConfig.timeouts?.llmRequestTimeout || 30000
            }
        );

        // Parse JSON response
        const jsonMatch = response.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (!jsonMatch) {
            console.error('[LLMService] Failed to extract JSON from relevance response');
            return {
                isRelevant: false,
                confidence: 0,
                category: 'other',
                reason: '無法解析LLM回應',
                tokenCount: tokenCount
            };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            isRelevant: result.isRelevant || false,
            confidence: result.confidence || 0,
            category: result.category || 'other',
            reason: result.reason || '',
            tokenCount: tokenCount
        };
    } catch (error) {
        console.error('[LLMService] Relevance check failed:', error);
        return {
            isRelevant: false,
            confidence: 0,
            category: 'error',
            reason: `錯誤: ${error.message}`,
            tokenCount: 0
        };
    }
}

/**
 * Generate comprehensive summary or daily digest of conversation
 * @param {Array} messages - Formatted messages array
 * @param {Object} options - Optional settings (e.g. { promptType: 'comprehensive' | 'daily', timeout: number })
 * @returns {Promise<Object>} Summary with {title, summary, keyPoints, participants, resources, actionItems}
 */
async function generateSummary(messages, options = {}) {
    const promptType = options.promptType || 'comprehensive';
    const isDaily = promptType === 'daily';
    try {
        if (!currentProvider) {
            if (!initialize()) {
                throw new Error('LLM provider not initialized');
            }
        }

        const llmConfig = config.LLM_SUMMARY || {};
        const formattedMessages = require('./conversationCollector.js').formatForLLM(messages);
        const stats = require('./conversationCollector.js').getStatistics(messages);

        // Read appropriate prompt
        const fs = require('fs');
        const path = require('path');
        const promptFilename = isDaily ? 'dailyDigest.txt' : 'comprehensiveSummary.txt';
        const promptPath = path.join(__dirname, `../config/prompts/${promptFilename}`);
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');

        const userMessagePrefix = isDaily 
            ? '請為以下 24 小時的對話對話生成每日摘要：' 
            : '請為以下討論對話生成完整摘要：';
        const userMessage = `${userMessagePrefix}\n\n${formattedMessages}\n\n對話統計:\n- 訊息數: ${messages.length}\n- 參與者: ${stats.uniqueAuthors}人\n- 總字數: ${stats.totalWords}`;

        // Token Counting & Dry Run
        const tokenCount = await currentProvider.countTokens(systemPrompt, userMessage, {
            model: llmConfig.models?.fullSummary || 'gemini-2.0-flash'
        });

        const logLabel = isDaily ? 'Daily Digest' : 'Full Summary';
        console.log(`[LLM Token Cost] ${logLabel}: ${tokenCount} tokens | Est. Cost: $${(tokenCount / 1000000 * 0.35).toFixed(6)} (Flash)`);

        if (llmConfig.dryRun) {
            console.log(`[LLM Dry Run] Skipping actual API call for ${logLabel.toLowerCase()} generation.`);
            if (isDaily) {
                return {
                    title: '每日對話精選 (Dry Run)',
                    summary: '這是一個測試每日摘要。在 Dry Run 模式下，我們計算了 Token 數量但沒有發送請求給 LLM。實際運作時，這裡會顯示過去 24 小時對話內容生成的每日摘要。',
                    keyPoints: ['每日 Token 計算功能正常', '無 API 費用產生', '每日掃描排程測試通過'],
                    participants: ['TestUser1', 'TestUser2'],
                    resources: ['https://example.com/resource'],
                    actionItems: ['Check dry run logs'],
                    tokenCount: tokenCount
                };
            } else {
                return {
                    title: 'Dry Run Summary Mode',
                    summary: '這是一個測試摘要。在 Dry Run 模式下，我們計算了 Token 數量但沒有發送請求給 LLM。實際運作時，這裡會顯示根據對話內容生成的完整摘要。',
                    keyPoints: ['Token 計算功能正常運作', '未產生 API 費用', '流程測試通過'],
                    participants: ['TestUser1', 'TestUser2'],
                    resources: ['https://example.com/resource'],
                    actionItems: ['Check logs for token count'],
                    tokenCount: tokenCount
                };
            }
        }

        const response = await currentProvider.chat(
            systemPrompt,
            userMessage,
            {
                model: llmConfig.models?.fullSummary || 'gemini-2.0-flash',
                timeout: options.timeout || llmConfig.timeouts?.llmRequestTimeout || 30000
            }
        );

        // Parse JSON response
        const jsonMatch = response.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (!jsonMatch) {
            console.error(`[LLMService] Failed to extract JSON from ${logLabel.toLowerCase()} response`);
            return {
                title: isDaily ? '每日摘要生成失敗' : '摘要生成失敗',
                summary: '無法從LLM獲取回應',
                keyPoints: [],
                participants: [],
                resources: [],
                actionItems: [],
                tokenCount: tokenCount
            };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            title: result.title || (isDaily ? '今日討論精選' : '未命名'),
            summary: result.summary || '',
            keyPoints: result.keyPoints || [],
            participants: result.participants || [],
            resources: result.resources || [],
            actionItems: result.actionItems || [],
            tokenCount: tokenCount
        };
    } catch (error) {
        console.error(`[LLMService] ${isDaily ? 'Daily digest' : 'Summary'} generation failed:`, error);
        return {
            title: isDaily ? '每日摘要生成失敗' : '摘要生成失敗',
            summary: `錯誤: ${error.message}`,
            keyPoints: [],
            participants: [],
            resources: [],
            actionItems: [],
            tokenCount: 0
        };
    }
}

/**
 * Get current provider info
 * @returns {string} Provider name or 'not_initialized'
 */
function getProviderInfo() {
    return currentProvider ? currentProvider.getName() : 'not_initialized';
}

module.exports = {
    initialize,
    quickRelevanceCheck,
    generateSummary,
    getProviderInfo,
    /**
     * 分析訊息列表並聚類識別討論主題
     * @param {Array} messages - 格式化後的訊息陣列
     * @returns {Promise<Array>} 討論主題聚類列表
     */
    async discoverTopics(messages, options = {}) {
        try {
            if (!currentProvider) {
                if (!initialize()) {
                    throw new Error('LLM provider not initialized');
                }
            }

            const llmConfig = config.LLM_SUMMARY || {};

            // 格式化訊息，包含 ID 供 LLM 在回傳 messageIds 時使用
            const formattedMessages = messages.map(msg => {
                const time = new Date(msg.timestamp).toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `[ID:${msg.id}] [${time}] ${msg.authorName}: ${msg.content}`;
            }).join('\n');

            // 載入主題發現提示詞
            const fs = require('fs');
            const path = require('path');
            const promptPath = path.join(__dirname, '../config/prompts/topicDiscovery.txt');
            const systemPrompt = fs.readFileSync(promptPath, 'utf8');

            const userMessage = `請分析以下對話並區分討論主題：\n\n${formattedMessages}`;

            // 計算 Token 數量
            const tokenCount = await currentProvider.countTokens(systemPrompt, userMessage, {
                model: llmConfig.models?.topicDiscovery || 'gemini-2.0-flash'
            });

            console.log(`[LLM Token Cost] Topic Discovery: ${tokenCount} tokens`);

            if (llmConfig.dryRun) {
                console.log('[LLM Dry Run] Simulating topic discovery');
                return [{
                    topic: 'Dry Run Topic',
                    messageIds: messages.map(m => m.id),
                    isRelevant: true,
                    confidence: 1.0,
                    category: 'technics',
                    reason: 'Dry Run'
                }];
            }

            const response = await currentProvider.chat(
                systemPrompt,
                userMessage,
                {
                    model: llmConfig.models?.topicDiscovery || 'gemini-2.0-flash',
                    timeout: options.timeout ?? llmConfig.timeouts?.llmRequestTimeout ?? 60000,
                    responseMimeType: 'application/json',
                    maxOutputTokens: Math.max(8192, messages.length * 30),
                    thinkingBudget: 0,
                    responseSchema: {
                        type: 'object',
                        properties: {
                            clusters: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        topic:      { type: 'string' },
                                        messageIds: { type: 'array', items: { type: 'string' } },
                                        isRelevant: { type: 'boolean' },
                                        confidence: { type: 'number' },
                                        category:   { type: 'string', enum: ['technics', 'art', 'design', 'news', 'resource', 'other'] },
                                        reason:     { type: 'string' }
                                    },
                                    required: ['topic', 'messageIds', 'isRelevant', 'confidence', 'category', 'reason']
                                }
                            }
                        },
                        required: ['clusters']
                    }
                }
            );

            let result;
            try {
                result = JSON.parse(response);
            } catch (parseError) {
                console.error('[LLMService] JSON parse failed. Raw response (first 500 chars):', response?.slice(0, 500));
                throw parseError;
            }
            return result.clusters || result || [];
        } catch (error) {
            console.error('[LLMService] Topic discovery failed:', error);
            return [];
        }
    }
};
