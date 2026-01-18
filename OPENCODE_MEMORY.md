# OpenCode Context Memory Implementation

This document describes how context memory works in OpenCode and how to configure it.

## How It Works

### 1. Session-Level Memory (Automatic)
- OpenCode SDK automatically maintains session history
- Messages are chained across turns
- Context is preserved within a session
- Session ID is stored in the database and reused

### 2. Context Summary (Automatic)
- After each assistant message, a context summary is generated
- The summary is injected into the system prompt for the next turn
- This provides persistent context even with long conversations
- Summaries are stored in OpenCode's storage system

### 3. Project-Level Context (AGENTS.md)
- Create `.claude/AGENTS.md` in your project root
- This file provides persistent, project-specific instructions
- The AI agent uses this for all interactions within the project
- Example:

```markdown
# Project Context

## Project Description
This is a React/TypeScript application for...

## Coding Standards
- Use functional components with hooks
- Prefer TypeScript strict mode
- Follow ESLint rules

## Important Files
- `src/main.tsx` - Entry point
- `src/lib/api.ts` - API client

## Common Tasks
- Run dev server: `npm run dev`
- Build: `npm run build`
```

### 4. Configuration

#### Increase Context Window
To expand the token limit for holding more history:
```bash
# In OpenCode config
{
  "model": {
    "contextSize": 200000
  }
}
```

#### Enable Context Summary Tool
The `context_summary` tool is automatically available. The AI can call it to:
- `get`: Get the current context summary
- `refresh`: Regenerate the summary
- `reset`: Clear the stored summary

### 5. MCP Integration
OpenCode supports Model Context Protocol (MCP) for external tools and plugins:
- SuperMemory for project knowledge
- File system access
- Web search
- Custom plugins

## Implementation Details

### Session Management
- Sessions are created per chat
- Session ID is stored in `subChats.sessionId`
- Sessions are reused across turns for context continuity
- Working directory is set to the chat's worktree path

### Context Summary Storage
- Summaries are stored in OpenCode's storage system
- Key: `session_context/{sessionID}`
- Contains: summary text, last message ID, timestamp
- Automatically updated after each assistant message

### Message Chaining
- All messages are stored in `subChats.messages`
- Messages are sent to OpenCode with each request
- OpenCode SDK handles deduplication and context management

## Best Practices

1. **For Simple Conversations**: Just use the automatic session management
2. **For Complex Projects**: Create `.claude/AGENTS.md` with project context
3. **For Long Conversations**: The context summary system handles this automatically
4. **For External Knowledge**: Use MCP plugins or custom tools

## Troubleshooting

### Context Not Preserved
- Check that session ID is being reused (look for "Reusing existing session" in logs)
- Verify context summary is being generated (look for "context summary generated" in logs)
- Ensure working directory is correct (should be worktree path, not project path)

### Memory Issues
- Increase context window size in config
- Use context summary tool to manually refresh
- Clear old sessions if needed
