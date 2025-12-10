const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

// ==========================================
// ⚙️ 設定區域
// ==========================================
// 1. 頻道與分類過濾設定
const FILTER_CONFIG = {
    // 若填入 ID，則「只會」統計這些分類下的頻道；若留空 [] 則統計全部
    INCLUDE_CATEGORIES: [],
    // 排除的分類 ID (優先權高於 INCLUDE)
    EXCLUDE_CATEGORIES: ["1229094983202504715", "859390147656679455", "1440221111228043394", "1429360420740661249", "1434802712712577074", "1230537650012819500"],
    // 排除的身分組
    EXCLUDE_ROLES: ["1229465574074224720"],
    // 指定伺服器 ID (留空則不限制，若只想抓特定伺服器請填入 ID)
    TARGET_GUILD_ID: "859390147110633512"
};

// 2. 頻道 ID 設定
const CHANNELS = {
    DEBUG_LOG: "1232356996779343944", // 除錯/Log 用
    STATS_LOG: "1232356996779343944",  // 統計數據發送處 (Log 頻道)
    LEADERBOARD: "859423355626717215" // 活躍排行榜發送處 (主頻道，請自行修改 ID)
};
// ==========================================

// 輔助函數：發送 Log 到 Discord
async function sendLog(client, message, type = 'info') {
    if (type === 'error') console.error(message);
    else console.log(message);

    if (!CHANNELS.DEBUG_LOG) return;

    try {
        const channel = await client.channels.fetch(CHANNELS.DEBUG_LOG).catch(() => null);
        if (channel && channel.isTextBased()) {
            const prefix = type === 'error' ? '❌ [錯誤]' : '📝 [Log]';
            const safeMessage = message.length > 1900 ? message.substring(0, 1900) + '...' : message;
            await channel.send(`${prefix} ${safeMessage}`).catch(() => { });
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

        // 將設定掛載到 client 以便其他檔案讀取
        client.filterConfig = FILTER_CONFIG;

        //#region 設定邀請連結
        client.inviteUses = new Map();
        for (const [guildId, guild] of client.guilds.cache) {
            if (FILTER_CONFIG.TARGET_GUILD_ID && guildId !== FILTER_CONFIG.TARGET_GUILD_ID) continue;
            try {
                const invites = await guild.invites.fetch();
                client.inviteUses.set(guildId, new Map(invites.map(inv => [inv.code, inv.uses])));
            } catch (err) {
                console.warn(`⚠️ 無法抓取 ${guild.name} 的邀請快取: ${err.message}`);
            }
        }
        console.log(`🤖 已啟動並記錄邀請次數`);
        //#endregion

        // 1. 初始化數據結構
        // msgPoints: 文字活躍積分
        // voicePoints: 語音活躍積分
        // msgCount: 訊息數 (統計用)
        // voiceMs: 語音時長 (統計用)
        // maxUsers: 語音同時最高人數 (統計用)
        client.dailyStats = {
            channels: {}, // { id: { name, msgCount, voiceMs, msgPoints, voicePoints, maxUsers } }
            mostReacted: {
                count: 0,
                url: null,
                content: "",
                author: "",
                authorId: null,
                channelId: null
            },
            voiceState: new Map() // 用於追蹤語音積分計算 { channelId: { lastTime, userCount, streamCount } }
        };

        //#region 2. 設定排程：每天午夜 00:00 執行，用以統計訊息總數、語音時長、表情符號總數，並整理輸出表格
        cron.schedule('0 0 0 * * *', async () => {
            try {
                await sendLog(client, '📊 開始自動結算每日數據...');

                // 1. 抓取要發送的頻道
                const statsLogChannel = await client.channels.fetch(CHANNELS.STATS_LOG).catch(() => null);
                const leaderboardChannel = await client.channels.fetch(CHANNELS.LEADERBOARD).catch(() => null);

                // 2. 確保數據存在
                if (!client.dailyStats) {
                    await sendLog(client, '❌ client.dailyStats 遺失，無法產生報表', 'error');
                    client.dailyStats = { channels: {}, mostReacted: { count: 0 }, voiceState: new Map() };
                    return;
                }

                //#region --- A. 語音最後結算 (強制結算當前累積的積分) ---
                const now = Date.now();
                // 針對每一個還在活躍的語音頻道進行結算
                client.dailyStats.voiceState.forEach((state, chId) => {
                    if (!client.dailyStats.channels[chId]) return;

                    const duration = now - state.lastTime;
                    if (duration > 0) {
                        // 計算積分公式
                        // 基礎分 0.05/s (有人)
                        // 直播分 0.1/s (每人)
                        // 多人加成 0.75/s (每多一人 => count - 1)

                        const baseScore = state.userCount > 0 ? 0.05 : 0;
                        const streamScore = state.streamCount * 0.1;
                        const multiUserScore = state.userCount > 1 ? (state.userCount - 1) * 0.75 : 0;

                        const scorePerSec = baseScore + streamScore + multiUserScore;
                        const pointsToAdd = scorePerSec * (duration / 1000);

                        client.dailyStats.channels[chId].voicePoints += pointsToAdd;
                        client.dailyStats.channels[chId].voiceMs += duration; // 統計總時長
                    }
                    // 更新時間，避免重複計算 (雖然馬上要重置了)
                    state.lastTime = now;
                });
                //#endregion

                // --- B. 整理數據 ---
                const allStats = Object.entries(client.dailyStats.channels).map(([id, data]) => ({
                    id: id,
                    ...data
                }));

                // ==========================================
                //#region 📊 報表 1：Log 頻道 - 詳細統計數據
                // ==========================================
                if (statsLogChannel) {
                    // 訊息數據 (全部列出)
                    const textChannels = allStats.filter(d => d.msgCount > 0).sort((a, b) => b.msgCount - a.msgCount);
                    // 語音數據 (全部列出)
                    const voiceChannels = allStats.filter(d => d.voiceMs > 0).sort((a, b) => b.voiceMs - a.voiceMs);

                    let reportText = "**📅 每日數據統計報表**\n\n";

                    reportText += "**💬 文字頻道數據 (訊息數)**\n";
                    if (textChannels.length > 0) {
                        reportText += textChannels.map(c => `- <#${c.id}> : ${c.msgCount} 則`).join('\n');
                    } else {
                        reportText += "無數據";
                    }

                    reportText += "\n\n**🎙️ 語音頻道數據 (最高人數 / 總時長)**\n";
                    if (voiceChannels.length > 0) {
                        reportText += voiceChannels.map(c => `- <#${c.id}> : 同時語音人數 ${c.maxUsers} 人 / 總共： ${formatDuration(c.voiceMs)}`).join('\n');
                    } else {
                        reportText += "無數據";
                    }

                    // 如果太長要分段發
                    if (reportText.length > 1900) {
                        const chunks = reportText.match(/[\s\S]{1,1900}/g) || [];
                        for (const chunk of chunks) {
                            await statsLogChannel.send(chunk);
                        }
                    } else {
                        await statsLogChannel.send(reportText);
                    }
                }
                //#endregion

                // ==========================================
                //#region 🏆 報表 2：主頻道 - 活躍度排行榜 (積分制)
                // ==========================================
                if (leaderboardChannel) {
                    // 文字積分排名 (取前 10)
                    const msgRank = allStats
                        .filter(d => d.msgPoints > 0)
                        .sort((a, b) => b.msgPoints - a.msgPoints)
                        .slice(0, 10);

                    // 語音積分排名 (取前 10)
                    const voiceRank = allStats
                        .filter(d => Math.round(d.voicePoints) > 0)
                        .sort((a, b) => b.voicePoints - a.voicePoints)
                        .slice(0, 10);

                    const embed = new EmbedBuilder()
                        .setTitle(`🏆 本日活躍排行榜`)
                        .setColor(0xFFD700)
                        .setTimestamp();

                    // 💬 訊息活躍頻道 (左欄)
                    const msgFieldVal = msgRank.length > 0
                        ? msgRank.map((c, i) => `**${i + 1}.** <#${c.id}>: ${Math.round(c.msgPoints)} 點 🔥`).join('\n')
                        : "無數據";

                    // 🗣️ 語音活躍頻道 (右欄)
                    const voiceFieldVal = voiceRank.length > 0
                        ? voiceRank.map((c, i) => `**${i + 1}.** <#${c.id}>: ${Math.round(c.voicePoints)} 點 🔥`).join('\n')
                        : "無數據";

                    embed.addFields(
                        { name: '💬 訊息活躍頻道', value: msgFieldVal, inline: true },
                        { name: '🗣️ 語音活躍頻道', value: voiceFieldVal, inline: true }
                    );

                    await leaderboardChannel.send({ embeds: [embed] });
                }
                //#endregion

                // ==========================================
                //#region ⭐ 報表 3：反應王 (純文字 + Tag)
                // ==========================================
                const bestMsg = client.dailyStats.mostReacted;
                if (bestMsg.count > 0 && leaderboardChannel) {
                    const authorTag = bestMsg.authorId ? `<@${bestMsg.authorId}>` : bestMsg.author;
                    const msgLink = bestMsg.url;

                    const reactionText = `\n👑 **本日反應王** ${authorTag} 👑\n獲得了 **${bestMsg.count}** 個表情符號！\n\n> ${bestMsg.content.replace(/\n/g, ' ').substring(0, 50)}...\n\n👉 [前往朝聖](${msgLink})`;

                    // 這裡改用純文字發送，不使用 Embed
                    await leaderboardChannel.send({
                        content: reactionText,
                        allowedMentions: { parse: ['users'] } // 確保可以 Tag 到人
                    });
                }

                await sendLog(client, '✅ 自動日報發送成功！');
                //#endregion

                //#region --- C. 重置數據 ---
                // ⚠️ 注意：語音狀態 (voiceState) 不能完全清空，因為還有人在裡面
                // 我們只重置積分和計數，但保留「正在進行中」的狀態追蹤
                const newChannels = {};
                const nowReset = Date.now();

                // 如果有人還在語音裡，需要把他們的狀態帶到明天
                client.dailyStats.voiceState.forEach((state, chId) => {
                    if (state.userCount > 0) {
                        newChannels[chId] = {
                            name: client.channels.cache.get(chId)?.name || "未知",
                            msgCount: 0, voiceMs: 0, 
                            msgPoints: 0, voicePoints: 0, // 重置積分
                            maxUsers: state.userCount
                        };
                        // 重置最後結算時間為現在
                        state.lastTime = nowReset;
                    }
                });

                client.dailyStats.channels = newChannels;
                client.dailyStats.mostReacted = { count: 0, url: null, content: "", author: "", authorId: null };
                // voiceState map 不需要清空，只需要更新時間 (上面已做)

                await sendLog(client, '🔄 數據已重置');
                //#endregion

            } catch (fatalError) {
                await sendLog(client, `❌ [嚴重錯誤] 自動日報執行失敗: ${fatalError.message}`, 'error');
            }

        }, { scheduled: true, timezone: "Asia/Taipei" });
        //#endregion
    }
};
