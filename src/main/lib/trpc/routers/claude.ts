import { observable } from "@trpc/server/observable"
import { eq } from "drizzle-orm"
import { app, safeStorage } from "electron"
import path from "path"
import { z } from "zod"
import {
  buildClaudeEnv,
  createTransformer,
  getBundledClaudeBinaryPath,
  logClaudeEnv,
  logRawClaudeMessage,
  type UIMessageChunk,
} from "../../claude"
import { chats, claudeCodeCredentials, getDatabase, subChats } from "../../db"
import { router, publicProcedure } from '../index'
import { getOpenCodeUrl } from '../../opencode-state'

/**
 * Decrypt token using Electron's safeStorage
 */
function decryptToken(encrypted: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encrypted, "base64").toString("utf-8")
  }
  const buffer = Buffer.from(encrypted, "base64")
  return safeStorage.decryptString(buffer)
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


// Helper to run session via OpenCode API
async function runOpenCode(
  input: any,
  existingSessionId: string | null,
  db: any,
  messagesToSave: any[],
  subChatId: string,
  subId: string,
  emitError: (err: any, ctx: string) => void,
  safeEmit: (chunk: UIMessageChunk) => boolean,
  safeComplete: () => void
) {
  console.log(`[SD] M:OPENCODE_START sub=${subId} model=${input.model}`)
  const OPENCODE_API = getOpenCodeUrl()

  try {
    let sessionId = input.sessionId || existingSessionId || null

    // Create session if needed
    if (!sessionId) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const res = await fetch(`${OPENCODE_API}/session`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ agent: 'build' })
        })
        if (!res.ok) throw new Error(`Failed to create OpenCode session: ${res.status} ${res.statusText}`)
        const data: any = await res.json()
        sessionId = data.id
        console.log(`[SD] M:OPENCODE_SESSION created=${sessionId}`)

        // Update DB with sessionId immediately
        db.update(subChats).set({ sessionId }).where(eq(subChats.id, subChatId)).run()
      } catch (e) {
        throw new Error(`OpenCode server not reachable at ${OPENCODE_API}. Is it running?`)
      }
    }

    // Send message
    // Parse model string if available (e.g. "openai/gpt-4")
    let modelObj = undefined
    if (input.model && input.model.includes('/')) {
      const [providerID, ...rest] = input.model.split('/')
      modelObj = {
        providerID,
        modelID: rest.join('/')
      }
    }

    const makeRequest = (body: any) => fetch(`${OPENCODE_API}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    let res = await makeRequest({
      parts: [{ type: "text", text: input.prompt }],
      ...(modelObj && { model: modelObj })
    })

    // If 400 Bad Request and we sent a model, it might be an invalid model ID. Retry without it.
    if (res.status === 400 && modelObj) {
      console.warn(`[claude] OpenCode 400 with model ${input.model}, retrying without model...`)
      res = await makeRequest({
        parts: [{ type: "text", text: input.prompt }]
      })
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "No error body")
      throw new Error(`OpenCode message failed: ${res.status} ${res.statusText} - ${errorText}`)
    }

    const data: any = await res.json()

    // Parse response content from OpenCode Message structure
    // OpenCode returns: { info: {...}, parts: [...] }
    // Parts can be: text, tool, reasoning, file, etc.

    if (data.parts && Array.isArray(data.parts)) {
      for (const part of data.parts) {
        // Handle text parts
        if (part.type === 'text') {
          const textId = crypto.randomUUID()
          safeEmit({ type: 'text-start', id: textId })
          safeEmit({ type: 'text-delta', id: textId, delta: part.text })
          safeEmit({ type: 'text-end', id: textId })
        }

        // Handle tool execution parts
        else if (part.type === 'tool') {
          const toolId = part.callID || crypto.randomUUID()

          // Emit tool input available
          safeEmit({
            type: 'tool-input-available',
            toolCallId: toolId,
            toolName: part.tool,
            input: part.state.input || {}
          })

          // Handle different tool states
          if (part.state.status === 'completed') {
            // Tool completed successfully
            safeEmit({
              type: 'tool-output-available',
              toolCallId: toolId,
              output: part.state.output || 'Tool completed'
            })

            // If tool has a title, emit it as text
            if (part.state.title) {
              const titleId = crypto.randomUUID()
              safeEmit({ type: 'text-start', id: titleId })
              safeEmit({ type: 'text-delta', id: titleId, delta: `[${part.tool}] ${part.state.title}\n` })
              safeEmit({ type: 'text-end', id: titleId })
            }
          }
          else if (part.state.status === 'error') {
            // Tool execution failed
            safeEmit({
              type: 'tool-output-error',
              toolCallId: toolId,
              errorText: part.state.error || 'Tool execution failed'
            })
          }
          else if (part.state.status === 'running') {
            // Tool is still running (shouldn't happen in non-streaming response, but handle it)
            if (part.state.title) {
              const runningId = crypto.randomUUID()
              safeEmit({ type: 'text-start', id: runningId })
              safeEmit({ type: 'text-delta', id: runningId, delta: `[${part.tool}] ${part.state.title}...\n` })
              safeEmit({ type: 'text-end', id: runningId })
            }
          }
        }

        // Handle reasoning/thinking parts
        else if (part.type === 'reasoning') {
          const reasoningId = crypto.randomUUID()
          safeEmit({ type: 'text-start', id: reasoningId })
          safeEmit({ type: 'text-delta', id: reasoningId, delta: `[Thinking] ${part.text}\n` })
          safeEmit({ type: 'text-end', id: reasoningId })
        }

        // Handle file attachments
        else if (part.type === 'file') {
          const fileId = crypto.randomUUID()
          safeEmit({ type: 'text-start', id: fileId })
          safeEmit({ type: 'text-delta', id: fileId, delta: `[File: ${part.filename || 'attachment'}]\n` })
          safeEmit({ type: 'text-end', id: fileId })
        }
      }
    } else {
      // Fallback for non-standard response format
      const responseText = typeof data === 'string' ? data : (data.content || data.message || JSON.stringify(data))
      const textId = crypto.randomUUID()
      safeEmit({ type: 'text-start', id: textId })
      safeEmit({ type: 'text-delta', id: textId, delta: responseText })
      safeEmit({ type: 'text-end', id: textId })
    }

    // Save to DB - collect all text and tool results
    const allText: string[] = []
    if (data.parts && Array.isArray(data.parts)) {
      for (const part of data.parts) {
        if (part.type === 'text') {
          allText.push(part.text)
        } else if (part.type === 'tool' && part.state.status === 'completed') {
          allText.push(`[${part.tool}] ${part.state.title || 'Completed'}: ${part.state.output}`)
        } else if (part.type === 'reasoning') {
          allText.push(`[Thinking] ${part.text}`)
        }
      }
    }

    const responseText = allText.join('\n\n')

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: responseText }],
      metadata: { sessionId, opencodeParts: data.parts }
    }
    const finalMessages = [...messagesToSave, assistantMessage]

    db.update(subChats)
      .set({
        messages: JSON.stringify(finalMessages),
        updatedAt: new Date(),
        streamId: null,
        sessionId // Ensure sessionId is saved
      })
      .where(eq(subChats.id, subChatId))
      .run()

    // Update parent chat timestamp
    db.update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, input.chatId))
      .run()

    console.log(`[SD] M:OPENCODE_END sub=${subId} parts=${data.parts?.length || 0} len=${responseText.length}`)
    safeEmit({ type: 'finish' })
    safeComplete()

  } catch (err) {
    emitError(err, "OpenCode Error")
    safeEmit({ type: 'finish' })
    safeComplete()
  }
}

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
        mode: z.enum(["plan", "agent"]).default("agent"),
        sessionId: z.string().optional(),
        model: z.string().optional(),
        maxThinkingTokens: z.number().optional(), // Enable extended thinking
        images: z.array(imageAttachmentSchema).optional(), // Image attachments
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
        console.log(`[SD] M:START sub=${subId} stream=${streamId.slice(-8)} mode=${input.mode} model=${input.model}`)

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


              // 2.5 Check for OpenCode Model (contains slash or not starting with claude/anthropic standard prefixes if stricter check needed)
              // OpenCode models are typically "provider/model" e.g. "openai/gpt-4"
              if (input.model && input.model.includes('/')) {
                await runOpenCode(
                  input,
                  existingSessionId,
                  db,
                  messagesToSave,
                  input.subChatId,
                  subId,
                  emitError,
                  safeEmit,
                  safeComplete
                )
                return
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

              // Build prompt: if there are images, create an AsyncIterable<SDKUserMessage>
              // Otherwise use simple string prompt
              let prompt: string | AsyncIterable<any> = input.prompt

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
                if (input.prompt.trim()) {
                  messageContent.push({
                    type: "text" as const,
                    text: input.prompt,
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
              const isolatedConfigDir = path.join(
                app.getPath("userData"),
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

              const resumeSessionId = input.sessionId || existingSessionId || undefined
              const queryOptions = {
                prompt,
                options: {
                  abortController, // Must be inside options!
                  cwd: input.cwd,
                  systemPrompt: {
                    type: "preset" as const,
                    preset: "claude_code" as const,
                    append: " ",
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
                    if (toolName === "AskUserQuestion") {
                      const { toolUseID } = options
                      // Emit to UI (safely in case observer is closed)
                      safeEmit({
                        type: "ask-user-question",
                        toolUseId: toolUseID,
                        questions: (toolInput as any).questions,
                      } as UIMessageChunk)

                      // Wait for response (60s timeout)
                      const response = await new Promise<{
                        approved: boolean
                        message?: string
                        updatedInput?: unknown
                      }>((resolve) => {
                        const timeoutId = setTimeout(() => {
                          pendingToolApprovals.delete(toolUseID)
                          resolve({ approved: false, message: "Timed out" })
                        }, 60000)

                        pendingToolApprovals.set(toolUseID, {
                          subChatId: input.subChatId,
                          resolve: (d) => {
                            clearTimeout(timeoutId)
                            resolve(d)
                          },
                        })
                      })

                      if (!response.approved) {
                        return {
                          behavior: "deny" as const,
                          message: response.message || "Skipped",
                        }
                      }
                      return {
                        behavior: "allow" as const,
                        updatedInput: response.updatedInput as any,
                      }
                    }
                    return {
                      behavior: "allow" as const,
                      updatedInput: toolInput as any,
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
                if (app.isReady() && app.isPackaged) {
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
})
