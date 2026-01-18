import { router } from "../index"
import { projectsRouter } from "./projects"
import { chatsRouter } from "./chats"
import { claudeRouter } from "./claude"
import { claudeCodeRouter } from "./claude-code"
import { terminalRouter } from "./terminal"
import { externalRouter } from "./external"
import { filesRouter } from "./files"
import { debugRouter } from "./debug"
import { skillsRouter } from "./skills"
import { agentsRouter } from "./agents"
import { opencodeRouter } from "./opencode"
import { createGitRouter } from "../../git"

// Lazy import BrowserWindow to avoid loading Electron in web mode
type BrowserWindowType = typeof import("electron").BrowserWindow

/**
 * Create the main app router
 * Uses getter pattern to avoid stale window references
 */
export function createAppRouter(getWindow: () => BrowserWindowType | null) {
  return router({
    projects: projectsRouter,
    chats: chatsRouter,
    claude: claudeRouter,
    claudeCode: claudeCodeRouter,
    terminal: terminalRouter,
    external: externalRouter,
    files: filesRouter,
    debug: debugRouter,
    skills: skillsRouter,
    agents: agentsRouter,
    opencode: opencodeRouter,
    // Git operations - named "changes" to match Superset API
    changes: createGitRouter(),
  })
}

/**
 * Export the router type for client usage
 */
export type AppRouter = ReturnType<typeof createAppRouter>
