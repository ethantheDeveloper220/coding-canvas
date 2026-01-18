import { createServer } from "http"
import { parse } from "url"
import { readFileSync, existsSync } from "fs"
import { join, extname } from "path"
import { createContext } from "./trpc-context"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { initDatabase, getDatabase as getWebDatabase } from "./db"

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

// Prevent Sentry from trying to access Electron APIs in web mode
// Mock Electron before any Sentry code runs
if (!process.versions.electron) {
  process.versions.electron = "0.0.0"
}

// Mock Electron module for Sentry (must be done before any Sentry imports)
const Module = require("module")
const originalRequire = Module.prototype.require

Module.prototype.require = function(id: string) {
  if (id === "electron") {
    try {
      // Try to get real electron
      return originalRequire.apply(this, arguments)
    } catch {
      // Return mock electron module
      return {
        app: {
          getAppPath: () => process.cwd(),
          getVersion: () => "0.0.0",
          isPackaged: false,
          isReady: () => false,
        },
        BrowserWindow: null,
        safeStorage: null,
      }
    }
  }
  return originalRequire.apply(this, arguments)
}

// Initialize database (optional - server can run without it)
let dbInitialized = false
try {
  initDatabase()
  console.log("[Server] Database initialized")
  dbInitialized = true
  
  // Patch the main db module to use web database
  // This allows routers to use getDatabase() without changes
  const mainDbModule = require("../main/lib/db")
  if (mainDbModule) {
    // Override getDatabase to return web database
    mainDbModule.getDatabase = getWebDatabase
    // Also override initDatabase to return web database
    mainDbModule.initDatabase = () => {
      initDatabase()
      return getWebDatabase()
    }
  }
} catch (error) {
  console.warn("[Server] Database initialization failed (some features may not work):", error.message)
  console.warn("[Server] To fix: Run 'npm rebuild better-sqlite3' or 'npm install' to rebuild native modules")
  // Continue anyway - server can run without database for basic features
}

// Import router after setting fake electron version
// This prevents Sentry from trying to access real Electron APIs
const { createAppRouter } = require("../main/lib/trpc/routers")

// Create tRPC router with web-compatible context
const appRouter = createAppRouter(() => null) // No window in web mode

// MIME types
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
}

// Get the base directory for static files
function getStaticDir() {
  // In production, serve from out/web
  // In development, serve from out/renderer or use Vite dev server
  if (process.env.NODE_ENV === "production") {
    return join(__dirname, "../web")
  }
  return join(__dirname, "../renderer")
}

// Serve static files
function serveStaticFile(filePath: string, res: any) {
  if (!existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain" })
    res.end("Not found")
    return
  }

  const ext = extname(filePath)
  const contentType = mimeTypes[ext] || "application/octet-stream"

  try {
    const content = readFileSync(filePath)
    res.writeHead(200, { "Content-Type": contentType })
    res.end(content)
  } catch (error) {
    console.error("[Server] Error serving file:", error)
    res.writeHead(500, { "Content-Type": "text/plain" })
    res.end("Internal server error")
  }
}

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || "", true)
  const { pathname } = parsedUrl

  // Handle tRPC requests
  if (pathname?.startsWith("/api/trpc/")) {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: req as any,
      router: appRouter,
      createContext: async () => createContext(),
      onError: ({ error, path }) => {
        console.error(`[tRPC] Error on path ${path}:`, error)
      },
    })

    // Copy response headers and status
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    // Stream response body
    const body = await response.text()
    res.end(body)
    return
  }

  // Serve static files
  const staticDir = getStaticDir()
  
  if (pathname === "/" || pathname === "/index.html" || !pathname) {
    const indexPath = join(staticDir, "index.html")
    serveStaticFile(indexPath, res)
    return
  }

  // Serve other static files
  if (pathname) {
    const filePath = join(staticDir, pathname)
    serveStaticFile(filePath, res)
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("Not found")
})

server.listen(PORT, () => {
  console.log(`[Server] Ready on http://localhost:${PORT}`)
})
