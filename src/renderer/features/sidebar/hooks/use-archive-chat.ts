"use client"

import { useSetAtom } from "jotai"
import { api } from "../../../lib/mock-api"
import { selectedAgentChatIdAtom } from "../../../lib/atoms"

interface UseArchiveChatOptions {
  teamId: string | null
  selectedChatId: string | null
}

/**
 * Hook for archiving agent chats with proper navigation logic.
 * When a chat is archived, it selects the next available chat or opens new chat view.
 */
export function useArchiveChat({
  teamId,
  selectedChatId,
}: UseArchiveChatOptions) {
  const setSelectedChatId = useSetAtom(selectedAgentChatIdAtom)
  const utils = api.useUtils()

  const archiveChatMutation = api.agents.archiveChat.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await utils.agents.getAgentChats.cancel()
      await utils.agents.getArchivedChats.cancel()

      // Snapshot the previous values
      const previousActiveChats = utils.agents.getAgentChats.getData({
        teamId: teamId!,
      })
      const previousArchivedChats = utils.agents.getArchivedChats.getData({
        teamId: teamId!,
      })

      // Optimistically update: remove chat from active list
      if (previousActiveChats) {
        const archivedChat = previousActiveChats.find(
          (c) => c.id === variables.chatId,
        )
        if (archivedChat) {
          // Remove from active list
          utils.agents.getAgentChats.setData(
            { teamId: teamId! },
            previousActiveChats.filter((c) => c.id !== variables.chatId),
          )

          // Add to archived list
          const updatedChat = { ...archivedChat, archived_at: new Date() }
          utils.agents.getArchivedChats.setData({ teamId: teamId! }, [
            updatedChat,
            ...(previousArchivedChats || []),
          ])
        }
      }

      // If archived chat was selected, select the next available chat
      if (selectedChatId === variables.chatId) {
        const remainingChats = previousActiveChats?.filter(
          (c) => c.id !== variables.chatId,
        )
        const nextChat = remainingChats?.[0] // First chat is the most recent
        setSelectedChatId(nextChat?.id || null)
      }

      return { previousActiveChats, previousArchivedChats }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousActiveChats) {
        utils.agents.getAgentChats.setData(
          { teamId: teamId! },
          context.previousActiveChats,
        )
      }
      if (context?.previousArchivedChats) {
        utils.agents.getArchivedChats.setData(
          { teamId: teamId! },
          context.previousArchivedChats,
        )
      }
    },
    onSettled: () => {
      // No invalidate - optimistic update handles it
    },
  })

  return archiveChatMutation
}
