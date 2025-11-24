const IGNORED_CATEGORIES = ["1229094983202504715", "859390147656679455"];

// 🛠️ 設定除錯頻道 ID
const DEBUG_CHANNEL_ID = "1232356996779343944"; 

// 輔助函數：發送 Log 到 Discord
async function sendLog(client, message, type = 'info') {
    if (type === 'error') console.error(message);
    else console.log(message);

    if (!DEBUG_CHANNEL_ID) return;

    try {
        const channel = await client.channels.fetch(DEBUG_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const prefix = type === 'error' ? '❌ [錯誤]' : '📝 [Log]';
            const safeMessage = message.length > 1900 ? message.substring(0, 1900) + '...' : message;
            await channel.send(`${prefix} ${safeMessage}`).catch(() => {});
        }
    } catch (err) {
        console.error('❌ [sendLog] 發送失敗:', err);
    }
}

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {

    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (error) {
      const errorMsg = `❌ 無法讀取反應或訊息: ${error.message}`;
      await sendLog(client, errorMsg, 'error');
      return;
    }

    const message = reaction.message;

    // 🟢 1. [開啟] 讓機器人告訴你它有感覺到了
    await sendLog(client, `🔍 偵測到 ${user.username} 在 <#${message.channel.id}> 對訊息按了 ${reaction.emoji.name}`);

    //#region 📊 統計反應王
    const isIgnoredCategory = message.channel.parentId && IGNORED_CATEGORIES.includes(message.channel.parentId);
    
    if (!isIgnoredCategory) {
      const stats = client.dailyStats;
      if (stats) {
        const totalReactions = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

        // 🟢 2. [新增] 印出當前分數與霸主分數的比對
        // await sendLog(client, `🔢 [比對] 此訊息: ${totalReactions} 讚 | 目前霸主: ${stats.mostReacted.count} 讚`);

        if (totalReactions > stats.mostReacted.count) {
          await sendLog(client, `⭐ [更新] 新的反應王誕生！紀錄: ${totalReactions} (頻道: <#${message.channel.id}>)`);
          
          stats.mostReacted = {
            count: totalReactions,
            url: message.url,
            content: message.content || "[圖片/附件]",
            author: message.author ? message.author.tag : "未知用戶"
          };
        } else {
            // 🟢 3. [開啟] 沒破紀錄也告訴你一聲 (測試完覺得太吵可以註解掉)
            await sendLog(client, `📉 [未更新] 數量不足 (${totalReactions} <= ${stats.mostReacted.count})`);
        }
      } else {
        await sendLog(client, "⚠️ client.dailyStats 尚未初始化 (請檢查 ready.js)", 'error');
      }
    } else {
        // 🟢 4. [修正] 被排除時正確回報 (原本這裡會報錯)
        await sendLog(client, `🛡️ [忽略] 此頻道在排除名單內，不計入統計`);
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
            await sendLog(client, `✅ [身分組] 已為 ${user.username} 加上角色`);
        }

        if (removeRoleId) {
            await member.roles.remove(removeRoleId);
            await sendLog(client, `❌ [身分組] 已為 ${user.username} 移除角色`);
        }
      }
    } catch (err) {
      await sendLog(client, `🚨 [身分組] 執行錯誤：${err.message}`, 'error');
    }
    //#endregion
  },
};