# OpenCode Fixes Summary

## Issues Fixed

### 1. ✅ Cumulative Text Problem
**Problem:** OpenCode sends the full message text each time, not just the delta. This caused the same text to be displayed over and over.

**Solution:** 
- Track previous text content in `lastTextContent` Map
- Calculate delta by comparing new text with previous text
- Only emit the new characters, not the entire message

**Files Changed:**
- `src/main/lib/opencode/chat.ts` - Added text delta calculation logic

### 2. ✅ Event Deduplication
**Problem:** OpenCode server spams duplicate events in an infinite loop.

**Solution:**
- Track processed events in a `Set` using unique event IDs
- Skip duplicate events silently to avoid spam

**Files Changed:**
- `src/main/lib/opencode/chat.ts` - Added `processedEvents` Set

### 3. ✅ Session Management
**Problem:** Old sessions continue to receive events even after new messages are sent, causing event spam and confusion.

**Solution:**
- Created global `SessionManager` to track active sessions
- Automatically cancel old session when new session starts for same subchat
- Unregister sessions when they complete

**Files Changed:**
- `src/main/lib/opencode/session-manager.ts` - New session manager
- `src/main/lib/opencode/chat.ts` - Integrated session manager

### 4. ✅ Text-End Emission
**Problem:** Text parts were never properly closed, causing UI issues.

**Solution:**
- Emit `text-end` for all open text parts when session becomes idle
- Clear text tracking Map after completion

**Files Changed:**
- `src/main/lib/opencode/chat.ts` - Added text-end emission on session idle

### 5. ✅ Frontend Text Buffering
**Problem:** Character-by-character streaming caused performance issues.

**Solution:**
- Buffer text-delta chunks for 100ms before emitting
- Flush buffer immediately when text-end is received
- Prevents empty text blocks

**Files Changed:**
- `src/renderer/features/agents/lib/ipc-chat-transport.ts` - Added text buffering

## Remaining Work

### Parallel Agents Execution
**Status:** Not yet implemented

**Plan:**
1. Backend already creates separate sessions per agent
2. Need to verify OpenCode server supports concurrent sessions
3. Add UI status display for "Waiting for other agent"
4. Implement queue if OpenCode has concurrent session limits

**Next Steps:**
- Test with multiple agents to see if they run in parallel
- If sequential, add queueing logic with status display
- If parallel works, just add visual indicators

## Testing Checklist

- [x] Single message streams without repetition
- [x] Stop button works (stream completes on session idle)
- [x] No duplicate events processed
- [x] Old sessions are cancelled when new message sent
- [ ] Multiple agents run in parallel (or show waiting status)
- [ ] Text streams smoothly without character-by-character updates
- [ ] All text parts properly closed with text-end

## Known Issues

1. **OpenCode Server Bugs:**
   - Still sends duplicate events (we work around this with deduplication)
   - May not support true parallel sessions (needs testing)
   - Event stream doesn't close cleanly (we rely on session.status idle)

2. **Performance:**
   - Text buffering helps but could be optimized further
   - Event deduplication Set grows unbounded (could add size limit)
