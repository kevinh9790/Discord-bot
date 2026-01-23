// utils/providers/geminiProvider.js
/**
 * Gemini LLM Provider - Uses Google's Generative AI API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.client = new GoogleGenerativeAI(apiKey);
        this.name = 'gemini';
        this.retryAttempts = 3;
        this.retryDelay = 1000; // ms
    }

    /**
     * Send message to Gemini and get response
     * @param {string} systemPrompt - System instruction for the model
     * @param {string} userMessage - User message/question
     * @param {Object} options - Configuration options
     * @returns {Promise<string>} Model response text
     */
    async chat(systemPrompt, userMessage, options = {}) {
        const model = options.model || 'gemini-1.5-flash';
        const timeout = options.timeout || 30000;

        try {
            const generativeModel = this.client.getGenerativeModel({
                model: model,
                systemInstruction: systemPrompt,
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 2048,
                    responseMimeType: 'text/plain'
                }
            });

            // Execute with timeout
            const response = await Promise.race([
                generativeModel.generateContent(userMessage),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('LLM request timeout')), timeout)
                )
            ]);

            const text = response.response.text();
            return text;
        } catch (error) {
            // Handle specific Gemini errors
            if (error.message.includes('429')) {
                // Rate limited - use exponential backoff
                return this._retryWithBackoff(systemPrompt, userMessage, options, 0);
            }

            console.error(`[GeminiProvider] Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retry with exponential backoff for rate limits
     * @private
     */
    async _retryWithBackoff(systemPrompt, userMessage, options, attempt) {
        if (attempt >= this.retryAttempts) {
            throw new Error(`Max retries (${this.retryAttempts}) exceeded for rate limit`);
        }

        const delayMs = this.retryDelay * Math.pow(2, attempt);
        console.log(`[GeminiProvider] Rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1})`);

        await new Promise(resolve => setTimeout(resolve, delayMs));

        try {
            return await this.chat(systemPrompt, userMessage, options);
        } catch (error) {
            if (error.message.includes('429') || error.message.includes('too many')) {
                return this._retryWithBackoff(systemPrompt, userMessage, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Get provider name
     * @returns {string} Provider name
     */
    getName() {
        return this.name;
    }

    /**
     * Test API key validity
     * @returns {Promise<boolean>} True if API key is valid
     */
    async testConnection() {
        try {
            const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
            await model.generateContent('test');
            return true;
        } catch (error) {
            console.error('[GeminiProvider] Connection test failed:', error);
            return false;
        }
    }
}

module.exports = GeminiProvider;
