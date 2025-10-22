// utils/logger.js
module.exports = async (client, msg) => {
    console.log(msg); // terminal
    const logChannelId = 1232356996779343944; // .env 設定
    if (!logChannelId) return;

    try {
        const channel = await client.channels.fetch(logChannelId);
        if (channel && channel.isTextBased()) await channel.send(msg);
    } catch (err) {
        console.warn(`⚠️ 發送 log 到 Discord 失敗: ${err.message}`);
    }
};
