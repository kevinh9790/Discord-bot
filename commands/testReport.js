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

        console.log('📊 手動觸發日報預覽...');

        // --- A. 暫時結算語音時間 (只為了預覽，不更新原始資料) ---
        const now = Date.now();
        
        // 深拷貝一份 channels 數據，避免修改到原始 RAM 數據
        let previewChannels = JSON.parse(JSON.stringify(client.dailyStats.channels));

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
        const allStats = Object.entries(previewChannels).map(([id, data]) => ({
            id: id, // 👈 把 ID 存下來，這樣等一下才能變成 <#ID>
            ...data // 把原本的 name, msgCount, voiceMs 展開進來
        }));

        // 1. 訊息排名：只取訊息數 > 0 的
        const msgRank = allStats
            .filter(data => data.msgCount > 0) 
            .sort((a, b) => b.msgCount - a.msgCount)
            .slice(0, 10);
        // 2. 語音排名：只取語音時長 > 0 的
        const voiceRank = allStats
            .filter(data => data.voiceMs > 0)
            .sort((a, b) => b.voiceMs - a.voiceMs)
            .slice(0, 10);

        // --- C. 製作表格 ---
        let tableString = "頻道名稱             | 💬 訊息數 | 🎙️ 語音時長\n";
        tableString += "---------------------|----------|------------\n";
        
        // 綜合排序：訊息多或語音長的排前面
        // 表格排序：總活躍度 (訊息+語音)
        allStats
            .filter(data => data.msgCount > 0 || data.voiceMs > 0) // 過濾掉完全沒動靜的
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
            .setTitle(`📊 [預覽] 目前統計數據`)
            .setDescription("這是手動觸發的預覽報表，**不會**清除目前的累積數據。")
            .setColor(0x00FF00) // 綠色代表測試
            .addFields(
                { name: '🏆 訊息活躍頻道', value: msgRank.map((c, i) => `${i+1}. <#${c.id}>: ${c.msgCount} 則`).join('\n') || '無數據', inline: true },
                { name: '🗣️ 語音活躍頻道', value: voiceRank.map((c, i) => `${i+1}. <#${c.id}>: ${formatDuration(c.voiceMs)}`).join('\n') || '無數據', inline: true },
                //{ name: '📊 詳細數據表', value: `\`\`\`text\n${tableString}\`\`\`` }
            )
            .setTimestamp();

        // --- E. 反應王 ---
        const bestMsg = client.dailyStats.mostReacted;
        if (bestMsg.count > 0) {
            embed.addFields({ 
                name: '⭐ 目前反應王', 
                value: `獲得 **${bestMsg.count}** 個表情\n作者: ${bestMsg.author}\n內容: ${bestMsg.content.substring(0, 50)}...` 
            });
        }

        await message.reply({ embeds: [embed] });
    },
};