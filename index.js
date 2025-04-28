require("dotenv").config();
const { Client, Events, GatewayIntentBits, Partials } = require("discord.js");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // 自我 ping 用

// === 建立 Discord Bot 客戶端 ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildScheduledEvents,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// === Bot 啟動後事件 ===
client.once(Events.ClientReady, () => {
  console.log(`✅ 已登入為 ${client.user.tag}`);
  console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);
});

// === 表情符號 → 身分組切換功能（範例） ===
const targetMessageId = "1257649090821488703"; // 指定的訊息ID
const targetEmoji = "✅"; // 或填入你的 emoji 名稱
const addRoleId = "1231119841319063613"; //冒險者
const removeRoleId = "1356902843294023680"; //冒險新人

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  
  // 避免 bot 自己觸發
  if (user.bot) return;
  
  try {
    // 確保 reaction 有載入完整資料（避免 partial 錯誤）
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    console.log(
      `🧪 偵測到 ${user.username} 對訊息${reaction.message.id} 加了 ${reaction.emoji.name}`,
    );

    // ✅ 檢查是否是目標訊息 + emoji
    if (
      reaction.message.id === targetMessageId &&
      reaction.emoji.name === targetEmoji
    ) {
      const member = await reaction.message.guild.members.fetch(user.id);

      // 加角色
      await member.roles.add(addRoleId);
      console.log(`✅ 已為 ${user.username} 加上角色 ID：${addRoleId}`);

      // 移除角色
      await member.roles.remove(removeRoleId);
      console.log(`❌ 已為 ${user.username} 移除角色 ID：${removeRoleId}`);
    } else {
      console.log("⚠️ Emoji 或 訊息ID 不符合條件，忽略此次反應");
    }
  } catch (err) {
    console.error("🚨 執行錯誤：", err);
  }
});

// === 登入 Discord Bot ===
client.login(process.env.TOKEN);

//測試可不可以吃喜餅 可以嗎