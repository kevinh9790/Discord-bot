module.exports = {
    name: 'ready',
    once: true,
    // === Bot 啟動後事件 ===
    execute(client) {
      console.log(`✅ 已登入為 ${client.user.tag}`);
        console.log(`🛌 醒來於 ${new Date().toLocaleTimeString()}`);

        
    }
  };