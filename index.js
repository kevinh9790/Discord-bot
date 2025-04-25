// ✅ index.js
require("dotenv").config();
const express = require("express");
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// 🌐 Express 保活伺服器
const app = express();
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
  console.log(`📡 收到 ping - ${new Date().toLocaleTimeString()}`);
  res.send("Bot is running!");
});

app.listen(port, () => {
  console.log("🌐 Web server is up!");
});

// 🤖 Discord Bot 客戶端
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildScheduledEvents,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// 📂 載入事件模組
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// 🚪 登入 Discord
client.login(process.env.TOKEN);

// 🔁 自我 ping
const PING_URL = "https://discord-bot-production-8a80.up.railway.app/";
setInterval(() => {
  fetch(PING_URL)
    .then(() => console.log(`🌀 dev自我 ping 成功 (${new Date().toLocaleTimeString()})`))
    .catch(() => console.warn("⚠️ 自我 ping 失敗"));
}, 1000 * 60 * 4);
