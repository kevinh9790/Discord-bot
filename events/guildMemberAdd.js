module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            const guild = member.guild;

            // 取得該伺服器的邀請記錄
            let guildInvites = client.inviteUses.get(guild.id);
            if (!guildInvites) guildInvites = new Map();

            // 重新抓最新的邀請狀態
            const newInvites = await guild.invites.fetch();

            // 找出使用次數有增加的邀請
            const usedInvite = newInvites.find(inv => {
                const oldUses = guildInvites.get(inv.code);
                return oldUses !== undefined && inv.uses > oldUses;
            });

            // 更新記錄
            newInvites.each(inv => guildInvites.set(inv.code, inv.uses));
            client.inviteUses.set(guild.id, guildInvites);

            if (!usedInvite) {
                console.log(`⚠️ 無法判定 ${member.user.tag} 使用了哪個邀請`);
                return;
            }

            console.log(`✅ ${member.user.tag} 使用了邀請 ${usedInvite.code}`);

            // === 根據邀請給予身分組 ===
            const inviteRoleMap = {
                "zvXFq24S": "1233787911976259687"
            };

            const roleId = inviteRoleMap[usedInvite.code];
            if (roleId) {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    await member.roles.add(role);
                    console.log(`🎉 已為 ${member.user.tag} 加上角色 ${role.name}`);
                } else {
                    console.log(`⚠️ 找不到角色 ID: ${roleId}`);
                }
            }
        } catch (err) {
            console.error("🚨 guildMemberAdd 執行錯誤：", err);
        }
    }
};
