const log = require('../utils/logger');
const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455"];

// 🛠️ 設定除錯頻道 ID
const DEBUG_CHANNEL_ID = "1232356996779343944";

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

    // 記錄一般訊息
    // await log(client, `🔍 偵測到 ${user.username} 在 <#${message.channel.id}> 對訊息按了 ${reaction.emoji.name}`);

    //#region 📊 統計反應王
    const isIgnoredCategory = message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId);

    if (!isIgnoredCategory) {

      // 日期檢查：只統計「今天」發送的訊息
      const taipeiTime = { timeZone: "Asia/Taipei" };
      const todayDate = new Date().toLocaleDateString("zh-TW", taipeiTime);
      const msgDate = new Date(message.createdTimestamp).toLocaleDateString("zh-TW", taipeiTime);

      if (todayDate === msgDate) {
        const stats = client.dailyStats;
        if (stats) {
          const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

          // 印出當前分數與霸主分數的比對
          // await log(client, `🔢 [比對] 此訊息: ${totalReactions} 讚 | 目前霸主: ${stats.mostReacted.count} 讚`);

          if (totalReactions > stats.mostReacted.count) {
            await log(client, `⭐ [反應王更新] 舊紀錄: ${stats.mostReacted.count} -> 新紀錄: ${totalReactions} (頻道: <#${message.channel.id}>)`);

            stats.mostReacted = {
              count: totalReactions,
              url: message.url,
              content: message.content || "[圖片/附件]",
              author: message.author ? message.author.tag : "未知用戶",
              authorId: message.author ? message.author.id : null
            };
          } else {
            // 沒破紀錄也告訴你一聲 (測試完覺得太吵可以註解掉)
            // await log(client, `📉 [未更新] 數量不足 (${totalReactions} <= ${stats.mostReacted.count})`);
          }
        } else {
          await log(client, "⚠️ client.dailyStats 尚未初始化 (請檢查 ready.js)", 'error');
        }
      } else {
        // 🟢 [新增] 如果是舊訊息，印出 Log 告知
        await log(client, `🕰️ [忽略] 這是舊訊息 (${msgDate})，不列入今日 (${todayDate}) 反應王統計`);
      }
    } else {
      // 被排除時正確回報 (原本這裡會報錯)
      // await log(client, `🛡️ [忽略] 此頻道在排除名單內，不計入統計`);
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
    } catch (err) {
      // await log(client, `🚨 [身分組] 執行錯誤：${err.message}`, 'error');
    }
    //#endregion
  },
};