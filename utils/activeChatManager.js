// utils/activeChatManager.js
const config = require('../config/config.js');

const CONFIG = {
    targetGuildId: config.TARGET_GUILD_ID,
    notificationChannelId: config.CHANNELS.LEADERBOARD,
    ignoredCategories: config.ACTIVE_CHAT.IGNORED_CATEGORIES,
    rule1: config.ACTIVE_CHAT.RULE1,
    rule2: config.ACTIVE_CHAT.RULE2,
    cooldownTime: config.ACTIVE_CHAT.COOLDOWN,
};

// 計算最長需要的時間區間 (取兩條規則中時間較長的那個)
// 用於判斷「閒置重置」
const MAX_DURATION = Math.max(CONFIG.rule1.duration, CONFIG.rule2.duration);

function createActiveChatManager(storage) {
    // State Data
    let channelMessages = new Map();
    let channelCooldowns = new Map();
    let lastResetDate = new Date().toDateString();

    // Load persisted state
    const saved = storage.load();
    if (saved) {
        if (saved.messages) channelMessages = new Map(Object.entries(saved.messages));
        if (saved.cooldowns) channelCooldowns = new Map(Object.entries(saved.cooldowns));
        if (saved.lastResetDate) lastResetDate = saved.lastResetDate;
    }

    function saveState() {
        storage.save({
            messages: Object.fromEntries(channelMessages),
            cooldowns: Object.fromEntries(channelCooldowns),
            lastResetDate: lastResetDate
        });
    }

    function checkRule(msgs, rule, now) {
        // 1. 先篩選時間內的訊息
        const recentMsgs = msgs.filter(m => now - m.timestamp < rule.duration);
        console.log(`[ActiveChat] [Rule Check] Duration: ${rule.duration}ms, Recent messages in window: ${recentMsgs.length}/${msgs.length}`);

        // 2. 計算「有效訊息數」 (套用單人上限)
        const userCounts = {};
        let effectiveMsgCount = 0;
        const uniqueUsers = new Set();

        for (const msg of recentMsgs) {
            uniqueUsers.add(msg.authorId);

            if (!userCounts[msg.authorId]) userCounts[msg.authorId] = 0;

            if (userCounts[msg.authorId] < rule.maxContribution) {
                userCounts[msg.authorId]++;
                effectiveMsgCount++;
            }
        }

        const ruleName = rule.minUsers === 3 && rule.minMsgs === 10 ? 'Rule 1' : 'Rule 2';
        const userCheck = `👥 ${uniqueUsers.size}/${rule.minUsers} users`;
        const msgCheck = `💬 ${effectiveMsgCount}/${rule.minMsgs} effective messages`;
        const passed = uniqueUsers.size >= rule.minUsers && effectiveMsgCount >= rule.minMsgs;
        const status = passed ? '✅' : '❌';

        console.log(`[ActiveChat] [${ruleName}] ${status} ${userCheck} | ${msgCheck}`);

        if (uniqueUsers.size < rule.minUsers) return false;
        if (effectiveMsgCount < rule.minMsgs) return false;

        return true;
    }

    function checkDailyReset() {
        const today = new Date().toDateString();
        if (today !== lastResetDate) {
            console.log("[ActiveChat] 執行每日重置");
            lastResetDate = today;
            channelCooldowns.clear();
            channelMessages.clear();
            saveState();
        }
    }

    async function sendNotification(guild, activeChannel) {
        try {
            const notifyChannel = guild.channels.cache.get(CONFIG.notificationChannelId);
            if (!notifyChannel) return console.log("⚠️ 活躍通知失敗：找不到通知頻道 ID");

            channelCooldowns.set(activeChannel.id, Date.now());
            saveState();

            await notifyChannel.send({
                content: `<#${activeChannel.id}> 現在討論得很熱烈 🔥，趕快去看看吧！`
            });
        } catch (error) {
            console.error("發送活躍通知失敗:", error);
        }
    }

    return {
        async handleMessage(message) {
            const isWebhook = message.webhookId ? '🔗 WEBHOOK' : 'USER';
            console.log(`[ActiveChat] Handling ${isWebhook} @${message.author.username} in #${message.channel.name}`);

            if (!message.guild || message.guild.id !== CONFIG.targetGuildId) {
                console.log(`[ActiveChat] Skipped: Guild ID mismatch (expected: ${CONFIG.targetGuildId}, got: ${message.guild?.id})`);
                return;
            }

            if (message.author.bot) {
                console.log(`[ActiveChat] Skipped: Bot message`);
                return;
            }

            if (CONFIG.ignoredCategories.includes(message.channel.parentId)) {
                console.log(`[ActiveChat] Skipped: Category ignored (${message.channel.parentId})`);
                return;
            }

            if (message.channel.id === CONFIG.notificationChannelId) {
                console.log(`[ActiveChat] Skipped: Notification channel`);
                return;
            }

            console.log(`[ActiveChat] ✅ Message passed all initial checks`);

            checkDailyReset();

            const channelId = message.channel.id;
            const now = Date.now();

            // 檢查冷卻
            if (channelCooldowns.has(channelId)) {
                const lastTrigger = channelCooldowns.get(channelId);
                const timeLeft = CONFIG.cooldownTime - (now - lastTrigger);
                if (timeLeft > 0) {
                    console.log(`[ActiveChat] 冷卻中... 剩餘 ${(timeLeft / 1000).toFixed(1)} 秒`);
                    return;
                } else {
                    channelCooldowns.delete(channelId);
                    saveState();
                }
            }

            if (!channelMessages.has(channelId)) channelMessages.set(channelId, []);
            let msgs = channelMessages.get(channelId);

            // 閒置重置檢查
            if (msgs.length > 0) {
                const lastMsgTime = msgs[msgs.length - 1].timestamp;
                if (now - lastMsgTime > MAX_DURATION) {
                    msgs = [];
                    channelMessages.set(channelId, msgs);
                }
            }

            msgs.push({ authorId: message.author.id, timestamp: now });

            const validMsgs = msgs.filter(m => now - m.timestamp < MAX_DURATION);
            channelMessages.set(channelId, validMsgs);

            saveState();

            const uniqueUsers = new Set(validMsgs.map(m => m.authorId)).size;
            console.log(`[ActiveChat] ${message.channel.name} | 訊息: ${validMsgs.length} | 人數: ${uniqueUsers}`);

            if (checkRule(validMsgs, CONFIG.rule1, now) || checkRule(validMsgs, CONFIG.rule2, now)) {
                await sendNotification(message.guild, message.channel);

                channelMessages.set(channelId, []);
                saveState();
                console.log(`[ActiveChat] 已觸發通知，清空 ${message.channel.name} 的計數器`);
            }
        }
    };
}

module.exports = { createActiveChatManager };
