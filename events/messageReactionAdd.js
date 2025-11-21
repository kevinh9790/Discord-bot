const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455"];

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user, client) {

      // 避免 bot 自己觸發  
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      const message = reaction.message;

      //#region 統計當天表情符號最多的訊息
      // === 🛡️ 排除過濾 ===
      if (message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId)) return;
        
      // === 📊 統計反應王 ===
      const stats = client.dailyStats;
      if (stats) {
          // 取得這則訊息「目前」的總反應數
          const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

          // 如果這則訊息的反應數 > 目前紀錄的最高分，就更新
          if (totalReactions > stats.mostReacted.count) {
              stats.mostReacted = {
                  count: totalReactions,
                  url: message.url,
                  content: message.content || "[圖片/附件]",
                  author: message.author ? message.author.tag : "未知用戶"
              };
          }
      }
      //#endregion
  
      // === 表情符號 → 身分組切換功能 ===
      //#region 驗證新加入的用戶是否為真人  
      const targetMessageId = "1257649090821488703"; // 指定的訊息ID
      const targetEmoji = "✅"; // 或填入你的 emoji 名稱
      const addRoleId = "1231119841319063613"; // 冒險者
      const removeRoleId = "1356902843294023680"; // 冒險新人
  
      try {
        // 確保 reaction 有載入完整資料（避免 partial 錯誤）
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
  
        console.log(
          `🧪 偵測到 ${user.username} 對訊息 ${reaction.message.id} 加了 ${reaction.emoji.name}`
        );
        
        // ✅ 檢查是否是目標訊息 + emoji
        if (
          reaction.message.id === targetMessageId &&
          reaction.emoji.name === targetEmoji
        ) {
          const member = await reaction.message.guild.members.fetch(user.id);
          
          // 添加身分組
          await member.roles.add(addRoleId);
          console.log(`✅ 已為 ${user.username} 加上角色 ID：${addRoleId}`);

          // 移除身分組
          await member.roles.remove(removeRoleId);
          console.log(`❌ 已為 ${user.username} 移除角色 ID：${removeRoleId}`);
        } else {
          console.log("⚠️ Emoji 或 訊息ID 不符合條件，忽略此次反應");
        }
      } catch (err) {
        console.error("🚨 執行錯誤：", err);
      }
      //#endregion
    },
  };