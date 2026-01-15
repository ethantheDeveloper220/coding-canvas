import { isDev } from './config'

/**
 * Shared state for OpenCode API URL
 * Used to coordinate between opencode router (settings) and claude router (execution)
 */
let openCodeUrl = isDev() ? "http://localhost:51089" : "http://localhost:4096"

export const getOpenCodeUrl = () => openCodeUrl
export const setOpenCodeUrl = (url: string) => {
    openCodeUrl = url
    console.log('[OpenCodeState] URL updated to:', url)
}
