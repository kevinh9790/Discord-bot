const { EmbedBuilder } = require('discord.js');

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: "測試日報",
    description: "手動查看目前的統計數據與排行榜（不會重置數據）",
    async execute(message) {
        const client = message.client;

        if (!client.dailyStats) {
            return message.reply("⚠️ 數據尚未初始化。");
        }

        console.log('📊 [手動觸發] 開始產生預覽日報...');
        const now = Date.now();
        
        // 1. 預覽結算語音 (複製數據)
        let previewChannels = JSON.parse(JSON.stringify(client.dailyStats.channels));
        
        // 疊加目前的語音狀態
        client.dailyStats.voiceState.forEach((state, chId) => {
            if (!previewChannels[chId]) return;
            
            const duration = now - state.lastTime;
            if (duration > 0) {
                const baseScore = state.userCount > 0 ? 0.05 : 0;
                const streamScore = state.streamCount * 0.1;
                const multiUserScore = state.userCount > 1 ? (state.userCount - 1) * 0.75 : 0;
                const scorePerSec = baseScore + streamScore + multiUserScore;
                
                // ⚠️ 暫時加到 voicePoints 預覽
                previewChannels[chId].voicePoints += scorePerSec * (duration / 1000);
                previewChannels[chId].voiceMs += duration;
            }
        });

        const allStats = Object.entries(previewChannels).map(([id, data]) => ({ id: id, ...data }));

        // 2. 準備排行榜
        // 文字積分
        const msgRank = allStats.filter(d => d.msgPoints > 0).sort((a, b) => b.msgPoints - a.msgPoints).slice(0, 10);
        // 語音積分
        const voiceRank = allStats.filter(d => Math.round(d.voicePoints) > 0).sort((a, b) => b.voicePoints - a.voicePoints).slice(0, 10);

        // 3. 準備統計數據
        const textStats = allStats.filter(d => d.msgCount > 0).sort((a, b) => b.msgCount - a.msgCount);
        const voiceStats = allStats.filter(d => d.voiceMs > 0).sort((a, b) => b.voiceMs - a.voiceMs);

        // 4. 發送 Embed (雙欄位排行榜)
        const embed = new EmbedBuilder()
            .setTitle(`🏆 [預覽] 活躍排行榜`)
            .setColor(0xFFD700)
            .setTimestamp();

        const msgFieldVal = msgRank.length > 0 
            ? msgRank.map((c, i) => `**${i+1}.** <#${c.id}>: ${Math.round(c.msgPoints)} 點 🔥`).join('\n')
            : "無數據";

        const voiceFieldVal = voiceRank.length > 0
            ? voiceRank.map((c, i) => `**${i+1}.** <#${c.id}>: ${Math.round(c.voicePoints)} 點 🔥`).join('\n')
            : "無數據";

        embed.addFields(
            { name: '💬 訊息活躍頻道', value: msgFieldVal, inline: true },
            { name: '🗣️ 語音活躍頻道', value: voiceFieldVal, inline: true }
        );
        
        await message.reply({ embeds: [embed] });

        // 5. 發送統計數據 (模擬 Log 頻道)
        let reportText = "**📊 [預覽] 統計數據明細**\n";
        reportText += `\n**💬 訊息數 (共 ${textStats.length} 個頻道)**\n`;
        reportText += textStats.slice(0, 15).map(c => `<#${c.id}>: ${c.msgCount} 則`).join('\n') + (textStats.length > 30 ? "\n..." : "");
        
        reportText += `\n\n**🎙️ 語音 (共 ${voiceStats.length} 個頻道)**\n`;
        reportText += voiceStats.slice(0, 15).map(c => `<#${c.id}>: 同時語音人數 ${c.maxUsers} 人 / 總共： ${formatDuration(c.voiceMs)}`).join('\n') + (voiceStats.length > 15 ? "\n..." : "");

        await message.channel.send(reportText);

        // 6. 反應王預覽
        const bestMsg = client.dailyStats.mostReacted;
        if (bestMsg.count > 0) {
            const authorTag = bestMsg.authorId ? `<@${bestMsg.authorId}>` : bestMsg.author;
            const msgLink = bestMsg.url;
            
            const reactionText = `\n👑 **本日反應王** ${authorTag} 👑\n獲得了 **${bestMsg.count}** 個表情符號！\n\n> ${bestMsg.content.replace(/\n/g, ' ').substring(0, 50)}...\n\n👉 [前往朝聖](${msgLink})`;
            
            await message.channel.send({
                content: reactionText,
                allowedMentions: { parse: ['users'] } // 預覽時也 Tag 測試看看
            });
        }
    },
};