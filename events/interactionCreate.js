const { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// 用於工單功能的設置
module.exports = {
    name: Events.InteractionCreate, // 對應 'interactionCreate'
    async execute(interaction, client) {
        // 確保這是一個按鈕互動
        if (!interaction.isButton()) return;

        // ==========================================
        // 🟢 功能 1：開啟 Ticket (對應 open_ticket ID)
        // ==========================================
        if (interaction.customId === 'open_ticket') {
            await interaction.deferReply({ ephemeral: true }); // 告訴 Discord 我們正在處理，避免超時

            const guild = interaction.guild;
            const user = interaction.user;
            const category = interaction.channel.parent; // 獲取當前按鈕所在的「分類」

            // 檢查該用戶是否已經開過單 (防止洗版)
            // 這裡簡單用頻道名稱判斷，你可以改得更嚴謹
            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `❌ 您已經有一個進行中的客服單：${existingChannel}` });
            }

            try {
                // 建立私人頻道
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    parent: category ? category.id : null, // 如果有分類，就設在同分類下
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone (其他人看不見)
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: user.id, // 點擊按鈕的用戶 (看得見、能發言)
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                        },
                        {
                            id: client.user.id, // 機器人自己 (必須要看得見才能操作)
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        }
                        // 💡 這裡可以補上「管理員身分組 ID」，讓管理員也能看到
                        // {
                        //    id: "你的管理員身分組ID",
                        //    allow: [PermissionFlagsBits.ViewChannel],
                        // }
                    ],
                });

                // 建立「關閉頻道」的按鈕
                const closeRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('關閉客服單')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒')
                    );

                // 在新頻道發送歡迎訊息
                await ticketChannel.send({
                    content: `${user} 您好！管理員很快會來協助您。\n問題解決後，請點擊下方按鈕關閉頻道。`,
                    components: [closeRow]
                });

                // 回覆原本點擊按鈕的人
                await interaction.editReply({ content: `✅ 已為您開設私人頻道：${ticketChannel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: "⚠️ 建立頻道時發生錯誤，請檢查機器人是否擁有「管理頻道」權限。" });
            }
        }

        // ==========================================
        // 🔴 功能 2：關閉 Ticket (對應 close_ticket ID)
        // ==========================================
        if (interaction.customId === 'close_ticket') {
            // 只有在新開的 ticket 頻道裡按才有效
            if (!interaction.channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: "這不是一個有效的 Ticket 頻道。", ephemeral: true });
            }

            await interaction.reply("🔒 客服單將在 5 秒後刪除...");
            
            // 5秒後刪除頻道
            setTimeout(() => {
                interaction.channel.delete().catch(err => console.error("刪除頻道失敗:", err));
            }, 5000);
        }
    },
};