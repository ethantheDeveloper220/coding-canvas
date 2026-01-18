import { eq, and } from 'drizzle-orm'
import { getDatabase } from './db'
import { fileChanges, type NewFileChange } from './db/schema'
import * as fs from 'fs'

export type FileOperationType = 'create' | 'update' | 'delete' | 'rename'

export interface TrackFileChangeParams {
  chatId?: string
  subChatId?: string
  projectId: string
  operationType: FileOperationType
  filePath: string
  oldFilePath?: string // For rename operations
  oldContent?: string | null
  newContent?: string | null
  worktreePath?: string
  source?: string // "tool-edit" | "tool-write" | "tool-patch" | "manual" | "file-watcher"
  sessionId?: string
}

/**
 * Track a file change operation in the database
 * This automatically captures all file operations for both chat-level and workspace-level tracking
 */
export async function trackFileChange(params: TrackFileChangeParams): Promise<void> {
  const db = getDatabase()

  const newChange: NewFileChange = {
    chatId: params.chatId || null,
    subChatId: params.subChatId || null,
    projectId: params.projectId,
    operationType: params.operationType,
    filePath: params.filePath,
    oldFilePath: params.oldFilePath || null,
    oldContent: params.oldContent || null,
    newContent: params.newContent || null,
    worktreePath: params.worktreePath || null,
    source: params.source || null,
    sessionId: params.sessionId || null,
    timestamp: new Date(),
  }

  db.insert(fileChanges).values(newChange).run()
}

/**
 * Get all file changes for a specific chat (current chat changes)
 */
export async function getCurrentChatChanges(chatId: string): Promise<Array<{
  id: string
  operationType: string
  filePath: string
  oldFilePath: string | null
  oldContent: string | null
  newContent: string | null
  timestamp: Date | null
  source: string | null
}>> {
  const db = getDatabase()

  return db
    .select({
      id: fileChanges.id,
      operationType: fileChanges.operationType,
      filePath: fileChanges.filePath,
      oldFilePath: fileChanges.oldFilePath,
      oldContent: fileChanges.oldContent,
      newContent: fileChanges.newContent,
      timestamp: fileChanges.timestamp,
      source: fileChanges.source,
    })
    .from(fileChanges)
    .where(eq(fileChanges.chatId, chatId))
    .all()
}

/**
 * Get all file changes for a project (workspace changes)
 */
export async function getWorkspaceChanges(projectId: string): Promise<Array<{
  id: string
  chatId: string | null
  subChatId: string | null
  operationType: string
  filePath: string
  oldFilePath: string | null
  oldContent: string | null
  newContent: string | null
  timestamp: Date | null
  source: string | null
}>> {
  const db = getDatabase()

  return db
    .select({
      id: fileChanges.id,
      chatId: fileChanges.chatId,
      subChatId: fileChanges.subChatId,
      operationType: fileChanges.operationType,
      filePath: fileChanges.filePath,
      oldFilePath: fileChanges.oldFilePath,
      oldContent: fileChanges.oldContent,
      newContent: fileChanges.newContent,
      timestamp: fileChanges.timestamp,
      source: fileChanges.source,
    })
    .from(fileChanges)
    .where(eq(fileChanges.projectId, projectId))
    .all()
}

/**
 * Track file create operation
 */
export async function trackFileCreate(params: Omit<TrackFileChangeParams, 'operationType'>): Promise<void> {
  await trackFileChange({
    ...params,
    operationType: 'create',
  })
}

/**
 * Track file update operation
 */
export async function trackFileUpdate(params: Omit<TrackFileChangeParams, 'operationType'>): Promise<void> {
  await trackFileChange({
    ...params,
    operationType: 'update',
  })
}

/**
 * Track file delete operation
 */
export async function trackFileDelete(params: Omit<TrackFileChangeParams, 'operationType'>): Promise<void> {
  await trackFileChange({
    ...params,
    operationType: 'delete',
  })
}

/**
 * Track file rename operation
 */
export async function trackFileRename(
  params: Omit<TrackFileChangeParams, 'operationType'> & { oldFilePath: string }
): Promise<void> {
  await trackFileChange({
    ...params,
    operationType: 'rename',
  })
}

/**
 * Read file content safely (returns null if file doesn't exist)
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}
