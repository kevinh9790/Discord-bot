// utils/providers/claudeProvider.js
/**
 * Anthropic Claude LLM Provider - Uses Anthropic's API
 * Future implementation placeholder
 */

class ClaudeProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.name = 'claude';
        throw new Error('Claude provider not yet implemented. Please use Gemini provider.');
    }

    async chat(systemPrompt, userMessage, options = {}) {
        throw new Error('Claude provider not yet implemented');
    }

    getName() {
        return this.name;
    }

    async testConnection() {
        throw new Error('Claude provider not yet implemented');
    }
}

module.exports = ClaudeProvider;
