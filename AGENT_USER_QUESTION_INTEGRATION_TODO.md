# AgentUserQuestion Integration - TODO

## Current Status
- ✅ Backend logic complete (database, auto-answer, save preferences)
- ✅ `AgentUserQuestion` component exists with "Answer in Prompt" button
- ✅ `pendingUserQuestionsAtom` exists and is imported in `active-chat.tsx`
- ✅ `hasPendingQuestionsForThisChat` variable exists (line 1235)
- ❌ Component is NOT rendered in the JSX
- ❌ Handlers (`handleQuestionsAnswer`, `handleQuestionsSkip`, `handleAnswerInPrompt`) don't exist

## What Needs to be Done

### 1. Import AgentUserQuestion Component
Add to imports section (around line 162):
```typescript
import { AgentUserQuestion } from '../ui/agent-user-question'
```

### 2. Create Answer Handler
Add after line 1235:
```typescript
const handleQuestionsAnswer = useCallback(async (answers: Record<string, string>) => {
  if (!pendingQuestions) return
  
  // Send answers via IPC
  await window.api.agents.answerUserQuestion({
    subChatId,
    requestId: pendingQuestions.requestId,
    answers,
    approved: true
  })
  
  // Clear pending questions
  setPendingQuestions(null)
}, [pendingQuestions, subChatId, setPendingQuestions])
```

### 3. Create Skip Handler
```typescript
const handleQuestionsSkip = useCallback(async () => {
  if (!pendingQuestions) return
  
  // Send rejection via IPC
  await window.api.agents.answerUserQuestion({
    subChatId,
    requestId: pendingQuestions.requestId,
    answers: {},
    approved: false
  })
  
  // Clear pending questions
  setPendingQuestions(null)
}, [pendingQuestions, subChatId, setPendingQuestions])
```

### 4. Create Answer in Prompt Handler
```typescript
const handleAnswerInPrompt = useCallback((questionsText: string) => {
  // TODO: Insert questionsText into chat input
  // This requires finding the chat input component and setting its value
  
  // For now, just close the modal
  setPendingQuestions(null)
}, [setPendingQuestions])
```

### 5. Render the Component
Find where the chat messages/input area is rendered and add:
```tsx
{/* Question Modal */}
{hasPendingQuestionsForThisChat && pendingQuestions && (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
    <AgentUserQuestion
      pendingQuestions={pendingQuestions}
      onAnswer={handleQuestionsAnswer}
      onSkip={handleQuestionsSkip}
      onAnswerInPrompt={handleAnswerInPrompt}
    />
  </div>
)}
```

## Notes
- The file is 5180 lines long, making it difficult to navigate
- The infrastructure is already in place (atoms, transport logic)
- Just needs the UI integration
- "Answer in Prompt" button already exists in the component, just needs the handler wired up

