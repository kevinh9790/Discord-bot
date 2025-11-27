// events/messageCreate.js
const fs = require("fs");
const path = require("path");
// 定義要排除的 ID
const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455", "1440221111228043394"]; 
const IGNORED_ROLES = ["1229465574074224720"];

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    
    //#region === 📊 統計邏輯 ===
        /* 判斷條件：
         1. 不是指令 (沒有 & 開頭)
         2. 不是排除的分類
         3. 不是排除的身分組
         判斷是否為「不想統計」的訊息*/
        const isCommand = message.content.startsWith("&");
        const isIgnoredCategory = message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId);
        const isIgnoredRole = message.member.roles.cache.some(role => IGNORED_ROLES.includes(role.id));

        if (!isCommand && !isIgnoredCategory && !isIgnoredRole) {
          const stats = message.client.dailyStats;
          if (stats) {
              const chId = message.channel.id;
            
              // 如果這個頻道還沒被記錄過，先建立物件
              if (!stats.channels[chId]) {
                  stats.channels[chId] = { msgCount: 0, voiceMs: 0, name: message.channel.name };
              }
            
              stats.channels[chId].msgCount++;
              console.log(`[DEBUG] 頻道 ${message.channel.name} 訊息+1`);
          }
        } else {
          console.log(`🛡️ 訊息未計入統計 (排除名單)：${message.channel.name}`);
      }
    //#endregion

    // === 🎯 指令處理邏輯 ===

    if (!isCommand) return;
    
    // ✅ 只有管理員可以使用文字指令
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ 【除錯模式】操作失敗：偵測到您沒有「管理員 (Administrator)」權限。");;
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
          console.log(`🚀 正在執行指令：${commandName}`);
          await command.execute(message, args);
        } catch (error) {
          console.error(error);
          message.reply("執行指令時發生錯誤！");
        }
        break;
      }
    }

    if (!commandFound) {
      message.reply(`⚠️ 【除錯模式】找不到指令：**${commandName}**`);
    }
  },
};
