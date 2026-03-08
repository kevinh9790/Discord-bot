require("dotenv").config();
const path = require('path');
const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { FileStorage } = require("../utils/storage.js");
const { createLlmSummaryManager } = require("../utils/llmSummaryManager.js");
const { runDailyScan } = require("../jobs/llmSummaryJob.js");

async function run() {
  console.log("🚀 Starting one-shot LLM Summary Scan...");

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client.once("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    client.llmSummaryManager = createLlmSummaryManager(
      new FileStorage(path.join(__dirname, '../data/llmSummaryState.json'))
    );

    try {
      await runDailyScan(client);
    } finally {
      client.llmSummaryManager._cleanup();
      console.log("👋 Closing client...");
      client.destroy();
      process.exit(0);
    }
  });

  if (!process.env.TOKEN) {
    console.error("❌ Error: TOKEN not found in .env");
    process.exit(1);
  }

  client.login(process.env.TOKEN);
}

run();
