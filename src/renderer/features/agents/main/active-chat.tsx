"use client"

import {
  ChatMarkdownRenderer,
  stripEmojis,
} from "../../../components/chat-markdown-renderer"
import { Button } from "../../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import {
  AgentIcon,
  AttachIcon,
  CheckIcon,
  ClaudeCodeIcon,
  CollapseIcon,
  CopyIcon,
  CursorIcon,
  ExpandIcon,
  IconCloseSidebarRight,
  IconOpenSidebarRight,
  IconSpinner,
  IconTextUndo,
  PauseIcon,
  PlanIcon,
  PullRequestIcon,
  VolumeIcon,
} from "../../../components/ui/icons"
import { Kbd } from "../../../components/ui/kbd"
import {
  PromptInput,
  PromptInputActions,
  PromptInputContextItems,
} from "../../../components/ui/prompt-input"
import { ResizableSidebar } from "../../../components/ui/resizable-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"
// e2b API routes are used instead of useSandboxManager for agents
// import { clearSubChatSelectionAtom, isSubChatMultiSelectModeAtom, selectedSubChatIdsAtom } from "@/lib/atoms/agent-subchat-selection"
import { Chat, useChat } from "@ai-sdk/react"
import { DiffModeEnum } from "@git-diff-view/react"
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  ChevronDown,
  Columns2,
  Eye,
  GitCommitHorizontal,
  GitMerge,
  Globe,
  ListTree,
  MoreHorizontal,
  Rows2,
  TerminalSquare,
  Undo2,
  FolderIcon,
  Kanban,
} from "lucide-react"
import { motion } from "motion/react"
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { trackMessageSent } from "../../../lib/analytics"
import { apiFetch } from "../../../lib/api-fetch"
import { soundNotificationsEnabledAtom } from "../../../lib/atoms"
import { appStore } from "../../../lib/jotai-store"
import { api } from "../../../lib/mock-api"
import { trpc, trpcClient } from "../../../lib/trpc"
import { cn } from "../../../lib/utils"
import { getShortcutKey, isDesktopApp } from "../../../lib/utils/platform"
import { terminalSidebarOpenAtom } from "../../terminal/atoms"
import { TerminalSidebar } from "../../terminal/terminal-sidebar"
import {
  agentsDiffSidebarWidthAtom,
  agentsPreviewSidebarOpenAtom,
  agentsPreviewSidebarWidthAtom,
  agentsScrollPositionsAtom,
  agentsSubChatsSidebarModeAtom,
  agentsSubChatUnseenChangesAtom,
  agentsUnseenChangesAtom,
  clearLoading,
  diffSidebarOpenAtomFamily,
  treeSidebarOpenAtomFamily,
  kanbanSidebarOpenAtomFamily,
  isPlanModeAtom,
  justCreatedIdsAtom,
  lastSelectedAgentIdAtom,
  lastSelectedModelIdAtom,
  loadingSubChatsAtom,
  pendingAuthRetryMessageAtom,
  pendingPrMessageAtom,
  pendingReviewMessageAtom,
  pendingUserQuestionsAtom,
  QUESTIONS_SKIPPED_MESSAGE,
  selectedAgentChatIdAtom,
  setLoading,
  subChatFilesAtom,
  pendingMultiAgentRunAtom,
} from "../atoms/index"
import {
  AgentsSlashCommand,
  COMMAND_PROMPTS,
  type SlashCommandOption,
} from "../commands"
import { AgentSendButton } from "../components/agent-send-button"
import { MultiAgentModal } from "../components/multi-agent-modal"
import { ChatModeSelector, type ChatMode } from "../components/chat-mode-selector"
import { PreviewSetupHoverCard } from "../components/preview-setup-hover-card"
import { useAgentsFileUpload } from "../hooks/use-agents-file-upload"
import { useChangedFilesTracking } from "../hooks/use-changed-files-tracking"
import { useDesktopNotifications } from "../hooks/use-desktop-notifications"
import { useFocusInputOnEnter } from "../hooks/use-focus-input-on-enter"
import { useHaptic } from "../hooks/use-haptic"
import { useToggleFocusOnCmdEsc } from "../hooks/use-toggle-focus-on-cmd-esc"
import { IPCChatTransport } from "../lib/ipc-chat-transport"
import {
  AgentsFileMention,
  AgentsMentionsEditor,
  type AgentsMentionsEditorHandle,
  type FileMentionOption,
} from "../mentions"
import { agentChatStore } from "../stores/agent-chat-store"
import {
  useAgentSubChatStore,
  type SubChatMeta,
} from "../stores/sub-chat-store"
import { AgentAskUserQuestionTool } from "../ui/agent-ask-user-question-tool"
import { AgentBashTool } from "../ui/agent-bash-tool"
import { AgentCommandHistory } from "../ui/agent-command-history"
import { CommandOutputDialog } from "../ui/command-output-dialog"
import { AgentContextIndicator } from "../ui/agent-context-indicator"
import {
  AgentDiffView,
  diffViewModeAtom,
  splitUnifiedDiffByFile,
  type AgentDiffViewRef,
} from "../ui/agent-diff-view"
import { AgentEditTool } from "../ui/agent-edit-tool"
import { AgentExitPlanModeTool } from "../ui/agent-exit-plan-mode-tool"
import { AgentExploringGroup } from "../ui/agent-exploring-group"
import { AgentFileItem } from "../ui/agent-file-item"
import { AgentImageItem } from "../ui/agent-image-item"
import { SmartSuggestions } from "../ui/smart-suggestions"
import {
  AgentMessageUsage,
  type AgentMessageMetadata,
} from "../ui/agent-message-usage"
import { AgentPlanTool } from "../ui/agent-plan-tool"
import { AgentPreview } from "../ui/agent-preview"
import { BrowserPreview, browserPreviewUrlAtomFamily } from "../ui/browser-preview"
import { AgentTaskTool } from "../ui/agent-task-tool"
import { AgentThinkingTool } from "../ui/agent-thinking-tool"
import { AgentTodoTool } from "../ui/agent-todo-tool"
import { AgentToolCall } from "../ui/agent-tool-call"
import { AgentToolRegistry, getToolStatus } from "../ui/agent-tool-registry"
import { AgentUserMessageBubble } from "../ui/agent-user-message-bubble"
import { AgentUserQuestion } from "../ui/agent-user-question"
import { AgentWebFetchTool } from "../ui/agent-web-fetch-tool"
import { AgentWebSearchCollapsible } from "../ui/agent-web-search-collapsible"
import { AgentsHeaderControls } from "../ui/agents-header-controls"
import { ChatTitleEditor } from "../ui/chat-title-editor"
import { MobileChatHeader } from "../ui/mobile-chat-header"
import { PrStatusBar } from "../ui/pr-status-bar"
import { FileTreePanel } from "../ui/file-tree-panel"
import { KanbanPanel } from "../ui/kanban-panel"
import { SubChatSelector } from "../ui/sub-chat-selector"
import { SubChatStatusCard } from "../ui/sub-chat-status-card"
import { autoRenameAgentChat } from "../utils/auto-rename"
import { generateCommitToPrMessage, generatePrMessage, generateReviewMessage } from "../utils/pr-message"
import {
  saveSubChatDraft,
  clearSubChatDraft,
  getSubChatDraft,
} from "../lib/drafts"
const clearSubChatSelectionAtom = atom(null, () => { })
const isSubChatMultiSelectModeAtom = atom(false)
const selectedSubChatIdsAtom = atom(new Set<string>())
// import { selectedTeamIdAtom } from "@/lib/atoms/team"
const selectedTeamIdAtom = atom<string | null>(null)
// import type { PlanType } from "@/lib/config/subscription-plans"
type PlanType = string

// Exploring tools - these get grouped when 2+ consecutive
const EXPLORING_TOOLS = new Set([
  "tool-Read",
  "tool-Grep",
  "tool-Glob",
  "tool-WebSearch",
  "tool-WebFetch",
])

// Group consecutive exploring tools into exploring-group
function groupExploringTools(parts: any[], nestedToolIds: Set<string>): any[] {
  const result: any[] = []
  let currentGroup: any[] = []

  for (const part of parts) {
    // Skip nested tools - they shouldn't be grouped, they render inside parent
    const isNested = part.toolCallId && nestedToolIds.has(part.toolCallId)

    if (EXPLORING_TOOLS.has(part.type) && !isNested) {
      currentGroup.push(part)
    } else {
      // Flush group if 3+
      if (currentGroup.length >= 3) {
        result.push({ type: "exploring-group", parts: currentGroup })
      } else {
        result.push(...currentGroup)
      }
      currentGroup = []
      result.push(part)
    }
  }
  // Flush remaining
  if (currentGroup.length >= 3) {
    result.push({ type: "exploring-group", parts: currentGroup })
  } else {
    result.push(...currentGroup)
  }
  return result
}

// Get the ID of the first sub-chat by creation date
function getFirstSubChatId(
  subChats:
    | Array<{ id: string; created_at?: Date | string | null }>
    | undefined,
): string | null {
  if (!subChats?.length) return null
  const sorted = [...subChats].sort(
    (a, b) =>
      (a.created_at ? new Date(a.created_at).getTime() : 0) -
      (b.created_at ? new Date(b.created_at).getTime() : 0),
  )
  return sorted[0]?.id ?? null
}

// Layout constants for chat header and sticky messages
const CHAT_LAYOUT = {
  // Padding top for chat content
  paddingTopSidebarOpen: "pt-12", // When sidebar open (absolute header overlay)
  paddingTopSidebarClosed: "pt-4", // When sidebar closed (regular header)
  paddingTopMobile: "pt-14", // Mobile has header
  // Sticky message top position (title is now in flex above scroll, so top-0)
  stickyTopSidebarOpen: "top-0", // When sidebar open (desktop, absolute header)
  stickyTopSidebarClosed: "top-0", // When sidebar closed (desktop, flex header)
  stickyTopMobile: "top-0", // Mobile (flex header, so top-0)
  // Header padding when absolute
  headerPaddingSidebarOpen: "pt-1.5 pb-12 px-3 pl-2",
  headerPaddingSidebarClosed: "p-2 pt-1.5",
} as const

// Codex icon (OpenAI style)
const CodexIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
)

// OpenCode icon
const OpenCodeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g clipPath="url(#clip0_1311_94973)">
      <path d="M24 32H8V16H24V32Z" fill="#4B4646" />
      <path d="M24 8H8V32H24V8ZM32 40H0V0H32V40Z" fill="#F1ECEC" />
    </g>
    <defs>
      <clipPath id="clip0_1311_94973">
        <rect width="32" height="40" fill="white" />
      </clipPath>
    </defs>
  </svg>
)

// OpenAI icon
const OpenAIIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5155-4.9101 6.0462 6.0462 0 0 0-6.5098-2.9006A6.065 6.065 0 0 0 4.9805 4.1798a5.9847 5.9847 0 0 0-3.9976 2.9006 6.0462 6.0462 0 0 0 .7432 7.0968 5.98 5.98 0 0 0 .51 4.9101 6.0513 6.0513 0 0 0 6.5146 2.9006A5.9847 5.9847 0 0 0 13.2598 24a6.0555 6.0555 0 0 0 5.7716-4.206 5.99 5.99 0 0 0 3.9976-2.9006 6.0555 6.0555 0 0 0-.7468-7.0721zM13.2598 22.4296a4.476 4.476 0 0 1-2.876-1.0403l.141-.0807 4.7785-2.7576a.7952.7952 0 0 0 .3921-.6812v-6.7369l2.0195 1.168a.0713.0713 0 0 1 .038.0517v5.5824a4.5042 4.5042 0 0 1-4.4931 4.4931zM3.6 18.3037a4.4705 4.4705 0 0 1-.5352-3.0137l.142.0849 4.7827 2.7588a.7708.7708 0 0 0 .78 0l5.8428-3.369v2.3321a.0799.0799 0 0 1-.0334.062L9.7402 19.9508a4.4998 4.4998 0 0 1-6.1406-1.6475zM2.3402 7.8955a4.4851 4.4851 0 0 1 2.3658-1.9727V11.6a.7664.7664 0 0 0 .3879.6762l5.8146 3.3555-2.0196 1.168a.0761.0761 0 0 1-.0713 0l-4.8291-2.7861A4.5042 4.5042 0 0 1 2.3402 7.8722zm16.5967 3.8549l-5.8326-3.3867L15.1191 7.2a.0761.0761 0 0 1 .0713 0l4.8291 2.791a4.4943 4.4943 0 0 1-.6761 8.1055v-5.6782a.7891.7891 0 0 0-.4072-.6662zm2.0097-3.0236l-.141-.0849-4.7735-2.7817a.7758.7758 0 0 0-.7847 0L9.4092 9.2298V6.8965a.0661.0661 0 0 1 .02793-.0615l4.8291-2.7867a4.5005 4.5005 0 0 1 6.68 4.66zm-12.6398 4.1352l-2.0196-1.1636a.0799.0799 0 0 1-.0381-.0567V6.0751a4.5005 4.5005 0 0 1 7.3749-3.4532l-.141.0801-4.7778 2.7588a.7952.7952 0 0 0-.393.6807zm1.0972-2.3642l2.6026-1.5 2.6074 1.5v2.999l-2.5972 1.5-2.6074-1.5z" fill="currentColor" />
  </svg>
)

// Google icon
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-8h2c.02 2.54 2.45 4.88 5 5.07v2.93zm5-9h-4v-2h4v2zm-2-2.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm-4.5 3.5c0-1.93 1.57-3.5 3.5-3.5v7c-2.54.19-4.98-2.53-5-5.07v-2.93c0-4.15 3.05-7.93 7-8.43V4.57c4.44.5 8 4.48 8 8z" fill="currentColor" />
  </svg>
)

// Provider icon helper
const ProviderIcon = ({ provider, className }: { provider?: string; className?: string }) => {
  const providerLower = provider?.toLowerCase() || ''

  if (providerLower.includes('openai')) {
    return <OpenAIIcon className={className} />
  }
  if (providerLower.includes('anthropic') || providerLower.includes('claude')) {
    return <ClaudeCodeIcon className={className} />
  }
  if (providerLower.includes('google')) {
    return <GoogleIcon className={className} />
  }

  // Default: return null
  return null
}

// Model options for Claude Code
const claudeModels = [
  { id: "opus", name: "Opus" },
  { id: "sonnet", name: "Sonnet" },
  { id: "haiku", name: "Haiku" },
]

// Agent providers
const agents = [
  { id: "claude-code", name: "Claude Code", hasModels: true },
  { id: "opencode", name: "OpenCode", hasModels: true },
  { id: "cursor", name: "Cursor CLI" },
  { id: "codex", name: "OpenAI Codex", disabled: false },
]

// Helper function to get agent icon
const getAgentIcon = (agentId: string, className?: string) => {
  switch (agentId) {
    case "claude-code":
      return <ClaudeCodeIcon className={className} />
    case "cursor":
      return <CursorIcon className={className} />
    case "codex":
      return <CodexIcon className={className} />
    case "opencode":
      return <OpenCodeIcon className={className} />
    default:
      return null
  }
}

// Copy button component with tooltip feedback (matches project style)
function CopyButton({
  onCopy,
  isMobile = false,
}: {
  onCopy: () => void
  isMobile?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const { trigger: triggerHaptic } = useHaptic()

  const handleCopy = () => {
    onCopy()
    triggerHaptic("medium")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      tabIndex={-1}
      className="p-1.5 rounded-md transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97]"
    >
      <div className="relative w-3.5 h-3.5">
        <CopyIcon
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
            copied ? "opacity-0 scale-50" : "opacity-100 scale-100",
          )}
        />
        <CheckIcon
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
            copied ? "opacity-100 scale-100" : "opacity-0 scale-50",
          )}
        />
      </div>
    </button>
  )
}

// Play button component for TTS (text-to-speech) with streaming support
type PlayButtonState = "idle" | "loading" | "playing"

const PLAYBACK_SPEEDS = [1, 2, 3] as const
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number]

function PlayButton({
  text,
  isMobile = false,
  playbackRate = 1,
  onPlaybackRateChange,
}: {
  text: string
  isMobile?: boolean
  playbackRate?: PlaybackSpeed
  onPlaybackRateChange?: (rate: PlaybackSpeed) => void
}) {
  const [state, setState] = useState<PlayButtonState>("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const chunkCountRef = useRef(0)

  // Update playback rate when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src)
      }
    }
    if (
      mediaSourceRef.current &&
      mediaSourceRef.current.readyState === "open"
    ) {
      try {
        mediaSourceRef.current.endOfStream()
      } catch {
        // Ignore errors during cleanup
      }
    }
    audioRef.current = null
    mediaSourceRef.current = null
    sourceBufferRef.current = null
    chunkCountRef.current = 0
  }, [])

  const handlePlay = async () => {
    // If playing, stop the audio
    if (state === "playing") {
      cleanup()
      setState("idle")
      return
    }

    // If loading, cancel and reset
    if (state === "loading") {
      cleanup()
      setState("idle")
      return
    }

    // Start loading
    setState("loading")
    chunkCountRef.current = 0

    try {
      // Check if MediaSource is supported for streaming
      const supportsMediaSource =
        typeof MediaSource !== "undefined" &&
        MediaSource.isTypeSupported("audio/mpeg")

      if (supportsMediaSource) {
        // Use streaming approach with MediaSource API
        await playWithStreaming()
      } else {
        // Fallback: wait for full response (Safari, older browsers)
        await playWithFallback()
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("[PlayButton] TTS error:", error)
      }
      cleanup()
      setState("idle")
    }
  }

  const playWithStreaming = async () => {
    const mediaSource = new MediaSource()
    mediaSourceRef.current = mediaSource

    const audio = new Audio()
    audioRef.current = audio

    audio.src = URL.createObjectURL(mediaSource)

    audio.onended = () => {
      cleanup()
      setState("idle")
    }

    audio.onerror = () => {
      cleanup()
      setState("idle")
    }

    // Track if we've already started playing
    let hasStartedPlaying = false

    // Start playback when browser has enough data (canplay event)
    audio.oncanplay = async () => {
      if (hasStartedPlaying) return
      hasStartedPlaying = true
      try {
        await audio.play()
        audio.playbackRate = playbackRate
        setState("playing")
      } catch {
        cleanup()
        setState("idle")
      }
    }

    // Wait for MediaSource to open
    await new Promise<void>((resolve, reject) => {
      mediaSource.addEventListener("sourceopen", () => resolve(), {
        once: true,
      })
      mediaSource.addEventListener(
        "error",
        () => reject(new Error("MediaSource error")),
        {
          once: true,
        },
      )
    })

    const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg")
    sourceBufferRef.current = sourceBuffer

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    const fetchStartTime = Date.now()
    const response = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: abortControllerRef.current.signal,
    })

    if (!response.ok) {
      throw new Error("TTS request failed")
    }

    if (!response.body) {
      throw new Error("No response body")
    }

    const reader = response.body.getReader()
    const pendingChunks: Uint8Array[] = []
    let isAppending = false

    const appendNextChunk = () => {
      if (
        isAppending ||
        pendingChunks.length === 0 ||
        !sourceBufferRef.current ||
        sourceBufferRef.current.updating
      ) {
        return
      }

      isAppending = true
      const chunk = pendingChunks.shift()!
      try {
        // Use ArrayBuffer.isView to ensure TypeScript knows this is a valid BufferSource
        const buffer = new Uint8Array(chunk.buffer.slice(0)) as BufferSource
        sourceBufferRef.current.appendBuffer(buffer)
      } catch {
        // Buffer might be full or source closed
        isAppending = false
      }
    }

    sourceBuffer.addEventListener("updateend", () => {
      isAppending = false
      appendNextChunk()
    })

    // Read stream chunks
    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Wait for all pending chunks to be appended
          while (pendingChunks.length > 0 || sourceBuffer.updating) {
            await new Promise((r) => setTimeout(r, 50))
          }
          if (mediaSource.readyState === "open") {
            try {
              mediaSource.endOfStream()
            } catch {
              // Ignore
            }
          }
          break
        }

        if (value) {
          chunkCountRef.current++
          pendingChunks.push(value)
          appendNextChunk()

          // Just accumulate data, don't try to play yet
          // Playback will start via canplay event listener
        }
      }
    }

    // Start processing stream - playback will start via canplay event
    processStream()
  }

  const playWithFallback = async () => {
    abortControllerRef.current = new AbortController()

    const response = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: abortControllerRef.current.signal,
    })

    if (!response.ok) {
      throw new Error("TTS request failed")
    }

    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.onended = () => {
      cleanup()
      setState("idle")
    }

    audio.onerror = () => {
      cleanup()
      setState("idle")
    }

    await audio.play()
    // Set playback rate AFTER play() - browser resets it when setting src
    audio.playbackRate = playbackRate
    setState("playing")
  }

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return (
    <div className="relative flex items-center">
      <button
        onClick={handlePlay}
        tabIndex={-1}
        className={cn(
          "p-1.5 rounded-md transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97]",
          state === "loading" && "cursor-wait",
        )}
      >
        <div className="relative w-3.5 h-3.5">
          {state === "loading" ? (
            <IconSpinner className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          ) : state === "playing" ? (
            <PauseIcon className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <VolumeIcon className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Speed selector - cyclic button with animation, only visible when playing */}
      {state === "playing" && (
        <button
          onClick={() => {
            const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate)
            const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length
            onPlaybackRateChange?.(PLAYBACK_SPEEDS[nextIndex])
          }}
          tabIndex={-1}
          className={cn(
            "p-1.5 rounded-md transition-[background-color,opacity,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97]",
            isMobile
              ? "opacity-100"
              : "opacity-0 group-hover/message:opacity-100",
          )}
        >
          <div className="relative w-4 h-3.5 flex items-center justify-center">
            {PLAYBACK_SPEEDS.map((speed) => (
              <span
                key={speed}
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-xs font-medium text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
                  speed === playbackRate
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-50",
                )}
              >
                {speed}x
              </span>
            ))}
          </div>
        </button>
      )}
    </div>
  )
}

// Collapsible steps component for intermediate content before final response
interface CollapsibleStepsProps {
  stepsCount: number
  children: React.ReactNode
  defaultExpanded?: boolean
}

function CollapsibleSteps({
  stepsCount,
  children,
  defaultExpanded = false,
}: CollapsibleStepsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (stepsCount === 0) return null

  return (
    <div className="mb-2">
      {/* Header row - styled like AgentToolCall with expand icon on right */}
      <div
        className="flex items-center justify-between rounded-md py-0.5 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListTree className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium whitespace-nowrap">
            {stepsCount} {stepsCount === 1 ? "step" : "steps"}
          </span>
        </div>
        <button
          className="p-1 rounded-md hover:bg-accent transition-[background-color,transform] duration-150 ease-out active:scale-95"
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
        >
          <div className="relative w-4 h-4">
            <ExpandIcon
              className={cn(
                "absolute inset-0 w-4 h-4 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
                isExpanded ? "opacity-0 scale-75" : "opacity-100 scale-100",
              )}
            />
            <CollapseIcon
              className={cn(
                "absolute inset-0 w-4 h-4 text-muted-foreground transition-[opacity,transform] duration-200 ease-out",
                isExpanded ? "opacity-100 scale-100" : "opacity-0 scale-75",
              )}
            />
          </div>
        </button>
      </div>
      {isExpanded && <div className="mt-1 space-y-1.5">{children}</div>}
    </div>
  )
}

// Inner chat component - only rendered when chat object is ready
function ChatViewInner({
  chat,
  subChatId,
  parentChatId,
  isFirstSubChat,
  onAutoRename,
  onCreateNewSubChat,
  teamId,
  repository,
  streamId,
  isMobile = false,
  sandboxSetupStatus = "ready",
  sandboxSetupError,
  onRetrySetup,
  isSubChatsSidebarOpen = false,
  sandboxId,
  projectPath,
  onExecuteInTerminal,
  onViewFullOutput,
}: {
  chat: Chat<any>
  subChatId: string
  parentChatId: string
  isFirstSubChat: boolean
  onAutoRename: (userMessage: string, subChatId: string) => void
  onCreateNewSubChat?: () => void
  teamId?: string
  repository?: string
  streamId?: string | null
  isMobile?: boolean
  sandboxSetupStatus?: "cloning" | "ready" | "error"
  sandboxSetupError?: string
  onRetrySetup?: () => void
  isSubChatsSidebarOpen?: boolean
  sandboxId?: string
  projectPath?: string
  onExecuteInTerminal?: (command: string) => void
  onViewFullOutput?: (command: string, stdout: string, stderr: string) => void
}) {
  // UNCONTROLLED: just track if editor has content for send button
  const [hasContent, setHasContent] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const hasTriggeredRenameRef = useRef(false)
  const hasTriggeredAutoGenerateRef = useRef(false)

  // Scroll management state (like canvas chat)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const shouldAutoScrollRef = useRef(true) // Ref to read current value without triggering effect
  const chatContainerRef = useRef<HTMLElement | null>(null)
  const lastScrollUpdateRef = useRef<number>(0)
  const editorRef = useRef<AgentsMentionsEditorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevChatKeyRef = useRef<string | null>(null)
  const prevSubChatIdRef = useRef<string | null>(null)

  // Undo state
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false)
  const [undoMessageId, setUndoMessageId] = useState<string | null>(null)
  const [isUndoing, setIsUndoing] = useState(false)

  // TTS playback rate state (persists across messages and sessions via localStorage)
  const [ttsPlaybackRate, setTtsPlaybackRate] = useState<PlaybackSpeed>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tts-playback-rate")
      if (saved && PLAYBACK_SPEEDS.includes(Number(saved) as PlaybackSpeed)) {
        return Number(saved) as PlaybackSpeed
      }
    }
    return 1
  })

  // Save playback rate to localStorage when it changes
  const handlePlaybackRateChange = useCallback((rate: PlaybackSpeed) => {
    setTtsPlaybackRate(rate)
    localStorage.setItem("tts-playback-rate", String(rate))
  }, [])

  // Check if user is at bottom of chat (like canvas)
  const isAtBottom = useCallback(() => {
    const container = chatContainerRef.current
    if (!container) return true
    const threshold = 50 // pixels from bottom
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold
    )
  }, [])

  // Scroll position persistence (like canvas)
  const [scrollPositions, setScrollPositions] = useAtom(
    agentsScrollPositionsAtom,
  )

  // Skip auto-scroll immediately after restore (state update is async, so use ref)
  const justRestoredRef = useRef(false)

  // Track current scroll position in ref (for saving on cleanup - container ref may point to new container)
  const currentScrollTopRef = useRef(0)

  // Handle scroll events to detect user scrolling (throttled)
  // Updates shouldAutoScroll and tracks position in ref for cleanup
  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current
    if (!container) return

    // Always track current position (for cleanup to use)
    currentScrollTopRef.current = container.scrollTop

    // Throttle state updates to reduce re-renders
    const now = Date.now()
    if (now - lastScrollUpdateRef.current > 100) {
      lastScrollUpdateRef.current = now
      const newIsAtBottom = isAtBottom()
      setShouldAutoScroll(newIsAtBottom)
      shouldAutoScrollRef.current = newIsAtBottom
    }
  }, [isAtBottom])

  // tRPC utils for cache invalidation
  const utils = api.useUtils()

  // Get sub-chat name from store
  const subChatName = useAgentSubChatStore(
    (state) => state.allSubChats.find((sc) => sc.id === subChatId)?.name || "",
  )

  // Mutation for renaming sub-chat
  const renameSubChatMutation = api.agents.renameSubChat.useMutation({
    onError: (error) => {
      if (error.data?.code === "NOT_FOUND") {
        toast.error("Send a message first before renaming this chat")
      } else {
        toast.error("Failed to rename chat")
      }
    },
  })

  // Handler for renaming sub-chat
  const handleRenameSubChat = useCallback(
    async (newName: string) => {
      // Optimistic update in store
      useAgentSubChatStore.getState().updateSubChatName(subChatId, newName)

      // Save to database
      try {
        await renameSubChatMutation.mutateAsync({
          subChatId,
          name: newName,
        })
      } catch {
        // Revert on error (toast shown by mutation onError)
        useAgentSubChatStore
          .getState()
          .updateSubChatName(subChatId, subChatName || "New Agent")
      }
    },
    [subChatId, subChatName, renameSubChatMutation],
  )

  // Plan mode state (read from global atom)
  const [isPlanMode, setIsPlanMode] = useAtom(isPlanModeAtom)
  
  // Chat mode state - supports all 5 modes: build, plan, scaling, designer, debug
  // Map "plan" mode to isPlanMode=true, all others (build, scaling, designer, debug) to isPlanMode=false
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    return isPlanMode ? "plan" : "build"
  })
  
  // Mutation for updating sub-chat mode in database
  const updateSubChatModeMutation = api.agents.updateSubChatMode.useMutation({
    onSuccess: () => {
      // Invalidate to refetch with new mode from DB
      utils.agents.getAgentChat.invalidate({ chatId: parentChatId })
    },
    onError: (error, variables) => {
      // Don't revert if sub-chat not found in DB - it may not be persisted yet
      // This is expected for new sub-chats that haven't been saved to DB
      if (error.message === "Sub-chat not found") {
        console.warn("Sub-chat not found in DB, keeping local mode state")
        return
      }

      // Revert local state on error to maintain sync with database
      const subChat = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === variables.subChatId)
      if (subChat) {
        // Revert to previous mode
        const revertedMode = variables.mode === "plan" ? "agent" : "plan"
        useAgentSubChatStore
          .getState()
          .updateSubChatMode(variables.subChatId, revertedMode)
        // Update ref BEFORE setIsPlanMode to prevent useEffect from triggering
        lastIsPlanModeRef.current = revertedMode === "plan"
        setIsPlanMode(revertedMode === "plan")
      }
      console.error("Failed to update sub-chat mode:", error.message)
    },
  })

  // Sync chatMode with isPlanMode changes
  useEffect(() => {
    if (isPlanMode && chatMode !== "plan") {
      setChatMode("plan")
    } else if (!isPlanMode && chatMode === "plan") {
      setChatMode("build")
    }
  }, [isPlanMode, chatMode])
  
  // Handle chat mode changes - update isPlanMode accordingly
  const handleChatModeChange = useCallback((mode: ChatMode) => {
    setChatMode(mode)
    // Only set isPlanMode for "plan" mode, keep it as is for custom modes
    if (mode === "plan") {
      setIsPlanMode(true)
    } else if (mode === "build" || mode === "scaling" || mode === "designer" || mode === "debug") {
      setIsPlanMode(false)
    }
    // For custom modes (string IDs starting with "custom-"), don't change isPlanMode
    
    // Store mode in sub-chat store
    const newMode = mode === "plan" ? "plan" : mode === "build" || mode === "scaling" || mode === "designer" || mode === "debug" ? "agent" : mode
    useAgentSubChatStore.getState().updateSubChatMode(subChatId, newMode)
    
    // Update in database only for "plan" and "agent" modes (not custom modes - they're localStorage only)
    if (subChatId && parentChatId && (newMode === "plan" || newMode === "agent")) {
      updateSubChatModeMutation.mutate({ subChatId, mode: newMode as "plan" | "agent" })
    }
  }, [setIsPlanMode, subChatId, parentChatId, updateSubChatModeMutation])

  // Track last initialized sub-chat to prevent re-initialization
  const lastInitializedRef = useRef<string | null>(null)

  // Initialize mode from sub-chat metadata ONLY when switching sub-chats
  useEffect(() => {
    if (subChatId && subChatId !== lastInitializedRef.current) {
      const subChat = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === subChatId)

      if (subChat?.mode) {
        // Only set isPlanMode for "plan" mode, not for custom modes
        if (subChat.mode === "plan") {
          setIsPlanMode(true)
          setChatMode("plan")
        } else if (subChat.mode === "build" || subChat.mode === "scaling" || subChat.mode === "designer" || subChat.mode === "debug") {
          setIsPlanMode(false)
          setChatMode(subChat.mode)
        } else if (typeof subChat.mode === "string" && subChat.mode.startsWith("custom-")) {
          // Custom mode - don't change isPlanMode, just set chatMode
          setChatMode(subChat.mode)
        } else {
          // Legacy "agent" mode maps to "build"
          setIsPlanMode(false)
          setChatMode("build")
        }
      }
      lastInitializedRef.current = subChatId
    }
    // Dependencies: Only subChatId - setIsPlanMode and setChatMode are stable, useAgentSubChatStore is external
  }, [subChatId, setIsPlanMode, setChatMode])

  // Track last mode to detect actual user changes (not store updates)
  const lastIsPlanModeRef = useRef<boolean>(isPlanMode)

  // Update mode for current sub-chat when USER changes isPlanMode
  useEffect(() => {
    // Skip if isPlanMode didn't actually change
    if (lastIsPlanModeRef.current === isPlanMode) {
      return
    }

    const newMode = isPlanMode ? "plan" : "agent"

    lastIsPlanModeRef.current = isPlanMode

    if (subChatId) {
      // Update local store immediately (optimistic update)
      useAgentSubChatStore.getState().updateSubChatMode(subChatId, newMode)

      // Save to database with error handling to maintain consistency
      if (!subChatId.startsWith("temp-")) {
        updateSubChatModeMutation.mutate({ subChatId, mode: newMode })
      }
    }
    // Dependencies: updateSubChatModeMutation.mutate is stable, useAgentSubChatStore is external
  }, [isPlanMode, subChatId, updateSubChatModeMutation.mutate])

  // Fetch OpenCode models (same as new-chat-form)
  const { data: opencodeModelsData } = trpc.opencode.getModels.useQuery()
  const opencodeModels = opencodeModelsData ? Object.values(opencodeModelsData) : []

  // Model selection state - support both Claude and OpenCode
  const [lastSelectedModelId, setLastSelectedModelId] = useAtom(
    lastSelectedModelIdAtom,
  )
  const [lastSelectedAgentId, setLastSelectedAgentId] = useAtom(
    lastSelectedAgentIdAtom,
  )
  // Determine agent from lastSelectedAgentId or subChat model (same as new-chat-form)
  const [selectedAgent, setSelectedAgent] = useState(() => {
    // First try lastSelectedAgentId from atom
    if (lastSelectedAgentId) {
      const found = agents.find(a => a.id === lastSelectedAgentId)
      if (found) return found
    }
    // Fallback: try to detect from subChat model - if model is from opencode, use opencode agent
    const subChat = useAgentSubChatStore.getState().allSubChats.find((sc) => sc.id === subChatId)
    const model = subChat?.model
    if (model && opencodeModels.some(m => m.id === model)) {
      return agents.find(a => a.id === 'opencode') || agents[0]
    }
    return agents[0] // Default to claude-code
  })
  
  // Determine available models based on selected agent (same as new-chat-form)
  const availableModels = selectedAgent.id === 'opencode' ? opencodeModels : claudeModels
  
  const [selectedModel, setSelectedModel] = useState(() => {
    const models = selectedAgent.id === 'opencode' ? opencodeModels : claudeModels
    if (models.length === 0) return null
    return models.find((m) => m.id === lastSelectedModelId) || models[0]
  })
  
  // Update selected model when OpenCode models load
  useEffect(() => {
    if (selectedAgent.id === 'opencode' && opencodeModels.length > 0 && !selectedModel) {
      setSelectedModel(opencodeModels[0])
    }
  }, [opencodeModels, selectedAgent.id, selectedModel])
  
  // Get OpenCode server URL for context checking
  const { data: opencodeServerUrl } = trpc.opencode.getServerUrl.useQuery()
  const apiUrl = opencodeServerUrl || 'http://localhost:4096'
  
  // Query subChat to get sessionId from database
  const { data: subChatData } = trpc.chats.getSubChat.useQuery(
    { id: subChatId },
    { enabled: selectedAgent.id === 'opencode' && !!subChatId }
  )
  const sessionId = subChatData?.sessionId
  
  // Poll OpenCode session context every 3 seconds when OpenCode is selected
  useEffect(() => {
    if (selectedAgent.id !== 'opencode') return
    if (!sessionId) return
    
    let isActive = true
    
    const checkContext = async () => {
      if (!isActive) return
      
      try {
        // Check session status/context from OpenCode API
        // First try to get the specific session
        const sessionResponse = await fetch(`${apiUrl}/session/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (sessionResponse.ok && isActive) {
          const sessionData = await sessionResponse.json()
          // Log context for debugging
          console.log('[OpenCode] Session context check:', {
            sessionId,
            status: sessionData.status,
            messageCount: sessionData.messages?.length || 0,
          })
          
          // You can use sessionData here to:
          // - Update UI state
          // - Trigger file change detection
          // - Update diff viewer
          // - Sync with local state
        }
        
        // Also check session status endpoint for overall status
        const statusResponse = await fetch(`${apiUrl}/session/status?directory=${encodeURIComponent(projectPath || '')}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (statusResponse.ok && isActive) {
          const statusData = await statusResponse.json()
          const currentSessionStatus = statusData[sessionId]
          if (currentSessionStatus) {
            console.log('[OpenCode] Session status:', currentSessionStatus)
          }
        }
      } catch (error) {
        // Silently fail - don't spam console if server is temporarily unavailable
        if (isActive) {
          console.debug('[OpenCode] Context check failed:', error)
        }
      }
    }
    
    // Check immediately, then every 3 seconds
    checkContext()
    const interval = setInterval(checkContext, 3000)
    
    return () => {
      isActive = false
      clearInterval(interval)
    }
  }, [selectedAgent.id, subChatId, apiUrl, projectPath])
  
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState("")
  const [shouldOpenClaudeSubmenu, setShouldOpenClaudeSubmenu] = useState(false)
  const [multiAgentModalOpen, setMultiAgentModalOpen] = useState(false)

  // File/image upload hook
  const {
    images,
    files,
    handleAddAttachments,
    removeImage,
    removeFile,
    clearAll,
    isUploading,
  } = useAgentsFileUpload()

  // Mention dropdown state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSearchText, setMentionSearchText] = useState("")
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })

  // Slash command dropdown state
  const [showSlashDropdown, setShowSlashDropdown] = useState(false)
  const [slashSearchText, setSlashSearchText] = useState("")
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 })

  // Shift+Tab handler for mode switching (now handled inside input component)

  // Keyboard shortcut: Cmd+/ to open model selector (Claude submenu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "/") {
        e.preventDefault()
        e.stopPropagation()

        setShouldOpenClaudeSubmenu(true)
        setIsModelDropdownOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [])

  // Mode tooltip state (floating tooltip like canvas)
  const [modeTooltip, setModeTooltip] = useState<{
    visible: boolean
    position: { top: number; left: number }
    mode: "agent" | "plan"
  } | null>(null)
  const [planApprovalPending, setPlanApprovalPending] = useState<
    Record<string, boolean>
  >({})
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownTooltipRef = useRef(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)

  // Track answered questions to prevent re-showing after user submits
  const answeredQuestionsRef = useRef<Set<string>>(new Set())

  // Track chat changes for rename trigger reset
  const chatRef = useRef<Chat<any> | null>(null)

  if (prevSubChatIdRef.current !== subChatId) {
    hasTriggeredRenameRef.current = false // Reset on sub-chat change
    hasTriggeredAutoGenerateRef.current = false // Reset auto-generate on sub-chat change
    answeredQuestionsRef.current.clear() // Reset answered questions on chat switch
    prevSubChatIdRef.current = subChatId
  }
  chatRef.current = chat

  // Save/restore drafts when switching between sub-chats or workspaces
  // Use refs to capture current values for cleanup function
  const currentSubChatIdRef = useRef<string>(subChatId)
  const currentChatIdRef = useRef<string | null>(parentChatId)
  const currentDraftTextRef = useRef<string>("")
  currentSubChatIdRef.current = subChatId
  currentChatIdRef.current = parentChatId

  // Save draft on blur (when focus leaves editor) - updates ref and localStorage
  const handleEditorBlur = useCallback(() => {
    setIsFocused(false)

    const draft = editorRef.current?.getValue() || ""
    const chatId = currentChatIdRef.current
    const subChatIdValue = currentSubChatIdRef.current

    // Update ref for unmount save
    currentDraftTextRef.current = draft

    if (!chatId) return

    if (draft.trim()) {
      saveSubChatDraft(chatId, subChatIdValue, draft)
    } else {
      clearSubChatDraft(chatId, subChatIdValue)
    }
  }, [])

  // Save draft on unmount (when switching workspaces) - uses ref since editor may be gone
  useEffect(() => {
    return () => {
      const draft = currentDraftTextRef.current
      const chatId = currentChatIdRef.current
      const subChatIdValue = currentSubChatIdRef.current

      if (!chatId || !draft.trim()) return

      saveSubChatDraft(chatId, subChatIdValue, draft)
    }
  }, [])

  // Restore draft when subChatId changes (switching between sub-chats)
  const prevSubChatIdForDraftRef = useRef<string | null>(null)
  useEffect(() => {
    // Save draft from previous sub-chat before switching (within same workspace)
    if (prevSubChatIdForDraftRef.current && prevSubChatIdForDraftRef.current !== subChatId) {
      const prevChatId = currentChatIdRef.current
      const prevSubChatId = prevSubChatIdForDraftRef.current
      const prevDraft = editorRef.current?.getValue() || ""

      if (prevDraft.trim() && prevChatId) {
        saveSubChatDraft(prevChatId, prevSubChatId, prevDraft)
      }
    }

    // Restore draft for new sub-chat - read directly from localStorage
    const savedDraft = parentChatId ? getSubChatDraft(parentChatId, subChatId) : null

    if (savedDraft) {
      editorRef.current?.setValue(savedDraft)
      currentDraftTextRef.current = savedDraft
    } else if (prevSubChatIdForDraftRef.current && prevSubChatIdForDraftRef.current !== subChatId) {
      editorRef.current?.clear()
      currentDraftTextRef.current = ""
    }

    prevSubChatIdForDraftRef.current = subChatId
  }, [subChatId, parentChatId])

  // Use subChatId as stable key to prevent HMR-induced duplicate resume requests
  // resume: !!streamId to reconnect to active streams (background streaming support)
  const { messages, sendMessage, status, stop, regenerate } = useChat({
    id: subChatId,
    chat,
    resume: !!streamId,
    // experimental_throttle: 200,
  })

  // Add event listener to handle custom status reset events
  useEffect(() => {
    const handleResetStatus = (event: CustomEvent) => {
      if (event.detail?.subChatId === subChatId) {
        console.log(`[SD] C:RESET_EVENT sub=${subChatId.slice(-8)} - resetting chat status`)

        // Force a regeneration to reset the internal state
        try {
          regenerate()
        } catch (error) {
          console.error("[SD] C:RESET_EVENT - Failed to regenerate:", error)
        }
      }
    }

    window.addEventListener('reset-chat-status', handleResetStatus as EventListener)

    return () => {
      window.removeEventListener('reset-chat-status', handleResetStatus as EventListener)
    }
  }, [subChatId, regenerate])

  // Stream debug: log status changes
  const prevStatusRef = useRef(status)
  const streamingStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      const subId = subChatId.slice(-8)
      console.log(`[SD] C:STATUS sub=${subId} ${prevStatusRef.current} → ${status} msgs=${messages.length}`)

      // Track when streaming starts
      if ((status === "streaming" || status === "submitted") &&
        (prevStatusRef.current !== "streaming" && prevStatusRef.current !== "submitted")) {
        streamingStartRef.current = Date.now()
        console.log(`[SD] C:STREAMING_START sub=${subId}`)
      }

      // Reset streaming start time when status returns to ready
      if (status === "ready" &&
        (prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted")) {
        streamingStartRef.current = null
        console.log(`[SD] C:STREAMING_END sub=${subId}`)
      }

      prevStatusRef.current = status
    }
  }, [status, subChatId, messages.length])

  // Safety check: if streaming for too long without completion, try to reset
  useEffect(() => {
    const checkStreamingStuck = () => {
      if ((status === "streaming" || status === "submitted") &&
        streamingStartRef.current &&
        Date.now() - streamingStartRef.current > 30000) { // 30 seconds
        console.log(`[SD] C:STREAMING_STUCK sub=${subChatId.slice(-8)} - attempting to reset`)

        // Try to force a status reset by calling stop()
        try {
          stop()
          // Reset the streaming start time to avoid repeated checks
          streamingStartRef.current = null
        } catch (error) {
          console.error("[SD] C:STREAMING_STUCK - Failed to reset:", error)
        }
      }
    }

    // Check every 5 seconds
    const interval = setInterval(checkStreamingStuck, 5000)

    return () => clearInterval(interval)
  }, [status, stop, subChatId])

  // Additional safety check: ensure status eventually returns to ready after system messages
  useEffect(() => {
    // Check if we have any messages and the status is still in loading state
    if ((status === "streaming" || status === "submitted") &&
      messages.length > 0 &&
      streamingStartRef.current) {

      // Check if the last assistant message is complete
      const lastMessage = messages[messages.length - 1]
      const hasAssistantMessage = messages.some(m => m.role === 'assistant')

      if (hasAssistantMessage && streamingStartRef.current) {
        const streamingDuration = Date.now() - streamingStartRef.current

        // If streaming for more than 5 seconds after we have an assistant message,
        // the stream might be stuck
        if (streamingDuration > 5000) {
          console.log(`[SD] C:STATUS_RESET sub=${subChatId.slice(-8)} - forcing ready state`)

          // Force a regeneration to reset the state
          try {
            // This will trigger the useChat hook to reset its internal state
            window.dispatchEvent(new CustomEvent('reset-chat-status', {
              detail: { subChatId }
            }))
          } catch (error) {
            console.error("[SD] C:STATUS_RESET - Failed to dispatch event:", error)
          }
        }
      }
    }
  }, [status, messages, subChatId])

  const isStreaming = status === "streaming" || status === "submitted"

  // Ensure status resets to ready after streaming completes
  // This prevents the send button from staying disabled after streaming finishes
  useEffect(() => {
    // If status is stuck in streaming/submitted after messages have been added
    // and there's no active stream, force reset to ready
    if ((status === "streaming" || status === "submitted") && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      // If last message is assistant and has been completed for more than 2 seconds
      // but status hasn't reset, force a reset
      const hasCompleteAssistantMessage = lastMessage?.role === "assistant" && 
        lastMessage?.parts && 
        lastMessage.parts.length > 0 &&
        !lastMessage.parts.some((p: any) => p.state === "input-available" || p.state === "input-streaming")
      
      if (hasCompleteAssistantMessage && streamingStartRef.current) {
        const streamingDuration = Date.now() - streamingStartRef.current
        // If streaming started more than 3 seconds ago and message appears complete
        // but status hasn't reset, try to reset it
        if (streamingDuration > 3000) {
          // Check if stream is actually still active
          const streamId = agentChatStore.getStreamId(subChatId)
          if (!streamId || streamingDuration > 5000) {
            console.log(`[SD] C:AUTO_RESET sub=${subChatId.slice(-8)} - forcing ready after completion`)
            // Use a timeout to allow natural status transition first
            const timeoutId = setTimeout(() => {
              if (status === "streaming" || status === "submitted") {
                window.dispatchEvent(new CustomEvent('reset-chat-status', {
                  detail: { subChatId }
                }))
              }
            }, 1000)
            return () => clearTimeout(timeoutId)
          }
        }
      }
    }
  }, [status, messages, subChatId])

  // Get browser preview atoms and state for this chat
  const currentChatId = parentChatId || subChatId
  const browserPreviewUrlAtom = useMemo(
    () => browserPreviewUrlAtomFamily(currentChatId),
    [currentChatId],
  )
  const [, setBrowserPreviewUrl] = useAtom(browserPreviewUrlAtom)
  const [isPreviewSidebarOpen, setIsPreviewSidebarOpen] = useAtom(
    agentsPreviewSidebarOpenAtom,
  )

  // Track last detected port to avoid reopening for same port
  const lastDetectedPortRef = useRef<number | null>(null)

  // Auto-detect ports from bash tool outputs and open browser preview
  useEffect(() => {
    // Only run during streaming to avoid unnecessary checks
    if (!isStreaming) return

    // Find all bash tool parts with outputs (check most recent first)
    const bashParts = messages
      .flatMap((msg: any) => (msg.parts || []).filter((p: any) => p.type === 'tool-Bash' && p.output))
      .reverse()

    for (const part of bashParts) {
      const output = part.output
      const outputText = typeof output === 'string'
        ? output
        : (output.stdout || output.output || output.stderr || '')

      // Check command to see if it's a server-starting command
      const command = part.input?.command || ''
      const isServerCommand = /(?:npm|yarn|pnpm|bun|node|deno).*(?:start|dev|serve|server|run)/i.test(command) ||
        /(?:vite|next|react-scripts|webpack-dev-server)/i.test(command)

      // Try to extract port from output (server-start patterns)
      const portPatterns = [
        /listening on (?:port )?(\d+)/i,
        /started on port (\d+)/i,
        /running on (?:http:\/\/localhost:|port )(\d+)/i,
        /Local:\s+http:\/\/localhost:(\d+)/i,
        /http:\/\/localhost:(\d{4,5})/i,
        /ready in.*localhost:(\d{4,5})/i,
        /compiled.*localhost:(\d{4,5})/i,
      ]

      for (const pattern of portPatterns) {
        const match = outputText.match(pattern)
        if (match && match[1]) {
          const port = parseInt(match[1], 10)
          if (port >= 1000 && port <= 65535) { // Valid port range
            // Skip if we already detected this port
            if (lastDetectedPortRef.current === port) {
              return
            }

            const url = `http://localhost:${port}`
            // Only auto-open if it looks like a server command or server-start message
            const hasServerStartMessage = /(?:listening|started|running|ready|compiled|server)/i.test(outputText)

            if (isServerCommand || hasServerStartMessage) {
              // Only auto-open if preview sidebar is not already open with this URL
              const currentUrl = appStore.get(browserPreviewUrlAtom)
              if (currentUrl !== url) {
                console.log(`[BrowserPreview] Auto-detected port ${port} from bash output, opening preview`)
                setBrowserPreviewUrl(url)
                setIsPreviewSidebarOpen(true)
                lastDetectedPortRef.current = port
              }
              return // Only open once for the most recent match
            }
          }
        }
      }
    }
  }, [messages, currentChatId, setBrowserPreviewUrl, setIsPreviewSidebarOpen, isStreaming])

  // Sync loading status to atom for UI indicators
  // When streaming starts, set loading. When it stops, clear loading.
  // Unseen changes, sound notification, and sidebar refresh are handled in onFinish callback
  const setLoadingSubChats = useSetAtom(loadingSubChatsAtom)

  useEffect(() => {
    const storedParentChatId = agentChatStore.getParentChatId(subChatId)
    if (!storedParentChatId) return

    if (isStreaming) {
      setLoading(setLoadingSubChats, subChatId, storedParentChatId)
    } else {
      clearLoading(setLoadingSubChats, subChatId)
    }
  }, [isStreaming, subChatId, setLoadingSubChats])

  // Watch for pending PR message and send it
  const [pendingPrMessage, setPendingPrMessage] = useAtom(pendingPrMessageAtom)

  useEffect(() => {
    if (pendingPrMessage && !isStreaming) {
      // Clear the pending message immediately to prevent double-sending
      setPendingPrMessage(null)

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: pendingPrMessage }],
      })
    }
  }, [pendingPrMessage, isStreaming, sendMessage, setPendingPrMessage])

  // Watch for pending Review message and send it
  const [pendingReviewMessage, setPendingReviewMessage] = useAtom(
    pendingReviewMessageAtom,
  )

  useEffect(() => {
    if (pendingReviewMessage && !isStreaming) {
      // Clear the pending message immediately to prevent double-sending
      setPendingReviewMessage(null)

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: pendingReviewMessage }],
      })
    }
  }, [pendingReviewMessage, isStreaming, sendMessage, setPendingReviewMessage])

  // Pending user questions from AskUserQuestion tool
  const [pendingQuestions, setPendingQuestions] = useAtom(
    pendingUserQuestionsAtom,
  )

  // Check if there are pending questions for the current subchat
  const hasPendingQuestionsForThisChat = pendingQuestions?.subChatId === subChatId


  // Memoize the last assistant message to avoid unnecessary recalculations
  const lastAssistantMessage = useMemo(
    () => messages.findLast((m) => m.role === "assistant"),
    [messages],
  )

  // Sync pending questions with messages state
  // This handles: 1) restoring on chat switch, 2) clearing when question is answered/timed out
  useEffect(() => {
    // Check if there's a pending AskUserQuestion in the last assistant message
    const pendingQuestionPart = lastAssistantMessage?.parts?.find(
      (part: any) =>
        part.type === "tool-AskUserQuestion" &&
        part.state !== "output-available" &&
        part.state !== "output-error" &&
        part.state !== "result" &&
        part.input?.questions,
    ) as any | undefined

    // If streaming and we already have a pending question for this chat, keep it
    // (transport will manage it via chunks)
    if (isStreaming && pendingQuestions?.subChatId === subChatId) {
      // But if the question in messages is already answered, clear the atom
      if (pendingQuestions && !pendingQuestionPart) {
        // Check if the specific toolUseId is now answered
        const answeredPart = lastAssistantMessage?.parts?.find(
          (part: any) =>
            part.type === "tool-AskUserQuestion" &&
            part.toolCallId === pendingQuestions.toolUseId &&
            (part.state === "output-available" ||
              part.state === "output-error" ||
              part.state === "result"),
        )
        if (answeredPart) {
          setPendingQuestions(null)
        }
      }
      return
    }

    // Not streaming - restore or clear based on messages
    if (pendingQuestionPart) {
      // Skip if this question was already answered by user
      if (answeredQuestionsRef.current.has(pendingQuestionPart.toolCallId)) {
        return
      }
      // Found pending question - set it (or update if different)
      if (
        pendingQuestions?.subChatId !== subChatId ||
        pendingQuestions?.toolUseId !== pendingQuestionPart.toolCallId
      ) {
        setPendingQuestions({
          subChatId,
          toolUseId: pendingQuestionPart.toolCallId,
          questions: pendingQuestionPart.input.questions,
        })
      }
    } else {
      // No pending question - clear if belongs to this sub-chat
      if (pendingQuestions?.subChatId === subChatId) {
        setPendingQuestions(null)
      }
    }
  }, [subChatId, lastAssistantMessage, isStreaming, pendingQuestions, setPendingQuestions])

  // Handle answering questions
  const handleQuestionsAnswer = useCallback(
    async (answers: Record<string, string | string[]>) => {
      if (!pendingQuestions) return

      // Format answers as readable text
      const formattedAnswers = pendingQuestions.questions
        .map((q: any) => {
          const answer = answers[q.question]
          const answerStr = Array.isArray(answer) ? answer.join(', ') : (answer || '')
          return `**${q.question}**\n${answerStr}`
        })
        .join('\n\n')

      // Mark as answered to prevent re-showing
      answeredQuestionsRef.current.add(pendingQuestions.toolUseId)
      // Clear questions UI immediately
      setPendingQuestions(null)

      // For OpenCode, use the dedicated function to answer questions
      try {
        // Convert answers to the format expected by answerOpenCodeQuestion
        const answersArray = pendingQuestions.questions.map((q: any) => {
          const answer = answers[q.question]
          return Array.isArray(answer) ? answer : [answer || ""]
        })
        
        await window.desktopApi.answerOpenCodeQuestion({
          subChatId,
          requestId: pendingQuestions.toolUseId,
          answers: answersArray,
          message: formattedAnswers,
        })
      } catch (error) {
        console.error("Failed to answer OpenCode question:", error)
        // Fallback to the old method if the new method fails
        await trpcClient.claude.respondToolApproval.mutate({
          toolUseId: pendingQuestions.toolUseId,
          approved: true,
          updatedInput: { questions: pendingQuestions.questions, answers },
        })
      }
    },
    [pendingQuestions, setPendingQuestions, subChatId],
  )

  // Handle skipping questions
  const handleQuestionsSkip = useCallback(async () => {
    if (!pendingQuestions) return
    // Mark as answered to prevent re-showing
    answeredQuestionsRef.current.add(pendingQuestions.toolUseId)
    // Clear questions UI immediately BEFORE sending to prevent it from showing again
    setPendingQuestions(null)
    
    try {
      await window.desktopApi.answerOpenCodeQuestion({
        subChatId,
        requestId: pendingQuestions.toolUseId,
        answers: [],
        message: QUESTIONS_SKIPPED_MESSAGE,
      })
    } catch (error) {
      console.error("Failed to skip OpenCode question:", error)
      // Fallback to the old method if the new method fails
      await trpcClient.claude.respondToolApproval.mutate({
        toolUseId: pendingQuestions.toolUseId,
        approved: false,
        message: QUESTIONS_SKIPPED_MESSAGE,
      })
    }
  }, [pendingQuestions, setPendingQuestions, subChatId])

  // Handler for answering in prompt
  const handleAnswerInPrompt = useCallback((questionsText: string) => {
    console.log('[UI] Answer in prompt:', questionsText)

    // Close the modal
    setPendingQuestions(null)

    // Insert answer into chat input and auto-send
    const editor = editorRef.current
    if (editor) {
      editor.setValue(questionsText)
      editor.focus()
      // Trigger send automatically after short delay
      setTimeout(() => {
        const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement
        if (sendButton && !sendButton.disabled) {
          sendButton.click()
        }
      }, 100)
    }
  }, [setPendingQuestions])

  // Watch for pending auth retry message (after successful OAuth flow)
  const [pendingAuthRetry, setPendingAuthRetry] = useAtom(
    pendingAuthRetryMessageAtom,
  )

  useEffect(() => {
    // Only retry when:
    // 1. There's a pending message
    // 2. readyToRetry is true (set by modal on OAuth success)
    // 3. We're in the correct chat
    // 4. Not currently streaming
    if (
      pendingAuthRetry &&
      pendingAuthRetry.readyToRetry &&
      pendingAuthRetry.subChatId === subChatId &&
      !isStreaming
    ) {
      // Clear the pending message immediately to prevent double-sending
      setPendingAuthRetry(null)

      // Build message parts
      const parts: Array<
        { type: "text"; text: string } | { type: "data-image"; data: any }
      > = [{ type: "text", text: pendingAuthRetry.prompt }]

      // Add images if present
      if (pendingAuthRetry.images && pendingAuthRetry.images.length > 0) {
        for (const img of pendingAuthRetry.images) {
          parts.push({
            type: "data-image",
            data: {
              base64Data: img.base64Data,
              mediaType: img.mediaType,
              filename: img.filename,
            },
          })
        }
      }

      // Send the message to Claude
      sendMessage({
        role: "user",
        parts,
      })
    }
  }, [
    pendingAuthRetry,
    isStreaming,
    sendMessage,
    setPendingAuthRetry,
    subChatId,
  ])

  const handlePlanApproval = useCallback(
    async (toolUseId: string, approved: boolean) => {
      if (!toolUseId) return
      setPlanApprovalPending((prev) => ({ ...prev, [toolUseId]: true }))
      try {
        await trpcClient.claude.respondToolApproval.mutate({
          toolUseId,
          approved,
        })
      } catch (error) {
        console.error("[plan-approval] Failed to respond:", error)
        toast.error("Failed to send plan approval. Please try again.")
      } finally {
        setPlanApprovalPending((prev) => {
          const next = { ...prev }
          delete next[toolUseId]
          return next
        })
      }
    },
    [],
  )

  // Handle plan approval - sends "Implement plan" message and switches to agent mode
  const handleApprovePlan = useCallback(() => {
    // Update store mode synchronously BEFORE sending (transport reads from store)
    useAgentSubChatStore.getState().updateSubChatMode(subChatId, "agent")

    // Update React state (for UI)
    setIsPlanMode(false)

    // Send "Implement plan" message (now in agent mode)
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: "Implement plan" }],
    })
  }, [subChatId, setIsPlanMode, sendMessage])

  // Detect PR URLs in assistant messages and store them
  const detectedPrUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Only check after streaming ends
    if (isStreaming) return

    // Look through messages for PR URLs
    for (const msg of messages) {
      if (msg.role !== "assistant") continue

      // Extract text content from message
      const textContent =
        msg.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join(" ") || ""

      // Match GitHub PR URL pattern
      const prUrlMatch = textContent.match(
        /https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)/,
      )

      if (prUrlMatch && prUrlMatch[0] !== detectedPrUrlRef.current) {
        const prUrl = prUrlMatch[0]
        const prNumber = parseInt(prUrlMatch[1], 10)

        // Store to prevent duplicate calls
        detectedPrUrlRef.current = prUrl

        // Update database
        trpcClient.chats.updatePrInfo
          .mutate({ chatId: parentChatId, prUrl, prNumber })
          .then(() => {
            toast.success(`PR #${prNumber} created!`, {
              position: "top-center",
            })
            // Invalidate the agentChat query to refetch with new PR info
            utils.agents.getAgentChat.invalidate({ chatId: parentChatId })
          })

        break // Only process first PR URL found
      }
    }
  }, [messages, isStreaming, parentChatId])

  // Track changed files from Edit/Write tool calls
  // Only recalculates after streaming ends (not during streaming)
  const { changedFiles: changedFilesForSubChat } = useChangedFilesTracking(
    messages,
    subChatId,
    isStreaming,
  )

  // ESC, Ctrl+C and Cmd+Shift+Backspace handler for stopping stream
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      let shouldStop = false

      // Check for Escape key without modifiers (works even from input fields, like terminal Ctrl+C)
      // Ignore if Cmd/Ctrl is pressed (reserved for Cmd+Esc to focus input)
      if (
        e.key === "Escape" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        isStreaming
      ) {
        const target = e.target as HTMLElement

        // Allow ESC to propagate if it originated from a modal/dialog/dropdown
        const isInsideOverlay = target.closest(
          '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], [data-state="open"]',
        )

        if (!isInsideOverlay) {
          shouldStop = true
        }
      }

      // Check for Ctrl+C (only Ctrl, not Cmd on Mac)
      if (e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        if (!isStreaming) return

        const selection = window.getSelection()
        const hasSelection = selection && selection.toString().length > 0

        // If there's a text selection, let browser handle copy
        if (hasSelection) return

        shouldStop = true
      }

      // Check for Cmd+Shift+Backspace (Mac) or Ctrl+Shift+Backspace (Windows/Linux)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key === "Backspace" &&
        isStreaming
      ) {
        shouldStop = true
      }

      if (shouldStop) {
        e.preventDefault()
        // Mark as manually aborted to prevent completion sound
        agentChatStore.setManuallyAborted(subChatId, true)
        await stop()
        // Call DELETE endpoint to cancel server-side stream
        await fetch(`/api/agents/chat?id=${encodeURIComponent(subChatId)}`, {
          method: "DELETE",
          credentials: "include",
        })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isStreaming, stop, subChatId])

  // Keyboard shortcut: Enter to focus input when not already focused
  useFocusInputOnEnter(editorRef)

  // Keyboard shortcut: Cmd+Esc to toggle focus/blur (without stopping generation)
  useToggleFocusOnCmdEsc(editorRef)

  // Auto-trigger AI response when we have initial message but no response yet
  // Also trigger auto-rename for initial sub-chat with pre-populated message
  // IMPORTANT: Skip if there's an active streamId (prevents double-generation on resume)
  useEffect(() => {
    if (
      messages.length === 1 &&
      status === "ready" &&
      !streamId &&
      !hasTriggeredAutoGenerateRef.current
    ) {
      hasTriggeredAutoGenerateRef.current = true
      // Trigger rename for pre-populated initial message (from createAgentChat)
      if (!hasTriggeredRenameRef.current && isFirstSubChat) {
        const firstMsg = messages[0]
        if (firstMsg?.role === "user") {
          const textPart = firstMsg.parts?.find((p: any) => p.type === "text")
          if (textPart && "text" in textPart) {
            hasTriggeredRenameRef.current = true
            onAutoRename(textPart.text, subChatId)
          }
        }
      }
      regenerate()
    }
  }, [
    status,
    messages,
    regenerate,
    isFirstSubChat,
    onAutoRename,
    streamId,
    subChatId,
  ])

  // Save and restore scroll position on tab switch
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    // Read current saved position (intentionally not in deps - we only restore on tab switch)
    const savedPosition = scrollPositions[subChatId]
    if (savedPosition !== undefined) {
      container.scrollTop = savedPosition
      currentScrollTopRef.current = savedPosition
      justRestoredRef.current = true
      const atBottom = isAtBottom()
      setShouldAutoScroll(atBottom)
      shouldAutoScrollRef.current = atBottom
    } else {
      // First time opening this sub-chat - scroll to bottom
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
        currentScrollTopRef.current = container.scrollHeight
        setShouldAutoScroll(true)
        shouldAutoScrollRef.current = true
      })
    }

    // Save position when LEAVING this tab (use ref because container may already point to new tab)
    const currentSubChatId = subChatId
    return () => {
      setScrollPositions((prev: Record<string, number>) => ({
        ...prev,
        [currentSubChatId]: currentScrollTopRef.current,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subChatId])

  // Attach scroll listener (separate effect)
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  // Track previous subChatId to skip auto-scroll on tab switch
  const prevSubChatIdForAutoScrollRef = useRef<string | null>(null)

  // Auto scroll to bottom when messages change (only if user is at bottom)
  // Skip on tab switch and right after restore
  useEffect(() => {
    const isTabSwitch =
      prevSubChatIdForAutoScrollRef.current !== null &&
      prevSubChatIdForAutoScrollRef.current !== subChatId
    prevSubChatIdForAutoScrollRef.current = subChatId

    if (isTabSwitch) return

    // Skip if we just restored (state update is async, ref is sync)
    if (justRestoredRef.current) {
      justRestoredRef.current = false
      return
    }

    if (shouldAutoScrollRef.current) {
      const container = chatContainerRef.current
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight
        })
      }
    }
  }, [messages, status, subChatId]) // Note: shouldAutoScroll intentionally not in deps - we only want to scroll on message/status changes, not when user scrolls to bottom

  // Auto-focus input when switching to this chat (any sub-chat change)
  // Skip on mobile to prevent keyboard from opening automatically
  useEffect(() => {
    if (isMobile) return // Don't autofocus on mobile

    // Use requestAnimationFrame to ensure DOM is ready after render
    requestAnimationFrame(() => {
      editorRef.current?.focus()
    })
  }, [subChatId, isMobile])

  const handleSend = async () => {
    // Block sending while sandbox is still being set up
    if (sandboxSetupStatus !== "ready") {
      return
    }

    // Safety check: if status appears stuck in streaming but stream is actually complete
    // Allow sending anyway to prevent UI from being stuck
    if (status === "streaming" || status === "submitted") {
      const streamId = agentChatStore.getStreamId(subChatId)
      const streamingDuration = streamingStartRef.current ? Date.now() - streamingStartRef.current : 0
      // If no active stream ID and streaming has been going for more than 5 seconds,
      // likely the status is stuck - try to reset it first
      if (!streamId && streamingDuration > 5000) {
        console.log(`[SD] C:FORCE_RESET_ON_SEND sub=${subChatId.slice(-8)} - resetting stuck status before send`)
        try {
          stop()
          // Wait a bit for status to reset
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error("[SD] C:FORCE_RESET_ON_SEND - Failed to reset:", error)
        }
      }
    }

    // Get value from uncontrolled editor
    const inputValue = editorRef.current?.getValue() || ""
    const hasText = inputValue.trim().length > 0
    const hasImages =
      images.filter((img) => !img.isLoading && img.url).length > 0

    if (!hasText && !hasImages) return

    const text = inputValue.trim()
    // Clear editor and draft from localStorage
    editorRef.current?.clear()
    currentDraftTextRef.current = ""
    if (parentChatId) {
      clearSubChatDraft(parentChatId, subChatId)
    }

    // Track message sent
    trackMessageSent({
      workspaceId: subChatId,
      messageLength: text.length,
      mode: isPlanMode ? "plan" : "agent",
    })

    // Trigger auto-rename on first message in a new sub-chat
    if (messages.length === 0 && !hasTriggeredRenameRef.current) {
      hasTriggeredRenameRef.current = true
      onAutoRename(text || "Image message", subChatId)
    }

    // Build message parts: images first, then files, then text
    // Include base64Data for API transmission
    const parts: any[] = [
      ...images
        .filter((img) => !img.isLoading && img.url)
        .map((img) => ({
          type: "data-image" as const,
          data: {
            url: img.url,
            mediaType: img.mediaType,
            filename: img.filename,
            base64Data: img.base64Data, // Include base64 data for Claude API
          },
        })),
      ...files
        .filter((f) => !f.isLoading && f.url)
        .map((f) => ({
          type: "data-file" as const,
          data: {
            url: f.url,
            mediaType: (f as any).mediaType,
            filename: f.filename,
            size: f.size,
          },
        })),
    ]

    if (text) {
      parts.push({ type: "text", text })
    }

    clearAll()

    // Optimistic update: immediately update chat's updated_at and resort array for instant sidebar resorting
    if (teamId) {
      const now = new Date()
      utils.agents.getAgentChats.setData({ teamId }, (old: any) => {
        if (!old) return old
        // Update the timestamp and sort by updated_at descending
        const updated = old.map((c: any) =>
          c.id === parentChatId ? { ...c, updated_at: now } : c,
        )
        return updated.sort(
          (a: any, b: any) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
      })
    }

    // Optimistically update sub-chat timestamp to move it to top
    useAgentSubChatStore.getState().updateSubChatTimestamp(subChatId)

    // Force scroll to bottom when sending a message
    shouldAutoScrollRef.current = true
    const container = chatContainerRef.current
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }

    await sendMessage({ role: "user", parts })
  }

  const handleMentionSelect = useCallback((mention: FileMentionOption) => {
    editorRef.current?.insertMention(mention)
    setShowMentionDropdown(false)
  }, [])

  // Slash command handlers
  const handleSlashTrigger = useCallback(
    ({ searchText, rect }: { searchText: string; rect: DOMRect }) => {
      setSlashSearchText(searchText)
      setSlashPosition({ top: rect.top, left: rect.left })
      setShowSlashDropdown(true)
    },
    [],
  )

  const handleCloseSlashTrigger = useCallback(() => {
    setShowSlashDropdown(false)
  }, [])

  const handleSlashSelect = useCallback(
    (command: SlashCommandOption) => {
      // Clear the slash command text from editor
      editorRef.current?.clearSlashCommand()
      setShowSlashDropdown(false)

      // Handle builtin commands
      if (command.category === "builtin") {
        switch (command.name) {
          case "clear":
            // Create a new sub-chat (fresh conversation)
            if (onCreateNewSubChat) {
              onCreateNewSubChat()
            }
            break
          case "plan":
            if (!isPlanMode) {
              setIsPlanMode(true)
            }
            break
          case "agent":
            if (isPlanMode) {
              setIsPlanMode(false)
            }
            break
          // Prompt-based commands - auto-send to agent
          case "review":
          case "pr-comments":
          case "release-notes":
          case "security-review": {
            const prompt =
              COMMAND_PROMPTS[command.name as keyof typeof COMMAND_PROMPTS]
            if (prompt) {
              editorRef.current?.setValue(prompt)
              // Auto-send the prompt to agent
              setTimeout(() => handleSend(), 0)
            }
            break
          }
        }
        return
      }

      // Handle repository commands - auto-send to agent
      if (command.prompt) {
        editorRef.current?.setValue(command.prompt)
        setTimeout(() => handleSend(), 0)
      }
    },
    [isPlanMode, setIsPlanMode, handleSend, onCreateNewSubChat],
  )

  // Paste handler for images and plain text
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[]

      if (files.length > 0) {
        e.preventDefault()
        handleAddAttachments(files)
      } else {
        // Paste as plain text only (prevents HTML from being pasted)
        const text = e.clipboardData.getData("text/plain")
        if (text) {
          e.preventDefault()
          document.execCommand("insertText", false, text)
        }
      }
    },
    [handleAddAttachments],
  )

  // Drag/drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      handleAddAttachments(droppedFiles)
      // Focus after state update - use double rAF to wait for React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorRef.current?.focus()
        })
      })
    },
    [handleAddAttachments],
  )

  // Helper to get message text content
  const getMessageTextContent = (msg: any): string => {
    return (
      msg.parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n") || ""
    )
  }

  // Helper to copy message content
  const copyMessageContent = (msg: any) => {
    const textContent = getMessageTextContent(msg)
    if (textContent) {
      navigator.clipboard.writeText(stripEmojis(textContent))
    }
  }

  // Check if there's an unapproved plan (ExitPlanMode without subsequent "Implement plan")
  const hasUnapprovedPlan = useMemo(() => {
    // Traverse messages from end to find unapproved ExitPlanMode
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]

      // If user message says "Implement plan", plan is already approved
      if (msg.role === "user") {
        const text = msg.parts?.find((p: any) => p.type === "text")?.text || ""
        if (text.trim().toLowerCase() === "implement plan") {
          return false
        }
      }

      // If assistant message with ExitPlanMode, we found an unapproved plan
      if (msg.role === "assistant") {
        const exitPlanPart = msg.parts?.find(
          (p: any) => p.type === "tool-ExitPlanMode",
        )
        if (exitPlanPart?.output?.plan) {
          return true
        }
      }
    }
    return false
  }, [messages])

  // Keyboard shortcut: Cmd+Enter to approve plan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        e.metaKey &&
        !e.shiftKey &&
        hasUnapprovedPlan &&
        !isStreaming
      ) {
        e.preventDefault()
        handleApprovePlan()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [hasUnapprovedPlan, isStreaming, handleApprovePlan])

  // Group messages into pairs: [userMsg, ...assistantMsgs]
  // Each group is a "conversation turn" where user message is sticky within the group
  const messageGroups = useMemo(() => {
    const groups: {
      userMsg: (typeof messages)[0]
      assistantMsgs: (typeof messages)[0][]
    }[] = []
    let currentGroup: {
      userMsg: (typeof messages)[0]
      assistantMsgs: (typeof messages)[0][]
    } | null = null

    for (const msg of messages) {
      if (msg.role === "user") {
        // Start a new group
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = { userMsg: msg, assistantMsgs: [] }
      } else if (currentGroup) {
        // Add assistant message to current group
        currentGroup.assistantMsgs.push(msg)
      }
    }

    // Push the last group
    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }, [messages])

  return (
    <>
      {/* Chat title - flex above scroll area (desktop only) */}
      {!isMobile && (
        <div
          className={cn(
            "flex-shrink-0 pb-2",
            isSubChatsSidebarOpen ? "pt-[52px]" : "pt-2",
          )}
        >
          <ChatTitleEditor
            name={subChatName}
            placeholder="New Agent"
            onSave={handleRenameSubChat}
            isMobile={false}
            chatId={subChatId}
            hasMessages={messages.length > 0}
          />
        </div>
      )}

      {/* Messages */}
      <div
        ref={(el) => {
          chatContainerRef.current = el
        }}
        className="flex-1 overflow-y-auto w-full relative allow-text-selection outline-none"
        tabIndex={-1}
        data-chat-container
      >
        <div className="px-2 max-w-2xl mx-auto -mb-4 pb-8 space-y-4">
          {/* Command History Panel - shows all bash commands from conversation */}
          <AgentCommandHistory
            messages={messages}
            chatStatus={status}
            onExecuteInTerminal={onExecuteInTerminal}
            onViewFullOutput={onViewFullOutput}
          />
          
          <div>
            {/* Render message groups - each group has user message sticky within it */}
            {messageGroups.map((group, groupIndex) => {
              const msg = group.userMsg
              const isLastUserMessage = groupIndex === messageGroups.length - 1

              // User message data
              const textContent = msg.parts
                ?.filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n")

              const imageParts =
                msg.parts?.filter((p: any) => p.type === "data-image") || []

              // Show cloning when sandbox is being set up (only for last user message with no responses)
              const shouldShowCloning =
                sandboxSetupStatus === "cloning" &&
                isLastUserMessage &&
                group.assistantMsgs.length === 0

              // Show setup error if sandbox setup failed
              const shouldShowSetupError =
                sandboxSetupStatus === "error" &&
                isLastUserMessage &&
                group.assistantMsgs.length === 0

              return (
                <div key={msg.id} className="relative">
                  {/* Attachments - NOT sticky, scroll normally */}
                  {imageParts.length > 0 && (
                    <motion.div
                      className="mb-2 pointer-events-auto"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1, ease: "easeOut" }}
                    >
                      <AgentUserMessageBubble
                        messageId={msg.id}
                        textContent=""
                        imageParts={imageParts}
                      />
                    </motion.div>
                  )}
                  {/* User message text - sticky WITHIN this group */}
                  {/* z-10 ensures user message stays above scrolling content (tool calls, buttons) */}
                  <div
                    data-user-message-id={msg.id}
                    className={cn(
                      "[&>div]:!mb-4 pointer-events-auto",
                      "sticky z-10",
                      isMobile
                        ? CHAT_LAYOUT.stickyTopMobile
                        : isSubChatsSidebarOpen
                          ? CHAT_LAYOUT.stickyTopSidebarOpen
                          : CHAT_LAYOUT.stickyTopSidebarClosed,
                    )}
                  >
                    <AgentUserMessageBubble
                      messageId={msg.id}
                      textContent={textContent || ""}
                      imageParts={[]}
                    />

                    {/* Undo Button */}
                    {!isMobile && (
                      <div className="absolute -left-12 top-0 bottom-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-background border shadow-sm hover:bg-muted"
                              onClick={() => {
                                setUndoMessageId(msg.id)
                                setUndoConfirmOpen(true)
                              }}
                            >
                              <Undo2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Undo this prompt</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                    {/* Cloning indicator - shown while sandbox is being set up */}
                    {shouldShowCloning && (
                      <div className="mt-4">
                        <AgentToolCall
                          icon={AgentToolRegistry["tool-cloning"].icon}
                          title={AgentToolRegistry["tool-cloning"].title({})}
                          isPending={true}
                          isError={false}
                        />
                      </div>
                    )}
                    {/* Setup error with retry */}
                    {shouldShowSetupError && (
                      <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-center gap-2 text-destructive text-sm">
                          <span>
                            Failed to set up sandbox
                            {sandboxSetupError ? `: ${sandboxSetupError}` : ""}
                          </span>
                          {onRetrySetup && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={onRetrySetup}
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assistant messages in this group */}
                  {group.assistantMsgs.map((assistantMsg) => {
                    const isLastMessage =
                      assistantMsg.id === messages[messages.length - 1]?.id

                    // Assistant message - flat layout, no bubble (like Canvas)
                    const contentParts =
                      assistantMsg.parts?.filter(
                        (p: any) => p.type !== "step-start",
                      ) || []

                    // Show planning when streaming but no content yet (like Canvas)
                    // Only show after sandbox is ready
                    const shouldShowPlanning =
                      sandboxSetupStatus === "ready" &&
                      isStreaming &&
                      isLastMessage &&
                      contentParts.length === 0

                    // Check if message has text content (for copy button)
                    const hasTextContent = assistantMsg.parts?.some(
                      (p: any) => p.type === "text" && p.text?.trim(),
                    )

                    // Build map of nested tools per parent Task
                    const nestedToolsMap = new Map<string, any[]>()
                    const nestedToolIds = new Set<string>()
                    const taskPartIds = new Set(
                      (assistantMsg.parts || [])
                        .filter(
                          (p: any) => p.type === "tool-Task" && p.toolCallId,
                        )
                        .map((p: any) => p.toolCallId),
                    )
                    const orphanTaskGroups = new Map<
                      string,
                      { parts: any[]; firstToolCallId: string }
                    >()
                    const orphanToolCallIds = new Set<string>()
                    const orphanFirstToolCallIds = new Set<string>()

                    for (const part of assistantMsg.parts || []) {
                      if (part.toolCallId?.includes(":")) {
                        const parentId = part.toolCallId.split(":")[0]
                        if (taskPartIds.has(parentId)) {
                          if (!nestedToolsMap.has(parentId)) {
                            nestedToolsMap.set(parentId, [])
                          }
                          nestedToolsMap.get(parentId)!.push(part)
                          nestedToolIds.add(part.toolCallId)
                        } else {
                          let group = orphanTaskGroups.get(parentId)
                          if (!group) {
                            group = {
                              parts: [],
                              firstToolCallId: part.toolCallId,
                            }
                            orphanTaskGroups.set(parentId, group)
                            orphanFirstToolCallIds.add(part.toolCallId)
                          }
                          group.parts.push(part)
                          orphanToolCallIds.add(part.toolCallId)
                        }
                      }
                    }

                    // Get metadata for usage display
                    const msgMetadata =
                      assistantMsg.metadata as AgentMessageMetadata

                    // Detect final text by structure: last text part after any tool parts
                    // This works locally without needing metadata.finalTextId
                    const allParts = assistantMsg.parts || []

                    // Find the last tool index and last text index
                    let lastToolIndex = -1
                    let lastTextIndex = -1
                    for (let i = 0; i < allParts.length; i++) {
                      const part = allParts[i]
                      if (part.type?.startsWith("tool-")) {
                        lastToolIndex = i
                      }
                      if (part.type === "text" && part.text?.trim()) {
                        lastTextIndex = i
                      }
                    }

                    // Final text exists if: there are tools AND the last text comes AFTER the last tool
                    // For streaming messages, don't show as final until streaming completes
                    const hasToolsAndFinalText =
                      lastToolIndex !== -1 && lastTextIndex > lastToolIndex

                    const finalTextIndex = hasToolsAndFinalText
                      ? lastTextIndex
                      : -1

                    // Separate parts into steps (before final) and final text
                    // For non-last messages, show final text even while streaming (they're already complete)
                    const hasFinalText =
                      finalTextIndex !== -1 && (!isStreaming || !isLastMessage)
                    const stepParts = hasFinalText
                      ? (assistantMsg.parts || []).slice(0, finalTextIndex)
                      : []
                    const finalParts = hasFinalText
                      ? (assistantMsg.parts || []).slice(finalTextIndex)
                      : assistantMsg.parts || []

                    // Count visible step items (for the toggle label)
                    const visibleStepsCount = stepParts.filter((p: any) => {
                      if (p.type === "step-start") return false
                      if (p.type === "tool-TaskOutput") return false
                      if (p.toolCallId && nestedToolIds.has(p.toolCallId))
                        return false
                      if (
                        p.toolCallId &&
                        orphanToolCallIds.has(p.toolCallId) &&
                        !orphanFirstToolCallIds.has(p.toolCallId)
                      )
                        return false
                      if (p.type === "text" && !p.text?.trim()) return false
                      return true
                    }).length

                    // Helper function to render a single part
                    const renderPart = (
                      part: any,
                      idx: number,
                      isFinal = false,
                    ) => {
                      // Safety check: ensure part exists
                      if (!part || typeof part !== "object") {
                        return null
                      }

                      // Skip step-start parts
                      if (part.type === "step-start") {
                        return null
                      }

                      // Skip TaskOutput - internal tool with meta info not useful for UI
                      if (part.type === "tool-TaskOutput") {
                        return null
                      }

                      if (
                        part.toolCallId &&
                        orphanToolCallIds.has(part.toolCallId)
                      ) {
                        if (!orphanFirstToolCallIds.has(part.toolCallId)) {
                          return null
                        }
                        const parentId = part.toolCallId.split(":")[0]
                        const group = orphanTaskGroups.get(parentId)
                        if (group) {
                          return (
                            <AgentTaskTool
                              key={idx}
                              part={{
                                type: "tool-Task",
                                toolCallId: parentId,
                                input: {
                                  subagent_type: "unknown-agent",
                                  description: "Incomplete task",
                                },
                              }}
                              nestedTools={group.parts}
                              chatStatus={status}
                            />
                          )
                        }
                      }

                      // Skip nested tools - they're rendered within their parent Task
                      if (
                        part.toolCallId &&
                        nestedToolIds.has(part.toolCallId)
                      ) {
                        return null
                      }

                      // Exploring group - grouped Read/Grep/Glob tools
                      // NOTE: isGroupStreaming is calculated in the map() call below
                      // because we need to know if this is the last element
                      if (part.type === "exploring-group") {
                        return null // Handled separately in map with isLast info
                      }

                      // Text parts - with px-2 like Canvas
                      if (part.type === "text") {
                        if (!part.text?.trim()) return null
                        // Check if this is the final text by comparing index (parts don't have IDs)
                        const isFinalText = isFinal && idx === finalTextIndex

                        return (
                          <div
                            key={idx}
                            className={cn(
                              "text-foreground px-2",
                              // Only show Summary styling if there are steps to collapse
                              isFinalText &&
                              visibleStepsCount > 0 &&
                              "pt-3 border-t border-border/50",
                            )}
                          >
                            {/* Only show Summary label if there are steps to collapse */}
                            {isFinalText && visibleStepsCount > 0 && (
                              <div className="text-[12px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-1">
                                Response
                              </div>
                            )}
                            <ChatMarkdownRenderer
                              content={part.text}
                              size="sm"
                            />
                          </div>
                        )
                      }

                      // Special handling for tool-Task - render with nested tools
                      if (part.type === "tool-Task") {
                        const nestedTools =
                          nestedToolsMap.get(part.toolCallId) || []
                        return (
                          <AgentTaskTool
                            key={idx}
                            part={part}
                            nestedTools={nestedTools}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-Bash - render with full command and output
                      if (part.type === "tool-Bash") {
                        return (
                          <AgentBashTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-Thinking - Extended Thinking
                      if (part.type === "tool-Thinking") {
                        return (
                          <AgentThinkingTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-Edit - render with file icon and diff stats
                      if (part.type === "tool-Edit") {
                        return (
                          <AgentEditTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-Write - render with file preview (reuses AgentEditTool)
                      if (part.type === "tool-Write") {
                        return (
                          <AgentEditTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-WebSearch - collapsible results list
                      if (part.type === "tool-WebSearch") {
                        return (
                          <AgentWebSearchCollapsible
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-WebFetch - expandable content preview
                      if (part.type === "tool-WebFetch") {
                        return (
                          <AgentWebFetchTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-PlanWrite - plan with steps
                      if (part.type === "tool-PlanWrite") {
                        return (
                          <AgentPlanTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                          />
                        )
                      }

                      // Special handling for tool-ExitPlanMode - show simple indicator inline
                      // Full plan card is rendered at end of message
                      if (part.type === "tool-ExitPlanMode") {
                        const { isPending, isError } = getToolStatus(
                          part,
                          status,
                        )
                        return (
                          <AgentToolCall
                            key={idx}
                            icon={AgentToolRegistry["tool-ExitPlanMode"].icon}
                            title={AgentToolRegistry["tool-ExitPlanMode"].title(
                              part,
                            )}
                            isPending={isPending}
                            isError={isError}
                          />
                        )
                      }

                      // Special handling for tool-TodoWrite - todo list with progress
                      if (part.type === "tool-TodoWrite") {
                        return (
                          <AgentTodoTool
                            key={idx}
                            part={part}
                            chatStatus={status}
                            subChatId={subChatId}
                          />
                        )
                      }

                      // Special handling for tool-AskUserQuestion
                      if (part.type === "tool-AskUserQuestion") {
                        const { isPending, isError } = getToolStatus(
                          part,
                          status,
                        )
                        return (
                          <AgentAskUserQuestionTool
                            key={idx}
                            input={part.input}
                            result={part.result}
                            errorText={
                              (part as any).errorText || (part as any).error
                            }
                            state={isPending ? "call" : "result"}
                            isError={isError}
                          />
                        )
                      }

                      // Tool parts - check registry
                      if (part.type && part.type in AgentToolRegistry) {
                        const meta = AgentToolRegistry[part.type]
                        if (!meta) return null
                        const { isPending, isError } = getToolStatus(
                          part,
                          status,
                        )
                        return (
                          <AgentToolCall
                            key={idx}
                            icon={meta.icon}
                            title={meta.title(part)}
                            subtitle={meta.subtitle?.(part)}
                            isPending={isPending}
                            isError={isError}
                          />
                        )
                      }

                      // Fallback for unknown tool types
                      if (part.type?.startsWith("tool-")) {
                        return (
                          <div
                            key={idx}
                            className="text-xs text-muted-foreground py-0.5 px-2"
                          >
                            {part.type.replace("tool-", "")}
                          </div>
                        )
                      }

                      return null
                    }

                    return (
                      <motion.div
                        key={assistantMsg.id}
                        className="group/message w-full mb-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.1, ease: "easeOut" }}
                      >
                        <div className="flex flex-col gap-1.5">
                          {/* Collapsible steps section - only show when we have a final text */}
                          {hasFinalText && visibleStepsCount > 0 && (
                            <CollapsibleSteps stepsCount={visibleStepsCount}>
                              {(() => {
                                const grouped = groupExploringTools(
                                  stepParts,
                                  nestedToolIds,
                                )
                                return grouped.map((part: any, idx: number) => {
                                  // Handle exploring-group with isLast check
                                  if (part.type === "exploring-group") {
                                    const isLast = idx === grouped.length - 1
                                    const isGroupStreaming =
                                      isStreaming && isLastMessage && isLast
                                    return (
                                      <AgentExploringGroup
                                        key={idx}
                                        parts={part.parts}
                                        chatStatus={status}
                                        isStreaming={isGroupStreaming}
                                      />
                                    )
                                  }
                                  return renderPart(part, idx, false)
                                })
                              })()}
                            </CollapsibleSteps>
                          )}

                          {/* Final parts (or all parts if no final text yet) */}
                          {(() => {
                            const grouped = groupExploringTools(
                              finalParts,
                              nestedToolIds,
                            )
                            return grouped.map((part: any, idx: number) => {
                              // Handle exploring-group with isLast check
                              if (part.type === "exploring-group") {
                                const isLast = idx === grouped.length - 1
                                const isGroupStreaming =
                                  isStreaming && isLastMessage && isLast
                                return (
                                  <AgentExploringGroup
                                    key={idx}
                                    parts={part.parts}
                                    chatStatus={status}
                                    isStreaming={isGroupStreaming}
                                  />
                                )
                              }
                              return renderPart(
                                part,
                                hasFinalText ? finalTextIndex + idx : idx,
                                hasFinalText,
                              )
                            })
                          })()}

                          {/* Plan card at end of message - if ExitPlanMode tool has plan content */}
                          {(() => {
                            const exitPlanPart = allParts.find(
                              (p: any) => p.type === "tool-ExitPlanMode",
                            )
                            if (exitPlanPart) {
                              return (
                                <AgentExitPlanModeTool
                                  part={exitPlanPart}
                                  chatStatus={status}
                                />
                              )
                            }
                            return null
                          })()}

                          {/* Planning indicator - like Canvas */}
                          {shouldShowPlanning && (
                            <AgentToolCall
                              icon={AgentToolRegistry["tool-planning"].icon}
                              title={AgentToolRegistry["tool-planning"].title(
                                {},
                              )}
                              isPending={true}
                              isError={false}
                            />
                          )}
                        </div>

                        {/* Copy, Play, and Usage buttons bar - shows on hover (always visible on mobile) */}
                        {hasTextContent && (!isStreaming || !isLastMessage) && (
                          <div className="flex justify-between items-center h-6 px-2 mt-1">
                            <div className="flex items-center gap-0.5">
                              <CopyButton
                                onCopy={() => copyMessageContent(assistantMsg)}
                                isMobile={isMobile}
                              />
                              {/* Play button for all assistant messages - plays only final text (Summary) */}
                              <PlayButton
                                text={
                                  hasFinalText
                                    ? allParts[finalTextIndex]?.text || ""
                                    : getMessageTextContent(assistantMsg)
                                }
                                isMobile={isMobile}
                                playbackRate={ttsPlaybackRate}
                                onPlaybackRateChange={handlePlaybackRateChange}
                              />
                            </div>
                            {/* Token usage info - right side */}
                            <AgentMessageUsage
                              metadata={
                                assistantMsg.metadata as AgentMessageMetadata
                              }
                              isStreaming={isStreaming}
                              isMobile={isMobile}
                            />
                          </div>
                        )}
                      </motion.div>
                    )
                  })}

                  {/* Planning indicator - shown when streaming starts but no assistant message yet */}
                  {isStreaming &&
                    isLastUserMessage &&
                    group.assistantMsgs.length === 0 &&
                    sandboxSetupStatus === "ready" && (
                      <div className="mt-4">
                        <AgentToolCall
                          icon={AgentToolRegistry["tool-planning"].icon}
                          title={AgentToolRegistry["tool-planning"].title({})}
                          isPending={true}
                          isError={false}
                        />
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* User questions panel - shows when AskUserQuestion tool is called */}
      {/* Only show if the pending question belongs to THIS sub-chat */}
      {pendingQuestions && pendingQuestions.subChatId === subChatId && (
        <div className="px-4 relative z-20">
          <div className="w-full px-2 max-w-2xl mx-auto">
            <AgentUserQuestion
              pendingQuestions={pendingQuestions}
              onAnswer={handleQuestionsAnswer}
              onSkip={handleQuestionsSkip}
              onAnswerInPrompt={handleAnswerInPrompt}
            />
          </div>
        </div>
      )}

      {/* Sub-chat status card - pinned above input */}
      {(isStreaming || changedFilesForSubChat.length > 0) &&
        !(pendingQuestions?.subChatId === subChatId) && (
          <div className="px-2 -mb-6 relative z-0">
            <div className="w-full max-w-2xl mx-auto px-2">
              <SubChatStatusCard
                chatId={parentChatId}
                isStreaming={isStreaming}
                changedFiles={changedFilesForSubChat}
                worktreePath={projectPath}
                onStop={async () => {
                  // Mark as manually aborted to prevent completion sound
                  agentChatStore.setManuallyAborted(subChatId, true)
                  await stop()
                  // Call DELETE endpoint to cancel server-side stream
                  await fetch(
                    `/api/agents/chat?id=${encodeURIComponent(subChatId)}`,
                    {
                      method: "DELETE",
                      credentials: "include",
                    },
                  )
                }}
              />
            </div>
          </div>
        )}

      {/* Question Modal */}
      {hasPendingQuestionsForThisChat && pendingQuestions && (
        <div className="px-2 pb-4">
          <AgentUserQuestion
            pendingQuestions={pendingQuestions}
            onAnswer={handleQuestionsAnswer}
            onSkip={handleQuestionsSkip}
            onAnswerInPrompt={handleAnswerInPrompt}
          />
        </div>
      )}

      {/* Input */}
      <div
        className={cn(
          "px-2 pb-2 shadow-sm shadow-background relative z-10",
          (isStreaming || changedFilesForSubChat.length > 0) &&
          !(pendingQuestions?.subChatId === subChatId) &&
          "-mt-3 pt-3",
        )}
      >
        <div className="w-full max-w-2xl mx-auto">
          <div
            className="relative w-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Smart Suggestions */}
            <SmartSuggestions
              chatId={parentChatId}
              onSuggestionClick={(text) => {
                editorRef.current?.setValue(text)
                editorRef.current?.focus()
              }}
              context={{
                hasFiles: true, // Active chat likely has files
                hasErrors: false,
                lastMessage: '',
                recentChanges: [],
              }}
            />

            <div className="relative w-full cursor-text"
              onClick={() => editorRef.current?.focus()}
            >
              <PromptInput
                className={cn(
                  "border bg-input-background relative z-10 p-2 rounded-xl transition-[border-color,box-shadow] duration-150",
                  isDragOver && "ring-2 ring-primary/50 border-primary/50",
                  isFocused && !isDragOver && "ring-2 ring-primary/50",
                )}
                maxHeight={200}
                onSubmit={handleSend}
                contextItems={
                  images.length > 0 || files.length > 0 ? (
                    <div className="flex flex-wrap gap-[6px]">
                      {(() => {
                        // Build allImages array for gallery navigation
                        const allImages = images
                          .filter((img) => img.url && !img.isLoading)
                          .map((img) => ({
                            id: img.id,
                            filename: img.filename,
                            url: img.url,
                          }))

                        return images.map((img, idx) => (
                          <AgentImageItem
                            key={img.id}
                            id={img.id}
                            filename={img.filename}
                            url={img.url}
                            isLoading={img.isLoading}
                            onRemove={() => removeImage(img.id)}
                            allImages={allImages}
                            imageIndex={idx}
                          />
                        ))
                      })()}
                      {files.map((f) => (
                        <AgentFileItem
                          key={f.id}
                          id={f.id}
                          filename={f.filename}
                          url={f.url}
                          size={f.size}
                          isLoading={f.isLoading}
                          onRemove={() => removeFile(f.id)}
                        />
                      ))}
                    </div>
                  ) : null
                }
              >
                <PromptInputContextItems />
                <div className="relative">
                  <AgentsMentionsEditor
                    ref={editorRef}
                    onTrigger={({ searchText, rect }) => {
                      // Desktop: use projectPath for local file search
                      if (projectPath || repository) {
                        setMentionSearchText(searchText)
                        setMentionPosition({ top: rect.top, left: rect.left })
                        setShowMentionDropdown(true)
                      }
                    }}
                    onCloseTrigger={() => setShowMentionDropdown(false)}
                    onSlashTrigger={handleSlashTrigger}
                    onCloseSlashTrigger={handleCloseSlashTrigger}
                    onContentChange={setHasContent}
                    onSubmit={handleSend}
                    onShiftTab={() => setIsPlanMode((prev: boolean) => !prev)}
                    placeholder="Plan, @ for context, / for commands"
                    className={cn(
                      "bg-transparent max-h-[200px] overflow-y-auto p-1",
                      isMobile && "min-h-[56px]",
                    )}
                    onPaste={handlePaste}
                    onFocus={() => setIsFocused(true)}
                    onBlur={handleEditorBlur}
                  />
                </div>
                <PromptInputActions className="w-full">
                  <div className="flex items-center gap-0.5 flex-1 min-w-0">
                    {/* Mode selector - all 5 modes: build, plan, scaling, designer, debug */}
                    <ChatModeSelector
                      value={chatMode}
                      onChange={handleChatModeChange}
                    />

                    {/* Agent Type selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70">
                          {getAgentIcon(selectedAgent.id, "h-3.5 w-3.5")}
                          <span>{selectedAgent.name}</span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-[160px]"
                      >
                        {agents.filter(a => !a.disabled).map((agent) => {
                          const isSelected = selectedAgent.id === agent.id
                          return (
                            <DropdownMenuItem
                              key={agent.id}
                              onClick={() => {
                                setSelectedAgent(agent)
                                setLastSelectedAgentId(agent.id)
                                // Reset model selection when switching agents
                                const newModels = agent.id === 'opencode' ? opencodeModels : claudeModels
                                if (newModels.length > 0) {
                                  setSelectedModel(newModels[0])
                                  setLastSelectedModelId(newModels[0].id)
                                }
                              }}
                              className="gap-2 justify-between"
                            >
                              <div className="flex items-center gap-2">
                                {getAgentIcon(agent.id, "h-3.5 w-3.5 text-muted-foreground")}
                                <span>{agent.name}</span>
                              </div>
                              {isSelected && (
                                <CheckIcon className="h-3.5 w-3.5 ml-auto shrink-0" />
                              )}
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Model selector */}
                    <DropdownMenu 
                      open={isModelDropdownOpen}
                      onOpenChange={(open) => {
                        setIsModelDropdownOpen(open)
                        if (!open) setModelSearch("")
                      }}
                    >
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70">
                          {selectedAgent.id === 'opencode' ? (
                            <OpenCodeIcon className="h-3.5 w-3.5" />
                          ) : (
                            <ClaudeCodeIcon className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {selectedModel?.name || (selectedAgent.id === 'opencode' ? 'Loading...' : 'Select Model')}{" "}
                            {selectedModel && selectedAgent.id !== 'opencode' && (
                              <span className="text-muted-foreground">4.5</span>
                            )}
                          </span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[280px] max-h-[400px] overflow-hidden flex flex-col">
                        {selectedAgent.id === 'opencode' && (
                          <div className="sticky top-0 z-10 p-2 border-b bg-popover">
                            <input
                              type="text"
                              placeholder="Search models..."
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              className="w-full px-2 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>
                        )}
                        <div className="overflow-y-auto max-h-[340px]">
                          {availableModels
                            .filter((model) => {
                              if (!modelSearch || selectedAgent.id !== 'opencode') return true
                              const searchLower = modelSearch.toLowerCase()
                              return (
                                model.name.toLowerCase().includes(searchLower) ||
                                model.id.toLowerCase().includes(searchLower) ||
                                ((model as any)?.provider || '').toLowerCase().includes(searchLower)
                              )
                            })
                            .map((model) => {
                              const isSelected = selectedModel?.id === model.id
                              return (
                                <DropdownMenuItem
                                  key={model.id}
                                  onClick={() => {
                                    setSelectedModel(model)
                                    setLastSelectedModelId(model.id)
                                  }}
                                  className="gap-2 justify-between"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {selectedAgent.id === 'opencode' ? (
                                      <ProviderIcon provider={(model as any)?.provider} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    ) : (
                                      <ClaudeCodeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    )}
                                    <span>
                                      {model.name}
                                      {selectedAgent.id !== 'opencode' && (
                                        <span className="text-muted-foreground"> 4.5</span>
                                      )}
                                    </span>
                                  </div>
                                  {isSelected && (
                                    <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                </DropdownMenuItem>
                              )
                            })}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                    {/* Hidden file input - accepts images and text/code files */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      hidden
                      accept="image/jpeg,image/png,.txt,.md,.markdown,.json,.yaml,.yml,.xml,.csv,.tsv,.log,.ini,.cfg,.conf,.js,.ts,.jsx,.tsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.cpp,.h,.hpp,.cs,.php,.html,.css,.scss,.sass,.less,.sql,.sh,.bash,.zsh,.ps1,.bat,.env,.gitignore,.dockerignore,.editorconfig,.prettierrc,.eslintrc,.babelrc,.nvmrc,.pdf"
                      multiple
                      onChange={(e) => {
                        const inputFiles = Array.from(e.target.files || [])
                        handleAddAttachments(inputFiles)
                        e.target.value = ""
                      }}
                    />

                    {/* Context window indicator */}
                    <AgentContextIndicator messages={messages} />

                    {/* Sandbox toggle button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
                        sandboxId && "bg-primary/10 text-primary hover:bg-primary/20"
                      )}
                      onClick={() => {
                        // Sandbox toggle - in active chat, sandbox is managed differently
                        // This is a placeholder button that matches new-chat-form UI
                      }}
                      title={sandboxId ? "Sandbox enabled" : "Sandbox disabled"}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </Button>

                    {/* Attachment button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        isStreaming ||
                        (images.length >= 5 && files.length >= 10)
                      }
                    >
                      <AttachIcon className="h-4 w-4" />
                    </Button>

                    {/* Multi-Agent button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                      onClick={() => setMultiAgentModalOpen(true)}
                      title="Multi-Agent Run"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    </Button>

                    {/* Send/Stop button or Implement Plan button */}
                    <div className="ml-1">
                      {/* Show "Implement plan" button when plan is ready and input is empty */}
                      {hasUnapprovedPlan &&
                        !hasContent &&
                        images.length === 0 &&
                        files.length === 0 &&
                        !isStreaming ? (
                        <Button
                          onClick={handleApprovePlan}
                          size="sm"
                          className="h-7 gap-1.5 rounded-lg"
                        >
                          Implement plan
                          <Kbd className="text-primary-foreground/70">
                            ⌘↵
                          </Kbd>
                        </Button>
                      ) : (
                        <AgentSendButton
                          isStreaming={isStreaming}
                          isSubmitting={false}
                          disabled={
                            (!hasContent &&
                              images.length === 0 &&
                              files.length === 0) ||
                            isUploading ||
                            isStreaming
                          }
                          onClick={handleSend}
                          onStop={async () => {
                            // Mark as manually aborted to prevent completion sound
                            agentChatStore.setManuallyAborted(subChatId, true)
                            await stop()
                            // Call DELETE endpoint to cancel server-side stream
                            await fetch(
                              `/api/agents/chat?id=${encodeURIComponent(subChatId)}`,
                              { method: "DELETE", credentials: "include" },
                            )
                          }}
                          isPlanMode={isPlanMode}
                        />
                      )}
                    </div>
                  </div>
                </PromptInputActions>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* File mention dropdown */}
        {/* Desktop: use projectPath for local file search */}
        <AgentsFileMention
          isOpen={
            showMentionDropdown &&
            (!!projectPath || !!repository || !!sandboxId)
          }
          onClose={() => setShowMentionDropdown(false)}
          onSelect={handleMentionSelect}
          searchText={mentionSearchText}
          position={mentionPosition}
          teamId={teamId}
          repository={repository}
          sandboxId={sandboxId}
          projectPath={projectPath}
          changedFiles={changedFilesForSubChat}
          chatId={parentChatId}
        />

        {/* Slash command dropdown */}
        <AgentsSlashCommand
          isOpen={showSlashDropdown}
          onClose={handleCloseSlashTrigger}
          onSelect={handleSlashSelect}
          searchText={slashSearchText}
          position={slashPosition}
          teamId={teamId}
          repository={repository}
          isPlanMode={isPlanMode}
        />

        {/* Multi-Agent Modal */}
        <MultiAgentModal
          isOpen={multiAgentModalOpen}
          onClose={() => setMultiAgentModalOpen(false)}
          availableModels={availableModels.map((m) => ({
            id: m.id,
            name: m.name,
          }))}
          defaultPrompt=""
          onRun={async (agents) => {
            // Multi-agent run functionality - placeholder for now
            toast.info("Multi-Agent run - functionality depends on your implementation")
            setMultiAgentModalOpen(false)
          }}
        />

        {/* Undo Confirmation Dialog */}
        <Dialog open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Undo Prompt</DialogTitle>
              <DialogDescription>
                Are you sure? This will undo everything that happened in that one prompt.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setUndoConfirmOpen(false)} disabled={isUndoing}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  setIsUndoing(true)
                  try {
                    toast.info("Attempting to undo...")
                    await new Promise(r => setTimeout(r, 1000))
                    toast.warning("Full undo requires backend implementation.")
                  } finally {
                    setIsUndoing(false)
                    setUndoConfirmOpen(false)
                  }
                }}
                disabled={isUndoing}
              >
                {isUndoing ? <span className="flex items-center gap-2"><IconSpinner className="animate-spin" /> Undoing...</span> : "Undo Everything"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

// Chat View wrapper - handles loading and creates chat object
export function ChatView({
  chatId,
  isSidebarOpen,
  onToggleSidebar,
  selectedTeamName,
  selectedTeamImageUrl,
  isMobileFullscreen = false,
  onBackToChats,
  onOpenPreview,
  onOpenDiff,
  onOpenTerminal,
}: {
  chatId: string
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  selectedTeamName?: string
  selectedTeamImageUrl?: string
  isMobileFullscreen?: boolean
  onBackToChats?: () => void
  onOpenPreview?: () => void
  onOpenDiff?: () => void
  onOpenTerminal?: () => void
}) {
  const [selectedTeamId] = useAtom(selectedTeamIdAtom)
  const [selectedModelId] = useAtom(lastSelectedModelIdAtom)
  const [isPlanMode] = useAtom(isPlanModeAtom)
  const setLoadingSubChats = useSetAtom(loadingSubChatsAtom)
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom)
  const setUnseenChanges = useSetAtom(agentsUnseenChangesAtom)
  const setSubChatUnseenChanges = useSetAtom(agentsSubChatUnseenChangesAtom)
  const setJustCreatedIds = useSetAtom(justCreatedIdsAtom)
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom)
  const { notifyAgentComplete } = useDesktopNotifications()
  const [pendingRun, setPendingRun] = useAtom(pendingMultiAgentRunAtom)

  // Check if any chat has unseen changes
  const hasAnyUnseenChanges = unseenChanges.size > 0
  const [, forceUpdate] = useState({})
  const [isPreviewSidebarOpen, setIsPreviewSidebarOpen] = useAtom(
    agentsPreviewSidebarOpenAtom,
  )
  // Browser preview URL atom
  const browserPreviewUrlAtom = useMemo(
    () => browserPreviewUrlAtomFamily(chatId),
    [chatId],
  )
  const [, setBrowserPreviewUrl] = useAtom(browserPreviewUrlAtom)

  // Listen for browser preview open events from OpenCode
  useEffect(() => {
    const handleOpenBrowserPreview = (e: CustomEvent<{ chatId: string; url: string }>) => {
      if (e.detail.chatId === chatId) {
        setBrowserPreviewUrl(e.detail.url)
        setIsPreviewSidebarOpen(true)
      }
    }

    window.addEventListener('open-browser-preview', handleOpenBrowserPreview as EventListener)
    return () => {
      window.removeEventListener('open-browser-preview', handleOpenBrowserPreview as EventListener)
    }
  }, [chatId, setBrowserPreviewUrl, setIsPreviewSidebarOpen])

  // Per-chat diff sidebar state - each chat remembers its own open/close state
  const diffSidebarAtom = useMemo(
    () => diffSidebarOpenAtomFamily(chatId),
    [chatId],
  )
  const [isDiffSidebarOpen, setIsDiffSidebarOpen] = useAtom(diffSidebarAtom)
  
  // Per-chat tree sidebar state
  const treeSidebarAtom = useMemo(
    () => treeSidebarOpenAtomFamily(chatId),
    [chatId],
  )
  const [isTreeSidebarOpen, setIsTreeSidebarOpen] = useAtom(treeSidebarAtom)

  // Per-chat kanban sidebar state
  const kanbanSidebarAtom = useMemo(
    () => kanbanSidebarOpenAtomFamily(chatId),
    [chatId],
  )
  const [isKanbanSidebarOpen, setIsKanbanSidebarOpen] = useAtom(kanbanSidebarAtom)
  
  const [isTerminalSidebarOpen, setIsTerminalSidebarOpen] = useAtom(
    terminalSidebarOpenAtom,
  )
  
  // Terminal command execution state
  const [terminalInitialCommands, setTerminalInitialCommands] = useState<string[] | undefined>(undefined)
  
  // Command output dialog state
  const [outputDialog, setOutputDialog] = useState<{
    open: boolean
    command: string
    stdout: string
    stderr: string
    exitCode?: number
  }>({
    open: false,
    command: "",
    stdout: "",
    stderr: "",
  })
  
  // Handler for executing command in terminal
  const handleExecuteInTerminal = useCallback((command: string) => {
    setTerminalInitialCommands([command])
    setIsTerminalSidebarOpen(true)
    // Clear initialCommands after a short delay to allow it to execute
    // (terminal uses initialCommands only on mount/reattach)
    setTimeout(() => {
      setTerminalInitialCommands(undefined)
    }, 1000)
  }, [setIsTerminalSidebarOpen])
  
  // Handler for viewing full output
  const handleViewFullOutput = useCallback((command: string, stdout: string, stderr: string, exitCode?: number) => {
    setOutputDialog({
      open: true,
      command,
      stdout,
      stderr,
      exitCode,
    })
  }, [])
  
  const [diffStats, setDiffStats] = useState({
    fileCount: 0,
    additions: 0,
    deletions: 0,
    isLoading: true,
    hasChanges: false,
  })
  // Store raw diff content to pass to AgentDiffView (avoids double fetch)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  // Store pre-parsed file diffs (avoids double parsing in AgentDiffView)
  const [parsedFileDiffs, setParsedFileDiffs] = useState<ReturnType<
    typeof splitUnifiedDiffByFile
  > | null>(null)
  // Store prefetched file contents for instant diff view opening
  const [prefetchedFileContents, setPrefetchedFileContents] = useState<
    Record<string, string>
  >({})
  const [diffMode, setDiffMode] = useAtom(diffViewModeAtom)
  const subChatsSidebarMode = useAtomValue(agentsSubChatsSidebarModeAtom)

  // Track diff sidebar width for responsive header
  const storedDiffSidebarWidth = useAtomValue(agentsDiffSidebarWidthAtom)
  const diffSidebarRef = useRef<HTMLDivElement>(null)
  const diffViewRef = useRef<AgentDiffViewRef>(null)
  const [diffSidebarWidth, setDiffSidebarWidth] = useState(
    storedDiffSidebarWidth,
  )
  // Track if all diff files are collapsed/expanded for button disabled states
  const [diffCollapseState, setDiffCollapseState] = useState({
    allCollapsed: false,
    allExpanded: true,
  })

  // ResizeObserver to track diff sidebar width in real-time (atom only updates after resize ends)
  useEffect(() => {
    if (!isDiffSidebarOpen) {
      return
    }

    let observer: ResizeObserver | null = null
    let rafId: number | null = null

    const checkRef = () => {
      const element = diffSidebarRef.current
      if (!element) {
        // Retry if ref not ready yet
        rafId = requestAnimationFrame(checkRef)
        return
      }

      // Set initial width
      setDiffSidebarWidth(element.offsetWidth || storedDiffSidebarWidth)

      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width
          if (width > 0) {
            setDiffSidebarWidth(width)
          }
        }
      })

      observer.observe(element)
    }

    checkRef()

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      if (observer) observer.disconnect()
    }
  }, [isDiffSidebarOpen, storedDiffSidebarWidth])

  // Track changed files across all sub-chats for throttled diff refresh
  const subChatFiles = useAtomValue(subChatFilesAtom)
  // Initialize to Date.now() to prevent double-fetch on mount
  // (the "mount" effect already fetches, throttle should wait)
  const lastDiffFetchTimeRef = useRef<number>(Date.now())
  const DIFF_THROTTLE_MS = 2000 // Max 1 fetch per 2 seconds

  // Clear "unseen changes" when chat is opened
  useEffect(() => {
    setUnseenChanges((prev: Set<string>) => {
      if (prev.has(chatId)) {
        const next = new Set(prev)
        next.delete(chatId)
        return next
      }
      return prev
    })
  }, [chatId, setUnseenChanges])

  // Get sub-chat state from store
  const activeSubChatId = useAgentSubChatStore((state) => state.activeSubChatId)

  // Clear sub-chat "unseen changes" indicator when sub-chat becomes active
  useEffect(() => {
    if (!activeSubChatId) return
    setSubChatUnseenChanges((prev: Set<string>) => {
      if (prev.has(activeSubChatId)) {
        const next = new Set(prev)
        next.delete(activeSubChatId)
        return next
      }
      return prev
    })
  }, [activeSubChatId, setSubChatUnseenChanges])
  const allSubChats = useAgentSubChatStore((state) => state.allSubChats)
  const openSubChatIds = useAgentSubChatStore((state) => state.openSubChatIds)

  // tRPC utils for optimistic cache updates
  const utils = api.useUtils()

  // tRPC mutations for renaming
  const renameSubChatMutation = api.agents.renameSubChat.useMutation()
  const renameChatMutation = api.agents.renameChat.useMutation()
  const generateSubChatNameMutation =
    api.agents.generateSubChatName.useMutation()

  // PR creation loading state
  const [isCreatingPr, setIsCreatingPr] = useState(false)
  // Review loading state
  const [isReviewing, setIsReviewing] = useState(false)

  const { data: agentChat, isLoading } = api.agents.getAgentChat.useQuery(
    { chatId },
    { enabled: !!chatId },
  )
  const agentSubChats = (agentChat?.subChats ?? []) as Array<{
    id: string
    name?: string | null
    mode?: "plan" | "agent" | null
    model?: string | null
    created_at?: Date | string | null
    updated_at?: Date | string | null
    messages?: any
    stream_id?: string | null
  }>

  // Get PR status when PR exists (for checking if it's open/merged/closed)
  const hasPrNumber = !!agentChat?.prNumber
  const { data: prStatusData, isLoading: isPrStatusLoading } = trpc.chats.getPrStatus.useQuery(
    { chatId },
    {
      enabled: hasPrNumber,
      refetchInterval: 30000, // Poll every 30 seconds
    }
  )
  const prState = prStatusData?.pr?.state as "open" | "draft" | "merged" | "closed" | undefined
  // PR is open if state is explicitly "open" or "draft"
  // When PR status is still loading, assume open to avoid showing wrong button
  const isPrOpen = hasPrNumber && (isPrStatusLoading || prState === "open" || prState === "draft")

  // Merge PR mutation
  const trpcUtils = trpc.useUtils()
  const mergePrMutation = trpc.chats.mergePr.useMutation({
    onSuccess: () => {
      toast.success("PR merged successfully!", { position: "top-center" })
      // Invalidate PR status to update button state
      trpcUtils.chats.getPrStatus.invalidate({ chatId })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to merge PR", { position: "top-center" })
    },
  })

  const handleMergePr = useCallback(() => {
    mergePrMutation.mutate({ chatId, method: "squash" })
  }, [chatId, mergePrMutation])

  // Restore archived workspace mutation
  const restoreWorkspaceMutation = trpc.chats.restore.useMutation({
    onSuccess: (restoredChat) => {
      toast.success("Workspace restored!", { position: "top-center" })
      if (restoredChat) {
        // Update the main chat list cache
        trpcUtils.chats.list.setData({}, (oldData) => {
          if (!oldData) return [restoredChat]
          if (oldData.some((c) => c.id === restoredChat.id)) return oldData
          return [restoredChat, ...oldData]
        })
      }
      // Invalidate both lists to refresh
      trpcUtils.chats.list.invalidate()
      trpcUtils.chats.listArchived.invalidate()
      // Invalidate this chat's data to update isArchived state
      utils.agents.getAgentChat.invalidate({ chatId })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to restore workspace", { position: "top-center" })
    },
  })

  const handleRestoreWorkspace = useCallback(() => {
    restoreWorkspaceMutation.mutate({ id: chatId })
  }, [chatId, restoreWorkspaceMutation])

  // Check if this workspace is archived
  const isArchived = !!agentChat?.archivedAt

  // Get user usage data for credit checks
  const { data: usageData } = api.usage.getUserUsage.useQuery()

  // Desktop: use worktreePath instead of sandbox
  const worktreePath = agentChat?.worktreePath as string | null
  // Fallback for web: use sandbox_id
  const sandboxId = agentChat?.sandbox_id
  const sandboxUrl = sandboxId ? `https://3003-${sandboxId}.e2b.app` : null
  // Desktop uses worktreePath, web uses sandboxUrl
  const chatWorkingDir = worktreePath || sandboxUrl

  // Extract port, repository, and quick setup flag from meta
  const meta = agentChat?.meta as {
    sandboxConfig?: { port?: number }
    repository?: string
    isQuickSetup?: boolean
  } | null
  const repository = meta?.repository

  // Track if we've already triggered sandbox setup for this chat
  // Check if this is a quick setup (no preview available)
  const isQuickSetup = meta?.isQuickSetup || !meta?.sandboxConfig?.port
  const previewPort = meta?.sandboxConfig?.port ?? 3000

  // Check if AgentPreview can be opened (sandbox with port exists and not quick setup)
  const canOpenAgentPreview = !!(
    sandboxId &&
    !isQuickSetup &&
    meta?.sandboxConfig?.port
  )

  // Preview sidebar can always be opened (for BrowserPreview even without sandbox)
  const canOpenPreview = true

  // Check if diff can be opened (worktree for desktop, sandbox for web)
  const canOpenDiff = !!worktreePath || !!sandboxId

  // Note: We no longer forcibly close diff sidebar when canOpenDiff is false.
  // The sidebar render is guarded by canOpenDiff, so it naturally hides.
  // Per-chat state (diffSidebarOpenAtomFamily) preserves each chat's preference.

  // DEBUG: Early return to isolate infinite loop - PHASE 3

  // Fetch diff stats - extracted as callback for reuse in onFinish
  const fetchDiffStatsDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const isFetchingDiffRef = useRef(false)

  const fetchDiffStats = useCallback(async () => {
    // Desktop uses worktreePath, web uses sandboxId
    if (!worktreePath && !sandboxId) {
      setDiffStats({
        fileCount: 0,
        additions: 0,
        deletions: 0,
        isLoading: false,
        hasChanges: false,
      })
      setDiffContent(null)
      return
    }

    // Prevent duplicate parallel fetches
    if (isFetchingDiffRef.current) {
      return
    }
    isFetchingDiffRef.current = true

    try {
      let rawDiff: string | null = null

      // Desktop: use tRPC to get diff from worktree
      if (worktreePath && chatId) {
        const result = await trpcClient.chats.getDiff.query({ chatId })
        rawDiff = result.diff
      }
      // Web fallback: use sandbox API
      else if (sandboxId) {
        const response = await fetch(`/api/agents/sandbox/${sandboxId}/diff`)
        if (!response.ok) {
          setDiffStats((prev) => ({ ...prev, isLoading: false }))
          return
        }
        const data = await response.json()
        rawDiff = data.diff || null
      }

      // Store raw diff for AgentDiffView
      setDiffContent(rawDiff)

      if (rawDiff && rawDiff.trim()) {
        // Parse diff to get file list and stats
        const parsedFiles = splitUnifiedDiffByFile(rawDiff)

        // Store parsed files to avoid re-parsing in AgentDiffView
        setParsedFileDiffs(parsedFiles)

        let additions = 0
        let deletions = 0
        for (const file of parsedFiles) {
          additions += file.additions
          deletions += file.deletions
        }

        setDiffStats({
          fileCount: parsedFiles.length,
          additions,
          deletions,
          isLoading: false,
          hasChanges: additions > 0 || deletions > 0,
        })

        // Desktop: prefetch file contents for instant diff view opening
        // Limit prefetch to prevent overwhelming the system with too many files
        const MAX_PREFETCH_FILES = 20
        const filesToPrefetch = parsedFiles.slice(0, MAX_PREFETCH_FILES)

        if (worktreePath && filesToPrefetch.length > 0) {
          // Capture current chatId for race condition check
          const currentChatId = chatId

          // Build list of files to fetch (filter out /dev/null)
          const filesToFetch = filesToPrefetch
            .map((file) => {
              const filePath =
                file.newPath && file.newPath !== "/dev/null"
                  ? file.newPath
                  : file.oldPath
              if (!filePath || filePath === "/dev/null") return null
              return { key: file.key, filePath }
            })
            .filter((f): f is { key: string; filePath: string } => f !== null)

          if (filesToFetch.length > 0) {
            // Single batch IPC call instead of multiple individual calls
            trpcClient.changes.readMultipleWorkingFiles
              .query({
                worktreePath,
                files: filesToFetch,
              })
              .then((results) => {
                // Check if we're still on the same chat (prevent race condition)
                // Note: sub-chat doesn't matter - file contents are same for whole chat
                if (currentChatId !== chatId) {
                  return
                }

                const contents: Record<string, string> = {}
                for (const [key, result] of Object.entries(results)) {
                  if (result.ok) {
                    contents[key] = result.content
                  }
                }
                setPrefetchedFileContents(contents)
              })
              .catch((err) => {
                console.warn("[prefetch] Failed to batch prefetch files:", err)
              })
          }
        }
      } else {
        setDiffStats({
          fileCount: 0,
          additions: 0,
          deletions: 0,
          isLoading: false,
          hasChanges: false,
        })
        setParsedFileDiffs(null)
        setPrefetchedFileContents({})
      }
    } catch {
      setDiffStats((prev) => ({ ...prev, isLoading: false }))
    } finally {
      isFetchingDiffRef.current = false
    }
  }, [worktreePath, sandboxId, chatId]) // Note: activeSubChatId removed - diff is same for whole chat

  // Debounced version for calling after stream ends
  const fetchDiffStatsDebounced = useCallback(() => {
    if (fetchDiffStatsDebounceRef.current) {
      clearTimeout(fetchDiffStatsDebounceRef.current)
    }
    fetchDiffStatsDebounceRef.current = setTimeout(() => {
      fetchDiffStats()
    }, 500) // 500ms debounce to avoid spamming if multiple streams end
  }, [fetchDiffStats])

  // Ref to hold the latest fetchDiffStatsDebounced for use in onFinish callbacks
  const fetchDiffStatsRef = useRef(fetchDiffStatsDebounced)
  useEffect(() => {
    fetchDiffStatsRef.current = fetchDiffStatsDebounced
  }, [fetchDiffStatsDebounced])

  // Fetch diff stats on mount and when worktreePath/sandboxId changes
  useEffect(() => {
    fetchDiffStats()
  }, [fetchDiffStats])

  // Calculate total file count across all sub-chats for change detection
  const totalSubChatFileCount = useMemo(() => {
    let count = 0
    subChatFiles.forEach((files: Array<{ filePath: string; displayPath: string; additions: number; deletions: number }>) => {
      count += files.length
    })
    return count
  }, [subChatFiles])

  // Throttled refetch when sub-chat files change (agent edits/writes files)
  // This keeps the top-right diff sidebar in sync with the bottom "Generated X files" bar
  useEffect(() => {
    // Skip if no files tracked yet (initial state)
    if (totalSubChatFileCount === 0) return

    const now = Date.now()
    const timeSinceLastFetch = now - lastDiffFetchTimeRef.current

    if (timeSinceLastFetch >= DIFF_THROTTLE_MS) {
      // Enough time passed, fetch immediately
      lastDiffFetchTimeRef.current = now
      fetchDiffStats()
    } else {
      // Schedule fetch for when throttle window ends
      const delay = DIFF_THROTTLE_MS - timeSinceLastFetch
      const timer = setTimeout(() => {
        lastDiffFetchTimeRef.current = Date.now()
        fetchDiffStats()
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [totalSubChatFileCount, fetchDiffStats])

  // Handle Create PR - sends a message to Claude to create the PR
  const setPendingPrMessage = useSetAtom(pendingPrMessageAtom)

  const handleCreatePr = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" })
      return
    }

    setIsCreatingPr(true)
    try {
      // Get PR context from backend
      const context = await trpcClient.chats.getPrContext.query({ chatId })
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" })
        return
      }

      // Generate message and set it for ChatViewInner to send
      const message = generatePrMessage(context)
      setPendingPrMessage(message)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to prepare PR request",
        { position: "top-center" },
      )
    } finally {
      setIsCreatingPr(false)
    }
  }, [chatId, setPendingPrMessage])

  // Handle Commit to existing PR - sends a message to Claude to commit and push
  const [isCommittingToPr, setIsCommittingToPr] = useState(false)
  const handleCommitToPr = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" })
      return
    }

    try {
      setIsCommittingToPr(true)
      const context = await trpcClient.chats.getPrContext.query({ chatId })
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" })
        return
      }

      const message = generateCommitToPrMessage(context)
      setPendingPrMessage(message)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to prepare commit request",
        { position: "top-center" },
      )
    } finally {
      setIsCommittingToPr(false)
    }
  }, [chatId, setPendingPrMessage])

  // Handle Review - sends a message to Claude to review the diff
  const setPendingReviewMessage = useSetAtom(pendingReviewMessageAtom)

  const handleReview = useCallback(async () => {
    if (!chatId) {
      toast.error("Chat ID is required", { position: "top-center" })
      return
    }

    setIsReviewing(true)
    try {
      // Get PR context from backend
      const context = await trpcClient.chats.getPrContext.query({ chatId })
      if (!context) {
        toast.error("Could not get git context", { position: "top-center" })
        return
      }

      // Generate review message and set it for ChatViewInner to send
      const message = generateReviewMessage(context)
      setPendingReviewMessage(message)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start review",
        { position: "top-center" },
      )
    } finally {
      setIsReviewing(false)
    }
  }, [chatId, setPendingReviewMessage])

  // Initialize store when chat data loads
  useEffect(() => {
    if (!agentChat) return

    const store = useAgentSubChatStore.getState()

    // Only initialize if chatId changed
    if (store.chatId !== chatId) {
      store.setChatId(chatId)
    }

    // Re-get fresh state after setChatId may have loaded from localStorage
    const freshState = useAgentSubChatStore.getState()

    // Get sub-chats from DB (like Canvas - no isPersistedInDb flag)
    // Build a map of existing local sub-chats to preserve their created_at if DB doesn't have it
    const existingSubChatsMap = new Map(
      freshState.allSubChats.map((sc) => [sc.id, sc]),
    )

    const dbSubChats: SubChatMeta[] = agentSubChats.map((sc) => {
      const existingLocal = existingSubChatsMap.get(sc.id)
      const createdAt =
        typeof sc.created_at === "string"
          ? sc.created_at
          : sc.created_at?.toISOString()
      const updatedAt =
        typeof sc.updated_at === "string"
          ? sc.updated_at
          : sc.updated_at?.toISOString()
      return {
        id: sc.id,
        name: sc.name || "New Agent",
        // Prefer DB timestamp, fall back to local timestamp, then current time
        created_at:
          createdAt ?? existingLocal?.created_at ?? new Date().toISOString(),
        updated_at: updatedAt ?? existingLocal?.updated_at,
        mode:
          (sc.mode as "plan" | "agent" | undefined) ||
          existingLocal?.mode ||
          "agent",
        ...(sc.model && { model: sc.model as string }),
      }
    })
    const dbSubChatIds = new Set(dbSubChats.map((sc) => sc.id))

    // Start with DB sub-chats
    const allSubChats: SubChatMeta[] = [...dbSubChats]

    // For each open tab ID that's NOT in DB, add placeholder (like Canvas)
    // This prevents losing tabs during race conditions
    const currentOpenIds = freshState.openSubChatIds
    currentOpenIds.forEach((id) => {
      if (!dbSubChatIds.has(id)) {
        allSubChats.push({
          id,
          name: "New Agent",
          created_at: new Date().toISOString(),
        })
      }
    })

    freshState.setAllSubChats(allSubChats)

    // All open tabs are now valid (we created placeholders for non-DB ones)
    const validOpenIds = currentOpenIds

    if (validOpenIds.length === 0 && allSubChats.length > 0) {
      // No valid open tabs, open the first sub-chat
      freshState.addToOpenSubChats(allSubChats[0].id)
      freshState.setActiveSubChat(allSubChats[0].id)
    } else if (validOpenIds.length > 0) {
      // Validate active tab is in open tabs
      const currentActive = freshState.activeSubChatId
      if (!currentActive || !validOpenIds.includes(currentActive)) {
        freshState.setActiveSubChat(validOpenIds[0])
      }
    }
  }, [agentChat, chatId])

  // Track overrides for multi-agent runs
  const subChatModelOverrides = useRef<Map<string, string>>(new Map())

  // Memoize chat objects to ensure stable references during streaming
  const chatCacheRef = useRef<Map<string, Chat<any>>>(new Map())

  // Create or get Chat instance for a sub-chat
  const getOrCreateChat = useCallback(
    (subChatId: string): Chat<any> | null => {
      // Desktop uses worktreePath, web uses sandboxUrl
      if (!chatWorkingDir || !agentChat) {
        return null
      }

      // Return existing chat if we have it (check both store and cache)
      const existing = agentChatStore.get(subChatId) || chatCacheRef.current.get(subChatId)
      if (existing) {
        // Update cache to ensure reference stability
        chatCacheRef.current.set(subChatId, existing)
        return existing
      }

      // Find sub-chat data
      const subChat = agentSubChats.find((sc) => sc.id === subChatId)
      const messages = (subChat?.messages as any[]) || []

      // Get mode from store metadata (falls back to current isPlanMode)
      const subChatMeta = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === subChatId)
      // Get mode from store, or fallback to "plan" if isPlanMode, otherwise "agent"
      const subChatMode = subChatMeta?.mode || (isPlanMode ? "plan" : "agent")

      // Desktop: use IPCChatTransport for local Claude Code execution
      // Note: Extended thinking setting is read dynamically inside the transport
      const selectedAgentId = (appStore.get(lastSelectedAgentIdAtom) as string) || 'claude-code'

      // Map mode for transport: custom modes map to "build", others map directly
      const transportMode = typeof subChatMode === "string" && subChatMode.startsWith("custom-")
        ? "build" // Custom modes use "build" as base mode
        : (subChatMode === 'agent' ? 'build' : subChatMode)

      // Store custom mode ID separately if it's a custom mode
      const customModeId = typeof subChatMode === "string" && subChatMode.startsWith("custom-")
        ? subChatMode
        : undefined

      const transport = worktreePath
        ? new IPCChatTransport({
          chatId,
          subChatId,
          cwd: worktreePath,
          ...(worktreePath ? { projectPath: worktreePath } : {}),
          mode: transportMode as "plan" | "build" | "scaling" | "designer" | "debug",
          customModeId, // Pass custom mode ID for prompt rules
          agentType: selectedAgentId,
          model: subChatModelOverrides.current.get(subChatId),
        })
        : null // Web transport not supported in desktop app

      if (!transport) {
        console.error("[getOrCreateChat] No transport available")
        return null
      }

      const newChat = new Chat<any>({
        id: subChatId,
        messages,
        transport,
        // Clear loading when streaming completes (works even if component unmounted)
        onFinish: () => {
          console.log(`[SD] C:FINISH sub=${subChatId.slice(-8)}`)
          clearLoading(setLoadingSubChats, subChatId)

          // Check if this was a manual abort (ESC/Ctrl+C) - skip sound if so
          const wasManuallyAborted =
            agentChatStore.wasManuallyAborted(subChatId)
          agentChatStore.clearManuallyAborted(subChatId)

          // Get CURRENT values at runtime (not stale closure values)
          const currentActiveSubChatId =
            useAgentSubChatStore.getState().activeSubChatId
          const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom)

          const isViewingThisSubChat = currentActiveSubChatId === subChatId
          const isViewingThisChat = currentSelectedChatId === chatId

          if (!isViewingThisSubChat) {
            setSubChatUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev)
              next.add(subChatId)
              return next
            })
          }

          // Also mark parent chat as unseen if user is not viewing it
          if (!isViewingThisChat) {
            setUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev)
              next.add(chatId)
              return next
            })

            // Play completion sound only if NOT manually aborted and sound is enabled
            if (!wasManuallyAborted) {
              const isSoundEnabled = appStore.get(soundNotificationsEnabledAtom)
              if (isSoundEnabled) {
                try {
                  const audio = new Audio("./sound.mp3")
                  audio.volume = 1.0
                  audio.play().catch(() => { })
                } catch {
                  // Ignore audio errors
                }
              }

              // Show native notification (desktop app, when window not focused)
              notifyAgentComplete(agentChat?.name || "Agent")
            }
          }

          // Refresh diff stats after agent finishes making changes
          fetchDiffStatsRef.current()
        },
      })

      agentChatStore.set(subChatId, newChat, chatId)
      // Store in cache to ensure stable reference during streaming
      chatCacheRef.current.set(subChatId, newChat)
      // Store streamId at creation time to prevent resume during active streaming
      // tRPC refetch would update stream_id in DB, but store stays stable
      agentChatStore.setStreamId(subChatId, subChat?.stream_id || null)
      // Defer force update to next frame to allow streaming to start without interrupting animations/transitions
      requestAnimationFrame(() => {
        forceUpdate({}) // Trigger re-render to use new chat
      })
      return newChat
    },
    [
      agentChat,
      chatWorkingDir,
      worktreePath,
      chatId,
      isPlanMode,
      agentSubChats,
      subChatModelOverrides,
      setSubChatUnseenChanges,
      selectedChatId,
      setUnseenChanges,
      notifyAgentComplete,
    ],
  )

  // Handle pending multi-agent run
  useEffect(() => {
    if (
      pendingRun &&
      pendingRun.chatId === chatId &&
      agentChat && // Main chat loaded
      agentSubChats // Sub-chats loaded
    ) {
      const { agents } = pendingRun

      // Determine if ALL sub-chats are present (loaded from DB sync)
      const allSubChatsPresent = agents.every((a: { subChatId: string }) =>
        agentSubChats.some(sc => sc.id === a.subChatId)
      )

      if (!allSubChatsPresent) return

      console.log('Starting multi-agent run for', agents.length, 'agents')

      const store = useAgentSubChatStore.getState()

      agents.forEach((agent: { id: string; subChatId: string; prompt: string; model: string }) => {
        // Set override and clear existing chat to ensure we use the model override
        if (agent.model) {
          subChatModelOverrides.current.set(agent.subChatId, agent.model)
          // Force cleanup of existing chat so we create new one with override
          const existing = agentChatStore.get(agent.subChatId)
          if (existing) {
            agentChatStore.delete(agent.subChatId)
          }
        }

        // Ensure open
        store.addToOpenSubChats(agent.subChatId)

        // Get chat instance
        const chat = getOrCreateChat(agent.subChatId)
        if (chat) {
          // If chat is already running or has messages, skip
          const hasMessages = chat.messages.length > 0
          if (!hasMessages) {
            // Note: Loading state will be set automatically when chat starts streaming
            // Send message
            (chat as any).append({
              role: 'user',
              content: agent.prompt
            })
          }
        }
      })

      // Clear pending run
      setPendingRun(null)
    }
  }, [pendingRun, chatId, agentChat, agentSubChats, getOrCreateChat, setPendingRun, setLoadingSubChats])

  // Handle creating a new sub-chat
  const handleCreateNewSubChat = useCallback(async () => {
    const store = useAgentSubChatStore.getState()
    const subChatMode = isPlanMode ? "plan" : "agent"
    const selectedModelId = appStore.get(lastSelectedModelIdAtom)

    // Create sub-chat in DB first to get the real ID
    const newSubChat = await trpcClient.chats.createSubChat.mutate({
      chatId,
      name: "New Agent",
      mode: subChatMode,
      model: selectedModelId as string | undefined,
    })
    const newId = newSubChat.id

    // Track this subchat as just created for typewriter effect
    setJustCreatedIds((prev: Set<string>) => new Set([...prev, newId]))

    // Add to allSubChats with placeholder name
    store.addToAllSubChats({
      id: newId,
      name: "New Agent",
      created_at: new Date().toISOString(),
      mode: subChatMode,
      model: selectedModelId as string | undefined,
    })

    // Add to open tabs and set as active
    store.addToOpenSubChats(newId)
    store.setActiveSubChat(newId)

    // Create empty Chat instance for the new sub-chat
    if (worktreePath) {
      // Desktop: use IPCChatTransport for local Claude Code execution
      // Note: Extended thinking setting is read dynamically inside the transport
      const selectedAgentId = (appStore.get(lastSelectedAgentIdAtom) as string) || 'claude-code'
      const transport = new IPCChatTransport({
        chatId,
        subChatId: newId,
        cwd: worktreePath,
        ...(worktreePath ? { projectPath: worktreePath } : {}),
        mode: subChatMode === 'agent' ? 'build' : subChatMode,
        agentType: selectedAgentId,
      })

      const newChat = new Chat<any>({
        id: newId,
        messages: [],
        transport,
        // Clear loading when streaming completes
        onFinish: () => {
          console.log(`[SD] C:FINISH sub=${newId.slice(-8)}`)
          clearLoading(setLoadingSubChats, newId)

          // Check if this was a manual abort (ESC/Ctrl+C) - skip sound if so
          const wasManuallyAborted = agentChatStore.wasManuallyAborted(newId)
          agentChatStore.clearManuallyAborted(newId)

          // Get CURRENT values at runtime (not stale closure values)
          const currentActiveSubChatId =
            useAgentSubChatStore.getState().activeSubChatId
          const currentSelectedChatId = appStore.get(selectedAgentChatIdAtom)

          const isViewingThisSubChat = currentActiveSubChatId === newId
          const isViewingThisChat = currentSelectedChatId === chatId

          if (!isViewingThisSubChat) {
            setSubChatUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev)
              next.add(newId)
              return next
            })
          }

          // Also mark parent chat as unseen if user is not viewing it
          if (!isViewingThisChat) {
            setUnseenChanges((prev: Set<string>) => {
              const next = new Set(prev)
              next.add(chatId)
              return next
            })

            // Play completion sound only if NOT manually aborted and sound is enabled
            if (!wasManuallyAborted) {
              const isSoundEnabled = appStore.get(soundNotificationsEnabledAtom)
              if (isSoundEnabled) {
                try {
                  const audio = new Audio("./sound.mp3")
                  audio.volume = 1.0
                  audio.play().catch(() => { })
                } catch {
                  // Ignore audio errors
                }
              }

              // Show native notification (desktop app, when window not focused)
              notifyAgentComplete(agentChat?.name || "Agent")
            }
          }

          // Refresh diff stats after agent finishes making changes
          fetchDiffStatsRef.current()
        },
      })
      agentChatStore.set(newId, newChat, chatId)
      // Store in cache to ensure stable reference during streaming
      chatCacheRef.current.set(newId, newChat)
      agentChatStore.setStreamId(newId, null) // New chat has no active stream
      // Defer force update to next frame to allow streaming to start without interrupting animations/transitions
      requestAnimationFrame(() => {
        forceUpdate({}) // Trigger re-render
      })
    }
  }, [
    worktreePath,
    chatId,
    isPlanMode,
    setSubChatUnseenChanges,
    selectedChatId,
    setUnseenChanges,
    notifyAgentComplete,
    agentChat?.name,
  ])

  // Keyboard shortcut: New sub-chat
  // Web: Opt+Cmd+T (browser uses Cmd+T for new tab)
  // Desktop: Cmd+T
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp()

      // Desktop: Cmd+T (without Alt)
      if (isDesktop && e.metaKey && e.code === "KeyT" && !e.altKey) {
        e.preventDefault()
        handleCreateNewSubChat()
        return
      }

      // Web: Opt+Cmd+T (with Alt)
      if (e.altKey && e.metaKey && e.code === "KeyT") {
        e.preventDefault()
        handleCreateNewSubChat()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleCreateNewSubChat])

  // Multi-select state for sub-chats (for Cmd+W bulk close)
  const selectedSubChatIds = useAtomValue(selectedSubChatIdsAtom)
  const isSubChatMultiSelectMode = useAtomValue(isSubChatMultiSelectModeAtom)
  const clearSubChatSelection = useSetAtom(clearSubChatSelectionAtom)

  // Keyboard shortcut: Close active sub-chat (or bulk close if multi-select mode)
  // Web: Opt+Cmd+W (browser uses Cmd+W to close tab)
  // Desktop: Cmd+W
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp()

      // Desktop: Cmd+W (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.code === "KeyW" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey
      // Web: Opt+Cmd+W (with Alt)
      const isWebShortcut = e.altKey && e.metaKey && e.code === "KeyW"

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault()

        const store = useAgentSubChatStore.getState()

        // If multi-select mode, bulk close selected sub-chats
        if (isSubChatMultiSelectMode && selectedSubChatIds.size > 0) {
          const idsToClose = Array.from(selectedSubChatIds)
          const remainingOpenIds = store.openSubChatIds.filter(
            (id) => !idsToClose.includes(id),
          )

          // Don't close all tabs via hotkey - user should use sidebar dialog for last tab
          if (remainingOpenIds.length > 0) {
            idsToClose.forEach((id) => store.removeFromOpenSubChats(id))
          }
          clearSubChatSelection()
          return
        }

        // Otherwise close active sub-chat
        const activeId = store.activeSubChatId
        const openIds = store.openSubChatIds

        // Only close if we have more than one tab open and there's an active tab
        // removeFromOpenSubChats automatically switches to the last remaining tab
        if (activeId && openIds.length > 1) {
          store.removeFromOpenSubChats(activeId)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isSubChatMultiSelectMode, selectedSubChatIds, clearSubChatSelection])

  // Keyboard shortcut: Navigate between sub-chats
  // Web: Opt+Cmd+[ and Opt+Cmd+] (browser uses Cmd+[ for back)
  // Desktop: Cmd+[ and Cmd+]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp()

      // Check for previous sub-chat shortcut ([ key)
      const isPrevDesktop =
        isDesktop &&
        e.metaKey &&
        e.code === "BracketLeft" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey
      const isPrevWeb = e.altKey && e.metaKey && e.code === "BracketLeft"

      if (isPrevDesktop || isPrevWeb) {
        e.preventDefault()

        const store = useAgentSubChatStore.getState()
        const activeId = store.activeSubChatId
        const openIds = store.openSubChatIds

        // Only navigate if we have multiple tabs
        if (openIds.length <= 1) return

        // If no active tab, select first one
        if (!activeId) {
          store.setActiveSubChat(openIds[0])
          return
        }

        // Find current index
        const currentIndex = openIds.indexOf(activeId)

        if (currentIndex === -1) {
          // Current tab not found, select first
          store.setActiveSubChat(openIds[0])
          return
        }

        // Navigate to previous tab (cycle to end if at start)
        const nextIndex =
          currentIndex - 1 < 0 ? openIds.length - 1 : currentIndex - 1
        const nextId = openIds[nextIndex]

        if (nextId) {
          store.setActiveSubChat(nextId)
        }
      }

      // Check for next sub-chat shortcut (] key)
      const isNextDesktop =
        isDesktop &&
        e.metaKey &&
        e.code === "BracketRight" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey
      const isNextWeb = e.altKey && e.metaKey && e.code === "BracketRight"

      if (isNextDesktop || isNextWeb) {
        e.preventDefault()

        const store = useAgentSubChatStore.getState()
        const activeId = store.activeSubChatId
        const openIds = store.openSubChatIds

        // Only navigate if we have multiple tabs
        if (openIds.length <= 1) return

        // If no active tab, select first one
        if (!activeId) {
          store.setActiveSubChat(openIds[0])
          return
        }

        // Find current index
        const currentIndex = openIds.indexOf(activeId)

        if (currentIndex === -1) {
          // Current tab not found, select first
          store.setActiveSubChat(openIds[0])
          return
        }

        // Navigate to next tab (cycle to start if at end)
        const nextIndex = (currentIndex + 1) % openIds.length
        const nextId = openIds[nextIndex]

        if (nextId) {
          store.setActiveSubChat(nextId)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Keyboard shortcut: Cmd + D to toggle diff sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd (Meta) + D (without Alt/Shift)
      if (
        e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey &&
        e.code === "KeyD"
      ) {
        e.preventDefault()
        e.stopPropagation()

        // Toggle: close if open, open if has changes
        if (isDiffSidebarOpen) {
          setIsDiffSidebarOpen(false)
        } else if (diffStats.hasChanges) {
          setIsDiffSidebarOpen(true)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [diffStats.hasChanges, isDiffSidebarOpen])

  // Keyboard shortcut: Create PR (preview)
  // Web: Opt+Cmd+P (browser uses Cmd+P for print)
  // Desktop: Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isDesktop = isDesktopApp()

      // Desktop: Cmd+P (without Alt)
      const isDesktopShortcut =
        isDesktop &&
        e.metaKey &&
        e.code === "KeyP" &&
        !e.altKey &&
        !e.shiftKey &&
        !e.ctrlKey
      // Web: Opt+Cmd+P (with Alt)
      const isWebShortcut = e.altKey && e.metaKey && e.code === "KeyP"

      if (isDesktopShortcut || isWebShortcut) {
        e.preventDefault()
        e.stopPropagation()

        // Only create PR if there are changes and not already creating
        if (diffStats.hasChanges && !isCreatingPr) {
          handleCreatePr()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [diffStats.hasChanges, isCreatingPr, handleCreatePr])

  // Keyboard shortcut: Cmd + Shift + E to restore archived workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey &&
        e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        e.code === "KeyE"
      ) {
        if (isArchived && !restoreWorkspaceMutation.isPending) {
          e.preventDefault()
          e.stopPropagation()
          handleRestoreWorkspace()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [isArchived, restoreWorkspaceMutation.isPending, handleRestoreWorkspace])

  // Handle auto-rename for sub-chat and parent chat
  // Receives subChatId as param to avoid stale closure issues
  const handleAutoRename = useCallback(
    (userMessage: string, subChatId: string) => {
      // Check if this is the first sub-chat using agentSubChats directly
      // to avoid race condition with store initialization
      const firstSubChatId = getFirstSubChatId(agentSubChats)
      const isFirst = firstSubChatId === subChatId

      autoRenameAgentChat({
        subChatId,
        parentChatId: chatId,
        userMessage,
        isFirstSubChat: isFirst,
        generateName: async (msg) => {
          return generateSubChatNameMutation.mutateAsync({ userMessage: msg })
        },
        renameSubChat: async (input) => {
          await renameSubChatMutation.mutateAsync(input)
        },
        renameChat: async (input) => {
          await renameChatMutation.mutateAsync(input)
        },
        updateSubChatName: (subChatIdToUpdate, name) => {
          // Update local store
          useAgentSubChatStore
            .getState()
            .updateSubChatName(subChatIdToUpdate, name)
          // Also update query cache so init effect doesn't overwrite
          utils.agents.getAgentChat.setData({ chatId }, (old) => {
            if (!old) return old
            const existsInCache = old.subChats.some(
              (sc: any) => sc.id === subChatIdToUpdate,
            )
            if (!existsInCache) {
              // Sub-chat not in cache yet (DB save still in flight) - add it
              return {
                ...old,
                subChats: [
                  ...old.subChats,
                  {
                    id: subChatIdToUpdate,
                    name,
                    created_at: new Date(),
                    updated_at: new Date(),
                    messages: [],
                    mode: "agent",
                    stream_id: null,
                    chat_id: chatId,
                  },
                ],
              }
            }
            return {
              ...old,
              subChats: old.subChats.map((sc: any) =>
                sc.id === subChatIdToUpdate ? { ...sc, name } : sc,
              ),
            }
          })
        },
        updateChatName: (chatIdToUpdate, name) => {
          // Optimistic update for sidebar (list query)
          // On desktop, selectedTeamId is always null, so we update unconditionally
          utils.agents.getAgentChats.setData(
            { teamId: selectedTeamId },
            (old: any) => {
              if (!old) return old
              return old.map((c: any) =>
                c.id === chatIdToUpdate ? { ...c, name } : c,
              )
            },
          )
          // Optimistic update for header (single chat query)
          utils.agents.getAgentChat.setData(
            { chatId: chatIdToUpdate },
            (old) => {
              if (!old) return old
              return { ...old, name }
            },
          )
        },
      })
    },
    [
      chatId,
      agentSubChats,
      generateSubChatNameMutation,
      renameSubChatMutation,
      renameChatMutation,
      selectedTeamId,
      utils.agents.getAgentChats,
      utils.agents.getAgentChat,
    ],
  )

  // Get or create Chat instance for active sub-chat
  const activeChat = useMemo(() => {
    if (!activeSubChatId || !agentChat) {
      return null
    }
    return getOrCreateChat(activeSubChatId)
  }, [activeSubChatId, agentChat, getOrCreateChat, chatId, chatWorkingDir])

  // Check if active sub-chat is the first one (for renaming parent chat)
  // Use agentSubChats directly to avoid race condition with store initialization
  const isFirstSubChatActive = useMemo(() => {
    if (!activeSubChatId) return false
    return getFirstSubChatId(agentSubChats) === activeSubChatId
  }, [activeSubChatId, agentSubChats])

  // Determine if chat header should be hidden
  const shouldHideChatHeader =
    subChatsSidebarMode === "sidebar" &&
    isPreviewSidebarOpen &&
    isDiffSidebarOpen &&
    !isMobileFullscreen

  // No early return - let the UI render with loading state handled by activeChat check below

  return (
    <div className="flex h-full flex-col">
      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Chat Panel */}
        <div
          className="flex-1 flex flex-col overflow-hidden relative bg-cover bg-center"
          style={{
            minWidth: "350px",
            backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
            backgroundAttachment: "fixed",
          }}
        >
          {/* SubChatSelector header - absolute when sidebar open (desktop only), regular div otherwise */}
          {!shouldHideChatHeader && (
            <div
              className={cn(
                "relative z-20 pointer-events-none",
                // Mobile: always flex; Desktop: absolute when sidebar open, flex when closed
                !isMobileFullscreen && subChatsSidebarMode === "sidebar"
                  ? `absolute top-0 left-0 right-0 ${CHAT_LAYOUT.headerPaddingSidebarOpen}`
                  : `flex-shrink-0 ${CHAT_LAYOUT.headerPaddingSidebarClosed}`,
              )}
            >
              {/* Gradient background - only when not absolute */}
              {(isMobileFullscreen || subChatsSidebarMode !== "sidebar") && (
                <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-transparent" />
              )}
              <div className="pointer-events-auto flex items-center justify-between relative">
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {/* Mobile header - simplified with chat name as trigger */}
                  {isMobileFullscreen ? (
                    <MobileChatHeader
                      onCreateNew={handleCreateNewSubChat}
                      onBackToChats={onBackToChats}
                      onOpenPreview={onOpenPreview}
                      canOpenPreview={canOpenPreview}
                      onOpenDiff={onOpenDiff}
                      canOpenDiff={canOpenDiff}
                      diffStats={diffStats}
                      onOpenTerminal={onOpenTerminal}
                      canOpenTerminal={!!worktreePath}
                      isArchived={isArchived}
                      onRestore={handleRestoreWorkspace}
                    />
                  ) : (
                    <>
                      {/* Header controls - desktop only */}
                      <AgentsHeaderControls
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={onToggleSidebar}
                        hasUnseenChanges={hasAnyUnseenChanges}
                        isSubChatsSidebarOpen={
                          subChatsSidebarMode === "sidebar"
                        }
                      />
                      {/* Breadcrumb showing current working directory */}
                      {worktreePath && (
                        <div className="ml-2 flex items-center">
                          <Breadcrumb>
                            <BreadcrumbList>
                              {worktreePath.split(/[/\\]/).filter(Boolean).map((segment, idx, arr) => {
                                const isLast = idx === arr.length - 1
                                return (
                                  <Fragment key={idx}>
                                    <BreadcrumbItem>
                                      {isLast ? (
                                        <BreadcrumbPage className="flex items-center gap-1.5">
                                          {idx === 0 && <FolderIcon className="h-3.5 w-3.5" />}
                                          <span className="font-mono text-xs">{segment}</span>
                                        </BreadcrumbPage>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-xs">
                                          {idx === 0 && <FolderIcon className="h-3.5 w-3.5" />}
                                          {segment}
                                        </span>
                                      )}
                                    </BreadcrumbItem>
                                    {!isLast && <BreadcrumbSeparator />}
                                  </Fragment>
                                )
                              })}
                            </BreadcrumbList>
                          </Breadcrumb>
                        </div>
                      )}
                      <SubChatSelector
                        onCreateNew={handleCreateNewSubChat}
                        isMobile={false}
                        onBackToChats={onBackToChats}
                        onOpenPreview={onOpenPreview}
                        canOpenPreview={canOpenPreview}
                        onOpenDiff={() => setIsDiffSidebarOpen(true)}
                        canOpenDiff={canOpenDiff}
                        isDiffSidebarOpen={isDiffSidebarOpen}
                        diffStats={diffStats}
                      />
                    </>
                  )}
                </div>
                {/* Open Tree Button - shows when tree is closed (desktop only) */}
                {!isMobileFullscreen &&
                  !isTreeSidebarOpen &&
                  worktreePath && (
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsTreeSidebarOpen(true)}
                          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2"
                          aria-label="Open file tree"
                        >
                          <ListTree className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open file tree</TooltipContent>
                    </Tooltip>
                  )}
                {/* Open Kanban Button - shows when kanban is closed (desktop only) */}
                {!isMobileFullscreen && !isKanbanSidebarOpen && (
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsKanbanSidebarOpen(true)}
                        className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2"
                        aria-label="Open roadmap & tasks"
                      >
                        <Kanban className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open roadmap & tasks</TooltipContent>
                  </Tooltip>
                )}

                {/* Open Preview Button - shows when preview is closed (desktop only) */}
                {!isMobileFullscreen &&
                  !isPreviewSidebarOpen &&
                  sandboxId &&
                  (canOpenPreview ? (
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsPreviewSidebarOpen(true)}
                          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2"
                          aria-label="Open preview"
                        >
                          <IconOpenSidebarRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open preview</TooltipContent>
                    </Tooltip>
                  ) : (
                    <PreviewSetupHoverCard>
                      <span className="inline-flex ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-6 w-6 p-0 text-muted-foreground flex-shrink-0 rounded-md cursor-not-allowed pointer-events-none"
                          aria-label="Preview not available"
                        >
                          <IconOpenSidebarRight className="h-4 w-4" />
                        </Button>
                      </span>
                    </PreviewSetupHoverCard>
                  ))}
                {/* Browser Preview Button - always available (desktop only) */}
                {!isMobileFullscreen && !isPreviewSidebarOpen && (
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsPreviewSidebarOpen(true)}
                        className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2"
                        aria-label="Open browser preview"
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open browser preview</TooltipContent>
                  </Tooltip>
                )}
                {/* Terminal Button - shows when terminal is closed and worktree exists (desktop only) */}
                {!isMobileFullscreen &&
                  !isTerminalSidebarOpen &&
                  worktreePath && (
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsTerminalSidebarOpen(true)}
                          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2"
                          aria-label="Open terminal"
                        >
                          <TerminalSquare className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Open terminal
                        <Kbd>⌘J</Kbd>
                      </TooltipContent>
                    </Tooltip>
                  )}
                {/* Restore Button - shows when viewing archived workspace (desktop only) */}
                {!isMobileFullscreen && isArchived && (
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={handleRestoreWorkspace}
                        disabled={restoreWorkspaceMutation.isPending}
                        className="h-6 px-2 gap-1.5 hover:bg-foreground/10 transition-colors text-foreground flex-shrink-0 rounded-md ml-2 flex items-center"
                        aria-label="Restore workspace"
                      >
                        <IconTextUndo className="h-4 w-4" />
                        <span className="text-xs">Restore</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Restore workspace
                      <Kbd>⇧⌘E</Kbd>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Chat Content */}
          {openSubChatIds.map((subChatId) => {
            const chat = getOrCreateChat(subChatId)
            const isActive = subChatId === activeSubChatId

            if (!chat) return null

            return (
              <div
                key={subChatId}
                className={cn(
                  "flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden h-full",
                  !isActive && "hidden"
                )}
              >
                <ChatViewInner
                  chat={chat}
                  subChatId={subChatId}
                  parentChatId={chatId}
                  isFirstSubChat={subChatId === getFirstSubChatId(allSubChats)}
                  onAutoRename={handleAutoRename}
                  onCreateNewSubChat={handleCreateNewSubChat}
                  teamId={selectedTeamId || undefined}
                  repository={repository}
                  streamId={agentChatStore.getStreamId(subChatId)}
                  isMobile={isMobileFullscreen}
                  isSubChatsSidebarOpen={subChatsSidebarMode === "sidebar"}
                  sandboxId={sandboxId || undefined}
                  projectPath={worktreePath || undefined}
                  onExecuteInTerminal={handleExecuteInTerminal}
                  onViewFullOutput={handleViewFullOutput}
                />
              </div>
            )
          })}

          {openSubChatIds.length === 0 && (
            <>
              {/* Empty chat area - no loading indicator */}
              <div className="flex-1" />

              {/* Disabled input while loading */}
              <div className="px-2 pb-2">
                <div className="w-full max-w-2xl mx-auto">
                  <div className="relative w-full">
                    <PromptInput
                      className="border bg-input-background relative z-10 p-2 rounded-xl opacity-50 pointer-events-none"
                      maxHeight={200}
                    >
                      <div className="p-1 text-muted-foreground text-sm">
                        Plan, @ for context, / for commands
                      </div>
                      <PromptInputActions className="w-full">
                        <div className="flex items-center gap-0.5 flex-1 min-w-0">
                          {/* Mode selector placeholder */}
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground rounded-md cursor-not-allowed"
                          >
                            <AgentIcon className="h-3.5 w-3.5" />
                            <span>Agent</span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                          </button>

                          {/* Model selector placeholder */}
                          <button
                            disabled
                            className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground rounded-md cursor-not-allowed"
                          >
                            <ClaudeCodeIcon className="h-3.5 w-3.5" />
                            <span>
                              Sonnet{" "}
                              <span className="text-muted-foreground">4.5</span>
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
                          {/* Attach button placeholder */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            className="h-7 w-7 rounded-sm cursor-not-allowed"
                          >
                            <AttachIcon className="h-4 w-4" />
                          </Button>

                          {/* Send button */}
                          <div className="ml-1">
                            <AgentSendButton
                              disabled={true}
                              onClick={() => { }}
                            />
                          </div>
                        </div>
                      </PromptInputActions>
                    </PromptInput>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Diff Sidebar - hidden on mobile fullscreen and when diff is not available */}
        {canOpenDiff && !isMobileFullscreen && (
          <ResizableSidebar
            isOpen={isDiffSidebarOpen}
            onClose={() => setIsDiffSidebarOpen(false)}
            widthAtom={agentsDiffSidebarWidthAtom}
            minWidth={350}
            side="right"
            animationDuration={0}
            initialWidth={0}
            exitWidth={0}
            showResizeTooltip={true}
            className="bg-background border-l"
            style={{ borderLeftWidth: "0.5px", overflow: "hidden" }}
          >
            <div
              ref={diffSidebarRef}
              className="flex flex-col h-full min-w-0 overflow-hidden"
            >
              {/* Header with stats, toggle and close button */}
              <div className="flex items-center justify-between pl-3 pr-1.5 h-10 bg-background flex-shrink-0 border-b border-border/50 overflow-hidden">
                {/* Left: Stats - truncates when space is limited */}
                <div className="flex items-center gap-2 min-w-0 flex-shrink overflow-hidden">
                  {!diffStats.isLoading && diffStats.hasChanges && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap overflow-hidden">
                      <span className="font-mono truncate">
                        {diffStats.fileCount} file
                        {diffStats.fileCount !== 1 ? "s" : ""}
                      </span>
                      {(diffStats.additions > 0 || diffStats.deletions > 0) && (
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{diffStats.additions}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            -{diffStats.deletions}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Right: Review (when space) + Create PR + View toggle + More menu + Close button */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Review button - visible when sidebar is wide enough (>=420px) */}
                  {diffStats.hasChanges && diffSidebarWidth >= 420 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          onClick={handleReview}
                          disabled={isReviewing}
                          className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                        >
                          {isReviewing ? (
                            <IconSpinner className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          <span>{isReviewing ? "Reviewing..." : "Review"}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8}>
                        <span>Get AI code review</span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Create PR / Merge / Commit button - dynamic based on PR state */}
                  {/*
                    Button logic:
                    1. No PR exists + has changes → "Create PR"
                    2. PR is open/draft + no changes → "Merge"
                    3. PR is open/draft + has changes → "Commit" (to push to existing PR)
                    4. PR is merged/closed + has changes → "Create PR" (for new PR)
                    5. PR is merged/closed + no changes → nothing (just show status in PrStatusBar)
                  */}
                  {/* Show Create PR when: no PR exists, OR PR is merged/closed with new changes */}
                  {diffStats.hasChanges && (!hasPrNumber || (hasPrNumber && !isPrOpen)) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleCreatePr}
                          disabled={isCreatingPr}
                          className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                        >
                          {isCreatingPr ? (
                            <IconSpinner className="w-3.5 h-3.5" />
                          ) : (
                            <PullRequestIcon className="w-3.5 h-3.5" />
                          )}
                          <span className="whitespace-nowrap">
                            {isCreatingPr ? "Creating..." : "Create PR"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8}>
                        Create a Pull Request
                        <Kbd>{getShortcutKey("preview")}</Kbd>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Show Merge when PR is open/draft and no new changes */}
                  {hasPrNumber && isPrOpen && !diffStats.hasChanges && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleMergePr}
                          disabled={mergePrMutation.isPending}
                          className="h-7 px-2.5 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition-transform duration-150 active:scale-[0.97] rounded-md"
                        >
                          {mergePrMutation.isPending ? (
                            <IconSpinner className="w-3.5 h-3.5" />
                          ) : (
                            <GitMerge className="w-3.5 h-3.5" />
                          )}
                          <span className="whitespace-nowrap">
                            {mergePrMutation.isPending ? "Merging..." : "Merge"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8}>
                        Merge Pull Request (squash)
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Show Commit when PR is open/draft but there are new uncommitted changes */}
                  {hasPrNumber && isPrOpen && diffStats.hasChanges && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleCommitToPr}
                          disabled={isCommittingToPr}
                          className="h-7 px-2.5 text-xs gap-1.5 transition-transform duration-150 active:scale-[0.97] rounded-md"
                        >
                          {isCommittingToPr ? (
                            <IconSpinner className="w-3.5 h-3.5" />
                          ) : (
                            <GitCommitHorizontal className="w-3.5 h-3.5" />
                          )}
                          <span className="whitespace-nowrap">
                            {isCommittingToPr ? "Committing..." : "Commit"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={8}>
                        Commit changes and push to PR
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* View toggle - visible when sidebar is wide enough (>=480px) */}
                  {diffSidebarWidth >= 480 && (
                    <div className="relative bg-muted rounded-md h-7 p-0.5 flex">
                      <div
                        className="absolute inset-y-0.5 rounded bg-background shadow transition-all duration-200 ease-in-out"
                        style={{
                          width: "calc(50% - 2px)",
                          left:
                            diffMode === DiffModeEnum.Split
                              ? "2px"
                              : "calc(50%)",
                        }}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDiffMode(DiffModeEnum.Split)}
                            className="relative z-[2] px-1.5 h-full flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                          >
                            <Columns2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={8}>
                          Split view
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setDiffMode(DiffModeEnum.Unified)}
                            className="relative z-[2] px-1.5 h-full flex items-center justify-center transition-colors duration-200 rounded text-muted-foreground"
                          >
                            <Rows2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={8}>
                          Unified view
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  {/* More menu (three dots) - shown when sidebar is narrow or many files */}
                  {(diffSidebarWidth < 480 || diffStats.fileCount > 10) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md flex-shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="w-40"
                      >
                        {/* Review option - shown only when hidden in header (<420px) */}
                        {diffStats.hasChanges && diffSidebarWidth < 420 && (
                          <DropdownMenuItem
                            onClick={handleReview}
                            disabled={isReviewing}
                            className="gap-2"
                          >
                            {isReviewing ? (
                              <IconSpinner className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isReviewing ? "Reviewing..." : "Review"}
                            </span>
                          </DropdownMenuItem>
                        )}
                        {/* View mode submenu - only show when toggle is hidden in header */}
                        {diffSidebarWidth < 480 && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="gap-2">
                              {diffMode === DiffModeEnum.Split ? (
                                <Columns2 className="w-3.5 h-3.5" />
                              ) : (
                                <Rows2 className="w-3.5 h-3.5" />
                              )}
                              <span>View</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent
                              sideOffset={6}
                              alignOffset={-4}
                              className="min-w-0"
                            >
                              <DropdownMenuItem
                                onClick={() => setDiffMode(DiffModeEnum.Split)}
                                className="relative pl-6 gap-1.5"
                              >
                                {diffMode === DiffModeEnum.Split && (
                                  <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                                    <CheckIcon className="h-3 w-3" />
                                  </span>
                                )}
                                <Columns2 className="w-3.5 h-3.5" />
                                <span>Split</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDiffMode(DiffModeEnum.Unified)
                                }
                                className="relative pl-6 gap-1.5"
                              >
                                {diffMode === DiffModeEnum.Unified && (
                                  <span className="absolute left-1.5 flex h-3.5 w-3.5 items-center justify-center">
                                    <CheckIcon className="h-3 w-3" />
                                  </span>
                                )}
                                <Rows2 className="w-3.5 h-3.5" />
                                <span>Unified</span>
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                        {/* Expand/Collapse - shown when many files */}
                        {diffStats.fileCount > 10 && (
                          <>
                            <DropdownMenuItem
                              onClick={() => diffViewRef.current?.expandAll()}
                              disabled={diffCollapseState.allExpanded}
                              className="gap-2"
                            >
                              <ExpandIcon className="w-3.5 h-3.5" />
                              <span>Expand all</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => diffViewRef.current?.collapseAll()}
                              disabled={diffCollapseState.allCollapsed}
                              className="gap-2"
                            >
                              <CollapseIcon className="w-3.5 h-3.5" />
                              <span>Collapse all</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {/* Close button */}
                  <Button
                    variant="ghost"
                    className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md flex-shrink-0"
                    onClick={() => setIsDiffSidebarOpen(false)}
                  >
                    <IconCloseSidebarRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
              {/* Diff Content */}
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
                {/* PR Status Bar - show when PR exists */}
                {agentChat?.prUrl && agentChat?.prNumber && (
                  <PrStatusBar
                    chatId={chatId}
                    prUrl={agentChat.prUrl}
                    prNumber={agentChat.prNumber}
                  />
                )}
                {/* Diff View */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AgentDiffView
                    ref={diffViewRef}
                    chatId={chatId}
                    sandboxId={sandboxId || ''}
                    worktreePath={worktreePath || undefined}
                    repository={repository}
                    onStatsChange={setDiffStats}
                    initialDiff={diffContent}
                    initialParsedFiles={parsedFileDiffs}
                    prefetchedFileContents={prefetchedFileContents}
                    showFooter={true}
                    onCollapsedStateChange={setDiffCollapseState}
                  />
                </div>
              </div>
            </div>
          </ResizableSidebar>
        )}

        {/* Preview Sidebar - shows AgentPreview (sandbox) or BrowserPreview (localhost) */}
        {!isMobileFullscreen && (
          <ResizableSidebar
            isOpen={isPreviewSidebarOpen}
            onClose={() => setIsPreviewSidebarOpen(false)}
            widthAtom={agentsPreviewSidebarWidthAtom}
            minWidth={350}
            side="right"
            animationDuration={0}
            initialWidth={0}
            exitWidth={0}
            showResizeTooltip={true}
            className="bg-tl-background border-l"
            style={{ borderLeftWidth: "0.5px" }}
          >
            {canOpenAgentPreview && !isQuickSetup && sandboxId ? (
              <AgentPreview
                chatId={chatId}
                sandboxId={sandboxId}
                port={previewPort}
                repository={repository}
                hideHeader={false}
                onClose={() => setIsPreviewSidebarOpen(false)}
              />
            ) : (
              <BrowserPreview
                chatId={chatId}
                hideHeader={false}
                onClose={() => setIsPreviewSidebarOpen(false)}
              />
            )}
          </ResizableSidebar>
        )}

        {/* File Tree Sidebar - shows when worktree exists (desktop only) */}
        {!isMobileFullscreen && worktreePath && (
          <ResizableSidebar
            isOpen={isTreeSidebarOpen}
            onClose={() => setIsTreeSidebarOpen(false)}
            widthAtom={agentsPreviewSidebarWidthAtom}
            minWidth={250}
            side="right"
            animationDuration={0}
            initialWidth={300}
            exitWidth={0}
            showResizeTooltip={true}
            className="bg-tl-background border-l"
            style={{ borderLeftWidth: "0.5px" }}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <h3 className="text-sm font-medium">File Tree</h3>
                <Button
                  variant="ghost"
                  className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md flex-shrink-0"
                  onClick={() => setIsTreeSidebarOpen(false)}
                >
                  <IconCloseSidebarRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
              {/* Tree Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <FileTreePanel projectPath={worktreePath} />
              </div>
            </div>
          </ResizableSidebar>
        )}

        {/* Kanban Sidebar - shows when enabled (desktop only) */}
        {!isMobileFullscreen && (
          <ResizableSidebar
            isOpen={isKanbanSidebarOpen}
            onClose={() => setIsKanbanSidebarOpen(false)}
            widthAtom={agentsPreviewSidebarWidthAtom}
            minWidth={300}
            side="right"
            animationDuration={0}
            initialWidth={400}
            exitWidth={0}
            showResizeTooltip={true}
            className="bg-tl-background border-l"
            style={{ borderLeftWidth: "0.5px" }}
          >
            <KanbanPanel chatId={chatId} onClose={() => setIsKanbanSidebarOpen(false)} />
          </ResizableSidebar>
        )}

        {/* Terminal Sidebar - shows when worktree exists (desktop only) */}
        {worktreePath && (
          <TerminalSidebar
            chatId={chatId}
            cwd={worktreePath}
            workspaceId={chatId}
            initialCommands={terminalInitialCommands}
          />
        )}
        
        {/* Command Output Dialog */}
        <CommandOutputDialog
          open={outputDialog.open}
          onOpenChange={(open) =>
            setOutputDialog((prev) => ({ ...prev, open }))
          }
          command={outputDialog.command}
          stdout={outputDialog.stdout}
          stderr={outputDialog.stderr}
          exitCode={outputDialog.exitCode}
        />
      </div>
    </div>
  )
}
