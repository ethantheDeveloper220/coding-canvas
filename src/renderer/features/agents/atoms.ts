import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// Re-export from atoms/index.ts for backwards compatibility
export * from "./atoms/index"

// ============================================================
// Agent State Management
// ============================================================

/** Current sub-chat being viewed */
export const activeSubChatIdAtom = atom<string | null>(null)

/** Whether sub-chats sidebar is open */
export const isSubChatsSidebarOpenAtom = atom(false)

/** Agent chat store for session management */
// Note: This is a placeholder - actual implementation would use a proper store
export const agentChatStore = {
  sessions: new Map<string, { mode: string; model: string }>(),
  activeSubChatId: null as string | null,
}

// ============================================================
// Browser Preview
// ============================================================

/** Browser preview URL per chat */
export const browserPreviewUrlAtomFamily = (chatId: string) =>
  atomWithStorage<string>(`browser-preview-url-${chatId}`, "http://localhost:3000")

/** Preview path per chat */
export const previewPathAtomFamily = (chatId: string) =>
  atom<string>("")

// ============================================================
// Diff View State
// ============================================================

/** Agents diff sidebar open/close state */
export const agentsDiffSidebarOpenAtom = atom(false)

/** Currently focused diff file (for editor preview) */
export const agentsFocusedDiffFileAtom = atom<string | null>(null)

/** Filter state for diff files */
export const filteredDiffFilesAtom = atom<string | null>(null)

// ============================================================
// Preview Sidebar State
// ============================================================

/** Width of agents preview sidebar */
export const agentsPreviewSidebarWidthAtom = atom(500)

// ============================================================
// Sub-Chat State
// ============================================================

/** Selected sub-chat ID */
export const selectedAgentChatIdAtom = atom<string | null>(null)

/** Sub-chat model overrides */
export const subChatModelOverrides = new Map<string, string>()

// ============================================================
// File & Content State
// ============================================================

/** File contents cache for diff view */
export const agentFileContentsAtom = atom<Record<string, string>>({})

// ============================================================
// UI State
// ============================================================

/** Mobile fullscreen state */
export const isMobileFullscreenAtom = atom(false)

/** Pending auth retry state */
export const pendingAuthRetryMessageAtom = atom<{
  subChatId: string
  prompt: string
  readyToRetry: boolean
  images?: Array<{ base64Data: string; mediaType: string; filename: string }>
} | null>(null)

// ============================================================
// Diff View Mode
// ============================================================

/** Diff view mode */
export const diffViewModeAtom = atom<"unified" | "split">("unified")

/** Whether to split unified diffs by file */
export const splitUnifiedDiffByFileAtom = atom(false)

// ============================================================
// Unseen Changes
// ============================================================

/** Sub-chats with unseen changes */
export const subChatUnseenChangesAtom = atom<Set<string>>(new Set<string>())

// ============================================================
// Auth & API
// ============================================================

/** Authenticated user */
export const currentUserAtom = atom<{
  id: string
  email: string
  name: string | null
  imageUrl: string | null
  username: string | null
} | null>(null)
