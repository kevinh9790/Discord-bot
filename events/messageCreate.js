// events/messageCreate.js
const fs = require("fs");
const path = require("path");
// 定義要排除的 ID
const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455"]; 
const IGNORED_ROLES = ["1229465574074224720"];

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot || !message.content.startsWith("&")) return;

    // ✅ 只有管理員可以使用文字指令
    if (!message.member.permissions.has("Administrator")) {
      return;
    }

    //#region === 🛡️ 排除過濾 ===
        // 1. 排除特定分類
        if (message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId)) return;
        // 2. 排除特定身分組 (只要該用戶擁有列表中的「任一」身分組就排除)
        if (message.member.roles.cache.some(role => IGNORED_ROLES.includes(role.id))) return;

        // === 📊 統計邏輯 ===
        const stats = message.client.dailyStats;
        if (stats) {
            const chId = message.channel.id;
            
            // 如果這個頻道還沒被記錄過，先建立物件
            if (!stats.channels[chId]) {
                stats.channels[chId] = { msgCount: 0, voiceMs: 0, name: message.channel.name };
            }
            
            stats.channels[chId].msgCount++;
        }
    //#endregion

    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const commandsPath = path.join(__dirname, "../commands");
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.name === commandName) {
        try {
          await command.execute(message, args);
        } catch (error) {
          console.error(error);
          message.reply("執行指令時發生錯誤！");
        }
        break;
      }
    }
  },
};
