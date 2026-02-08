// __tests__/llmDryRun.test.js
const llmService = require('../utils/llmService.js');
const GeminiProvider = require('../utils/providers/geminiProvider.js');
const config = require('../config/config.js');

// Mock dependencies
jest.mock('../utils/providers/geminiProvider.js');
jest.mock('../utils/conversationCollector.js', () => ({
    formatForLLM: () => 'Mock formatted messages',
    getUniqueAuthorsCount: () => 2,
    getStatistics: () => ({ uniqueAuthors: 2, totalWords: 100 })
}));
jest.mock('fs', () => ({
    readFileSync: () => 'Mock System Prompt'
}));

describe('LLM Service - Dry Run & Token Counting', () => {
    let mockCountTokens;
    let mockChat;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup Config for Dry Run
        config.LLM_SUMMARY = {
            enabled: true,
            provider: 'gemini',
            apiKeys: { gemini: 'dummy_key' },
            dryRun: true,
            models: { relevanceCheck: 'gemini-test', fullSummary: 'gemini-test' },
            timeouts: { llmRequestTimeout: 1000 }
        };

        // Setup Provider Mock
        mockCountTokens = jest.fn().mockResolvedValue(1234);
        mockChat = jest.fn().mockResolvedValue('{"isRelevant": true}');

        GeminiProvider.mockImplementation(() => {
            return {
                getName: () => 'gemini',
                countTokens: mockCountTokens,
                chat: mockChat
            };
        });

        // Re-initialize service
        llmService.initialize();
    });

    test('Relevance Check should count tokens and skip chat in Dry Run', async () => {
        const result = await llmService.quickRelevanceCheck([{ content: 'test' }]);

        // Check if countTokens was called
        expect(mockCountTokens).toHaveBeenCalledTimes(1);
        expect(mockCountTokens).toHaveBeenCalledWith(
            expect.stringContaining('Mock System Prompt'),
            expect.stringContaining('Mock formatted messages'),
            expect.any(Object)
        );

        // Check if chat was NOT called
        expect(mockChat).not.toHaveBeenCalled();

        // Check result is the mock dry run response
        expect(result.reason).toContain('Dry Run Mode');
        expect(result.isRelevant).toBe(true);
    });

    test('Summary Generation should count tokens and skip chat in Dry Run', async () => {
        const result = await llmService.generateSummary([{ content: 'test' }]);

        // Check if countTokens was called
        expect(mockCountTokens).toHaveBeenCalledTimes(1);

        // Check if chat was NOT called
        expect(mockChat).not.toHaveBeenCalled();

        // Check result is the mock dry run response
        expect(result.title).toBe('Dry Run Summary Mode');
    });

    test('Should proceed to chat if Dry Run is disabled', async () => {
        // Disable Dry Run
        config.LLM_SUMMARY.dryRun = false;

        await llmService.quickRelevanceCheck([{ content: 'test' }]);

        // Check if BOTH countTokens and chat were called
        expect(mockCountTokens).toHaveBeenCalledTimes(1);
        expect(mockChat).toHaveBeenCalledTimes(1);
    });
});