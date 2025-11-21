const { 
    Events, 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder 
} = require('discord.js');

const SUGGESTION_CHANNEL_ID = "1441340015299792988"; 

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        
        // ====================================================
        // 🔘 區域 1：按鈕互動處理 (Button Interactions)
        // ====================================================
        //#region 按鈕互動處理
        if (interaction.isButton()) {
            
            //#region --- 功能 A：開啟 Ticket ---
            if (interaction.customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });

                const guild = interaction.guild;
                const user = interaction.user;
                const category = interaction.channel.parent;

                const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
                if (existingChannel) {
                    return interaction.editReply({ content: `❌ 您已經有一個進行中的客服單：${existingChannel}` });
                }

                try {
                    const ticketChannel = await guild.channels.create({
                        name: `ticket-${user.username}`,
                        type: ChannelType.GuildText,
                        parent: category ? category.id : null,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ],
                    });

                    const closeRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('關閉客服單').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );

                    await ticketChannel.send({
                        content: `${user} 您好！管理員很快會來協助您。\n問題解決後，請點擊下方按鈕關閉頻道。`,
                        components: [closeRow]
                    });

                    await interaction.editReply({ content: `✅ 已為您開設私人頻道：${ticketChannel}` });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply({ content: "⚠️ 建立頻道時發生錯誤，請檢查機器人權限。" });
                }
            }
            //#endregion

            //#region --- 功能 B：關閉 Ticket ---
            if (interaction.customId === 'close_ticket') {
                if (!interaction.channel.name.startsWith('ticket-')) {
                    return interaction.reply({ content: "這不是一個有效的 Ticket 頻道。", ephemeral: true });
                }
                await interaction.reply("🔒 客服單將在 5 秒後刪除...");
                setTimeout(() => {
                    interaction.channel.delete().catch(err => console.error("刪除頻道失敗:", err));
                }, 5000);
            }
            //#endregion

            //#region --- 功能 C：開啟建議箱表單 (新增的部分) ---
            if (interaction.customId === 'open_suggestion_modal') {
                const modal = new ModalBuilder()
                    .setCustomId('submit_suggestion')
                    .setTitle('📝 提供您的寶貴建議');

                const titleInput = new TextInputBuilder()
                    .setCustomId('suggestion_title')
                    .setLabel("建議主題")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("例如：希望新增更多語音頻道")
                    .setRequired(true);

                const contentInput = new TextInputBuilder()
                    .setCustomId('suggestion_content')
                    .setLabel("詳細內容")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("請詳細描述您的想法...")
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
                const secondActionRow = new ActionRowBuilder().addComponents(contentInput);

                modal.addComponents(firstActionRow, secondActionRow);
                
                // 顯示表單給用戶填寫
                await interaction.showModal(modal);
            }
            //#endregion
        }
        //#endregion

        // ====================================================
        // 📝 區域 2：表單提交處理 (Modal Submits)
        // ====================================================
        //#region 表單提交處理
        if (interaction.isModalSubmit()) {
            
            //#region --- 功能 D：處理建議箱送出的內容 ---
            if (interaction.customId === 'submit_suggestion') {
                const title = interaction.fields.getTextInputValue('suggestion_title');
                const content = interaction.fields.getTextInputValue('suggestion_content');
                const targetChannel = interaction.guild.channels.cache.get(SUGGESTION_CHANNEL_ID);

                try {
                    // 1. 使用 fetch 確保能抓到討論串 (即使它沉下去了)
                    const targetThread = await interaction.guild.channels.fetch(targetThreadId);

                    if (!targetThread) {
                        return interaction.reply({ content: "❌ 設定錯誤：找不到指定的討論串，請確認 ID 是否正確。", ephemeral: true });
                    }

                    // 2. 檢查是否為討論串類型 (Thread)
                    if (!targetThread.isThread()) {
                        return interaction.reply({ content: "❌ 設定錯誤：指定的 ID 不是一個討論串 (Thread)。", ephemeral: true });
                    }

                    // 3. 如果討論串被「封存/歸檔 (Archived)」了，機器人要先把它喚醒
                    // (不然發訊息可能會失敗，或沒人看到)
                    if (targetThread.archived) {
                        await targetThread.setArchived(false);
                    }

                    // 4. 建立漂亮的 Embed
                    const embed = new EmbedBuilder()
                        .setTitle(`💡 新的建議：${title}`)
                        .setDescription(content)
                        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                        .setColor(0xFFA500) // 橘色
                        .setTimestamp()
                        .setFooter({ text: `用戶 ID: ${interaction.user.id}` });

                    // 5. 直接發送進該討論串
                    await targetThread.send({ embeds: [embed] });

                    // 6. 回覆用戶成功
                    await interaction.reply({ content: "✅ 您的建議已送出至討論區！", ephemeral: true });

                } catch (error) {
                    console.error("發送建議至討論串失敗：", error);
                    
                    let errorMsg = "❌ 發送失敗，請聯繫管理員。";
                    if (error.code === 10003) errorMsg = "❌ 找不到該討論串 (Unknown Channel)，ID 可能錯了。";
                    if (error.code === 50001) errorMsg = "❌ 機器人沒有權限在該討論串發言。";

                    // 避免重複回覆導致報錯
                    if (!interaction.replied) {
                        await interaction.reply({ content: errorMsg, ephemeral: true });
                    }
                }
            }
            //#endregion
        }
        //#endregion
    },
};