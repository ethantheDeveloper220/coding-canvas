"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { AlignJustify, Plus, FolderIcon } from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "../../../components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../../../components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import {
  AgentIcon,
  AttachIcon,
  BranchIcon,
  CheckIcon,
  ClaudeCodeIcon,
  CursorIcon,
  IconChevronDown,
  PlanIcon,
  SearchIcon,
} from "../../../components/ui/icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover"
import { cn } from "../../../lib/utils"
import {
  agentsDebugModeAtom,
  isPlanModeAtom,
  justCreatedIdsAtom,
  lastSelectedAgentIdAtom,
  lastSelectedBranchesAtom,
  lastSelectedModelIdAtom,
  lastSelectedRepoAtom,
  lastSelectedWorkModeAtom,
  sandboxEnabledAtom,
  selectedAgentChatIdAtom,
  selectedDraftIdAtom,
  selectedProjectAtom,
} from "../atoms"
import { ProjectSelector } from "../components/project-selector"
import { WorkModeSelector } from "../components/work-mode-selector"
import { ChatModeSelector, type ChatMode } from "../components/chat-mode-selector"
import { SmartSuggestions } from "../ui/smart-suggestions"
import { EnhancedNewChatBanner } from "./enhanced-new-chat-banner"
// import { selectedTeamIdAtom } from "@/lib/atoms/team"
import { atom } from "jotai"
const selectedTeamIdAtom = atom<string | null>(null)
// import { agentsSettingsDialogOpenAtom, agentsSettingsDialogActiveTabAtom } from "@/lib/atoms/agents-settings-dialog"
const agentsSettingsDialogOpenAtom = atom(false)
const agentsSettingsDialogActiveTabAtom = atom<string | null>(null)
// Desktop uses real tRPC
import { toast } from "sonner"
import { trpc, trpcClient } from "../../../lib/trpc"
import {
  AgentsSlashCommand,
  COMMAND_PROMPTS,
  type SlashCommandOption,
} from "../commands"
import { useAgentsFileUpload } from "../hooks/use-agents-file-upload"
import { useFocusInputOnEnter } from "../hooks/use-focus-input-on-enter"
import { useToggleFocusOnCmdEsc } from "../hooks/use-toggle-focus-on-cmd-esc"
import {
  AgentsFileMention,
  AgentsMentionsEditor,
  type AgentsMentionsEditorHandle,
  type FileMentionOption,
} from "../mentions"
import { AgentImageItem } from "../ui/agent-image-item"
import { AgentsHeaderControls } from "../ui/agents-header-controls"
// import { CreateBranchDialog } from "@/app/(alpha)/agents/{components}/create-branch-dialog"
import {
  PromptInput,
  PromptInputActions,
  PromptInputContextItems,
} from "../../../components/ui/prompt-input"
import { agentsSidebarOpenAtom, agentsUnseenChangesAtom, pendingMultiAgentRunAtom } from "../atoms"
import { AgentSendButton } from "../components/agent-send-button"
import { MultiAgentModal } from "../components/multi-agent-modal"
import { CreateBranchDialog } from "../components/create-branch-dialog"
import { formatTimeAgo } from "../utils/format-time-ago"
import {
  loadGlobalDrafts,
  saveGlobalDrafts,
  generateDraftId,
  deleteNewChatDraft,
  type DraftProject,
} from "../lib/drafts"
// import type { PlanType } from "@/lib/config/subscription-plans"
type PlanType = string

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
      <path d="M24 32H8V16H24V32Z" fill="#4B4646"/>
      <path d="M24 8H8V32H24V8ZM32 40H0V0H32V40Z" fill="#F1ECEC"/>
    </g>
    <defs>
      <clipPath id="clip0_1311_94973">
        <rect width="32" height="40" fill="white"/>
      </clipPath>
    </defs>
  </svg>
)

// Provider icons
const OpenAIIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5155-4.9101 6.0462 6.0462 0 0 0-6.5098-2.9006A6.065 6.065 0 0 0 4.9805 4.1798a5.9847 5.9847 0 0 0-3.9976 2.9006 6.0462 6.0462 0 0 0 .7432 7.0968 5.98 5.98 0 0 0 .51 4.9101 6.0513 6.0513 0 0 0 6.5146 2.9006A5.9847 5.9847 0 0 0 13.2598 24a6.0555 6.0555 0 0 0 5.7716-4.206 5.99 5.99 0 0 0 3.9976-2.9006 6.0555 6.0555 0 0 0-.7468-7.0721zM13.2598 22.4296a4.476 4.476 0 0 1-2.876-1.0403l.141-.0807 4.7785-2.7576a.7952.7952 0 0 0 .3921-.6812v-6.7369l2.0195 1.168a.0713.0713 0 0 1 .038.0517v5.5824a4.5042 4.5042 0 0 1-4.4931 4.4931zM3.6 18.3037a4.4705 4.4705 0 0 1-.5352-3.0137l.142.0849 4.7827 2.7588a.7708.7708 0 0 0 .78 0l5.8428-3.369v2.3321a.0799.0799 0 0 1-.0334.062L9.7402 19.9508a4.4998 4.4998 0 0 1-6.1406-1.6475zM2.3402 7.8955a4.4851 4.4851 0 0 1 2.3658-1.9727V11.6a.7664.7664 0 0 0 .3879.6762l5.8146 3.3555-2.0196 1.168a.0761.0761 0 0 1-.0713 0l-4.8291-2.7861A4.5042 4.5042 0 0 1 2.3402 7.8722zm16.5967 3.8549l-5.8326-3.3867L15.1191 7.2a.0761.0761 0 0 1 .0713 0l4.8291 2.791a4.4943 4.4943 0 0 1-.6761 8.1055v-5.6782a.7891.7891 0 0 0-.4072-.6662zm2.0097-3.0236l-.141-.0849-4.7735-2.7817a.7758.7758 0 0 0-.7847 0L9.4092 9.2298V6.8965a.0661.0661 0 0 1 .02793-.0615l4.8291-2.7867a4.5005 4.5005 0 0 1 6.68 4.66zm-12.6398 4.1352l-2.0196-1.1636a.0799.0799 0 0 1-.0381-.0567V6.0751a4.5005 4.5005 0 0 1 7.3749-3.4532l-.141.0801-4.7778 2.7588a.7952.7952 0 0 0-.393.6807zm1.0972-2.3642l2.6026-1.5 2.6074 1.5v2.999l-2.5972 1.5-2.6074-1.5z" fill="currentColor"/>
  </svg>
)

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-8h2c.02 2.54 2.45 4.88 5 5.07v2.93zm5-9h-4v-2h4v2zm-2-2.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm-4.5 3.5c0-1.93 1.57-3.5 3.5-3.5v7c-2.54.19-4.98-2.53-5-5.07v-2.93c0-4.15 3.05-7.93 7-8.43V4.57c4.44.5 8 4.48 8 8z" fill="currentColor"/>
  </svg>
)

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
  
  // Default: return OpenCode icon for opencode or null
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
  { id: "cursor", name: "Cursor CLI", disabled: true },
  { id: "codex", name: "OpenAI Codex", disabled: true },
]

interface NewChatFormProps {
  isMobileFullscreen?: boolean
  onBackToChats?: () => void
}

export function NewChatForm({
  isMobileFullscreen = false,
  onBackToChats,
}: NewChatFormProps = {}) {
  // UNCONTROLLED: just track if editor has content for send button
  const [hasContent, setHasContent] = useState(false)
  const [selectedTeamId] = useAtom(selectedTeamIdAtom)
  const [, setSelectedChatId] = useAtom(selectedAgentChatIdAtom)
  const [selectedDraftId, setSelectedDraftId] = useAtom(selectedDraftIdAtom)
  const [sidebarOpen, setSidebarOpen] = useAtom(agentsSidebarOpenAtom)

  // Fetch OpenCode models
  const { data: opencodeModelsData } = trpc.opencode.getModels.useQuery()
  const opencodeModels = opencodeModelsData ? Object.values(opencodeModelsData) : []

  // Current draft ID being edited (generated when user starts typing in empty form)
  const currentDraftIdRef = useRef<string | null>(null)
  const unseenChanges = useAtomValue(agentsUnseenChangesAtom)

  // Check if any chat has unseen changes
  const hasAnyUnseenChanges = unseenChanges.size > 0
  const [lastSelectedRepo, setLastSelectedRepo] = useAtom(lastSelectedRepoAtom)
  const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom)

  // Fetch projects to validate selectedProject exists
  const { data: projectsList, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery()

  // Validate selected project exists in DB
  // While loading, trust the stored value to prevent flicker
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject
    // After loading, validate against DB
    if (!projectsList) return null
    const exists = projectsList.some((p) => p.id === selectedProject.id)
    return exists ? selectedProject : null
  }, [selectedProject, projectsList, isLoadingProjects])

  // Clear invalid project from storage
  useEffect(() => {
    if (selectedProject && projectsList && !validatedProject) {
      setSelectedProject(null)
    }
  }, [selectedProject, projectsList, validatedProject, setSelectedProject])
  const [lastSelectedAgentId, setLastSelectedAgentId] = useAtom(
    lastSelectedAgentIdAtom,
  )
  const [lastSelectedModelId, setLastSelectedModelId] = useAtom(
    lastSelectedModelIdAtom,
  )
  const [isPlanMode, setIsPlanMode] = useAtom(isPlanModeAtom)
  // Chat mode state (for the 5-mode selector)
  const [chatMode, setChatMode] = useState<ChatMode>(
    isPlanMode ? "plan" : "build" // Initialize based on existing isPlanMode
  )

  // Sync chatMode with isPlanMode atom
  useEffect(() => {
    if (chatMode === "plan") {
      setIsPlanMode(true)
    } else {
      setIsPlanMode(false)
    }
  }, [chatMode, setIsPlanMode])
  const [sandboxEnabled, setSandboxEnabled] = useAtom(sandboxEnabledAtom)
  const [workMode, setWorkMode] = useAtom(lastSelectedWorkModeAtom)
  const debugMode = useAtomValue(agentsDebugModeAtom)
  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom)
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom)
  const setJustCreatedIds = useSetAtom(justCreatedIdsAtom)
  const [repoSearchQuery, setRepoSearchQuery] = useState("")
  const [createBranchDialogOpen, setCreateBranchDialogOpen] = useState(false)
  // Parse owner/repo from GitHub URL
  const parseGitHubUrl = (url: string) => {
    const match = url.match(/(?:github\.com\/)?([^\/]+)\/([^\/\s#?]+)/)
    if (!match) return null
    return `${match[1]}/${match[2].replace(/\.git$/, "")}`
  }
  const [selectedAgent, setSelectedAgent] = useState(
    () => agents.find((a) => a.id === lastSelectedAgentId) || agents[0],
  )

  // Determine available models based on selected agent
  const availableModels = selectedAgent.id === 'opencode' ? opencodeModels : claudeModels

  const [selectedModel, setSelectedModel] = useState(() => {
    const models = lastSelectedAgentId === 'opencode' ? opencodeModels : claudeModels
    if (models.length === 0) return null // Return null if no models yet
    return models.find((m) => m.id === lastSelectedModelId) || models[0]
  })

  // Update selected model when OpenCode models load
  useEffect(() => {
    if (selectedAgent.id === 'opencode' && opencodeModels.length > 0 && !selectedModel) {
      setSelectedModel(opencodeModels[0])
    }
  }, [opencodeModels, selectedAgent.id, selectedModel])

  const [repoPopoverOpen, setRepoPopoverOpen] = useState(false)
  const [branchPopoverOpen, setBranchPopoverOpen] = useState(false)
  const [lastSelectedBranches, setLastSelectedBranches] = useAtom(
    lastSelectedBranchesAtom,
  )
  const [branchSearch, setBranchSearch] = useState("")
  const [modelSearch, setModelSearch] = useState("")

  // Get/set selected branch for current project (persisted per project)
  const selectedBranch = validatedProject?.id
    ? lastSelectedBranches[validatedProject.id] || ""
    : ""
  const setSelectedBranch = useCallback(
    (branch: string) => {
      if (validatedProject?.id) {
        setLastSelectedBranches((prev) => ({
          ...prev,
          [validatedProject.id]: branch,
        }))
      }
    },
    [validatedProject?.id, setLastSelectedBranches],
  )
  const branchListRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<AgentsMentionsEditorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Image upload hook
  const {
    images,
    handleAddAttachments,
    removeImage,
    clearImages,
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

  // Mode tooltip state (floating tooltip like canvas)
  const [modeTooltip, setModeTooltip] = useState<{
    visible: boolean
    position: { top: number; left: number }
    mode: "agent" | "plan"
  } | null>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasShownTooltipRef = useRef(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [multiAgentModalOpen, setMultiAgentModalOpen] = useState(false)

  // Shift+Tab handler for mode switching (now handled inside input component via onShiftTab prop)

  // Keyboard shortcut: Enter to focus input when not already focused
  useFocusInputOnEnter(editorRef)

  // Keyboard shortcut: Cmd+Esc to toggle focus/blur
  useToggleFocusOnCmdEsc(editorRef)

  // Fetch repos from team
  // Desktop: no remote repos, we use local projects
  const reposData = { repositories: [] }
  const isLoadingRepos = false

  // Memoize repos arrays to prevent useEffect from running on every keystroke
  // Apply debug mode simulations
  const repos = useMemo(() => {
    if (debugMode.enabled && debugMode.simulateNoRepos) {
      return []
    }
    return reposData?.repositories || []
  }, [reposData?.repositories, debugMode.enabled, debugMode.simulateNoRepos])

  const readyRepos = useMemo(() => {
    if (debugMode.enabled && debugMode.simulateNoReadyRepos) {
      return []
    }
    // @ts-expect-error - GitHub repo type inference issue (upstream)
    return repos.filter((r) => r.sandbox_status === "ready")
  }, [repos, debugMode.enabled, debugMode.simulateNoReadyRepos])

  const notReadyRepos = useMemo(
    // @ts-expect-error - GitHub repo type inference issue (upstream)
    () => repos.filter((r) => r.sandbox_status !== "ready"),
    [repos],
  )

  // Use state to avoid hydration mismatch
  const [resolvedRepo, setResolvedRepo] = useState<(typeof repos)[0] | null>(
    null,
  )

  // Derive selected repo from saved or first available (client-side only)
  // Now includes all repos, not just ready ones
  useEffect(() => {
    if (lastSelectedRepo) {
      // For public imports, use lastSelectedRepo directly (it won't be in repos list)
      if (lastSelectedRepo.isPublicImport) {
        setResolvedRepo({
          id: lastSelectedRepo.id,
          name: lastSelectedRepo.name,
          full_name: lastSelectedRepo.full_name,
          sandbox_status: lastSelectedRepo.sandbox_status || "not_setup",
        } as (typeof repos)[0])
        return
      }

      // Check if last selected repo still exists in the user's repos
      const stillExists = repos.find(
        (r) =>
          (lastSelectedRepo.id && (r as any).id === lastSelectedRepo.id) ||
          (r as any).full_name === lastSelectedRepo.full_name,
      )
      if (stillExists) {
        setResolvedRepo(stillExists)
        return
      }
    }

    if (repos.length === 0) {
      setResolvedRepo(null)
      return
    }

    // Auto-save first repo if none saved (prefer ready repos, then any)
    if (!lastSelectedRepo && repos.length > 0) {
      const firstRepo = readyRepos[0] || repos[0]
      setLastSelectedRepo({
        id: (firstRepo as any).id,
        name: (firstRepo as any).name,
        full_name: (firstRepo as any).full_name,
        sandbox_status: (firstRepo as any).sandbox_status,
      })
    }

    setResolvedRepo(readyRepos[0] || repos[0] || null)
  }, [lastSelectedRepo, repos, readyRepos, setLastSelectedRepo])

  // Desktop: fetch branches from local git repository
  const branchesQuery = trpc.changes.getBranches.useQuery(
    { worktreePath: validatedProject?.path || "" },
    {
      enabled: !!validatedProject?.path,
      staleTime: 30_000, // Cache for 30 seconds
    },
  )

  // Transform branch data to match web app format
  const branches = useMemo(() => {
    if (!branchesQuery.data) return []

    const { local, remote, defaultBranch } = branchesQuery.data

    // Combine local and remote branches, preferring local info
    const branchMap = new Map<
      string,
      {
        name: string
        protected: boolean
        isDefault: boolean
        committedAt: string | null
        authorName: null
      }
    >()

    // Add remote branches first
    for (const name of remote) {
      branchMap.set(name, {
        name,
        protected: false,
        isDefault: name === defaultBranch,
        committedAt: null,
        authorName: null,
      })
    }

    // Override with local branches (they have commit dates)
    for (const { branch, lastCommitDate } of local) {
      branchMap.set(branch, {
        name: branch,
        protected: false,
        isDefault: branch === defaultBranch,
        committedAt: lastCommitDate
          ? new Date(lastCommitDate).toISOString()
          : null,
        authorName: null,
      })
    }

    // Sort: default first, then by commit date
    return Array.from(branchMap.values()).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      // Sort by commit date (most recent first)
      if (a.committedAt && b.committedAt) {
        return (
          new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime()
        )
      }
      if (a.committedAt) return -1
      if (b.committedAt) return 1
      return a.name.localeCompare(b.name)
    })
  }, [branchesQuery.data])

  // Filter branches based on search
  const filteredBranches = useMemo(() => {
    if (!branchSearch.trim()) return branches
    const search = branchSearch.toLowerCase()
    return branches.filter((b) => b.name.toLowerCase().includes(search))
  }, [branches, branchSearch])

  // Virtualizer for branch list - only active when popover is open
  const branchVirtualizer = useVirtualizer({
    count: filteredBranches.length,
    getScrollElement: () => branchListRef.current,
    estimateSize: () => 28, // Each item is h-7 (28px)
    overscan: 5,
    enabled: branchPopoverOpen, // Only virtualize when popover is open
  })

  // Force virtualizer to re-measure when popover opens
  useEffect(() => {
    if (branchPopoverOpen) {
      // Small delay to ensure ref is attached
      const timer = setTimeout(() => {
        branchVirtualizer.measure()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [branchPopoverOpen])

  // Format relative time for branches (reuse shared utility)
  const formatRelativeTime = (dateString: string | null): string => {
    if (!dateString) return ""
    return formatTimeAgo(dateString)
  }

  // Set default branch when project/branches change (only if no saved branch for this project)
  useEffect(() => {
    if (
      branchesQuery.data?.defaultBranch &&
      validatedProject?.id &&
      !selectedBranch
    ) {
      setSelectedBranch(branchesQuery.data.defaultBranch)
    }
  }, [
    branchesQuery.data?.defaultBranch,
    validatedProject?.id,
    selectedBranch,
    setSelectedBranch,
  ])

  // Auto-focus input when NewChatForm is shown (when clicking "New Agent")
  // Skip on mobile to prevent keyboard from opening automatically
  useEffect(() => {
    if (isMobileFullscreen) return // Don't autofocus on mobile

    // Small delay to ensure DOM is ready and animations complete
    const timeoutId = setTimeout(() => {
      editorRef.current?.focus()
    }, 150)

    return () => clearTimeout(timeoutId)
  }, [isMobileFullscreen]) // Run on mount and when mobile state changes

  // Track last saved text to avoid unnecessary updates
  const lastSavedTextRef = useRef<string>("")

  // Track previous draft ID to detect when switching away from a draft
  const prevSelectedDraftIdRef = useRef<string | null>(null)

  // Restore draft when a specific draft is selected from sidebar
  // Or clear editor when "New Workspace" is clicked (selectedDraftId becomes null)
  useEffect(() => {
    const hadDraftBefore = prevSelectedDraftIdRef.current !== null
    prevSelectedDraftIdRef.current = selectedDraftId

    if (!selectedDraftId) {
      // No draft selected - clear editor if we had a draft before (user clicked "New Workspace")
      currentDraftIdRef.current = null
      lastSavedTextRef.current = ""
      if (hadDraftBefore && editorRef.current) {
        editorRef.current.clear()
        setHasContent(false)
      }
      return
    }

    const globalDrafts = loadGlobalDrafts()
    const draft = globalDrafts[selectedDraftId]
    if (draft?.text) {
      currentDraftIdRef.current = selectedDraftId
      lastSavedTextRef.current = draft.text // Initialize to prevent immediate re-save

      // Try to set value immediately if editor is ready
      if (editorRef.current) {
        editorRef.current.setValue(draft.text)
        setHasContent(true)
      } else {
        // Fallback: wait for editor to initialize (rare case)
        const timeoutId = setTimeout(() => {
          editorRef.current?.setValue(draft.text)
          setHasContent(true)
        }, 50)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [selectedDraftId])

  // Filter all repos by search (combined list) and sort by preview status
  const filteredRepos = repos
    .filter(
      (repo) =>
        (repo as any).name.toLowerCase().includes(repoSearchQuery.toLowerCase()) ||
        (repo as any).full_name.toLowerCase().includes(repoSearchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      // 1. Repos with preview (sandbox_status === "ready") come first
      const aHasPreview = (a as any).sandbox_status === "ready"
      const bHasPreview = (b as any).sandbox_status === "ready"
      if (aHasPreview && !bHasPreview) return -1
      if (!aHasPreview && bHasPreview) return 1

      // 2. Sort by last commit date (pushed_at) - most recent first
      const aDate = (a as any).pushed_at ? new Date((a as any).pushed_at).getTime() : 0
      const bDate = (b as any).pushed_at ? new Date((b as any).pushed_at).getTime() : 0
      return bDate - aDate
    })

  // Create chat mutation (real tRPC)
  const utils = trpc.useUtils()
  const createChatMutation = trpc.chats.create.useMutation({
    onSuccess: (data) => {
      console.log('[DEBUG] onSuccess called with data:', data)
      console.log('[DEBUG] setSelectedChatId type:', typeof setSelectedChatId)
      console.log('[DEBUG] data.id:', data?.id)
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8462065b-3059-44ce-882e-f2b5fea21cc1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'new-chat-form.tsx:616',message:'onSuccess called',data:{chatId:data?.id,hasSubChats:!!data?.subChats,setSelectedChatIdExists:typeof setSelectedChatId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Clear editor and images only on success
      editorRef.current?.clear()
      clearImages()
      clearCurrentDraft()
      utils.chats.list.invalidate()
      
      console.log('[DEBUG] Before setSelectedChatId, chatId:', data.id)
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8462065b-3059-44ce-882e-f2b5fea21cc1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'new-chat-form.tsx:622',message:'Before setSelectedChatId',data:{chatId:data.id,setSelectedChatIdType:typeof setSelectedChatId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Auto-redirect to the newly created chat using atom (proper navigation)
      setSelectedChatId(data.id)
      
      console.log('[DEBUG] After setSelectedChatId, URL:', window.location.href)
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8462065b-3059-44ce-882e-f2b5fea21cc1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'new-chat-form.tsx:623',message:'After setSelectedChatId',data:{chatId:data.id,currentUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      
      // Track this chat and its first subchat as just created for typewriter effect
      const ids = [data.id]
      if (data.subChats?.[0]?.id) {
        ids.push(data.subChats[0].id)
      }
      setJustCreatedIds((prev) => new Set([...prev, ...ids]))
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8462065b-3059-44ce-882e-f2b5fea21cc1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'new-chat-form.tsx:629',message:'onSuccess completed',data:{chatId:data.id,finalUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const createSubChatMutation = trpc.chats.createSubChat.useMutation()
  const setPendingMultiAgentRun = useSetAtom(pendingMultiAgentRunAtom)

  // Open folder mutation for selecting a project
  const openFolder = trpc.projects.openFolder.useMutation({
    onSuccess: (project) => {
      if (project) {
        // Optimistically update the projects list cache to prevent "Select repo" flash
        // This ensures validatedProject can find the new project immediately
        utils.projects.list.setData(undefined, (oldData) => {
          if (!oldData) return [project]
          // Check if project already exists (reopened existing project)
          const exists = oldData.some((p) => p.id === project.id)
          if (exists) {
            // Update existing project's timestamp
            return oldData.map((p) =>
              p.id === project.id ? { ...p, updatedAt: project.updatedAt } : p,
            )
          }
          // Add new project at the beginning
          return [project, ...oldData]
        })

        setSelectedProject({
          id: project.id,
          name: project.name,
          path: project.path,
          gitRemoteUrl: project.gitRemoteUrl,
          gitProvider: project.gitProvider as
            | "github"
            | "gitlab"
            | "bitbucket"
            | null,
          gitOwner: project.gitOwner,
          gitRepo: project.gitRepo,
        })
      }
    },
  })

  const handleOpenFolder = async () => {
    await openFolder.mutateAsync()
  }

  const getAgentIcon = (agentId: string, className?: string) => {
    switch (agentId) {
      case "claude-code":
        return <ClaudeCodeIcon className={className} />
      case "opencode":
        return <OpenCodeIcon className={className} />
      case "cursor":
        return <CursorIcon className={className} />
      case "codex":
        return <CodexIcon className={className} />
      default:
        return null
    }
  }

  const handleSend = useCallback(() => {
    // Get value from uncontrolled editor
    const message = editorRef.current?.getValue() || ""

    if (!message.trim() || !selectedProject) {
      return
    }

    // Build message parts array (images first, then text)
    type MessagePart =
      | { type: "text"; text: string }
      | {
        type: "data-image"
        data: {
          url: string
          mediaType?: string
          filename?: string
          base64Data?: string
        }
      }

    const parts: MessagePart[] = images
      .filter((img) => !img.isLoading && img.url)
      .map((img) => ({
        type: "data-image" as const,
        data: {
          url: img.url!,
          mediaType: img.mediaType,
          filename: img.filename,
          base64Data: img.base64Data,
        },
      }))

    if (message.trim()) {
      parts.push({ type: "text" as const, text: message.trim() })
    }

    // Create chat with selected project, branch, and initial message
    createChatMutation.mutate({
      projectId: selectedProject.id,
      name: message.trim().slice(0, 50), // Use first 50 chars as chat name
      initialMessageParts: parts.length > 0 ? parts : undefined,
      baseBranch:
        workMode === "worktree" ? selectedBranch || undefined : undefined,
      useWorktree: workMode === "worktree",
      mode: isPlanMode ? "plan" : "agent",
    })
    // Editor and images are cleared in onSuccess callback
  }, [
    selectedProject,
    createChatMutation,
    hasContent,
    selectedBranch,
    workMode,
    images,
    isPlanMode,
  ])

  const handleMentionSelect = useCallback((mention: FileMentionOption) => {
    editorRef.current?.insertMention(mention)
    setShowMentionDropdown(false)
  }, [])

  // Save draft to localStorage when content changes
  const handleContentChange = useCallback(
    (hasContent: boolean) => {
      setHasContent(hasContent)
      const text = editorRef.current?.getValue() || ""

      // Skip if text hasn't changed
      if (text === lastSavedTextRef.current) {
        return
      }
      lastSavedTextRef.current = text

      const globalDrafts = loadGlobalDrafts()

      if (text.trim() && validatedProject) {
        // If no current draft ID, create a new one
        if (!currentDraftIdRef.current) {
          currentDraftIdRef.current = generateDraftId()
        }

        const key = currentDraftIdRef.current
        globalDrafts[key] = {
          text,
          updatedAt: Date.now(),
          project: {
            id: validatedProject.id,
            name: validatedProject.name,
            path: validatedProject.path,
            gitOwner: validatedProject.gitOwner,
            gitRepo: validatedProject.gitRepo,
            gitProvider: validatedProject.gitProvider,
          },
        }
        saveGlobalDrafts(globalDrafts)
      } else if (currentDraftIdRef.current) {
        // Text is empty - delete the current draft
        deleteNewChatDraft(currentDraftIdRef.current)
        currentDraftIdRef.current = null
      }
    },
    [validatedProject],
  )

  // Clear current draft when chat is created
  const clearCurrentDraft = useCallback(() => {
    if (!currentDraftIdRef.current) return

    deleteNewChatDraft(currentDraftIdRef.current)
    currentDraftIdRef.current = null
    setSelectedDraftId(null)
  }, [setSelectedDraftId])

  // Memoized callbacks to prevent re-renders
  const handleMentionTrigger = useCallback(
    ({ searchText, rect }: { searchText: string; rect: DOMRect }) => {
      if (validatedProject) {
        setMentionSearchText(searchText)
        setMentionPosition({ top: rect.top, left: rect.left })
        setShowMentionDropdown(true)
      }
    },
    [validatedProject],
  )

  const handleCloseTrigger = useCallback(() => {
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
            editorRef.current?.clear()
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
    [isPlanMode, setIsPlanMode, handleSend],
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

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false)

  // Focus state for ring
  const [isFocused, setIsFocused] = useState(false)

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
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/"),
      )
      handleAddAttachments(files)
      // Focus after state update - use double rAF to wait for React render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          editorRef.current?.focus()
        })
      })
    },
    [handleAddAttachments],
  )

  // Context items for images
  const contextItems =
    images.length > 0 ? (
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
      </div>
    ) : null

  // Handle container click to focus editor
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (
      e.target === e.currentTarget ||
      !(e.target as HTMLElement).closest("button, [contenteditable]")
    ) {
      editorRef.current?.focus()
    }
  }, [])

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header - Simple burger on mobile, AgentsHeaderControls on desktop */}
        <div className="flex-shrink-0 flex items-center justify-between bg-background p-1.5">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isMobileFullscreen ? (
              // Simple burger button for mobile - just opens chats list
              <Button
                variant="ghost"
                size="icon"
                onClick={onBackToChats}
                className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
                aria-label="All projects"
              >
                <AlignJustify className="h-4 w-4" />
              </Button>
            ) : (
              <AgentsHeaderControls
                isSidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
                hasUnseenChanges={hasAnyUnseenChanges}
              />
            )}
          </div>
        </div>

        <div 
          className="flex flex-1 items-center justify-center overflow-y-auto relative bg-cover bg-center"
          style={{
            backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
            backgroundAttachment: "fixed",
          }}
        >
          <div className="w-full max-w-2xl space-y-4 md:space-y-6 relative z-10 px-4">
            {/* Enhanced Banner with Roadmap and File Tree */}
            <EnhancedNewChatBanner />
            
            {/* Title - only show when project is selected */}
            {validatedProject && (
              <div className="text-center space-y-3">
                <h1 className="text-2xl md:text-4xl font-medium tracking-tight">
                  Ship Faster And Launch Quicker
                </h1>
                {/* Breadcrumb showing current working directory */}
                {validatedProject.path && (
                  <div className="flex items-center justify-center">
                    <Breadcrumb>
                      <BreadcrumbList>
                        {validatedProject.path.split(/[/\\]/).filter(Boolean).map((segment, idx, arr) => {
                          const isLast = idx === arr.length - 1
                          return (
                            <React.Fragment key={idx}>
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
                            </React.Fragment>
                          )
                        })}
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                )}
              </div>
            )}

            {/* Input Area or Select Repo State */}
            {!validatedProject ? (
              // No project selected - show select repo button (like Sign in button)
              <div className="flex justify-center">
                <button
                  onClick={handleOpenFolder}
                  disabled={openFolder.isPending}
                  className="h-8 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.97] shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(255,255,255,0.14)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {openFolder.isPending ? "Opening..." : "Select repo"}
                </button>
              </div>
            ) : (
              // Project selected - show input form
              <div
                className="relative w-full"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Smart Suggestions */}
                <SmartSuggestions
                  onSuggestionClick={(text) => {
                    editorRef.current?.setValue(text)
                    editorRef.current?.focus()
                  }}
                  context={{}} // Default suggestions for new chat
                />

                <div
                  className="relative w-full cursor-text"
                  onClick={handleContainerClick}
                >
                  <PromptInput
                    className={cn(
                      "border bg-input-background relative z-10 p-2 rounded-xl transition-[border-color,box-shadow] duration-150",
                      isDragOver && "ring-2 ring-primary/50 border-primary/50",
                      isFocused && !isDragOver && "ring-2 ring-primary/50",
                    )}
                    maxHeight={200}
                    onSubmit={handleSend}
                    contextItems={contextItems}
                  >
                    <PromptInputContextItems />
                    <div className="relative">
                      <AgentsMentionsEditor
                        ref={editorRef}
                        onTrigger={handleMentionTrigger}
                        onCloseTrigger={handleCloseTrigger}
                        onSlashTrigger={handleSlashTrigger}
                        onCloseSlashTrigger={handleCloseSlashTrigger}
                        onContentChange={handleContentChange}
                        onSubmit={handleSend}
                        onShiftTab={() => setIsPlanMode((prev) => !prev)}
                        placeholder=" Seamless AI: What are you ready to ship next?"
                        className={cn(
                          "bg-transparent max-h-[200px] overflow-y-auto p-1",
                          isMobileFullscreen ? "min-h-[56px]" : "min-h-[44px]",
                        )}
                        onPaste={handlePaste}
                        disabled={createChatMutation.isPending}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                      />
                    </div>
                    <PromptInputActions className="w-full">
                      <div className="flex items-center gap-0.5 flex-1 min-w-0">
                        {/* Mode selector - all 5 modes: build, plan, scaling, designer, debug */}
                        <ChatModeSelector
                          value={chatMode}
                          onChange={setChatMode}
                          disabled={createChatMutation.isPending}
                        />

                        {/* Agent Type selector */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70">
                              {getAgentIcon(selectedAgent.id, "h-3.5 w-3.5")}
                              <span>{selectedAgent.name}</span>
                              <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
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
                        <DropdownMenu onOpenChange={(open) => !open && setModelSearch("")}>
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
                              <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[280px] max-h-[400px] overflow-hidden flex flex-col"
                          >
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
                            <div className="overflow-y-auto max-h-[340px]">{availableModels
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
                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={fileInputRef}
                          hidden
                          accept="image/jpeg,image/png"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || [])
                            handleAddAttachments(files)
                            e.target.value = "" // Reset to allow same file selection
                          }}
                        />
                        {/* Sandbox toggle button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7 rounded-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
                            sandboxEnabled && "bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                          onClick={() => setSandboxEnabled(!sandboxEnabled)}
                          title={sandboxEnabled ? "Sandbox enabled" : "Sandbox disabled"}
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
                          disabled={images.length >= 5}
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
                        <div className="ml-1">
                          <AgentSendButton
                            isStreaming={false}
                            isSubmitting={
                              createChatMutation.isPending || isUploading
                            }
                            disabled={Boolean(
                              !hasContent || !selectedProject || isUploading,
                            )}
                            onClick={handleSend}
                            isPlanMode={isPlanMode}
                          />
                        </div>
                      </div>
                    </PromptInputActions>
                  </PromptInput>

                  {/* Project, Work Mode, and Branch selectors - directly under input */}
                  <div className="mt-1.5 md:mt-2 ml-[5px] flex items-center gap-2">
                    <ProjectSelector />

                    {/* Work mode selector - between project and branch */}
                    {validatedProject && (
                      <WorkModeSelector
                        value={workMode}
                        onChange={setWorkMode}
                        disabled={createChatMutation.isPending}
                      />
                    )}

                    {/* Branch selector - only visible when worktree mode is selected */}
                    {validatedProject && workMode === "worktree" && (
                      <Popover
                        open={branchPopoverOpen}
                        onOpenChange={(open) => {
                          if (!open) {
                            setBranchSearch("") // Clear search on close
                          }
                          setBranchPopoverOpen(open)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                            disabled={branchesQuery.isLoading}
                          >
                            <BranchIcon className="w-4 h-4" />
                            <span className="truncate max-w-[100px]">
                              {selectedBranch ||
                                branchesQuery.data?.defaultBranch ||
                                "main"}
                            </span>
                            <IconChevronDown className="w-3 h-3 opacity-50" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          {/* Search input with Create button */}
                          <div className="flex items-center gap-1.5 h-7 px-1.5 mx-1 my-1 rounded-md bg-muted/50">
                            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder="Search branches..."
                              value={branchSearch}
                              onChange={(e) => setBranchSearch(e.target.value)}
                              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 flex items-center gap-1 text-xs shrink-0"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setCreateBranchDialogOpen(true)
                                setBranchPopoverOpen(false)
                              }}
                            >
                              <Plus className="h-3 w-3" />
                              Create
                            </Button>
                          </div>

                          {/* Virtualized branch list */}
                          {filteredBranches.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              No branches found.
                            </div>
                          ) : (
                            <div
                              ref={branchListRef}
                              className="overflow-auto py-1 scrollbar-hide"
                              style={{
                                height: Math.min(
                                  filteredBranches.length * 32 + 8,
                                  300,
                                ),
                              }}
                            >
                              <div
                                style={{
                                  height: `${branchVirtualizer.getTotalSize()}px`,
                                  width: "100%",
                                  position: "relative",
                                }}
                              >
                                {branchVirtualizer
                                  .getVirtualItems()
                                  .map((virtualItem) => {
                                    const branch =
                                      filteredBranches[virtualItem.index]
                                    const isSelected =
                                      selectedBranch === branch.name ||
                                      (!selectedBranch && branch.isDefault)
                                    return (
                                      <button
                                        key={branch.name}
                                        onClick={() => {
                                          setSelectedBranch(branch.name)
                                          setBranchPopoverOpen(false)
                                          setBranchSearch("")
                                        }}
                                        className={cn(
                                          "flex items-center gap-1.5 w-[calc(100%-8px)] mx-1 px-1.5 text-sm text-left absolute left-0 top-0 rounded-md cursor-default select-none outline-none transition-colors",
                                          isSelected
                                            ? "dark:bg-neutral-800 text-foreground"
                                            : "dark:hover:bg-neutral-800 hover:text-foreground",
                                        )}
                                        style={{
                                          height: `${virtualItem.size}px`,
                                          transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                      >
                                        <BranchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1">
                                          {branch.name}
                                        </span>
                                        {branch.committedAt && (
                                          <span className="text-xs text-muted-foreground/70 shrink-0">
                                            {formatRelativeTime(
                                              branch.committedAt,
                                            )}
                                          </span>
                                        )}
                                        {branch.isDefault && (
                                          <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded shrink-0">
                                            default
                                          </span>
                                        )}
                                        {isSelected && (
                                          <CheckIcon className="h-4 w-4 shrink-0 ml-auto" />
                                        )}
                                      </button>
                                    )
                                  })}
                              </div>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    )}

                    {/* Create Branch Dialog */}
                    {validatedProject && (
                      <CreateBranchDialog
                        open={createBranchDialogOpen}
                        onOpenChange={setCreateBranchDialogOpen}
                        projectPath={validatedProject.path}
                        branches={branches}
                        defaultBranch={
                          branchesQuery.data?.defaultBranch || "main"
                        }
                        onBranchCreated={(branchName) => {
                          setSelectedBranch(branchName)
                        }}
                      />
                    )}
                  </div>

                  {/* File mention dropdown */}
                  {/* Desktop: use projectPath for local file search */}
                  <AgentsFileMention
                    isOpen={showMentionDropdown && !!validatedProject}
                    onClose={() => setShowMentionDropdown(false)}
                    onSelect={handleMentionSelect}
                    searchText={mentionSearchText}
                    position={mentionPosition}
                    projectPath={validatedProject?.path}
                  />

                  {/* Slash command dropdown */}
                  <AgentsSlashCommand
                    isOpen={showSlashDropdown}
                    onClose={handleCloseSlashTrigger}
                    onSelect={handleSlashSelect}
                    searchText={slashSearchText}
                    position={slashPosition}
                    teamId={selectedTeamId || undefined}
                    repository={(resolvedRepo as any)?.full_name}
                    isPlanMode={isPlanMode}
                    disabledCommands={["clear"]}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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
          if (!selectedProject || agents.length === 0) return

          try {
            // 1. Create the parent chat
            const firstAgent = agents[0]
            const chat = await trpcClient.chats.create.mutate({
              projectId: selectedProject.id,
              name: "Multi-Agent Run",
              initialMessage: undefined,
              mode: isPlanMode ? "plan" : "build",
            })

            const activeAgents: Array<{
              id: string
              subChatId: string
              prompt: string
              model: string
            }> = []

            // The first sub-chat is already created by createChat (empty)
            if (chat.subChats && chat.subChats.length > 0) {
              const firstSubChat = chat.subChats[0]
              activeAgents.push({
                id: firstAgent.id,
                subChatId: firstSubChat.id,
                prompt: firstAgent.prompt,
                model: firstAgent.model
              })
            }

            // 2. Create the rest of the sub-chats
            for (let i = 1; i < agents.length; i++) {
              const agent = agents[i]
              const subChat = await trpcClient.chats.createSubChat.mutate({
                chatId: chat.id,
                name: `Agent ${i + 1}`,
                mode: isPlanMode ? "plan" : "build",
              })
              activeAgents.push({
                id: agent.id,
                subChatId: subChat.id,
                prompt: agent.prompt,
                model: agent.model
              })
            }

            // 3. Set the pending state so ActiveChat can trigger execution
            setPendingMultiAgentRun({
              chatId: chat.id,
              agents: activeAgents
            })

            // 4. Manual Redirect after everything is set
            setSelectedChatId(chat.id)

          } catch (error) {
            console.error("Failed to start multi-agent run:", error)
            toast.error("Failed to start multi-agent run")
          }
        }}
      />
    </>
  )
}
