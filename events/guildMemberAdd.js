const log = require("../utils/logger");

module.exports = {
    name: "guildMemberAdd",
    async execute(member, client) {
        try {
            const guild = member.guild;
            const inviteUses = client.inviteUses.get(guild.id) || new Map();

            const newInvites = await guild.invites.fetch();

            const usedInvite = newInvites.find(inv => {
                const oldUses = inviteUses.get(inv.code);
                return oldUses !== undefined && inv.uses > oldUses;
            });

            newInvites.forEach(inv => inviteUses.set(inv.code, inv.uses));
            client.inviteUses.set(guild.id, inviteUses);

            if (!usedInvite) {
                await log(client, `⚠️ 無法判定 ${member.user.tag} 使用了哪個邀請`);
                return;
            }

            await log(client, `${member.user.tag} 使用了邀請 ${usedInvite.code}`);

            const inviteRoleMap = {
                "E6NtJhcU": "1233787911976259687",
            };

            const roleId = inviteRoleMap[usedInvite.code];
            if (!roleId) return;

            const role = guild.roles.cache.get(roleId);
            if (!role) {
                await log(client, `⚠️ 找不到角色 ID: ${roleId}`);
                return;
            }

            await member.roles.add(role);
            await log(client, `🎉 已為 ${member.user.tag} 加上角色 ${role.name}`);
        } catch (err) {
            await log(client, `🚨 guildMemberAdd 執行錯誤：${err.message}`);
        }
    },
};
