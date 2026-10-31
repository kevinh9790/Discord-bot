const devLogHandler = require('../../utils/devLogHandler');
const { ChannelType } = require("discord.js");

// Mock config
jest.mock('../../config/config.js', () => ({
    TRIGGER_PREFIX: 'DevLog',
    DEV_LOG_GROUPS: [
        {
            targetId: 'forum-1',
            sourceIds: ['source-1']
        },
        {
            targetId: '1230535700525486110',
            sourceIds: ['1442811186528911512']
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
                    fetch: jest.fn().mockResolvedValue(mockForumChannel),
                    cache: {
                        get: jest.fn(id => ['forum-1', '1230535700525486110'].includes(id) ? mockForumChannel : undefined)
                    }
                }
            },
            attachments: { values: () => [] },
            react: jest.fn(),
            reply: jest.fn()
        };
    });

    test.each(['source-1', '1442811186528911512'])('should report format errors in %s even without a cached forum', async channelId => {
        mockMessage.channel.id = channelId;
        mockMessage.content = 'DevLog';
        mockMessage.guild.channels.cache.get.mockReturnValue(undefined);

        expect(await devLogHandler.handleDevLog(mockMessage)).toBe(true);
        expect(mockMessage.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('格式錯誤')
        }));
        expect(mockMessage.guild.channels.fetch).not.toHaveBeenCalled();
    });

    test('should fetch an uncached forum and forward to the group B target', async () => {
        mockMessage.channel.id = '1442811186528911512';
        mockMessage.guild.channels.cache.get.mockReturnValue(undefined);

        await devLogHandler.handleDevLog(mockMessage);

        expect(mockMessage.guild.channels.fetch).toHaveBeenCalledWith('1230535700525486110');
        expect(mockThread.send).toHaveBeenCalledWith(expect.objectContaining({ content: 'Update content' }));
        expect(mockMessage.react).toHaveBeenCalledWith('✅');
    });

    test.each([null, { type: ChannelType.GuildText }])('should reply when the target is missing or is not a forum：%j', async target => {
        mockMessage.guild.channels.cache.get.mockReturnValue(undefined);
        mockMessage.guild.channels.fetch.mockResolvedValue(target);
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await devLogHandler.handleDevLog(mockMessage)).toBe(true);
            expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('不存在或不是論壇頻道'));
            expect(mockThread.send).not.toHaveBeenCalled();
        } finally {
            errorLog.mockRestore();
        }
    });

    test('should report a forum access failure and log a failed error reply', async () => {
        mockMessage.guild.channels.cache.get.mockReturnValue(undefined);
        mockMessage.guild.channels.fetch.mockRejectedValue(new Error('Missing Access'));
        const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await devLogHandler.handleDevLog(mockMessage);
            expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Missing Access'));
            expect(mockThread.send).not.toHaveBeenCalled();

            mockMessage.reply.mockRejectedValue(new Error('Missing Permissions'));
            expect(await devLogHandler.handleDevLog(mockMessage)).toBe(true);
            expect(errorLog).toHaveBeenCalledWith(
                expect.stringContaining('無法回覆來源頻道'), expect.any(Error)
            );
        } finally {
            errorLog.mockRestore();
        }
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
