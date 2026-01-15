/**
 * Shared configuration for the desktop app
 */

// API URLs
const API_URLS = {
  production: "https://21st.dev",
  development: "http://localhost:3000",
} as const

const IS_DEV = !!process.env.ELECTRON_RENDERER_URL

/**
 * Get the API base URL based on environment
 */
export function getApiUrl(): string {
  return IS_DEV ? API_URLS.development : API_URLS.production
}

/**
 * Check if running in development mode
 */
export function isDev(): boolean {
  return IS_DEV
}
