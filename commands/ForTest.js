// commands/ForTest.js
module.exports = {
    name: "大便",
    description: "大便香腸",
    execute(message) {
      message.reply({
        content:[
            `我要吃`
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds:[]//禁用嵌入卡片
      });
    },
  };
  
  module.exports = {
    name: "公告",
    description: "社群公告",
    async execute(message) {
      
      // 指定要推播的頻道 ID（從 .env 讀取）
      const targetChannelId = process.env.ANNOUNCE_CHANNEL;

       // 從 message 中取得 client 實例
      const client = message.client;

      // 取得頻道物件
      const targetChannel = client.channels.cache.get(targetChannelId);

      if (!targetChannel) {
        return message.reply("⚠️ 找不到指定的公告頻道！");
      }

      // 發送公告訊息
      await targetChannel.send({
        content: [
          `## 📢 **社群公告**`,
          `提醒大家，近期社群內有些可疑帳號出現`,
          `強烈建議大家到 **隱私設定** 中關閉 **私人訊息** `,
          `若有發現任何可疑訊息，也請第一時間通知管理員`,
          `我們將會盡速處理，感謝您的配合！`,
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds: [] // 如果你之後要加 embed 卡片，這裡可以放入 embed 陣列
      });

      // 回覆原發訊者，表示已發送成功
      message.reply("✅ 公告已發送！");
      
    },
  };