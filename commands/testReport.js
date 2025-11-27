const { EmbedBuilder } = require('discord.js');

// 輔助函數：將毫秒轉為時:分:秒
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: "測試日報",
    description: "手動查看目前的統計數據（不會重置數據）",
    async execute(message) {
        const client = message.client;

        // 1. 檢查是否有數據
        if (!client.dailyStats) {
            return message.reply("⚠️ 數據尚未初始化，請檢查 ready.js 是否正確載入。");
        }

        console.log('📊 [手動觸發] 開始產生預覽日報...');

        // --- A. 暫時結算語音時間 (只為了預覽，不更新原始資料) ---
        const now = Date.now();
        
        // 深拷貝一份 channels 數據，避免修改到原始 RAM 數據
        let previewChannels = JSON.parse(JSON.stringify(client.dailyStats.channels));
        
        // 取得目前正在語音中的人數
        const activeVoiceCount = client.dailyStats.voiceSessions.size;
        console.log(`🎙️ [語音結算] 目前有 ${activeVoiceCount} 人在語音頻道中，正在計算累積時間...`);

        // 把目前還在語音裡的人的時間加進預覽數據中
        client.dailyStats.voiceSessions.forEach((data, userId) => {
            const duration = now - data.startTime;
            const chId = data.channelId;
            
            if (!previewChannels[chId]) {
                // 如果是新頻道，嘗試抓取名稱
                const ch = message.guild.channels.cache.get(chId);
                previewChannels[chId] = { 
                    msgCount: 0, voiceMs: 0, name: ch ? ch.name : "未知頻道" 
                };
            }
            previewChannels[chId].voiceMs += duration;
        });

        // --- B. 整理數據 ---
        // 使用 Object.entries 保留 ID
        const allStats = Object.entries(previewChannels).map(([id, data]) => ({
            id: id, 
            ...data 
        }));

        // 1. 訊息排名
        const msgRank = allStats
            .filter(data => data.msgCount > 0) 
            .sort((a, b) => b.msgCount - a.msgCount)
            .slice(0, 10);

        // 2. 語音排名
        const voiceRank = allStats
            .filter(data => data.voiceMs > 0)
            .sort((a, b) => b.voiceMs - a.voiceMs)
            .slice(0, 10);

        console.log(`📈 [統計結果] 訊息活躍頻道數: ${msgRank.length} | 語音活躍頻道數: ${voiceRank.length}`);

        // --- C. 製作表格 ---
        let tableString = "頻道名稱             | 💬 訊息數 | 🎙️ 語音時長\n";
        tableString += "---------------------|----------|------------\n";
        
        allStats
            .filter(data => data.msgCount > 0 || data.voiceMs > 0)
            .sort((a,b) => (b.msgCount + b.voiceMs) - (a.msgCount + a.voiceMs))
            .forEach(stat => {
                let name = stat.name.length > 12 ? stat.name.substring(0, 10) + ".." : stat.name;
                let msg = stat.msgCount.toString().padStart(6);
                let time = formatDuration(stat.voiceMs);
                
                tableString += `${name.padEnd(20)} | ${msg}   | ${time}\n`;
            });

        if (tableString.length > 1000) tableString = tableString.substring(0, 950) + "\n... (下略)";

        // --- D. 建立 Embed ---
        const embed = new EmbedBuilder()
            .setTitle(`📊 [測試] 目前統計數據`)
            .setDescription("這是手動觸發的預覽報表")
            .setColor(0x00FF00) // 綠色代表測試
            .addFields(
                { name: '🏆 訊息活躍頻道', value: msgRank.map((c, i) => `${i+1}. <#${c.id}>: ${c.msgCount} 則`).join('\n') || '無數據', inline: true },
                { name: '🗣️ 語音活躍頻道', value: voiceRank.map((c, i) => `${i+1}. <#${c.id}>: ${formatDuration(c.voiceMs)}`).join('\n') || '無數據', inline: true }
                //{ name: '📊 詳細數據表', value: `\`\`\`text\n${tableString}\`\`\`` }
            )
            .setTimestamp();

        // --- E. 反應王 (同步 ready.js 的格式與 Log) ---
        const bestMsg = client.dailyStats.mostReacted;
        
        console.log(`⭐ [反應王檢查] 目前最高紀錄: ${bestMsg.count} 個表情 | 作者: ${bestMsg.author}`);

        if (bestMsg.count > 0) {

            const authorDisplay = bestMsg.authorId ? `<@${bestMsg.authorId}>` : bestMsg.author;

            embed.addFields({ 
                name: '⭐ 本日最受歡迎訊息', 
                value: `獲得 **${bestMsg.count}** 個表情\n${authorDisplay}\n${bestMsg.content.substring(0, 50)}...\n[👉 點擊跳轉到訊息](${bestMsg.url})` 
            });
        } else {
            // 預覽時也可以顯示目前沒有數據
            embed.addFields({
                name: '⭐ 本日最受歡迎訊息',
                value: '目前尚未有熱門訊息 (Count: 0)'
            });
        }

        await message.reply({ embeds: [embed] });
        console.log('✅ [手動觸發] 預覽日報發送完畢');
    },
};