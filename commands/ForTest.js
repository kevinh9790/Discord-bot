// commands/ForTest.js
module.exports = {
    name: "大便",
    description: "大便香腸",
    execute(message) {
      message.reply({
        content:[
            `我要吃 變變`
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds:[]//禁用嵌入卡片
      });
    },
  };