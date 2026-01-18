# Smart Suggestions Feature

## Overview

Smart Suggestions appear above the prompt box and provide contextual quick actions based on:
- Recent file changes
- Error states
- Last user message
- Current chat context

The suggestions **automatically update** when the database changes (new messages, file operations, errors).

## Features

### 1. Context-Aware Suggestions
- **File Operations**: "Review recent changes", "Explain what changed"
- **Errors**: "Fix the errors", "Help me debug this"
- **Code Changes**: "Add tests for this", "Add documentation"
- **General**: "Create a new file", "Refactor this code"

### 2. Auto-Refresh
- Listens for database updates
- Refreshes suggestions when new messages arrive
- Updates when file operations complete
- Responds to error states

### 3. Category-Based Styling
- 🔵 **File** operations (blue)
- 🟢 **Code** suggestions (green)
- 🔴 **Debug** help (red)
- ⚪ **General** actions (default)

## Usage

### In Active Chat

```tsx
import { SmartSuggestions, useSuggestionsContext } from '../ui/smart-suggestions'
import { trpcClient } from '../../../lib/trpc'

export function ActiveChat({ chatId }: { chatId: string }) {
  // Get context from database
  const { data: context } = trpcClient.chats.getSuggestionsContext.useQuery({ chatId })

  const handleSuggestionClick = (text: string) => {
    // Send suggestion as message
    sendMessage(text)
  }

  return (
    <div>
      {/* Chat messages */}
      
      {/* Smart Suggestions above input */}
      <SmartSuggestions
        chatId={chatId}
        onSuggestionClick={handleSuggestionClick}
        context={context}
      />
      
      {/* Chat input */}
    </div>
  )
}
```

### In New Chat Form

```tsx
import { SmartSuggestions } from '../ui/smart-suggestions'

export function NewChatForm() {
  const [input, setInput] = useState('')

  const handleSuggestionClick = (text: string) => {
    setInput(text)
  }

  return (
    <div>
      {/* Default suggestions for new chat */}
      <SmartSuggestions
        onSuggestionClick={handleSuggestionClick}
        context={{}} // Empty context = default suggestions
      />
      
      <input value={input} onChange={(e) => setInput(e.target.value)} />
    </div>
  )
}
```

## Backend API

### getSuggestionsContext

Returns context data for generating suggestions:

```typescript
const context = await trpcClient.chats.getSuggestionsContext.query({ chatId })

// Returns:
{
  hasFiles: boolean          // Has file operations
  hasErrors: boolean         // Has errors in tools
  lastMessage: string        // Last user message
  recentChanges: string[]    // Last 3 changed files
}
```

### Example Response

```json
{
  "hasFiles": true,
  "hasErrors": false,
  "lastMessage": "create a todo app",
  "recentChanges": [
    "src/App.tsx",
    "src/components/TodoList.tsx",
    "src/types.ts"
  ]
}
```

## Suggestion Generation Logic

### With File Changes
```
hasFiles: true
recentChanges: ["App.tsx", "TodoList.tsx"]
↓
Suggestions:
- "Review recent changes"
- "Explain what changed"
- "Continue working on App.tsx"
```

### With Errors
```
hasErrors: true
↓
Suggestions:
- "Fix the errors"
- "Help me debug this"
```

### After Creating Code
```
lastMessage: "create a login component"
↓
Suggestions:
- "Add tests for this"
- "Add documentation"
```

### Default (No Context)
```
No specific context
↓
Suggestions:
- "Create a new file"
- "Explain this codebase"
- "Refactor this code"
- "Add a new feature"
```

## Database Update Events

The component listens for `db-update` events:

```typescript
// Emit when database updates
window.dispatchEvent(new CustomEvent('db-update', {
  detail: { chatId, type: 'message' | 'file' | 'error' }
}))
```

### When to Emit

1. **New Message**: After message saved to DB
2. **File Operation**: After Write/Edit tool completes
3. **Error Occurs**: After tool fails
4. **Chat Updated**: After any chat modification

## Styling

### Category Colors

```tsx
// File operations
border-blue-500/30 text-blue-600

// Code suggestions
border-green-500/30 text-green-600

// Debug help
border-red-500/30 text-red-600

// General
border-border text-foreground
```

### Layout

```
┌─────────────────────────────────────┐
│ ✨ Suggestions              [Hide]  │
│                                      │
│ [Review changes] [Explain changes]  │
│ [Add tests] [Add docs]               │
└─────────────────────────────────────┘
│                                      │
│ Type a message...                    │
└─────────────────────────────────────┘
```

## Integration Points

### 1. Active Chat
- Above chat input
- Updates on new messages
- Context from current chat

### 2. New Chat Form
- Default suggestions
- Helps users get started
- No chat context needed

### 3. Sub-Chat
- Context from parent chat
- Inherits file changes
- Shows relevant suggestions

## Examples

### Example 1: After File Creation

```
User: "create App.tsx"
AI: Creates file
↓
Database updates
↓
Suggestions refresh:
- "Review recent changes"
- "Add tests for this"
- "Continue working on App.tsx"
```

### Example 2: After Error

```
AI: Tool fails with error
↓
Database updates (hasErrors: true)
↓
Suggestions refresh:
- "Fix the errors"
- "Help me debug this"
```

### Example 3: New Chat

```
User opens new chat
↓
No context
↓
Default suggestions:
- "Create a new file"
- "Explain this codebase"
- "Refactor this code"
- "Add a new feature"
```

## Future Enhancements

1. **AI-Generated Suggestions**: Use AI to generate custom suggestions
2. **User Preferences**: Remember frequently used suggestions
3. **Project-Specific**: Suggestions based on project type
4. **Time-Based**: Different suggestions based on time of day
5. **Keyboard Shortcuts**: Quick access with Tab/Arrow keys

---

## Quick Start

1. **Add to chat component**:
```tsx
import { SmartSuggestions } from '../ui/smart-suggestions'
```

2. **Fetch context**:
```tsx
const { data: context } = trpcClient.chats.getSuggestionsContext.useQuery({ chatId })
```

3. **Render above input**:
```tsx
<SmartSuggestions
  chatId={chatId}
  onSuggestionClick={handleSuggestionClick}
  context={context}
/>
```

That's it! Suggestions will appear and auto-update! ✨
