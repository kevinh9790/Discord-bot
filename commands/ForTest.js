// commands/ForTest.js
module.exports = {
    name: "大便",
    description: "大便香腸",
    execute(message) {
      message.reply({
        content:[
            `想要吃嗎??`
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds:[]//禁用嵌入卡片
      });
    },
  };
  