# LLM Summary Feature - Test Plan

## 1. Goal
Verify the "Retrospective Maturation Scan" logic correctly identifies, groups, and summarizes game-dev discussions while adhering to the 3-day maturation rule and avoiding duplicates.

## 2. Test Environments
- **Integration Test**: Mocking Discord API and LLM responses to verify logic flow in `__tests__/llmSummaryManager.integration.test.js`.
- **Dry Run Mode**: Running the actual bot with `LLM_DRY_RUN=true` to see logs and LLM inputs without posting to public channels.

## 3. Core Test Scenarios

### Phase 1: Topic Discovery & Clustering
| ID | Scenario | Verification Method |
| :--- | :--- | :--- |
| **TC-1.1** | **Topic Separation**<br>Simulate a channel where User A/B discuss "C# Refactoring" and User C/D discuss "Pizza" at the same time. | Verify `discoverTopics` returns 2 clusters. Cluster 1 is "Relevant", Cluster 2 is "Not Relevant". |
| **TC-1.2** | **Interrupted Topics**<br>A discussion starts, stops for 1 day, then resumes. | Verify the LLM groups both segments into the same Topic Cluster. |

### Phase 2: Maturation Logic
| ID | Scenario | Verification Method |
| :--- | :--- | :--- |
| **TC-2.1** | **Ready for Summary**<br>Topic has 12 messages from 4 days ago + 3 messages from today. | Verify it passes the `maturationDays` filter and includes all 15 messages in the summary. |
| **TC-2.2** | **Too Young**<br>Topic has 50 messages, but all were sent in the last 48 hours. | Verify it is cached but **NOT** summarized (waiting for 3-day maturation). |
| **TC-2.3** | **Too Small**<br>Topic has only 5 messages older than 3 days. | Verify it is ignored (fails `minMessages` threshold). |

### Phase 3: Deduplication & State
| ID | Scenario | Verification Method |
| :--- | :--- | :--- |
| **TC-3.1** | **Repeat Scan**<br>Run the daily scan. Then run it again immediately. | Verify the second run produces 0 summaries (Fingerprint match). |
| **TC-3.2** | **Fingerprint Persistence**<br>Restart the bot. Run scan. | Verify the bot still remembers previously summarized topics from `llmSummaryState.json`. |

### Phase 4: Summarization Quality
| ID | Scenario | Verification Method |
| :--- | :--- | :--- |
| **TC-4.1** | **Follow-up Inclusion**<br>A bug is discussed 4 days ago. The fix is posted today. | Verify the summary title and content reflect the **resolution** found in the "younger" messages. |

## 4. Success Metrics
- **False Positive Rate**: < 10% (Summarizing non-gamedev chatter).
- **Missed Topic Rate**: < 5% (Failing to detect a technical discussion > 10 messages).
- **Duplicate Rate**: 0% (Posting the same "core" discussion twice).

## 5. Execution Plan
1. **Unit Tests**: Update `conversationCollector.test.js` for paginated fetching.
2. **Integration Tests**: Expand `llmSummaryManager.integration.test.js` with "Time Travel" mocks to simulate message ages.
3. **Manual Verification**: Run on a development server with real history but `dryRun: true`.
