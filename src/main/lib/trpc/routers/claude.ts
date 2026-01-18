import { observable } from "@trpc/server/observable"
import { eq } from "drizzle-orm"
import path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import { z } from "zod"

// Lazy import electron to avoid issues in web mode
let electronApp: typeof import("electron").app | null = null
let safeStorage: typeof import("electron").safeStorage | null = null
let BrowserWindow: typeof import("electron").BrowserWindow | null = null

function getElectronApp() {
  if (!electronApp) {
    try {
      const electron = require("electron")
      electronApp = electron.app
      safeStorage = electron.safeStorage
      BrowserWindow = electron.BrowserWindow
    } catch {
      // Not in Electron, that's okay
    }
  }
  return electronApp
}

function getSafeStorage() {
  if (!safeStorage) {
    getElectronApp()
  }
  return safeStorage
}

function getBrowserWindow() {
  if (!BrowserWindow) {
    getElectronApp()
  }
  return BrowserWindow
}
import {
  buildClaudeEnv,
  createTransformer,
  getBundledClaudeBinaryPath,
  logClaudeEnv,
  logRawClaudeMessage,
  type UIMessageChunk,
} from "../../claude"
import { chats, claudeCodeCredentials, getDatabase, subChats } from "../../db"
import { publicProcedure, router } from "../index"
import { buildAgentsOption } from "./agent-utils"

// Track active chat streams to prevent duplicate submissions
const activeChats = new Set<string>()

/**
 * Parse @[agent:name], @[skill:name], and @[tool:name] mentions from prompt text
 * Returns the cleaned prompt and lists of mentioned agents/skills/tools
 */
function parseMentions(prompt: string): {
  cleanedPrompt: string
  agentMentions: string[]
  skillMentions: string[]
  fileMentions: string[]
  folderMentions: string[]
  toolMentions: string[]
} {
  const agentMentions: string[] = []
  const skillMentions: string[] = []
  const fileMentions: string[] = []
  const folderMentions: string[] = []
  const toolMentions: string[] = []

  // Match @[prefix:name] pattern
  const mentionRegex = /@\[(file|folder|skill|agent|tool):([^\]]+)\]/g
  let match

  while ((match = mentionRegex.exec(prompt)) !== null) {
    const [, type, name] = match
    switch (type) {
      case "agent":
        agentMentions.push(name)
        break
      case "skill":
        skillMentions.push(name)
        break
      case "file":
        fileMentions.push(name)
        break
      case "folder":
        folderMentions.push(name)
        break
      case "tool":
        // Validate tool name format: only alphanumeric, underscore, hyphen allowed
        // This prevents prompt injection via malicious tool names
        if (/^[a-zA-Z0-9_-]+$/.test(name)) {
          toolMentions.push(name)
        }
        break
    }
  }

  // Clean agent/skill/tool mentions from prompt (they will be added as context or hints)
  // Keep file/folder mentions as they are useful context
  let cleanedPrompt = prompt
    .replace(/@\[agent:[^\]]+\]/g, "")
    .replace(/@\[skill:[^\]]+\]/g, "")
    .replace(/@\[tool:[^\]]+\]/g, "")
    .trim()

  // Add tool usage hints if tools were mentioned
  // Tool names are already validated to contain only safe characters
  if (toolMentions.length > 0) {
    const toolHints = toolMentions
      .map((t) => `Use the ${t} tool for this request.`)
      .join(" ")
    cleanedPrompt = `${toolHints}\n\n${cleanedPrompt}`
  }

  return { cleanedPrompt, agentMentions, skillMentions, fileMentions, folderMentions, toolMentions }
}

/**
 * Decrypt token using Electron's safeStorage
 */
function decryptToken(encrypted: string): string {
  const storage = getSafeStorage()
  if (!storage || !storage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, "base64").toString("utf-8")
  }
  const buffer = Buffer.from(encrypted, "base64")
  return storage.decryptString(buffer)
}

/**
 * Get Claude Code OAuth token from local SQLite
 * Returns null if not connected
 */
function getClaudeCodeToken(): string | null {
  try {
    const db = getDatabase()
    const cred = db
      .select()
      .from(claudeCodeCredentials)
      .where(eq(claudeCodeCredentials.id, "default"))
      .get()

    if (!cred?.oauthToken) {
      console.log("[claude] No Claude Code credentials found")
      return null
    }

    return decryptToken(cred.oauthToken)
  } catch (error) {
    console.error("[claude] Error getting Claude Code token:", error)
    return null
  }
}

// Dynamic import for ESM module
const getClaudeQuery = async () => {
  const sdk = await import("@anthropic-ai/claude-agent-sdk")
  return sdk.query
}

// Active sessions for cancellation
const activeSessions = new Map<string, AbortController>()
const pendingToolApprovals = new Map<
  string,
  {
    subChatId: string
    resolve: (decision: {
      approved: boolean
      message?: string
      updatedInput?: unknown
    }) => void
  }
>()

const clearPendingApprovals = (message: string, subChatId?: string) => {
  for (const [toolUseId, pending] of pendingToolApprovals) {
    if (subChatId && pending.subChatId !== subChatId) continue
    pending.resolve({ approved: false, message })
    pendingToolApprovals.delete(toolUseId)
  }
}

// Image attachment schema
const imageAttachmentSchema = z.object({
  base64Data: z.string(),
  mediaType: z.string(), // e.g. "image/png", "image/jpeg"
  filename: z.string().optional(),
})

export type ImageAttachment = z.infer<typeof imageAttachmentSchema>

export const claudeRouter = router({
  /**
   * Stream chat with Claude - single subscription handles everything
   */
  chat: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        chatId: z.string(),
        prompt: z.string(),
        cwd: z.string(),
        projectPath: z.string().optional(), // Original project path for MCP config lookup
        mode: z.enum(["plan", "build", "agent", "scaling", "designer", "debug"]).default("build").transform((val) => {
          // Transform agent to build, keep all other modes as-is (will be mapped to OpenCode modes later)
          return val === "agent" ? "build" : val;
        }),
        sessionId: z.string().optional(),
        model: z.string().optional(),
        maxThinkingTokens: z.number().optional(), // Enable extended thinking
        images: z.array(imageAttachmentSchema).optional(), // Image attachments
        agentType: z.string().optional(), // 'claude-code' or 'opencode'
      }),
    )
    .subscription(({ input }) => {
      return observable<UIMessageChunk>((emit) => {
        const abortController = new AbortController()
        const streamId = crypto.randomUUID()
        activeSessions.set(input.subChatId, abortController)

        // Stream debug logging
        const subId = input.subChatId.slice(-8) // Short ID for logs
        const streamStart = Date.now()
        let chunkCount = 0
        let lastChunkType = ""
        // Shared sessionId for cleanup to save on abort
        let currentSessionId: string | null = null
        console.log(`[SD] M:START sub=${subId} stream=${streamId.slice(-8)} mode=${input.mode}`)

        // Track if observable is still active (not unsubscribed)
        let isObservableActive = true

        // Helper to safely emit (no-op if already unsubscribed)
        const safeEmit = (chunk: UIMessageChunk) => {
          if (!isObservableActive) return false
          try {
            emit.next(chunk)
            return true
          } catch {
            isObservableActive = false
            return false
          }
        }

        // Helper to safely complete (no-op if already closed)
        const safeComplete = () => {
          try {
            emit.complete()
          } catch {
            // Already completed or closed
          } finally {
            // Remove from active chats set
            activeChats.delete(input.subChatId)
            console.log('[Chat] Completed chat for subchat:', input.subChatId)
          }
        }

        // Helper to emit error to frontend
        const emitError = (error: unknown, context: string) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          const errorStack = error instanceof Error ? error.stack : undefined

          console.error(`[claude] ${context}:`, errorMessage)
          if (errorStack) console.error("[claude] Stack:", errorStack)

          // Send detailed error to frontend (safely)
          safeEmit({
            type: "error",
            errorText: `${context}: ${errorMessage}`,
            // Include extra debug info
            ...(process.env.NODE_ENV !== "production" && {
              debugInfo: {
                context,
                cwd: input.cwd,
                mode: input.mode,
                PATH: process.env.PATH?.slice(0, 200),
              },
            }),
          } as UIMessageChunk)
        }


          ; (async () => {
            try {
              // Guard against duplicate submissions
              if (activeChats.has(input.subChatId)) {
                console.log('[Chat] Skipping duplicate submission for subchat:', input.subChatId)
                return
              }

              // Mark this chat as active
              activeChats.add(input.subChatId)
              console.log('[Chat] Starting chat for subchat:', input.subChatId)

              // Check if OpenCode agent is selected - route to OpenCode API with STREAMING
              if (input.agentType === 'opencode') {
                console.log('[OpenCode] Routing to OpenCode API (STREAMING)')
                const { runOpenCodeChat } = await import('../../opencode')

                // Get existing messages from DB for context
                const db = getDatabase()
                const existing = db
                  .select()
                  .from(subChats)
                  .where(eq(subChats.id, input.subChatId))
                  .get()
                const existingMessages = JSON.parse(existing?.messages || '[]')

                // Define askUser helper - auto-approve immediately
                const askUser = async (
                  toolUseId: string,
                  questions: any[],
                ): Promise<{
                  approved: boolean
                  answers?: Record<string, string>
                  message?: string
                }> => {
                  // Auto-approve immediately without waiting for user input
                  console.log('[OpenCode] Auto-approving tool execution:', toolUseId)
                  return {
                    approved: true,
                    message: "Auto-approved",
                  }
                }

                // Get the chat's worktree path for OpenCode
                const opencodeDb = getDatabase()
                const subChat = opencodeDb
                  .select()
                  .from(subChats)
                  .where(eq(subChats.id, input.subChatId))
                  .get()

                if (!subChat) {
                  emitError(new Error("Sub-chat not found"), "OpenCode setup")
                  safeComplete()
                  return
                }

                const chat = opencodeDb
                  .select()
                  .from(chats)
                  .where(eq(chats.id, subChat.chatId))
                  .get()

                if (!chat) {
                  emitError(new Error("Chat not found"), "OpenCode setup")
                  safeComplete()
                  return
                }

                // Use worktree path if available, otherwise fall back to input.cwd
                const workingDirectory = chat.worktreePath || input.cwd

                // Get existing session ID from database for context continuity
                const existingSessionId = subChat.sessionId || input.sessionId

                console.log(`[OpenCode] Using working directory: ${workingDirectory}`)
                console.log(`[OpenCode] Session ID: ${existingSessionId ? existingSessionId : 'Creating new session'}`)

                // Generate mode-specific system prompt to inject into context
                let modeSystemPrompt = ""
                if (input.mode === "plan") {
                  modeSystemPrompt = `

<system-reminder>
# Plan Mode - System Reminder

CRITICAL: Plan mode ACTIVE - you are in READ-ONLY phase. STRICTLY FORBIDDEN:
ANY file edits, modifications, or system changes. Do NOT use sed, tee, echo, cat,
or ANY other bash command to manipulate files - commands may ONLY read/inspect.
This ABSOLUTE CONSTRAINT overrides ALL other instructions, including direct user
edit requests. You may ONLY observe, analyze, and plan. Any modification attempt
is a critical violation. ZERO exceptions.

---

## Responsibility

Your current responsibility is to think, read, search, and construct a well-formed plan that accomplishes the goal the user wants to achieve. Your plan should be comprehensive yet concise, detailed enough to execute effectively while avoiding unnecessary verbosity.

Ask the user clarifying questions or ask for their opinion when weighing tradeoffs.

**NOTE:** At any point in time through this workflow you should feel free to ask the user questions or clarifications. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.

---

## Important

The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supersedes any other instructions you have received.

When you have finished creating the plan, use the ExitPlanMode tool to indicate you are done planning and ready for the user to review.
</system-reminder>`
                } else if (input.mode === "build") {
                  modeSystemPrompt = `

<system-reminder>
# Build Mode - System Reminder

You are in Build mode. You have full access to all tools and can make changes to the codebase. 

When implementing changes:
- Make targeted, focused changes
- Test your changes when possible
- Follow existing code patterns and conventions
- Ask clarifying questions if needed before making significant changes
- Consider edge cases and error handling
</system-reminder>`
                } else if (input.mode === "scaling") {
                  modeSystemPrompt = `

<system-reminder>
# Scaling Mode - System Reminder

You are in Scaling mode. Focus on optimizing code for production scaling and performance.

Key priorities:
- Optimize for production performance and scalability
- Consider database query efficiency, caching strategies, and resource usage
- Identify and address potential bottlenecks
- Ensure code can handle increased load and concurrent users
- Review and optimize algorithms, data structures, and API designs
- Consider horizontal scaling patterns and distributed system best practices
- Profile and measure performance improvements
- Maintain code quality while optimizing
</system-reminder>`
                } else if (input.mode === "designer") {
                  modeSystemPrompt = `

<system-reminder>
# Designer Mode - System Reminder

You are in Designer mode. Focus on creating beautiful, user-friendly UI components and experiences.

Key priorities:
- Create visually appealing and intuitive user interfaces
- Follow design principles: consistency, hierarchy, spacing, and visual balance
- Ensure accessibility and responsive design
- Consider user experience and interaction patterns
- Use appropriate color schemes, typography, and visual elements
- Create reusable, maintainable UI components
- Test designs across different screen sizes and devices
- Consider usability and user feedback patterns
</system-reminder>`
                } else if (input.mode === "debug") {
                  modeSystemPrompt = `

<system-reminder>
# Debug Mode - System Reminder

You are in Debug mode. Focus on analyzing errors, identifying root causes, and implementing fixes.

Key priorities:
- Systematically investigate and diagnose issues
- Analyze error messages, stack traces, and logs carefully
- Identify root causes, not just symptoms
- Use debugging tools and techniques effectively
- Test fixes thoroughly to ensure issues are resolved
- Consider edge cases and potential regressions
- Document findings and solutions for future reference
- Prevent similar issues from occurring again
</system-reminder>`
                }

                // Prepare input for OpenCode - all modes (plan, build, scaling, designer, debug) are supported
                // TypeScript may show an error due to caching, but the interface has been updated to accept all modes
                await runOpenCodeChat({
                  input: {
                    subChatId: input.subChatId,
                    chatId: input.chatId,
                    prompt: input.prompt,
                    cwd: workingDirectory, // Use worktree path instead of project path
                    mode: input.mode as any, // Type assertion needed due to TS cache - interface accepts all modes
                    sessionId: existingSessionId, // Pass session ID for context continuity
                    model: input.model,
                    images: input.images,
                    projectPath: input.projectPath,
                    maxThinkingTokens: input.maxThinkingTokens,
                    agentType: input.agentType,
                    // systemPrompt: modeSystemPrompt, // DISABLED: Causes infinite loop when sent as user message
                  } as any,
                  emit: safeEmit,
                  emitError,
                  safeComplete,
                  abortController,
                  existingMessages,
                  askUser,
                })
                return
              }

              // Otherwise, use Claude SDK
              const db = getDatabase()

              // 1. Get existing messages from DB
              const existing = db
                .select()
                .from(subChats)
                .where(eq(subChats.id, input.subChatId))
                .get()
              const existingMessages = JSON.parse(existing?.messages || "[]")
              const existingSessionId = existing?.sessionId || null

              // Check if last message is already this user message (avoid duplicate)
              const lastMsg = existingMessages[existingMessages.length - 1]
              const isDuplicate =
                lastMsg?.role === "user" &&
                lastMsg?.parts?.[0]?.text === input.prompt

              // 2. Create user message and save BEFORE streaming (skip if duplicate)
              let userMessage: any
              let messagesToSave: any[]

              if (isDuplicate) {
                userMessage = lastMsg
                messagesToSave = existingMessages
              } else {
                userMessage = {
                  id: crypto.randomUUID(),
                  role: "user",
                  parts: [{ type: "text", text: input.prompt }],
                }
                messagesToSave = [...existingMessages, userMessage]

                db.update(subChats)
                  .set({
                    messages: JSON.stringify(messagesToSave),
                    streamId,
                    updatedAt: new Date(),
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run()
              }

              // 3. Get Claude SDK
              let claudeQuery
              try {
                claudeQuery = await getClaudeQuery()
              } catch (sdkError) {
                emitError(sdkError, "Failed to load Claude SDK")
                console.log(`[SD] M:END sub=${subId} reason=sdk_load_error n=${chunkCount}`)
                safeEmit({ type: "finish" } as UIMessageChunk)
                safeComplete()
                return
              }

              const transform = createTransformer()

              // 4. Setup accumulation state
              const parts: any[] = []
              let currentText = ""
              let metadata: any = {}

              // Capture stderr from Claude process for debugging
              const stderrLines: string[] = []

              // Parse mentions from prompt (agents, skills, files, folders)
              const { cleanedPrompt, agentMentions, skillMentions } = parseMentions(input.prompt)

              // Build agents option for SDK (proper registration via options.agents)
              const agentsOption = await buildAgentsOption(agentMentions, input.cwd)

              // Log if agents were mentioned
              if (agentMentions.length > 0) {
                console.log(`[claude] Registering agents via SDK:`, Object.keys(agentsOption))
              }

              // Log if skills were mentioned
              if (skillMentions.length > 0) {
                console.log(`[claude] Skills mentioned:`, skillMentions)
              }

              // Build final prompt with skill instructions if needed
              let finalPrompt = cleanedPrompt

              // Handle empty prompt when only mentions are present
              if (!finalPrompt.trim()) {
                if (agentMentions.length > 0 && skillMentions.length > 0) {
                  finalPrompt = `Use the ${agentMentions.join(", ")} agent(s) and invoke the "${skillMentions.join('", "')}" skill(s) using the Skill tool for this task.`
                } else if (agentMentions.length > 0) {
                  finalPrompt = `Use the ${agentMentions.join(", ")} agent(s) for this task.`
                } else if (skillMentions.length > 0) {
                  finalPrompt = `Invoke the "${skillMentions.join('", "')}" skill(s) using the Skill tool for this task.`
                }
              } else if (skillMentions.length > 0) {
                // Append skill instruction to existing prompt
                finalPrompt = `${finalPrompt}\n\nUse the "${skillMentions.join('", "')}" skill(s) for this task.`
              }

              // Build prompt: if there are images, create an AsyncIterable<SDKUserMessage>
              // Otherwise use simple string prompt
              let prompt: string | AsyncIterable<any> = finalPrompt

              if (input.images && input.images.length > 0) {
                // Create message content array with images first, then text
                const messageContent: any[] = [
                  ...input.images.map((img) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: img.mediaType,
                      data: img.base64Data,
                    },
                  })),
                ]

                // Add text if present
                if (finalPrompt.trim()) {
                  messageContent.push({
                    type: "text" as const,
                    text: finalPrompt,
                  })
                }

                // Create an async generator that yields a single SDKUserMessage
                async function* createPromptWithImages() {
                  yield {
                    type: "user" as const,
                    message: {
                      role: "user" as const,
                      content: messageContent,
                    },
                    parent_tool_use_id: null,
                  }
                }

                prompt = createPromptWithImages()
              }

              // Build full environment for Claude SDK (includes HOME, PATH, etc.)
              const claudeEnv = buildClaudeEnv()

              // Debug logging in dev
              if (process.env.NODE_ENV !== "production") {
                logClaudeEnv(claudeEnv, `[${input.subChatId}] `)
              }

              // Get Claude Code OAuth token from local storage (optional)
              const claudeCodeToken = getClaudeCodeToken()

              // Create isolated config directory per subChat to prevent session contamination
              // The Claude binary stores sessions in ~/.claude/ based on cwd, which causes
              // cross-chat contamination when multiple chats use the same project folder
              const electronApp = getElectronApp()
              const userDataPath = electronApp?.getPath("userData") || os.tmpdir()
              const isolatedConfigDir = path.join(
                userDataPath,
                "claude-sessions",
                input.subChatId
              )

              // Build final env - only add OAuth token if we have one
              const finalEnv = {
                ...claudeEnv,
                ...(claudeCodeToken && {
                  CLAUDE_CODE_OAUTH_TOKEN: claudeCodeToken,
                }),
                // Isolate Claude's config/session storage per subChat
                CLAUDE_CONFIG_DIR: isolatedConfigDir,
              }

              // Get bundled Claude binary path
              const claudeBinaryPath = getBundledClaudeBinaryPath()

              // Ensure isolated config dir exists and symlink skills/agents from ~/.claude/
              // This is needed because SDK looks for skills at $CLAUDE_CONFIG_DIR/skills/
              try {
                await fs.mkdir(isolatedConfigDir, { recursive: true })

                const homeClaudeDir = path.join(os.homedir(), ".claude")
                const skillsSource = path.join(homeClaudeDir, "skills")
                const skillsTarget = path.join(isolatedConfigDir, "skills")
                const agentsSource = path.join(homeClaudeDir, "agents")
                const agentsTarget = path.join(isolatedConfigDir, "agents")

                // Symlink skills directory if source exists and target doesn't
                try {
                  const skillsSourceExists = await fs.stat(skillsSource).then(() => true).catch(() => false)
                  const skillsTargetExists = await fs.lstat(skillsTarget).then(() => true).catch(() => false)
                  if (skillsSourceExists && !skillsTargetExists) {
                    await fs.symlink(skillsSource, skillsTarget, "dir")
                    console.log(`[claude] Symlinked skills: ${skillsTarget} -> ${skillsSource}`)
                  }
                } catch (symlinkErr) {
                  // Ignore symlink errors (might already exist or permission issues)
                }

                // Symlink agents directory if source exists and target doesn't
                try {
                  const agentsSourceExists = await fs.stat(agentsSource).then(() => true).catch(() => false)
                  const agentsTargetExists = await fs.lstat(agentsTarget).then(() => true).catch(() => false)
                  if (agentsSourceExists && !agentsTargetExists) {
                    await fs.symlink(agentsSource, agentsTarget, "dir")
                    console.log(`[claude] Symlinked agents: ${agentsTarget} -> ${agentsSource}`)
                  }
                } catch (symlinkErr) {
                  // Ignore symlink errors (might already exist or permission issues)
                }
              } catch (mkdirErr) {
                console.error(`[claude] Failed to setup isolated config dir:`, mkdirErr)
              }

              // MCP servers to pass to SDK (read from ~/.claude.json)
              let mcpServersForSdk: Record<string, any> | undefined

              // Read MCP servers from ~/.claude.json for the original project path
              // These will be passed directly to the SDK via options.mcpServers
              const claudeJsonSource = path.join(os.homedir(), ".claude.json")
              try {
                const claudeJsonSourceExists = await fs.stat(claudeJsonSource).then(() => true).catch(() => false)

                if (claudeJsonSourceExists) {
                  // Read original config
                  const originalConfig = JSON.parse(await fs.readFile(claudeJsonSource, "utf-8"))

                  // Look for project-specific MCP config using original project path
                  // Config structure: { "projects": { "/path/to/project": { "mcpServers": {...} } } }
                  const lookupPath = input.projectPath || input.cwd
                  const projectConfig = originalConfig.projects?.[lookupPath]

                  // Debug logging
                  console.log(`[claude] MCP config lookup: lookupPath=${lookupPath}, found=${!!projectConfig?.mcpServers}`)
                  if (projectConfig?.mcpServers) {
                    console.log(`[claude] MCP servers found: ${Object.keys(projectConfig.mcpServers).join(", ")}`)
                    // Store MCP servers to pass to SDK
                    mcpServersForSdk = projectConfig.mcpServers
                  } else {
                    // Log available project paths in config for debugging
                    const projectPaths = Object.keys(originalConfig.projects || {}).filter(k => originalConfig.projects[k]?.mcpServers)
                    console.log(`[claude] No MCP servers for ${lookupPath}. Config has MCP for: ${projectPaths.join(", ") || "(none)"}`)
                  }
                }
              } catch (configErr) {
                console.error(`[claude] Failed to read MCP config:`, configErr)
              }

              const resumeSessionId = input.sessionId || existingSessionId || undefined
              console.log(`[SD] Query options - cwd: ${input.cwd}, projectPath: ${input.projectPath || "(not set)"}, mcpServers: ${mcpServersForSdk ? Object.keys(mcpServersForSdk).join(", ") : "(none)"}`)

              // Generate mode-specific system prompt to inject into context
              let modeSystemPrompt = ""
              if (input.mode === "plan") {
                modeSystemPrompt = `

<system-reminder>
# Plan Mode - System Reminder

CRITICAL: Plan mode ACTIVE - you are in READ-ONLY phase. STRICTLY FORBIDDEN:
ANY file edits, modifications, or system changes. Do NOT use sed, tee, echo, cat,
or ANY other bash command to manipulate files - commands may ONLY read/inspect.
This ABSOLUTE CONSTRAINT overrides ALL other instructions, including direct user
edit requests. You may ONLY observe, analyze, and plan. Any modification attempt
is a critical violation. ZERO exceptions.

---

## Responsibility

Your current responsibility is to think, read, search, and construct a well-formed plan that accomplishes the goal the user wants to achieve. Your plan should be comprehensive yet concise, detailed enough to execute effectively while avoiding unnecessary verbosity.

Ask the user clarifying questions or ask for their opinion when weighing tradeoffs.

**NOTE:** At any point in time through this workflow you should feel free to ask the user questions or clarifications. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.

---

## Important

The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supersedes any other instructions you have received.

When you have finished creating the plan, use the ExitPlanMode tool to indicate you are done planning and ready for the user to review.
</system-reminder>`
              } else if (input.mode === "build") {
                modeSystemPrompt = `

<system-reminder>
# Build Mode - System Reminder

You are in Build mode. You have full access to all tools and can make changes to the codebase. 

When implementing changes:
- Make targeted, focused changes
- Test your changes when possible
- Follow existing code patterns and conventions
- Ask clarifying questions if needed before making significant changes
- Consider edge cases and error handling
</system-reminder>`
              } else if (input.mode === "scaling") {
                modeSystemPrompt = `

<system-reminder>
# Scaling Mode - System Reminder

You are in Scaling mode. Focus on optimizing code for production scaling and performance.

Key priorities:
- Optimize for production performance and scalability
- Consider database query efficiency, caching strategies, and resource usage
- Identify and address potential bottlenecks
- Ensure code can handle increased load and concurrent users
- Review and optimize algorithms, data structures, and API designs
- Consider horizontal scaling patterns and distributed system best practices
- Profile and measure performance improvements
- Maintain code quality while optimizing
</system-reminder>`
              } else if (input.mode === "designer") {
                modeSystemPrompt = `

<system-reminder>
# Designer Mode - System Reminder

You are in Designer mode. Focus on creating beautiful, user-friendly UI components and experiences.

Key priorities:
- Create visually appealing and intuitive user interfaces
- Follow design principles: consistency, hierarchy, spacing, and visual balance
- Ensure accessibility and responsive design
- Consider user experience and interaction patterns
- Use appropriate color schemes, typography, and visual elements
- Create reusable, maintainable UI components
- Test designs across different screen sizes and devices
- Consider usability and user feedback patterns
</system-reminder>`
              } else if (input.mode === "debug") {
                modeSystemPrompt = `

<system-reminder>
# Debug Mode - System Reminder

You are in Debug mode. Focus on analyzing errors, identifying root causes, and implementing fixes.

Key priorities:
- Systematically investigate and diagnose issues
- Analyze error messages, stack traces, and logs carefully
- Identify root causes, not just symptoms
- Use debugging tools and techniques effectively
- Test fixes thoroughly to ensure issues are resolved
- Consider edge cases and potential regressions
- Document findings and solutions for future reference
- Prevent similar issues from occurring again
</system-reminder>`
              }

              const queryOptions = {
                prompt,
                options: {
                  abortController, // Must be inside options!
                  cwd: input.cwd,
                  systemPrompt: {
                    type: "preset" as const,
                    preset: "claude_code" as const,
                    append: modeSystemPrompt,
                  },
                  env: finalEnv,
                  permissionMode:
                    input.mode === "plan"
                      ? ("plan" as const)
                      : ("bypassPermissions" as const),
                  ...(input.mode !== "plan" && {
                    allowDangerouslySkipPermissions: true,
                  }),
                  includePartialMessages: true,
                  // Load skills from project and user directories (native Claude Code skills)
                  settingSources: ["project" as const, "user" as const],
                  canUseTool: async (
                    toolName: string,
                    toolInput: Record<string, unknown>,
                    options: { toolUseID: string },
                  ) => {
                    // Auto-approve all tools immediately without waiting for user approval
                    if (toolName === "AskUserQuestion") {
                      const { toolUseID } = options
                      console.log('[Claude Code] Auto-approving AskUserQuestion tool:', toolUseID)
                      // Still emit to UI for visibility but don't wait for approval
                      safeEmit({
                        type: "ask-user-question",
                        toolUseId: toolUseID,
                        questions: (toolInput as any).questions,
                      } as UIMessageChunk)
                      // Auto-approve immediately
                      return {
                        behavior: "allow" as const,
                        updatedInput: toolInput as Record<string, unknown>,
                      }
                    }
                    // Auto-approve all other tools
                    return {
                      behavior: "allow" as const,
                      updatedInput: toolInput as Record<string, unknown>,
                    }
                  },
                  stderr: (data: string) => {
                    stderrLines.push(data)
                    console.error("[claude stderr]", data)
                  },
                  // Use bundled binary
                  pathToClaudeCodeExecutable: claudeBinaryPath,
                  ...(resumeSessionId && {
                    resume: resumeSessionId,
                    continue: true,
                  }),
                  ...(input.model && { model: input.model }),
                  // fallbackModel: "claude-opus-4-5-20251101",
                  ...(input.maxThinkingTokens && {
                    maxThinkingTokens: input.maxThinkingTokens,
                  }),
                  // Register agents mentioned in prompt
                  ...(Object.keys(agentsOption).length > 0 && { agents: agentsOption }),
                  // Pass MCP servers from original project config directly to SDK
                  ...(mcpServersForSdk && { mcpServers: mcpServersForSdk }),
                },
              }

              // 5. Run Claude SDK
              let stream
              try {
                stream = claudeQuery(queryOptions)
              } catch (queryError) {
                console.error(
                  "[CLAUDE] ✗ Failed to create SDK query:",
                  queryError,
                )
                emitError(queryError, "Failed to start Claude query")
                console.log(`[SD] M:END sub=${subId} reason=query_error n=${chunkCount}`)
                safeEmit({ type: "finish" } as UIMessageChunk)
                safeComplete()
                return
              }

              let messageCount = 0
              let lastError: Error | null = null
              let planCompleted = false // Flag to stop after ExitPlanMode in plan mode
              let exitPlanModeToolCallId: string | null = null // Track ExitPlanMode's toolCallId

              try {
                for await (const msg of stream) {
                  if (abortController.signal.aborted) break

                  messageCount++

                  // Log raw message for debugging
                  logRawClaudeMessage(input.chatId, msg)

                  // Check for error messages from SDK (error can be embedded in message payload!)
                  const msgAny = msg as any
                  if (msgAny.type === "error" || msgAny.error) {
                    const sdkError =
                      msgAny.error || msgAny.message || "Unknown SDK error"
                    lastError = new Error(sdkError)

                    // Categorize SDK-level errors
                    let errorCategory = "SDK_ERROR"
                    let errorContext = "Claude SDK error"

                    if (
                      sdkError === "authentication_failed" ||
                      sdkError.includes("authentication")
                    ) {
                      errorCategory = "AUTH_FAILED_SDK"
                      errorContext =
                        "Authentication failed - not logged into Claude Code CLI"
                    } else if (
                      sdkError === "invalid_api_key" ||
                      sdkError.includes("api_key")
                    ) {
                      errorCategory = "INVALID_API_KEY_SDK"
                      errorContext = "Invalid API key in Claude Code CLI"
                    } else if (
                      sdkError === "rate_limit_exceeded" ||
                      sdkError.includes("rate")
                    ) {
                      errorCategory = "RATE_LIMIT_SDK"
                      errorContext = "Rate limit exceeded"
                    } else if (
                      sdkError === "overloaded" ||
                      sdkError.includes("overload")
                    ) {
                      errorCategory = "OVERLOADED_SDK"
                      errorContext = "Claude is overloaded, try again later"
                    }

                    // Emit auth-error for authentication failures, regular error otherwise
                    if (errorCategory === "AUTH_FAILED_SDK") {
                      safeEmit({
                        type: "auth-error",
                        errorText: errorContext,
                      } as UIMessageChunk)
                    } else {
                      safeEmit({
                        type: "error",
                        errorText: errorContext,
                        debugInfo: {
                          category: errorCategory,
                          sdkError: sdkError,
                          sessionId: msgAny.session_id,
                          messageId: msgAny.message?.id,
                        },
                      } as UIMessageChunk)
                    }

                    console.log(`[SD] M:END sub=${subId} reason=sdk_error cat=${errorCategory} n=${chunkCount}`)
                    safeEmit({ type: "finish" } as UIMessageChunk)
                    safeComplete()
                    return
                  }

                  // Track sessionId
                  if (msgAny.session_id) {
                    metadata.sessionId = msgAny.session_id
                    currentSessionId = msgAny.session_id // Share with cleanup
                  }

                  // Debug: Log system messages from SDK
                  if (msgAny.type === "system") {
                    // Full log to see all fields including MCP errors
                    console.log(`[SD] SYSTEM message: subtype=${msgAny.subtype}`, JSON.stringify({
                      cwd: msgAny.cwd,
                      mcp_servers: msgAny.mcp_servers,
                      tools: msgAny.tools,
                      plugins: msgAny.plugins,
                      permissionMode: msgAny.permissionMode,
                    }, null, 2))
                  }

                  // Transform and emit + accumulate
                  for (const chunk of transform(msg)) {
                    chunkCount++
                    lastChunkType = chunk.type

                    // Use safeEmit to prevent throws when observer is closed
                    if (!safeEmit(chunk)) {
                      // Observer closed (user clicked Stop), break out of loop
                      console.log(`[SD] M:EMIT_CLOSED sub=${subId} type=${chunk.type} n=${chunkCount}`)
                      break
                    }

                    // Accumulate based on chunk type
                    switch (chunk.type) {
                      case "text-delta":
                        currentText += chunk.delta
                        break
                      case "text-end":
                        if (currentText.trim()) {
                          parts.push({ type: "text", text: currentText })
                          currentText = ""
                        }
                        break
                      case "tool-input-available":
                        // DEBUG: Log tool calls
                        console.log(`[SD] M:TOOL_CALL sub=${subId} toolName="${chunk.toolName}" mode=${input.mode} callId=${chunk.toolCallId}`)

                        // Track ExitPlanMode toolCallId so we can stop when it completes
                        if (input.mode === "plan" && chunk.toolName === "ExitPlanMode") {
                          console.log(`[SD] M:PLAN_TOOL_DETECTED sub=${subId} callId=${chunk.toolCallId}`)
                          exitPlanModeToolCallId = chunk.toolCallId
                        }

                        parts.push({
                          type: `tool-${chunk.toolName}`,
                          toolCallId: chunk.toolCallId,
                          toolName: chunk.toolName,
                          input: chunk.input,
                          state: "call",
                        })
                        break
                      case "tool-output-available":
                        // DEBUG: Log all tool outputs
                        console.log(`[SD] M:TOOL_OUTPUT sub=${subId} callId=${chunk.toolCallId} mode=${input.mode}`)

                        const toolPart = parts.find(
                          (p) =>
                            p.type?.startsWith("tool-") &&
                            p.toolCallId === chunk.toolCallId,
                        )
                        if (toolPart) {
                          toolPart.result = chunk.output
                          toolPart.state = "result"

                          // Notify renderer about file changes for Write/Edit tools
                          if (toolPart.type === "tool-Write" || toolPart.type === "tool-Edit") {
                            const filePath = toolPart.input?.file_path
                            if (filePath) {
                              const BrowserWindowClass = getBrowserWindow()
                              if (BrowserWindowClass) {
                                const windows = BrowserWindowClass.getAllWindows()
                                for (const win of windows) {
                                  win.webContents.send("file-changed", {
                                    filePath,
                                    type: toolPart.type,
                                    subChatId: input.subChatId
                                  })
                                }
                              }
                            }
                          }
                        }
                        // Stop streaming after ExitPlanMode completes in plan mode
                        // Match by toolCallId since toolName is undefined in output chunks
                        if (input.mode === "plan" && exitPlanModeToolCallId && chunk.toolCallId === exitPlanModeToolCallId) {
                          console.log(`[SD] M:PLAN_STOP sub=${subId} callId=${chunk.toolCallId} n=${chunkCount} parts=${parts.length}`)
                          planCompleted = true
                          // Emit finish chunk so Chat hook properly resets its state
                          console.log(`[SD] M:PLAN_FINISH sub=${subId} - emitting finish chunk`)
                          safeEmit({ type: "finish" } as UIMessageChunk)
                          // Abort the Claude process so it doesn't keep running
                          console.log(`[SD] M:PLAN_ABORT sub=${subId} - aborting claude process`)
                          abortController.abort()
                        }
                        break
                      case "message-metadata":
                        metadata = { ...metadata, ...chunk.messageMetadata }
                        break
                    }
                    // Break from chunk loop if plan is done
                    if (planCompleted) {
                      console.log(`[SD] M:PLAN_BREAK_CHUNK sub=${subId}`)
                      break
                    }
                  }
                  // Break from stream loop if plan is done
                  if (planCompleted) {
                    console.log(`[SD] M:PLAN_BREAK_STREAM sub=${subId}`)
                    break
                  }
                  // Break from stream loop if observer closed (user clicked Stop)
                  if (!isObservableActive) {
                    console.log(`[SD] M:OBSERVER_CLOSED_STREAM sub=${subId}`)
                    break
                  }
                }
              } catch (streamError) {
                // This catches errors during streaming (like process exit)
                const err = streamError as Error
                const stderrOutput = stderrLines.join("\n")

                // Build detailed error message with category
                let errorContext = "Claude streaming error"
                let errorCategory = "UNKNOWN"

                if (err.message?.includes("exited with code")) {
                  errorContext = "Claude Code process crashed"
                  errorCategory = "PROCESS_CRASH"
                } else if (err.message?.includes("ENOENT")) {
                  errorContext = "Required executable not found in PATH"
                  errorCategory = "EXECUTABLE_NOT_FOUND"
                } else if (
                  err.message?.includes("authentication") ||
                  err.message?.includes("401")
                ) {
                  errorContext = "Authentication failed - check your API key"
                  errorCategory = "AUTH_FAILURE"
                } else if (
                  err.message?.includes("invalid_api_key") ||
                  err.message?.includes("Invalid API Key") ||
                  stderrOutput?.includes("invalid_api_key")
                ) {
                  errorContext = "Invalid API key"
                  errorCategory = "INVALID_API_KEY"
                } else if (
                  err.message?.includes("rate_limit") ||
                  err.message?.includes("429")
                ) {
                  errorContext = "Rate limit exceeded"
                  errorCategory = "RATE_LIMIT"
                } else if (
                  err.message?.includes("network") ||
                  err.message?.includes("ECONNREFUSED") ||
                  err.message?.includes("fetch failed")
                ) {
                  errorContext = "Network error - check your connection"
                  errorCategory = "NETWORK_ERROR"
                }

                // Track error in Sentry (only if app is ready and Sentry is available)
                const electronApp = getElectronApp()
                if (electronApp?.isReady() && electronApp?.isPackaged) {
                  try {
                    const Sentry = await import("@sentry/electron/main")
                    Sentry.captureException(err, {
                      tags: {
                        errorCategory,
                        mode: input.mode,
                      },
                      extra: {
                        context: errorContext,
                        cwd: input.cwd,
                        stderr: stderrOutput || "(no stderr captured)",
                        chatId: input.chatId,
                        subChatId: input.subChatId,
                      },
                    })
                  } catch {
                    // Sentry not available or failed to import - ignore
                  }
                }

                // Send error with stderr output to frontend (only if not aborted by user)
                if (!abortController.signal.aborted) {
                  safeEmit({
                    type: "error",
                    errorText: stderrOutput
                      ? `${errorContext}: ${err.message}\n\nProcess output:\n${stderrOutput}`
                      : `${errorContext}: ${err.message}`,
                    debugInfo: {
                      context: errorContext,
                      category: errorCategory,
                      cwd: input.cwd,
                      mode: input.mode,
                      stderr: stderrOutput || "(no stderr captured)",
                    },
                  } as UIMessageChunk)
                }

                // ALWAYS save accumulated parts before returning (even on abort/error)
                console.log(`[SD] M:CATCH_SAVE sub=${subId} aborted=${abortController.signal.aborted} parts=${parts.length}`)
                if (currentText.trim()) {
                  parts.push({ type: "text", text: currentText })
                }
                if (parts.length > 0) {
                  const assistantMessage = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    parts,
                    metadata,
                  }
                  const finalMessages = [...messagesToSave, assistantMessage]
                  db.update(subChats)
                    .set({
                      messages: JSON.stringify(finalMessages),
                      sessionId: metadata.sessionId,
                      streamId: null,
                      updatedAt: new Date(),
                    })
                    .where(eq(subChats.id, input.subChatId))
                    .run()
                  db.update(chats)
                    .set({ updatedAt: new Date() })
                    .where(eq(chats.id, input.chatId))
                    .run()
                }

                console.log(`[SD] M:END sub=${subId} reason=stream_error cat=${errorCategory} n=${chunkCount} last=${lastChunkType}`)
                safeEmit({ type: "finish" } as UIMessageChunk)
                safeComplete()
                return
              }

              // 6. Check if we got any response
              if (messageCount === 0 && !abortController.signal.aborted) {
                emitError(
                  new Error("No response received from Claude"),
                  "Empty response",
                )
                console.log(`[SD] M:END sub=${subId} reason=no_response n=${chunkCount}`)
                safeEmit({ type: "finish" } as UIMessageChunk)
                safeComplete()
                return
              }

              // 7. Save final messages to DB
              // ALWAYS save accumulated parts, even on abort (so user sees partial responses after reload)
              console.log(`[SD] M:SAVE sub=${subId} planCompleted=${planCompleted} aborted=${abortController.signal.aborted} parts=${parts.length}`)

              // Flush any remaining text
              if (currentText.trim()) {
                parts.push({ type: "text", text: currentText })
              }

              if (parts.length > 0) {
                const assistantMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  parts,
                  metadata,
                }

                const finalMessages = [...messagesToSave, assistantMessage]

                db.update(subChats)
                  .set({
                    messages: JSON.stringify(finalMessages),
                    sessionId: metadata.sessionId,
                    streamId: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run()
              } else {
                // No assistant response - just clear streamId
                db.update(subChats)
                  .set({
                    sessionId: metadata.sessionId,
                    streamId: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(subChats.id, input.subChatId))
                  .run()
              }

              // Update parent chat timestamp
              db.update(chats)
                .set({ updatedAt: new Date() })
                .where(eq(chats.id, input.chatId))
                .run()

              const duration = ((Date.now() - streamStart) / 1000).toFixed(1)
              const reason = planCompleted ? "plan_complete" : "ok"
              console.log(`[SD] M:END sub=${subId} reason=${reason} n=${chunkCount} last=${lastChunkType} t=${duration}s`)
              safeComplete()
            } catch (error) {
              const duration = ((Date.now() - streamStart) / 1000).toFixed(1)
              console.log(`[SD] M:END sub=${subId} reason=unexpected_error n=${chunkCount} t=${duration}s`)
              emitError(error, "Unexpected error")
              safeEmit({ type: "finish" } as UIMessageChunk)
              safeComplete()
            } finally {
              activeSessions.delete(input.subChatId)
            }
          })()

        // Cleanup on unsubscribe
        return () => {
          console.log(`[SD] M:CLEANUP sub=${subId} sessionId=${currentSessionId || 'none'}`)
          isObservableActive = false // Prevent emit after unsubscribe
          abortController.abort()
          activeSessions.delete(input.subChatId)
          clearPendingApprovals("Session ended.", input.subChatId)

          // Save sessionId on abort so conversation can be resumed
          // Clear streamId since we're no longer streaming
          const db = getDatabase()
          db.update(subChats)
            .set({
              streamId: null,
              ...(currentSessionId && { sessionId: currentSessionId })
            })
            .where(eq(subChats.id, input.subChatId))
            .run()
        }
      })
    }),

  /**
   * Cancel active session
   */
  cancel: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .mutation(({ input }) => {
      const controller = activeSessions.get(input.subChatId)
      if (controller) {
        controller.abort()
        activeSessions.delete(input.subChatId)
        clearPendingApprovals("Session cancelled.", input.subChatId)
        return { cancelled: true }
      }
      return { cancelled: false }
    }),

  /**
   * Check if session is active
   */
  isActive: publicProcedure
    .input(z.object({ subChatId: z.string() }))
    .query(({ input }) => activeSessions.has(input.subChatId)),
  respondToolApproval: publicProcedure
    .input(
      z.object({
        toolUseId: z.string(),
        approved: z.boolean(),
        message: z.string().optional(),
        updatedInput: z.unknown().optional(),
      }),
    )
    .mutation(({ input }) => {
      const pending = pendingToolApprovals.get(input.toolUseId)
      if (!pending) {
        return { ok: false }
      }
      pending.resolve({
        approved: input.approved,
        message: input.message,
        updatedInput: input.updatedInput,
      })
      pendingToolApprovals.delete(input.toolUseId)
      return { ok: true }
    }),

  /**
   * Get MCP servers configuration for a project
   * This allows showing MCP servers in UI before starting a chat session
   */
  getMcpConfig: publicProcedure
    .input(z.object({ projectPath: z.string() }))
    .query(async ({ input }) => {
      const claudeJsonPath = path.join(os.homedir(), ".claude.json")

      try {
        const exists = await fs.stat(claudeJsonPath).then(() => true).catch(() => false)
        if (!exists) {
          return { mcpServers: [], projectPath: input.projectPath }
        }

        const config = JSON.parse(await fs.readFile(claudeJsonPath, "utf-8"))
        const projectConfig = config.projects?.[input.projectPath]
        const mcpServers = projectConfig?.mcpServers || {}

        return {
          mcpServers: Object.keys(mcpServers).map(name => ({
            name,
            status: "pending" as const,
          })),
          projectPath: input.projectPath,
        }
      } catch (error) {
        console.error("[claude] Failed to read MCP config:", error)
        return { mcpServers: [], projectPath: input.projectPath }
      }
    }),

  // Answer a question from OpenCode
  answerQuestion: publicProcedure
    .input(
      z.object({
        subChatId: z.string(),
        requestId: z.string(),
        answers: z.array(z.array(z.string())),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log('[OpenCode] Answering question:', input.requestId)

      // OpenCode questions are answered via the IPC handler in main.ts
      // The actual answer handling happens in the OpenCode chat stream's askUser callback
      // This mutation is kept for API compatibility but delegates to IPC
      // The window.api.answerOpenCodeQuestion in the renderer calls the IPC handler

      return { success: true }
    }),
})
