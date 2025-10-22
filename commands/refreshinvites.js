module.exports = {
    name: "refreshinvites",
    description: "重新抓取伺服器邀請快取",

    async execute(message) {
        const client = message.client;

        try {
            // 重新抓取邀請列表
            const invites = await message.guild.invites.fetch();

            // 更新快取
            client.inviteUses.set(
                message.guild.id,
                new Map(invites.map(inv => [inv.code, inv.uses]))
            );

            await message.reply("✅ 已重新抓取本伺服器的邀請快取！");
            console.log(`🔄 ${message.guild.name} 的邀請快取已更新`);
        } catch (err) {
            console.error("❌ 更新邀請快取時發生錯誤：", err);
            await message.reply("⚠️ 抓取邀請快取失敗，請查看日誌。");
        }
    },
};
