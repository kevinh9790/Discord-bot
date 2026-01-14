const config = require('../config/config.js');

// utils/logger.js
module.exports = async (client, msg) => {
    console.log(msg); // terminal
    const logChannelId = config.CHANNELS.DEBUG_LOG;
    if (!logChannelId) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (channel && channel.isTextBased()) await channel.send(msg);
    } catch (err) {
        console.warn(`⚠️ 發送 log 到 Discord 失敗: ${err.message}`);
    }
};
