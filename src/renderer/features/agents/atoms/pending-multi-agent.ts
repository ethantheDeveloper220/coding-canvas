import { atom } from "jotai"

// Pending multi-agent run configuration
// Set by NewChatForm when starting a multi-agent run
// Consumed by ActiveChat to trigger auto-run
export interface PendingMultiAgentRun {
    chatId: string
    agents: Array<{
        id: string
        subChatId: string
        prompt: string
        model: string
    }>
}

export const pendingMultiAgentRunAtom = atom<PendingMultiAgentRun | null>(null)
