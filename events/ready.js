module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ 已登入為 ${client.user.tag}`);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        client.inviteUses = new Map();

        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const invites = await guild.invites.fetch();
                client.inviteUses.set(
                    guildId,
                    new Map(invites.map(inv => [inv.code, inv.uses]))
                );
                console.log(`📋 已抓取 ${guild.name} 的邀請快取，共 ${invites.size} 筆`);
            } catch (err) {
                console.warn(`⚠️ 無法抓取 ${guild.name} 的邀請快取: ${err.message}`);
            }
        }

        console.log(`🤖 已啟動並記錄所有伺服器邀請次數`);
    },
};
