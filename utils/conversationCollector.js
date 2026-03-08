// utils/conversationCollector.js
/**
 * Collects and formats conversation messages for LLM processing
 */

const config = require('../config/config.js');

module.exports = {
    /**
     * 從指定頻道收集特定時間窗口內的訊息
     * @param {Channel} channel - 要收集訊息的 Discord 頻道
     * @param {number} days - 往回查詢的天數
     * @returns {Promise<Array>} 格式化後的訊息陣列
     */
    async collectMessagesInTimeWindow(channel, days = 7) {
        try {
            const lookbackMs = days * 24 * 60 * 60 * 1000;
            const startTime = Date.now() - lookbackMs;
            
            console.log(`[ConversationCollector] Starting windowed collection in #${channel.name}, days: ${days}`);
            
            let allMessages = [];
            let lastId = null;
            let reachedStart = false;

            while (!reachedStart) {
                const options = { limit: 100 };
                if (lastId) options.before = lastId;

                const fetched = await channel.messages.fetch(options);
                if (fetched.size === 0) break;

                for (const msg of fetched.values()) {
                    if (msg.createdAt.getTime() < startTime) {
                        reachedStart = true;
                        break;
                    }
                    allMessages.push(msg);
                    lastId = msg.id;
                }

                if (fetched.size < 100) break;
            }

            console.log(`[ConversationCollector] Fetched ${allMessages.size || allMessages.length} raw messages from window`);

            // Use the same filtering logic as collectMessages
            return this._processRawMessages(allMessages);
        } catch (error) {
            console.error('[ConversationCollector] Windowed collection failed:', error);
            return [];
        }
    },

    /**
     * 內部輔助函式，處理並過濾原始 Discord 訊息
     * @private
     */
    _processRawMessages(msgArray) {
        // 依時間排序（由舊到新）
        const sortedMsgs = Array.from(msgArray).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        const filtered = [];
        for (const msg of sortedMsgs) {
            // 保留帶有 [TEST] 前綴的 webhook 測試訊息
            const isWebhook = msg.webhookId !== null;
            const isTestMessage = msg.author.username && msg.author.username.includes('[TEST]');

            if (isWebhook && isTestMessage) {
                filtered.push(msg);
                continue;
            }

            if (msg.author.bot || msg.content.startsWith('&') || msg.system) continue;
            if (!msg.content && msg.embeds.length === 0) continue;

            filtered.push(msg);
        }

        return filtered.map(msg => ({
            id: msg.id, // 加入訊息 ID，供主題聚類使用
            authorId: msg.author.id,
            authorName: msg.author.username,
            content: msg.content || this._extractEmbedContent(msg),
            timestamp: msg.createdAt.getTime(),
            attachments: msg.attachments.map(a => ({
                url: a.url,
                name: a.name,
                size: a.size
            })),
            embeds: msg.embeds.length > 0 ? msg.embeds.length : 0
        }));
    },

    /**
     * Collect messages from a channel for LLM analysis
     * @param {Channel} channel - Discord channel to collect from
     * @param {number} lookbackWindow - Number of messages to look back (default: 100)
     * @returns {Promise<Array>} Formatted messages array
     */
    async collectMessages(channel, lookbackWindow = 100) {
        try {
            console.log(`[ConversationCollector] Starting collection in #${channel.name} (ID: ${channel.id}), lookback: ${lookbackWindow}`);

            // Fetch messages from channel
            const messages = await channel.messages.fetch({ limit: lookbackWindow });
            return this._processRawMessages(Array.from(messages.values()));
        } catch (error) {
            console.error('[ConversationCollector] Failed to collect messages:', error);
            return [];
        }
    },

    /**
     * Get count of unique authors in messages
     * @param {Array} messages - Formatted messages array
     * @returns {number} Number of unique authors
     */
    getUniqueAuthorsCount(messages) {
        const uniqueAuthors = new Set(messages.map(m => m.authorId));
        return uniqueAuthors.size;
    },

    /**
     * Format messages for LLM consumption
     * @param {Array} messages - Formatted messages
     * @returns {string} Formatted conversation text for LLM
     */
    formatForLLM(messages) {
        console.log(`[ConversationCollector] Formatting ${messages.length} messages for LLM`);

        const formatted = messages
            .map(msg => {
                const time = new Date(msg.timestamp).toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                return `[${time}] ${msg.authorName}: ${msg.content}`;
            })
            .join('\n');

        console.log(`[ConversationCollector] LLM Input Preview (first 500 chars):\n${formatted.substring(0, 500)}`);
        return formatted;
    },

    /**
     * Extract text from embeds
     * @private
     * @param {Message} msg - Discord message
     * @returns {string} Extracted embed content
     */
    _extractEmbedContent(msg) {
        if (msg.embeds.length === 0) return '';

        return msg.embeds
            .map(embed => {
                const parts = [];
                if (embed.title) parts.push(`**${embed.title}**`);
                if (embed.description) parts.push(embed.description);
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        parts.push(`${field.name}: ${field.value}`);
                    });
                }
                return parts.join('\n');
            })
            .join('\n');
    },

    /**
     * Get summary statistics of messages
     * @param {Array} messages - Formatted messages
     * @returns {Object} Statistics object
     */
    getStatistics(messages) {
        const uniqueAuthors = new Set(messages.map(m => m.authorId));
        const totalWords = messages.reduce((sum, m) => sum + m.content.split(' ').length, 0);
        const hasAttachments = messages.filter(m => m.attachments.length > 0).length;

        const stats = {
            totalMessages: messages.length,
            uniqueAuthors: uniqueAuthors.size,
            totalWords,
            messagesWithAttachments: hasAttachments,
            timespan: messages.length > 0 ? {
                start: new Date(messages[0].timestamp),
                end: new Date(messages[messages.length - 1].timestamp)
            } : null
        };

        console.log(`[ConversationCollector] Statistics:
  - Total messages: ${stats.totalMessages}
  - Unique authors: ${stats.uniqueAuthors}
  - Total words: ${stats.totalWords}
  - Messages with attachments: ${stats.messagesWithAttachments}
  - Timespan: ${stats.timespan ? stats.timespan.start.toLocaleString() + ' - ' + stats.timespan.end.toLocaleString() : 'N/A'}`);

        return stats;
    }
};
