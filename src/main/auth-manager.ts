import { AuthStore, AuthData, AuthUser } from "./auth-store"
import { app, BrowserWindow } from "electron"

// API URLs
const API_URLS = {
  production: "https://21st.dev",
  development: "https://21st.dev",
} as const

export class AuthManager {
  private store: AuthStore
  private refreshTimer?: NodeJS.Timeout
  private isDev: boolean
  private onTokenRefresh?: (authData: AuthData) => void

  constructor(isDev: boolean = false) {
    this.store = new AuthStore(app.getPath("userData"))
    this.isDev = isDev

    // Schedule refresh if already authenticated
    if (this.store.isAuthenticated()) {
      this.scheduleRefresh()
    }
  }

  /**
   * Set callback to be called when token is refreshed
   * This allows the main process to update cookies when tokens change
   */
  setOnTokenRefresh(callback: (authData: AuthData) => void): void {
    this.onTokenRefresh = callback
  }

  private getApiUrl(): string {
    return this.isDev ? API_URLS.development : API_URLS.production
  }

  private activeExchange: { code: string, promise: Promise<AuthData> } | null = null

  /**
   * Exchange auth code for session tokens
   * Called after receiving code via deep link
   */
  async exchangeCode(code: string): Promise<AuthData> {
    // Deduplicate concurrent requests for the same code
    if (this.activeExchange && this.activeExchange.code === code) {
      console.log("[Auth] Joining existing exchange for code")
      return this.activeExchange.promise
    }

    const exchangeTask = async () => {
      const response = await fetch(`${this.getApiUrl()}/api/auth/desktop/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          deviceInfo: this.getDeviceInfo(),
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(error.error || `Exchange failed: ${response.status}`)
      }

      const data = await response.json()

      const authData: AuthData = {
        token: data.token,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user,
      }

      this.store.save(authData)
      this.scheduleRefresh()

      return authData
    }

    this.activeExchange = { code, promise: exchangeTask() }

    try {
      return await this.activeExchange.promise
    } finally {
      this.activeExchange = null
    }
  }

  /**
   * Get device info for session tracking
   */
  private getDeviceInfo(): string {
    const platform = process.platform
    const arch = process.arch
    const version = app.getVersion()
    return `21st Desktop ${version} (${platform} ${arch})`
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getValidToken(): Promise<string | null> {
    if (!this.store.isAuthenticated()) {
      return null
    }

    if (this.store.needsRefresh()) {
      await this.refresh()
    }

    return this.store.getToken()
  }

  /**
   * Refresh the current session
   */
  async refresh(): Promise<boolean> {
    const refreshToken = this.store.getRefreshToken()
    if (!refreshToken) {
      console.warn("No refresh token available")
      return false
    }

    try {
      const response = await fetch(`${this.getApiUrl()}/api/auth/desktop/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        console.error("Refresh failed:", response.status)
        // If refresh fails, clear auth and require re-login
        if (response.status === 401) {
          this.logout()
        }
        return false
      }

      const data = await response.json()

      const authData: AuthData = {
        token: data.token,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        user: data.user,
      }

      this.store.save(authData)
      this.scheduleRefresh()

      // Notify callback about token refresh (so cookie can be updated)
      if (this.onTokenRefresh) {
        this.onTokenRefresh(authData)
      }

      return true
    } catch (error) {
      console.error("Refresh error:", error)
      return false
    }
  }

  /**
   * Schedule token refresh before expiration
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    const authData = this.store.load()
    if (!authData) return

    const expiresAt = new Date(authData.expiresAt).getTime()
    const now = Date.now()

    // Refresh 5 minutes before expiration
    const refreshIn = Math.max(0, expiresAt - now - 5 * 60 * 1000)

    this.refreshTimer = setTimeout(() => {
      this.refresh()
    }, refreshIn)

    console.log(`Scheduled token refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`)
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.store.isAuthenticated()
  }

  /**
   * Get current user
   */
  getUser(): AuthUser | null {
    return this.store.getUser()
  }

  /**
   * Get current auth data
   */
  getAuth(): AuthData | null {
    return this.store.load()
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = undefined
    }
    this.store.clear()
  }

  /**
   * Start auth flow by opening browser
   */
  startAuthFlow(mainWindow: BrowserWindow | null): void {
    const { shell } = require("electron")

    let authUrl = `${this.getApiUrl()}/auth/desktop?auto=true`

    // In dev mode, use localhost callback (we run HTTP server on port 21321)
    // Also pass the protocol so web knows which deep link to use as fallback
    if (this.isDev) {
      authUrl += `&callback=${encodeURIComponent("http://localhost:21321/auth/callback")}`
      // Pass dev protocol so production web can use correct deep link if callback fails
      authUrl += `&protocol=twentyfirst-agents-dev`
    }

    // Open auth in internal "Bridge" window to capture callback
    const authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    })

    // Handle callback interception
    const handleUrl = (url: string) => {
      try {
        const parsed = new URL(url)
        // Check for callback (either custom protocol or localhost)
        if (url.includes("code=") && (url.includes("localhost:21321") || url.startsWith("twentyfirst-agents"))) {
          const code = parsed.searchParams.get("code")
          if (code) {
            this.exchangeCode(code)
              .then(() => {
                authWindow.close()
                // Focus main window
                if (mainWindow) {
                  mainWindow.focus()
                }
              })
              .catch(err => {
                console.error("Auth bridge failed:", err)
              })
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    authWindow.webContents.on('will-redirect', (_, url) => handleUrl(url))
    authWindow.webContents.on('will-navigate', (_, url) => handleUrl(url))

    authWindow.loadURL(authUrl)
  }

  /**
   * Manually set auth data (e.g. from manual token paste)
   */
  async setManualAuth(tokenOrJson: string): Promise<void> {
    try {
      // Try parsing as full AuthData JSON
      if (tokenOrJson.trim().startsWith("{")) {
        const data = JSON.parse(tokenOrJson) as AuthData
        if (data.token && data.user) {
          this.store.save(data)
          this.scheduleRefresh()
          if (this.onTokenRefresh) this.onTokenRefresh(data)
          return
        }
      }

      // Fallback: Treat as Bearer token and fetch user
      const response = await fetch(`${this.getApiUrl()}/api/user/me`, {
        headers: { "Authorization": `Bearer ${tokenOrJson}` }
      })

      if (response.ok) {
        const user = await response.json()
        const data: AuthData = {
          token: tokenOrJson,
          refreshToken: "", // No refresh token available
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user: user
        }
        this.store.save(data)
        this.scheduleRefresh()
        if (this.onTokenRefresh) this.onTokenRefresh(data)
      } else {
        throw new Error("Invalid token")
      }
    } catch (e) {
      console.error("Manual auth failed:", e)
      throw e
    }
  }
}
