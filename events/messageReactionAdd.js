const log = require('../utils/logger');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {

    const client = reaction.client;

    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (error) {
      await log(client, `❌ 無法讀取反應或訊息: ${error.message}`, 'error');
      return;
    }

    const message = reaction.message;
    const stats = client.dailyStats;
    const FILTER_CONFIG = client.filterConfig;

    // 記錄一般訊息
    // await log(client, `🔍 偵測到 ${user.username} 在 <#${message.channel.id}> 對訊息按了 ${reaction.emoji.name}`);

        //#region 📊 統計邏輯
    // 檢查頻道過濾 (使用與 ready.js 一致的邏輯)
    let isTracked = true;
    if (FILTER_CONFIG) {
        if (FILTER_CONFIG.TARGET_GUILD_ID && message.guild.id !== FILTER_CONFIG.TARGET_GUILD_ID) isTracked = false;
        if (message.channel.parentId && FILTER_CONFIG.EXCLUDE_CATEGORIES.includes(message.channel.parentId)) isTracked = false;
        if (FILTER_CONFIG.INCLUDE_CATEGORIES.length > 0 && (!message.channel.parentId || !FILTER_CONFIG.INCLUDE_CATEGORIES.includes(message.channel.parentId))) isTracked = false;
    }

    if (stats && isTracked) {
      const chId = message.channel.id;
      
      // 1. 初始化頻道數據
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

      // 2. 增加頻道活躍積分
      // 規則：有人按讚，頻道積分+1 (不做複雜的去重檢查以節省效能)
      stats.channels[chId].msgPoints += 1;

      // 3. 反應王 (Most Reacted) 統計
      // 日期檢查：只統計「今天」發送的訊息
      const taipeiTime = { timeZone: "Asia/Taipei" };
      const todayDate = new Date().toLocaleDateString("zh-TW", taipeiTime);
      const msgDate = new Date(message.createdTimestamp).toLocaleDateString("zh-TW", taipeiTime);

      if (todayDate === msgDate) {
          // 計算所有表情符號的總數
          const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

          if (totalReactions > stats.mostReacted.count) {
            // 更新紀錄
            stats.mostReacted = {
              count: totalReactions,
              url: message.url,
              content: message.content || "[圖片/附件]",
              author: message.author ? message.author.tag : "未知用戶",
              authorId: message.author ? message.author.id : null,
              channelId: message.channel.id // 用於 Tag 來源
            };
          }
      }
    }
    //#endregion

    // === 表情符號 → 身分組切換功能 ===
    //#region 驗證新加入的用戶是否為真人  
    const targetMessageId = "1257649090821488703";
    const targetEmoji = "✅";
    const addRoleId = "1231119841319063613";
    const removeRoleId = "1356902843294023680";

    try {
      if (reaction.message.id === targetMessageId && reaction.emoji.name === targetEmoji) {
        const member = await reaction.message.guild.members.fetch(user.id);

        if (addRoleId) {
          await member.roles.add(addRoleId);
          // await log(client, `✅ [身分組] 已為 ${user.username} 加上角色`);
        }

        if (removeRoleId) {
          await member.roles.remove(removeRoleId);
          // await log(client, `❌ [身分組] 已為 ${user.username} 移除角色`);
        }
      }
    } catch {
      // await log(client, `🚨 [身分組] 執行錯誤：${err.message}`, 'error');
    }
    //#endregion
  },
};