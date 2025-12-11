// utils/activeChatManager.js

const CONFIG = {
    targetGuildId: "859390147110633512",
    notificationChannelId: "859423355626717215",
    ignoredCategories: [],

    // rule1: 2人(含)以上 30分鐘內 10則訊息
    rule1: { minUsers: 2, minMsgs: 10, duration: 30 * 60 * 1000 },
    // rule2: 3人(含)以上 45分鐘內 15則訊息
    rule2: { minUsers: 3, minMsgs: 15, duration: 45 * 60 * 1000 },

    // 冷卻 6 小時
    cooldownTime: 6 * 60 * 60 * 1000
};

// 計算最長需要的時間區間 (取兩條規則中時間較長的那個)
// 用於判斷「閒置重置」
const MAX_DURATION = Math.max(CONFIG.rule1.duration, CONFIG.rule2.duration);

const channelMessages = new Map();
const channelCooldowns = new Map();
let lastResetDate = new Date().toDateString();

module.exports = {
    async handleMessage(message) {
        // 基本檢查 log
        if (!message.guild || message.guild.id !== CONFIG.targetGuildId) return;
        if (message.author.bot) return;
        if (CONFIG.ignoredCategories.includes(message.channel.parentId)) return;
        if (message.channel.id === CONFIG.notificationChannelId) return;

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
                // 冷卻結束，移除標記
                channelCooldowns.delete(channelId);
            }
        }

        if (!channelMessages.has(channelId)) channelMessages.set(channelId, []);
        const msgs = channelMessages.get(channelId);

        // 閒置重置檢查 (避免隔太久突然觸發)
        if (msgs.length > 0) {
            const lastMsgTime = msgs[msgs.length - 1].timestamp;
            if (now - lastMsgTime > MAX_DURATION) {
                // console.log(`[ActiveChat] 頻道 ${message.channel.name} 閒置過久，重置計數器。`);
                msgs = []; // 清空陣列
                channelMessages.set(channelId, msgs); // 更新 Map
            }
        }

        // 同個人連續發送訊息不會計算
        if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.authorId === message.author.id) return;
        }

        msgs.push({ authorId: message.author.id, timestamp: now });

        // 再次過濾：只保留時間範圍內的訊息 (Double Check，確保滑動視窗準確)
        const validMsgs = msgs.filter(m => now - m.timestamp < MAX_DURATION);
        channelMessages.set(channelId, validMsgs);

        // Debug 訊息 (測試完可註解)
        // const uniqueUsers = new Set(validMsgs.map(m => m.authorId)).size;
        // console.log(`[ActiveChat] ${message.channel.name} | 訊息: ${validMsgs.length} | 人數: ${uniqueUsers}`);

        // 判斷是否達標
        if (checkRule(validMsgs, CONFIG.rule1, now) || checkRule(validMsgs, CONFIG.rule2, now)) {
            await sendNotification(message.guild, message.channel);

            // 通知發送成功後，馬上清空該頻道的累積訊息
            // 這樣下次必須從 0 開始累積，不會因為冷卻結束就馬上再次觸發
            channelMessages.set(channelId, []);
            // console.log(`[ActiveChat] 已觸發通知，清空 ${message.channel.name} 的計數器`);
        }
    }
};

function checkRule(msgs, rule, now) {
    const recentMsgs = msgs.filter(m => now - m.timestamp < rule.duration);
    if (recentMsgs.length < rule.minMsgs) return false;
    const uniqueUsers = new Set(recentMsgs.map(m => m.authorId));
    return uniqueUsers.size >= rule.minUsers;
}

function checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        console.log("[ActiveChat] 執行每日重置");
        lastResetDate = today;
        channelCooldowns.clear();
        // 每日重置時，建議也可以順便清空所有累積訊息，避免隔日第一則訊息就觸發舊的
        channelMessages.clear();
    }
}

async function sendNotification(guild, activeChannel) {
    try {
        const notifyChannel = guild.channels.cache.get(CONFIG.notificationChannelId);
        if (!notifyChannel) return console.log("⚠️ 活躍通知失敗：找不到通知頻道 ID");

        channelCooldowns.set(activeChannel.id, Date.now());

        await notifyChannel.send({
            content: `<#${activeChannel.id}> 現在討論得很熱烈 🔥，趕快去看看吧！`
        });
    } catch (error) {
        console.error("發送活躍通知失敗:", error);
    }
}