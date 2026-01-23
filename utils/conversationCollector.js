// utils/conversationCollector.js
/**
 * Collects and formats conversation messages for LLM processing
 */

const config = require('../config/config.js');

module.exports = {
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
            console.log(`[ConversationCollector] Fetched ${messages.size} total messages`);

            if (messages.size === 0) {
                console.log('[ConversationCollector] No messages found');
                return [];
            }

            // Convert to array and reverse to get chronological order
            const msgArray = Array.from(messages.values()).reverse();
            console.log(`[ConversationCollector] Message order reversed (oldest to newest)`);

            // Detailed filtering with logging
            const filtered = [];
            const filterReasons = {
                botMessage: 0,
                commandMessage: 0,
                systemMessage: 0,
                emptyMessage: 0,
                testPrefix: 0,
                valid: 0
            };

            for (const msg of msgArray) {
                let reason = null;

                // Check if this is a webhook message (including [TEST] load test messages)
                const isWebhook = msg.webhookId !== null;
                const isTestMessage = msg.author.username && msg.author.username.includes('[TEST]');

                // Include webhook messages with [TEST] prefix (they're intentional test data for LLM)
                if (isWebhook && isTestMessage) {
                    console.log(`  ✅ [WEBHOOK-TEST] @${msg.author.username}: "${msg.content.substring(0, 50)}"`);
                    filterReasons.valid++;
                    filtered.push(msg);
                    continue;
                }

                // Exclude regular bot messages (but not webhook test messages)
                if (msg.author.bot) {
                    reason = 'botMessage';
                    filterReasons.botMessage++;
                    console.log(`  ❌ [BOT] @${msg.author.username}: "${msg.content.substring(0, 50)}"`);
                    continue;
                }

                // Exclude commands (starting with &)
                if (msg.content.startsWith('&')) {
                    reason = 'commandMessage';
                    filterReasons.commandMessage++;
                    console.log(`  ❌ [CMD] @${msg.author.username}: "${msg.content.substring(0, 50)}"`);
                    continue;
                }

                // Exclude system messages
                if (msg.system) {
                    reason = 'systemMessage';
                    filterReasons.systemMessage++;
                    console.log(`  ❌ [SYS] System message`);
                    continue;
                }

                // Exclude empty messages
                if (!msg.content && msg.embeds.length === 0) {
                    reason = 'emptyMessage';
                    filterReasons.emptyMessage++;
                    console.log(`  ❌ [EMPTY] No content or embeds`);
                    continue;
                }


                // Valid message
                filterReasons.valid++;
                console.log(`  ✅ [VALID] @${msg.author.username}: "${msg.content.substring(0, 50)}"`);
                filtered.push(msg);
            }

            console.log(`[ConversationCollector] Filter Summary:
  - Total: ${msgArray.length}
  - Valid messages (including [TEST] load tests): ${filterReasons.valid}
  - Bot messages (excluded): ${filterReasons.botMessage}
  - Commands (excluded): ${filterReasons.commandMessage}
  - System messages (excluded): ${filterReasons.systemMessage}
  - Empty messages (excluded): ${filterReasons.emptyMessage}`);

            // Format valid messages
            const formatted = filtered.map(msg => ({
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

            console.log(`[ConversationCollector] Formatted ${formatted.length} messages for LLM`);
            return formatted;
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
