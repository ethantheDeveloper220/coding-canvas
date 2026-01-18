import { useEffect } from "react"

/**
 * Hook to listen for file changes from Claude Write/Edit tools
 * This triggers refetch of git status when files are modified
 */
export function useFileChangeListener(worktreePath?: string) {
  useEffect(() => {
    if (!worktreePath) return

    const cleanup = window.desktopApi?.onFileChanged((data) => {
      console.log("[useFileChangeListener] File changed:", data)
      // The file-changed event will trigger refetch in components that use getStatus query
      // with placeholderData to maintain smooth UI
    })

    return cleanup
  }, [worktreePath])
}
