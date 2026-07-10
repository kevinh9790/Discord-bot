const { EmbedBuilder } = require('discord.js');
const config = require('../config/config.js');
const llmService = require('./llmService');
const conversationCollector = require('./conversationCollector.js');

async function postDailyDigest(channel, originalChannel, digestData, stats) {
    try {
        const embed = new EmbedBuilder()
            .setTitle(`📅 #${originalChannel.name} 頻道日報 • ${digestData.title || '今日對話精選'}`)
            .setColor(0xF1C40F) // Gold/Yellow
            .addFields(
                { name: '📝 今日摘要', value: digestData.summary || '(無)' },
                {
                    name: '💡 討論重點',
                    value: digestData.keyPoints && digestData.keyPoints.length > 0
                        ? digestData.keyPoints.map(p => `• ${p}`).join('\n')
                        : '(無)'
                },
                {
                    name: '👥 活躍參與者',
                    value: digestData.participants && digestData.participants.length > 0
                        ? digestData.participants.join(', ')
                        : '(無)'
                }
            );

        if (digestData.resources && digestData.resources.length > 0) {
            embed.addFields({
                name: '🔗 分享資源',
                value: digestData.resources.map(r => `• ${r}`).join('\n')
            });
        }

        if (digestData.actionItems && digestData.actionItems.length > 0) {
            embed.addFields({
                name: '📋 待辦事項',
                value: digestData.actionItems.map(a => `• ${a}`).join('\n')
            });
        }

        embed
            .addFields(
                { name: '📺 頻道', value: `<#${originalChannel.id}>`, inline: true },
                { name: '💬 總訊息量', value: `${stats.totalMessages} 則`, inline: true },
                { name: '👥 參與人數', value: `${stats.uniqueAuthors} 人`, inline: true }
            )
            .setFooter({
                text: `估算成本: ${digestData.tokenCount || 0} tokens | ${config.LLM_SUMMARY.dryRun ? 'Dry Run' : 'Gemini 3.5 Flash'}`
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log(`[LLMDailySummaryRunner] Daily digest posted for #${originalChannel.name}`);
    } catch (error) {
        console.error('[LLMDailySummaryRunner] Failed to post daily digest:', error);
    }
}

/**
 * 每日無條件摘要掃描所有設定的頻道
 */
async function runDailyUnconditionalScan(client) {
    try {
        console.log(`\n[LLMDailySummaryRunner] ========== STARTING DAILY UNCONDITIONAL SCAN ==========`);
        const llmConfig = config.LLM_SUMMARY || {};
        
        if (!llmConfig.dailyUnconditional || !llmConfig.dailyUnconditional.enabled) {
            console.log(`[LLMDailySummaryRunner] Daily unconditional summary feature is disabled`);
            return;
        }

        const channelsList = llmConfig.dailyUnconditional.channels;
        const minMessages = llmConfig.dailyUnconditional.minMessages;
        
        const summaryChannel = client.channels.cache.get(llmConfig.channels.summary);
        if (!summaryChannel) {
            console.warn('[LLMDailySummaryRunner] Summary channel not found');
            return;
        }

        for (const channelId of channelsList) {
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.warn(`[LLMDailySummaryRunner] Channel ${channelId} not found in client cache`);
                continue;
            }

            console.log(`[LLMDailySummaryRunner] Scanning #${channel.name} unconditionally...`);

            // Fetch messages in the last 24 hours (1 day)
            const messages = await conversationCollector.collectMessagesInTimeWindow(channel, 1);
            console.log(`[LLMDailySummaryRunner] Fetched ${messages.length} messages from the past 24 hours`);

            if (messages.length < minMessages) {
                console.log(`[LLMDailySummaryRunner] Channel #${channel.name} has fewer than ${minMessages} messages. Skipping.`);
                continue;
            }

            console.log(`[LLMDailySummaryRunner] Generating daily unconditional digest for #${channel.name}...`);
            const digestData = await llmService.generateSummary(messages, { promptType: 'daily' });
            
            const stats = conversationCollector.getStatistics(messages);
            
            console.log(`[LLMDailySummaryRunner] Posting daily digest to summary channel...`);
            await postDailyDigest(summaryChannel, channel, digestData, stats);
        }

        console.log(`[LLMDailySummaryRunner] ========== DAILY UNCONDITIONAL SCAN COMPLETE ==========\n`);
    } catch (error) {
        console.error('[LLMDailySummaryRunner] Daily unconditional scan failed:', error);
        throw error;
    }
}

module.exports = {
    runDailyUnconditionalScan
};
