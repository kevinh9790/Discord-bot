const config = require('../config/config.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ 已登入為 ${client.user.tag} `);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        // 將設定掛載到 client 以便其他檔案讀取
        client.filterConfig = config.FILTERS;
        client.filterConfig.TARGET_GUILD_ID = config.TARGET_GUILD_ID;

        //#region 設定邀請連結
        client.inviteUses = new Map();
        for (const [guildId, guild] of client.guilds.cache) {
            if (config.TARGET_GUILD_ID && guildId !== config.TARGET_GUILD_ID) continue;
            try {
                const invites = await guild.invites.fetch();
                client.inviteUses.set(guildId, new Map(invites.map(inv => [inv.code, inv.uses])));
            } catch (err) {
                console.warn(`⚠️ 無法抓取 ${guild.name} 的邀請快取: ${err.message}`);
            }
        }
        console.log(`🤖 已啟動並記錄邀請次數`);
        //#endregion

        // 1. 初始化數據結構
        // msgPoints: 文字活躍積分
        // voicePoints: 語音活躍積分
        // msgCount: 訊息數 (統計用)
        // voiceMs: 語音時長 (統計用)
        // maxUsers: 語音同時最高人數 (統計用)
        client.dailyStats = {
            channels: {}, // { id: { name, msgCount, voiceMs, msgPoints, voicePoints, maxUsers } }
            mostReacted: {
                count: 0,
                url: null,
                content: "",
                author: "",
                authorId: null,
                channelId: null
            },
            voiceState: new Map() // 用於追蹤語音積分計算 { channelId: { lastTime, userCount, streamCount } }
        };
    }
};