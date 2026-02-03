const statsHandler = require('../../utils/statsHandler');

// Mock config
jest.mock('../../config/config.js', () => ({
    FILTERS: {
        INCLUDE_CATEGORIES: [],
        EXCLUDE_CATEGORIES: ['exclude-cat-id'],
        EXCLUDE_ROLES: ['exclude-role-id']
    },
    TARGET_GUILD_ID: 'target-guild-id'
}));

describe('Stats Handler', () => {
    let mockMessage;
    let mockClient;

    beforeEach(() => {
        // Setup a fresh mock client and message for each test
        mockClient = {
            dailyStats: {
                channels: {}
            }
        };

        mockMessage = {
            client: mockClient,
            guild: { id: 'target-guild-id' },
            channel: { 
                id: 'channel-1', 
                name: 'general',
                parentId: 'some-category' 
            },
            member: {
                roles: {
                    cache: {
                        some: jest.fn(_callback => {
                           // simple mock implementation of collection.some
                           return false; 
                        })
                    }
                }
            },
            content: 'Hello world',
            attachments: { size: 0 },
            embeds: []
        };
    });

    test('should initialize channel stats if not exists', () => {
        statsHandler.trackMessageStats(mockMessage);
        
        expect(mockClient.dailyStats.channels['channel-1']).toBeDefined();
        expect(mockClient.dailyStats.channels['channel-1'].name).toBe('general');
        expect(mockClient.dailyStats.channels['channel-1'].msgCount).toBe(1);
    });

    test('should increment message count and points for normal message', () => {
        statsHandler.trackMessageStats(mockMessage);
        
        const stats = mockClient.dailyStats.channels['channel-1'];
        expect(stats.msgCount).toBe(1);
        expect(stats.msgPoints).toBe(1); // Base score
    });

    test('should add bonus points for long messages (>20 chars)', () => {
        mockMessage.content = 'This is a very long message that definitely has more than twenty characters.';
        statsHandler.trackMessageStats(mockMessage);
        
        const stats = mockClient.dailyStats.channels['channel-1'];
        expect(stats.msgPoints).toBe(1 + 2); // Base + Bonus
    });

    test('should add bonus points for attachments', () => {
        mockMessage.attachments.size = 1;
        statsHandler.trackMessageStats(mockMessage);
        
        const stats = mockClient.dailyStats.channels['channel-1'];
        expect(stats.msgPoints).toBe(1 + 3); // Base + Bonus
    });

    test('should ignore messages from non-target guilds', () => {
        mockMessage.guild.id = 'other-guild-id';
        statsHandler.trackMessageStats(mockMessage);
        
        expect(mockClient.dailyStats.channels['channel-1']).toBeUndefined();
    });

    test('should ignore messages in excluded categories', () => {
        mockMessage.channel.parentId = 'exclude-cat-id';
        statsHandler.trackMessageStats(mockMessage);
        
        expect(mockClient.dailyStats.channels['channel-1']).toBeUndefined();
    });

    test('should ignore messages from members with excluded roles', () => {
        // Update mock implementation to return true for excluded role
        mockMessage.member.roles.cache.some = jest.fn(() => true);

        statsHandler.trackMessageStats(mockMessage);
        
        expect(mockClient.dailyStats.channels['channel-1']).toBeUndefined();
    });

    test('should ignore commands (starting with &)', () => {
        mockMessage.content = '&help';
        statsHandler.trackMessageStats(mockMessage);
        
        expect(mockClient.dailyStats.channels['channel-1']).toBeUndefined();
    });
});
