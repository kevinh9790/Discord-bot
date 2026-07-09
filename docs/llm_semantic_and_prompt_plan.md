# LLM Module Improvements: Semantic Deduplication & Prompt Versioning

This document outlines the design and implementation plan for improving the LLM modules of the GameNightCastle Bot, specifically focusing on Semantic Deduplication (#4) and Prompt Versioning/A/B Testing (#6).

---

## 1. Semantic Deduplication (#4)

### Current Problem
Currently, we use "Anchor Fingerprinting" (MD5 hash of message IDs). If a single message is added or deleted from a conversation, the fingerprint changes, potentially leading to duplicate summaries of the same ongoing discussion.

### Proposed Solution: "Title-Based Semantic Check"
Instead of (or in addition to) ID hashing, we will maintain a list of recently generated summary titles and use the LLM to verify if a "new" discussion is actually a continuation of a previously summarized one.

#### Implementation Steps:
1.  **State Update**: Update `llmSummaryState.json` to store `recentSummaryTitles` (limit to last 50-100).
2.  **Deduplication Hook**: In `llmSummaryManager.js`, after the `quickRelevanceCheck` and before creating a pending summary:
    *   Compare the new topic/preview against `recentSummaryTitles`.
    *   If a potential match is found, call a new `llmService.checkSemanticDuplicate(newContext, existingTitles)` function.
3.  **LLM Logic**: The LLM will receive the new conversation preview and a list of recent titles. It will return a boolean indicating if it's a duplicate.

---

## 2. Prompt Versioning & A/B Testing (#6)

### Current Problem
Prompts are static files (`config/prompts/*.txt`). Updating a prompt overwrites the old one, making it impossible to roll back or compare performance (A/B testing) between different prompt engineering strategies.

### Proposed Solution: "Prompt Manager & Manifest"
Introduce a structured prompt management system that supports versions and weighted A/B testing.

#### Implementation Steps:
1.  **Directory Structure Change**:
    ```
    config/prompts/
    ├── relevanceCheck/
    │   ├── v1.txt
    │   └── v2.txt
    ├── comprehensiveSummary/
    │   └── v1.txt
    └── manifest.json
    ```
2.  **Manifest Format**:
    ```json
    {
      "relevanceCheck": {
        "active": "v2",
        "ab_test": {
          "enabled": true,
          "variants": {
            "v1": 0.5,
            "v2": 0.5
          }
        }
      }
    }
    ```
3.  **Prompt Manager Utility**: Create `utils/promptManager.js` to:
    *   Read the manifest.
    *   Select the prompt version based on weights (A/B testing).
    *   Track which version was used in the `llmSummaryState.json` (for performance analysis).

---

## 3. Integration Plan

1.  **Create `utils/promptManager.js`**: Centralize all prompt loading.
2.  **Refactor `llmService.js`**: Update it to use `promptManager` instead of direct `fs.readFileSync`.
3.  **Update `llmSummaryManager.js`**: 
    *   Implement the semantic duplicate check.
    *   Update the state persistence to include metadata about which prompt version was used.
4.  **Admin Feedback Loop**: Update the Admin Approval embed to show the prompt version used (e.g., `Prompt: relevanceCheck@v2`), allowing admins to notice if one version is performing better.

---

## 4. Expected Benefits
*   **Reduced Redundancy**: Fewer duplicate "Pending Approval" items for the same long-running discussion.
*   **Data-Driven Optimization**: Ability to scientifically prove that Prompt B is better than Prompt A by tracking "Approval Rate" per version.
*   **Safe Iteration**: Quickly roll back to a previous prompt version by changing a single field in `manifest.json`.
