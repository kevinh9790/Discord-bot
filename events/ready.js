const fs = require("fs");
const path = require("path");

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

        // 🔹 檢查 inviteRoles.json 是否存在
        const filePath = path.join(__dirname, "../inviteRoles.json");
        if (!fs.existsSync(filePath)) {
            console.warn("⚠️ inviteRoles.json 不存在，請建立此檔案來設定邀請碼對應角色");
        } else {
            console.log("📂 inviteRoles.json 已存在，可支援動態邀請碼對應角色");
        }

        console.log(`🤖 已啟動並記錄所有伺服器邀請次數`);
    }
};
