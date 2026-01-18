# OpenCode API Integration Implementation Guide

## Current Status
The UI has an agent selector that switches between "Claude Code" and "OpenCode", but the backend still tries to use the Claude SDK binary for all execution.

## Required Changes

### 1. Frontend Changes

#### A. Add Agent Type to Atoms (`src/renderer/features/agents/atoms.ts`)
```typescript
export const lastSelectedAgentIdAtom = atomWithStorage<string>(
  'lastSelectedAgentId',
  'claude-code'
)
```

#### B. Pass Agent Type to Transport (`src/renderer/features/agents/lib/ipc-chat-transport.ts`)
Add `agentType` to the config:
```typescript
type IPCChatTransportConfig = {
  chatId: string
  subChatId: string
  cwd: string
  mode: "plan" | "agent"
  model?: string
  agentType?: string  // ADD THIS
}
```

Pass it in the subscription:
```typescript
const sub = trpcClient.claude.chat.subscribe(
  {
    // ... existing fields
    agentType: this.config.agentType,  // ADD THIS
  },
  // ...
)
```

#### C. Update Transport Creation (`src/renderer/features/agents/main/active-chat.tsx`)
Lines 3704 and 3830 - add agentType:
```typescript
const selectedAgentId = appStore.get(lastSelectedAgentIdAtom)

const transport = new IPCChatTransport({
  chatId,
  subChatId,
  cwd: worktreePath,
  mode: subChatMode,
  agentType: selectedAgentId,  // ADD THIS
})
```

### 2. Backend Changes

#### A. Update TRPC Input Schema (`src/main/lib/trpc/routers/claude.ts`)
Line 95-107, add agentType:
```typescript
.input(
  z.object({
    subChatId: z.string(),
    chatId: z.string(),
    prompt: z.string(),
    cwd: z.string(),
    mode: z.enum(["plan", "agent"]).default("agent"),
    sessionId: z.string().optional(),
    model: z.string().optional(),
    maxThinkingTokens: z.number().optional(),
    images: z.array(imageAttachmentSchema).optional(),
    agentType: z.string().optional(),  // ADD THIS
  }),
)
```

#### B. Add OpenCode Execution Logic (`src/main/lib/trpc/routers/claude.ts`)
After line 172, add routing logic:
```typescript
;(async () => {
  try {
    // Check if OpenCode agent is selected
    if (input.agentType === 'opencode') {
      // Route to OpenCode API instead of Claude SDK
      await runOpenCodeChat({
        input,
        emit: safeEmit,
        emitError,
        safeComplete,
        abortController,
      })
      return
    }

    // Otherwise, use existing Claude SDK logic
    const db = getDatabase()
    // ... rest of existing code
```

#### C. Create OpenCode Chat Handler (`src/main/lib/opencode/chat.ts` - NEW FILE)
```typescript
import { getOpenCodeUrl } from '../opencode-state'

export async function runOpenCodeChat(options: {
  input: any
  emit: (chunk: any) => boolean
  emitError: (error: unknown, context: string) => void
  safeComplete: () => void
  abortController: AbortController
}) {
  const { input, emit, emitError, safeComplete, abortController } = options

  try {
    const apiUrl = getOpenCodeUrl()
    const apiKey = 'csb_v1_WxklWdEqoHS_6ba92VUclLZrbibLvEWa8ssF0zvdtc0'

    // Build OpenCode API request
    const response = await fetch(`${apiUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model || 'opencode/gpt-4o',
        messages: [
          {
            role: 'user',
            content: input.prompt,
          },
        ],
        stream: true,
        max_tokens: 4096,
      }),
      signal: abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`OpenCode API error: ${response.status}`)
    }

    // Handle streaming response
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue
        
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          
          // Map OpenCode response to UI chunks
          if (parsed.type === 'content_block_delta') {
            emit({
              type: 'text-delta',
              text: parsed.delta?.text || '',
            })
          } else if (parsed.type === 'message_stop') {
            emit({ type: 'finish' })
          }
        } catch (e) {
          console.warn('Failed to parse SSE line:', line)
        }
      }
    }

    safeComplete()
  } catch (error) {
    emitError(error, 'OpenCode execution failed')
    safeComplete()
  }
}
```

#### D. Store API Key (`src/main/lib/opencode-state.ts`)
```typescript
let openCodeApiKey: string | null = 'csb_v1_WxklWdEqoHS_6ba92VUclLZrbibLvEWa8ssF0zvdtc0'

export const getOpenCodeApiKey = () => openCodeApiKey
export const setOpenCodeApiKey = (key: string) => {
    openCodeApiKey = key
}
```

### 3. Tool Calling Support (Future Enhancement)
OpenCode uses Anthropic's tool calling format. When tools are needed:
1. Detect `tool_use` blocks in the response
2. Execute tools using existing tool handlers
3. Send tool results back to OpenCode API
4. Continue streaming

## Testing Steps
1. Start OpenCode server on port 52313
2. Select "OpenCode" agent in the UI
3. Send a message
4. Verify it routes to OpenCode API instead of Claude SDK
5. Check streaming works correctly
6. Test with different models

## Files to Modify
- `src/renderer/features/agents/atoms.ts`
- `src/renderer/features/agents/lib/ipc-chat-transport.ts`
- `src/renderer/features/agents/main/active-chat.tsx`
- `src/main/lib/trpc/routers/claude.ts`
- `src/main/lib/opencode-state.ts`
- `src/main/lib/opencode/chat.ts` (NEW)
