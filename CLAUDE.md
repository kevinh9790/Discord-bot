# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Production: node index.js
npm run dev        # Development: nodemon index.js (hot reload)
npm test           # Run Jest tests
npm run lint       # Run ESLint
```

Run a single test file:
```bash
npx jest __tests__/llmService.test.js
```

## Tech Stack

- **Runtime:** Node.js, JavaScript (CommonJS)
- **Discord:** `discord.js` v14
- **AI/LLM:** `@google/generative-ai` (Gemini)
- **Web Server:** `express` (health checks / keep-alive)
- **Scheduling:** `node-cron`
- **Utilities:** `dotenv`, `axios`, `cheerio`, `node-fetch`
- **Testing:** `jest`, `eslint`

## Architecture

**Game Night Castle Bot** — a Discord bot for a Taiwanese game dev community.

### Entry Point & Auto-loading (`index.js`)

The bot auto-discovers and loads three types of modules at startup:
- **`commands/`** — each file exports `{ name, description, execute(message, args) }`. Commands use `&` prefix (message-based, not slash commands).
- **`events/`** — each file exports `{ name, once?, execute(...args, client) }`.
- **`jobs/`** — each file exports `execute(client)` which sets up its own cron schedule. Jobs load after the `ready` event.

An Express server runs on port 8080 for health checks and self-ping keep-alive on some hosting platforms.

### Configuration (`config/config.js`)

Single source of truth for all constants: Discord channel IDs, active-chat detection rules, LLM settings (min messages, lookback window, relevance threshold, rate limits, maturation period). Read this file before modifying any feature settings.

Environment variables (see `.env.example`) control token, channel IDs, and feature flags like `LLM_SUMMARY_ENABLED` and `LLM_DRY_RUN`.

### LLM Summarization Pipeline

The core feature — daily retrospective at 04:00 Asia/Taipei (cron: `jobs/llmSummaryJob.js`):

1. **Topic Discovery** — Gemini identifies discussion clusters from whitelisted channels
2. **Relevance Check** — confirms the topic is game-dev related (threshold: 0.7)
3. **Maturation Check** — only includes messages older than 3 days
4. **Deduplication** — "anchor fingerprinting" (first 5 message IDs) prevents re-summarizing the same topic
5. **Admin Approval** — posts to approval channel with approve/reject buttons (24h timeout)
6. **Full Summary** — generates and posts to summary channel on approval

Key files: `utils/llmSummaryManager.js` (orchestration), `utils/llmService.js` (provider abstraction), `utils/conversationCollector.js` (message formatting).

LLM prompts live in `config/prompts/` (Traditional Chinese).

**`LLM_DRY_RUN=true`** runs the full pipeline with token counting but no API calls — use this to test without cost. Every LLM call also logs estimated cost in USD.

### State Persistence

`data/activeChatState.json` and `data/llmSummaryState.json` persist runtime state (rate limits, pending approvals, active chat cooldowns) across restarts.

### Runtime State

Global state is attached to the `client` object or managed via singleton managers in `utils/`. The main singletons are `activeChatManager` and `llmSummaryManager`.

## Conventions

- **Language:** Comments and user-facing messages are in **Traditional Chinese**.
- **Module style:** CommonJS (`require`/`module.exports`) throughout.
- **Git workflow:** PRs target the `dev` branch, not `main`.
- **LLM provider:** Gemini is the active provider. `utils/providers/openaiProvider.js` and `claudeProvider.js` are stubs for future use.

## Known TODOs

- Migrate commands to Discord Slash Commands (`interactionCreate`) — currently uses message-based `&` prefix.
- Reduce log verbosity (currently too noisy).
