// __tests__/llmDailySummaryRunner.test.js

jest.mock('../utils/llmService');
jest.mock('../utils/conversationCollector.js');
jest.mock('../config/config.js', () => ({
    LLM_SUMMARY: {
        dailyUnconditional: {
            enabled: true,
            cron: '0 0 5 * * *',
            minMessages: 3,
            channels: ['channel-1', 'channel-2'],
        },
        channels: {
            summary: 'summary-channel-id',
        },
        dryRun: false,
    },
}));

const llmService = require('../utils/llmService');
const conversationCollector = require('../utils/conversationCollector.js');
const { runDailyUnconditionalScan } = require('../utils/llmDailySummaryRunner');

describe('runDailyUnconditionalScan', () => {
    let mockClient;
    let mockSummaryChannel;
    let mockChannel1;
    let mockChannel2;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSummaryChannel = {
            send: jest.fn().mockResolvedValue({}),
        };

        mockChannel1 = {
            id: 'channel-1',
            name: 'general',
        };

        mockChannel2 = {
            id: 'channel-2',
            name: 'dev',
        };

        mockClient = {
            channels: {
                cache: {
                    get: jest.fn((id) => {
                        if (id === 'summary-channel-id') return mockSummaryChannel;
                        if (id === 'channel-1') return mockChannel1;
                        if (id === 'channel-2') return mockChannel2;
                        return null;
                    }),
                },
            },
        };
    });

    it('should do nothing if daily unconditional scan is disabled', async () => {
        const config = require('../config/config.js');
        const originalEnabled = config.LLM_SUMMARY.dailyUnconditional.enabled;
        config.LLM_SUMMARY.dailyUnconditional.enabled = false;

        await runDailyUnconditionalScan(mockClient);

        expect(conversationCollector.collectMessagesInTimeWindow).not.toHaveBeenCalled();
        
        config.LLM_SUMMARY.dailyUnconditional.enabled = originalEnabled;
    });

    it('should skip channels with messages below minMessages threshold', async () => {
        conversationCollector.collectMessagesInTimeWindow.mockResolvedValue([
            { id: '1', content: 'hello' } // 1 message < minMessages (3)
        ]);

        await runDailyUnconditionalScan(mockClient);

        expect(llmService.generateSummary).not.toHaveBeenCalled();
        expect(mockSummaryChannel.send).not.toHaveBeenCalled();
    });

    it('should generate summary and post digest for channels that meet threshold', async () => {
        const mockMessages = [
            { id: '1', content: 'hello' },
            { id: '2', content: 'world' },
            { id: '3', content: 'test' },
        ];
        conversationCollector.collectMessagesInTimeWindow.mockResolvedValue(mockMessages);
        
        const mockDigest = {
            title: 'Daily digest title',
            summary: 'Daily digest summary',
            keyPoints: ['point 1', 'point 2'],
            participants: ['user1', 'user2'],
            resources: ['http://resource'],
            actionItems: ['action 1'],
            tokenCount: 1500,
        };
        llmService.generateSummary.mockResolvedValue(mockDigest);

        const mockStats = {
            totalMessages: 3,
            uniqueAuthors: 2,
        };
        conversationCollector.getStatistics.mockReturnValue(mockStats);

        await runDailyUnconditionalScan(mockClient);

        expect(conversationCollector.collectMessagesInTimeWindow).toHaveBeenCalledWith(mockChannel1, 1);
        expect(conversationCollector.collectMessagesInTimeWindow).toHaveBeenCalledWith(mockChannel2, 1);
        expect(llmService.generateSummary).toHaveBeenCalledTimes(2);
        expect(llmService.generateSummary).toHaveBeenCalledWith(mockMessages, { promptType: 'daily' });
        expect(mockSummaryChannel.send).toHaveBeenCalledTimes(2);

        // Check if EmbedBuilder parameters are used (by inspecting mock call args)
        const sendCall = mockSummaryChannel.send.mock.calls[0][0];
        expect(sendCall.embeds).toBeDefined();
        expect(sendCall.embeds[0].data.title).toContain('Daily digest title');
    });
});
