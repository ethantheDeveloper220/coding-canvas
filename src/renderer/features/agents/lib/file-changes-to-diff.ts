import type { ParsedDiffFile } from "../ui/agent-diff-view"

/**
 * Convert database FileChange records to unified diff format
 * This generates diff text from oldContent and newContent stored in the database
 */
export function generateUnifiedDiffFromFileChange(
  filePath: string,
  oldContent: string | null,
  newContent: string | null,
  operationType: string,
): string {
  const oldLines = (oldContent || "").split("\n")
  const newLines = (newContent || "").split("\n")

  // Generate unified diff header
  const header = `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}\n`

  // Calculate diff hunks
  let diffLines: string[] = []
  
  if (operationType === "delete") {
    // File was deleted
    diffLines.push(`@@ -1,${oldLines.length} +0,0 @@`)
    for (const line of oldLines) {
      diffLines.push(`-${line}`)
    }
  } else if (operationType === "create" || !oldContent) {
    // File was created
    diffLines.push(`@@ -0,0 +1,${newLines.length} @@`)
    for (const line of newLines) {
      diffLines.push(`+${line}`)
    }
  } else {
    // File was updated - generate simple diff
    const maxLen = Math.max(oldLines.length, newLines.length)
    let hunkStart = 1
    let inHunk = false

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i]
      const newLine = newLines[i]

      if (oldLine !== newLine) {
        if (!inHunk) {
          // Start a new hunk
          const remainingOld = oldLines.length - i
          const remainingNew = newLines.length - i
          diffLines.push(`@@ -${i + 1},${remainingOld} +${i + 1},${remainingNew} @@`)
          inHunk = true
        }
        if (oldLine !== undefined) diffLines.push(`-${oldLine}`)
        if (newLine !== undefined) diffLines.push(`+${newLine}`)
      } else if (inHunk) {
        // Context line
        if (oldLine !== undefined) diffLines.push(` ${oldLine}`)
      }
    }
  }

  return header + diffLines.join("\n") + "\n"
}

/**
 * Convert database FileChange records to ParsedDiffFile format
 */
export function fileChangesToParsedDiff(
  changes: Array<{
    id: string
    filePath: string
    oldFilePath?: string | null
    oldContent?: string | null
    newContent?: string | null
    operationType: string
    timestamp: Date | null
  }>,
): ParsedDiffFile[] {
  // Group changes by file path (latest change per file)
  const fileMap = new Map<string, typeof changes[0]>()

  for (const change of changes) {
    const key = change.oldFilePath && change.operationType === "rename" 
      ? change.oldFilePath 
      : change.filePath
    
    const existing = fileMap.get(change.filePath)
    if (!existing || (change.timestamp && existing.timestamp && change.timestamp > existing.timestamp)) {
      fileMap.set(change.filePath, change)
    }
  }

  const result: ParsedDiffFile[] = []

  for (const change of fileMap.values()) {
    const oldContent = change.oldContent || ""
    const newContent = change.newContent || ""
    
    // Skip if no actual change
    if (change.operationType !== "delete" && change.operationType !== "create" && oldContent === newContent) {
      continue
    }

    const oldLines = oldContent.split("\n")
    const newLines = newContent.split("\n")

    // Calculate additions and deletions
    let additions = 0
    let deletions = 0

    if (change.operationType === "delete") {
      deletions = oldLines.length
    } else if (change.operationType === "create") {
      additions = newLines.length
    } else {
      // For updates, count differences
      const maxLen = Math.max(oldLines.length, newLines.length)
      for (let i = 0; i < maxLen; i++) {
        const oldLine = oldLines[i]
        const newLine = newLines[i]
        if (oldLine !== newLine) {
          if (oldLine !== undefined) deletions++
          if (newLine !== undefined) additions++
        }
      }
    }

    const diffText = generateUnifiedDiffFromFileChange(
      change.filePath,
      change.oldContent || null,
      change.newContent || null,
      change.operationType,
    )

    result.push({
      key: `tracked-${change.id}`,
      oldPath: change.operationType === "delete" ? change.filePath : (change.oldFilePath || change.filePath),
      newPath: change.operationType === "delete" ? "/dev/null" : change.filePath,
      diffText,
      isBinary: false,
      additions,
      deletions,
      isValid: true,
    })
  }

  return result
}
