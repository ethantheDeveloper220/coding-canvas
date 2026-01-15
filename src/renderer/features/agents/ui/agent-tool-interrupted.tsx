"use client"

import { memo } from "react"
import { StopCircle } from "lucide-react"

interface AgentToolInterruptedProps {
  toolName: string
  subtitle?: string
}

export const AgentToolInterrupted = memo(function AgentToolInterrupted({
  toolName,
  subtitle,
}: AgentToolInterruptedProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-md py-0.5 px-2">
      <StopCircle className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
      <span className="text-xs text-muted-foreground">
        {toolName} interrupted
      </span>
      {subtitle && (
        <span className="text-xs text-muted-foreground/60 truncate">
          {subtitle}
        </span>
      )}
    </div>
  )
})
