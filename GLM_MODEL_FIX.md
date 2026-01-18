# GLM Model Fix - Auto-routing to OpenCode

## Issue

When using GLM 4.7 (or any non-Claude model), the app was trying to use the Claude Agent SDK, which resulted in a 404 error:

```
API Error: 404 {"status":404,"error":"Not Found","path":"/v4/v1/messages"}
```

The Claude Agent SDK only supports Anthropic's Claude models and was incorrectly trying to route GLM requests through `/v4/v1/messages`.

## Root Cause

The app has two backends:
1. **Claude Agent SDK** - For Anthropic Claude models (claude-opus, claude-sonnet, etc.)
2. **OpenCode** - For all models including GLM, GPT, and other providers

Previously, the routing logic only checked `agentType === 'opencode'` to decide which backend to use. When you selected GLM 4.7 as the model but didn't explicitly select the OpenCode agent, it tried to use the Claude SDK, which doesn't support GLM.

## Solution

Added automatic model-based routing logic that detects non-Claude models and routes them to OpenCode automatically.

### Changes Made

#### 1. Auto-routing Logic (`src/main/lib/trpc/routers/claude.ts`)

```typescript
// Detect if model is a non-Claude model (should use OpenCode)
const isNonClaudeModel = input.model && !input.model.startsWith('claude-')

// Check if OpenCode agent is selected OR non-Claude model is used
if (input.agentType === 'opencode' || isNonClaudeModel) {
  if (isNonClaudeModel) {
    console.log(`[OpenCode] Auto-routing to OpenCode for non-Claude model: ${input.model}`)
  } else {
    console.log('[OpenCode] Routing to OpenCode API (STREAMING)')
  }
  // ... route to OpenCode
}
```

**How it works:**
- Checks if the selected model starts with `'claude-'`
- If not, automatically routes to OpenCode
- Logs the auto-routing for debugging

#### 2. API Base URL Fix (`src/main/lib/claude/env.ts`)

Added safeguard to ensure correct Anthropic API endpoint:

```typescript
// Ensure correct Anthropic API base URL (fix for /v4/v1/messages 404 error)
if (env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL.includes('/v4')) {
  console.warn('[claude-env] Removing /v4 from ANTHROPIC_BASE_URL:', env.ANTHROPIC_BASE_URL)
  delete env.ANTHROPIC_BASE_URL
}
// Explicitly set to standard Anthropic API if not set
if (!env.ANTHROPIC_BASE_URL) {
  env.ANTHROPIC_BASE_URL = "https://api.anthropic.com"
}
```

**Why this helps:**
- Prevents misconfigured environment variables from causing 404 errors
- Ensures Claude SDK uses the correct API endpoint

## Supported Models

### Claude Models (use Claude Agent SDK)
- `claude-opus-4-5-20251101`
- `claude-sonnet-4-20250514`
- `claude-sonnet-3-5-20241022`
- Any model starting with `claude-`

### Non-Claude Models (auto-route to OpenCode)
- `glm-4-plus` (GLM 4.7)
- `gpt-4`, `gpt-3.5-turbo` (OpenAI)
- `gemini-pro` (Google)
- Any custom model not starting with `claude-`

## Testing

After this fix:

1. ✅ Select GLM 4.7 as your model
2. ✅ Send a message
3. ✅ Check console for: `[OpenCode] Auto-routing to OpenCode for non-Claude model: glm-4-plus`
4. ✅ Message should stream successfully through OpenCode

## Benefits

1. **Automatic routing** - No need to manually select OpenCode agent when using non-Claude models
2. **Better error handling** - Prevents 404 errors from incorrect API routing
3. **Clearer logging** - Shows when and why auto-routing happens
4. **Future-proof** - Any new non-Claude model will automatically work

## Rollback

If you need to revert:

```typescript
// In src/main/lib/trpc/routers/claude.ts, change line ~301 back to:
if (input.agentType === 'opencode') {
  console.log('[OpenCode] Routing to OpenCode API (STREAMING)')
```

## Related Files

- `src/main/lib/trpc/routers/claude.ts` - Main routing logic
- `src/main/lib/claude/env.ts` - Environment configuration
- `src/main/lib/opencode/chat.ts` - OpenCode chat handler

## Notes

- OpenCode supports all the same features as Claude SDK (tools, streaming, etc.)
- The auto-routing is transparent to the user
- Both backends use the same UI components
- Session management works the same way for both backends

## Next Steps

If you want to add more custom models:

1. Add them to your OpenCode configuration
2. They will automatically work with this routing logic
3. No code changes needed!
