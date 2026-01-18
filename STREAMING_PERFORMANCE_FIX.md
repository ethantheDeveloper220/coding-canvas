# Streaming Performance & Animation Fixes

## Issues to Fix
1. ✅ Auto-redirect after chat creation - FIXED
2. ⚠️ Choppy streaming - needs batching
3. ⚠️ No transitions/animations
4. ⚠️ Too many re-renders

## Solutions

### 1. Batch Text Deltas (Reduce Re-renders)
**File**: `src/renderer/features/agents/lib/ipc-chat-transport.ts`

Instead of emitting every single word, batch them:

```typescript
// Add at the top of the file
let textBuffer = ''
let bufferTimeout: NodeJS.Timeout | null = null

// In the text-delta handler, replace immediate emit with buffering:
if (chunk.type === 'text-delta') {
  textBuffer += chunk.delta
  
  if (bufferTimeout) clearTimeout(bufferTimeout)
  
  bufferTimeout = setTimeout(() => {
    if (textBuffer) {
      controller.enqueue({
        type: 'text-delta',
        id: chunk.id,
        delta: textBuffer
      })
      textBuffer = ''
    }
  }, 50) // Batch every 50ms for smooth streaming
}
```

### 2. Add Smooth Transitions
**File**: `src/renderer/features/agents/ui/agent-message.tsx` (or wherever messages are rendered)

Add CSS transitions:

```css
.message-content {
  transition: all 0.2s ease-out;
}

.tool-call {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 3. Optimize Re-renders with React.memo
Wrap message components in `React.memo` to prevent unnecessary re-renders:

```typescript
export const AgentMessage = React.memo(function AgentMessage({ message }) {
  // component code
}, (prevProps, nextProps) => {
  // Only re-render if message content actually changed
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content
})
```

### 4. Use RequestAnimationFrame for Smooth Updates
For very smooth streaming, use RAF:

```typescript
let rafId: number | null = null

function smoothUpdate(delta: string) {
  if (rafId) cancelAnimationFrame(rafId)
  
  rafId = requestAnimationFrame(() => {
    // Update UI here
    rafId = null
  })
}
```

## Quick Test
After implementing these fixes:
1. Create a new chat
2. Send a message
3. Watch the response stream in smoothly with transitions
4. No choppy updates or jank

## Status
- ✅ Auto-redirect: FIXED
- ✅ Smooth streaming: FIXED - Text batching implemented (100ms chunks)
- ⏳ Transitions: Needs CSS/animation implementation
- ⏳ Re-render optimization: Needs React.memo implementation
