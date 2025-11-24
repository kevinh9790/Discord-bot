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
        //#region 住客登記功能
        if (interaction.isButton()) {
            
            //#region --- 功能 A：開啟 Ticket ---
            if (interaction.customId === 'open_ticket') {
                await interaction.deferReply({ ephemeral: true });

                const guild = interaction.guild;
                const user = interaction.user;
                const category = interaction.channel.parent;

                const existingChannel = guild.channels.cache.find(c => c.name === `住客申請-${user.username.toLowerCase()}`);
                if (existingChannel) {
                    return interaction.editReply({ content: `❌ 您已經有一個進行中的申請單：${existingChannel}` });
                }

                try {
                    const ticketChannel = await guild.channels.create({
                        name: `住客申請-${user.username}`,
                        type: ChannelType.GuildText,
                        parent: category ? category.id : null,
                        permissionOverwrites: [
                            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ],
                    });

                    const closeRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('close_ticket').setLabel('關閉申請單').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                    );

                    // 1. 建立「樓層規範」Embed
                    const rulesEmbed = new EmbedBuilder()
                        .setTitle('📜 樓層規範')
                        .setColor(0xFF0000) // 紅色 (代表重要規範)
                        .setDescription(
                            '1️⃣ 每位開發者皆可申請一層樓，並擁有該樓層的自主管理權\n\n' +
                            '2️⃣ 樓層包含：一間文字頻道 + 一間語音頻道(可選)\n\n' +
                            '3️⃣ 若為團隊申請樓層，請提交所需管理權限的人員名單\n\n' +
                            '4️⃣ 樓層命名請勿有任何髒話、辱罵、色情等不雅字眼\n\n' +
                            '5️⃣ 若為18禁的樓層，名稱前綴記得註記18禁符號🔞\n\n' +
                            '6️⃣ 頻道內容鼓勵以遊戲相關的討論為主，但不只侷限於遊戲範疇，也可以是日常生活分享\n\n' +
                            '7️⃣ 樓層每三個月會針對活躍度進行評估，活躍度過低的頻道將會視情況隱藏，請樓層負責人主動向管理員提出申訴\n\n' +
                            '8️⃣ 嚴禁違反社群規範，詳情請見：https://discord.com/channels/859390147110633512/859390147656679457/1257649090821488703\n\n' +
                            '※以上規範，夜城擁有最終解釋權\n' +
                            '-# 更新日期：2025/11/24'
                        );

                    // 2. 建立「申請格式」Embed
                    const applyEmbed = new EmbedBuilder()
                        .setTitle('📝 樓層申請格式')
                        .setColor(0x00FF00) // 綠色 (代表可以開始填寫)
                        .setDescription(
                            '**樓層名稱：**\n' +
                            '\n' +
                            '**文字頻道名稱：**\n' +
                            '\n' +
                            '**樓層用途：**\n' +
                            '(遊戲開發進度分享、遊戲製作知識分享、開發者日常分享...等等)\n' +
                            '\n' +
                            '**是否需要語音頻道：**\n' +
                            '(需要的話請填頻道名稱)\n' +
                            '\n' +
                            '**是否希望機器人能推播提醒進度的通知：**\n' +
                            '(每月一次)\n' +
                            '\n' +
                            '**樓層管理員：**'
                        );

                    // 3. 發送訊息 (包含 content, embeds, components)
                    await ticketChannel.send({
                        content: `${user} 冒險者您好！歡迎使用本服務，請詳閱規範後填寫申請表。`,
                        embeds: [rulesEmbed, applyEmbed], // 這裡放入剛剛做好的兩張卡片
                        components: [closeRow]
                    });

                    await interaction.editReply({ content: `✅ 請前往填寫入住申請單：${ticketChannel}` });

                } catch (error) {
                    console.error(error);
                    await interaction.editReply({ content: "⚠️ 發生不可預期異常，請聯繫管理員。" });
                }
            }
            //#endregion

            //#region --- 功能 B：關閉 Ticket ---
            if (interaction.customId === 'close_ticket') {
                if (!interaction.channel.name.startsWith('住客申請-')) {
                    return interaction.reply({ content: "這不是一個有效的 Ticket 頻道。", ephemeral: true });
                }
                await interaction.reply("🔒 申請單將在 5 秒後關閉...");
                setTimeout(() => {
                    interaction.channel.delete().catch(err => console.error("關閉頻道失敗:", err));
                }, 5000);
            }
            //#endregion
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

        // ====================================================
        // 📝 區域 2：表單提交處理 (Modal Submits)
        // ====================================================
        //#region 表單提交處理
        if (interaction.isModalSubmit()) {
            
            //#region --- 功能 D：處理建議箱送出的內容 ---
            if (interaction.customId === 'submit_suggestion') {
                const title = interaction.fields.getTextInputValue('suggestion_title');
                const content = interaction.fields.getTextInputValue('suggestion_content');

                try {
                    // 1. 使用 fetch 確保能抓到討論串 (即使它沉下去了)
                    const targetThread = await interaction.guild.channels.fetch(SUGGESTION_CHANNEL_ID);

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
                        .setTitle(`${title}`)
                        .setDescription(content)
                        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                        .setColor(0xFFA500) // 橘色
                        .addFields({ name: '\n👤 建議者', value: interaction.user.toString(), inline: true })
                        .setTimestamp();

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