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
    if (type === 'error') console.error(message);
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
async function getScheduledChannels(client, groupName) {
    if (!fs.existsSync(channelsFilePath)) return [];

    try {
        const fileContent = fs.readFileSync(channelsFilePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        const rawList = data[groupName];
        if (!rawList) return [];

        // 正規化：把舊的字串格式轉成新的物件格式，方便後續統一處理
        // 舊: ["123"] -> 新: [{ channelId: "123", mentionUserId: null }]
        return rawList.map(item => {
            if (typeof item === 'string') {
                return { channelId: item, mentionUserId: null };
            }
            return item; // 已經是物件就直接回傳
        });

    } catch (err) {
        await sendLog(client, `❌ [Debug] 讀取設定檔失敗: ${err.message}`, 'error');
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
// 指令使用：&推播設定 設定/取消 <群組> [頻道ID] [用戶ID]
const tasks = [
    // 範例任務 1：每月月初提醒
    {
        name: "每月月初提醒",
        enabled: true,
        cronTime: "0 20 1 * *", // 每月 1 號的 20:00
        channelGroup: "monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📅 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x0099FF // 藍色
        }
    },
    // 範例任務 2：每週一週報提醒
    {
        name: "每週一提醒",
        enabled: true,
        cronTime: "0 20 * * 1", // 每週一 20:00
        skipDates: [1, 15], //1號 15號 跳過
        channelGroup: "Monday", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 3：每15天提醒
    {
        name: "每15天提醒",
        enabled: true,
        cronTime: "0 20 1,15 * *", // 每月1號,15號 20:00 提醒
        skipDates: [1], //1號跳過
        channelGroup: "half_monthly", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 4：🔞每月月初提醒
    {
        name: "每月月初提醒",
        enabled: true,
        cronTime: "0 20 1 * *", // 每月 1 號的 20:00
        channelGroup: "18monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📅 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！",
            color: 0x0099FF // 藍色
        }
    },
    // 範例任務 5：🔞每週一週報提醒
    {
        name: "每週一提醒",
        enabled: true,
        cronTime: "0 20 * * 1", // 每週一 20:00
        skipDates: [1, 15], //1號 15號 跳過
        channelGroup: "18Monday", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 6：🔞每15天提醒
    {
        name: "每15天提醒",
        enabled: true,
        cronTime: "0 20 1,15 * *", // 每月1號,15號 20:00 提醒
        skipDates: [1], //1號跳過
        channelGroup: "18half_monthly", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 7：每月第二個禮拜六提醒
    {
        name: "每月第二個禮拜六提醒",
        enabled: true,
        cronTime: "0 20 8-14 * 6", // 每月第二個禮拜六 20:00 提醒
        skipDates: [1], //1號跳過
        channelGroup: "2ndSat", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務：五分鐘測試
    {
        name: "五分鐘測試用",
        enabled: false,
        cronTime: "0 */5 * * * *", // ⚠️ 注意：每5分鐘的寫法是 0 */5 * * * * (6位) 或 */5 * * * * (5位)
        channelGroup: "TestFiveMins", // 🟢 設定群組名稱
        content: {
            title: "📝 每五分鐘的提醒測試",
            description: "各位冒險者辛苦了！這個月有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！",
            color: 0x00FF00 // 綠色
        }
    }
];

module.exports = {
    name: 'scheduledMessage',
    execute(client) {
        sendLog(client, '⏰ 載入定時發送任務...');

        tasks.forEach(task => {
            // 🟢 檢查開關：如果沒啟用，直接跳過
            if (task.enabled === false) {
                // console.log(`🚫 任務 [${task.name}] 已停用，跳過排程。`);
                return; 
            }

            if (!cron.validate(task.cronTime)) {
                sendLog(client, `❌ 任務 [${task.name}] 的時間設定錯誤: ${task.cronTime}`, 'error');
                return;
            }

            cron.schedule(task.cronTime, async () => {
                try {

                    //const dateStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei", day: "numeric" });
                    //const currentDay = parseInt(dateStr, 10); // 轉成數字
                    const currentDay = 15;

                    if (task.skipDates && task.skipDates.includes(currentDay)) {
                        await sendLog(client, `🗓️ 今天是 ${currentDay} 號，跳過 [${task.name}] 以避免與月報/半月報重複。`);
                        return; 
                    }

                    await sendLog(client, `🚀 執行定時任務: ${task.name} (群組: ${task.channelGroup})`);
                    
                    const currentChannels = await getScheduledChannels(client, task.channelGroup);

                    if (currentChannels.length === 0) return;

                    for (const entry of currentChannels) {
                        // 解構取得 ID 和 綁定用戶
                        const { channelId, mentionUserId } = entry;

                        try {
                            const channel = await client.channels.fetch(channelId).catch(() => null);

                            if (!channel || !channel.isTextBased()) {
                                await sendLog(client, `⚠️ 無效頻道: ${channelId}`, 'info');
                                continue;
                            }

                            const embed = new EmbedBuilder()
                                .setTitle(task.content.title)
                                .setDescription(task.content.description)
                                .setColor(task.content.color || 0xFFFFFF)
                                .setTimestamp();

                            // 🟢 準備發送內容
                            const payload = { embeds: [embed] };
                            
                            // 如果有綁定用戶，加在 content 裡 (這樣才會亮紅燈通知)
                            if (mentionUserId) {
                                payload.content = `<@${mentionUserId}> 來分享進度囉！`; 
                                // 如果只想純標記不講話，就用: payload.content = `<@${mentionUserId}>`;
                            }

                            await channel.send(payload);

                        } catch (error) {
                            await sendLog(client, `❌ 發送失敗 (${channelId}): ${error.message}`, 'error');
                        }
                    }
                } catch (fatalError) {
                    console.error(`❌ [FATAL] ${task.name} 崩潰:`, fatalError);
                }
            }, {
                scheduled: true,
                timezone: "Asia/Taipei"
            });

            sendLog(client, `✅ 已排程: ${task.name} -> 群組 [${task.channelGroup}]`);
        });
    }
};