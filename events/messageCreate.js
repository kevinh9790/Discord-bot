// events/messageCreate.js
const fs = require("fs");
const path = require("path");
const { ChannelType } = require("discord.js");

//引入活躍頻道管理器
const activeChatManager = require("../utils/activeChatManager.js");

//定義開發進度的前綴
// triggerPrefix: 觸發指令 (統一用同一個)
const TRIGGER_PREFIX = "開發進度";

// 定義頻道對應表： [來源頻道 ID] -> [目標論壇 ID]
const DEV_LOG_GROUPS = [
  { 
    targetId: "1230535598259834950", // 目標論壇 A
    sourceIds: [
      "1440593941073231932", // 來源頻道 
    ]
  },
  {
    targetId: "1230535700525486110", // 目標論壇 B
    sourceIds: [
      "1442811186528911512", // 來源頻道
    ]
  }
];

// 快取儲存空間 (放在這裡才能在不同訊息間共用)
// 格式: Map<UserId, { threads: Array, timestamp: Number }>
const threadCache = new Map();
const CACHE_DURATION = 60 * 1000; // 快取有效時間：60秒

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;

    activeChatManager.handleMessage(message).catch(err => console.error("ActiveChat Error:", err));

    // 讀取全域設定 (從 ready.js 掛載的)
    const FILTER_CONFIG = message.client.filterConfig || {
      INCLUDE_CATEGORIES: [],
      EXCLUDE_CATEGORIES: [],
      EXCLUDE_ROLES: [],
      TARGET_GUILD_ID: null
    };

    //#region === 📊 統計邏輯 ===
    /* 判斷條件：
     1. 不是指令 (沒有 & 開頭)
     2. 不是排除的分類
     3. 不是排除的身分組
     判斷是否為「不想統計」的訊息*/
     const isCommand = message.content.startsWith("&");
     const channel = message.channel;
     const parentId = channel.parentId;

  // 1. 檢查是否為目標伺服器
    if (FILTER_CONFIG.TARGET_GUILD_ID && message.guild.id !== FILTER_CONFIG.TARGET_GUILD_ID) {
      // Skip
  } 
  // 2. 檢查排除名單
  else if (
      (parentId && FILTER_CONFIG.EXCLUDE_CATEGORIES.includes(parentId)) || 
      message.member.roles.cache.some(role => FILTER_CONFIG.EXCLUDE_ROLES.includes(role.id))
  ) {
      // 排除
  }
  // 3. 檢查包含名單 (如果有設定的話)
  else if (
      FILTER_CONFIG.INCLUDE_CATEGORIES.length > 0 && 
      (!parentId || !FILTER_CONFIG.INCLUDE_CATEGORIES.includes(parentId))
  ) {
      // 不在包含名單內 -> Skip
  }
  // 4. 執行統計
  else if (!isCommand) {
      const stats = message.client.dailyStats;
      if (stats) {
          const chId = message.channel.id;

          // 初始化
          if (!stats.channels[chId]) {
              stats.channels[chId] = { 
                  name: message.channel.name,
                  msgCount: 0, 
                    voiceMs: 0, 
                    msgPoints: 0, 
                    voicePoints: 0,
                    maxUsers: 0
              };
          }

          const chStats = stats.channels[chId];

          // A. 訊息數 +1 (統計用)
          chStats.msgCount++;

          // B. 積分計算 (排行榜用)
          // 規則：每則+1, 長文(>20)+2, 附件+3
          let score = 1;
          
          // 長文字檢查
          if (message.content.length >= 20) {
              score += 2;
          }

          // 附件或說明檢查 (Embeds 或 Attachments)
          // 這裡假設「說明」指的是 Embed 或是複雜內容，通常 user 發的附件在 attachments
          if (message.attachments.size > 0 || message.embeds.length > 0) {
              score += 3;
          }

          chStats.msgPoints += score;
      }
  }
  //#endregion

    //#region 🚀 開發進度自動轉發 (Forum Log)

    const currentGroup = DEV_LOG_GROUPS.find(group => group.sourceIds.includes(message.channel.id));

    if (currentGroup && message.content.startsWith(TRIGGER_PREFIX)) {

      const targetForumId = currentGroup.targetId;
      const forumChannel = message.guild.channels.cache.get(targetForumId);

      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.error(`❌ [DevLog] 找不到目標論壇 (${targetForumId})`);
        return;
      }

      try {
        // 1. 解析內容：分離 [遊戲名稱] 與 [進度內容]
        // 移除前綴並去除前後空白
        const rawContent = message.content.slice(TRIGGER_PREFIX.length).trim();

        // 使用正規表達式抓取第一個空格前的字當作「遊戲名稱」
        // 格式假設：開發進度 遊戲名稱 內容...
        const splitMatch = rawContent.match(/^(\S+)\s+([\s\S]*)$/);

        let gameName = null;
        let logContent = null;
        const attachmentFiles = Array.from(message.attachments.values());

        if (splitMatch) {
          gameName = splitMatch[1]; // 第一個捕捉組：遊戲名稱
          logContent = splitMatch[2]; // 第二個捕捉組：剩餘內容
        } else if (rawContent.length > 0){
          // 如果只有兩個部分（例如：開發進度 遊戲名），沒有內容，但可能有圖片
            gameName = rawContent.trim(); // 整個當作遊戲名
            logContent = ""; // 內容為空
        }

        // ❌ 錯誤情況 A：格式錯誤（抓不到遊戲名稱）
        if (!gameName) {
          // 回覆提示格式 (一般訊息無法發送 ephemeral 隱藏訊息，只能用 reply)
          return message.reply({
            content: `❌ **格式錯誤！**\n請依照格式輸入：\`${TRIGGER_PREFIX} [遊戲名稱] [進度內容]\`\n範例：\`${TRIGGER_PREFIX} 勇者鬥惡龍 今天畫了主角圖\``
          });
        }

        // 檢查有沒有實質內容（至少要有文字或圖片）
        if (!logContent && attachmentFiles.length === 0) {
          return message.reply("⚠️ 請輸入進度內容或上傳圖片喔！");
        }

        // 2. 搜尋該作者的對應貼文 (改用模糊比對)
        // A. 抓取「活躍中」的貼文
        const activeData = await forumChannel.threads.fetchActive();

        // 將 Collection 轉為 Array 並過濾出作者的文章
        const userActiveThreads = activeData.threads.filter(t => t.ownerId === message.author.id);

        let targetThread = null;
        let maxScore = 0;

        // 先在活躍列表中找找看有沒有「完全命中」或「高度相似」的
        userActiveThreads.forEach(thread => {
          const score = getSimilarity(gameName, thread.name);
          if (score > maxScore) {
            maxScore = score;
            targetThread = thread;
          }
        });

        // 如果在活躍貼文裡已經找到非常像的 (分數 >= 0.9)，就直接用，不用浪費資源去抓封存的
        // 這樣可以節省 API 呼叫，也不用讀取快取
        if (maxScore < 0.9) {

          // B. 活躍的找不到(或分數不夠高)，才去處理「已封存」
          let userArchivedThreads = [];
          const cacheKey = message.author.id;
          const now = Date.now();
          const cachedData = threadCache.get(cacheKey);

          // 檢查快取是否有效
          if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
            // console.log(`[DevLog] 使用快取資料 (User: ${message.author.username})`);
            userArchivedThreads = cachedData.threads;
          } else {
            // 快取失效或不存在，呼叫 Discord API
            // console.log(`[DevLog] 呼叫 API 抓取封存列表 (User: ${message.author.username})`);
            try {
              const archivedData = await forumChannel.threads.fetchArchived({
                type: 'public',
                fetchAll: true,
                limit: 50
              });

              // 為了節省記憶體，我們只存「這個作者」的封存文章進快取
              // archivedData.threads 是一個 Collection，我們轉成 Array
              const allArchived = Array.from(archivedData.threads.values());
              userArchivedThreads = allArchived.filter(t => t.ownerId === message.author.id);

              // 更新快取
              threadCache.set(cacheKey, {
                threads: userArchivedThreads,
                timestamp: now
              });

            } catch (err) {
              console.error("❌ 無法抓取封存列表 (可能被 Rate Limit):", err);
              // 失敗時不中斷，就用空的陣列繼續
            }
          }

          // C. 重新比對所有文章 (活躍 + 封存)
          // 我們把剛才抓到的封存文章加入比對行列
          userArchivedThreads.forEach(thread => {
            const score = getSimilarity(gameName, thread.name);
            if (score > maxScore) {
              maxScore = score;
              targetThread = thread;
            }
          });
        }

        // ❌ 錯誤情況 B：找不到對應文章 (或是相似度都太低)
        if (!targetThread) {
          return message.reply({
            content: `❌ **找不到指定文章！**\n\n**請先前往 <#${targetForumId}> 建立一篇標題包含「${gameName}」的貼文後再試一次。**`
          });
        }

        // 3. 執行轉發 (既然找到了，就直接發)
        await targetThread.send({
          content: logContent || `**${message.author.username} 更新了 ${gameName} 的進度：**`,
          files: attachmentFiles
        });
        await message.react("✅");

      } catch (err) {
        await message.reply(`❌ 轉發失敗: ${err.message}`);
      }

      return;
    }
    //#endregion

    // === 🎯 指令處理邏輯 ===

    if (!isCommand) return;

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
