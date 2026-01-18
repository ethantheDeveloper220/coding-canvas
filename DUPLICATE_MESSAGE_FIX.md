# Duplicate Message Fix

## Problem
The AI was displaying and responding with the same message multiple times. This was caused by:

1. **Frontend subscription not being cleaned up**: When a chat stream completed or errored, the subscription wasn't being removed from the `activeSubscriptions` Set, causing duplicate subscriptions to be created.

2. **Backend activeChats not being cleaned up on unsubscribe**: When a subscription was cancelled/unsubscribed, the `activeChats` Set wasn't being cleaned up, preventing new subscriptions from being created properly.

## Solution

### Frontend Fix (ipc-chat-transport.ts)

Fixed the subscription cleanup in multiple places:

1. **onComplete handler** (line ~453-490):
   - Moved `activeSubscriptions.delete()` to the TOP of the handler (before trying to enqueue)
   - This ensures the subscription is always cleaned up, even if enqueue fails
   - Removed the cleanup from the `finally` block since it's now at the top

2. **onError handler** (line ~432-451):
   - Added `activeSubscriptions.delete()` to clean up on errors
   - This allows retrying after an error

3. **error chunk handler** (line ~324-378):
   - Added `activeSubscriptions.delete()` when receiving error chunks
   - This allows retrying after stream errors

4. **auth-error handler** (line ~297-321):
   - Added `activeSubscriptions.delete()` when authentication fails
   - This allows retrying after successful authentication

### Backend Fix (claude.ts)

Fixed the `activeChats` Set cleanup:

1. **Unsubscribe handler** (line ~1338-1355):
   - Added `activeChats.delete(input.subChatId)` to clean up when subscription is cancelled
   - This was the CRITICAL missing piece - without this, the backend would reject new subscriptions thinking the chat was still active

## Files Changed

1. `src/renderer/features/agents/lib/ipc-chat-transport.ts`
   - Fixed frontend subscription cleanup in 4 places

2. `src/main/lib/trpc/routers/claude.ts`
   - Fixed backend activeChats cleanup in unsubscribe handler

## Testing

To verify the fix:

1. Start a chat and send a message
2. Wait for the response to complete
3. Send another message - it should NOT show duplicate responses
4. Try cancelling a message mid-stream and sending a new one - should work without duplicates
5. Try triggering an error (e.g., invalid API key) and retrying - should work without duplicates

## Root Cause

The root cause was that both the frontend and backend were tracking active subscriptions/chats, but weren't cleaning up properly in all code paths. This caused:

- Frontend: Duplicate subscriptions being rejected (but still creating empty streams)
- Backend: New subscriptions being rejected because the old one was still marked as "active"

The fix ensures that BOTH the frontend and backend properly clean up their tracking Sets in ALL code paths (success, error, cancel, auth failure, etc.).
