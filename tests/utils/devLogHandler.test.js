const devLogHandler = require('../../utils/devLogHandler');
const { ChannelType } = require("discord.js");

// Mock config
jest.mock('../../config/config.js', () => ({
    TRIGGER_PREFIX: 'DevLog',
    DEV_LOG_GROUPS: [
        {
            targetId: 'forum-1',
            sourceIds: ['source-1']
        }
    ]
}));

describe('Dev Log Handler', () => {
    let mockMessage;
    let mockForumChannel;
    let mockThread;

    beforeEach(() => {
        // Use a simple array with filter for threads to mimic Collection behavior used in the handler
        const threadsArray = []; 
        // We will push the mock thread into this array

        mockThread = {
            id: 'thread-1',
            name: 'MyGame', // Single word to match regex expectation
            ownerId: 'user-1',
            send: jest.fn().mockResolvedValue(true)
        };
        threadsArray.push(mockThread);

        mockForumChannel = {
            id: 'forum-1',
            type: ChannelType.GuildForum,
            threads: {
                fetchActive: jest.fn().mockResolvedValue({
                    threads: threadsArray // The handler uses .filter on this property
                }),
                fetchArchived: jest.fn().mockResolvedValue({
                    threads: { values: () => [] } // Handler uses Array.from(values)
                })
            }
        };

        mockMessage = {
            content: 'DevLog MyGame Update content',
            channel: { id: 'source-1' },
            author: { id: 'user-1', username: 'DevUser' },
            guild: {
                channels: {
                    cache: {
                        get: jest.fn(id => id === 'forum-1' ? mockForumChannel : undefined)
                    }
                }
            },
            attachments: { values: () => [] },
            react: jest.fn(),
            reply: jest.fn()
        };
    });

    test('should ignore messages without prefix', async () => {
        mockMessage.content = 'Hello world';
        const result = await devLogHandler.handleDevLog(mockMessage);
        expect(result).toBe(false);
    });

    test('should ignore messages from non-source channels', async () => {
        mockMessage.channel.id = 'other-channel';
        const result = await devLogHandler.handleDevLog(mockMessage);
        expect(result).toBe(false);
    });

    test('should reply error if format is invalid', async () => {
        mockMessage.content = 'DevLog'; // No game name
        const result = await devLogHandler.handleDevLog(mockMessage);
        expect(result).toBe(true);
        expect(mockMessage.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringMatching(/格式錯誤/)
        }));
    });

    test('should find thread by exact name match and forward message', async () => {
        // "MyGame" matches thread name "MyGame"
        mockMessage.content = 'DevLog MyGame Today I did some coding';
        
        await devLogHandler.handleDevLog(mockMessage);

        expect(mockThread.send).toHaveBeenCalledWith(expect.objectContaining({
            content: 'Today I did some coding'
        }));
        expect(mockMessage.react).toHaveBeenCalledWith('✅');
    });

    test('should find thread by partial name match', async () => {
        // "Game" is in "MyGame" -> High similarity (0.9)
        mockMessage.content = 'DevLog Game Update content';
        
        await devLogHandler.handleDevLog(mockMessage);

        expect(mockThread.send).toHaveBeenCalled();
    });

    test('should reply error if no matching thread found', async () => {
        // "NonExistent" shares no bigrams with "MyGame", so score should be 0
        mockMessage.content = 'DevLog NonExistent Update content';
        
        await devLogHandler.handleDevLog(mockMessage);

        expect(mockMessage.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringMatching(/找不到指定文章/)
        }));
        expect(mockThread.send).not.toHaveBeenCalled();
    });
});
