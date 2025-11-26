const IGNORED_CATEGORIES = ["859390147656679455", "1229094983202504715"];
const IGNORED_ROLES = ["1229465574074224720"];

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const userId = newState.member.id;
        const now = Date.now();
        const stats = client.dailyStats;

        // 如果 stats 還沒初始化 (Bot 剛開)，先跳過
        if (!stats) return;

        // 排除機器人
        if (newState.member.user.bot) return;
        // 排除特定身分組
        if (newState.member.roles.cache.some(r => IGNORED_ROLES.includes(r.id))) return;

        // === 情境 1: 用戶離開了語音頻道 (或切換頻道) ===
        // 結算上一段的時間
        if (stats.voiceSessions.has(userId)) {
            const session = stats.voiceSessions.get(userId);
            const duration = now - session.startTime;
            
            // 加總到該頻道的數據中
            const chId = session.channelId;
            // 確保該頻道有初始資料
            if (!stats.channels[chId]) {
                // 嘗試抓取頻道名稱 (如果頻道被刪了可能抓不到)
                const ch = oldState.channel || client.channels.cache.get(chId);
                stats.channels[chId] = { msgCount: 0, voiceMs: 0, name: ch ? ch.name : "未知頻道" };
            }
            
            stats.channels[chId].voiceMs += duration;

            // 移除 session 紀錄
            stats.voiceSessions.delete(userId);
        }

        // === 情境 2: 用戶加入了語音頻道 (或切換進來) ===
        if (newState.channelId) {
            // 檢查是否在排除的分類中
            if (newState.channel.parentId && IGNORED_CATEGORIES.includes(newState.channel.parentId)) return;

            // 開始計時
            stats.voiceSessions.set(userId, {
                startTime: now,
                channelId: newState.channelId
            });
        }
    }
};