const cron = require('node-cron');
const config = require('../config/config.js');
const log = require('../utils/logger');
const { runDailyUnconditionalScan } = require('../utils/llmDailySummaryRunner');

async function triggerDailyUnconditionalScan(client) {
    try {
        await log(client, '🔍 開始執行 LLM 每日無條件摘要掃描...');
        await runDailyUnconditionalScan(client);
        await log(client, '✅ LLM 每日無條件摘要掃描完成');
    } catch (error) {
        console.error('[LLMDailySummaryJob] Error:', error);
        await log(client, `❌ LLM 每日無條件摘要掃描失敗: ${error.message}`, 'error');
    }
}

module.exports = {
    name: 'llmDailySummaryJob',
    runDailyUnconditionalScan: triggerDailyUnconditionalScan,
    execute(client) {
        const llmConfig = config.LLM_SUMMARY || {};
        const dailyConfig = llmConfig.dailyUnconditional || {};

        if (!dailyConfig.enabled) {
            console.log('ℹ️ LLM 每日無條件摘要排程未啟用');
            return;
        }

        console.log(`⏰ 載入 LLM 每日無條件摘要排程，時間設定為: ${dailyConfig.cron || '0 0 5 * * *'}`);

        cron.schedule(dailyConfig.cron || '0 0 5 * * *', () => triggerDailyUnconditionalScan(client), {
            scheduled: true,
            timezone: "Asia/Taipei"
        });
    }
};
