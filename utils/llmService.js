// utils/llmService.js
/**
 * LLM Service - Abstraction layer for different LLM providers
 * Supports Gemini (primary), OpenAI, and Claude (future)
 */

const config = require('../config/config.js');
const GeminiProvider = require('./providers/geminiProvider.js');

let currentProvider = null;

/**
 * Initialize LLM service with specified provider
 * @param {string} providerName - Provider name: 'gemini', 'openai', 'claude'
 * @returns {boolean} True if initialization successful
 */
function initialize(providerName = 'gemini') {
    try {
        const llmConfig = config.LLM_SUMMARY || {};

        if (!llmConfig.enabled) {
            console.warn('[LLMService] LLM Summary feature is disabled in config');
            return false;
        }

        const provider = providerName || llmConfig.provider || 'gemini';
        const apiKey = llmConfig.apiKeys[provider];

        if (!apiKey) {
            console.error(`[LLMService] No API key found for provider: ${provider}`);
            return false;
        }

        // Factory pattern to create provider instances
        currentProvider = createProvider(provider, apiKey);

        if (!currentProvider) {
            console.error(`[LLMService] Failed to create provider: ${provider}`);
            return false;
        }

        console.log(`[LLMService] Initialized with provider: ${provider}`);
        return true;
    } catch (error) {
        console.error('[LLMService] Initialization failed:', error);
        return false;
    }
}

/**
 * Create a provider instance based on provider name
 * @private
 * @param {string} providerName - Provider name
 * @param {string} apiKey - API key for provider
 * @returns {Object} Provider instance or null
 */
function createProvider(providerName, apiKey) {
    switch (providerName.toLowerCase()) {
        case 'gemini':
            return new GeminiProvider(apiKey);
        case 'openai':
            // Future: return new OpenAIProvider(apiKey);
            console.warn('[LLMService] OpenAI provider not yet implemented');
            return null;
        case 'claude':
            // Future: return new ClaudeProvider(apiKey);
            console.warn('[LLMService] Claude provider not yet implemented');
            return null;
        default:
            console.error(`[LLMService] Unknown provider: ${providerName}`);
            return null;
    }
}

/**
 * Perform quick relevance check on a conversation
 * @param {Array} messages - Formatted messages array
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Result with {isRelevant, confidence, category, reason}
 */
async function quickRelevanceCheck(messages, options = {}) {
    try {
        if (!currentProvider) {
            if (!initialize()) {
                throw new Error('LLM provider not initialized');
            }
        }

        const llmConfig = config.LLM_SUMMARY || {};
        const formattedMessages = require('./conversationCollector.js').formatForLLM(messages);

        // Read relevance check prompt
        const fs = require('fs');
        const path = require('path');
        const promptPath = path.join(__dirname, '../config/prompts/relevanceCheck.txt');
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');

        const userMessage = `以下是一段討論對話，請判斷是否與遊戲開發相關：\n\n${formattedMessages}\n\n訊息數量: ${messages.length}\n參與者: ${require('./conversationCollector.js').getUniqueAuthorsCount(messages)}人`;

        const response = await currentProvider.chat(
            systemPrompt,
            userMessage,
            {
                model: llmConfig.models?.relevanceCheck || 'gemini-1.5-flash',
                timeout: llmConfig.timeouts?.llmRequestTimeout || 30000
            }
        );

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[LLMService] Failed to extract JSON from relevance response');
            return {
                isRelevant: false,
                confidence: 0,
                category: 'other',
                reason: '無法解析LLM回應'
            };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            isRelevant: result.isRelevant || false,
            confidence: result.confidence || 0,
            category: result.category || 'other',
            reason: result.reason || ''
        };
    } catch (error) {
        console.error('[LLMService] Relevance check failed:', error);
        return {
            isRelevant: false,
            confidence: 0,
            category: 'error',
            reason: `錯誤: ${error.message}`
        };
    }
}

/**
 * Generate comprehensive summary of conversation
 * @param {Array} messages - Formatted messages array
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Summary with {title, summary, keyPoints, participants, resources, actionItems}
 */
async function generateSummary(messages, options = {}) {
    try {
        if (!currentProvider) {
            if (!initialize()) {
                throw new Error('LLM provider not initialized');
            }
        }

        const llmConfig = config.LLM_SUMMARY || {};
        const formattedMessages = require('./conversationCollector.js').formatForLLM(messages);
        const stats = require('./conversationCollector.js').getStatistics(messages);

        // Read comprehensive summary prompt
        const fs = require('fs');
        const path = require('path');
        const promptPath = path.join(__dirname, '../config/prompts/comprehensiveSummary.txt');
        const systemPrompt = fs.readFileSync(promptPath, 'utf8');

        const userMessage = `請為以下討論對話生成完整摘要：\n\n${formattedMessages}\n\n對話統計:\n- 訊息數: ${messages.length}\n- 參與者: ${stats.uniqueAuthors}人\n- 總字數: ${stats.totalWords}`;

        const response = await currentProvider.chat(
            systemPrompt,
            userMessage,
            {
                model: llmConfig.models?.fullSummary || 'gemini-1.5-pro',
                timeout: llmConfig.timeouts?.llmRequestTimeout || 30000
            }
        );

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[LLMService] Failed to extract JSON from summary response');
            return {
                title: '摘要生成失敗',
                summary: '無法從LLM獲取回應',
                keyPoints: [],
                participants: [],
                resources: [],
                actionItems: []
            };
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            title: result.title || '未命名',
            summary: result.summary || '',
            keyPoints: result.keyPoints || [],
            participants: result.participants || [],
            resources: result.resources || [],
            actionItems: result.actionItems || []
        };
    } catch (error) {
        console.error('[LLMService] Summary generation failed:', error);
        return {
            title: '摘要生成失敗',
            summary: `錯誤: ${error.message}`,
            keyPoints: [],
            participants: [],
            resources: [],
            actionItems: []
        };
    }
}

/**
 * Get current provider info
 * @returns {string} Provider name or 'not_initialized'
 */
function getProviderInfo() {
    return currentProvider ? currentProvider.getName() : 'not_initialized';
}

module.exports = {
    initialize,
    quickRelevanceCheck,
    generateSummary,
    getProviderInfo
};
