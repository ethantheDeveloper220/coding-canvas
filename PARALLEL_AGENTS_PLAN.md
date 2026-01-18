# Parallel Agent Execution Plan

## Current Issues
1. **OpenCode server spamming events** - Infinite loop of duplicate `message.part.updated` events
2. **Stream error state** - AI SDK transitions to error after 5 chunks
3. **Sequential execution** - Agents appear to wait for each other instead of running in parallel

## Goal
Make agents run in parallel like Cursor, with status showing "Waiting for other task" when appropriate.

## Implementation Plan

### Phase 1: Fix Stream Errors (CRITICAL)
**Status: IN PROGRESS**

Issues fixed so far:
- ✅ Duplicate subscription handling
- ✅ Text buffer flushing before text-end
- ✅ Removed manual controller.close()

Still needed:
- ❌ Event deduplication to handle OpenCode server spam
- ❌ Proper stream completion handling

### Phase 2: Add Event Deduplication
**Status: NOT STARTED**

Add logic to track and skip duplicate events from OpenCode server:
```typescript
const processedEvents = new Map<string, Set<string>>() // sessionId -> Set of event IDs

// In onData handler:
const eventId = `${chunk.sessionID}-${chunk.messageID}-${chunk.type}-${chunk.callID}`
if (processedEvents.get(sessionId)?.has(eventId)) {
  console.log(`[SD] SKIP_DUPLICATE event=${eventId}`)
  return // Skip duplicate event
}
```

### Phase 3: Parallel Execution Support
**Status: NOT STARTED**

Backend already creates separate sessions per agent. Need to:

1. **Track active sessions globally**
   - Create a global map of active OpenCode sessions
   - Check if other sessions are running before starting new one

2. **Add "Waiting" status**
   - When a new agent starts, check if another is already running
   - Show "Waiting for other task to complete" status
   - Once the other task completes, start this one

3. **Alternative: True Parallel**
   - Remove any sequential locks in the backend
   - Let all sessions run simultaneously
   - OpenCode server should handle this natively

### Phase 4: UI Status Display
**Status: NOT STARTED**

Add visual indicator in the UI:
- Show "⏳ Waiting for other agent..." when queued
- Show "🔄 Running..." when active
- Show "✅ Complete" when done

## Next Steps

1. **Immediate**: Add event deduplication to stop the spam
2. **Short-term**: Implement waiting status display
3. **Long-term**: Investigate OpenCode server parallel execution limits

## Notes

The OpenCode server may have a built-in limit on concurrent sessions. If so, we need to:
- Queue agents on the client side
- Show waiting status
- Start next agent when previous completes

Alternatively, if OpenCode supports true parallelism:
- Remove any client-side queuing
- Let all agents run simultaneously
- OpenCode server handles the load balancing
