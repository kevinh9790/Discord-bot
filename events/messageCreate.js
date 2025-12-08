// events/messageCreate.js
const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");
// 定義要排除的 ID
const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455", "1440221111228043394"];
const IGNORED_ROLES = ["1229465574074224720"];

//定義開發進度的前綴
const DEV_LOG_CONFIG = {
  triggerPrefix: "開發進度",
  sourceChannelId: "1447566126102872217",
  targetForumId: "1447566187339841587"
};

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
    const isCommand = message.content.startsWith("!");
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
        //console.log(`[DEBUG] 頻道 ${message.channel.name} 訊息+1`);
      }
    } else {
      //console.log(`🛡️ 訊息未計入統計 (排除名單)：${message.channel.name}`);
    }
    //#endregion

    //#region 🚀 開發進度自動轉發 (Forum Log)

    if (message.channel.id === DEV_LOG_CONFIG.sourceChannelId && message.content.startsWith(DEV_LOG_CONFIG.triggerPrefix)) {

      const forumChannel = message.guild.channels.cache.get(DEV_LOG_CONFIG.targetForumId);

      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.error(`❌ [DevLog] 找不到目標論壇 (${DEV_LOG_CONFIG.targetForumId})`);
        return;
      }

      try {
        // 1. 解析內容：分離 [遊戲名稱] 與 [進度內容]
        // 移除前綴並去除前後空白
        const rawContent = message.content.slice(DEV_LOG_CONFIG.triggerPrefix.length).trim();

        // 使用正規表達式抓取第一個空格前的字當作「遊戲名稱」
        // 格式假設：開發進度 遊戲名稱 內容...
        const splitMatch = rawContent.match(/^(\S+)\s+([\s\S]*)$/);

        let gameName = null;
        let logContent = null;
        const attachmentFiles = Array.from(message.attachments.values());

        if (splitMatch) {
          gameName = splitMatch[1]; // 第一個捕捉組：遊戲名稱
          logContent = splitMatch[2]; // 第二個捕捉組：剩餘內容
        } else {
          // 如果只有兩個部分（例如：開發進度 遊戲名），沒有內容，但可能有圖片
          if (rawContent.length > 0) {
            gameName = rawContent.trim(); // 整個當作遊戲名
            logContent = ""; // 內容為空
          }
        }

        // ❌ 錯誤情況 A：格式錯誤（抓不到遊戲名稱）
        if (!gameName) {
          // 回覆提示格式 (一般訊息無法發送 ephemeral 隱藏訊息，只能用 reply)
          return message.reply({
            content: `❌ **格式錯誤！**\n請依照格式輸入：\`${DEV_LOG_CONFIG.triggerPrefix} [遊戲名稱] [進度內容]\`\n範例：\`${DEV_LOG_CONFIG.triggerPrefix} 勇者鬥惡龍 今天畫了主角圖\``
          });
        }

        // 檢查有沒有實質內容（至少要有文字或圖片）
        if (!logContent && attachmentFiles.length === 0) {
          return message.reply("⚠️ 請輸入進度內容或上傳圖片喔！");
        }

        // 2. 搜尋該作者的對應貼文 (改用模糊比對)
        const activeThreads = await forumChannel.threads.fetchActive();

        // 先過濾出「該作者」擁有的貼文
        const userThreads = activeThreads.threads.filter(t => t.ownerId === message.author.id);

        let targetThread = null;
        let maxScore = 0;
        const THRESHOLD = 0.4; // 相似度門檻 (0.0 ~ 1.0)，建議 0.4 或 0.5，太低會誤判

        userThreads.forEach(thread => {
          // 計算相似度分數
          const score = getSimilarity(gameName, thread.name);

          // Debug: 可以在這裡 console.log 看看分數，方便調整
          // console.log(`[比對] 輸入:${gameName} vs 標題:${thread.name} = 分數:${score.toFixed(2)}`);

          // 找出最高分且超過門檻的
          if (score > maxScore && score >= THRESHOLD) {
            maxScore = score;
            targetThread = thread;
          }
        });

        // ❌ 錯誤情況 B：找不到對應文章 (或是相似度都太低)
        if (!targetThread) {
          return message.reply({
            content: `❌ **找不到指定文章！**\n機器人找不到您名下標題包含 **「${gameName}」** 的開發日誌。\n\n💡 **請先前往 <#${DEV_LOG_CONFIG.targetForumId}> 建立一篇標題包含「${gameName}」的貼文後再試一次。**`
          });
        }

        // 3. 執行轉發 (既然找到了，就直接發)
        await targetThread.send({
          content: logContent || `**${message.author.username} 更新了 ${gameName} 的進度：**`,
          files: attachmentFiles
        });
        await message.react("✅");
        console.log(`✅ [DevLog] 已轉發 [${gameName}] 進度至: ${targetThread.name}`);

      } catch (err) {
        console.error("❌ [DevLog] 轉發失敗:", err);
        await message.reply(`❌ 轉發失敗: ${err.message}`);
      }

      return;
    }
    //#endregion

    /**
 * 計算兩個字串的相似度 (Dice Coefficient)
 * 會自動移除符號並轉小寫，支援中文與英文
 * @param {string} str1 輸入的名稱
 * @param {string} str2 比較對象(標題)
 * @returns {number} 0.0 ~ 1.0 (1.0 代表完全一樣)
 */
    function getSimilarity(str1, str2) {
      // 1. 清洗字串：轉小寫，移除所有非文字(標點符號、括號、空白)
      // 這樣《布林》跟 布林 會變成一樣的 "布林"
      const clean = (s) => s.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "");

      const s1 = clean(str1);
      const s2 = clean(str2);

      // 2. 特殊狀況判斷
      if (!s1 || !s2) return 0;
      if (s1 === s2) return 1; // 完全一樣
      if (s2.includes(s1)) return 0.9; // 標題包含輸入 (例如輸入"哥布林"，標題"布林布林哥布林") 給予極高分

      // 3. Bigram (雙字切分) 演算法
      const getBigrams = (string) => {
        const bigrams = [];
        for (let i = 0; i < string.length - 1; i++) {
          bigrams.push(string.substring(i, i + 2));
        }
        return bigrams;
      };

      const s1Gram = getBigrams(s1);
      const s2Gram = getBigrams(s2);

      if (s1Gram.length === 0 || s2Gram.length === 0) return 0;

      let intersection = 0;
      // 計算重疊的字組數量
      for (let i = 0; i < s1Gram.length; i++) {
        const item = s1Gram[i];
        if (s2Gram.includes(item)) {
          intersection++;
          // 避免重複計算同一個 bigram，這裡簡單處理即可，若要嚴謹可移除 s2Gram 中的該元素
        }
      }

      // Dice 公式: (2 * 交集數量) / (集合A長度 + 集合B長度)
      return (2.0 * intersection) / (s1Gram.length + s2Gram.length);
    }

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
          //console.log(`🚀 正在執行指令：${commandName}`);
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

/**
 * 計算兩個字串的相似度 (Dice Coefficient)
 * 會自動移除符號並轉小寫，支援中文與英文
 * @param {string} str1 輸入的名稱
 * @param {string} str2 比較對象(標題)
 * @returns {number} 0.0 ~ 1.0 (1.0 代表完全一樣)
 */
function getSimilarity(str1, str2) {
  // 1. 清洗字串：轉小寫，移除所有非文字(標點符號、括號、空白)
  // 這樣《布林》跟 布林 會變成一樣的 "布林"
  const clean = (s) => s.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "");
  
  const s1 = clean(str1);
  const s2 = clean(str2);

  // 2. 特殊狀況判斷
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1; // 完全一樣
  if (s2.includes(s1)) return 0.9; // 標題包含輸入 (例如輸入"哥布林"，標題"布林布林哥布林") 給予極高分

  // 3. Bigram (雙字切分) 演算法
  const getBigrams = (string) => {
      const bigrams = [];
      for (let i = 0; i < string.length - 1; i++) {
          bigrams.push(string.substring(i, i + 2));
      }
      return bigrams;
  };

  const s1Gram = getBigrams(s1);
  const s2Gram = getBigrams(s2);
  
  if (s1Gram.length === 0 || s2Gram.length === 0) return 0;

  let intersection = 0;
  // 計算重疊的字組數量
  for (let i = 0; i < s1Gram.length; i++) {
      const item = s1Gram[i];
      if (s2Gram.includes(item)) {
          intersection++;
          // 避免重複計算同一個 bigram，這裡簡單處理即可，若要嚴謹可移除 s2Gram 中的該元素
      }
  }

  // Dice 公式: (2 * 交集數量) / (集合A長度 + 集合B長度)
  return (2.0 * intersection) / (s1Gram.length + s2Gram.length);
}
