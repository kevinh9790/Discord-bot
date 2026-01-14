// ✅ index.js
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
// ... (lines 12-65) ...
client.login(process.env.TOKEN);

// 🔁 自我 ping
const PING_URL = config.PING_URL;
setInterval(() => {
  fetch(PING_URL)
    .then(() => console.log(`🌀 dev自我 ping 成功 (${new Date().toLocaleTimeString()})`))
    .catch(() => console.warn("⚠️ 自我 ping 失敗><"));
}, 1000 * 60 * 4);