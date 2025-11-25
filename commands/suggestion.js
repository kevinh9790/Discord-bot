const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: "建議箱",
    description: "發送建議箱面板",
    async execute(message) {
        // 建立一個按鈕
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_suggestion_modal')
                    .setLabel('投遞建議')
                    .setStyle(ButtonStyle.Primary) // 藍色按鈕
                    .setEmoji('💡')
            );

        const embed = new EmbedBuilder()
            .setTitle("📬 社群建議箱")
            .setDescription("對伺服器有什麼想法嗎？\n點擊下方按鈕，告訴我們你的建議！")
            .setColor(0x5865F2);

        await message.channel.send({ embeds: [embed], components: [row] });
        // 刪除指令訊息，保持版面乾淨
        try { await message.delete(); } catch (e) {}
    },
};