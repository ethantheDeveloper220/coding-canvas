# Streaming Debug Guide

## Issue Summary

The app is not sending responses - the streaming completes immediately after initialization without any actual response content.

## What's Happening

From the logs, we can see:

```
[MCP Transform] Received SDK init message: { tools: 17, mcp_servers: [], plugins: [], skills: 0 }
[SD] M:END sub=c5nsogrp reason=sdk_error cat=SDK_ERROR n=3
```

This means:
1. The SDK initializes successfully (sends init message with tools)
2. Immediately after (after only 3 chunks: start, start-step, session-init)
3. The SDK sends an error message
4. The stream ends with `sdk_error`

## Root Cause

The Claude Agent SDK is sending an error message immediately after initialization. The error is being caught at line 952-1010 in `src/main/lib/trpc/routers/claude.ts`:

```typescript
if (msgAny.type === "error" || msgAny.error) {
  const sdkError = msgAny.error || msgAny.message || "Unknown SDK error"
  // ... error handling ...
}
```

## Changes Made

### 1. Added Better Error Logging

**File**: `src/main/lib/trpc/routers/claude.ts` (line ~955)

Added detailed logging to see the actual error:

```typescript
// Log the full error message for debugging
console.error(`[CLAUDE] SDK Error detected:`, JSON.stringify(msgAny, null, 2))
```

### 2. Fixed Security Warnings (Unrelated but Important)

**Files**: 
- `src/main/windows/main.ts` - Enabled webSecurity, removed insecure flags
- `src/renderer/index.html` - Removed 'unsafe-eval' from CSP

See `ELECTRON_SECURITY_FIXES.md` for details.

## Next Steps to Debug

1. **Restart the dev server** to apply the new logging
2. **Send a message** in the app
3. **Check the console** for the new error log that starts with `[CLAUDE] SDK Error detected:`
4. **Look for the actual error message** in the logged JSON

## Possible Causes

Based on the error categories in the code, the SDK error could be:

1. **Authentication Failed** (`AUTH_FAILED_SDK`)
   - Not logged into Claude Code CLI
   - Solution: Run `claude login` in terminal

2. **Invalid API Key** (`INVALID_API_KEY_SDK`)
   - API key in CLI configuration is invalid
   - Solution: Check `~/.claude.json` or environment variables

3. **Rate Limit** (`RATE_LIMIT_SDK`)
   - Too many requests
   - Solution: Wait and try again

4. **Overloaded** (`OVERLOADED_SDK`)
   - Claude service is busy
   - Solution: Try again later

5. **Generic SDK Error** (`SDK_ERROR`)
   - Unknown error from SDK
   - Need to see the actual error message to diagnose

## How to Check Authentication

### Check if Claude Code CLI is authenticated:

```bash
# Check if credentials exist
cat ~/.claude.json

# Or try running Claude Code directly
claude --version
```

### Check environment variables:

```bash
# Check for API key
echo $ANTHROPIC_API_KEY

# Check for other Claude-related vars
env | grep CLAUDE
env | grep ANTHROPIC
```

## Logs Location

Raw SDK messages are logged to:
- **Development**: `{userData}/logs/claude/*.jsonl`
- **Windows**: `%APPDATA%/Agents Dev/logs/claude/`
- **macOS**: `~/Library/Application Support/Agents Dev/logs/claude/`
- **Linux**: `~/.config/Agents Dev/logs/claude/`

Each log file is named: `{sessionId}_{timestamp}.jsonl`

## Testing the Fix

1. Stop the current dev server (Ctrl+C in terminal 4)
2. Restart: `npm run dev`
3. Send a test message
4. Look for `[CLAUDE] SDK Error detected:` in the console
5. Report back with the full error JSON

## Code References

### Error Detection
```1code-main/src/main/lib/trpc/routers/claude.ts
// Line ~950-1010
if (msgAny.type === "error" || msgAny.error) {
  const sdkError = msgAny.error || msgAny.message || "Unknown SDK error"
  lastError = new Error(sdkError)
  
  // Log the full error message for debugging
  console.error(`[CLAUDE] SDK Error detected:`, JSON.stringify(msgAny, null, 2))
  
  // Categorize and handle error...
}
```

### SDK Import
```1code-main/src/main/lib/trpc/routers/claude.ts
// Line 160-163
const getClaudeQuery = async () => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk")
  return sdk.query
}
```

### Error Categories
```1code-main/src/renderer/features/agents/lib/ipc-chat-transport.ts
// Line 22-86
const ERROR_TOAST_CONFIG: Record<string, {...}> = {
  AUTH_FAILED_SDK: {...},
  INVALID_API_KEY_SDK: {...},
  RATE_LIMIT_SDK: {...},
  OVERLOADED_SDK: {...},
  // ... etc
}
```

## Related Files

- `src/main/lib/trpc/routers/claude.ts` - Main Claude SDK integration
- `src/main/lib/claude/transform.ts` - Message transformation
- `src/main/lib/claude/env.ts` - Environment setup for SDK
- `src/renderer/features/agents/lib/ipc-chat-transport.ts` - Error handling in UI
- `src/renderer/features/agents/main/active-chat.tsx` - Chat UI component

## Questions to Answer

1. What is the actual error message from the SDK?
2. Is Claude Code CLI authenticated?
3. Is there an API key configured?
4. Are there any MCP server errors?
5. Is the binary path correct?

Once we see the actual error message, we can provide a targeted fix.
