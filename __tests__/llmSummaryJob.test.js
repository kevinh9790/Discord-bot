// __tests__/llmSummaryJob.test.js

jest.mock('../utils/logger', () => jest.fn().mockResolvedValue());

const { runDailyScan } = require('../jobs/llmSummaryJob');

function makeClient(overrides = {}) {
    return {
        llmSummaryManager: {
            performDailyScan: jest.fn().mockResolvedValue(),
            ...overrides,
        },
        channels: { fetch: jest.fn() },
    };
}

describe('runDailyScan', () => {
    it('calls performDailyScan and resolves without throwing', async () => {
        const client = makeClient();
        await expect(runDailyScan(client)).resolves.toBeUndefined();
        expect(client.llmSummaryManager.performDailyScan).toHaveBeenCalledWith(client);
    });

    it('catches errors from performDailyScan and does not rethrow', async () => {
        const client = makeClient({
            performDailyScan: jest.fn().mockRejectedValue(new Error('scan failed')),
        });
        await expect(runDailyScan(client)).resolves.toBeUndefined();
    });
});
