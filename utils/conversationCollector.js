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
            // Fetch messages from channel
            const messages = await channel.messages.fetch({ limit: lookbackWindow });

            if (messages.size === 0) {
                return [];
            }

            // Convert to array and reverse to get chronological order
            const msgArray = Array.from(messages.values()).reverse();

            // Filter and format messages
            const formatted = msgArray
                .filter(msg => {
                    // Exclude bot messages
                    if (msg.author.bot) return false;

                    // Exclude commands (starting with &)
                    if (msg.content.startsWith('&')) return false;

                    // Exclude system messages
                    if (msg.system) return false;

                    // Exclude empty messages
                    if (!msg.content && msg.embeds.length === 0) return false;

                    return true;
                })
                .map(msg => ({
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
        return messages
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

        return {
            totalMessages: messages.length,
            uniqueAuthors: uniqueAuthors.size,
            totalWords,
            messagesWithAttachments: hasAttachments,
            timespan: messages.length > 0 ? {
                start: new Date(messages[0].timestamp),
                end: new Date(messages[messages.length - 1].timestamp)
            } : null
        };
    }
};
