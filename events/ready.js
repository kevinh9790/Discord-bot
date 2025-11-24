const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// 🛠️ 設定除錯頻道 ID (建議填寫您的測試頻道 ID)
const DEBUG_CHANNEL_ID = "1232356996779343944"; 

// 輔助函數：發送 Log 到 Discord
async function sendLog(client, message, type = 'info') {
    // 1. 保持終端機也有 Log
    if (type === 'error') console.error(message);
    else console.log(message);

    if (!DEBUG_CHANNEL_ID) return;

    try {
        const channel = await client.channels.fetch(DEBUG_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const prefix = type === 'error' ? '❌ [錯誤]' : '📝 [Log]';
            const safeMessage = message.length > 1900 ? message.substring(0, 1900) + '...' : message;
            await channel.send(`${prefix} ${safeMessage}`).catch(() => {});
        }
    } catch (err) {
        console.error('❌ [sendLog] 發送失敗:', err);
    }
}

// 輔助函數：將毫秒轉為時:分:秒
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`✅ 已登入為 ${client.user.tag} `);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        //#region 設定邀請連結
        client.inviteUses = new Map();

        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const invites = await guild.invites.fetch();
                client.inviteUses.set(
                    guildId,
                    new Map(invites.map(inv => [inv.code, inv.uses]))
                );
                //console.log(`📋 已抓取 ${guild.name} 的邀請快取，共 ${invites.size} 筆`);
            } catch (err) {
                console.warn(`⚠️ 無法抓取 ${guild.name} 的邀請快取: ${err.message}`);
            }
        }

        console.log(`🤖 已啟動並記錄所有伺服器邀請次數`);
        //#endregion
        
        // 1. 初始化數據結構
        client.dailyStats = {
            channels: {}, // 存放每個頻道的數據 { id: { msgCount, voiceMs, name } }
            mostReacted: { count: 0, url: null, content: "", author: "" }, // 當日反應王
            voiceSessions: new Map() // 用來記錄誰正在語音裡 { userId: startTime }
        };

        //#region 2. 設定排程：每天午夜 00:00 執行，用以統計訊息總數、語音時長、表情符號總數，並整理輸出表格
        cron.schedule('0 0 0 * * *', async () => {
           try {
            await sendLog(client, '📊 開始自動結算每日數據...');

            // 1. 抓取日報要發送的頻道
            const logChannelId = "1229095307124408385"; 
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);

            // 2. 確保數據存在
            if (!client.dailyStats) {
                await sendLog(client, '❌ client.dailyStats 遺失，無法產生報表', 'error');
                // 重新初始化以防萬一
                client.dailyStats = { channels: {}, mostReacted: { count: 0 }, voiceSessions: new Map() };
                return;
            }
            
            await logChannel.send('📊 開始結算每日數據...');

            //#region --- A. 處理還在語音裡的人 (強行結算這一段時間，避免數據跨日遺失) ---
            const now = Date.now();
            client.dailyStats.voiceSessions.forEach((data, userId) => {
                const duration = now - data.startTime;
                const chId = data.channelId;
                
                // 更新該頻道數據
                if (!client.dailyStats.channels[chId]) {
                    const ch = guild.channels.cache.get(chId);
                    client.dailyStats.channels[chId] = { 
                        msgCount: 0, voiceMs: 0, name: ch ? ch.name : "未知頻道" 
                    };
                }
                client.dailyStats.channels[chId].voiceMs += duration;
                
                // 重置他們的開始時間為現在 (為了明天的計算)
                data.startTime = now; 
                client.dailyStats.voiceSessions.set(userId, data);
            });
            //#endregion

            //#region --- B. 整理數據 ---
            const allStats = Object.entries(client.dailyStats.channels).map(([id, data]) => ({
                id: id, 
                ...data 
            }));

            // 1. 訊息排名 (降序)
            const msgRank = allStats
                .filter(data => data.msgCount > 0)
                .sort((a, b) => b.msgCount - a.msgCount)
                .slice(0, 10);
            // 2. 語音排名 (降序)
            const voiceRank = allStats
                .filter(data => data.voiceMs > 0)
                .sort((a, b) => b.voiceMs - a.voiceMs)
                .slice(0, 10);
            //#endregion

            //#region --- C. 製作表格 (使用 Code Block 讓排版對齊) ---
            // PadEnd 用來補空白，讓表格整齊
            let tableString = "頻道名稱             | 💬 訊息數 | 🎙️ 語音時長\n";
            tableString += "---------------------|----------|------------\n";
            
            allStats
                .filter(data => data.msgCount > 0 || data.voiceMs > 0) // 過濾掉完全沒動靜的
                .sort((a,b) => (b.msgCount + b.voiceMs) - (a.msgCount + a.voiceMs))
                .forEach(stat => {
                    let name = stat.name.length > 12 ? stat.name.substring(0, 10) + ".." : stat.name;
                    let msg = stat.msgCount.toString().padStart(6); // 補齊6位
                    let time = formatDuration(stat.voiceMs);
                    
                    tableString += `${name.padEnd(20)} | ${msg}   | ${time}\n`;
                });

            // 如果表格太長，Discord 會不給發，這裡我們切分或簡化
            if (tableString.length > 1000) tableString = tableString.substring(0, 950) + "\n... (下略)";
            //#endregion

            //#region --- D. 建立 Embed ---
            const embed = new EmbedBuilder()
                .setTitle(`📅 ${new Date().toLocaleDateString()} 頻道排行榜`)
                .setColor(0xFFD700) // 金色
                .addFields(
                    { name: '🏆 訊息活躍頻道', value: msgRank.map((c, i) => `${i+1}. **${c.name}**: ${c.msgCount} 則`).join('\n') || '無數據', inline: true },
                    { name: '🗣️ 語音活躍頻道', value: voiceRank.map((c, i) => `${i+1}. **${c.name}**: ${formatDuration(c.voiceMs)}`).join('\n') || '無數據', inline: true },
                    //{ name: '📊 詳細數據表', value: `\`\`\`text\n${tableString}\`\`\`` }
                )
                .setTimestamp();
            //#endregion

            //#region --- E. 特別標示：本日反應王 ---
            const bestMsg = client.dailyStats.mostReacted;
            
            // 🟢 [修改點] 將 Log 發送到 DC
            await sendLog(client, `📊 [日報結算] 反應王數據: Count=${bestMsg.count}, Author=${bestMsg.author}`);

            if (bestMsg.count > 0) {
                embed.addFields({ 
                    name: '⭐ 本日最受歡迎訊息', 
                    value: `獲得 **${bestMsg.count}** 個表情\n作者: ${bestMsg.author}\n內容: ${bestMsg.content.substring(0, 50)}...\n[👉 點擊跳轉到訊息](${bestMsg.url})` 
                });
            } else {
                embed.addFields({
                    name: '⭐ 本日最受歡迎訊息',
                    value: '今天還沒有熱門訊息喔！(無反應數據)'
                });
            }

            await logChannel.send({ embeds: [embed] });
            await sendLog(client, '✅ 自動日報發送成功！');
            //#endregion

            //#region --- F. 重置數據 (除了正在語音中的 session 以外都要清空) ---
            client.dailyStats.channels = {};
            client.dailyStats.mostReacted = { count: 0, url: null, content: "", author: "" };
            await sendLog(client, '🔄 數據已重置');
            //#endregion
           } catch (fatalError) {
               // 這是最後一道防線，如果日報程式碼炸了，這裡會接住並通知你
               await sendLog(client, `❌ [嚴重錯誤] 自動日報執行失敗: ${fatalError.message}`, 'error');
           }

        }, { scheduled: true, timezone: "Asia/Taipei" });
        //#endregion
    }
};
