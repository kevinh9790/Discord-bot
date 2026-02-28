const activeChatManager = require("../utils/activeChatManager.js");
const llmSummaryManager = require("../utils/llmSummaryManager.js");
const statsHandler = require("../utils/statsHandler.js");
const devLogHandler = require("../utils/devLogHandler.js");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    // Debug: Log all messages to help troubleshoot collection issues
    const isWebhook = message.webhookId ? '🔗 [WEBHOOK]' : '👤 [USER]';
    const isBot = message.author.bot ? '🤖 [BOT]' : '✓';
    console.log(`[MessageCreate] ${isWebhook} ${isBot} @${message.author.username} in #${message.channel.name}: "${message.content.substring(0, 60)}"`);

    if (message.author.bot && !message.webhookId) {
      console.log(`[MessageCreate] Skipping bot message`);
      return;
    }

    // 1. 處理活躍聊天管理
    activeChatManager.handleMessage(message).catch(err => console.error("ActiveChat Error:", err));

    // 2. 執行每日數據統計
    try {
      statsHandler.trackMessageStats(message);
    } catch(err) {
      console.error("Stats Error:", err);
    }

    // 3. 檢查是否為開發進度日誌 (如果是，這裡就會處理並回傳 true)
    const isDevLog = await devLogHandler.handleDevLog(message);
    if (isDevLog) return;

        // 4. 指令處理邏輯

        if (!message.content.startsWith("&")) return;

    

        // ✅ 只有管理員可以使用文字指令

        if (!message.member.permissions.has("Administrator")) {

          return message.reply("❌ 需要管理員權限。");;

        }

    

        const args = message.content.slice(1).trim().split(/ +/);

        const commandName = args.shift().toLowerCase();

    

        const command = message.client.commands.get(commandName);

    

        if (!command) {

          return message.reply(`⚠️ 找不到指令：**${commandName}**`);

        }

    

        try {

          await command.execute(message, args);

        } catch (error) {

          console.error(error);

          message.reply("執行指令錯誤！");

        }

      },

    };

    
