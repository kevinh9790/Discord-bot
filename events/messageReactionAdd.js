const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455"];

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {

    // 1. 基本過濾：Bot 不觸發 
    if (user.bot) return;

    // 2. 確保資料完整 (Partial Fetch)
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (error) {
      console.error('❌ 無法讀取反應或訊息:', error);
      return;
    }

    const message = reaction.message;

    //#region 📊 統計反應王 統計當天表情符號最多的訊息
    // === 🛡️ 排除過濾 ===
    const isIgnoredCategory = message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId);
    // 只有在「不是排除分類」的情況下，才更新統計
    if (!isIgnoredCategory) {
      const stats = client.dailyStats;
      if (stats) {
        // 取得這則訊息「目前」的總反應數
        const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

        // 更新總反應數 (選做：如果你想統計全服總按讚數)
        // if (stats.reactions !== undefined) stats.reactions++;

        // 如果這則訊息的反應數 > 目前紀錄的最高分，就更新
        if (totalReactions > stats.mostReacted.count) {
          stats.mostReacted = {
            count: totalReactions,
            url: message.url,
            content: message.content || "[圖片/附件]",
            author: message.author ? message.author.tag : "未知用戶"
          };
          // console.log(`⭐ 新的反應王誕生！數量: ${totalReactions} (來自 ${message.channel.name})`);
        }
      }
    } else {
      // console.log(`🛡️ 反應未計入統計 (排除分類): ${message.channel.name}`);
    }
    //#endregion

    // === 表情符號 → 身分組切換功能 ===
    //#region 驗證新加入的用戶是否為真人  
    const targetMessageId = "1257649090821488703"; // 指定的訊息ID
    const targetEmoji = "✅"; // 或填入你的 emoji 名稱
    const addRoleId = "1231119841319063613"; // 冒險者
    const removeRoleId = "1356902843294023680"; // 冒險新人

    try {
      // console.log(`🧪 偵測到 ${user.username} 對訊息 ${reaction.message.id} 加了 ${reaction.emoji.name}`);
      
      if (reaction.message.id === targetMessageId && reaction.emoji.name === targetEmoji) {
        const member = await reaction.message.guild.members.fetch(user.id);
        
        // 添加身分組
        if (addRoleId) {
            await member.roles.add(addRoleId);
            console.log(`✅ 已為 ${user.username} 加上角色 ID：${addRoleId}`);
        }

        // 移除身分組
        if (removeRoleId) {
            await member.roles.remove(removeRoleId);
            console.log(`❌ 已為 ${user.username} 移除角色 ID：${removeRoleId}`);
        }
      }
    } catch (err) {
      console.error("🚨 身分組執行錯誤：", err);
    }
    //#endregion
  },
};