const getEventLocation = (event, guild) => {
    if (event.entityType === 3) {
      // 線下實體地點
      return event.entityMetadata?.location || "未指定地點";
    }
  
    if (event.channelId) {
      const channel = guild.channels.cache.get(event.channelId);
      return channel ? `<#${channel.id}>` : "語音頻道（找不到頻道名稱）";
    }
  
    return "未指定地點";
  };
  
  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const weekday = weekdays[date.getDay()];
    return `${y}/${m}/${d} ${hh}:${mm} (${weekday})`;
  }

  require("dotenv").config();

  module.exports = {
    name: "活動",
    description: "列出目前伺服器的活動，並推播到指定頻道",
  
    async execute(message) {
      
      // 指定要推播的頻道 ID（從 .env 讀取）
      const targetChannelId = process.env.EVENT_ANNOUNCE_CHANNEL;
      
      try {
        const events = await message.guild.scheduledEvents.fetch();
  
        if (!events.size) {
          return message.channel.send("📭 目前沒有任何已排定的活動。");
        }
  
        const lines = ["📅 **近期活動清單：**"];
        for (const [id, event] of events) {
          const time = formatDateTime(event.scheduledStartTimestamp);
          const location = getEventLocation(event, message.guild);
          const description = event.description?.trim() || "（無活動描述）";
  
          lines.push(`## ${event.name}`);
          lines.push(`### ⏰ 時間：${time}`);
          lines.push(`### 🏠 地點：${location}`);
          lines.push(`### 📝 簡介：`);
          lines.push(`\n${description.slice(0, 500)}${description.length > 500 ? "..." : ""}`);
          lines.push(`　https://discord.com/events/${message.guild.id}/${event.id}`);
        }

        const targetChannel = await message.guild.channels.fetch(targetChannelId);
    
        if (!targetChannel || !targetChannel.isTextBased()) {
            return message.reply("❌ 找不到指定的推播頻道，請檢查 EVENT_ANNOUNCE_CHANNEL 是否正確！");
        }

        await targetChannel.send({
            content: lines.join("\n\n"),
            allowedMentions: { parse: [] },
            embeds: []
        });

        message.reply(`✅ 活動資訊已發送至 <#${targetChannelId}>！`);
        
      } catch (err) {
        console.error("❌ 撈取活動錯誤：", err);
        message.channel.send("⚠️ 無法取得活動資訊，請稍後再試。");
      }
    },
  };
  