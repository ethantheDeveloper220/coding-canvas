import { eq } from 'drizzle-orm'
import { getDatabase } from './index'
import { chats, subChats, projects, fileChanges } from './schema'
import type { NewFileChange } from './schema'

interface MessagePart {
  type: string
  input?: {
    file_path?: string
    path?: string
    old_string?: string
    new_string?: string
    content?: string
    move_path?: string
  }
}

interface Message {
  role: string
  parts?: MessagePart[]
}

/**
 * Check if a file path is a session/plan file that should be excluded from tracking
 */
function isSessionFile(filePath: string): boolean {
  if (filePath.includes('claude-sessions')) return true
  if (filePath.includes('Application Support')) return true
  return false
}

/**
 * Extract file changes from messages and track them in the database
 * This should be called whenever messages are saved/updated
 */
export async function trackFileChangesFromMessages(
  chatId: string,
  subChatId: string,
  messages: Message[],
  sessionId?: string,
): Promise<void> {
  const db = getDatabase()

  // Get chat and project info
  const chat = db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .get()

  if (!chat) {
    console.warn(`[trackFileChanges] Chat ${chatId} not found`)
    return
  }

  const projectId = chat.projectId
  const worktreePath = chat.worktreePath || undefined

  // Track file states to calculate net changes
  const fileStates = new Map<
    string,
    {
      originalContent: string | null
      currentContent: string
      operationType: 'create' | 'update' | 'delete' | 'rename'
      oldFilePath?: string
      source?: string
    }
  >()

  // Process messages to build file state map
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue

    for (const part of msg.parts || []) {
      const filePath = part.input?.file_path || part.input?.path
      if (!filePath || isSessionFile(filePath)) continue

      let operationSource = 'tool-edit' // Default source

      // Handle Write tool (create/update)
      if (part.type === 'tool-Write') {
        operationSource = 'tool-write'
        const content = part.input?.content || ''
        const existing = fileStates.get(filePath)

        if (existing) {
          // File already exists in this batch - update it
          existing.currentContent = content
          existing.operationType = 'update'
          existing.source = operationSource
        } else {
          // First time seeing this file
          fileStates.set(filePath, {
            originalContent: null, // Write means new file
            currentContent: content,
            operationType: 'create',
            source: operationSource,
          })
        }
      }
      // Handle Edit tool (update)
      else if (part.type === 'tool-Edit') {
        operationSource = 'tool-edit'
        const oldString = part.input?.old_string || ''
        const newString = part.input?.new_string || ''
        const existing = fileStates.get(filePath)

        if (existing) {
          // Update existing state
          existing.currentContent = newString
          // Preserve original content if this is first edit
          if (existing.originalContent === null && oldString) {
            existing.originalContent = oldString
          }
          existing.operationType = 'update'
          existing.source = operationSource
        } else {
          // First time seeing this file
          fileStates.set(filePath, {
            originalContent: oldString,
            currentContent: newString,
            operationType: 'update',
            source: operationSource,
          })
        }
      }
      // Handle Patch tool changes (check for add/update/delete/move)
      else if (part.type === 'tool-Patch' && part.input) {
        // Patch can contain multiple file changes
        // For now, we'll track them at a high level
        // Detailed patch parsing would require parsing the patch format
        // This is a placeholder - patches are complex and may need special handling
        console.log('[trackFileChanges] Patch tool detected, may need special handling')
      }
    }
  }

  // Insert file changes into database
  const changesToInsert: NewFileChange[] = []

  for (const [filePath, state] of fileStates) {
    // Skip if file returned to original state (net change = 0)
    const originalContent = state.originalContent || ''
    if (state.operationType !== 'delete' && originalContent === state.currentContent) {
      continue
    }

    changesToInsert.push({
      chatId,
      subChatId,
      projectId,
      operationType: state.operationType,
      filePath,
      oldFilePath: state.oldFilePath || undefined,
      oldContent: state.originalContent || undefined,
      newContent: state.operationType !== 'delete' ? state.currentContent : undefined,
      worktreePath,
      source: state.source || 'tool-edit',
      sessionId: sessionId || undefined,
      timestamp: new Date(),
    })
  }

  // Batch insert changes
  if (changesToInsert.length > 0) {
    try {
      db.insert(fileChanges)
        .values(changesToInsert)
        .run()

      console.log(`[trackFileChanges] Tracked ${changesToInsert.length} file changes for chat ${chatId}`)
    } catch (error) {
      console.error('[trackFileChanges] Error inserting file changes:', error)
    }
  }
}

/**
 * Track a single file change operation directly
 * Useful for manual file operations or real-time tracking
 */
export async function trackFileChange(change: Omit<NewFileChange, 'id' | 'timestamp'> & { timestamp?: Date }): Promise<void> {
  const db = getDatabase()

  try {
    db.insert(fileChanges)
      .values({
        ...change,
        timestamp: change.timestamp || new Date(),
      })
      .run()
  } catch (error) {
    console.error('[trackFileChange] Error inserting file change:', error)
  }
}
