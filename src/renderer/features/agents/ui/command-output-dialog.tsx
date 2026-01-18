"use client"

import { memo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { Copy, Check } from "lucide-react"
import { cn } from "../../../lib/utils"

interface CommandOutputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  command: string
  stdout: string
  stderr: string
  exitCode?: number
}

export const CommandOutputDialog = memo(function CommandOutputDialog({
  open,
  onOpenChange,
  command,
  stdout,
  stderr,
  exitCode,
}: CommandOutputDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fullOutput = [stdout, stderr].filter(Boolean).join("\n")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Command Output</DialogTitle>
          <DialogDescription>
            Full output for the executed command
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
          {/* Command */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Command:</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handleCopy(command)}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="rounded-md bg-muted p-3 font-mono text-sm">
              <span className="text-amber-600 dark:text-amber-400">$ </span>
              <span className="text-foreground break-all">{command}</span>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <span className="text-sm font-medium">Output:</span>
              {fullOutput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleCopy(fullOutput)}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy All
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto rounded-md bg-background border border-border p-3">
              {/* Stdout */}
              {stdout && (
                <div className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">
                  {stdout}
                </div>
              )}

              {/* Stderr */}
              {stderr && (
                <div
                  className={cn(
                    "font-mono text-xs whitespace-pre-wrap break-all mt-2",
                    exitCode === 0 || exitCode === undefined
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-500 dark:text-rose-400",
                  )}
                >
                  {stderr}
                </div>
              )}

              {!stdout && !stderr && (
                <div className="text-sm text-muted-foreground italic">
                  No output available
                </div>
              )}
            </div>
          </div>

          {/* Exit Code */}
          {exitCode !== undefined && (
            <div className="flex-shrink-0 text-xs text-muted-foreground">
              Exit code: <span className="font-mono">{exitCode}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
