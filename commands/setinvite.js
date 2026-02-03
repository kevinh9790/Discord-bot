const fs = require("fs");
const path = require("path");

module.exports = {
    name: "設置邀請",
    description: "設定邀請碼對應角色",
    async execute(message, args) {
        try {
            if (!message.member.permissions.has("Administrator"))
                return message.reply("❌ 你沒有權限使用此指令");

            const [code, roleIdRaw] = args;
            if (!code || !roleIdRaw)
                return message.reply("格式：&設置邀請 [邀請碼] [角色ID]");

            // 去掉可能的方括號
            const roleId = roleIdRaw.replace(/[[\]]/g, "");
            const role = message.guild.roles.cache.get(roleId);
            if (!role) return message.reply(`❌ 找不到角色 ID: ${roleId}`);

            const filePath = path.join(__dirname, "../inviteRoles.json");
            let data = {};
            if (fs.existsSync(filePath)) {
                data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            }

            data[code] = roleId;

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            message.reply(`✅ 已將邀請碼 \`${code}\` 對應到角色 **${role.name}**`);
        } catch (err) {
            console.error("設置邀請指令錯誤：", err);
            message.reply(`❌ 執行指令時發生錯誤：${err.message}`);
        }
    }
};
