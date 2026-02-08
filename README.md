📁 專案目錄結構
Discord-bot/
├── docs/                    # 專案文件
│   ├── llm_summary_setup.md # LLM 摘要功能設定指南
│   └── loadtest_setup.md    # 負載測試設定指南
├── AGENTS.md                # 開發者/AI 上下文文件
├── index.js                 # 主程式入口，初始化 bot
├── commands/                # 存放所有指令模組
│   └── ping.js              # 範例指令：ping
├── events/                  # 存放事件處理器
│   ├── ready.js             # Bot 啟動完成事件
│   └── messageCreate.js     # 處理收到訊息事件
├── jobs/                    # 定時任務，如每日推播活動
│   └── dailyEventPoster.js  # 每日活動推播功能
├── utils/                   # 工具函式，如抓取活動資訊
│   └── fetchEvents.js       # 抓取 Discord 活動資訊
├── config/                  # 配置檔案
│   └── config.js            # 儲存常數與設定
├── assets/                  # 靜態資源如圖片
│   └── generated-icon.png   # 專案中用到的圖像資源
├── .env                     # 環境變數，儲存敏感資訊
├── .gitignore               # Git 忽略設定
├── package.json             # 專案設定與依賴
└── README.md                # 專案說明文件



📚 各資料夾用途說明

docs/：存放專案相關文件與設定指南。

index.js：Bot 的主程式，啟動時會載入事件與定時任務。

commands/：放置所有指令模組，每個檔案對應一個指令。

events/：對應 Discord 的事件，如 ready、messageCreate 等。

jobs/：放置排程任務，例如每日提醒、自動通知等。

utils/：存放工具函式，供其他模組使用。

config/：集中管理設定變數（非敏感資訊）。

.env：存放敏感資料，如 Token、ID 等。

.gitignore：排除不該加入 Git 的檔案。

package.json：npm 專案設定。

📖 進階文件

- [開發者上下文 (AGENTS.md)](AGENTS.md)
- [LLM 摘要功能設定 (llm_summary_setup.md)](docs/llm_summary_setup.md)
- [負載測試設定 (loadtest_setup.md)](docs/loadtest_setup.md)



🧠 提醒

新增功能時請遵守目錄規範，以確保可讀性與維護性。

若不確定要放哪裡，請詢問或查閱本說明文件。

.env 記得加入 .gitignore 避免上傳敏感資料。
