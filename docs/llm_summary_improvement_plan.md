# LLM Summary Feature Improvement Plan (v2 - Retrospective Analysis)

## 1. Trigger Optimization: Daily Maturation Scan
Instead of real-time triggers on every message or "hot channel" detection, the system will move to a daily retrospective scan.

- **Action**: Create a new cronjob (e.g., `jobs/llmSummaryJob.js`) that runs once a day (e.g., 04:00 AM).
- **Logic**:
    - **Fetch History**: Retrieve messages from the last 7 days for all whitelisted channels.
    - **Maturation Threshold**: Define a "maturation point" (e.g., `Now - 3 Days`).
- **Benefit**: Ensures discussions have reached a conclusion before analysis, reducing noise from transient or incomplete chatter.

## 2. Topic Discovery & Grouping
Discord lacks native threading for most conversations. We will use an LLM to untangle overlapping discussions.

- **Action**: Implement a "Topic Discovery" phase using `gemini-1.5-flash`.
- **Logic**:
    - Feed message history to the LLM to identify distinct "Topic Clusters".
    - Each cluster contains a set of related message IDs, a topic name, and a relevance score.
    - This allows separating game-dev discussions from random off-topic chatter occurring simultaneously.
- **Benefit**: High accuracy in grouping related messages even when multiple conversations happen at once, far more robust than simple time-gap splitting.

## 3. Maturation-Aware Summarization
Summaries are triggered based on the age and size of the "Main Part" of a topic cluster.

- **Action**: Refactor `llmSummaryManager.js` to process identified Topic Clusters.
- **Trigger Condition**:
    - **Main Part**: Messages in the cluster older than 3 days must meet `minMessages` (e.g., 10).
    - **Follow-ups**: Include messages younger than 3 days belonging to the same cluster to capture conclusions or related updates.
- **Benefit**: Captures the "full story" by including recent follow-ups while ensuring the core discussion is established and "matured".

## 4. State Management & Deduplication
To prevent redundant summaries of the same ongoing or matured topics.

- **Action**: Update `data/llmSummaryState.json` to track `summarizedTopicFingerprints`.
- **Logic**: 
    - A fingerprint is a hash/unique identifier of the "Main Part" message IDs.
    - Skip clusters if their fingerprint already exists, ensuring each "core" discussion is only summarized once.
- **Benefit**: Drastically reduces token usage and avoids cluttering the summary channel with duplicate reports.

## 5. Configuration & Prompt Updates
- **Action**: Update `config/config.js`:
    - `maturationDays`: 3
    - `scanLimitDays`: 7
    - `models.relevanceCheck`: `gemini-1.5-flash`
    - `models.fullSummary`: `gemini-1.5-pro`
- **Action**: Update `config/prompts/`:
    - Create `topicDiscovery.txt` for Phase 1 grouping.
    - Refine `comprehensiveSummary.txt` to handle multi-day context and focus on the matured core.

---

## Implementation Steps

1.  **Modify `config/config.js`**: Add maturation settings and update Gemini models.
2.  **Create `jobs/llmSummaryJob.js`**: Implement the daily cron schedule and orchestration logic.
3.  **Modify `utils/llmSummaryManager.js`**:
    - Implement `performDailyScan()`.
    - Implement `discoverTopics()` using LLM-based clustering.
    - Refactor internal logic to process clusters rather than raw channel history.
4.  **Modify `utils/conversationCollector.js`**: Add support for fetching a wide time-window with pagination.
5.  **Clean up `events/messageCreate.js`**: Remove real-time `llmSummaryManager` calls.
6.  **Verification**: 
    - Update integration tests to simulate multi-day history and verify cluster-based maturation and deduplication.