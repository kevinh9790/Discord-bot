// __tests__/llmSummaryManager.integration.test.js
/**
 * Integration tests for llmSummaryManager.js
 * Tests core functionality without full Discord mocking complexity
 */

const { createLlmSummaryManager } = require('../utils/llmSummaryManager.js');
const { InMemoryStorage } = require('../utils/storage.js');

describe('LLMSummaryManager Integration', () => {
    let manager;

    beforeEach(() => {
        manager = createLlmSummaryManager(new InMemoryStorage(null));
    });

    afterEach(() => {
        manager._cleanup();
    });

    describe('Module Initialization', () => {
        it('should load state successfully', () => {
            expect(manager).toBeDefined();
            expect(manager.getPendingSummary).toBeDefined();
            expect(manager.handleHotChannel).toBeDefined();
            expect(manager.performDailyScan).toBeDefined();
            expect(manager.generateFullSummary).toBeDefined();
            expect(manager.rejectSummary).toBeDefined();
        });

        it('should have all required methods', () => {
            const requiredMethods = [
                'handleHotChannel',
                'performDailyScan',
                'generateFullSummary',
                'rejectSummary',
                'getPendingSummary',
                '_generateFingerprint'
            ];

            requiredMethods.forEach(method => {
                expect(typeof manager[method]).toBe('function');
            });
        });
    });

    describe('Fingerprinting', () => {
        it('should generate consistent fingerprints for the same IDs', () => {
            const ids = ['1', '2', '3'];
            const fp1 = manager._generateFingerprint(ids);
            const fp2 = manager._generateFingerprint(['3', '2', '1']);
            expect(fp1).toBe(fp2);
        });

        it('should generate different fingerprints for different IDs', () => {
            const fp1 = manager._generateFingerprint(['1', '2']);
            const fp2 = manager._generateFingerprint(['1', '3']);
            expect(fp1).not.toBe(fp2);
        });
    });

    describe('Summary State Management', () => {
        it('should return null for non-existent summary', () => {
            const summary = manager.getPendingSummary('non-existent-id');
            expect(summary).toBeNull();
        });

        it('should reject summary without crashing', async () => {
            await expect(
                manager.rejectSummary('test-id')
            ).resolves.toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle null channel gracefully', async () => {
            await expect(
                manager.handleHotChannel(null, {})
            ).resolves.toBeUndefined();
        });

        it('should handle null client gracefully', async () => {
            await expect(
                manager.handleHotChannel({ id: 'test' }, null)
            ).resolves.toBeUndefined();
        });

        it('should handle generateFullSummary with missing summary', async () => {
            await expect(
                manager.generateFullSummary('non-existent', {})
            ).resolves.toBeUndefined();
        });
    });
});
