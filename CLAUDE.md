# Gemini Context File (GEMINI.md)

## Project Overview
This is a **Node.js Discord Bot** project, likely named "Game Night Castle Bot". It is designed to manage community interactions, events, and statistics. The bot uses `discord.js` (v14) for Discord API interactions and includes an Express server for keep-alive functionality.

## Tech Stack
*   **Runtime:** Node.js
*   **Framework:** `discord.js` (v14)
*   **Web Server:** `express` (used for health checks/keep-alive)
*   **Scheduling:** `node-cron`
*   **Utilities:** `dotenv`, `axios`, `cheerio`, `node-fetch`
*   **Language:** JavaScript (CommonJS)

## Architecture & Core Concepts

### 1. Entry Point (`index.js`)
*   Initializes the `Client` with specific intents (Guilds, Messages, Members, Voice, etc.).
*   Sets up an Express server on port 8080 (or `process.env.PORT`) to respond to health checks.
*   Loads event handlers from the `events/` directory.
*   Loads scheduled jobs from the `jobs/` directory (executed after the `ready` event).
*   Includes a self-ping mechanism to prevent sleep on some hosting platforms.

### 2. Command Handling
*   Commands are located in `commands/`.
*   Each file exports an object with `name`, `description`, and an `execute(message, args)` function.
*   **Note:** The current `commands/events.js` example suggests a message-based command handler (processing `messageCreate` events) rather than slash commands (`/`), or a hybrid approach. *Verify `interactionCreate.js` or `messageCreate.js` if modifying command logic.*

### 3. Event Handling
*   Events are located in `events/`.
*   Each file exports `name`, `once` (boolean), and `execute(...args, client)`.
*   `events/ready.js` is heavy: it handles login logging, invite caching, and **initializes the daily statistics cron job**.

### 4. Features
*   **Daily Statistics:** Tracks message counts, voice channel duration, and "most reacted" messages. Reports are generated daily at 00:00 (Asia/Taipei time).
*   **Event Announcements:** Fetches Discord Scheduled Events and announces them to a specific channel.
*   **Invite Tracking:** Caches invite codes and usage counts to track invites.

## Configuration
*   **Environment Variables:** Managed via `.env` (e.g., `TOKEN`, `PORT`, `EVENT_ANNOUNCE_CHANNEL`).
*   **Hardcoded Config:** `events/ready.js` contains `FILTER_CONFIG` and `CHANNELS` objects defining target guild IDs, channel IDs for logs/leaderboards, and category filters.

## Development Conventions
*   **Style:** CommonJS (`require`).
*   **Formatting:** Standard JavaScript formatting.
*   **Language:** Comments and user-facing messages are in **Traditional Chinese**.
*   **Global State:** Runtime state (like `dailyStats`, `inviteUses`) is often attached directly to the `client` object.

## Build & Run
*   **Start:** `npm start` (Runs `node index.js`)
*   **Dev:** `npm run dev` (Runs `nodemon index.js`)
*   **Lint:** `npm run test` (Currently just an echo error, no tests configured).

## Key Files to Know
*   `index.js`: Main application logic.
*   `events/ready.js`: Daily stats logic and initialization.
*   `commands/events.js`: Example of event fetching logic.
* `utils/`: Helper functions.

## Improvement TODOs
- [x] **Refactor `activeChatManager.js` Config:** Move hardcoded settings (Guild ID, Channel ID, rules) to `config/config.js`.
- [x] **Refactor `activeChatManager.js` State:** Implement basic JSON file persistence for active chat state to survive restarts.
- [x] **Refactor `index.js` Config:** Move the hardcoded PING URL to `.env` and `config/config.js`.



