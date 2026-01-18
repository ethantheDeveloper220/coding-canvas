"use client"

import { Timeline } from "@/components/ui/timeline"
import { WisdomSection } from "@/components/ui/wisdom-section"
import { Button } from "@/components/ui/button"
import { IconCloseSidebarRight } from "@/components/ui/icons"
import { trpc } from "@/lib/trpc"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { useAtomValue } from "jotai"
import { fullThemeDataAtom } from "@/lib/atoms"
import type { CardType } from "@/components/ui/kanban"
import { cn } from "@/lib/utils"

interface KanbanPanelProps {
  chatId: string
  onClose: () => void
}

function getDefaultRoadmapBg(isDark = true): string {
  return isDark ? "#121212" : "#fafafa"
}

export function KanbanPanel({ chatId, onClose }: KanbanPanelProps) {
  const { resolvedTheme } = useTheme()
  const fullThemeData = useAtomValue(fullThemeDataAtom)
  const [isWisdomExpanded, setIsWisdomExpanded] = useState(false)

  // Theme-aware background color calculation
  const roadmapBg = useMemo(() => {
    const isDark = resolvedTheme === "dark"
    // Use VS Code theme terminal background if available
    if (fullThemeData?.colors?.["terminal.background"]) {
      return fullThemeData.colors["terminal.background"]
    }
    if (fullThemeData?.colors?.["editor.background"]) {
      return fullThemeData.colors["editor.background"]
    }
    return getDefaultRoadmapBg(isDark)
  }, [resolvedTheme, fullThemeData])

  // Fetch roadmap tasks from database
  const { data: cards, isLoading } = trpc.chats.getRoadmapTasks.useQuery(
    { chatId },
    { enabled: !!chatId }
  )

  // Save cards to database
  const saveMutation = trpc.chats.saveRoadmapTasks.useMutation({
    onError: (error) => {
      toast.error(`Failed to save roadmap: ${error.message}`)
    },
  })

  const handleCardsChange = useCallback((newCards: CardType[]) => {
    if (!chatId) return
    
    saveMutation.mutate({
      chatId,
      tasks: newCards,
    })
  }, [chatId, saveMutation])

  // Calculate stats for wisdom section
  const stats = useMemo(() => {
    if (!cards) return null
    const total = cards.length
    const byStatus = {
      backlog: cards.filter(c => c.column === "backlog").length,
      todo: cards.filter(c => c.column === "todo").length,
      doing: cards.filter(c => c.column === "doing").length,
      done: cards.filter(c => c.column === "done").length,
    }
    const completed = byStatus.done
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      total,
      ...byStatus,
      completed,
      percentage,
    }
  }, [cards])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: roadmapBg }}>
        <div
          className="flex items-center justify-between border-b flex-shrink-0"
          style={{ 
            backgroundColor: roadmapBg,
            borderBottomColor: fullThemeData?.colors?.["editorWidget.border"] || "rgba(255, 255, 255, 0.1)"
          }}
        >
          <div className="flex items-center gap-1 pl-1 pr-2 py-1.5">
            <h3 className="text-sm font-medium text-foreground">Roadmap & Tasks</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground flex-shrink-0 rounded-md"
          >
            <IconCloseSidebarRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading roadmap...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col min-w-0 overflow-hidden" style={{ backgroundColor: roadmapBg }}>
      {/* Header */}
      <div
        className="flex items-center justify-between border-b flex-shrink-0"
        style={{ 
          backgroundColor: roadmapBg,
          borderBottomColor: fullThemeData?.colors?.["editorWidget.border"] || "rgba(255, 255, 255, 0.1)"
        }}
      >
        <div className="flex items-center gap-1 pl-1 pr-2 py-1.5">
          <h3 className="text-sm font-medium text-foreground">Roadmap & Tasks</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] text-foreground flex-shrink-0 rounded-md"
          aria-label="Close roadmap"
        >
          <IconCloseSidebarRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Wisdom Section */}
      <WisdomSection
        isExpanded={isWisdomExpanded}
        onToggle={() => setIsWisdomExpanded(!isWisdomExpanded)}
        stats={stats}
        cards={cards || []}
        themeBg={roadmapBg}
      />

      {/* Timeline Content */}
      <div className="flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: roadmapBg }}>
        <Timeline cards={cards || []} onCardsChange={handleCardsChange} />
      </div>
    </div>
  )
}
