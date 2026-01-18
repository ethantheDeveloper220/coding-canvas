# OpenCode Tool Blocks Not Showing - Root Cause Analysis

## The Problem

OpenCode creates files (like `test.py`) but they don't appear as tool blocks in the chat. Instead, we just see text like:
```
Created `test.py` with `print("Hello")`.
```

## Root Cause

**OpenCode server is NOT emitting tool events!**

### Evidence from Logs:

```
[OpenCode] Received text: Created `test.py` with `print("Hello")`.
[OpenCode] Assistant message updated
[OpenCode] Session idle - completing
```

**What's missing:**
```
[OpenCode] Event type: message.part.updated (with part.type === 'tool')
[OpenCode] Tool: write, input: { filePath: 'test.py', content: '...' }
```

### What Should Happen:

**Expected Flow:**
```
1. User: "create test.py"
2. OpenCode emits: message.part.updated
   - part.type: 'tool'
   - part.name: 'write'
   - part.state.input: { filePath: 'test.py', content: 'print("Hello")' }
3. Our code maps: 'write' → 'Write'
4. Stores as: { type: 'tool-Write', input: { file_path: 'test.py', ... } }
5. UI renders: <AgentEditTool /> with code block
```

**What's Actually Happening:**
```
1. User: "create test.py"
2. OpenCode emits: message.part.updated
   - part.type: 'text'
   - part.text: 'Created `test.py` with `print("Hello")`.'
3. Our code stores: { type: 'text', text: '...' }
4. UI renders: Plain text
```

## Why This Happens

OpenCode has different modes:
- **Agent mode** - Uses tools (write, edit, read, bash, etc.)
- **Chat mode** - Just text responses

The issue is that OpenCode is running in **chat mode** instead of **agent mode**.

## Solution

### Option 1: Force Agent Mode (Recommended)

When calling OpenCode API, specify the mode:

```typescript
// In chat.ts when sending prompt:
const requestBody: any = { 
  parts,
  mode: 'agent' // Force agent mode!
}
```

### Option 2: Check OpenCode Server Config

The OpenCode server might need configuration to enable tools:

```json
// opencode.json or server config
{
  "tools": {
    "enabled": true,
    "available": ["write", "edit", "read", "bash", "grep", "glob"]
  }
}
```

### Option 3: Use Different Model

Some OpenCode models don't support tools. Try a different model:
- `gpt-4o` - Supports tools ✅
- `gpt-5.2-codex` - Supports tools ✅
- `big-pickle` - May not support tools ❌

## Implementation

### 1. Add Mode Parameter

```typescript
// In src/main/lib/opencode/chat.ts
const requestBody: any = { parts }

// Add mode
requestBody.mode = 'agent' // or input.mode if user specifies

if (input.model) requestBody.model = { providerID, modelID }
```

### 2. Verify Tool Events

After the fix, logs should show:
```
[OpenCode] Event type: message.part.updated
[OpenCode] Tool: write
[OpenCode] Input: { filePath: 'test.py', content: '...' }
[OpenCode] Storing as: tool-Write
```

### 3. Check Database

After session completes, check database:
```sql
SELECT messages FROM subChats WHERE id = '...';
```

Should contain:
```json
[
  { "role": "user", "content": "create test.py" },
  { 
    "role": "assistant", 
    "parts": [
      {
        "type": "tool-Write",
        "input": { "file_path": "test.py", "content": "print('Hello')" },
        "state": "output-available"
      }
    ]
  }
]
```

## Testing

1. **Start OpenCode with agent mode**
2. **Ask to create a file:** "create hello.py"
3. **Check logs for tool events**
4. **Verify tool block appears in chat**
5. **Refresh page and check tool block persists**

## Current Status

✅ Tool storage format fixed (tool-Write, tool-Edit, etc.)
✅ Property normalization working (file_path, old_string, new_string)
✅ Database save/load working
❌ **OpenCode not emitting tool events** ← MAIN ISSUE

## Next Steps

1. Add `mode: 'agent'` to OpenCode API calls
2. Test with different models
3. Check OpenCode server configuration
4. Verify tool events are emitted
5. Confirm tool blocks appear in UI

Once OpenCode emits tool events, everything else is ready to work!
