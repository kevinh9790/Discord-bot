const cron = require('node-cron');
const log = require('../utils/logger');

module.exports = {
    name: 'llmSummaryJob',
    execute(client) {
        console.log('⏰ 載入 LLM 每日回顧摘要排程...');

        // 每天凌晨 04:00 執行
        cron.schedule('0 0 4 * * *', async () => {
            try {
                await log(client, '🔍 開始執行 LLM 每日回顧掃描...');
                await client.llmSummaryManager.performDailyScan(client);
                await log(client, '✅ LLM 每日回顧掃描完成');
            } catch (error) {
                console.error('[LLMSummaryJob] Error:', error);
                await log(client, `❌ LLM 每日回顧掃描失敗: ${error.message}`, 'error');
            }
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });
    }
};
