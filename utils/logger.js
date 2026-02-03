const config = require('../config/config.js');

/**
 * 統一日誌工具
 * @param {import('discord.js').Client} client Discord Client
 * @param {string} msg 日誌訊息
 * @param {string} type 類型: 'info' | 'error'
 */
module.exports = async (client, msg, type = 'info') => {
    if (type === 'error') console.error(msg);
    else console.log(msg);

    const logChannelId = config.CHANNELS.DEBUG_LOG;
    if (!logChannelId) return;

    try {
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
            const prefix = type === 'error' ? '❌ [錯誤]' : '📝 [Log]';
            // 避免訊息過長
            const safeMessage = msg.length > 1900 ? msg.substring(0, 1900) + '...' : msg;
            await channel.send(`${prefix} ${safeMessage}`).catch(() => { });
        }
    } catch (err) {
        console.error('❌ [logger] 發送失敗:', err);
    }
};