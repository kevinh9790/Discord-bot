const path = require('path');
const config = require('../config/config.js');
const { FileStorage } = require('../utils/storage');
const { createActiveChatManager } = require('../utils/activeChatManager');
const { createLlmSummaryManager } = require('../utils/llmSummaryManager');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ 已登入為 ${client.user.tag} `);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        // 將設定掛載到 client 以便其他檔案讀取
        client.filterConfig = config.FILTERS;
        client.filterConfig.TARGET_GUILD_ID = config.TARGET_GUILD_ID;

        // 初始化管理器實例並掛載到 client
        client.activeChatManager = createActiveChatManager(
            new FileStorage(path.join(__dirname, '../data/activeChatState.json'))
        );
        client.llmSummaryManager = createLlmSummaryManager(
            new FileStorage(path.join(__dirname, '../data/llmSummaryState.json'))
        );

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
