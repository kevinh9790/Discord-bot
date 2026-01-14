const { ChannelType } = require("discord.js");
const config = require("../config/config.js");

const TRIGGER_PREFIX = config.TRIGGER_PREFIX;
const DEV_LOG_GROUPS = config.DEV_LOG_GROUPS;

// 快取儲存空間 (放在這裡才能在不同訊息間共用)
// 格式: Map<UserId, { threads: Array, timestamp: Number }>
const threadCache = new Map();
const CACHE_DURATION = 60 * 1000; // 快取有效時間：60秒

/**
 * 計算兩個字串的相似度 (Dice Coefficient)
 * 會自動移除符號並轉小寫，支援中文與英文
 * @param {string} str1 輸入的名稱
 * @param {string} str2 比較對象(標題)
 * @returns {number} 0.0 ~ 1.0 (1.0 代表完全一樣)
 */
function getSimilarity(str1, str2) {
    // 1. 清洗字串：轉小寫，移除所有非文字(標點符號、括號、空白)
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

module.exports = {
    async handleDevLog(message) {
        const currentGroup = DEV_LOG_GROUPS.find(group => group.sourceIds.includes(message.channel.id));

        if (!currentGroup || !message.content.startsWith(TRIGGER_PREFIX)) {
            return false; // Not a dev log message
        }

        const targetForumId = currentGroup.targetId;
        const forumChannel = message.guild.channels.cache.get(targetForumId);

        if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
            console.error(`❌ [DevLog] 找不到目標論壇 (${targetForumId})`);
            return true; // Handled (with error)
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
            } else if (rawContent.length > 0) {
                // 如果只有兩個部分（例如：開發進度 遊戲名），沒有內容，但可能有圖片
                gameName = rawContent.trim(); // 整個當作遊戲名
                logContent = ""; // 內容為空
            }

            // ❌ 錯誤情況 A：格式錯誤（抓不到遊戲名稱）
            if (!gameName) {
                await message.reply({
                    content: `❌ **格式錯誤！**\n請依照格式輸入：\
`${TRIGGER_PREFIX} [遊戲名稱] [進度內容]
範例：\
`${TRIGGER_PREFIX} 勇者鬥惡龍 今天畫了主角圖`
                });
                return true;
            }

            // 檢查有沒有實質內容（至少要有文字或圖片）
            if (!logContent && attachmentFiles.length === 0) {
                await message.reply("⚠️ 請輸入進度內容或上傳圖片喔！");
                return true;
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
            if (maxScore < 0.9) {

                // B. 活躍的找不到(或分數不夠高)，才去處理「已封存」
                let userArchivedThreads = [];
                const cacheKey = message.author.id;
                const now = Date.now();
                const cachedData = threadCache.get(cacheKey);

                // 檢查快取是否有效
                if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
                    userArchivedThreads = cachedData.threads;
                } else {
                    // 快取失效或不存在，呼叫 Discord API
                    try {
                        const archivedData = await forumChannel.threads.fetchArchived({
                            type: 'public',
                            fetchAll: true,
                            limit: 50
                        });

                        const allArchived = Array.from(archivedData.threads.values());
                        userArchivedThreads = allArchived.filter(t => t.ownerId === message.author.id);

                        // 更新快取
                        threadCache.set(cacheKey, {
                            threads: userArchivedThreads,
                            timestamp: now
                        });

                    } catch (err) {
                        console.error("❌ 無法抓取封存列表 (可能被 Rate Limit):", err);
                    }
                }

                // C. 重新比對所有文章 (活躍 + 封存)
                userArchivedThreads.forEach(thread => {
                    const score = getSimilarity(gameName, thread.name);
                    if (score > maxScore) {
                        maxScore = score;
                        targetThread = thread;
                    }
                });
            }

            // ❌ 錯誤情況 B：找不到對應文章
            if (!targetThread) {
                await message.reply({
                    content: `❌ **找不到指定文章！**\n\n**請先前往 <#${targetForumId}> 建立一篇標題包含「${gameName}」的貼文後再試一次。**`
                });
                return true;
            }

            // 3. 執行轉發
            await targetThread.send({
                content: logContent || `**${message.author.username} 更新了 ${gameName} 的進度：**`,
                files: attachmentFiles
            });
            await message.react("✅");

        } catch (err) {
            await message.reply(`❌ 轉發失敗: ${err.message}`);
        }

        return true; // Handled
    }
};
