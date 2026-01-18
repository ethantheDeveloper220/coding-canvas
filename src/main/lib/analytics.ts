/**
 * PostHog analytics for 1Code Desktop - Main Process
 * Uses PostHog Node.js SDK for server-side tracking
 */

import { PostHog } from "posthog-node"

// Helper to get env vars - works in both Electron (import.meta.env) and Node.js (process.env)
function getEnvVar(key: string, defaultValue?: string): string | undefined {
  // Try import.meta.env first (Electron/Vite)
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const value = (import.meta.env as any)[key]
    if (value) return value
  }
  // Fall back to process.env (Node.js/web server)
  return process.env[key] || defaultValue
}

// PostHog configuration from environment
const POSTHOG_DESKTOP_KEY = getEnvVar("MAIN_VITE_POSTHOG_KEY") || getEnvVar("POSTHOG_KEY")
const POSTHOG_HOST = getEnvVar("MAIN_VITE_POSTHOG_HOST") || getEnvVar("POSTHOG_HOST") || "https://us.i.posthog.com"

// Try to import app from electron (may not be available in web mode)
let app: typeof import("electron").app | null = null
try {
  app = require("electron").app
} catch {
  // Not in Electron, that's okay
}

let posthog: PostHog | null = null
let currentUserId: string | null = null
let userOptedOut = false // Synced from renderer

// Check if we're in development mode
// Set FORCE_ANALYTICS=true to test analytics in development
// Use a function to check lazily after app is ready
function isDev(): boolean {
  try {
    if (app) {
      return !app.isPackaged && process.env.FORCE_ANALYTICS !== "true"
    }
    // Not in Electron, check NODE_ENV
    return process.env.NODE_ENV !== "production" && process.env.FORCE_ANALYTICS !== "true"
  } catch {
    // App not ready yet, assume dev mode
    return process.env.FORCE_ANALYTICS !== "true"
  }
}

/**
 * Get common properties for all events
 */
function getCommonProperties() {
  return {
    source: app ? "desktop_main" : "web_server",
    app_version: app?.getVersion() || process.env.npm_package_version || "unknown",
    platform: process.platform,
    arch: process.arch,
    electron_version: process.versions.electron || "N/A",
    node_version: process.versions.node,
  }
}

/**
 * Set opt-out status (called from renderer when user preference changes)
 */
export function setOptOut(optedOut: boolean) {
  userOptedOut = optedOut
}

/**
 * Initialize PostHog for main process
 */
export function initAnalytics() {
  // Skip in development mode
  if (isDev()) return

  if (posthog) return

  // Skip if no PostHog key configured
  if (!POSTHOG_DESKTOP_KEY) {
    console.log("[Analytics] Skipping PostHog initialization (no key configured)")
    return
  }

  posthog = new PostHog(POSTHOG_DESKTOP_KEY, {
    host: POSTHOG_HOST,
    // Flush events every 30 seconds or when 20 events are queued
    flushAt: 20,
    flushInterval: 30000,
  })
}

/**
 * Capture an analytics event
 */
export function capture(
  eventName: string,
  properties?: Record<string, any>,
) {
  // Skip in development mode
  if (isDev()) return

  // Skip if user opted out
  if (userOptedOut) return

  if (!posthog) return

  const distinctId = currentUserId || "anonymous"

  posthog.capture({
    distinctId,
    event: eventName,
    properties: {
      ...getCommonProperties(),
      ...properties,
    },
  })
}

/**
 * Identify a user
 */
export function identify(
  userId: string,
  traits?: Record<string, any>,
) {
  currentUserId = userId

  // Skip in development mode
  if (isDev()) return

  // Skip if user opted out
  if (userOptedOut) return

  if (!posthog) return

  posthog.identify({
    distinctId: userId,
    properties: {
      ...getCommonProperties(),
      ...traits,
    },
  })
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId
}

/**
 * Reset user identification (on logout)
 */
export function reset() {
  currentUserId = null
  // PostHog Node.js SDK doesn't have a reset method
  // Events will be sent as anonymous until next identify
}

/**
 * Shutdown PostHog and flush pending events
 */
export async function shutdown() {
  if (posthog) {
    await posthog.shutdown()
    posthog = null
  }
}

// ============================================================================
// Specific event helpers
// ============================================================================

/**
 * Track app opened event
 */
export function trackAppOpened() {
  capture("desktop_opened", {
    first_launch: false, // TODO: track first launch
  })
}

/**
 * Track successful authentication
 */
export function trackAuthCompleted(userId: string, email?: string) {
  identify(userId, email ? { email } : undefined)
  capture("auth_completed", {
    user_id: userId,
  })
}

/**
 * Track project opened
 */
export function trackProjectOpened(project: {
  id: string
  hasGitRemote: boolean
}) {
  capture("project_opened", {
    project_id: project.id,
    has_git_remote: project.hasGitRemote,
  })
}

/**
 * Track workspace/chat created
 */
export function trackWorkspaceCreated(workspace: {
  id: string
  projectId: string
  useWorktree: boolean
}) {
  capture("workspace_created", {
    workspace_id: workspace.id,
    project_id: workspace.projectId,
    use_worktree: workspace.useWorktree,
  })
}

/**
 * Track workspace archived
 */
export function trackWorkspaceArchived(workspaceId: string) {
  capture("workspace_archived", {
    workspace_id: workspaceId,
  })
}

/**
 * Track workspace deleted
 */
export function trackWorkspaceDeleted(workspaceId: string) {
  capture("workspace_deleted", {
    workspace_id: workspaceId,
  })
}

/**
 * Track message sent
 */
export function trackMessageSent(data: {
  workspaceId: string
  messageLength: number
  mode: "plan" | "agent"
}) {
  capture("message_sent", {
    workspace_id: data.workspaceId,
    message_length: data.messageLength,
    mode: data.mode,
  })
}

/**
 * Track PR created
 */
export function trackPRCreated(data: {
  workspaceId: string
  prNumber: number
}) {
  capture("pr_created", {
    workspace_id: data.workspaceId,
    pr_number: data.prNumber,
  })
}
