jest.mock('../../utils/statsHandler', () => ({ trackMessageStats: jest.fn() }));
jest.mock('../../utils/devLogHandler', () => ({ handleDevLog: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/logger', () => jest.fn().mockResolvedValue(undefined));
jest.mock('../../config/config', () => ({
    TRIGGER_PREFIX: '開發進度',
    DEV_LOG_GROUPS: [{ sourceIds: ['1442811186528911512'], targetId: '1230535700525486110' }]
}));

const event = require('../../events/messageCreate');
const handler = require('../../utils/devLogHandler');
const log = require('../../utils/logger');

describe('開發進度入口診斷', () => {
    let message;
    let client;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        message = {
            id: 'message-1',
            content: '開發進度',
            author: { bot: false, username: 'DevUser' },
            channel: { id: '1442811186528911512', name: '深入交流區' }
        };
        client = { activeChatManager: { handleMessage: jest.fn().mockResolvedValue(undefined) } };
    });

    afterEach(() => jest.restoreAllMocks());

    test('logs reception before running other handlers', async () => {
        await event.execute(message, client);

        expect(log).toHaveBeenCalledWith(client, expect.stringContaining('來源設定：符合\n指令開頭：符合'));
        expect(log.mock.invocationCallOrder[0]).toBeLessThan(client.activeChatManager.handleMessage.mock.invocationCallOrder[0]);
        expect(handler.handleDevLog).toHaveBeenCalledWith(message, client);
    });

    test('continues processing if the active chat manager is not initialized', async () => {
        delete client.activeChatManager;

        await event.execute(message, client);

        expect(log).toHaveBeenCalledWith(client, expect.stringContaining('活躍聊天處理失敗'), 'error');
        expect(handler.handleDevLog).toHaveBeenCalledWith(message, client);
    });

    test('reports an empty message body in a configured source channel', async () => {
        message.content = '';

        await event.execute(message, client);

        expect(log).toHaveBeenCalledWith(client, expect.stringContaining('內容為空，請檢查 Message Content Intent'));
    });

    test('reports an unconfigured source channel', async () => {
        message.channel.id = 'other-channel';

        await event.execute(message, client);

        expect(log).toHaveBeenCalledWith(client, expect.stringContaining('來源設定：不符合'));
    });

    test('reports leading whitespace preventing prefix recognition', async () => {
        message.content = ' 開發進度';

        await event.execute(message, client);

        expect(log).toHaveBeenCalledWith(client, expect.stringContaining('指令開頭：不符合'));
    });

    test('does not send routine chat or bot messages to the Discord log', async () => {
        message.content = '一般聊天';
        await event.execute(message, client);
        message.content = '開發進度';
        message.author.bot = true;
        await event.execute(message, client);

        expect(log).not.toHaveBeenCalled();
        expect(handler.handleDevLog).toHaveBeenCalledTimes(1);
    });
});
