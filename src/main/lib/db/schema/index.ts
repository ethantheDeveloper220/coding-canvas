import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { relations } from "drizzle-orm"
import { createId } from "../utils"

// ============ PROJECTS ============
export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  // Git remote info (extracted from local .git)
  gitRemoteUrl: text("git_remote_url"),
  gitProvider: text("git_provider"), // "github" | "gitlab" | "bitbucket" | null
  gitOwner: text("git_owner"),
  gitRepo: text("git_repo"),
})

export const projectsRelations = relations(projects, ({ many }) => ({
  chats: many(chats),
}))

// ============ CHATS ============
export const chats = sqliteTable("chats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  // Worktree fields (for git isolation per chat)
  worktreePath: text("worktree_path"),
  branch: text("branch"),
  baseBranch: text("base_branch"),
  // PR tracking fields
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
})


// ============ SUB-CHATS ============
export const subChats = sqliteTable("sub_chats", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  sessionId: text("session_id"), // Claude SDK session ID for resume
  streamId: text("stream_id"), // Track in-progress streams
  mode: text("mode").notNull().default("agent"), // "plan" | "agent"
  model: text("model"), // Selected model ID (e.g., "opencode/glm-4.7-free")
  messages: text("messages").notNull().default("[]"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
})

export const subChatsRelations = relations(subChats, ({ one, many }) => ({
  chat: one(chats, {
    fields: [subChats.chatId],
    references: [chats.id],
  }),
  questionPreferences: many(questionPreferences),
  fileChanges: many(fileChanges),
}))

// ============ QUESTION PREFERENCES ============
// Stores user's answers to questions for auto-answering in future sessions
export const questionPreferences = sqliteTable("question_preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  subChatId: text("sub_chat_id")
    .notNull()
    .references(() => subChats.id, { onDelete: "cascade" }),
  sessionId: text("session_id"), // OpenCode session ID for context
  requestId: text("request_id").notNull(), // Question request ID from OpenCode
  questionText: text("question_text").notNull(), // The question asked
  questionHeader: text("question_header"), // Question category/header
  answerText: text("answer_text").notNull(), // User's answer
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  // Track usage for learning patterns
  usedCount: integer("used_count").notNull().default(0),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
})

export const questionPreferencesRelations = relations(questionPreferences, ({ one }) => ({
  subChat: one(subChats, {
    fields: [questionPreferences.subChatId],
    references: [subChats.id],
  }),
}))

// ============ CLAUDE CODE CREDENTIALS ============
// Stores encrypted OAuth token for Claude Code integration
export const claudeCodeCredentials = sqliteTable("claude_code_credentials", {
  id: text("id").primaryKey().default("default"), // Single row, always "default"
  oauthToken: text("oauth_token").notNull(), // Encrypted with safeStorage
  connectedAt: integer("connected_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  userId: text("user_id"), // Desktop auth user ID (for reference)
})

// ============ FILE CHANGES ============
// Tracks all file operations (create, update, delete, rename) at both chat and workspace levels
export const fileChanges = sqliteTable("file_changes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // Chat context - can be null for workspace-level tracking
  chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
  subChatId: text("sub_chat_id").references(() => subChats.id, { onDelete: "cascade" }),
  // Project context for workspace-level tracking
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // File operation details
  operationType: text("operation_type").notNull(), // "create" | "update" | "delete" | "rename"
  filePath: text("file_path").notNull(), // Current/new file path
  oldFilePath: text("old_file_path"), // For rename operations
  // Content snapshots (for generating diffs)
  oldContent: text("old_content"), // Content before change (null for create)
  newContent: text("new_content"), // Content after change (null for delete)
  // Metadata
  worktreePath: text("worktree_path"), // Worktree path where change occurred
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  // Source of change (for tracking)
  source: text("source"), // "tool-edit" | "tool-write" | "tool-patch" | "manual" | "file-watcher"
  sessionId: text("session_id"), // OpenCode session ID if applicable
})

export const fileChangesRelations = relations(fileChanges, ({ one }) => ({
  chat: one(chats, {
    fields: [fileChanges.chatId],
    references: [chats.id],
  }),
  subChat: one(subChats, {
    fields: [fileChanges.subChatId],
    references: [subChats.id],
  }),
  project: one(projects, {
    fields: [fileChanges.projectId],
    references: [projects.id],
  }),
}))

// ============ ROADMAP TASKS (KANBAN) ============
// Stores roadmap tasks/cards for each chat/workspace
export const roadmapTasks = sqliteTable("roadmap_tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  // Task details
  title: text("title").notNull(),
  column: text("column").notNull(), // "backlog" | "todo" | "doing" | "done"
  category: text("category"), // Category name like "IoT", "Frontend", etc.
  // Optional: description, priority, due date, etc.
  description: text("description"),
  priority: text("priority"), // "low" | "medium" | "high"
  // Metadata
  position: integer("position").notNull().default(0), // Order within column
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  completedAt: integer("completed_at", { mode: "timestamp" }), // When moved to "done"
})

export const roadmapTasksRelations = relations(roadmapTasks, ({ one }) => ({
  chat: one(chats, {
    fields: [roadmapTasks.chatId],
    references: [chats.id],
  }),
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id],
  }),
  subChats: many(subChats),
  fileChanges: many(fileChanges),
  roadmapTasks: many(roadmapTasks),
}))

// ============ TYPE EXPORTS ============
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type SubChat = typeof subChats.$inferSelect
export type NewSubChat = typeof subChats.$inferInsert
export type QuestionPreference = typeof questionPreferences.$inferSelect
export type NewQuestionPreference = typeof questionPreferences.$inferInsert
export type ClaudeCodeCredential = typeof claudeCodeCredentials.$inferSelect
export type NewClaudeCodeCredential = typeof claudeCodeCredentials.$inferInsert
export type FileChange = typeof fileChanges.$inferSelect
export type NewFileChange = typeof fileChanges.$inferInsert
export type RoadmapTask = typeof roadmapTasks.$inferSelect
export type NewRoadmapTask = typeof roadmapTasks.$inferInsert

