// __tests__/llmSummaryManager.integration.test.js
/**
 * Integration tests for llmSummaryManager.js
 * Tests full workflow with mocked Discord API and LLM responses
 */

// Mock setup
jest.mock('../config/config.js', () => ({
    LLM_SUMMARY: {
        enabled: true,
        provider: 'gemini',
        apiKeys: { gemini: 'test-key' },
        models: { relevanceCheck: 'gemini-1.5-flash', fullSummary: 'gemini-1.5-pro' },
        channels: {
            adminApproval: 'admin-channel',
            summary: 'summary-channel',
            whitelist: []
        },
        filters: {
            minMessages: 10,
            lookbackWindow: 100,
            relevanceThreshold: 0.7
        },
        rateLimits: {
            maxRequestsPerHour: 10,
            cooldownBetweenChecks: 30 * 60 * 1000
        },
        timeouts: {
            adminApprovalTimeout: 24 * 60 * 60 * 1000,
            llmRequestTimeout: 30 * 1000
        }
    }
}));

jest.mock('../utils/conversationCollector.js', () => ({
    collectMessages: jest.fn().mockResolvedValue([
        { authorId: '1', authorName: 'User1', content: 'Unity好用嗎？', timestamp: Date.now() - 60000 },
        { authorId: '2', authorName: 'User2', content: 'Unreal更強', timestamp: Date.now() - 30000 },
        { authorId: '1', authorName: 'User1', content: '但Unity更輕', timestamp: Date.now() }
    ]),
    getUniqueAuthorsCount: jest.fn().mockReturnValue(2),
    formatForLLM: jest.fn().mockReturnValue('[timestamp] User1: Unity好用嗎？'),
    getStatistics: jest.fn().mockReturnValue({
        totalMessages: 3,
        uniqueAuthors: 2,
        totalWords: 10,
        messagesWithAttachments: 0
    })
}));

jest.mock('../utils/llmService.js', () => ({
    quickRelevanceCheck: jest.fn().mockResolvedValue({
        isRelevant: true,
        confidence: 0.85,
        category: 'technics',
        reason: '討論遊戲引擎'
    }),
    generateSummary: jest.fn().mockResolvedValue({
        title: 'Unity vs Unreal',
        summary: '討論兩個引擎的差異',
        keyPoints: ['Unity輕量', 'Unreal強大'],
        participants: ['User1', 'User2'],
        resources: [],
        actionItems: []
    })
}));

describe('LLMSummaryManager Integration', () => {
    let llmSummaryManager;
    let mockClient;
    let mockChannel;
    let mockAdminChannel;
    let mockSummaryChannel;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mock Discord objects
        mockAdminChannel = {
            send: jest.fn().mockResolvedValue({ id: 'message-1' })
        };

        mockSummaryChannel = {
            send: jest.fn().mockResolvedValue({ id: 'message-2' })
        };

        mockChannel = {
            id: 'test-channel',
            name: 'dev-discuss',
            messages: {
                fetch: jest.fn().mockResolvedValue(new Map())
            }
        };

        mockClient = {
            channels: {
                cache: {
                    get: jest.fn((id) => {
                        if (id === 'admin-channel') return mockAdminChannel;
                        if (id === 'summary-channel') return mockSummaryChannel;
                        return null;
                    })
                }
            }
        };

        // Load fresh manager
        jest.resetModules();
        llmSummaryManager = require('../utils/llmSummaryManager.js');
    });

    describe('Hot Channel Detection', () => {
        it('should process a hot channel with relevant discussion', async () => {
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            expect(mockAdminChannel.send).toHaveBeenCalled();
            const call = mockAdminChannel.send.mock.calls[0][0];
            expect(call.embeds).toBeDefined();
            expect(call.embeds[0].title).toContain('遊戲開發討論');
        });

        it('should skip processing if feature is disabled', async () => {
            const config = require('../config/config.js');
            config.LLM_SUMMARY.enabled = false;

            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            expect(mockAdminChannel.send).not.toHaveBeenCalled();
        });

        it('should respect channel whitelist', async () => {
            const config = require('../config/config.js');
            config.LLM_SUMMARY.channels.whitelist = ['other-channel'];

            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            expect(mockAdminChannel.send).not.toHaveBeenCalled();
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce hourly request limit', async () => {
            const config = require('../config/config.js');
            config.LLM_SUMMARY.rateLimits.maxRequestsPerHour = 2;

            // First request should succeed
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);
            expect(mockAdminChannel.send).toHaveBeenCalledTimes(1);

            // Create new channels for subsequent requests
            const channel2 = { ...mockChannel, id: 'channel-2', name: 'dev2' };
            const channel3 = { ...mockChannel, id: 'channel-3', name: 'dev3' };

            // Second request should succeed
            await llmSummaryManager.handleHotChannel(channel2, mockClient);
            expect(mockAdminChannel.send).toHaveBeenCalledTimes(2);

            // Third request should fail (exceeds hourly limit)
            await llmSummaryManager.handleHotChannel(channel3, mockClient);
            expect(mockAdminChannel.send).toHaveBeenCalledTimes(2); // Not called third time
        });

        it('should enforce channel cooldown', async () => {
            const config = require('../config/config.js');
            config.LLM_SUMMARY.rateLimits.cooldownBetweenChecks = 60 * 1000; // 60 seconds

            // First request should succeed
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);
            expect(mockAdminChannel.send).toHaveBeenCalledTimes(1);

            // Second request on same channel should fail (cooldown)
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);
            expect(mockAdminChannel.send).toHaveBeenCalledTimes(1); // Not called again
        });
    });

    describe('Summary Approval Workflow', () => {
        it('should generate full summary when approved', async () => {
            // First, handle hot channel to create pending summary
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            // Get the summary ID from the notification
            const notificationCall = mockAdminChannel.send.mock.calls[0][0];
            const summaryId = notificationCall.embeds[0].footer.text.match(/ID: ([\w]+)/)[1];

            // Approve summary
            await llmSummaryManager.generateFullSummary(summaryId, mockClient);

            // Verify summary was posted
            expect(mockSummaryChannel.send).toHaveBeenCalled();
            const call = mockSummaryChannel.send.mock.calls[0][0];
            expect(call.embeds[0].title).toContain('📝');
        });

        it('should reject summary when declined', async () => {
            // Handle hot channel
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            const notificationCall = mockAdminChannel.send.mock.calls[0][0];
            const summaryId = notificationCall.embeds[0].footer.text.match(/ID: ([\w]+)/)[1];

            // Reject summary
            await llmSummaryManager.rejectSummary(summaryId);

            // Verify summary is marked as rejected
            const pending = llmSummaryManager.getPendingSummary(summaryId);
            // Should be deleted after cleanup delay
            expect(pending === null || pending.status === 'rejected').toBe(true);
        });
    });

    describe('State Persistence', () => {
        it('should save pending summaries to state', async () => {
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            const notificationCall = mockAdminChannel.send.mock.calls[0][0];
            const summaryId = notificationCall.embeds[0].footer.text.match(/ID: ([\w]+)/)[1];

            const pending = llmSummaryManager.getPendingSummary(summaryId);
            expect(pending).toBeDefined();
            expect(pending.status).toBe('pending_approval');
        });

        it('should retrieve pending summary by ID', async () => {
            await llmSummaryManager.handleHotChannel(mockChannel, mockClient);

            const notificationCall = mockAdminChannel.send.mock.calls[0][0];
            const summaryId = notificationCall.embeds[0].footer.text.match(/ID: ([\w]+)/)[1];

            const summary = llmSummaryManager.getPendingSummary(summaryId);
            expect(summary).toBeDefined();
            expect(summary.id).toBe(summaryId);
            expect(summary.channelName).toBe('dev-discuss');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing admin channel gracefully', async () => {
            mockClient.channels.cache.get = jest.fn().mockReturnValue(null);

            await expect(llmSummaryManager.handleHotChannel(mockChannel, mockClient)).resolves.not.toThrow();
        });

        it('should handle LLM errors gracefully', async () => {
            const llmService = require('../utils/llmService.js');
            llmService.quickRelevanceCheck.mockRejectedValue(new Error('LLM error'));

            await expect(llmSummaryManager.handleHotChannel(mockChannel, mockClient)).resolves.not.toThrow();
        });

        it('should return null for non-existent summary', () => {
            const summary = llmSummaryManager.getPendingSummary('non-existent');
            expect(summary).toBeNull();
        });
    });
});
