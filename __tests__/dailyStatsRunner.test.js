// __tests__/dailyStatsRunner.test.js

jest.mock('../utils/logger', () => jest.fn().mockResolvedValue());
jest.mock('../config/config.js', () => ({
    CHANNELS: {
        STATS_LOG: 'stats-log-ch',
        LEADERBOARD: 'leaderboard-ch',
    },
}));

const { runDailyStats } = require('../utils/dailyStatsRunner');

function makeSend() {
    return jest.fn().mockResolvedValue({});
}

function makeClient(overrides = {}) {
    const send = makeSend();
    const mockChannel = { send };

    return {
        channels: {
            fetch: jest.fn().mockResolvedValue(mockChannel),
            cache: { get: jest.fn().mockReturnValue(null) },
        },
        dailyStats: {
            channels: {},
            mostReacted: { count: 0, url: null, content: '', author: '', authorId: null },
            voiceState: new Map(),
        },
        _mockChannel: mockChannel,
        ...overrides,
    };
}

describe('runDailyStats', () => {
    it('resolves without throwing with empty stats', async () => {
        const client = makeClient();
        await expect(runDailyStats(client)).resolves.toBeUndefined();
    });

    it('resets client.dailyStats.channels after a run', async () => {
        const client = makeClient();
        client.dailyStats.channels = {
            'ch1': { msgCount: 5, msgPoints: 2, voiceMs: 0, voicePoints: 0, maxUsers: 0 },
        };
        await runDailyStats(client);
        // No active voice users, so channels should be empty after reset
        expect(client.dailyStats.channels).toEqual({});
    });

    it('resets mostReacted after a run', async () => {
        const client = makeClient();
        client.dailyStats.mostReacted = { count: 3, url: 'http://x', content: 'hi', author: 'u', authorId: '123' };
        await runDailyStats(client);
        expect(client.dailyStats.mostReacted).toEqual({
            count: 0, url: null, content: '', author: '', authorId: null,
        });
    });

    it('handles missing client.dailyStats gracefully', async () => {
        const client = makeClient();
        client.dailyStats = null;
        await expect(runDailyStats(client)).resolves.toBeUndefined();
        // Should have re-initialized dailyStats
        expect(client.dailyStats).toBeDefined();
    });
});
