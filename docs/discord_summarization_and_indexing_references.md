# Discord Summarization & Indexing References

This document lists open-source projects, repositories, libraries, and legal compliance references for building conversation summarization, semantic search, and RAG (Retrieval-Augmented Generation) systems for Discord.

---

## 📂 Open-Source GitHub Repositories

### 1. Dialogue Disentanglement & Threading
*   **[CODI (Conversation Disentanglement as a Service)](https://github.com/USIREVEAL/CODI)**
    *   *Description:* A microservice exposing conversation disentanglement APIs. Very useful if you want to integrate a pre-built disentanglement model into your Discord bot environment.
*   **[irc-disentanglement (Kummerfeld et al.)](https://github.com/jkkummerfeld/irc-disentanglement)**
    *   *Description:* The classic benchmark implementation and dataset for dialogue disentanglement research.
*   **[CluCDD (Contrastive Dialogue Disentanglement)](https://github.com/gaojingsheng/CluCDD)**
    *   *Description:* A modern, contrastive learning-based approach to separating interleaved chat logs into coherent threads.

### 2. RAG & Semantic Search Bots
*   **[discord_knowledge_bot](https://github.com/lets-getitnow/discord_knowledge_bot)**
    *   *Description:* A local RAG bot using ChromaDB and local `sentence-transformers`. Excellent reference for keeping data and embeddings completely offline.
*   **[discontext](https://github.com/f0lio/discontext)**
    *   *Description:* A semantic search bot for Discord using Qdrant vector database and OpenAI embeddings.
*   **[discord-rag](https://github.com/antoinelrnld/discord-rag)**
    *   *Description:* Ingestion pipeline and Discord bot structure for creating a RAG application over server messages using MongoDB and LangChain.
*   **[ragtime](https://github.com/vectara/ragtime)**
    *   *Description:* Multi-channel (Slack/Discord) bot leveraging the Vectara engine for document and log search.

---

## 🛠️ Key Technologies for Local Implementations

*   **Embeddings & Local Models:**
    *   **[@xenova/transformers](https://github.com/xenova/transformers.js):** Running embedding models (like `all-MiniLM-L6-v2`) natively inside Node.js using ONNX Runtime.
*   **Vector Storage:**
    *   **ChromaDB:** A developer-friendly, lightweight vector database that can run locally as an in-memory process.
    *   **Qdrant / Milvus / FAISS:** Better choices for larger-scale indexing.

---

## ⚖️ Legal & Compliance Summary

### 1. Dashboard Access Control
*   **Public Display:** Strictly prohibited by Discord Developer Policy. You cannot show user messages or metadata on a public site without explicit user consent.
*   **OAuth2 Private Access:** Fully compliant. Restrict access to your dashboard using Discord OAuth2, ensuring users can only search or view summaries for channels they have permission to access natively in Discord.

### 2. GDPR Data Erasure (Right to be Forgotten)
When a user requests their data be deleted, you must:
1.  **Delete raw data:** Wipe their message logs, database records, and user metadata from your cache/database.
2.  **Sanitize summaries:** Either delete generated summaries that mention them or anonymize their names/nicknames (e.g., replace `bogay` with `[Developer]`).
3.  **Plaintext Mentions:** Take reasonable technical steps (like case-insensitive Regex with word boundaries `\b`) to remove their nickname/username from third-party messages. You do not need to delete the third-party messages themselves, as that constitutes "disproportionate effort" and corrupts unrelated data.
