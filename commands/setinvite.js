const fs = require("fs");
const path = require("path");

module.exports = {
    name: "設置邀請",
    description: "設定邀請碼對應角色",
    async execute(message, args) {
        if (!message.member.permissions.has("Administrator")) return;

        const [code, roleId] = args;
        if (!code || !roleId) return message.reply("格式：&設置邀請 [邀請碼] [角色ID]");

        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply(`❌ 找不到角色 ID: ${roleId}`);

        const filePath = path.join(__dirname, "../inviteRoles.json");
        let data = {};
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }

        data[code] = roleId;

        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            message.reply(`✅ 已將邀請碼 \`${code}\` 對應到角色 **${role.name}**`);
        } catch (err) {
            message.reply(`❌ 儲存失敗：${err.message}`);
        }
    }
};
