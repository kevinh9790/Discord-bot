const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const channelsFilePath = path.join(__dirname, '../config/scheduledChannels.json');

// 🛠️ 設定除錯頻道 ID (請替換為您的測試頻道 ID)
// 如果留空或無效，則只會印在終端機
const DEBUG_CHANNEL_ID = "1232356996779343944"; 

// 輔助函數：發送 Log 到 Discord
async function sendLog(client, message, type = 'info') {
    console.log(message); // 保持終端機也有 Log

    if (!DEBUG_CHANNEL_ID) return;

    try {
        const channel = await client.channels.fetch(DEBUG_CHANNEL_ID).catch(() => null);
        if (channel && channel.isTextBased()) {
            const prefix = type === 'error' ? '❌ [錯誤]' : '📝 [Log]';
            // 避免訊息過長
            const safeMessage = message.length > 1900 ? message.substring(0, 1900) + '...' : message;
            await channel.send(`${prefix} ${safeMessage}`);
        }
    } catch (err) {
        console.error('無法發送 Log 到 Discord:', err);
    }
}

// 輔助函數：讀取指定群組的頻道列表
function getScheduledChannels(groupName) {
    if (!fs.existsSync(channelsFilePath)) {
        return [];
    }
    try {
        const fileContent = fs.readFileSync(channelsFilePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // 如果資料格式是舊版的陣列，或者該群組不存在，回傳空陣列
        if (Array.isArray(data)) return [];
        return data[groupName] || [];
    } catch (err) {
        // 這裡無法使用 sendLog，因為還沒有 client 物件，只能印在終端機
        console.error('❌ 讀取排程頻道設定檔失敗:', err);
        return [];
    }
}

/*時間格式說明：秒 分 時 日 月 星期 (node-cron寫法會自動在最前面補0)
常用範例：
0 0 12 * * *：每天中午 12:00:00
0 30 9 * * 1：每週一早上 09:30:00
0 0 0 1 * *：每月 1 號的午夜 00:00:00
0 *\/5 * * * *：每 5 分鐘一次 (測試用)
*/
// 這裡定義你要排程的任務清單
const tasks = [
    // 範例任務 1：每月月初提醒
    {
        name: "每月月初提醒",
        enabled: false,
        cronTime: "0 12 1 * *", // 每月 1 號的中午 12:00
        channelGroup: "monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📅 來看看進度如何👀",
            description: "各位冒險者辛苦了！這個月有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x0099FF // 藍色
        }
    },
    // 範例任務 2：每週五週報提醒
    {
        name: "每週五提醒",
        enabled: false,
        cronTime: "0 17 * * 5", // 每週五下午 5:00 (17:00)
        channelGroup: "monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📝 每週五提醒",
            description: "這是每週五提醒",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 3：五分鐘測試
    {
        name: "五分鐘測試用",
        enabled: false,
        cronTime: "0 */5 * * * *", // ⚠️ 注意：每5分鐘的寫法是 0 */5 * * * * (6位) 或 */5 * * * * (5位)
        channelGroup: "forTestFiveMins", // 🟢 設定群組名稱
        content: {
            title: "📝 每五分鐘的提醒測試",
            description: "各位冒險者辛苦了！這個月有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    }
    // 你可以在這裡繼續複製新增更多任務...
];

module.exports = {
    name: 'scheduledMessage',
    execute(client) {
        sendLog(client, '⏰ 載入定時發送任務...');

        tasks.forEach(task => {
            // 🟢 檢查開關：如果沒啟用，直接跳過
            if (task.enabled === false) {
                console.log(`🚫 任務 [${task.name}] 已停用，跳過排程。`);
                return; 
            }

            if (!cron.validate(task.cronTime)) {
                sendLog(client, `❌ 任務 [${task.name}] 的時間設定錯誤: ${task.cronTime}`, 'error');
                return;
            }

            cron.schedule(task.cronTime, async () => {
                sendLog(client, `🚀 執行定時任務: ${task.name} (群組: ${task.channelGroup})`);
                
                // 🟢 依據該任務設定的群組，讀取對應的頻道列表
                const currentChannels = getScheduledChannels(task.channelGroup);

                if (currentChannels.length === 0) {
                    sendLog(client, `⚠️ 任務 [${task.name}] (${task.channelGroup}) 沒有設定任何發送頻道，跳過執行。`, 'info');
                    return;
                }

                for (const channelId of currentChannels) {
                    try {
                        const channel = await client.channels.fetch(channelId).catch(() => null);

                        if (!channel || !channel.isTextBased()) {
                            sendLog(client, `⚠️ 任務 [${task.name}] 跳過無效頻道 ID: ${channelId}`, 'info');
                            continue;
                        }

                        const embed = new EmbedBuilder()
                            .setTitle(task.content.title)
                            .setDescription(task.content.description)
                            .setColor(task.content.color || 0xFFFFFF)
                            .setTimestamp();

                        await channel.send({ embeds: [embed] });
                        sendLog(client, `✅ [${task.name}] 已發送至 [${channel.name}]`);

                    } catch (error) {
                        sendLog(client, `❌ 任務 [${task.name}] 發送至頻道 ${channelId} 時發生錯誤: ${error.message}`, 'error');
                    }
                }
            }, {
                scheduled: true,
                timezone: "Asia/Taipei"
            });

            sendLog(client, `✅ 已排程: ${task.name} -> 群組 [${task.channelGroup}]`);
        });
    }
};