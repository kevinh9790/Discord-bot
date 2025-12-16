module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const now = Date.now();
        const stats = client.dailyStats;
        if (!stats) return;

        // 讀取設定
        const FILTER_CONFIG = client.filterConfig || {
            INCLUDE_CATEGORIES: [],
            EXCLUDE_CATEGORIES: [],
            EXCLUDE_ROLES: [],
            TARGET_GUILD_ID: ""
        };

        // 判斷是否需要處理該頻道
        const isTrackedChannel = (channel) => {
            if (!channel) return false;
            if (FILTER_CONFIG.TARGET_GUILD_ID && channel.guild.id !== FILTER_CONFIG.TARGET_GUILD_ID) return false;
            if (channel.parentId && FILTER_CONFIG.EXCLUDE_CATEGORIES.includes(channel.parentId)) return false;
            if (FILTER_CONFIG.INCLUDE_CATEGORIES.length > 0 && (!channel.parentId || !FILTER_CONFIG.INCLUDE_CATEGORIES.includes(channel.parentId))) return false;
            return true;
        };

        // 核心邏輯：處理頻道狀態更新與積分結算
        const processChannel = (channel) => {
            if (!channel || !isTrackedChannel(channel)) return;

            const chId = channel.id;

            // 1. 獲取該頻道目前的狀態 (人數, 直播數)
            // 過濾機器人與排除身分組
            const validMembers = channel.members.filter(m =>
                !m.user.bot &&
                !m.roles.cache.some(r => FILTER_CONFIG.EXCLUDE_ROLES.includes(r.id))
            );

            const userCount = validMembers.size;
            const streamCount = validMembers.filter(m => m.voice.streaming).size;

            // 2. 獲取或初始化統計資料 (用於顯示報表)
            if (!stats.channels[chId]) {
                stats.channels[chId] = {
                    name: channel.name,
                    msgCount: 0,
                    voiceMs: 0,
                    msgPoints: 0,
                    voicePoints: 0,
                    maxUsers: 0
                };
            }
            // 更新最高人數
            if (userCount > stats.channels[chId].maxUsers) {
                stats.channels[chId].maxUsers = userCount;
            }

            // 3. 獲取上次紀錄的狀態 (用於結算積分)
            let voiceState = stats.voiceState.get(chId);

            if (voiceState) {
                // 有舊紀錄，先結算上一段時間的積分
                const duration = now - voiceState.lastTime;

                // 🛑 修正重點：只有當「上一段時間」有人(userCount > 0) 且 時間合理(duration > 0) 才計算
                if (duration > 0 && voiceState.userCount > 0) {

                    // 計算積分公式
                    const baseScore = 0.05; // 因為確定有人，基礎分直接給
                    const streamScore = voiceState.streamCount * 0.1;
                    const multiUserScore = voiceState.userCount > 1 ? (voiceState.userCount - 1) * 0.75 : 0;

                    const scorePerSec = baseScore + streamScore + multiUserScore;
                    const pointsToAdd = scorePerSec * (duration / 1000);

                    stats.channels[chId].voicePoints += pointsToAdd;

                    // 🛑 修正重點：只累加「有人」的時長
                    stats.channels[chId].voiceMs += duration;
                }
            }

            // 4. 更新狀態為「當前狀態」
            // 🛑 修正重點：如果現在沒人了 (userCount === 0)，直接刪除追蹤狀態
            // 這樣可以防止「空窗期」被計入下一次的 duration
            if (userCount === 0) {
                stats.voiceState.delete(chId);
            } else {
                stats.voiceState.set(chId, {
                    lastTime: now,
                    userCount: userCount,
                    streamCount: streamCount
                });
            }
        };

        // 處理離開/舊頻道
        if (oldState.channelId) {
            processChannel(oldState.channel);
        }

        // 處理加入/新頻道
        if (newState.channelId) {
            if (newState.channelId !== oldState.channelId) {
                processChannel(newState.channel);
            }
        }
    }
};