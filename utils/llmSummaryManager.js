// utils/llmSummaryManager.js
/**
 * LLM Summary Manager - Orchestrates the discussion summarization workflow
 * Detects gamedev discussions, performs relevance check, and generates summaries
 */

const crypto = require('crypto');
const config = require('../config/config.js');
const conversationCollector = require('./conversationCollector.js');
const llmService = require('./llmService.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Category color mapping
const CATEGORY_COLORS = {
    technics: 0x3498DB,  // Blue
    art: 0xE74C3C,       // Red
    design: 0x9B59B6,    // Purple
    news: 0xF39C12,      // Orange
    resource: 0x27AE60,  // Green
    other: 0x95A5A6      // Gray
};

const DEFAULT_STATE = {
    pendingSummaries: {},
    rateLimits: {
        hourlyRequests: {},
        channelCooldowns: {}
    },
    summarizedTopicFingerprints: [],
    lastCleanup: 0
};

function createLlmSummaryManager(storage) {
    // Initialize state from storage, merging with defaults
    const saved = storage.load();
    let state = { ...DEFAULT_STATE, ...(saved || {}) };
    if (!state.summarizedTopicFingerprints) state.summarizedTopicFingerprints = [];
    if (!state.rateLimits) state.rateLimits = { hourlyRequests: {}, channelCooldowns: {} };
    if (saved) {
        console.log('[LLMSummaryManager] State loaded');
    }

    function saveState() {
        storage.save(state);
    }

    function generateId() {
        return Math.random().toString(36).substring(2, 11);
    }

    function generateFingerprint(messageIds) {
        const sortedIds = [...messageIds].sort();
        return crypto.createHash('md5').update(sortedIds.join(',')).digest('hex');
    }

    function getCategoryLabel(category) {
        const labels = {
            technics: '🔧 技術',
            art: '🎨 美術',
            design: '🎮 設計',
            news: '📰 新聞',
            resource: '📚 資源',
            other: '❓ 其他'
        };
        return labels[category] || '❓ 其他';
    }

    function checkRateLimit(channelId) {
        const llmConfig = config.LLM_SUMMARY || {};
        const now = Date.now();

        const lastCheck = state.rateLimits.channelCooldowns[channelId];
        if (lastCheck && now - lastCheck < llmConfig.rateLimits.cooldownBetweenChecks) {
            return false;
        }

        const currentHour = Math.floor(now / (60 * 60 * 1000));
        const hourKey = currentHour.toString();

        if (!state.rateLimits.hourlyRequests[hourKey]) {
            state.rateLimits.hourlyRequests[hourKey] = 0;
        }

        if (state.rateLimits.hourlyRequests[hourKey] >= llmConfig.rateLimits.maxRequestsPerHour) {
            return false;
        }

        state.rateLimits.hourlyRequests[hourKey]++;
        state.rateLimits.channelCooldowns[channelId] = now;
        saveState();

        return true;
    }

    async function sendAdminNotification(summaryId, channel, client, relevanceResult, stats, topicName = null) {
        try {
            const llmConfig = config.LLM_SUMMARY || {};
            const adminChannel = client.channels.cache.get(llmConfig.channels.adminApproval);

            if (!adminChannel) {
                console.warn('[LLMSummaryManager] Admin approval channel not found');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(topicName ? `🔍 偵測到討論主題: ${topicName}` : '🔍 偵測到可能相關的遊戲開發討論')
                .setColor(CATEGORY_COLORS[relevanceResult.category] || 0x3498DB)
                .addFields(
                    { name: '頻道', value: `<#${channel.id}>`, inline: true },
                    { name: '訊息數', value: stats.totalMessages.toString(), inline: true },
                    { name: '參與人數', value: stats.uniqueAuthors.toString(), inline: true },
                    { name: '分類', value: getCategoryLabel(relevanceResult.category), inline: true },
                    { name: '相關度', value: `${(relevanceResult.confidence * 100).toFixed(0)}%`, inline: true },
                    { name: '原因', value: relevanceResult.reason || '無', inline: true },
                    {
                        name: '預估成本',
                        value: `${relevanceResult.tokenCount} tokens (~$${(relevanceResult.tokenCount / 1000000 * 0.35).toFixed(6)})${llmConfig.dryRun ? ' (Dry Run)' : ''}`,
                        inline: true
                    },
                )
                .setFooter({ text: `ID: ${summaryId}` })
                .setTimestamp();

            const pendingSummary = state.pendingSummaries[summaryId];
            const previewMessages = (pendingSummary?.messages || []).slice(-3);
            const preview = conversationCollector.formatForLLM(previewMessages);
            if (preview.length > 1024) {
                embed.addFields({
                    name: '對話預覽',
                    value: preview.substring(0, 1021) + '...'
                });
            } else {
                embed.addFields({ name: '對話預覽', value: preview || '(無)' });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`summary_approve_${summaryId}`)
                        .setLabel('生成完整摘要')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`summary_reject_${summaryId}`)
                        .setLabel('忽略')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

            await adminChannel.send({ embeds: [embed], components: [row] });
            console.log(`[LLMSummaryManager] Admin notification sent: ${summaryId}`);
        } catch (error) {
            console.error('[LLMSummaryManager] Failed to send admin notification:', error);
        }
    }

    async function postSummary(channel, summary) {
        try {
            const fullSummary = summary.fullSummary;
            const relevanceResult = summary.relevanceResult;

            const embed = new EmbedBuilder()
                .setTitle(`📝 ${fullSummary.title}${summary.topicName ? ` (${summary.topicName})` : ''}`)
                .setColor(CATEGORY_COLORS[relevanceResult.category] || 0x3498DB)
                .addFields(
                    { name: '摘要', value: fullSummary.summary || '(無)' },
                    {
                        name: '重點',
                        value: fullSummary.keyPoints.length > 0
                            ? fullSummary.keyPoints.join('\n')
                            : '(無)'
                    },
                    {
                        name: '參與者',
                        value: fullSummary.participants.length > 0
                            ? fullSummary.participants.join(', ')
                            : '(無)'
                    }
                );

            if (fullSummary.resources.length > 0) {
                embed.addFields({
                    name: '資源連結',
                    value: fullSummary.resources.join('\n')
                });
            }

            if (fullSummary.actionItems.length > 0) {
                embed.addFields({
                    name: '待辦事項',
                    value: fullSummary.actionItems.join('\n')
                });
            }

            embed
                .addFields({
                    name: '原始頻道',
                    value: `<#${summary.channelId}>`,
                    inline: true
                })
                .addFields({
                    name: '分類',
                    value: getCategoryLabel(relevanceResult.category),
                    inline: true
                })
                .setFooter({
                    text: `相關度: ${(relevanceResult.confidence * 100).toFixed(0)}% | 成本: ${fullSummary.tokenCount} tokens (~$${(fullSummary.tokenCount / 1000000 * 0.35).toFixed(6)})${config.LLM_SUMMARY.dryRun ? ' (Dry Run)' : ''}`
                })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`[LLMSummaryManager] Summary posted: ${summary.id}`);
        } catch (error) {
            console.error('[LLMSummaryManager] Failed to post summary:', error);
        }
    }

    // Clean up expired summaries every hour
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const llmConfig = config.LLM_SUMMARY || {};
        const timeout = llmConfig.timeouts?.adminApprovalTimeout || 24 * 60 * 60 * 1000;

        for (const [id, summary] of Object.entries(state.pendingSummaries)) {
            if (now - summary.createdAt > timeout) {
                delete state.pendingSummaries[id];
            }
        }

        for (const hour of Object.keys(state.rateLimits.hourlyRequests)) {
            if (parseInt(hour) < now - 60 * 60 * 1000) {
                delete state.rateLimits.hourlyRequests[hour];
            }
        }

        state.lastCleanup = now;
        saveState();
    }, 60 * 60 * 1000);

    if (cleanupInterval.unref) {
        cleanupInterval.unref();
    }

    return {
        /**
         * 每日回顧掃描所有白名單頻道
         */
        async performDailyScan(client) {
            try {
                console.log(`\n[LLMSummaryManager] ========== STARTING DAILY RETROSPECTIVE SCAN ==========`);
                const llmConfig = config.LLM_SUMMARY || {};
                if (!llmConfig.enabled) return;

                const whitelist = llmConfig.channels.whitelist;
                const maturationMs = (llmConfig.filters.maturationDays || 3) * 24 * 60 * 60 * 1000;
                const scanDays = llmConfig.filters.scanLimitDays || 7;

                const now = new Date();
                now.setMinutes(0, 0, 0);
                const stableNow = now.getTime();
                const maturationPoint = stableNow - maturationMs;

                for (const channelId of whitelist) {
                    const channel = client.channels.cache.get(channelId);
                    if (!channel) continue;

                    console.log(`[LLMSummaryManager] Scanning #${channel.name}...`);

                    const messages = await conversationCollector.collectMessagesInTimeWindow(channel, scanDays);
                    if (messages.length < llmConfig.filters.minMessages) continue;

                    console.log(`[LLMSummaryManager] Discovering topics in #${channel.name} (${messages.length} messages)...`);
                    const clusters = await llmService.discoverTopics(messages);

                    for (const cluster of clusters) {
                        if (!cluster.isRelevant || cluster.confidence < llmConfig.filters.relevanceThreshold) continue;

                        const clusterMsgs = messages.filter(m => cluster.messageIds.includes(m.id));

                        const mainPart = clusterMsgs.filter(m => m.timestamp < maturationPoint);

                        if (mainPart.length < llmConfig.filters.minMessages) {
                            console.log(`[LLMSummaryManager] Topic "${cluster.topic}" too young or small (main part: ${mainPart.length})`);
                            continue;
                        }

                        const sortedClusterIds = [...cluster.messageIds].sort();
                        const anchorIds = sortedClusterIds.slice(0, 5);
                        const fingerprint = generateFingerprint(anchorIds);

                        if (state.summarizedTopicFingerprints.includes(fingerprint)) {
                            console.log(`[LLMSummaryManager] Topic "${cluster.topic}" already summarized (anchor fingerprint match)`);
                            continue;
                        }

                        console.log(`[LLMSummaryManager] ✅ Topic "${cluster.topic}" ready for summary!`);

                        const summaryId = generateId();
                        const stats = conversationCollector.getStatistics(clusterMsgs);

                        state.pendingSummaries[summaryId] = {
                            id: summaryId,
                            channelId: channel.id,
                            channelName: channel.name,
                            topicName: cluster.topic,
                            createdAt: Date.now(),
                            messages: clusterMsgs,
                            stats: stats,
                            relevanceResult: {
                                isRelevant: true,
                                category: cluster.category,
                                confidence: cluster.confidence,
                                reason: cluster.reason
                            },
                            status: 'pending_approval',
                            fingerprint: fingerprint
                        };

                        await sendAdminNotification(summaryId, channel, client, state.pendingSummaries[summaryId].relevanceResult, stats, cluster.topic);
                    }
                }

                saveState();
                console.log(`[LLMSummaryManager] ========== DAILY SCAN COMPLETE ==========\n`);
            } catch (error) {
                console.error('[LLMSummaryManager] Daily scan failed:', error);
            }
        },

        /**
         * Hook called when activeChatManager detects a hot channel
         */
        async handleHotChannel(channel, client) {
            try {
                if (!channel || !client) return;

                console.log(`\n[LLMSummaryManager] ========== HOT CHANNEL DETECTED ==========`);
                console.log(`[LLMSummaryManager] Channel: #${channel.name} (ID: ${channel.id})`);

                const llmConfig = config.LLM_SUMMARY || {};

                if (!llmConfig.enabled) {
                    console.log(`[LLMSummaryManager] ❌ LLM Summary not enabled`);
                    return;
                }

                console.log(`[LLMSummaryManager] ✅ LLM Summary enabled`);

                if (llmConfig.channels.whitelist.length > 0 &&
                    !llmConfig.channels.whitelist.includes(channel.id)) {
                    console.log(`[LLMSummaryManager] ❌ Channel not in whitelist`);
                    return;
                }

                console.log(`[LLMSummaryManager] ✅ Channel whitelist check passed`);
                console.log(`[LLMSummaryManager] Processing hot channel: ${channel.name}`);

                const messages = await conversationCollector.collectMessages(
                    channel,
                    llmConfig.filters.lookbackWindow
                );

                console.log(`[LLMSummaryManager] Collected ${messages.length} valid messages, min required: ${llmConfig.filters.minMessages}`);

                if (messages.length < llmConfig.filters.minMessages) {
                    console.log(`[LLMSummaryManager] ❌ Not enough messages (${messages.length}/${llmConfig.filters.minMessages})`);
                    return;
                }

                console.log(`[LLMSummaryManager] ✅ Sufficient messages collected`);
                console.log(`[LLMSummaryManager] Starting relevance check...`);
                const relevanceResult = await llmService.quickRelevanceCheck(messages);

                console.log(`[LLMSummaryManager] Relevance Result:
  - isRelevant: ${relevanceResult.isRelevant}
  - category: ${relevanceResult.category}
  - confidence: ${relevanceResult.confidence}
  - threshold: ${llmConfig.filters.relevanceThreshold}
  - reason: ${relevanceResult.reason}`);

                if (!relevanceResult.isRelevant ||
                    relevanceResult.confidence < llmConfig.filters.relevanceThreshold) {
                    console.log(`[LLMSummaryManager] ❌ Not relevant (confidence: ${relevanceResult.confidence})`);
                    return;
                }

                console.log(`[LLMSummaryManager] ✅ Relevance check passed`);

                const summaryId = generateId();
                const stats = conversationCollector.getStatistics(messages);

                console.log(`[LLMSummaryManager] Creating summary entry: ${summaryId}`);

                state.pendingSummaries[summaryId] = {
                    id: summaryId,
                    channelId: channel.id,
                    channelName: channel.name,
                    createdAt: Date.now(),
                    messages: messages,
                    stats: stats,
                    relevanceResult: relevanceResult,
                    status: 'pending_approval'
                };

                saveState();

                console.log(`[LLMSummaryManager] ✅ Summary entry created and saved`);
                console.log(`[LLMSummaryManager] Sending admin notification...`);

                await sendAdminNotification(summaryId, channel, client, relevanceResult, stats);
                console.log(`[LLMSummaryManager] ========== HOT CHANNEL PROCESSING COMPLETE ==========\n`);
            } catch (error) {
                console.error('[LLMSummaryManager] Error in handleHotChannel:', error);
                console.log(`[LLMSummaryManager] ========== HOT CHANNEL PROCESSING FAILED ==========\n`);
            }
        },

        /**
         * Generate full summary when admin approves
         */
        async generateFullSummary(summaryId, client) {
            try {
                const summary = state.pendingSummaries[summaryId];
                if (!summary) {
                    console.error(`[LLMSummaryManager] Summary not found: ${summaryId}`);
                    return;
                }

                const llmConfig = config.LLM_SUMMARY || {};

                const fullSummary = await llmService.generateSummary(summary.messages);

                summary.status = 'completed';
                summary.fullSummary = fullSummary;
                summary.completedAt = Date.now();
                saveState();

                state.summarizedTopicFingerprints.push(summary.fingerprint);
                if (state.summarizedTopicFingerprints.length > 1000) {
                    state.summarizedTopicFingerprints.shift();
                }
                saveState();

                const summaryChannel = client.channels.cache.get(llmConfig.channels.summary);
                if (summaryChannel) {
                    await postSummary(summaryChannel, summary);
                }

                delete state.pendingSummaries[summaryId];
                saveState();

            } catch (error) {
                console.error('[LLMSummaryManager] Error generating summary:', error);

                const summary = state.pendingSummaries[summaryId];
                if (summary) {
                    summary.status = 'error';
                    summary.error = error.message;
                    saveState();
                }
            }
        },

        /**
         * Reject a pending summary
         */
        async rejectSummary(summaryId) {
            try {
                const summary = state.pendingSummaries[summaryId];
                if (!summary) {
                    console.error(`[LLMSummaryManager] Summary not found: ${summaryId}`);
                    return;
                }

                summary.status = 'rejected';
                summary.rejectedAt = Date.now();
                saveState();

                console.log(`[LLMSummaryManager] Summary rejected: ${summaryId}`);

                setTimeout(() => {
                    delete state.pendingSummaries[summaryId];
                    saveState();
                }, 60000);
            } catch (error) {
                console.error('[LLMSummaryManager] Error rejecting summary:', error);
            }
        },

        /**
         * Get pending summary by ID
         */
        getPendingSummary(summaryId) {
            return state.pendingSummaries[summaryId] || null;
        },

        /**
         * @private
         */
        _checkRateLimit: checkRateLimit,

        /**
         * @private
         */
        _generateId: generateId,

        /**
         * @private
         */
        _generateFingerprint: generateFingerprint,

        /**
         * @private
         */
        _getCategoryLabel: getCategoryLabel,

        /**
         * Clean up resources (for testing / standalone scripts)
         */
        _cleanup() {
            clearInterval(cleanupInterval);
        }
    };
}

module.exports = { createLlmSummaryManager };
