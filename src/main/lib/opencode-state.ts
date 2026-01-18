import { isDev } from './config'

/**
 * Shared state for OpenCode API URL
 * Used to coordinate between opencode router (settings) and claude router (execution)
 */
let openCodeUrl = "http://localhost:4096"

export const getOpenCodeUrl = () => openCodeUrl
export const setOpenCodeUrl = (url: string) => {
    openCodeUrl = url
    console.log('[OpenCodeState] URL updated to:', url)
}

/**
 * OpenCode API Key storage
 */
let openCodeApiKey: string | null = process.env.OPENCODE_API_KEY || 'csb_v1_WxklWdEqoHS_6ba92VUclLZrbibLvEWa8ssF0zvdtc0'

export const getOpenCodeApiKey = () => openCodeApiKey
export const setOpenCodeApiKey = (key: string) => {
    openCodeApiKey = key
    console.log('[OpenCodeState] API key updated')
}
