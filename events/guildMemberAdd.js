module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const guild = member.guild;
            const inviteUses = client.inviteUses.get(guild.id) || new Map();

            // 重新抓所有邀請
            const newInvites = await guild.invites.fetch();

            // 找出使用的邀請
            const usedInvite = newInvites.find(inv => {
                const oldUses = inviteUses.get(inv.code);
                return oldUses !== undefined && inv.uses > oldUses;
            });

            // 更新快取
            newInvites.forEach(inv => inviteUses.set(inv.code, inv.uses));
            client.inviteUses.set(guild.id, inviteUses);

            if (!usedInvite) {
                console.log(`⚠️ 無法判定 ${member.user.tag} 使用了哪個邀請`);
                return;
            }

            console.log(`${member.user.tag} 使用了邀請 ${usedInvite.code}`);

            // 對應邀請給角色
            const inviteRoleMap = {
                "E6NtJhcU": "1233787911976259687"
            };

            const roleId = inviteRoleMap[usedInvite.code];
            if (!roleId) return;

            const role = guild.roles.cache.get(roleId);
            if (!role) {
                console.log(`⚠️ 找不到角色 ID: ${roleId}`);
                return;
            }

            await member.roles.add(role);
            console.log(`🎉 已為 ${member.user.tag} 加上角色 ${role.name}`);
        } catch (err) {
            console.error("🚨 guildMemberAdd 執行錯誤：", err);
        }
    }
};
