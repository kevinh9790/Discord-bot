/**
 * Load Test Command
 * Generates realistic gamedev conversations to test LLM summary feature
 * Usage: &loadtest [users=N] [messages=N] [rate=slow|medium|fast] [preset=name]
 */

const LoadGenerator = require('../utils/loadGenerator.js');
const templates = require('../utils/gamedevTemplates.js');
const config = require('../config/config.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'loadtest',
  description: '建立負載測試以測試LLM討論摘要功能',

  async execute(message, args) {
    try {
      // Admin check (already checked by messageCreate.js, but double-check here)
      if (!message.member.permissions.has('Administrator')) {
        return message.reply('❌ 需要管理員權限才能執行此指令。');
      }

      // Check if load test is enabled
      if (!config.LOAD_TEST.enabled) {
        return message.reply('❌ 負載測試功能未啟用。');
      }

      // Parse command arguments
      const options = parseArguments(args);

      // Show initial confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x4287f5)
        .setTitle('🧪 負載測試開始')
        .setDescription(`即將在 <#${message.channel.id}> 執行負載測試`)
        .addFields(
          { name: '預設對話', value: options.preset, inline: true },
          { name: '模擬使用者', value: `${options.users}位`, inline: true },
          { name: '訊息數量', value: `${options.messages || '模板預設'}`, inline: true },
          { name: '傳送速率', value: options.rate, inline: true },
          { name: '自動清理', value: options.cleanup ? '✅ 開啟' : '❌ 關閉', inline: true }
        )
        .setTimestamp();

      const statusMessage = await message.reply({ embeds: [confirmEmbed] });

      // Initialize load generator
      const generator = new LoadGenerator();
      
      try {
        // Start load test
        const result = await generator.execute(message.channel, {
          preset: options.preset,
          users: options.users,
          rate: options.rate
        });

        // Always cleanup webhooks, but messages only if requested
        await generator.cleanup(message.channel, { 
          messages: options.cleanup, 
          webhooks: true 
        });

        // Create success report embed
        const reportEmbed = new EmbedBuilder()
          .setColor(0x43f578)
          .setTitle('✅ 負載測試完成')
          .setDescription(`測試在 <#${message.channel.id}> 成功執行`)
          .addFields(
            { name: '預設對話', value: result.preset, inline: true },
            { name: '對話類別', value: result.category || 'N/A', inline: true },
            { name: '模擬使用者', value: `${result.webhooksCreated}位`, inline: true },
            { name: '傳送訊息', value: `${result.messagesSent}則`, inline: true },
            { name: '執行時間', value: `${result.stats.durationSeconds}秒`, inline: true },
            { 
              name: '訊息處理', 
              value: options.cleanup ? '✅ 已清除所有測試訊息' : '📌 已保留訊息 (供成熟度掃描測試)', 
              inline: true 
            }
          );

        // Add trigger estimation
        if (result.estimatedTrigger) {
          const triggerInfo = [
            `${result.estimatedTrigger.rule1.passed ? '✅' : '❌'} ${result.estimatedTrigger.rule1.name}`,
            `${result.estimatedTrigger.rule2.passed ? '✅' : '❌'} ${result.estimatedTrigger.rule2.name}`,
            '',
            result.estimatedTrigger.shouldTrigger
              ? '🎯 預期應觸發 LLM 檢查'
              : '⚠️ 預期不會觸發 LLM 檢查'
          ].join('\n');

          reportEmbed.addFields(
            { name: 'LLM 觸發估算', value: triggerInfo }
          );
        }

        reportEmbed.setFooter({ text: '所有測試訊息已自動刪除' });
        reportEmbed.setTimestamp();

        // Update status message with report
        await statusMessage.edit({ embeds: [reportEmbed] });

      } catch (error) {
        // Cleanup on error: Always clear webhooks, messages only if requested
        try {
          await generator.cleanup(message.channel, {
            messages: options.cleanup,
            webhooks: true
          });
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }

        // Send error report
        const errorEmbed = new EmbedBuilder()
          .setColor(0xf54242)
          .setTitle('❌ 負載測試失敗')
          .setDescription(error.message)
          .setTimestamp();

        await statusMessage.edit({ embeds: [errorEmbed] });
      }

    } catch (error) {
      console.error('Command error:', error);
      message.reply(`❌ 指令執行出錯: ${error.message}`);
    }
  }
};

/**
 * Parse command arguments
 * Format: &loadtest [users=N] [rate=slow|medium|fast] [preset=name] [cleanup=true]
 * @param {Array} args - Raw command arguments
 * @returns {Object} Parsed options
 */
function parseArguments(args) {
  const defaults = {
    users: 3,
    rate: 'medium',
    preset: 'unity-technical',
    messages: null,
    cleanup: false
  };

  // Parse key=value arguments
  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (!key || !value) continue;

    switch (key.toLowerCase()) {
      case 'cleanup':
        defaults.cleanup = value.toLowerCase() === 'true';
        break;
      case 'users':
      case 'user': {
        const userCount = parseInt(value);
        if (!isNaN(userCount) && userCount >= 2 && userCount <= 8) {
          defaults.users = userCount;
        }
        break;
      }

      case 'rate':
      case 'speed':
        if (['slow', 'medium', 'fast'].includes(value.toLowerCase())) {
          defaults.rate = value.toLowerCase();
        }
        break;

      case 'preset':
        if (templates.getAvailablePresets().includes(value.toLowerCase())) {
          defaults.preset = value.toLowerCase();
        }
        break;

      case 'messages':
      case 'msg': {
        const msgCount = parseInt(value);
        if (!isNaN(msgCount) && msgCount > 0) {
          defaults.messages = msgCount;
        }
        break;
      }
    }
  }

  return defaults;
}
