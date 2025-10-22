const log = require("../utils/logger");

module.exports = {
    name: "ready",
    once: true,
    async execute(client) {
        await log(client, `✅ 已登入為 ${client.user.tag}`);
        await log(client, `🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        client.inviteUses = new Map();

        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const invites = await guild.invites.fetch();
                client.inviteUses.set(
                    guildId,
                    new Map(invites.map(inv => [inv.code, inv.uses]))
                );
                await log(client, `📋 已抓取 ${guild.name} 的邀請快取，共 ${invites.size} 筆`);
            } catch (err) {
                await log(client, `⚠️ 無法抓取 ${guild.name} 的邀請快取: ${err.message}`);
            }
        }

        await log(client, `🤖 已啟動並記錄所有伺服器邀請次數`);
    },
};
