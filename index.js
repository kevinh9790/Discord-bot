require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const config = require("./config/config.js");

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
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// 🔹 初始化快取與集合
client.inviteUses = new Map();
client.commands = new Collection();

// 📂 載入指令模組
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('name' in command && 'execute' in command) {
            client.commands.set(command.name, command);
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
        }
    }
    console.log(`✅ 已載入 ${client.commands.size} 個指令`);
}

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

// 📂 [新增] 載入排程任務 (Jobs)
const jobsPath = path.join(__dirname, "jobs");
if (fs.existsSync(jobsPath)) {
    const jobFiles = fs.readdirSync(jobsPath).filter(file => file.endsWith(".js"));
    
    // 因為排程需要在 client 準備好後才能發送訊息，所以我們把它掛在 ready 事件後執行
    client.once('ready', () => {
        console.log('⏰ 正在初始化排程任務...');
        for (const file of jobFiles) {
            const filePath = path.join(jobsPath, file);
            const job = require(filePath);
            if (job.execute) {
                job.execute(client);
            }
        }
    });
} else {
    console.log('⚠️ jobs 資料夾不存在，跳過載入排程任務');
}

// 🚪 登入 Discord 
client.login(process.env.TOKEN);

// 🔁 自我 ping
const PING_URL = config.PING_URL;
setInterval(() => {
  fetch(PING_URL)
    .then(() => console.log(`🌀 dev自我 ping 成功 (${new Date().toLocaleTimeString()})`))
    .catch(() => console.warn("⚠️ 自我 ping 失敗><"));
}, 1000 * 60 * 4);