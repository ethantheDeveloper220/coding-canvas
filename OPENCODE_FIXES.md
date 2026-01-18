# OpenCode Windows & Tool Display Fixes

## Issue 1: Windows Shell Syntax

### Problem
OpenCode is using Unix commands (`ls`, `cat`, `rm`) instead of Windows commands (`dir`, `type`, `del`).

### Root Cause
The OpenCode **server** needs to be configured to use PowerShell or CMD, not the client config.

### Solution Options

**Option A: Set Environment Variable (Recommended)**
Before starting the OpenCode server, set:
```bash
set SHELL=powershell.exe
# or
set SHELL=cmd.exe
```

**Option B: OpenCode Server Config**
The OpenCode server itself needs to detect Windows and use the appropriate shell. This is handled by the server's bash tool implementation.

**Option C: Use Git Bash/WSL Consistently**
If OpenCode is running in WSL or Git Bash, it will use Unix commands. Make sure the server is running in native Windows PowerShell.

### Current Config
The `shell` property in `opencode.json` is not part of the official schema and will be ignored. Remove it to avoid warnings:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": true,
  // Remove the shell config - it's not supported
  "provider": {
    ...
  }
}
```

---

## Issue 2: Tool Display ("Read", "Edited", "Finished")

### Problem
Tool blocks are showing as:
```
Finished: Initialize Next.js project...
Read
Edited  
Finished: Create landing page...
```

Instead of showing as proper tool blocks with the tool name and content.

### Root Cause
The tool output formatting isn't matching what the UI expects. The UI is rendering the tool status separately from the tool content.

### Solution
The tool emission needs to include proper metadata. In `chat.ts`, we already added formatting for Read/Write/Edit tools, but we need to ensure the tool status is part of the tool block, not separate text.

### What's Happening
1. OpenCode sends tool events with `part.type === 'tool'`
2. We map the tool name (e.g., `read` → `Read`)
3. We emit `tool-input-available` and `tool-output-available`
4. But the tool **status** ("Finished", "Running") might be coming as separate text

### Fix Needed
Check if there are text parts being emitted that say "Finished:", "Read", "Edited". These should be filtered out or combined with the tool blocks.

The issue is likely in how OpenCode formats its output. The tool should show:

```
┌─ Read: types.ts ─────────────┐
│ // Notification Service Types │
│ export type...                │
└───────────────────────────────┘
```

Not:
```
Read
types.ts
```

---

## Quick Fixes

### For Windows Commands
**Restart OpenCode server with:**
```powershell
$env:SHELL = "powershell.exe"
opencode serve
```

### For Tool Display
The tool formatting we added should work, but if it's still showing "Read", "Edited" separately, the issue is that OpenCode is sending these as text parts instead of tool metadata.

**Check the logs for:**
```
[OpenCode] Event type: message.part.updated
```

If you see text parts with content like "Read" or "Finished:", we need to filter those out.

---

## Testing

1. **Test Windows Commands:**
   ```
   Ask OpenCode: "List files in the current directory"
   Expected: Uses `dir` or `Get-ChildItem`
   Not: `ls`
   ```

2. **Test Tool Display:**
   ```
   Ask OpenCode: "Read the package.json file"
   Expected: Shows a code block with file name and syntax highlighting
   Not: Just text saying "Read" and "package.json"
   ```

---

## Notes

- The `shell` config in `opencode.json` is **not supported** by the schema
- Shell configuration must be done at the **server level**, not client level
- Tool display issues are likely due to OpenCode's output format not matching our expectations
- The tool name mapping is correct, but the output structure might need adjustment
