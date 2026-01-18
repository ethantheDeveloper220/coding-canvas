/**
 * Global OpenCode Session Manager
 * 
 * Manages active OpenCode sessions to prevent:
 * 1. Multiple sessions for the same subchat
 * 2. Old sessions continuing to receive events
 * 3. Session leaks and memory issues
 */

interface ActiveSession {
    sessionId: string
    subChatId: string
    abortController: AbortController
    startTime: number
}

class OpenCodeSessionManager {
    private sessions = new Map<string, ActiveSession>()

    /**
     * Register a new session and cancel any existing session for the same subchat
     */
    registerSession(subChatId: string, sessionId: string, abortController: AbortController): void {
        // Cancel existing session for this subchat if it exists
        const existing = this.sessions.get(subChatId)
        if (existing) {
            console.log(`[SessionManager] Cancelling old session ${existing.sessionId} for subchat ${subChatId}`)
            existing.abortController.abort()
            this.sessions.delete(subChatId)
        }

        // Register new session
        this.sessions.set(subChatId, {
            sessionId,
            subChatId,
            abortController,
            startTime: Date.now()
        })
        console.log(`[SessionManager] Registered session ${sessionId} for subchat ${subChatId}`)
    }

    /**
     * Unregister a session when it completes
     */
    unregisterSession(subChatId: string): void {
        const session = this.sessions.get(subChatId)
        if (session) {
            console.log(`[SessionManager] Unregistered session ${session.sessionId} for subchat ${subChatId}`)
            this.sessions.delete(subChatId)
        }
    }

    /**
     * Cancel a specific session
     */
    cancelSession(subChatId: string): void {
        const session = this.sessions.get(subChatId)
        if (session) {
            console.log(`[SessionManager] Cancelling session ${session.sessionId} for subchat ${subChatId}`)
            session.abortController.abort()
            this.sessions.delete(subChatId)
        }
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): ActiveSession[] {
        return Array.from(this.sessions.values())
    }

    /**
     * Check if a subchat has an active session
     */
    hasActiveSession(subChatId: string): boolean {
        return this.sessions.has(subChatId)
    }
}

// Global singleton instance
export const sessionManager = new OpenCodeSessionManager()
