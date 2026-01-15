import React, { useMemo } from "react"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../../../components/ui/context-menu"
import { Kbd } from "../../../components/ui/kbd"
import { isMac } from "../../../lib/utils"
import type { SubChatMeta } from "../stores/sub-chat-store"
import { getShortcutKey } from "../../../lib/utils/platform"

// Platform-aware keyboard shortcut
// Web: ⌥⌘W (browser uses Cmd+W to close tab)
// Desktop: ⌘W
const useCloseTabShortcut = () => {
  return useMemo(() => {
    if (!isMac) return "Alt+Ctrl+W"
    return getShortcutKey("closeTab")
  }, [])
}

interface SubChatContextMenuProps {
  subChat: SubChatMeta
  isPinned: boolean
  onTogglePin: (subChatId: string) => void
  onRename: (subChat: SubChatMeta) => void
  onArchive: (subChatId: string) => void
  onArchiveOthers: (subChatId: string) => void
  onArchiveAllBelow?: (subChatId: string) => void
  isOnlyChat: boolean
  currentIndex?: number
  totalCount?: number
  showCloseTabOptions?: boolean
  onCloseTab?: (subChatId: string) => void
  onCloseOtherTabs?: (subChatId: string) => void
  onCloseTabsToRight?: (subChatId: string, visualIndex: number) => void
  visualIndex?: number
  hasTabsToRight?: boolean
  canCloseOtherTabs?: boolean
}

export function SubChatContextMenu({
  subChat,
  isPinned,
  onTogglePin,
  onRename,
  onArchive,
  onArchiveOthers,
  onArchiveAllBelow,
  isOnlyChat,
  currentIndex,
  totalCount,
  showCloseTabOptions = false,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  visualIndex = 0,
  hasTabsToRight = false,
  canCloseOtherTabs = false,
}: SubChatContextMenuProps) {
  const closeTabShortcut = useCloseTabShortcut()

  return (
    <ContextMenuContent className="w-48">
      <ContextMenuItem onClick={() => onTogglePin(subChat.id)}>
        {isPinned ? "Unpin agent" : "Pin agent"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => onRename(subChat)}>
        Rename agent
      </ContextMenuItem>
      <ContextMenuSeparator />

      {showCloseTabOptions ? (
        <>
          <ContextMenuItem
            onClick={() => onCloseTab?.(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            Close tab
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseOtherTabs?.(subChat.id)}
            disabled={!canCloseOtherTabs}
          >
            Close other tabs
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onCloseTabsToRight?.(subChat.id, visualIndex)}
            disabled={!hasTabsToRight}
          >
            Close tabs to the right
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem
            onClick={() => onArchive(subChat.id)}
            className="justify-between"
            disabled={isOnlyChat}
          >
            Archive agent
            {!isOnlyChat && <Kbd>{closeTabShortcut}</Kbd>}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveAllBelow?.(subChat.id)}
            disabled={
              currentIndex === undefined ||
              currentIndex >= (totalCount || 0) - 1
            }
          >
            Archive agents below
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onArchiveOthers(subChat.id)}
            disabled={isOnlyChat}
          >
            Archive other agents
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}
