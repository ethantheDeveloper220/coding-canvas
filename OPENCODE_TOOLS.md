# OpenCode Tool Calling - Status ✅

## Current Status

**OpenCode DOES support tool calling!** 

The OpenCode server handles tool execution internally and automatically. When you send a message to OpenCode:

1. **OpenCode receives the prompt**
2. **OpenCode determines if tools are needed**
3. **OpenCode executes tools automatically** (file operations, code edits, etc.)
4. **OpenCode returns the complete response** including:
   - Text parts (AI response)
   - Tool parts (tool execution results)
   - Reasoning parts (if available)

## How It Works

### OpenCode Message Structure

OpenCode returns messages with a `parts` array that can include:

```typescript
{
  "info": { ... },
  "parts": [
    { "type": "text", "text": "I'll help you with that..." },
    { 
      "type": "tool",
      "tool": "write_to_file",
      "callID": "...",
      "state": {
        "status": "completed",
        "input": { "path": "...", "content": "..." },
        "output": "File written successfully",
        "title": "Writing to file.txt"
      }
    },
    { "type": "text", "text": "Done! I've created the file." }
  ]
}
```

### Tool Part Types

OpenCode supports these tool part states:
- **`pending`** - Tool call queued
- **`running`** - Tool currently executing
- **`completed`** - Tool finished successfully
- **`error`** - Tool execution failed

## Current Implementation

### What's Working ✅
- OpenCode server is running and connected
- Models are being fetched (2159 models available)
- Messages are being sent and received
- Text responses are being displayed

### What Needs Enhancement 🔧

The current `runOpenCode` function in `claude.ts` (lines 94-218) only extracts text parts:

```typescript
// Current code (line 169-177)
let responseText = ""
if (data.parts && Array.isArray(data.parts)) {
  responseText = data.parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
}
```

**This means tool execution results are being ignored!**

## Recommended Fix

Update the `runOpenCode` function to handle all part types:

```typescript
// Enhanced version
if (data.parts && Array.isArray(data.parts)) {
  for (const part of data.parts) {
    if (part.type === 'text') {
      const textId = crypto.randomUUID()
      safeEmit({ type: 'text-start', id: textId })
      safeEmit({ type: 'text-delta', id: textId, delta: part.text })
      safeEmit({ type: 'text-end', id: textId })
    }
    else if (part.type === 'tool') {
      // Emit tool execution events
      safeEmit({
        type: 'tool-call',
        toolName: part.tool,
        toolCallId: part.callID,
        args: part.state.input
      })
      
      if (part.state.status === 'completed') {
        safeEmit({
          type: 'tool-result',
          toolCallId: part.callID,
          result: part.state.output
        })
      }
    }
    else if (part.type === 'reasoning') {
      // Handle reasoning/thinking parts
      safeEmit({
        type: 'reasoning',
        text: part.text
      })
    }
  }
}
```

## Available Tools in OpenCode

OpenCode has many built-in tools including:
- **File Operations**: `read_file`, `write_to_file`, `list_files`
- **Code Editing**: `replace_file_content`, `multi_replace_file_content`
- **Search**: `grep_search`, `find_by_name`
- **Terminal**: `run_command`, `send_command_input`
- **Browser**: `browser_subagent`
- **And many more...**

## Testing Tool Calls

To test if OpenCode is using tools, try prompts like:

1. **"Create a file called test.txt with 'Hello World'"**
   - Should trigger `write_to_file` tool

2. **"List all TypeScript files in the src directory"**
   - Should trigger `find_by_name` or `list_dir` tool

3. **"Search for the word 'TODO' in all files"**
   - Should trigger `grep_search` tool

## Next Steps

1. ✅ OpenCode is connected and working
2. ✅ Models are available
3. ⚠️ **Update `runOpenCode` to handle tool parts** (not just text)
4. ⚠️ **Display tool execution in the UI** (show what tools are being called)
5. ⚠️ **Handle tool errors gracefully**

## Conclusion

**OpenCode FULLY supports tool calling** - it's built into the core system. The current integration just needs to be enhanced to display and handle the tool execution results that OpenCode is already providing!

---

**Status**: OpenCode tool support is ✅ **READY** - just needs UI integration to show tool calls!
