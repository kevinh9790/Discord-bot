const log = require("../utils/logger");

module.exports = {
    name: "重抓",
    description: "重新抓取伺服器邀請快取",

    async execute(message) {
        const client = message.client;

        try {
            const invites = await message.guild.invites.fetch();

            client.inviteUses.set(
                message.guild.id,
                new Map(invites.map(inv => [inv.code, inv.uses]))
            );

            await message.reply("✅ 已重新抓取本伺服器的邀請快取！");
            await log(client, `🔄 ${message.guild.name} 的邀請快取已更新`);
        } catch (err) {
            await log(client, `❌ 更新邀請快取失敗：${err.message}`);
            await message.reply("⚠️ 抓取邀請快取失敗，請查看日誌。");
        }
    },
};
