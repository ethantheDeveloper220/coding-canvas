"use client"

import { Button } from "../../../components/ui/button"
import { ArrowUp } from "lucide-react"
import {
  EnterIcon,
} from "../../../components/ui/icons"
import { Kbd } from "../../../components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"
import { motion, AnimatePresence } from "motion/react"

interface AgentSendButtonProps {
  /** Whether the system is currently streaming */
  isStreaming?: boolean
  /** Whether the system is currently submitting/generating */
  isSubmitting?: boolean
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Main click handler */
  onClick: () => void
  /** Optional stop handler for streaming state */
  onStop?: () => void
  /** Additional CSS classes */
  className?: string
  /** Button size */
  size?: "sm" | "default" | "lg"
  /** Custom aria-label */
  ariaLabel?: string
  /** Whether this is plan mode (orange styling) */
  isPlanMode?: boolean
}

export function AgentSendButton({
  isStreaming = false,
  isSubmitting = false,
  disabled = false,
  onClick,
  onStop,
  className = "",
  size = "sm",
  ariaLabel,
  isPlanMode = false,
}: AgentSendButtonProps) {
  // Determine the actual click handler based on state
  const handleClick = () => {
    if (isStreaming && onStop) {
      onStop()
    } else {
      onClick()
    }
  }

  // Determine if button should be disabled
  const isDisabled = isStreaming ? false : disabled

  // Determine tooltip content
  const getTooltipContent = () => {
    if (isStreaming)
      return (
        <span className="flex items-center gap-1">
          Stop
          <Kbd className="ms-0.5">Esc</Kbd>
          <span className="text-muted-foreground/60">or</span>
          <Kbd className="-me-1">Ctrl C</Kbd>
        </span>
      )
    if (isSubmitting) return "Generating..."
    return (
      <span className="flex items-center">
        Send
        <Kbd className="-me-1 ms-1">
          <EnterIcon className="size-2.5 inline" />
        </Kbd>
      </span>
    )
  }

  // Determine aria-label
  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel
    if (isStreaming) return "Stop generation"
    if (isSubmitting) return "Generating..."
    return "Send message"
  }

  // Apply glow effect when button is active and ready to send
  const shouldShowGlow = !isStreaming && !isSubmitting && !disabled

  const glowClass = shouldShowGlow
    ? "shadow-[0_0_0_2px_white,0_0_0_4px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_2px_#1a1a1a,0_0_0_4px_rgba(255,255,255,0.08)]"
    : undefined

  // Mode-specific styling (agent=foreground, plan=orange)
  const modeClass = isPlanMode
    ? "!bg-plan-mode hover:!bg-plan-mode/90 !text-plan-mode-foreground !shadow-none"
    : "!bg-foreground hover:!bg-foreground/90 !text-background !shadow-none"

  return (
    <Tooltip delayDuration={1_000}>
      <TooltipTrigger asChild>
        <Button
          size={size}
          className={`h-7 w-7 rounded-full transition-[background-color,transform,opacity,box-shadow] duration-200 ease-out active:scale-[0.97] flex items-center justify-center overflow-hidden ${glowClass || ""} ${modeClass} ${className}`}
          disabled={isDisabled}
          type="button"
          onClick={handleClick}
          aria-label={getAriaLabel()}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isStreaming ? (
              <motion.div
                key="stop"
                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                transition={{ duration: 0.15 }}
              >
                <div className="w-2.5 h-2.5 bg-current rounded-[2px]" />
              </motion.div>
            ) : isSubmitting ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                {/* Cool glowing spinner ring */}
                <div className="relative w-4 h-4">
                  <motion.span
                    className="absolute inset-0 border-2 border-current/30 rounded-full"
                  />
                  <motion.span
                    className="absolute inset-0 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="send"
                initial={{ opacity: 0, scale: 0.5, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: -5 }}
                transition={{ duration: 0.15 }}
              >
                <ArrowUp className="size-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{getTooltipContent()}</TooltipContent>
    </Tooltip>
  )
}

