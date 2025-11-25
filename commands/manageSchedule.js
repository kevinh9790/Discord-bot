const fs = require('fs');
const path = require('path');

const channelsFilePath = path.join(__dirname, '../config/scheduledChannels.json');

// 讀取完整資料
function getAllData() {
    if (!fs.existsSync(channelsFilePath)) return {};
    try {
        const data = JSON.parse(fs.readFileSync(channelsFilePath, 'utf8'));
        // 如果是舊版陣列格式，強制轉型為物件，避免報錯
        if (Array.isArray(data)) return {}; 
        return data;
    } catch (e) { return {}; }
}

function saveData(data) {
    fs.writeFileSync(channelsFilePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
    name: "推播設定",
    description: "管理定期推播列表 (設定/取消)",
    async execute(message, args) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply("❌ 只有管理員可以使用此指令。");
        }

        // 參數檢查：&推播設定 <動作> <群組> [頻道ID]
        const action = args[0]; // "設定" 或 "取消"
        const groupName = args[1]; // 群組名稱
        const inputChannelId = args[2]; // (選填) 頻道 ID

        if (!action || !groupName || (action !== "設定" && action !== "取消")) {
            return message.reply(
                "⚠️ 指令格式錯誤！請依照以下格式：\n" +
                "- 設定：`&推播設定 設定 <群組名稱> [頻道ID]`\n" +
                "- 取消：`&推播設定 取消 <群組名稱> [頻道ID]`"
            );
        }

        // 決定目標頻道
        let targetChannelId = message.channel.id;
        let targetChannelName = message.channel.name;

        if (inputChannelId) {
            if (!/^\d+$/.test(inputChannelId)) {
                return message.reply("❌ 無效的頻道 ID 格式，請輸入純數字。");
            }
            targetChannelId = inputChannelId;
            
            const fetchedChannel = await message.guild.channels.fetch(targetChannelId).catch(() => null);
            if (fetchedChannel) {
                targetChannelName = fetchedChannel.name;
            } else {
                targetChannelName = "未知頻道 (或機器人無法查看)";
            }
        }

        const data = getAllData();

        //#region 設定推播 (設定)
        if (action === "設定") {
            // 1. 如果該群組不存在，先建立一個空陣列
            if (!data[groupName]) {
                data[groupName] = [];
            }

            // 2. 檢查是否已有在推播列表
            if (data[groupName].includes(targetChannelId)) {
                return message.reply(`⚠️ 頻道 **${targetChannelName}** 已經在群組 **${groupName}** 的通知列表內了！`);
            }

            // 3. 加入並存檔
            data[groupName].push(targetChannelId);
            saveData(data);

            return message.reply(`✅ 已成功設定推播 **${groupName}**！\n目標頻道：${targetChannelName} (${targetChannelId})`);
        }
        //#endregion

        //#region 取消推播
        if (action === "取消") {
            // 1. 檢查群組是否存在或該頻道是否在列表中
            if (!data[groupName] || !data[groupName].includes(targetChannelId)) {
                return message.reply(`⚠️ 頻道 **${targetChannelName}** 並沒有設定群組 **${groupName}** 喔！`);
            }

            // 2. 過濾掉這個 ID
            data[groupName] = data[groupName].filter(id => id !== targetChannelId);
            
            // 3. 存檔
            saveData(data);

            return message.reply(`✅ 已從群組 **${groupName}** 取消設定！\n目標：${targetChannelName} (${targetChannelId})`);
        }
        //#endregion
    },
};