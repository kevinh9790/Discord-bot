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
        // 我們需要針對「舊頻道」(如果有的話) 和「新頻道」(如果有的話) 分別做計算
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

            // 2. 獲取或初始化統計資料
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

                if (duration > 0) {
                    // 使用「上一段時間」的狀態來計算積分
                    // 基礎 0.05 + 直播 0.1/人 + 多人 0.75 * (n-1)
                    const baseScore = voiceState.userCount > 0 ? 0.05 : 0;
                    const streamScore = voiceState.streamCount * 0.1;
                    const multiUserScore = voiceState.userCount > 1 ? (voiceState.userCount - 1) * 0.75 : 0;

                    const scorePerSec = baseScore + streamScore + multiUserScore;
                    const pointsToAdd = scorePerSec * (duration / 1000);

                    stats.channels[chId].voicePoints += pointsToAdd;
                    stats.channels[chId].voiceMs += duration; // 累積總時長
                }
            }

            // 4. 更新狀態為「當前狀態」，開始下一段計時
            // 如果沒人了，可以考慮從 map 移除以省記憶體，但為了邏輯簡單，保留也無妨
            // 不過如果人數為 0，下次計算時 pointsToAdd 會是 0，正確
            stats.voiceState.set(chId, {
                lastTime: now,
                userCount: userCount,
                streamCount: streamCount
            });
        };

        // 處理離開/舊頻道
        if (oldState.channelId) {
            processChannel(oldState.channel);
        }

        // 處理加入/新頻道 (如果是同頻道切換狀態，如開直播，這裡也會觸發)
        if (newState.channelId) {
            // 如果新舊頻道ID不同，才要處理新頻道 (避免同頻道重複算兩次? 不，processChannel會重置 lastTime，所以分開呼叫兩次是安全的)
            // 但如果只是開關麥克風，old和new channelId一樣，這時我們只需要呼叫一次 processChannel 即可
            if (newState.channelId !== oldState.channelId) {
                processChannel(newState.channel);
            }
            // 同頻道狀態改變 (例如開直播)，因為上面 oldState 已經呼叫過一次 processChannel 並更新了 lastTime
            // 所以其實不需要再呼叫一次，但為了確保 streamCount 被更新，我們需要確保上面的 processChannel 用的是「最新」的 members
            // 實際上 oldState.channel 和 newState.channel 指向的是同一個 GuildChannel 物件 (Discord.js 機制)
            // 它的 members 已經是最新的狀態了。
            // 所以如果 Id 相同，上面的呼叫已經完成了結算+更新狀態。
        }
    }
};