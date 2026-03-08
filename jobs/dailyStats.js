const cron = require('node-cron');
const { runDailyStats } = require('../utils/dailyStatsRunner');

module.exports = {
    name: 'dailyStats',
    execute(client) {
        console.log('⏰ 載入每日數據統計排程...');

        // 每天午夜 00:00 執行，用以統計訊息總數、語音時長、表情符號總數，並整理輸出表格
        cron.schedule('0 0 0 * * *', () => runDailyStats(client), {
            scheduled: true,
            timezone: "Asia/Taipei"
        });
    }
};
