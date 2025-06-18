// commands/community.js
module.exports = {
    name: "社群",
    description: "提供社群連結",
    execute(message) {
      message.reply({
        content:[
            `📣 加入我們的社群平台：`,
`- Threads：<https://www.threads.net/@nightcastle888>`,
`- Instagram：<https://www.instagram.com/nightcastle888>`,
`- Youtube：<https://www.youtube.com/@nightcastle888>`,
`- Twitch：<https://www.twitch.tv/nightcastle888>`,
`- Websites：<https://gamenightcastle.com/>`
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds:[]//禁用嵌入卡片
      });
    },
  };
  