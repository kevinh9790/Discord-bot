// commands/ForTest.js
module.exports = {
    name: "想去論壇文章",
    description: "大便香腸",
    execute(message) {
      message.reply({
        content:[
            `<#1445248647871729795>`
        ].join('\n'),
        allowedMentions: { parse: [] },
        embeds:[]//禁用嵌入卡片
      });
    },
  };