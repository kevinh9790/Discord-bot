/**
 * Gamedev Conversation Templates
 * Preset conversations for load testing the LLM summary feature
 * All users have [TEST] prefix to indicate test messages
 */

const templates = {
  'unity-technical': {
    name: 'Unity Technical Issue',
    category: 'technics',
    description: '3位使用者討論Unity 2D光照設定問題',
    users: [
      { name: '小明', role: '初學者' },
      { name: 'Unity老手', role: '技術顧問' },
      { name: '阿華', role: '貢獻者' }
    ],
    messages: [
      {
        user: '小明',
        delay: 0,
        content: '各位好～請問一下，Unity的2D光照要怎麼設定才能有好看的效果？我用的是URP管線'
      },
      {
        user: 'Unity老手',
        delay: 45,
        content: '2D光照在URP裡面設定滿重要的。首先你要確認Renderer有啟用2D光照，然後在Scriptable Renderer Data裡面設定Light Layers。'
      },
      {
        user: 'Unity老手',
        delay: 8,
        content: '具體步驟是：Edit > Project Settings > Graphics > Scriptable Render Pipeline Settings > 選你的URP Asset > 在Forward Renderer Data裡勾選Blend Style和Light Layers'
      },
      {
        user: '阿華',
        delay: 60,
        content: '對對對！而且一定要加上Light 2D component到你的light物件上，不然不會發光的。還有要設定正確的Sorting Layers。'
      },
      {
        user: '小明',
        delay: 52,
        content: '原來如此～感謝！那請問如果我想要做到即時光影的效果，需要特別設定什麼嗎？效能會不會有問題？'
      },
      {
        user: 'Unity老手',
        delay: 65,
        content: '光影計算的確會耗效能。建議用Normal Map搭配Light 2D，或是用pre-baked lighting如果場景不會動的話。手機平台更要注意效能。'
      },
      {
        user: '阿華',
        delay: 48,
        content: '我們的專案用的是deferred rendering搭配LOD system，這樣可以在保持品質的同時降低draw call。也可以用烘焙貼圖輔助。'
      },
      {
        user: '小明',
        delay: 55,
        content: '明白了！感謝各位的建議，我去試試看這些做法。希望能做出不錯的2D光影效果～'
      },
      {
        user: 'Unity老手',
        delay: 42,
        content: '加油！有問題可以再問。也可以看官方文件：https://docs.unity3d.com/Manual/2DLightProperties.html'
      },
      {
        user: '阿華',
        delay: 38,
        content: '對，建議看完官方文件後再動手。URP的文件寫得滿詳細的，會少走很多冤枉路～'
      }
    ]
  },

  'resource-sharing': {
    name: 'Resource Sharing & Tools',
    category: 'resource',
    description: '4位使用者分享遊戲開發工具和資源',
    users: [
      { name: '開發者A', role: '全端開發者' },
      { name: '設計師B', role: '像素藝術設計師' },
      { name: '開發者C', role: '獨立遊戲開發者' },
      { name: '美術D', role: '3D美術師' }
    ],
    messages: [
      {
        user: '開發者A',
        delay: 0,
        content: '各位，有人知道好用的免費像素藝術工具嗎？我想學習像素風格的美術設計～'
      },
      {
        user: '設計師B',
        delay: 50,
        content: 'Aseprite是業界標準，不過要付費。如果要免費的話，推薦試試 Piskel，線上版可以直接用，不用裝軟體。'
      },
      {
        user: '設計師B',
        delay: 12,
        content: '還有 LibreSprite 和 Krita，Krita的像素功能也滿不錯的。我自己是 Aseprite + Krita 的組合。'
      },
      {
        user: '開發者C',
        delay: 65,
        content: '我推薦去 itch.io 看看免費的 sprite 素材。很多talented artists都在上面分享免費資源～'
      },
      {
        user: '美術D',
        delay: 48,
        content: '對！itch.io 的確有超多資源。我前陣子找的2D tiling set和character sprites都從那邊找的。省超多時間。'
      },
      {
        user: '開發者A',
        delay: 72,
        content: '謝謝！那請問各位有推薦的遊戲開發框架嗎？我想做點小作品試試看。'
      },
      {
        user: '開發者C',
        delay: 58,
        content: '看你要做什麼類型啦。Unity和Godot都很不錯。如果只是做簡單的2D游戲，Godot用GDScript會更快上手。'
      },
      {
        user: '美術D',
        delay: 45,
        content: '我最近用Godot做了幾個prototype。社群滿活躍的，而且是open source的，非常推薦新手學習。'
      },
      {
        user: '設計師B',
        delay: 65,
        content: '補充一下，OpenGameArt.org 也有很多免費的遊戲素材和音效。美術資源的寶庫！'
      },
      {
        user: '開發者A',
        delay: 52,
        content: '太感謝了！資源這麼豐富，我可以開始著手做遊戲了。會定期上來分享進度～'
      },
      {
        user: '開發者C',
        delay: 40,
        content: '加油！有問題歡迎提問。我們社群很樂意幫助新手～一起加油吧！'
      }
    ]
  }
};

/**
 * Get conversation template by preset name
 * @param {string} preset - Preset name ('unity-technical' or 'resource-sharing')
 * @returns {Object} Conversation template
 */
function getTemplate(preset = 'unity-technical') {
  return templates[preset];
}

/**
 * Get all available presets
 * @returns {Array} Array of preset names
 */
function getAvailablePresets() {
  return Object.keys(templates);
}

/**
 * Prepare conversation messages with webhook format
 * @param {string} preset - Preset name
 * @param {number} count - Number of users (will validate against template)
 * @returns {Object} Prepared conversation with users and messages
 */
function prepareConversation(preset = 'unity-technical', count = null) {
  const template = getTemplate(preset);
  if (!template) {
    throw new Error(`Unknown preset: ${preset}`);
  }

  return {
    preset,
    category: template.category,
    users: template.users,
    messages: template.messages,
    totalMessages: template.messages.length,
    estimatedDuration: calculateDuration(template.messages)
  };
}

/**
 * Calculate estimated duration in seconds
 * @param {Array} messages - Array of message objects
 * @returns {number} Duration in seconds
 */
function calculateDuration(messages) {
  if (!messages || messages.length === 0) return 0;
  const lastMessage = messages[messages.length - 1];
  const firstMessage = messages[0];
  return (lastMessage.delay || 0) + 10; // +10s for last message send time
}

module.exports = {
  getTemplate,
  getAvailablePresets,
  prepareConversation,
  calculateDuration
};
