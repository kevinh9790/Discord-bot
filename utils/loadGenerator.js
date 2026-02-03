/**
 * Load Generator for LLM Summary Testing
 * Generates realistic gamedev conversations using Discord webhooks
 */

const config = require('../config/config.js');
const templates = require('./gamedevTemplates.js');

class LoadGenerator {
  constructor() {
    this.webhooks = [];
    this.messageIds = [];
    this.startTime = null;
    this.abortSignal = false;
  }

  /**
   * Validate target channel for safety
   * @param {Channel} channel - Discord channel object
   * @throws {Error} If validation fails
   */
  validateChannel(channel) {
    if (!config.LOAD_TEST.enabled) {
      throw new Error('❌ 負載測試功能未啟用。請在 .env 中設定 LOAD_TEST_ENABLED=true');
    }

    // Check if channel is a text channel
    if (!channel.isTextBased()) {
      throw new Error('❌ 必須在文字頻道執行此指令。');
    }

    // Check channel whitelist
    if (config.LOAD_TEST.allowedChannels.length > 0) {
      if (!config.LOAD_TEST.allowedChannels.includes(channel.id)) {
        throw new Error(`❌ 此頻道不在允許的測試頻道名單中。\n允許的頻道ID: ${config.LOAD_TEST.allowedChannels.join(', ')}`);
      }
    } else if (config.LOAD_TEST.requireTestPrefix) {
      // If no whitelist, require channel name to contain "test"
      if (!channel.name.toLowerCase().includes('test')) {
        throw new Error('❌ 頻道名稱必須包含 "test" 關鍵字才能執行測試。');
      }
    }
  }

  /**
   * Create webhooks for simulated users
   * @param {Channel} channel - Discord channel
   * @param {Array} users - User objects with name and role
   * @returns {Promise<Array>} Array of webhook objects
   */
  async createWebhooks(channel, users) {
    try {
      const webhooks = [];

      for (const user of users) {
        const webhook = await channel.createWebhook({
          name: `[TEST] ${user.name}`,
          avatar: null, // Use default Discord avatar
          reason: `Load test webhook for user: ${user.name}`
        });

        webhooks.push({
          id: webhook.id,
          token: webhook.token,
          name: user.name,
          role: user.role,
          url: webhook.url
        });

        // Add small delay to respect rate limits
        await this.delay(200);
      }

      this.webhooks = webhooks;
      return webhooks;
    } catch (error) {
      await this.cleanup();
      throw new Error(`❌ 建立 webhook 失敗: ${error.message}`);
    }
  }

  /**
   * Send messages through webhooks with natural timing
   * @param {Channel} channel - Discord channel
   * @param {Object} conversation - Conversation template from templates
   * @param {string} rate - Message rate ('slow', 'medium', 'fast')
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<void>}
   */
  async sendMessages(channel, conversation, rate = 'medium', progressCallback) {
    this.startTime = Date.now();
    const maxRuntime = config.LOAD_TEST.maxRuntimeMinutes * 60 * 1000;
    const rateConfig = this.getRateConfig(rate);

    for (let i = 0; i < conversation.messages.length; i++) {
      // Check timeout
      if (Date.now() - this.startTime > maxRuntime) {
        throw new Error(`❌ 測試超時（超過 ${config.LOAD_TEST.maxRuntimeMinutes} 分鐘）`);
      }

      if (this.abortSignal) {
        throw new Error('❌ 測試已中止');
      }

      const msg = conversation.messages[i];
      const webhook = this.webhooks.find(w => w.name === msg.user);

      if (!webhook) {
        throw new Error(`❌ 找不到使用者 "${msg.user}" 的 webhook`);
      }

      try {
        // Calculate delay: use template delay + rate jitter
        let delayMs;
        if (i === 0) {
          delayMs = 0; // First message immediate
        } else if (i < conversation.messages.length - 1) {
          const previousDelay = conversation.messages[i - 1].delay || 0;
          const currentDelay = msg.delay || 0;
          const timeBetweenMessages = currentDelay - previousDelay;
          delayMs = Math.max(2000, timeBetweenMessages + rateConfig.jitter);
        } else {
          delayMs = 3000; // Slightly longer before last message
        }

        await this.delay(delayMs);

        // Send message via webhook
        const response = await this.sendWebhookMessage(webhook, msg.content);

        if (response && response.id) {
          this.messageIds.push({
            id: response.id,
            webhookId: webhook.id,
            timestamp: new Date()
          });
        }

        // Progress callback
        if (progressCallback) {
          progressCallback({
            sent: i + 1,
            total: conversation.messages.length,
            user: msg.user,
            content: msg.content.substring(0, 50)
          });
        }
      } catch (error) {
        console.error(`Error sending message from ${msg.user}:`, error);
        throw new Error(`❌ 傳送訊息時出錯 (使用者: ${msg.user}): ${error.message}`);
      }
    }
  }

  /**
   * Send message through webhook
   * @param {Object} webhook - Webhook object with id and token
   * @param {string} content - Message content
   * @returns {Promise<Object>} Response from Discord API
   */
  async sendWebhookMessage(webhook, content) {
    try {
      const url = `https://discordapp.com/api/webhooks/${webhook.id}/${webhook.token}?wait=true`;
      console.log(`[LoadGenerator] Sending webhook message from "[TEST] ${webhook.name}": "${content.substring(0, 60)}..."`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      console.log(`[LoadGenerator] ✅ Message sent (ID: ${json.id}, Author: ${json.author?.username})`);
      return json;
    } catch (error) {
      throw new Error(`Webhook 傳送失敗: ${error.message}`);
    }
  }

  /**
   * Get rate configuration with jitter
   * @param {string} rate - 'slow', 'medium', or 'fast'
   * @returns {Object} Rate configuration
   */
  getRateConfig(rate) {
    const configs = {
      slow: { min: 30000, max: 90000, jitter: 0 },      // 30-90s
      medium: { min: 15000, max: 45000, jitter: 0 },    // 15-45s
      fast: { min: 5000, max: 20000, jitter: 0 }        // 5-20s
    };

    const config = configs[rate] || configs.medium;
    // Add jitter: ±30% variation
    const jitterAmount = (config.max - config.min) * 0.3;
    config.jitter = (Math.random() - 0.5) * jitterAmount;

    return config;
  }

  /**
   * Cleanup: Delete webhooks and messages
   * @param {Channel} channel - Discord channel
   * @returns {Promise<void>}
   */
  async cleanup(channel) {
    try {
      // Delete messages
      if (this.messageIds.length > 0 && channel) {
        for (const msgInfo of this.messageIds) {
          try {
            const message = await channel.messages.fetch(msgInfo.id);
            await message.delete();
            await this.delay(100); // Rate limit protection
          } catch (err) {
            // Message may already be deleted or inaccessible, continue
            console.error(`Could not delete message ${msgInfo.id}:`, err.message);
          }
        }
      }

      // Delete webhooks
      if (this.webhooks.length > 0 && channel) {
        for (const webhook of this.webhooks) {
          try {
            const w = await channel.client.fetchWebhook(webhook.id, webhook.token);
            await w.delete();
            await this.delay(200); // Rate limit protection
          } catch (err) {
            // Webhook may already be deleted, continue
            console.error(`Could not delete webhook ${webhook.id}:`, err.message);
          }
        }
      }

      this.webhooks = [];
      this.messageIds = [];
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Helper: Promise-based delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate statistics from execution
   * @returns {Object} Statistics object
   */
  getStats() {
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    return {
      webhooksCreated: this.webhooks.length,
      messagesSent: this.messageIds.length,
      durationMs: duration,
      durationSeconds: Math.round(duration / 1000),
      durationMinutes: (duration / 1000 / 60).toFixed(1)
    };
  }

  /**
   * Main execution function
   * @param {Channel} channel - Discord channel
   * @param {Object} options - Options object
   * @param {string} options.preset - Preset name
   * @param {number} options.users - Number of users
   * @param {number} options.messages - Number of messages
   * @param {string} options.rate - Message rate
   * @param {Function} options.progressCallback - Progress callback
   * @returns {Promise<Object>} Execution result
   */
  async execute(channel, options = {}) {
    const {
      preset = 'unity-technical',
      users = 3,
      rate = 'medium',
      progressCallback
    } = options;

    try {
      // 1. Validate channel
      this.validateChannel(channel);

      // 2. Get conversation template
      const conversation = templates.prepareConversation(preset);

      // 3. Validate user count
      if (users < 2 || users > config.LOAD_TEST.maxUsers) {
        throw new Error(`❌ 使用者數量必須介於 2 到 ${config.LOAD_TEST.maxUsers} 之間`);
      }

      // 4. Validate message count
      if (conversation.messages.length > config.LOAD_TEST.maxMessages) {
        throw new Error(`❌ 此預設對話有 ${conversation.messages.length} 則訊息，超過上限 ${config.LOAD_TEST.maxMessages}`);
      }

      // 5. Limit users to available in template
      const activeUsers = conversation.users.slice(0, Math.min(users, conversation.users.length));

      // 6. Create webhooks
      const webhooks = await this.createWebhooks(channel, activeUsers);

      // 7. Send messages
      await this.sendMessages(channel, conversation, rate, progressCallback);

      // 8. Calculate stats
      const stats = this.getStats();

      // 9. Return success result
      return {
        success: true,
        preset,
        category: conversation.category,
        stats,
        webhooksCreated: webhooks.length,
        messagesSent: this.messageIds.length,
        estimatedTrigger: this.estimateLLMTrigger(this.messageIds.length, webhooks.length)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Estimate if LLM trigger rule would fire
   * @param {number} messageCount - Number of messages
   * @param {number} userCount - Number of users
   * @returns {Object} Trigger estimation
   */
  estimateLLMTrigger(messageCount, userCount) {
    const rule1 = userCount >= 3 && messageCount >= 10;
    const rule2 = userCount >= 4 && messageCount >= 8;

    return {
      rule1: {
        name: '規則 1: 3人+ 10訊息',
        passed: rule1
      },
      rule2: {
        name: '規則 2: 4人+ 8訊息',
        passed: rule2
      },
      shouldTrigger: rule1 || rule2
    };
  }
}

module.exports = LoadGenerator;
