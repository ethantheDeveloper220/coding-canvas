"use client"

import { memo, useState, useMemo } from "react"
import { Check, X, Eye, TerminalSquare, Copy } from "lucide-react"
import { Button } from "../../../components/ui/button"
import {
  IconSpinner,
  ExpandIcon,
  CollapseIcon,
} from "../../../components/ui/icons"
import { cn } from "../../../lib/utils"
import type { Chat } from "@ai-sdk/react"

// Extract command summary - first word of each command in a pipeline
function extractCommandSummary(command: string): string {
  const parts = command.split(/\s*(?:&&|\|\||;|\|)\s*/)
  const firstWords = parts.map((p) => p.trim().split(/\s+/)[0]).filter(Boolean)
  // Limit to first 4 commands to keep it concise
  const limited = firstWords.slice(0, 4)
  if (firstWords.length > 4) {
    return limited.join(", ") + "..."
  }
  return limited.join(", ")
}

// Limit output to first N lines
function limitLines(text: string, maxLines: number): { text: string; truncated: boolean } {
  if (!text) return { text: "", truncated: false }
  const lines = text.split("\n")
  if (lines.length <= maxLines) {
    return { text, truncated: false }
  }
  return { text: lines.slice(0, maxLines).join("\n"), truncated: true }
}

interface BashCommand {
  command: string
  stdout: string
  stderr: string
  exitCode: number | undefined
  messageId: string
  timestamp?: number
  partIndex: number
}

interface AgentCommandHistoryProps {
  messages: Chat<any>["messages"]
  chatStatus?: string
  onExecuteInTerminal?: (command: string) => void
  onViewFullOutput?: (command: string, stdout: string, stderr: string, exitCode?: number) => void
}

export const AgentCommandHistory = memo(function AgentCommandHistory({
  messages,
  chatStatus,
  onExecuteInTerminal,
  onViewFullOutput,
}: AgentCommandHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedCommands, setExpandedCommands] = useState<Set<number>>(new Set())

  // Extract all bash commands from messages
  const bashCommands = useMemo(() => {
    const commands: BashCommand[] = []
    messages.forEach((msg: any) => {
      if (!msg.parts) return
      msg.parts.forEach((part: any, idx: number) => {
        if (part.type === "tool-Bash") {
          commands.push({
            command: part.input?.command || "",
            stdout: part.output?.stdout || part.output?.output || "",
            stderr: part.output?.stderr || "",
            exitCode: part.output?.exitCode ?? part.output?.exit_code,
            messageId: msg.id,
            timestamp: part.time?.start || msg.time?.start,
            partIndex: idx,
          })
        }
      })
    })
    return commands
  }, [messages])

  if (bashCommands.length === 0) {
    return null
  }

  const toggleCommandExpansion = (index: number) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleExecuteInTerminal = (command: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onExecuteInTerminal?.(command)
  }

  const handleViewFullOutput = (
    command: string,
    stdout: string,
    stderr: string,
    exitCode: number | undefined,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation()
    onViewFullOutput?.(command, stdout, stderr, exitCode)
  }

  const handleCopyCommand = (command: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(command)
  }

  return (
    <div className="border-b border-border bg-muted/30">
      {/* Header - collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Terminal Commands
          </span>
          <span className="text-xs text-muted-foreground">
            ({bashCommands.length})
          </span>
        </div>
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

      {/* Command List */}
      {isExpanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {bashCommands.map((cmd, index) => {
            const isCommandExpanded = expandedCommands.has(index)
            const isPending = !cmd.exitCode && cmd.exitCode !== 0 && chatStatus === "streaming"
            const isSuccess = cmd.exitCode === 0
            const isError = cmd.exitCode !== undefined && cmd.exitCode !== 0
            const hasOutput = cmd.stdout || cmd.stderr

            const commandSummary = extractCommandSummary(cmd.command)
            const stdoutLimited = limitLines(cmd.stdout, 2)
            const stderrLimited = limitLines(cmd.stderr, 2)
            const hasMoreOutput = stdoutLimited.truncated || stderrLimited.truncated

            return (
              <div
                key={`${cmd.messageId}-${cmd.partIndex}`}
                className="border-t border-border px-3 py-2 hover:bg-muted/30 transition-colors duration-150"
              >
                {/* Command Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-mono text-xs flex-1 min-w-0">
                        <span className="text-amber-600 dark:text-amber-400">$ </span>
                        <span className="text-foreground break-all">{cmd.command}</span>
                      </div>
                      {/* Status */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                        {isPending ? (
                          <IconSpinner className="w-3 h-3" />
                        ) : isSuccess ? (
                          <>
                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span>Success</span>
                          </>
                        ) : isError ? (
                          <>
                            <X className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                            <span>Failed</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 mt-1.5">
                      {hasOutput && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => toggleCommandExpansion(index)}
                        >
                          {isCommandExpanded ? (
                            <>
                              <CollapseIcon className="h-3 w-3 mr-1" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              View Output
                            </>
                          )}
                        </Button>
                      )}
                      {hasOutput && (hasMoreOutput || cmd.stdout.length > 100 || cmd.stderr.length > 100) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => handleViewFullOutput(cmd.command, cmd.stdout, cmd.stderr, cmd.exitCode, e)}
                        >
                          Full Output
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => handleExecuteInTerminal(cmd.command, e)}
                      >
                        <TerminalSquare className="h-3 w-3 mr-1" />
                        Execute in Terminal
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => handleCopyCommand(cmd.command, e)}
                        title="Copy command"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Output Preview - when expanded */}
                {isCommandExpanded && hasOutput && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    {cmd.stdout && (
                      <div className="mt-1.5 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
                        {cmd.stdout}
                      </div>
                    )}
                    {cmd.stderr && (
                      <div
                        className={cn(
                          "mt-1.5 font-mono text-xs whitespace-pre-wrap break-all",
                          cmd.exitCode === 0 || cmd.exitCode === undefined
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-500 dark:text-rose-400",
                        )}
                      >
                        {cmd.stderr}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
