// __tests__/llmSummaryManager.integration.test.js
/**
 * Integration tests for llmSummaryManager.js
 * Tests core functionality without full Discord mocking complexity
 */

describe('LLMSummaryManager Integration', () => {
    let llmSummaryManager;

    beforeEach(() => {
        // Reset modules before each test
        jest.resetModules();
        // Load fresh manager
        llmSummaryManager = require('../utils/llmSummaryManager.js');
    });

    afterEach(() => {
        // Clean up timers
        if (llmSummaryManager._cleanup) {
            llmSummaryManager._cleanup();
        }
    });

    describe('Module Initialization', () => {
        it('should load state successfully', () => {
            expect(llmSummaryManager).toBeDefined();
            expect(llmSummaryManager.getPendingSummary).toBeDefined();
            expect(llmSummaryManager.handleHotChannel).toBeDefined();
            expect(llmSummaryManager.generateFullSummary).toBeDefined();
            expect(llmSummaryManager.rejectSummary).toBeDefined();
        });

        it('should have all required methods', () => {
            const requiredMethods = [
                'handleHotChannel',
                'generateFullSummary',
                'rejectSummary',
                'getPendingSummary'
            ];

            requiredMethods.forEach(method => {
                expect(typeof llmSummaryManager[method]).toBe('function');
            });
        });
    });

    describe('Summary State Management', () => {
        it('should return null for non-existent summary', () => {
            const summary = llmSummaryManager.getPendingSummary('non-existent-id');
            expect(summary).toBeNull();
        });

        it('should reject summary without crashing', async () => {
            // Test that rejection doesn't throw
            await expect(
                llmSummaryManager.rejectSummary('test-id')
            ).resolves.toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle null channel gracefully', async () => {
            await expect(
                llmSummaryManager.handleHotChannel(null, {})
            ).resolves.toBeUndefined();
        });

        it('should handle null client gracefully', async () => {
            await expect(
                llmSummaryManager.handleHotChannel({ id: 'test' }, null)
            ).resolves.toBeUndefined();
        });

        it('should handle generateFullSummary with missing summary', async () => {
            await expect(
                llmSummaryManager.generateFullSummary('non-existent', {})
            ).resolves.toBeUndefined();
        });
    });
});
