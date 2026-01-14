require('dotenv').config();

module.exports = {
  // Core
  TOKEN: process.env.TOKEN,
  PORT: process.env.PORT || 8080,
  TARGET_GUILD_ID: process.env.TARGET_GUILD_ID || "859390147110633512",

  // Channels
  CHANNELS: {
    DEBUG_LOG: process.env.DEBUG_LOG_CHANNEL || "1232356996779343944",
    STATS_LOG: process.env.STATS_LOG_CHANNEL || "1450519890904617001",
    LEADERBOARD: process.env.LEADERBOARD_CHANNEL || "859423355626717215",
    EVENT_ANNOUNCE: process.env.EVENT_ANNOUNCE_CHANNEL,
    SUGGESTION: process.env.SUGGESTION_CHANNEL || "1441340015299792988",
    TICKET_LOG: process.env.TICKET_LOG_CHANNEL || "1443055216655339595",
  },

  // Filters
  FILTERS: {
    INCLUDE_CATEGORIES: process.env.INCLUDE_CATEGORIES ? process.env.INCLUDE_CATEGORIES.split(',') : [],
    EXCLUDE_CATEGORIES: process.env.EXCLUDE_CATEGORIES ? process.env.EXCLUDE_CATEGORIES.split(',') : ["1229094983202504715", "859390147656679455", "1440221111228043394", "1429360420740661249", "1434802712712577074", "1230537650012819500"],
    EXCLUDE_ROLES: process.env.EXCLUDE_ROLES ? process.env.EXCLUDE_ROLES.split(',') : ["1229465574074224720"],
  },

  // Dev Log Groups
  DEV_LOG_GROUPS: [
      {
        targetId: process.env.DEV_LOG_FORUM_A || "1230535598259834950",
        sourceIds: ["1440593941073231932"]
      },
      {
        targetId: process.env.DEV_LOG_FORUM_B || "1230535700525486110",
        sourceIds: ["1442811186528911512"]
      }
  ],

  PING_URL: process.env.PING_URL || "https://discord-bot-production-8a80.up.railway.app/",
  TRIGGER_PREFIX: "開發進度",

  // Active Chat Manager
  ACTIVE_CHAT: {
    IGNORED_CATEGORIES: [],
    // rule1: 3人(含)以上 60分鐘內 10則訊息
    rule1: { minUsers: 3, minMsgs: 10, duration: 60 * 60 * 1000, maxContribution: 2 },
    // rule2: 4人(含)以上 45分鐘內 8則訊息
    rule2: { minUsers: 4, minMsgs: 8, duration: 45 * 60 * 1000, maxContribution: 2 },
    // 冷卻 24 小時
    cooldownTime: 24 * 60 * 60 * 1000
  }
};
