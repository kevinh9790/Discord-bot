const activeChatManager = require("../utils/activeChatManager.js");
const llmSummaryManager = require("../utils/llmSummaryManager.js");
const statsHandler = require("../utils/statsHandler.js");
const devLogHandler = require("../utils/devLogHandler.js");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    // 1. 處理活躍聊天管理
    activeChatManager.handleMessage(message).catch(err => console.error("ActiveChat Error:", err));

    // 1b. 如果偵測到熱門頻道，觸發 LLM 討論摘要檢查
    try {
      await llmSummaryManager.handleHotChannel(message.channel, message.client);
    } catch (err) {
      console.error("LLMSummary Error:", err);
    }

    // 2. 執行每日數據統計
    statsHandler.trackMessageStats(message);

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

    