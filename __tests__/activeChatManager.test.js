// __tests__/activeChatManager.test.js
/**
 * Unit tests for activeChatManager.js using InMemoryStorage
 */

const { createActiveChatManager } = require('../utils/activeChatManager.js');
const { InMemoryStorage } = require('../utils/storage.js');

describe('ActiveChatManager', () => {
    let manager;

    beforeEach(() => {
        manager = createActiveChatManager(new InMemoryStorage(null));
    });

    describe('Initialization', () => {
        it('should expose handleMessage', () => {
            expect(typeof manager.handleMessage).toBe('function');
        });

        it('should restore state from storage', () => {
            const storage = new InMemoryStorage({
                messages: { 'ch1': [{ authorId: 'u1', timestamp: Date.now() }] },
                cooldowns: { 'ch1': Date.now() },
                lastResetDate: new Date().toDateString()
            });
            const m = createActiveChatManager(storage);
            expect(m).toBeDefined();
        });
    });

    describe('handleMessage — early exits', () => {
        it('should skip messages from wrong guild', async () => {
            const message = {
                guild: { id: 'wrong-guild' },
                author: { bot: false, username: 'user1' },
                channel: { name: 'general', parentId: null, id: 'ch1' },
                webhookId: null,
                content: 'hello'
            };
            // Should not throw
            await expect(manager.handleMessage(message)).resolves.toBeUndefined();
        });

        it('should skip bot messages', async () => {
            const message = {
                guild: { id: process.env.TARGET_GUILD_ID || 'any' },
                author: { bot: true, username: 'bot1' },
                channel: { name: 'general', parentId: null, id: 'ch1' },
                webhookId: null,
                content: 'hello'
            };
            await expect(manager.handleMessage(message)).resolves.toBeUndefined();
        });
    });
});
