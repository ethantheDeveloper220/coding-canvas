# Return Pair Feature - AI Feedback Loop

## What is Return Pair?

**Return Pair** is a feature that allows you to send context/feedback back to the AI so it can retry or continue with updated information. It creates a feedback loop between the user and the AI.

## Use Cases

### 1. Tool Failed
```
AI: Creates file with wrong path
↓
Tool fails: "Permission denied"
↓
User clicks "Return to AI"
↓
Sends: "[Return Pair] Tool failed: Permission denied. Try using /tmp/ directory instead."
↓
AI receives context and retries with correct path
```

### 2. Provide More Context
```
AI: Creates basic implementation
↓
User wants more features
↓
User clicks "Return to AI"
↓
Sends: "[Return Pair] Please add error handling and logging to this function."
↓
AI enhances the implementation
```

### 3. Fix Mistakes
```
AI: Uses wrong library
↓
User notices mistake
↓
User clicks "Return to AI"
↓
Sends: "[Return Pair] Use 'axios' instead of 'fetch' for this project."
↓
AI corrects the code
```

## How to Use

### In Tool Components

Add the Return Pair button to any tool that might fail or need feedback:

```tsx
import { ReturnPairButton, useReturnPair } from './agent-return-pair-button'

export function AgentEditTool({ part, chatStatus }: AgentEditToolProps) {
  const { returnPair, isReturning } = useReturnPair(chatId, subChatId)
  const { isError, errorMessage } = getToolStatus(part, chatStatus)

  return (
    <div>
      {/* Tool content */}
      
      {isError && (
        <ReturnPairButton
          onReturnPair={returnPair}
          isLoading={isReturning}
          errorMessage={errorMessage}
        />
      )}
    </div>
  )
}
```

### In Error States

```tsx
{part.state === 'output-error' && (
  <div className="flex flex-col gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
    <span className="text-sm text-red-600 dark:text-red-400">
      {part.output?.error || 'Tool failed'}
    </span>
    <ReturnPairButton
      onReturnPair={(context) => {
        // Send error details + user context back to AI
        returnPair(`Tool failed: ${part.output?.error}. ${context}`)
      }}
      errorMessage={part.output?.error}
    />
  </div>
)}
```

### In Success States (for enhancement)

```tsx
{part.state === 'output-available' && (
  <div className="flex justify-end">
    <ReturnPairButton
      onReturnPair={returnPair}
      successMessage="File created successfully. Want to add more features?"
    />
  </div>
)}
```

## Component API

### ReturnPairButton

```tsx
interface ReturnPairButtonProps {
  onReturnPair: (context: string) => void  // Callback when user submits
  isLoading?: boolean                       // Show loading state
  errorMessage?: string                     // Pre-fill with error
  successMessage?: string                   // Pre-fill with success message
}
```

### useReturnPair Hook

```tsx
const { returnPair, isReturning } = useReturnPair(chatId, subChatId)

// returnPair: (context: string) => Promise<void>
// isReturning: boolean
```

## Message Format

When the user sends context back, it's formatted as:

```
[Return Pair] {user's context}
```

This prefix helps the AI understand that this is feedback/context for the previous action.

## Examples

### Example 1: File Creation Failed

```tsx
<ReturnPairButton
  onReturnPair={(context) => {
    returnPair(`File creation failed: ${error}. ${context}`)
  }}
  errorMessage="Permission denied: /root/file.txt"
/>
```

User input: "Try creating in /tmp/ instead"
Sent to AI: "[Return Pair] File creation failed: Permission denied: /root/file.txt. Try creating in /tmp/ instead"

### Example 2: Code Needs Improvement

```tsx
<ReturnPairButton
  onReturnPair={returnPair}
  successMessage="Code created successfully"
/>
```

User input: "Add TypeScript types and error handling"
Sent to AI: "[Return Pair] Add TypeScript types and error handling"

### Example 3: Wrong Approach

```tsx
<ReturnPairButton
  onReturnPair={(context) => {
    returnPair(`Current approach: ${part.input.approach}. ${context}`)
  }}
/>
```

User input: "Use React hooks instead of class components"
Sent to AI: "[Return Pair] Current approach: class components. Use React hooks instead of class components"

## Integration Points

### 1. Tool Error States
- Edit tool fails
- Write tool fails
- Bash command fails
- Web search returns no results

### 2. Plan Mode
- Plan step fails
- User wants to modify plan
- Need to add more steps

### 3. Question Answers
- User wants to change their answer
- Provide additional context after answering

### 4. General Chat
- User wants to clarify something
- Provide feedback on AI's response

## Benefits

1. **Faster Iteration** - No need to type full context again
2. **Error Recovery** - AI can fix mistakes with proper context
3. **Continuous Improvement** - Iterative refinement of solutions
4. **Better UX** - One-click feedback instead of manual messages

## Future Enhancements

1. **Auto-detect failures** - Automatically show Return Pair on errors
2. **Suggested contexts** - Pre-fill with common fixes
3. **History** - Show previous return pairs
4. **Templates** - Quick templates for common scenarios

---

## Quick Start

1. Import the component:
```tsx
import { ReturnPairButton, useReturnPair } from './agent-return-pair-button'
```

2. Use the hook:
```tsx
const { returnPair, isReturning } = useReturnPair(chatId, subChatId)
```

3. Add the button:
```tsx
<ReturnPairButton
  onReturnPair={returnPair}
  isLoading={isReturning}
  errorMessage={errorMessage}
/>
```

That's it! The AI will receive the context and can retry/continue accordingly.
