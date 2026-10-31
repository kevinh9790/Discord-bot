const statsHandler = require("../utils/statsHandler.js");
const devLogHandler = require("../utils/devLogHandler.js");
const config = require("../config/config.js");
const log = require("../utils/logger");

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    // Debug: Log all messages to help troubleshoot collection issues
    const isWebhook = message.webhookId ? '🔗 [WEBHOOK]' : '👤 [USER]';
    const isBot = message.author.bot ? '🤖 [BOT]' : '✓';
    console.log(`[MessageCreate] ${isWebhook} ${isBot} @${message.author.username} in #${message.channel.name}: "${message.content.substring(0, 60)}"`);

    if (message.author.bot && !message.webhookId) {
      console.log(`[MessageCreate] Skipping bot message`);
      return;
    }

    // 在其他處理器之前記錄，確認 Gateway 是否收到開發進度訊息。
    const devLogGroup = config.DEV_LOG_GROUPS.find(group => group.sourceIds.includes(message.channel.id));
    const diagnoseDevLog = message.content.includes(config.TRIGGER_PREFIX)
      || (devLogGroup && !message.content);
    if (diagnoseDevLog) {
      const prefixMatches = message.content.startsWith(config.TRIGGER_PREFIX);
      await log(client, `[開發進度] 收到訊息\n來源頻道：${message.channel.id}\n訊息 ID：${message.id}\n來源設定：${devLogGroup ? '符合' : '不符合'}\n指令開頭：${prefixMatches ? '符合' : message.content ? '不符合，請將開發進度放在最前面' : '內容為空，請檢查 Message Content Intent'}\n目標論壇：${devLogGroup?.targetId || '無'}`);
    }

    // 1. 處理活躍聊天管理，初始化或同步錯誤不得中斷開發進度指令。
    try {
      Promise.resolve(client.activeChatManager.handleMessage(message))
        .catch(err => console.error("ActiveChat Error:", err));
    } catch (err) {
      console.error("ActiveChat Error:", err);
      if (diagnoseDevLog) await log(client, `[開發進度] 活躍聊天處理失敗，繼續處理指令\n來源頻道：${message.channel.id}\n錯誤：${err.message}`, 'error');
    }

    // 2. 執行每日數據統計
    try {
      statsHandler.trackMessageStats(message);
    } catch(err) {
      console.error("Stats Error:", err);
    }

    // 3. 檢查是否為開發進度日誌 (如果是，這裡就會處理並回傳 true)
    const isDevLog = await devLogHandler.handleDevLog(message, client);
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

    
