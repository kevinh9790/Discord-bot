module.exports = {
    name: 'ready',
    once: true,
    // === Bot 啟動後事件 ===
    async execute(client) {
      console.log(`✅ 已登入為 ${client.user.tag}`);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        client.inviteUses = new Map();

        for (const [guildId, guild] of client.guilds.cache) {
            const invites = await guild.invites.fetch();
            client.inviteUses.set(guildId, new Map(invites.map(inv => [inv.code, inv.uses])));
        }

        console.log(`🤖 已啟動並記錄所有伺服器邀請次數`);
    }
  };