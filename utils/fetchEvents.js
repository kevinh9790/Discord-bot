
//未來用於自動推播
/*
module.exports = async function fetchGuildEvents(guild) {
    try {
      const events = await guild.scheduledEvents.fetch();
      if (!events.size) return "目前沒有任何已排定的活動。";
  
      const lines = ["📅 **近期活動清單：**"];
      for (const [id, event] of events) {
        const startTime = `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:F>`;
        const location = event.entityType === 3 ? event.entityMetadata.location : "語音頻道 / 直播";
  
        lines.push(`• **${event.name}**`);
        lines.push(`　時間：${startTime}`);
        lines.push(`　地點：${location}`);
        lines.push(`　連結：https://discord.com/events/${guild.id}/${event.id}`);
      }
  
      return lines.join("\n");
    } catch (err) {
      console.error("❌ 撈取活動失敗：", err);
      return "⚠️ 無法取得活動資訊，請稍後再試。";
    }
  };
  */