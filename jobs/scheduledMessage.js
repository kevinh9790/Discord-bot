const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const log = require('../utils/logger');

const channelsFilePath = path.join(__dirname, '../config/scheduledChannels.json');

// 輔助函數：取得台北時間的詳細資訊
function getTaipeiInfo() {
    const now = new Date();
    const taipeiString = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
    const taipeiDate = new Date(taipeiString);

    const day = taipeiDate.getDate();      // 幾號
    const dayOfWeek = taipeiDate.getDay(); // 星期幾 (0 是週日, 6 是週六)

    return {
        day: day,
        dayOfWeek: dayOfWeek
    };
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
        await log(client, `❌ [Debug] 讀取設定檔失敗: ${err.message}`, 'error');
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
        cronTime: "0 0 20 1 * *", // 每月 1 號的 20:00
        channelGroup: "monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📅 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！\n\n進度分享教學：<#1457718704333914145>",
            color: 0x0099FF // 藍色
        }
    },
    // 範例任務 2：每週一週報提醒
    {
        name: "每週一提醒",
        enabled: true,
        cronTime: "0 0 20 * * 1", // 每週一 20:00
        skipDates: [1, 15], //1號 15號 跳過
        channelGroup: "Monday", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！\n\n進度分享教學：<#1457718704333914145>",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 3：每15天提醒
    {
        name: "每15天提醒",
        enabled: true,
        cronTime: "0 0 20 15 * *", // 每月15號 20:00 提醒
        channelGroup: "half_monthly", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！\n\n進度分享教學：<#1457718704333914145>",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 4：🔞每月月初提醒
    {
        name: "18每月月初提醒",
        enabled: true,
        cronTime: "0 0 20 1 * *", // 每月 1 號的 20:00
        channelGroup: "18monthly_reminders", // 🟢 設定群組名稱
        content: {
            title: "📅 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！\n\n進度分享教學：<#1457720932570235012>",
            color: 0x0099FF // 藍色
        }
    },
    // 範例任務 5：🔞每週一週報提醒
    {
        name: "18每週一提醒",
        enabled: true,
        cronTime: "0 0 20 * * 1", // 每週一 20:00
        skipDates: [1, 15], //1號 15號 跳過
        channelGroup: "18Monday", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！\n\n進度分享教學：<#1457720932570235012>",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 6：🔞每15天提醒
    {
        name: "18每15天提醒",
        enabled: true,
        cronTime: "0 0 20 15 * *", // 每月15號 20:00 提醒
        channelGroup: "18half_monthly", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1442811186528911512>和大家分享！\n\n進度分享教學：<#1457720932570235012>",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務 7：每月第二個禮拜六提醒
    {
        name: "每月第二個禮拜六提醒",
        enabled: true,
        cronTime: "0 0 20 8-14 * *", // 每月第二個禮拜六 20:00 提醒
        isSecondSaturday: true,
        channelGroup: "2ndSat", // 🟢 設定群組名稱
        content: {
            title: "📝 開發進度分享",
            description: "冒險者辛苦了！有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！\n\n進度分享教學：<#1457718704333914145>",
            color: 0x00FF00 // 綠色
        }
    },
    // 範例任務：五分鐘測試
    {
        name: "五分鐘測試用",
        enabled: true,
        cronTime: "0 */5 * * * *", // ⚠️ 注意：每5分鐘的寫法是 0 */5 * * * * (6位) 或 */5 * * * * (5位)
        channelGroup: "TestFiveMins", // 🟢 設定群組名稱
        content: {
            title: "📝 每五分鐘的提醒測試",
            description: "各位冒險者辛苦了！這個月有做甚麼進度內容呢？\n請到<#1440593941073231932>和大家分享！\n\n進度分享教學：<#1457718704333914145>",
            color: 0x00FF00 // 綠色
        }
    }
];

module.exports = {
    name: 'scheduledMessage',
    execute(client) {
        log(client, '⏰ 載入定時發送任務...');

        tasks.forEach(task => {
            // 🟢 檢查開關：如果沒啟用，直接跳過
            if (task.enabled === false) {
                // console.log(`🚫 任務 [${task.name}] 已停用，跳過排程。`);
                return;
            }

            if (!cron.validate(task.cronTime)) {
                log(client, `❌ 任務 [${task.name}] 的時間設定錯誤: ${task.cronTime}`, 'error');
                return;
            }

            cron.schedule(task.cronTime, async () => {
                try {
                    const { day, dayOfWeek, fullString } = getTaipeiInfo();

                    if (task.skipDates && task.skipDates.includes(day)) {
                        await log(client, `🗓️ [${task.name}] 今天是 ${day} 號，觸發跳過機制。`);
                        return;
                    }

                    if (task.isSecondSaturday && dayOfWeek !== 6) {
                        return; // 雖然日期符合 8-14，但今天不是禮拜六，所以不執行
                    }

                    await log(client, `🚀 執行定時任務: ${task.name} (群組: ${task.channelGroup})`);

                    const currentChannels = await getScheduledChannels(client, task.channelGroup);

                    if (currentChannels.length === 0) return;

                    for (const entry of currentChannels) {
                        // 解構取得 ID 和 綁定用戶
                        const { channelId, mentionUserId } = entry;

                        try {
                            const channel = await client.channels.fetch(channelId).catch(() => null);

                            if (!channel || !channel.isTextBased()) {
                                await log(client, `⚠️ 無效頻道: ${channelId}`, 'info');
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

                            // 💡 防止速率限制：每發送一個頻道延遲 0.5 秒
                            await new Promise(resolve => setTimeout(resolve, 500));

                        } catch (error) {
                            await log(client, `❌ 發送失敗 (${channelId}): ${error.message}`, 'error');
                        }
                    }
                } catch (fatalError) {
                    console.error(`❌ [FATAL] ${task.name} 崩潰:`, fatalError);
                }
            }, {
                scheduled: true,
                timezone: "Asia/Taipei"
            });

            log(client, `✅ 已排程: ${task.name} -> 群組 [${task.channelGroup}]`);
        });
    }
};