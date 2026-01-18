import * as Sentry from "@sentry/electron/renderer"
import type { ChatTransport, UIMessage } from "ai"
import { toast } from "sonner"
import {
  agentsLoginModalOpenAtom,
  extendedThinkingEnabledAtom,
} from "../../../lib/atoms"
import { appStore } from "../../../lib/jotai-store"
import { trpcClient } from "../../../lib/trpc"
import {
  lastSelectedModelIdAtom,
  MODEL_ID_MAP,
  pendingAuthRetryMessageAtom,
  pendingUserQuestionsAtom,
} from "../atoms/index"
import { useAgentSubChatStore } from "../stores/sub-chat-store"

// Track active subscriptions to prevent duplicates
const activeSubscriptions = new Set<string>()

// Error categories and their user-friendly messages
const ERROR_TOAST_CONFIG: Record<
  string,
  {
    title: string
    description: string
    action?: { label: string; onClick: () => void }
  }
> = {
  AUTH_FAILED_SDK: {
    title: "Not logged in",
    description: "Run 'claude login' in your terminal to authenticate",
    action: {
      label: "Copy command",
      onClick: () => navigator.clipboard.writeText("claude login"),
    },
  },
  INVALID_API_KEY_SDK: {
    title: "Invalid API key",
    description:
      "Your Claude API key is invalid. Check your CLI configuration.",
  },
  INVALID_API_KEY: {
    title: "Invalid API key",
    description:
      "Your Claude API key is invalid. Check your CLI configuration.",
  },
  RATE_LIMIT_SDK: {
    title: "Rate limited",
    description: "Too many requests. Please wait a moment and try again.",
  },
  RATE_LIMIT: {
    title: "Rate limited",
    description: "Too many requests. Please wait a moment and try again.",
  },
  OVERLOADED_SDK: {
    title: "Claude is busy",
    description:
      "The service is overloaded. Please try again in a few moments.",
  },
  PROCESS_CRASH: {
    title: "Claude crashed",
    description:
      "The Claude process exited unexpectedly. Try sending your message again.",
  },
  EXECUTABLE_NOT_FOUND: {
    title: "Claude CLI not found",
    description:
      "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code",
    action: {
      label: "Copy command",
      onClick: () =>
        navigator.clipboard.writeText(
          "npm install -g @anthropic-ai/claude-code",
        ),
    },
  },
  NETWORK_ERROR: {
    title: "Network error",
    description: "Check your internet connection and try again.",
  },
  AUTH_FAILURE: {
    title: "Authentication failed",
    description: "Your session may have expired. Try logging in again.",
  },
}

type UIMessageChunk = any // Inferred from subscription

type IPCChatTransportConfig = {
  chatId: string
  subChatId: string
  cwd: string
  mode: "plan" | "build" | "scaling" | "designer" | "debug" | "agent" | string // string for custom modes
  model?: string
  agentType?: string  // 'claude-code' or 'opencode'
  projectPath?: string  // Original project path for MCP config lookup
  customModeId?: string // Store custom mode ID separately for prompt rules
}

// Image attachment type matching the tRPC schema
type ImageAttachment = {
  base64Data: string
  mediaType: string
  filename?: string
}

export class IPCChatTransport implements ChatTransport<UIMessage> {
  constructor(private config: IPCChatTransportConfig) { }

  async sendMessages(options: {
    messages: UIMessage[]
    abortSignal?: AbortSignal
  }): Promise<ReadableStream<UIMessageChunk>> {
    // Get sub-chat data once for all uses
    const subChatData = useAgentSubChatStore
      .getState()
      .allSubChats.find((subChat) => subChat.id === this.config.subChatId)

    // Get current mode
    const currentMode = subChatData?.mode || this.config.mode

    // Extract prompt and images from last user message
    const lastUser = [...options.messages]
      .reverse()
      .find((m) => m.role === "user")
    let prompt = this.extractText(lastUser)
    const images = this.extractImages(lastUser)

    // Apply custom mode prompt rules if a custom mode is selected
    const customModeId = this.config.customModeId || (currentMode && typeof currentMode === "string" && currentMode.startsWith("custom-") ? currentMode : null)
    if (customModeId) {
      try {
        // Dynamic import to avoid circular dependencies
        const { getCustomModeById } = await import("../lib/custom-modes")
        const customMode = getCustomModeById(customModeId)
        if (customMode?.promptRules) {
          // Prepend prompt rules to the user's prompt
          prompt = `${customMode.promptRules}\n\n${prompt}`
        }
      } catch (error) {
        console.error("Failed to load custom mode prompt rules:", error)
      }
    }

    // Map mode for backend API (custom modes map to "build" since backend doesn't support custom modes)
    const backendMode = currentMode && typeof currentMode === "string" && currentMode.startsWith("custom-")
      ? "build" // Custom modes use "build" as the backend mode
      : (currentMode === "agent" ? "build" : currentMode)

    // Get sessionId for resume
    const lastAssistant = [...options.messages]
      .reverse()
      .find((m) => m.role === "assistant")
    const sessionId = (lastAssistant as any)?.metadata?.sessionId

    // Read extended thinking setting dynamically (so toggle applies to existing chats)
    const thinkingEnabled = appStore.get(extendedThinkingEnabledAtom)
    const maxThinkingTokens = thinkingEnabled ? 128_000 : undefined

    // Read model selection dynamically (priority: hardcoded config > sub-chat stored model > global atom)
    // If model is hardcoded in config (e.g. multi-agent run), use it.
    const selectedModelId = this.config.model || subChatData?.model || appStore.get(lastSelectedModelIdAtom)

    // For OpenCode, use the selectedModelId directly as it IS the actual model ID
    // For Claude Code, map through MODEL_ID_MAP
    const modelString = this.config.agentType === 'opencode'
      ? selectedModelId
      : (MODEL_ID_MAP[selectedModelId] || selectedModelId)

    // Stream debug logging
    const subId = this.config.subChatId.slice(-8)
    let chunkCount = 0
    let lastChunkType = ""
    console.log(`[SD] R:START sub=${subId}`)

    return new ReadableStream({
      start: (controller) => {
        // Guard against duplicate subscriptions
        if (activeSubscriptions.has(this.config.subChatId)) {
          console.log('[Transport] Skipping duplicate subscription for subchat:', this.config.subChatId)
          controller.close()
          return
        }

        // Mark this subscription as active
        activeSubscriptions.add(this.config.subChatId)
        console.log('[Transport] Starting subscription for subchat:', this.config.subChatId)

        // Track if stream has been closed to prevent enqueue errors
        let isStreamClosed = false

        const sub = trpcClient.claude.chat.subscribe(
          {
            subChatId: this.config.subChatId,
            chatId: this.config.chatId,
            prompt,
            cwd: this.config.cwd,
            ...(this.config.projectPath && { projectPath: this.config.projectPath }),
            mode: backendMode as "plan" | "build" | "scaling" | "designer" | "debug",
            sessionId,
            ...(maxThinkingTokens && { maxThinkingTokens }),
            ...(modelString && { model: modelString }),
            ...(images.length > 0 && { images }),
            ...(this.config.agentType && { agentType: this.config.agentType }),
          },
          {
            onData: (chunk: UIMessageChunk) => {
              chunkCount++
              lastChunkType = chunk.type

              // Debug: log all chunks when there's a pending question
              const currentPending = appStore.get(pendingUserQuestionsAtom)
              if (currentPending || chunk.type === "ask-user-question") {
                console.log("[PendingQ] Transport chunk:", {
                  type: chunk.type,
                  hasPending: !!currentPending,
                  chunkCount,
                })
              }

              // Handle AskUserQuestion - show question UI
              if (chunk.type === "ask-user-question") {
                console.log("[PendingQ] Transport: Setting pending question", {
                  subChatId: this.config.subChatId,
                  toolUseId: chunk.toolUseId,
                })
                appStore.set(pendingUserQuestionsAtom, {
                  subChatId: this.config.subChatId,
                  toolUseId: chunk.toolUseId,
                  questions: chunk.questions,
                })
              }

              // Handle AskUserQuestion timeout - clear pending question immediately
              if (chunk.type === "ask-user-question-timeout") {
                const pending = appStore.get(pendingUserQuestionsAtom)
                if (pending && pending.toolUseId === chunk.toolUseId) {
                  console.log("[PendingQ] Transport: Clearing timed out question", {
                    toolUseId: chunk.toolUseId,
                  })
                  appStore.set(pendingUserQuestionsAtom, null)
                }
              }

              // Clear pending questions when user starts submitting (question-submitting chunk)
              // This clears UI immediately when user clicks Submit button
              if (chunk.type === "question-submitting") {
                const pending = appStore.get(pendingUserQuestionsAtom)
                if (pending && pending.toolUseId === chunk.toolUseId) {
                  console.log("[PendingQ] Transport: Clearing pending question on submit start", {
                    toolUseId: chunk.toolUseId,
                  })
                  appStore.set(pendingUserQuestionsAtom, null)
                }
              }

              // Clear pending questions when user answers successfully (question-submitted chunk)
              // Only clear if the pending question belongs to THIS sub-chat
              // This is triggered when answer is successfully sent to backend
              if (chunk.type === "question-submitted") {
                const pending = appStore.get(pendingUserQuestionsAtom)
                if (pending && pending.toolUseId === chunk.toolUseId) {
                  console.log("[PendingQ] Transport: Clearing pending question on user answer", {
                    toolUseId: chunk.toolUseId,
                  })
                  appStore.set(pendingUserQuestionsAtom, null)
                }
              }

              // Clear pending questions when answer submission fails (question-submit-error chunk)
              if (chunk.type === "question-submit-error") {
                const pending = appStore.get(pendingUserQuestionsAtom)
                if (pending && pending.toolUseId === chunk.toolUseId) {
                  console.log("[PendingQ] Transport: Clearing pending question on submit error", {
                    toolUseId: chunk.toolUseId,
                  })
                  appStore.set(pendingUserQuestionsAtom, null)
                }
              }

              // Handle open-browser-preview chunk - dispatch window event
              if (chunk.type === "open-browser-preview") {
                window.dispatchEvent(new CustomEvent("open-browser-preview", {
                  detail: { chatId: this.config.chatId, url: (chunk as any).url }
                }))
              }

              // Handle authentication errors - show Claude login modal
              if (chunk.type === "auth-error") {
                // Store the failed message for retry after successful auth
                // readyToRetry=false prevents immediate retry - modal sets it to true on OAuth success
                appStore.set(pendingAuthRetryMessageAtom, {
                  subChatId: this.config.subChatId,
                  prompt,
                  ...(images.length > 0 && {
                    images: images.map(img => ({
                      base64Data: img.base64Data,
                      mediaType: img.mediaType,
                      filename: img.filename || "",
                    }))
                  }),
                  readyToRetry: false,
                })
                // Show the Claude Code login modal
                appStore.set(agentsLoginModalOpenAtom, true)
                // Use controller.error() instead of controller.close() so that
                // the SDK Chat properly resets status from "streaming" to "ready"
                // This allows user to retry sending messages after failed auth
                isStreamClosed = true
                controller.error(new Error("Authentication required"))
                return
              }

              // Handle errors - show toast to user FIRST before anything else
              if (chunk.type === "error") {
                // Track error in Sentry
                const category = chunk.debugInfo?.category || "UNKNOWN"
                Sentry.captureException(
                  new Error(chunk.errorText || "Claude transport error"),
                  {
                    tags: {
                      errorCategory: category,
                      mode: currentMode,
                    },
                    extra: {
                      debugInfo: chunk.debugInfo,
                      cwd: this.config.cwd,
                      chatId: this.config.chatId,
                      subChatId: this.config.subChatId,
                    },
                  },
                )

                // Show toast based on error category
                const config = ERROR_TOAST_CONFIG[category]

                if (config) {
                  toast.error(config.title, {
                    description: config.description,
                    duration: 8000,
                    action: config.action
                      ? {
                        label: config.action.label,
                        onClick: config.action.onClick,
                      }
                      : undefined,
                  })
                } else {
                  toast.error("Something went wrong", {
                    description:
                      chunk.errorText || "An unexpected error occurred",
                    duration: 8000,
                  })
                }
              }

              // Try to enqueue, but don't crash if stream is already closed
              if (!isStreamClosed) {
                try {
                  controller.enqueue(chunk)
                } catch (e) {
                  // CRITICAL: Log when enqueue fails - this could explain missing chunks!
                  console.log(`[SD] R:ENQUEUE_ERR sub=${subId} type=${chunk.type} n=${chunkCount} err=${e}`)
                  // Don't set isStreamClosed here - the stream might still be open for other chunks
                }
              }

              if (chunk.type === "finish" && !isStreamClosed) {
                console.log(`[SD] R:FINISH sub=${subId} n=${chunkCount}`)
                try {
                  controller.close()
                  isStreamClosed = true
                } catch {
                  // Already closed
                  isStreamClosed = true
                }
              }
            },
            onError: (err: Error) => {
              console.log(`[SD] R:ERROR sub=${subId} n=${chunkCount} last=${lastChunkType} err=${err.message}`)
              // Track transport errors in Sentry
              Sentry.captureException(err, {
                tags: {
                  errorCategory: "TRANSPORT_ERROR",
                  mode: currentMode,
                },
                extra: {
                  cwd: this.config.cwd,
                  chatId: this.config.chatId,
                  subChatId: this.config.subChatId,
                },
              })

              isStreamClosed = true
              controller.error(err)
            },
            onComplete: () => {
              console.log(`[SD] R:COMPLETE sub=${subId} n=${chunkCount} last=${lastChunkType}`)
              // Fallback: clear any pending questions when stream completes
              // This handles edge cases where timeout chunk wasn't received
              const pending = appStore.get(pendingUserQuestionsAtom)
              if (pending && pending.subChatId === this.config.subChatId) {
                console.log("[PendingQ] Transport: Clearing pending question on stream complete (fallback)", {
                  pendingToolUseId: pending.toolUseId,
                })
                appStore.set(pendingUserQuestionsAtom, null)
              }

              // Only try to enqueue finish chunk and close if stream isn't already closed
              if (!isStreamClosed) {
                try {
                  controller.enqueue({
                    type: 'finish',
                  } as any)
                  // Small delay to ensure the final chunk is processed
                  setTimeout(() => {
                    if (!isStreamClosed) {
                      try {
                        controller.close()
                        isStreamClosed = true
                      } catch {
                        // Already closed
                        isStreamClosed = true
                      }
                    }
                  }, 10)
                } catch {
                  // Enqueue failed, try to close anyway
                  try {
                    controller.close()
                    isStreamClosed = true
                  } catch {
                    // Already closed
                    isStreamClosed = true
                  }
                } finally {
                  // Remove from active subscriptions
                  activeSubscriptions.delete(this.config.subChatId)
                  console.log('[Transport] Completed subscription for subchat:', this.config.subChatId)
                }
              }
            },
          },
        )

        // Handle abort
        options.abortSignal?.addEventListener("abort", () => {
          console.log(`[SD] R:ABORT sub=${subId} n=${chunkCount} last=${lastChunkType}`)
          sub.unsubscribe()
          trpcClient.claude.cancel.mutate({ subChatId: this.config.subChatId })

          // Remove from active subscriptions
          activeSubscriptions.delete(this.config.subChatId)
          console.log('[Transport] Aborted subscription for subchat:', this.config.subChatId)

          if (!isStreamClosed) {
            try {
              controller.close()
              isStreamClosed = true
            } catch {
              // Already closed
              isStreamClosed = true
            }
          }
        })
      },
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null // Not needed for local app
  }

  private extractText(msg: UIMessage | undefined): string {
    if (!msg) return ""
    if (msg.parts) {
      return msg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("\n")
    }
    return ""
  }

  /**
   * Extract images from message parts
   * Looks for parts with type "data-image" that have base64Data
   */
  private extractImages(msg: UIMessage | undefined): ImageAttachment[] {
    if (!msg || !msg.parts) return []

    const images: ImageAttachment[] = []

    for (const part of msg.parts) {
      // Check for data-image parts with base64 data
      if (part.type === "data-image" && (part as any).data) {
        const data = (part as any).data
        if (data.base64Data && data.mediaType) {
          images.push({
            base64Data: data.base64Data,
            mediaType: data.mediaType,
            filename: data.filename,
          })
        }
      }
    }

    return images
  }
}
