// __tests__/conversationCollector.test.js
/**
 * Unit tests for conversationCollector.js
 */

const conversationCollector = require('../utils/conversationCollector.js');

describe('ConversationCollector', () => {
    describe('getUniqueAuthorsCount', () => {
        it('should count unique authors correctly', () => {
            const messages = [
                { authorId: '123', authorName: 'User1' },
                { authorId: '123', authorName: 'User1' },
                { authorId: '456', authorName: 'User2' },
            ];

            const count = conversationCollector.getUniqueAuthorsCount(messages);
            expect(count).toBe(2);
        });

        it('should return 0 for empty messages', () => {
            const count = conversationCollector.getUniqueAuthorsCount([]);
            expect(count).toBe(0);
        });

        it('should return 1 for single author', () => {
            const messages = [
                { authorId: '123', authorName: 'User1' },
                { authorId: '123', authorName: 'User1' },
            ];

            const count = conversationCollector.getUniqueAuthorsCount(messages);
            expect(count).toBe(1);
        });
    });

    describe('formatForLLM', () => {
        it('should format messages correctly', () => {
            const messages = [
                {
                    authorName: 'User1',
                    content: 'Hello',
                    timestamp: new Date('2025-01-20T10:00:00Z').getTime()
                }
            ];

            const formatted = conversationCollector.formatForLLM(messages);

            expect(formatted).toContain('User1');
            expect(formatted).toContain('Hello');
            expect(formatted).toContain('[');
            expect(formatted).toContain(']');
        });

        it('should join multiple messages with newlines', () => {
            const messages = [
                {
                    authorName: 'User1',
                    content: 'Message 1',
                    timestamp: new Date('2025-01-20T10:00:00Z').getTime()
                },
                {
                    authorName: 'User2',
                    content: 'Message 2',
                    timestamp: new Date('2025-01-20T10:01:00Z').getTime()
                }
            ];

            const formatted = conversationCollector.formatForLLM(messages);
            const lines = formatted.split('\n');

            expect(lines.length).toBe(2);
            expect(lines[0]).toContain('User1');
            expect(lines[1]).toContain('User2');
        });
    });

    describe('getStatistics', () => {
        it('should calculate statistics correctly', () => {
            const messages = [
                {
                    authorId: '123',
                    authorName: 'User1',
                    content: 'Hello world',
                    timestamp: new Date('2025-01-20T10:00:00Z').getTime(),
                    attachments: [{ url: 'http://example.com/file.png' }]
                },
                {
                    authorId: '456',
                    authorName: 'User2',
                    content: 'Hi there',
                    timestamp: new Date('2025-01-20T10:01:00Z').getTime(),
                    attachments: []
                }
            ];

            const stats = conversationCollector.getStatistics(messages);

            expect(stats.totalMessages).toBe(2);
            expect(stats.uniqueAuthors).toBe(2);
            expect(stats.totalWords).toBe(4); // "Hello world Hi there"
            expect(stats.messagesWithAttachments).toBe(1);
            expect(stats.timespan).toBeDefined();
        });

        it('should handle empty messages', () => {
            const stats = conversationCollector.getStatistics([]);

            expect(stats.totalMessages).toBe(0);
            expect(stats.uniqueAuthors).toBe(0);
            expect(stats.totalWords).toBe(0);
            expect(stats.messagesWithAttachments).toBe(0);
            expect(stats.timespan).toBeNull();
        });
    });
});
