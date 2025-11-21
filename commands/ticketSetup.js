const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// 用於創建工單按鈕
module.exports = {
    name: "住客登記", // 觸發指令：&客服單
    description: "發送 Ticket 客服面板",
    async execute(message) {
        // 1. 建立按鈕
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket') // 這是按鈕的唯一 ID，等下在事件裡會用到
                    .setLabel('入住申請')
                    .setStyle(ButtonStyle.Success) // 綠色按鈕
                    .setEmoji('📩')
            );

        // 2. 發送訊息帶按鈕
        await message.channel.send({
            content: "### 🎫 想住嗎？\n點擊下方按鈕，系統將為您開設一個私人頻道。",
            components: [row]
        });
        
        // 刪除管理員的指令訊息，保持版面乾淨
        try { await message.delete(); } catch (e) {}
    },
};