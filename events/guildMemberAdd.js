const fs = require("fs");
const path = require("path");
const log = require("../utils/logger");

module.exports = {
    name: "guildMemberAdd",
    async execute(member, client) {
        try {
            const guild = member.guild;
            let inviteUses = client.inviteUses.get(guild.id) || new Map();

            // 抓取最新邀請列表
            const newInvites = await guild.invites.fetch();

            // 找出使用的邀請
            const usedInvite = newInvites.find(inv => {
                const oldUses = inviteUses.get(inv.code) || 0;
                return inv.uses > oldUses;
            });

            // 更新快取
            newInvites.forEach(inv => inviteUses.set(inv.code, inv.uses));
            client.inviteUses.set(guild.id, inviteUses);

            if (!usedInvite) {
                await log(client, `⚠️ 無法判定 ${member.user.tag} 使用了哪個邀請`);
                return;
            }

            await log(client, `📌 ${member.user.tag} 使用了邀請碼 ${usedInvite.code}`);

            // 🔹 讀取 JSON 的邀請碼對應角色
            const filePath = path.join(__dirname, "../inviteRoles.json");
            if (!fs.existsSync(filePath)) {
                await log(client, `⚠️ inviteRoles.json 不存在`);
                return;
            }

            const inviteRoles = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            const roleId = inviteRoles[usedInvite.code];
            if (!roleId) return;

            const role = guild.roles.cache.get(roleId);
            if (!role) {
                await log(client, `⚠️ 找不到角色 ID: ${roleId}`);
                return;
            }

            // 🔹 檢查 Bot 權限與角色層級
            const botMember = await guild.members.fetch(client.user.id);
            if (!botMember.permissions.has("ManageRoles")) {
                await log(client, `❌ Bot 沒有 Manage Roles 權限，無法加角色`);
                return;
            }

            if (botMember.roles.highest.position <= role.position) {
                await log(client, `❌ Bot 角色層級低於或等於 ${role.name}，無法加角色`);
                return;
            }

            // 加角色
            await member.roles.add(role)
                .then(() => log(client, `🎉 已為 ${member.user.tag} 加上角色 ${role.name}`))
                .catch(err => log(client, `❌ 加角色失敗: ${err.message}`));

        } catch (err) {
            await log(client, `🚨 guildMemberAdd 執行錯誤：${err.message}`);
        }
    },
};
