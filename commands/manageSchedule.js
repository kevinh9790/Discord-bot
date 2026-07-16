const fs = require('fs');
const path = require('path');
const { getConflictingGroups } = require('../utils/scheduleGroupRules');

const channelsFilePath = path.join(__dirname, '../config/scheduledChannels.json');

// 讀取完整資料
function getAllData() {
    if (!fs.existsSync(channelsFilePath)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(channelsFilePath, 'utf8'));
        // 如果是舊版陣列格式，強制轉型為物件，避免報錯
        if (Array.isArray(data)) return {}; 
        return data;
    } catch { return {}; }
}

function saveData(data) {
    fs.writeFileSync(channelsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

//清理 ID (移除 <@! > 等符號)
function cleanId(id) {
    return id ? id.replace(/[<@!&>]/g, '') : null;
}

module.exports = {
    name: "推播設定",
    description: "管理定期推播列表 (設定/取消)",
    async execute(message, args) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply("❌ 只有管理員可以使用此指令。");
        }

        // 參數: &推播設定 設定/取消 <群組> [頻道ID] [用戶ID]
        const action = args[0]; // "設定" 或 "取消"
        const groupName = args[1]; // 群組名稱

        if (!action || !groupName || (action !== "設定" && action !== "取消")) {
            return message.reply(
                "⚠️ 指令格式錯誤！請依照以下格式：\n" +
                "- 設定：`&推播設定 設定 <群組名稱> [頻道ID]`\n" +
                "- 取消：`&推播設定 取消 <群組名稱> [頻道ID]`"
            );
        }

        // --- 解析參數 (智慧判斷是頻道還是用戶) ---
        let targetChannelId = message.channel.id;
        let targetChannelName = message.channel.name;
        let targetUserId = null;
        let targetUserName = "";

        // 檢查 args[2] (可能是 頻道ID 或 用戶提及)
        if (args[2]) {
            const arg2 = args[2];
            if (arg2.startsWith('<@') || isNaN(arg2)) {
                // 看起來像是 @用戶，那頻道就是當前頻道
                targetUserId = cleanId(arg2);
            } else {
                // 看起來是數字，假設是 頻道 ID
                targetChannelId = arg2;
                // 嘗試抓取頻道名稱
                const ch = await message.guild.channels.fetch(targetChannelId).catch(() => null);
                if (ch) targetChannelName = ch.name;
                else targetChannelName = "未知頻道";
            }
        }

        // 檢查 args[3] (如果有，通常是用戶 ID)
        if (args[3]) {
            targetUserId = cleanId(args[3]);
        }

        // 如果有指定用戶，抓取用戶名稱以便顯示
        if (targetUserId) {
            const user = await message.client.users.fetch(targetUserId).catch(() => null);
            targetUserName = user ? user.tag : targetUserId;
        }

        const data = getAllData();

        //#region 設定推播
        if (action === "設定") {
            // 1. 如果該群組不存在，先建立一個空陣列
            if (!data[groupName]) {
                data[groupName] = [];
            }

            data[groupName] = data[groupName].filter(item => {
                const cId = typeof item === 'string' ? item : item.channelId;
                return cId !== targetChannelId;
            });

            const removedGroups = [];
            for (const conflictGroup of getConflictingGroups(groupName)) {
                if (!Array.isArray(data[conflictGroup])) continue;

                const originalConflictLength = data[conflictGroup].length;
                data[conflictGroup] = data[conflictGroup].filter(item => {
                    const cId = typeof item === 'string' ? item : item.channelId;
                    return cId !== targetChannelId;
                });

                if (data[conflictGroup].length !== originalConflictLength) {
                    removedGroups.push(conflictGroup);
                }
            }

            const newEntry = {
                channelId: targetChannelId,
                mentionUserId: targetUserId // 如果沒指定就是 null
            };
            data[groupName].push(newEntry);
            saveData(data);

            let replyMsg = `✅ 已成功設定推播 **${groupName}**！\n📺 目標頻道：${targetChannelName}`;
            if (targetUserId) {
                replyMsg += `\n👤 綁定通知：${targetUserName} (${targetUserId})`;
            }
            if (removedGroups.length > 0) {
                replyMsg += `\n⚠️ 已自動從互斥群組移除：${removedGroups.join(', ')}`;
            }
            return message.reply(replyMsg);
        }
        //#endregion

        //#region 取消推播
        if (action === "取消") {
            if (!data[groupName]) return message.reply(`⚠️ 群組 **${groupName}** 不存在。`);

            const originalLength = data[groupName].length;
            
            // 過濾掉這個 ID
            data[groupName] = data[groupName].filter(item => {
                const cId = typeof item === 'string' ? item : item.channelId;
                return cId !== targetChannelId;
            });

            if (data[groupName].length === originalLength) {
                return message.reply(`⚠️ 頻道 **${targetChannelName}** 並不在群組 **${groupName}** 內。`);
            }
            
            saveData(data);
            return message.reply(`✅ 已從群組 **${groupName}** 取消設定！\n目標：${targetChannelName}`);
        }
        //#endregion
    },
};
