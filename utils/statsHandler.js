const config = require("../config/config.js");

module.exports = {
    trackMessageStats(message) {
        // 讀取全域設定
        const FILTER_CONFIG = config.FILTERS;
        const TARGET_GUILD_ID = config.TARGET_GUILD_ID;

        // 判斷條件：
        // 1. 不是指令 (沒有 & 開頭)
        // 2. 不是排除的分類
        // 3. 不是排除的身分組
        const isCommand = message.content.startsWith("&");
        const channel = message.channel;
        const parentId = channel.parentId;

        // 1. 檢查是否為目標伺服器
        if (TARGET_GUILD_ID && message.guild.id !== TARGET_GUILD_ID) {
            return;
        }
        // 2. 檢查排除名單
        else if (
            (parentId && FILTER_CONFIG.EXCLUDE_CATEGORIES.includes(parentId)) ||
            message.member.roles.cache.some(role => FILTER_CONFIG.EXCLUDE_ROLES.includes(role.id))
        ) {
            return;
        }
        // 3. 檢查包含名單 (如果有設定的話)
        else if (
            FILTER_CONFIG.INCLUDE_CATEGORIES.length > 0 &&
            (!parentId || !FILTER_CONFIG.INCLUDE_CATEGORIES.includes(parentId))
        ) {
            return;
        }
        // 4. 執行統計
        else if (!isCommand) {
            const stats = message.client.dailyStats;
            if (stats) {
                const chId = message.channel.id;

                // 初始化
                if (!stats.channels[chId]) {
                    stats.channels[chId] = {
                        name: message.channel.name,
                        msgCount: 0,
                        voiceMs: 0,
                        msgPoints: 0,
                        voicePoints: 0,
                        maxUsers: 0
                    };
                }

                const chStats = stats.channels[chId];

                // A. 訊息數 +1 (統計用)
                chStats.msgCount++;

                // B. 積分計算 (排行榜用)
                // 規則：每則+1, 長文(>20)+2, 附件+3
                let score = 1;

                // 長文字檢查
                if (message.content.length >= 20) {
                    score += 2;
                }

                // 附件或說明檢查 (Embeds 或 Attachments)
                if (message.attachments.size > 0 || message.embeds.length > 0) {
                    score += 3;
                }

                chStats.msgPoints += score;
            }
        }
    }
};
