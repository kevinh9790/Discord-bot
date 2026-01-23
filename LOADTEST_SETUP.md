# Load Test Setup Guide

## Overview
The load test feature allows admins to generate realistic gamedev conversations using Discord webhooks to test the LLM summary feature.

## Setup Steps

### 1. Enable in .env
```env
LOAD_TEST_ENABLED=true
LOAD_TEST_CHANNELS=<channel-id-1>,<channel-id-2>
```

**Note:** `LOAD_TEST_CHANNELS` is optional. If not set, the bot will allow load tests in any channel with "test" in its name.

### 2. Create Test Channel
Create a Discord channel named something like `#loadtest-channel` or `#test-llm`.

### 3. Get Channel ID (if using whitelist)
1. Enable Developer Mode in Discord (User Settings → App Settings → Developer Mode)
2. Right-click the test channel
3. Copy Channel ID
4. Add to `.env`: `LOAD_TEST_CHANNELS=<channel-id>`

## Usage

### Basic Usage
```
&loadtest
```
Runs default test with 3 users, medium speed, unity-technical preset.

### With Parameters
```
&loadtest users=4 rate=slow preset=resource-sharing
```

### Parameter Options

| Parameter | Values | Default | Notes |
|-----------|--------|---------|-------|
| `users` | 2-8 | 3 | Number of simulated users |
| `rate` | slow, medium, fast | medium | Message sending speed |
| `preset` | unity-technical, resource-sharing | unity-technical | Conversation template |

### Example Commands
```
# Resource sharing test with 4 users
&loadtest preset=resource-sharing users=4

# Slow-paced Unity technical discussion
&loadtest preset=unity-technical rate=slow

# Quick test with 3 users at fast rate
&loadtest rate=fast
```

## Presets

### Unity Technical (unity-technical)
- **Users:** 3 (beginner, expert, contributor)
- **Messages:** 10
- **Topic:** Unity 2D lighting setup and troubleshooting
- **Duration:** ~50 seconds
- **Content:** Technical discussion with code examples and official docs links

### Resource Sharing (resource-sharing)
- **Users:** 4 (developers and designer)
- **Messages:** 11
- **Topic:** Game dev tools, sprite resources, and learning materials
- **Duration:** ~50 seconds
- **Content:** Realistic resource recommendations with URLs

## How It Works

1. Bot creates temporary webhooks for each simulated user
2. Messages are sent with natural timing and variation
3. All messages have `[TEST]` prefix to identify them as test messages
4. After completion, all messages and webhooks are automatically deleted
5. A report shows:
   - Messages sent
   - Users simulated
   - Execution time
   - LLM trigger rule estimation

## LLM Trigger Rules

The test estimates whether rules for LLM detection would fire:

- **Rule 1:** 3+ users, 10+ messages (✅ resource-sharing and unity-technical both trigger)
- **Rule 2:** 4+ users, 8+ messages (✅ resource-sharing triggers if users=4+)

## Safety Features

- ✅ **Admin-only:** Requires administrator permissions
- ✅ **Channel whitelist:** Can restrict to specific test channels
- ✅ **Test prefix requirement:** Channel must contain "test" if no whitelist
- ✅ **Auto-cleanup:** All messages deleted after test
- ✅ **Timeout protection:** Aborts after 30 minutes
- ✅ **Rate limiting:** Respects Discord API limits

## Troubleshooting

### "功能未啟用" (Feature not enabled)
- Set `LOAD_TEST_ENABLED=true` in `.env`
- Restart the bot

### "此頻道不在允許的測試頻道名單中" (Channel not whitelisted)
- Either add channel ID to `LOAD_TEST_CHANNELS` or ensure channel name includes "test"

### "建立 webhook 失敗" (Webhook creation failed)
- Ensure bot has "Manage Webhooks" permission in the channel
- Check if webhook limit exceeded (Discord allows 10 per channel)

### "傳送訊息時出錯" (Message sending error)
- Check Discord API rate limits
- Verify webhook permissions

## Testing the LLM Integration

After running `&loadtest`, check:

1. **Admin Approval Channel** receives a notification with:
   - Conversation summary
   - Category detection (should be "technics" or "resource")
   - Confidence score
   - Approval/rejection buttons

2. **Conversation appears in context**
   - LLM should recognize it as gamedev conversation
   - Should classify correctly based on content

3. **Summary is generated** (if approved)
   - Posted to LLM_SUMMARY_CHANNEL
   - Contains key discussion points
   - Includes participant usernames

## Notes

- Test messages are prefixed with `[TEST]` for easy identification
- Messages use Traditional Chinese to match server language
- Conversations are realistic and cover actual gamedev topics
- Multiple test runs can be done sequentially
- The bot respects Discord's webhook API limits

## Commands Reference

```bash
# View available presets
# Available: unity-technical, resource-sharing

# Estimate impact before running
# Rule 1: 3+ users, 10+ messages (most presets pass)
# Rule 2: 4+ users, 8+ messages (resource-sharing with users=4)
```
