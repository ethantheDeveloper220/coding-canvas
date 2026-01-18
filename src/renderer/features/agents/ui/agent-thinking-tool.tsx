"use client"

import { memo, useState, useEffect, useRef } from "react"
import { ChevronRight, Brain, Lightbulb, Sparkles } from "lucide-react"
import { cn } from "../../../lib/utils"
import { ChatMarkdownRenderer } from "../../../components/chat-markdown-renderer"
import { AgentToolInterrupted } from "./agent-tool-interrupted"

interface ThinkingToolPart {
  type: string
  state: string
  input?: {
    text?: string
  }
  output?: {
    completed?: boolean
  }
}

interface AgentThinkingToolProps {
  part: ThinkingToolPart
  chatStatus?: string
}

// Constants for thinking preview and scrolling
const PREVIEW_LENGTH = 60
const SCROLL_THRESHOLD = 500

export const AgentThinkingTool = memo(function AgentThinkingTool({
  part,
  chatStatus,
}: AgentThinkingToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error"
  const isStreaming = isPending && chatStatus === "streaming"
  const isInterrupted = isPending && chatStatus !== "streaming" && chatStatus !== undefined

  // Default: expanded while streaming, collapsed when done
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const wasStreamingRef = useRef(isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-collapse when streaming ends (transition from true -> false)
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming) {
      setIsExpanded(false)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [part.input?.text, isStreaming, isExpanded])

  // Get thinking text
  const thinkingText = part.input?.text || ""

  // Build preview for collapsed state
  const previewText = thinkingText.slice(0, PREVIEW_LENGTH).replace(/\n/g, " ")

  // Show interrupted state if thinking was interrupted without completing
  if (isInterrupted && !thinkingText) {
    return <AgentToolInterrupted toolName="Thinking" />
  }

  return (
    <div className="relative my-1">
      {/* Main container with border - using theme colors */}
      <div
        className={cn(
          "relative rounded-lg border transition-all duration-300 overflow-hidden",
          "bg-muted/40",
          isStreaming
            ? "border-foreground/20 shadow-sm"
            : "border-border hover:border-border/80",
          isExpanded && "border-foreground/15"
        )}
      >
        {/* Header - clickable to toggle */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "group flex items-start gap-2 py-2 px-3 cursor-pointer relative",
            "transition-all duration-200"
          )}
        >
          {/* Icon container */}
          <div className="flex-shrink-0 mt-0.5">
            <div
              className={cn(
                "flex items-center justify-center w-6 h-6 rounded-md transition-all duration-300",
                isStreaming
                  ? "bg-foreground/10 text-foreground/70"
                  : isExpanded
                    ? "bg-foreground/10 text-foreground/70"
                    : "bg-muted text-muted-foreground group-hover:bg-muted/80"
              )}
            >
              {isStreaming ? (
                <Brain className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform duration-300" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform duration-300" />
              )}
            </div>
          </div>

          {/* Header content */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Title with icon */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Sparkles
                  className="w-3 h-3 text-muted-foreground"
                />
                <span
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {isStreaming ? "Thinking" : "Thought"}
                </span>
              </div>

              {/* Preview text when collapsed */}
              {!isExpanded && previewText && (
                <span className="text-xs text-muted-foreground/70 truncate">
                  {previewText}...
                </span>
              )}
            </div>

            {/* Chevron - rotates when expanded */}
            <ChevronRight
              className={cn(
                "w-4 h-4 text-muted-foreground/50 transition-transform duration-300 ease-out flex-shrink-0 ml-auto",
                isExpanded && "rotate-90",
                !isExpanded && "group-hover:text-muted-foreground"
              )}
            />
          </div>
        </div>

        {/* Thinking content - only show when expanded */}
        {isExpanded && thinkingText && (
          <div className="relative">
            {/* Divider */}
            <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Content container */}
            <div
              ref={scrollRef}
              className={cn(
                "px-3 py-2.5 max-h-80 overflow-y-auto",
                "scrollbar-thin scrollbar-thumb-border/30 scrollbar-track-transparent",
                "transition-all duration-300"
              )}
            >
              {/* Top gradient fade when streaming and has lots of content */}
              {isStreaming && thinkingText.length > SCROLL_THRESHOLD && (
                <div className="sticky top-0 left-0 right-0 h-4 bg-gradient-to-b from-background/90 to-transparent z-10 pointer-events-none" />
              )}

              {/* Markdown content */}
              <div className="relative">
                <ChatMarkdownRenderer
                  content={thinkingText}
                  size="sm"
                  className="text-sm text-foreground/90 leading-relaxed"
                />
                {/* Blinking cursor when streaming - using theme color */}
                {isStreaming && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: 'light-dark(hsl(var(--foreground) / 0.5), hsl(var(--foreground) / 0.3))' }}
                  />
                )}
              </div>

              {/* Bottom gradient fade when streaming and has lots of content */}
              {isStreaming && thinkingText.length > SCROLL_THRESHOLD && (
                <div className="sticky bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background/90 to-transparent z-10 pointer-events-none mt-2" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
