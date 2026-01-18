# Question Preferences System - Implementation Summary

## Overview
Implemented a smart question-answering system that:
1. **Stores user answers** to questions in a database
2. **Auto-answers** repeated questions using stored preferences
3. **Provides UI flexibility** with "Answer in Prompt" option
4. **Works with OpenCode** (already integrated)

---

## ✅ What's Been Implemented

### 1. Database Schema (`src/main/lib/db/schema/index.ts`)
- **New Table**: `question_preferences`
  - Stores question text, answer, subchat ID, session ID
  - Tracks usage count and last used timestamp
  - Linked to `sub_chats` table with cascade delete

### 2. Database Migration Files
- **SQL Migration**: `drizzle/0005_question_preferences.sql`
- **Snapshot**: `drizzle/meta/0005_snapshot.json`
- **Journal**: Updated `drizzle/meta/_journal.json`

### 3. OpenCode Integration (`src/main/lib/opencode/chat.ts`)
**Auto-Answer Logic** (Lines 238-327):
- Checks database for previous answers before showing modal
- If all questions have stored answers → auto-responds
- Updates usage count when preferences are reused
- Shows "✓ Auto-answered from preferences" message

**Save Answers** (Lines 398-430):
- Saves user responses to database after submission
- Stores: question text, answer, subchat ID, session ID, header
- Logs: `[OpenCode] Saved preference: {question} = {answer}`

### 4. UI Enhancement (`src/renderer/features/agents/ui/agent-user-question.tsx`)
**New Feature**: "Answer in Prompt" Button
- Formats all questions with options
- Inserts into chat input for manual answering
- Gives users flexibility in how they respond

---

## 🔄 What Needs to Happen Next

### Step 1: Restart the App
The migration will run automatically on app startup:
```bash
npm run dev
```

You should see in console:
```
[DB] Running migrations from: ...
[DB] Migrations completed
```

### Step 2: Wire Up "Answer in Prompt" Callback
The button exists but needs to be connected in `active-chat.tsx`:

```typescript
// In active-chat.tsx, find where AgentUserQuestion is rendered
// Add this handler:
const handleAnswerInPrompt = useCallback((questionsText: string) => {
  // Insert questions into chat input
  // This needs to be implemented based on your chat input component
}, [])

// Then pass it to AgentUserQuestion:
<AgentUserQuestion
  pendingQuestions={pendingQuestions}
  onAnswer={handleQuestionsAnswer}
  onSkip={handleQuestionsSkip}
  onAnswerInPrompt={handleAnswerInPrompt}  // <-- Add this
/>
```

### Step 3: Render AgentUserQuestion Component
The component is imported but never rendered in `active-chat.tsx`. Add it where the chat input is:

```typescript
{/* Question Modal - render when there are pending questions */}
{hasPendingQuestionsForThisChat && pendingQuestions && (
  <div className="px-2 pb-2">
    <div className="w-full max-w-2xl mx-auto">
      <AgentUserQuestion
        pendingQuestions={pendingQuestions}
        onAnswer={handleQuestionsAnswer}
        onSkip={handleQuestionsSkip}
        onAnswerInPrompt={handleAnswerInPrompt}
      />
    </div>
  </div>
)}
```

---

## 🎯 How It Works

### First Time User Answers Questions:
1. OpenCode asks: "What should I do for the todo app?"
2. User selects: "Create from scratch"
3. Answer is saved to database
4. OpenCode receives the answer

### Next Time Same Question Appears:
1. OpenCode asks: "What should I do for the todo app?"
2. System checks database → finds "Create from scratch"
3. **Auto-responds** without showing modal
4. User sees: "✓ Auto-answered from preferences: ..."
5. Usage count increments

### User Wants Manual Control:
1. User clicks "Answer in Prompt" button
2. All questions formatted and inserted into chat input:
   ```
   1. Goal: What should I do for the todo app?
     1. Create from scratch
     2. Modify existing
     3. Just review
   
   2. Stack: Any tech stack preference?
     1. HTML/CSS/JS
     2. React
     3. Vue
   ```
3. User can type custom answers

---

## 📊 Database Schema

```sql
CREATE TABLE question_preferences (
  id TEXT PRIMARY KEY,
  sub_chat_id TEXT NOT NULL,           -- Links to subchat
  session_id TEXT,                     -- OpenCode session
  request_id TEXT NOT NULL,            -- Question request ID
  question_text TEXT NOT NULL,         -- The question
  question_header TEXT,                -- Category (Goal, Stack, etc)
  answer_text TEXT NOT NULL,           -- User's answer
  created_at INTEGER,                  -- When answered
  used_count INTEGER DEFAULT 0,        -- Times reused
  last_used_at INTEGER,                -- Last auto-answer
  FOREIGN KEY (sub_chat_id) REFERENCES sub_chats(id) ON DELETE CASCADE
);
```

---

## 🐛 Current Status

### ✅ Working:
- Database schema defined
- Migration files created
- OpenCode integration complete
- Auto-answer logic implemented
- Save answers logic implemented
- UI "Answer in Prompt" button added

### ⏳ Pending:
1. **Run migration** (restart app)
2. **Render AgentUserQuestion** in active-chat.tsx
3. **Wire up onAnswerInPrompt** callback

---

## 🔍 Testing

After implementing the pending items, test with:

1. **First Question Set**:
   - Create new chat
   - Answer questions normally
   - Check console: `[OpenCode] Saved preference: ...`

2. **Second Question Set** (same questions):
   - Create another chat
   - Should auto-answer
   - Check console: `[OpenCode] Auto-answering from database preferences`
   - See message: "✓ Auto-answered from preferences: ..."

3. **Answer in Prompt**:
   - Click "Answer in Prompt" button
   - Questions should appear in chat input
   - User can type custom answers

---

## 📝 Notes

- Preferences are **per-subchat** to avoid confusion
- Session ID tracked for context
- Usage count helps identify popular preferences
- Cascade delete ensures cleanup when subchats are deleted
- Works with **OpenCode** (already integrated)
- Claude Code would need similar integration if used

