/**
 * Web-compatible API stub for desktopApi
 * Provides browser-compatible implementations of Electron APIs
 */

/**
 * Check if running in web mode (browser)
 * Check for Electron-specific globals that wouldn't exist in a browser
 * 
 * Note: We check for electronTRPC specifically because it's set by the Electron
 * preload script and won't exist in a browser. We don't check for desktopApi
 * because we set it ourselves in web mode.
 */
export function isWebMode(): boolean {
  if (typeof window === "undefined") return false
  
  // Check if we're in Electron by looking for electronTRPC
  // This is set by the Electron preload script and won't exist in a browser
  const hasElectronTRPC = typeof (window as any).electronTRPC !== "undefined"
  
  // If we have electronTRPC, we're in Electron
  if (hasElectronTRPC) return false
  
  // Otherwise, we're in a browser (web mode)
  return true
}

export const isWeb = isWebMode()

/**
 * Web-compatible desktopApi stub
 */
export const webApi = {
  platform: "web" as NodeJS.Platform,
  arch: typeof navigator !== "undefined" && (navigator as any).userAgentData?.platform || "unknown",
  getVersion: async () => "web",
  
  // Auto-update (not applicable in web)
  checkForUpdates: async () => null,
  downloadUpdate: async () => false,
  installUpdate: () => {},
  onUpdateChecking: () => () => {},
  onUpdateAvailable: () => () => {},
  onUpdateNotAvailable: () => () => {},
  onUpdateProgress: () => () => {},
  onUpdateDownloaded: () => () => {},
  onUpdateError: () => () => {},
  onUpdateManualCheck: () => () => {},
  
  // Window controls (not applicable in web)
  windowMinimize: async () => {},
  windowMaximize: async () => {},
  windowClose: async () => {},
  windowIsMaximized: async () => false,
  windowToggleFullscreen: async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  },
  windowIsFullscreen: async () => !!document.fullscreenElement,
  setTrafficLightVisibility: async () => {},
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const handler = () => callback(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  },
  onFocusChange: (callback: (isFocused: boolean) => void) => {
    const handler = () => callback(document.hasFocus())
    window.addEventListener("focus", handler)
    window.addEventListener("blur", handler)
    return () => {
      window.removeEventListener("focus", handler)
      window.removeEventListener("blur", handler)
    }
  },
  
  // Zoom controls (use browser zoom)
  zoomIn: async () => {
    // Browser zoom is handled by the browser
    console.log("[Web] Zoom in - use browser zoom (Ctrl/Cmd +)")
  },
  zoomOut: async () => {
    console.log("[Web] Zoom out - use browser zoom (Ctrl/Cmd -)")
  },
  zoomReset: async () => {
    console.log("[Web] Zoom reset - use browser zoom (Ctrl/Cmd 0)")
  },
  getZoom: async () => 1,
  
  // DevTools (use browser DevTools)
  toggleDevTools: async () => {
    console.log("[Web] Use browser DevTools (F12)")
  },
  
  // Analytics
  setAnalyticsOptOut: async (optedOut: boolean) => {
    localStorage.setItem("preferences:analytics-opt-out", String(optedOut))
  },
  
  // Native features
  setBadge: async () => {
    // Browser notifications badge
    if ("setAppBadge" in navigator) {
      // @ts-ignore
      await navigator.setAppBadge()
    }
  },
  showNotification: async (options: { title: string; body: string }) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(options.title, { body: options.body })
    } else if ("Notification" in window && Notification.permission !== "denied") {
      const permission = await Notification.requestPermission()
      if (permission === "granted") {
        new Notification(options.title, { body: options.body })
      }
    }
  },
  openExternal: async (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  },
  getApiBaseUrl: async () => {
    return typeof window !== "undefined" ? window.location.origin : ""
  },
  
  // Clipboard
  clipboardWrite: async (text: string) => {
    await navigator.clipboard.writeText(text)
  },
  clipboardRead: async () => {
    return await navigator.clipboard.readText()
  },
  
  // Auth methods (web-compatible)
  getUser: async () => {
    // Get from localStorage or sessionStorage
    const userStr = localStorage.getItem("auth:user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
    return null
  },
  isAuthenticated: async () => {
    const userStr = localStorage.getItem("auth:user")
    return !!userStr
  },
  logout: async () => {
    localStorage.removeItem("auth:user")
    localStorage.removeItem("auth:token")
    window.location.reload()
  },
  startAuthFlow: async () => {
    // Redirect to auth page
    const authUrl = `${window.location.origin}/auth`
    window.location.href = authUrl
  },
  submitAuthCode: async (code: string) => {
    // Handle auth code submission
    // This would typically make a fetch request to your auth endpoint
    console.log("[Web] Auth code submitted:", code)
  },
  onAuthSuccess: (callback: (user: any) => void) => {
    // Listen for auth success events
    const handler = (event: StorageEvent) => {
      if (event.key === "auth:user" && event.newValue) {
        try {
          callback(JSON.parse(event.newValue))
        } catch {
          // Ignore parse errors
        }
      }
    }
    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  },
  onAuthError: (callback: (error: string) => void) => {
    // Listen for auth error events
    const handler = (event: CustomEvent) => {
      callback(event.detail)
    }
    window.addEventListener("auth:error", handler as EventListener)
    return () => window.removeEventListener("auth:error", handler as EventListener)
  },
  
  // Shortcuts
  onShortcutNewAgent: (callback: () => void) => {
    // Listen for keyboard shortcuts
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  },
  
  // File changes (not applicable in web)
  onFileChanged: () => () => {},
  
  // OpenCode server methods
  ensureOpenCodeServerReady: async () => {
    // In web mode, OpenCode server would need to be running separately
    // or accessed via API
    return { url: "http://localhost:4098", healthy: false }
  },
  getOpenCodeServerStatus: async () => {
    try {
      const response = await fetch("http://localhost:4098/health")
      return {
        running: response.ok,
        url: "http://localhost:4098",
        healthy: response.ok,
      }
    } catch {
      return {
        running: false,
        url: "http://localhost:4098",
        healthy: false,
      }
    }
  },
}

// Expose webApi as desktopApi in web mode
// Do this immediately to ensure it's available before other modules check for it
if (typeof window !== "undefined" && isWebMode()) {
  (window as any).desktopApi = webApi
}
