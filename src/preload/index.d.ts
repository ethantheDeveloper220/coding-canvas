export interface DesktopApi {
  getVersion: () => Promise<string>
  checkUpdate: () => Promise<{ version: string; downloadUrl: string } | null>
  getPlatform: () => Promise<NodeJS.Platform>
  getUser: () => Promise<{
    id: string
    email: string
    name: string | null
    imageUrl: string | null
    username: string | null
  } | null>
  isAuthenticated: () => Promise<boolean>
  logout: () => Promise<void>
  startAuthFlow: () => Promise<void>
  onAuthSuccess: (callback: (user: any) => void) => () => void
  onAuthError: (callback: (error: string) => void) => () => void
}

declare global {
  interface Window {
    desktopApi?: DesktopApi
  }
}
