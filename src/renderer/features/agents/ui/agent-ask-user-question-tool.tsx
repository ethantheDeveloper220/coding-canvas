"use client"

import { Check, Clock, X } from "lucide-react"
import { memo } from "react"
import { cn } from "../../../lib/utils"
import { QUESTIONS_SKIPPED_MESSAGE, QUESTIONS_TIMED_OUT_MESSAGE } from "../atoms"

interface AgentAskUserQuestionToolProps {
  input: {
    questions?: Array<{
      question: string
      header: string
      options: Array<{ label: string; description: string }>
      multiSelect: boolean
    }>
  }
  result?:
    | {
        questions?: unknown
        answers?: Record<string, string>
      }
    | string
  errorText?: string
  state: "call" | "result"
  isError?: boolean
}

export const AgentAskUserQuestionTool = memo(function AgentAskUserQuestionTool({
  input,
  result,
  errorText,
  state,
  isError,
}: AgentAskUserQuestionToolProps) {
  const questionCount = input?.questions?.length ?? 0

  // Determine status
  // For errors, SDK stores errorText separately - use it to detect skip/timeout
  const effectiveErrorText = errorText || (typeof result === "string" ? result : undefined)

  let status: "pending" | "completed" | "skipped" | "error" = "pending"
  let statusText = "Waiting for response..."

  if (state === "result") {
    // Check for skip/timeout first (SDK marks denied tools as errors)
    const isSkipped = effectiveErrorText === QUESTIONS_SKIPPED_MESSAGE
    const isTimedOut = effectiveErrorText === QUESTIONS_TIMED_OUT_MESSAGE
    if (isSkipped || isTimedOut) {
      status = "skipped"
      statusText = isTimedOut ? "Timed out" : "Skipped"
    } else if (isError) {
      status = "error"
      statusText = effectiveErrorText || "Error"
    } else if (result && typeof result === "object" && "answers" in result) {
      status = "completed"
      const answerCount = Object.keys(result.answers || {}).length
      statusText = `${answerCount} answer${answerCount !== 1 ? "s" : ""} provided`
    } else {
      status = "completed"
      statusText = "Completed"
    }
  }

  const StatusIcon = {
    pending: Clock,
    completed: Check,
    skipped: X,
    error: X,
  }[status]

  const statusColor = {
    pending: "text-yellow-500",
    completed: "text-green-500",
    skipped: "text-muted-foreground",
    error: "text-red-500",
  }[status]

  // Show loading state if no questions yet
  if (questionCount === 0 && state === "call") {
    return (
      <div className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground">
        <span>Generating questions...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground">
      <span className="text-muted-foreground">
        Asking {questionCount} question{questionCount !== 1 ? "s" : ""}
      </span>
      <span className="text-muted-foreground/50">•</span>
      <div className={cn("flex items-center gap-1")}>
        <span>{statusText}</span>
      </div>
    </div>
  )
})
