import { z } from "zod"
import { router, publicProcedure } from "../index"
import { getDatabase, chats, subChats, projects, fileChanges, roadmapTasks } from "../../db"
import { eq, desc, isNull, isNotNull, inArray, and } from "drizzle-orm"
import { getCurrentChatChanges, getWorkspaceChanges } from "../file-change-tracking"
import {
  createWorktreeForChat,
  removeWorktree,
  getWorktreeDiff,
  fetchGitHubPRStatus,
} from "../../git"
import { execWithShellEnv } from "../../git/shell-env"
import simpleGit from "simple-git"
import { getAuthManager, getBaseUrl } from "../../../index"
import {
  trackWorkspaceCreated,
  trackWorkspaceArchived,
  trackWorkspaceDeleted,
  trackPRCreated,
} from "../../analytics"

// Fallback to truncated user message if AI generation fails
function getFallbackName(userMessage: string): string {
  const trimmed = userMessage.trim()
  if (trimmed.length <= 25) {
    return trimmed || "New Chat"
  }
  return trimmed.substring(0, 25) + "..."
}

export const chatsRouter = router({
  /**
   * List all non-archived chats (optionally filter by project)
   */
  list: publicProcedure
    .input(z.object({ projectId: z.string().optional() }))
    .query(({ input }) => {
      const db = getDatabase()
      const conditions = [isNull(chats.archivedAt)]
      if (input.projectId) {
        conditions.push(eq(chats.projectId, input.projectId))
      }
      return db
        .select()
        .from(chats)
        .where(and(...conditions))
        .orderBy(desc(chats.updatedAt))
        .all()
    }),

  /**
   * List archived chats (optionally filter by project)
   */
  listArchived: publicProcedure
    .input(z.object({ projectId: z.string().optional() }))
    .query(({ input }) => {
      const db = getDatabase()
      const conditions = [isNotNull(chats.archivedAt)]
      if (input.projectId) {
        conditions.push(eq(chats.projectId, input.projectId))
      }
      return db
        .select()
        .from(chats)
        .where(and(...conditions))
        .orderBy(desc(chats.archivedAt))
        .all()
    }),

  /**
   * Get a single chat with all sub-chats
   */
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDatabase()
      const chat = db.select().from(chats).where(eq(chats.id, input.id)).get()
      if (!chat) return null

      const chatSubChats = db
        .select()
        .from(subChats)
        .where(eq(subChats.chatId, input.id))
        .orderBy(subChats.createdAt)
        .all()

      const project = db
        .select()
        .from(projects)
        .where(eq(projects.id, chat.projectId))
        .get()

      return { ...chat, subChats: chatSubChats, project }
    }),

  /**
   * Create a new chat with optional git worktree
   */
  create: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().optional(),
        initialMessage: z.string().optional(),
        initialMessageParts: z
          .array(
            z.union([
              z.object({ type: z.literal("text"), text: z.string() }),
              z.object({
                type: z.literal("data-image"),
                data: z.object({
                  url: z.string(),
                  mediaType: z.string().optional(),
                  filename: z.string().optional(),
                  base64Data: z.string().optional(),
                }),
              }),
            ]),
          )
          .optional(),
        baseBranch: z.string().optional(), // Branch to base the worktree off
        useWorktree: z.boolean().default(true), // If false, work directly in project dir
        mode: z.enum(["plan", "build", "agent", "scaling", "designer", "debug"]).default("build").transform(val => val === "agent" ? "build" : val),
        model: z.string().optional(), // Model ID (e.g., "opencode/glm-4.7-free")
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log("[chats.create] called with:", input)
        const db = getDatabase()

        // Get project path
        const project = db
          .select()
          .from(projects)
          .where(eq(projects.id, input.projectId))
          .get()
        console.log("[chats.create] found project:", project)
        if (!project) throw new Error("Project not found")

        // Create chat (fast path)
        const chat = db
          .insert(chats)
          .values({ name: input.name, projectId: input.projectId })
          .returning()
          .get()
        console.log("[chats.create] created chat:", chat)

        // Create initial sub-chat with user message (AI SDK format)
        // If initialMessageParts is provided, use it; otherwise fallback to text-only message
        let initialMessages = "[]"

        if (input.initialMessageParts && input.initialMessageParts.length > 0) {
          initialMessages = JSON.stringify([
            {
              id: `msg-${Date.now()}`,
              role: "user",
              parts: input.initialMessageParts,
            },
          ])
        } else if (input.initialMessage) {
          initialMessages = JSON.stringify([
            {
              id: `msg-${Date.now()}`,
              role: "user",
              parts: [{ type: "text", text: input.initialMessage }],
            },
          ])
        }

        const subChat = db
          .insert(subChats)
          .values({
            chatId: chat.id,
            mode: input.mode,
            messages: initialMessages,
            model: input.model,
          })
          .returning()
          .get()
        console.log("[chats.create] created subChat:", subChat)

        // Worktree creation result (will be set if useWorktree is true)
        let worktreeResult: {
          worktreePath?: string
          branch?: string
          baseBranch?: string
        } = {}

        // Only create worktree if useWorktree is true
        if (input.useWorktree) {
          console.log(
            "[chats.create] creating worktree with baseBranch:",
            input.baseBranch,
          )
          const result = await createWorktreeForChat(
            project.path,
            project.id,
            chat.id,
            input.baseBranch,
          )
          console.log("[chats.create] worktree result:", result)

          if (result.success && result.worktreePath) {
            console.log("[chats.create] updating chat with worktree path")
            db.update(chats)
              .set({
                worktreePath: result.worktreePath,
                branch: result.branch,
                baseBranch: result.baseBranch,
              })
              .where(eq(chats.id, chat.id))
              .run()
            console.log("[chats.create] chat updated with worktree path")
            worktreeResult = {
              worktreePath: result.worktreePath,
              branch: result.branch,
              baseBranch: result.baseBranch,
            }
          } else {
            console.warn(`[Worktree] Failed: ${result.error}`)
            // Fallback to project path
            console.log("[chats.create] updating chat with project path fallback")
            db.update(chats)
              .set({ worktreePath: project.path })
              .where(eq(chats.id, chat.id))
              .run()
            console.log("[chats.create] chat updated with project path")
            worktreeResult = { worktreePath: project.path }
          }
        } else {
          // Local mode: use project path directly, no branch info
          console.log("[chats.create] local mode - using project path directly")
          db.update(chats)
            .set({ worktreePath: project.path })
            .where(eq(chats.id, chat.id))
            .run()
          worktreeResult = { worktreePath: project.path }
        }

        // Auto-create default roadmap tasks for new chat
        console.log("[chats.create] creating roadmap tasks")
        const defaultTasks = [
          { id: `task-${Date.now()}-1`, title: "Plan project structure", column: "backlog" as const },
          { id: `task-${Date.now()}-2`, title: "Set up development environment", column: "backlog" as const },
          { id: `task-${Date.now()}-3`, title: "Implement core features", column: "todo" as const },
        ]
        
        const now = new Date()
        try {
          for (let i = 0; i < defaultTasks.length; i++) {
            const task = defaultTasks[i]
            db.insert(roadmapTasks)
              .values({
                id: task.id,
                chatId: chat.id,
                title: task.title,
                column: task.column,
                position: i,
                createdAt: now,
                updatedAt: now,
              })
              .run()
          }
          console.log("[chats.create] roadmap tasks created successfully")
        } catch (error) {
          console.error("[chats.create] Failed to create roadmap tasks:", error)
          // Continue anyway - roadmap tasks are not critical
        }

        console.log("[chats.create] preparing response")
        const response = {
          ...chat,
          worktreePath: worktreeResult.worktreePath || project.path,
          branch: worktreeResult.branch,
          baseBranch: worktreeResult.baseBranch,
          subChats: [subChat],
        }

        console.log("[chats.create] response prepared, tracking workspace")
        // Track workspace created
        try {
          trackWorkspaceCreated({
            id: chat.id,
            projectId: input.projectId,
            useWorktree: input.useWorktree,
          })
          console.log("[chats.create] workspace tracked successfully")
        } catch (error) {
          console.error("[chats.create] Failed to track workspace created:", error)
          // Continue anyway - analytics are not critical
        }

        console.log("[chats.create] returning response with id:", response.id)
        return response
      } catch (error) {
        console.error("[chats.create] FATAL ERROR:", error)
        console.error("[chats.create] Error stack:", error instanceof Error ? error.stack : "No stack trace")
        throw error
      }
    }),

  /**
   * Rename a chat
   */
  rename: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(chats)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(chats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Archive a chat
   */
  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      const result = db
        .update(chats)
        .set({ archivedAt: new Date() })
        .where(eq(chats.id, input.id))
        .returning()
        .get()

      // Track workspace archived
      trackWorkspaceArchived(input.id)

      return result
    }),

  /**
   * Restore an archived chat
   */
  restore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(chats)
        .set({ archivedAt: null })
        .where(eq(chats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Archive multiple chats at once
   */
  archiveBatch: publicProcedure
    .input(z.object({ chatIds: z.array(z.string()) }))
    .mutation(({ input }) => {
      const db = getDatabase()
      if (input.chatIds.length === 0) return []
      return db
        .update(chats)
        .set({ archivedAt: new Date() })
        .where(inArray(chats.id, input.chatIds))
        .returning()
        .all()
    }),

  /**
   * Delete a chat permanently (with worktree cleanup)
   */
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()

      // Get chat before deletion
      const chat = db.select().from(chats).where(eq(chats.id, input.id)).get()

      // Cleanup worktree if it was created (has branch = was a real worktree, not just project path)
      if (chat?.worktreePath && chat?.branch) {
        const project = db
          .select()
          .from(projects)
          .where(eq(projects.id, chat.projectId))
          .get()
        if (project) {
          const result = await removeWorktree(project.path, chat.worktreePath)
          if (!result.success) {
            console.warn(`[Worktree] Cleanup failed: ${result.error}`)
          }
        }
      }

      // Track workspace deleted
      trackWorkspaceDeleted(input.id)

      return db.delete(chats).where(eq(chats.id, input.id)).returning().get()
    }),

  // ============ Sub-chat procedures ============

  /**
   * Get a single sub-chat
   */
  getSubChat: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDatabase()
      const subChat = db
        .select()
        .from(subChats)
        .where(eq(subChats.id, input.id))
        .get()

      if (!subChat) return null

      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, subChat.chatId))
        .get()

      const project = chat
        ? db
          .select()
          .from(projects)
          .where(eq(projects.id, chat.projectId))
          .get()
        : null

      return { ...subChat, chat: chat ? { ...chat, project } : null }
    }),

  /**
   * Create a new sub-chat
   */
  createSubChat: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        name: z.string().optional(),
        mode: z.enum(["plan", "build", "agent", "scaling", "designer", "debug"]).default("build").transform(val => val === "agent" ? "build" : val),
        model: z.string().optional(), // Model ID (e.g., "opencode/glm-4.7-free")
      }),
    )
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .insert(subChats)
        .values({
          chatId: input.chatId,
          name: input.name,
          mode: input.mode,
          model: input.model,
          messages: "[]",
        })
        .returning()
        .get()
    }),

  /**
   * Update sub-chat messages
   */
  updateSubChatMessages: publicProcedure
    .input(z.object({ id: z.string(), messages: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const subChat = db
        .select()
        .from(subChats)
        .where(eq(subChats.id, input.id))
        .get()

      if (!subChat) {
        throw new Error('Sub-chat not found')
      }

      const result = db
        .update(subChats)
        .set({ messages: input.messages, updatedAt: new Date() })
        .where(eq(subChats.id, input.id))
        .returning()
        .get()

      // Track file changes from updated messages
      try {
        const messages = JSON.parse(input.messages) as Array<{
          role: string
          parts?: Array<{
            type: string
            input?: any
          }>
        }>
        const { trackFileChangesFromMessages } = await import('../../db/file-changes-tracker')
        await trackFileChangesFromMessages(subChat.chatId, input.id, messages, subChat.sessionId || undefined)
      } catch (error) {
        console.error('[updateSubChatMessages] Error tracking file changes:', error)
      }

      return result
    }),

  /**
   * Update sub-chat session ID (for Claude resume)
   */
  updateSubChatSession: publicProcedure
    .input(z.object({ id: z.string(), sessionId: z.string().nullable() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(subChats)
        .set({ sessionId: input.sessionId })
        .where(eq(subChats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Update sub-chat mode
   */
  updateSubChatMode: publicProcedure
    .input(z.object({ id: z.string(), mode: z.enum(["plan", "build", "agent", "scaling", "designer", "debug"]).transform(val => val === "agent" ? "build" : val) }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(subChats)
        .set({ mode: input.mode })
        .where(eq(subChats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Update sub-chat model
   */
  updateSubChatModel: publicProcedure
    .input(z.object({ id: z.string(), model: z.string().optional().nullable() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(subChats)
        .set({ model: input.model ?? null })
        .where(eq(subChats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Rename a sub-chat
   */
  renameSubChat: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .update(subChats)
        .set({ name: input.name })
        .where(eq(subChats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Delete a sub-chat
   */
  deleteSubChat: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDatabase()
      return db
        .delete(subChats)
        .where(eq(subChats.id, input.id))
        .returning()
        .get()
    }),

  /**
   * Get git diff for a chat's worktree
   */
  getDiff: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat?.worktreePath) {
        return { diff: null, error: "No worktree path" }
      }

      // Check if this is an OpenCode chat (has OpenCode sub-chats)
      const subChatsList = db
        .select()
        .from(subChats)
        .where(eq(subChats.chatId, input.chatId))
        .all()

      const hasOpenCodeChats = subChatsList.some(sc =>
        sc.sessionId?.startsWith('ses_')
      )

      // Use custom OpenCode diff if this is an OpenCode chat
      if (hasOpenCodeChats) {
        console.log('[getDiff] Using OpenCode diff integration')
        const { getOpenCodeDiff } = await import('../../opencode/diff')
        return await getOpenCodeDiff(input.chatId)
      }

      // Otherwise use standard git diff
      const result = await getWorktreeDiff(
        chat.worktreePath,
        chat.baseBranch ?? undefined,
      )

      if (!result.success) {
        return { diff: null, error: result.error }
      }

      return { diff: result.diff || "" }
    }),

  /**
   * Get file changes for the current chat only
   */
  getCurrentChatFileChanges: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      // Get all file changes without limit to show more changes
      const changes = db
        .select()
        .from(fileChanges)
        .where(eq(fileChanges.chatId, input.chatId))
        .orderBy(desc(fileChanges.timestamp))
        .limit(500) // Increased limit to show more changes
        .all()

      return { changes }
    }),

  /**
   * Get all file changes for the entire workspace (project) from chatId
   */
  getWorkspaceFileChangesFromChat: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      
      // Get chat to find projectId
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat) {
        return { changes: [] }
      }

      const changes = db
        .select()
        .from(fileChanges)
        .where(eq(fileChanges.projectId, chat.projectId))
        .orderBy(desc(fileChanges.timestamp))
        .limit(500) // Increased limit to show more changes
        .all()

      return { changes }
    }),

  /**
   * Get all file changes for the entire workspace (project)
   */
  getWorkspaceFileChanges: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      const changes = db
        .select()
        .from(fileChanges)
        .where(eq(fileChanges.projectId, input.projectId))
        .orderBy(desc(fileChanges.timestamp))
        .limit(500) // Increased limit to show more changes
        .all()

      return { changes }
    }),

  /**
   * Generate a name for a sub-chat using AI (calls web API)
   * Always uses production API since it's a lightweight call
   */
  generateSubChatName: publicProcedure
    .input(z.object({ userMessage: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const authManager = getAuthManager()
        const token = await authManager.getValidToken()
        // Always use production API for name generation
        const apiUrl = "https://21st.dev"

        console.log(
          "[generateSubChatName] Calling API with token:",
          token ? "present" : "missing",
        )
        console.log(
          "[generateSubChatName] URL:",
          `${apiUrl}/api/agents/sub-chat/generate-name`,
        )

        const response = await fetch(
          `${apiUrl}/api/agents/sub-chat/generate-name`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token && { "X-Desktop-Token": token }),
            },
            body: JSON.stringify({ userMessage: input.userMessage }),
          },
        )

        console.log("[generateSubChatName] Response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(
            "[generateSubChatName] API error:",
            response.status,
            errorText,
          )
          return { name: getFallbackName(input.userMessage) }
        }

        const data = await response.json()
        console.log("[generateSubChatName] Generated name:", data.name)
        return { name: data.name || getFallbackName(input.userMessage) }
      } catch (error) {
        console.error("[generateSubChatName] Error:", error)
        return { name: getFallbackName(input.userMessage) }
      }
    }),

  // ============ PR-related procedures ============

  /**
   * Get PR context for message generation (branch info, uncommitted changes, etc.)
   */
  getPrContext: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat?.worktreePath) {
        return null
      }

      try {
        const git = simpleGit(chat.worktreePath)
        const status = await git.status()

        // Check if upstream exists
        let hasUpstream = false
        try {
          const tracking = await git.raw([
            "rev-parse",
            "--abbrev-ref",
            "@{upstream}",
          ])
          hasUpstream = !!tracking.trim()
        } catch {
          hasUpstream = false
        }

        return {
          branch: chat.branch || status.current || "unknown",
          baseBranch: chat.baseBranch || "main",
          uncommittedCount: status.files.length,
          hasUpstream,
        }
      } catch (error) {
        console.error("[getPrContext] Error:", error)
        return null
      }
    }),

  /**
   * Update PR info after Claude creates a PR
   */
  updatePrInfo: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        prUrl: z.string(),
        prNumber: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const result = db
        .update(chats)
        .set({
          prUrl: input.prUrl,
          prNumber: input.prNumber,
          updatedAt: new Date(),
        })
        .where(eq(chats.id, input.chatId))
        .returning()
        .get()

      // Track PR created
      trackPRCreated({
        workspaceId: input.chatId,
        prNumber: input.prNumber,
      })

      return result
    }),

  /**
   * Get PR status from GitHub (via gh CLI)
   */
  getPrStatus: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat?.worktreePath) {
        return null
      }

      return await fetchGitHubPRStatus(chat.worktreePath)
    }),

  /**
   * Merge PR via gh CLI
   */
  mergePr: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        method: z.enum(["merge", "squash", "rebase"]).default("squash"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDatabase()
      const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, input.chatId))
        .get()

      if (!chat?.worktreePath || !chat?.prNumber) {
        throw new Error("No PR to merge")
      }

      try {
        await execWithShellEnv(
          "gh",
          [
            "pr",
            "merge",
            String(chat.prNumber),
            `--${input.method}`,
            "--delete-branch",
          ],
          { cwd: chat.worktreePath },
        )
        return { success: true }
      } catch (error) {
        console.error("[mergePr] Error:", error)
        throw new Error(
          error instanceof Error ? error.message : "Failed to merge PR",
        )
      }
    }),

  /**
   * Get suggestions context for smart suggestions
   * Analyzes recent messages, file changes, and errors
   */
  getSuggestionsContext: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
      const db = getDatabase()

      // Get all sub-chats for this chat
      const allSubChats = db
        .select()
        .from(subChats)
        .where(eq(subChats.chatId, input.chatId))
        .orderBy(subChats.createdAt)
        .all()

      let hasFiles = false
      let hasErrors = false
      let lastMessage = ''
      const recentChanges: string[] = []

      // Analyze messages
      for (const subChat of allSubChats) {
        if (!subChat.messages) continue

        try {
          const messages = JSON.parse(subChat.messages)

          for (const message of messages) {
            // Get last user message
            if (message.role === 'user' && message.content) {
              lastMessage = message.content
            }

            // Check for file operations
            if (message.role === 'assistant' && message.parts) {
              for (const part of message.parts) {
                if (part.type === 'tool-Write' || part.type === 'tool-Edit') {
                  hasFiles = true
                  const filePath = part.input?.file_path || part.input?.path
                  if (filePath && !recentChanges.includes(filePath)) {
                    recentChanges.push(filePath)
                  }
                }

                // Check for errors
                if (part.state === 'output-error' || part.output?.error) {
                  hasErrors = true
                }
              }
            }
          }
        } catch (e) {
          console.error('[getSuggestionsContext] Error parsing messages:', e)
        }
      }

      return {
        hasFiles,
        hasErrors,
        lastMessage,
        recentChanges: recentChanges.slice(0, 3), // Last 3 changed files
      }
    }),

  /**
   * Get file change stats for all workspaces
   * Parses messages from all sub-chats and aggregates Edit/Write tool calls
   * If openSubChatIds provided, only count stats from those sub-chats
   */
  getFileStats: publicProcedure
    .input(z.object({ openSubChatIds: z.array(z.string()).optional() }).optional())
    .query(({ input }) => {
    const db = getDatabase()
    const openSubChatIdsSet = input?.openSubChatIds ? new Set(input.openSubChatIds) : null

    // Get all non-archived chats with their sub-chats
    const allChats = db
      .select({
        chatId: chats.id,
        subChatId: subChats.id,
        messages: subChats.messages,
      })
      .from(chats)
      .leftJoin(subChats, eq(subChats.chatId, chats.id))
      .where(isNull(chats.archivedAt))
      .all()
      // Filter by open sub-chats if provided
      .filter(row => !openSubChatIdsSet || !row.subChatId || openSubChatIdsSet.has(row.subChatId))

    // Aggregate stats per workspace (chatId)
    const statsMap = new Map<
      string,
      { additions: number; deletions: number; fileCount: number }
    >()

    for (const row of allChats) {
      if (!row.messages || !row.chatId) continue

      try {
        const messages = JSON.parse(row.messages) as Array<{
          role: string
          parts?: Array<{
            type: string
            input?: {
              file_path?: string
              old_string?: string
              new_string?: string
              content?: string
            }
          }>
        }>

        // Track file states for this sub-chat
        const fileStates = new Map<
          string,
          { originalContent: string | null; currentContent: string }
        >()

        for (const msg of messages) {
          if (msg.role !== "assistant") continue
          for (const part of msg.parts || []) {
            if (part.type === "tool-Edit" || part.type === "tool-Write") {
              const filePath = part.input?.file_path
              if (!filePath) continue
              // Skip session files
              if (
                filePath.includes("claude-sessions") ||
                filePath.includes("Application Support")
              )
                continue

              const oldString = part.input?.old_string || ""
              const newString =
                part.input?.new_string || part.input?.content || ""

              const existing = fileStates.get(filePath)
              if (existing) {
                existing.currentContent = newString
              } else {
                fileStates.set(filePath, {
                  originalContent: part.type === "tool-Write" ? null : oldString,
                  currentContent: newString,
                })
              }
            }
          }
        }

        // Calculate stats for this sub-chat and add to workspace total
        let subChatAdditions = 0
        let subChatDeletions = 0
        let subChatFileCount = 0

        for (const [, state] of fileStates) {
          const original = state.originalContent || ""
          if (original === state.currentContent) continue

          const oldLines = original ? original.split("\n").length : 0
          const newLines = state.currentContent
            ? state.currentContent.split("\n").length
            : 0

          if (!original) {
            // New file
            subChatAdditions += newLines
          } else {
            subChatAdditions += newLines
            subChatDeletions += oldLines
          }
          subChatFileCount += 1
        }

        // Add to workspace total
        const existing = statsMap.get(row.chatId) || {
          additions: 0,
          deletions: 0,
          fileCount: 0,
        }
        existing.additions += subChatAdditions
        existing.deletions += subChatDeletions
        existing.fileCount += subChatFileCount
        statsMap.set(row.chatId, existing)
      } catch {
        // Skip invalid JSON
      }
    }

    // Convert to array for easier consumption
    return Array.from(statsMap.entries()).map(([chatId, stats]) => ({
      chatId,
      ...stats,
    }))
  }),

  /**
   * Get sub-chats with pending plan approvals
   * Parses messages to find ExitPlanMode tool calls without subsequent "Implement plan" user message
   * Logic must match active-chat.tsx hasUnapprovedPlan
   * If openSubChatIds provided, only check those sub-chats
   */
  getPendingPlanApprovals: publicProcedure
    .input(z.object({ openSubChatIds: z.array(z.string()).optional() }).optional())
    .query(({ input }) => {
    const db = getDatabase()
    const openSubChatIdsSet = input?.openSubChatIds ? new Set(input.openSubChatIds) : null

    // Get all non-archived chats with their sub-chats
    const allSubChats = db
      .select({
        chatId: chats.id,
        subChatId: subChats.id,
        messages: subChats.messages,
      })
      .from(chats)
      .leftJoin(subChats, eq(subChats.chatId, chats.id))
      .where(isNull(chats.archivedAt))
      .all()
      // Filter by open sub-chats if provided
      .filter(row => !openSubChatIdsSet || !row.subChatId || openSubChatIdsSet.has(row.subChatId))

    const pendingApprovals: Array<{ subChatId: string; chatId: string }> = []

    for (const row of allSubChats) {
      if (!row.messages || !row.subChatId || !row.chatId) continue

      try {
        const messages = JSON.parse(row.messages) as Array<{
          role: string
          content?: string
          parts?: Array<{
            type: string
            text?: string
          }>
        }>

        // Traverse messages from end to find unapproved ExitPlanMode
        // Logic matches active-chat.tsx hasUnapprovedPlan
        let hasUnapprovedPlan = false

        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i]
          if (!msg) continue

          // If user message says "Implement plan" (exact match), plan is already approved
          if (msg.role === "user") {
            const textPart = msg.parts?.find((p) => p.type === "text")
            const text = textPart?.text || ""
            if (text.trim().toLowerCase() === "implement plan") {
              break // Plan was approved, stop searching
            }
          }

          // If assistant message with ExitPlanMode, we found an unapproved plan
          if (msg.role === "assistant" && msg.parts) {
            const exitPlanPart = msg.parts.find((p) => p.type === "tool-ExitPlanMode")
            if (exitPlanPart) {
              hasUnapprovedPlan = true
              break
            }
          }
        }

        if (hasUnapprovedPlan) {
          pendingApprovals.push({
            subChatId: row.subChatId,
            chatId: row.chatId,
          })
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return pendingApprovals
  }),

  /**
   * Get roadmap tasks for a chat
   */
  getRoadmapTasks: publicProcedure
    .input(z.object({ chatId: z.string() }))
    .query(({ input }) => {
      const db = getDatabase()
      const tasks = db
        .select()
        .from(roadmapTasks)
        .where(eq(roadmapTasks.chatId, input.chatId))
        .all()
      
      // Sort by column, then by position
      tasks.sort((a, b) => {
        if (a.column !== b.column) {
          const order = ["backlog", "todo", "doing", "done"]
          return order.indexOf(a.column) - order.indexOf(b.column)
        }
        return a.position - b.position
      })
      
      // Convert to Kanban card format
      return tasks.map((task) => ({
        id: task.id,
        title: task.title,
        column: task.column as "backlog" | "todo" | "doing" | "done",
      }))
    }),

  /**
   * Save roadmap tasks for a chat (upserts all tasks)
   */
  saveRoadmapTasks: publicProcedure
    .input(
      z.object({
        chatId: z.string(),
        tasks: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            column: z.enum(["backlog", "todo", "doing", "done"]),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDatabase()
      
      // Delete existing tasks for this chat
      db.delete(roadmapTasks)
        .where(eq(roadmapTasks.chatId, input.chatId))
        .run()

      // Insert new tasks
      const now = new Date()
      const tasksByColumn = new Map<string, number>()
      
      for (const task of input.tasks) {
        const position = tasksByColumn.get(task.column) || 0
        tasksByColumn.set(task.column, position + 1)
        
        const completedAt = task.column === "done" ? now : null
        
        db.insert(roadmapTasks)
          .values({
            id: task.id,
            chatId: input.chatId,
            title: task.title,
            column: task.column,
            position,
            completedAt,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }

      return { success: true }
    }),
})
