// utils/providers/openaiProvider.js
/**
 * OpenAI LLM Provider - Uses OpenAI's API
 * Future implementation placeholder
 */

class OpenAIProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.name = 'openai';
        throw new Error('OpenAI provider not yet implemented. Please use Gemini provider.');
    }

    async chat(systemPrompt, userMessage, options = {}) {
        throw new Error('OpenAI provider not yet implemented');
    }

    getName() {
        return this.name;
    }

    async testConnection() {
        throw new Error('OpenAI provider not yet implemented');
    }
}

module.exports = OpenAIProvider;
