const fs = require("fs");
const path = require("path");
const activeChatManager = require("../utils/activeChatManager.js");
const statsHandler = require("../utils/statsHandler.js");
const devLogHandler = require("../utils/devLogHandler.js");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    // 1. 處理活躍聊天管理
    activeChatManager.handleMessage(message).catch(err => console.error("ActiveChat Error:", err));

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
    const commandsPath = path.join(__dirname, "../commands");
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

    let commandFound = false;

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.name === commandName) {
        commandFound = true;
        try {
          await command.execute(message, args);
        } catch (error) {
          console.error(error);
          message.reply("執行指令錯誤！");
        }
        break;
      }
    }

    if (!commandFound) {
      message.reply(`⚠️ 找不到指令：**${commandName}**`);
    }
  },
};