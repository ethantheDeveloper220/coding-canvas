/**
 * Web-compatible tRPC context
 * No BrowserWindow in web mode
 */
export async function createContext() {
  return {
    getWindow: () => null,
  }
}
