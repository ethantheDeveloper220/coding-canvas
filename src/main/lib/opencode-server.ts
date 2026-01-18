import { spawn } from "child_process"
import http from "http"
import { getOpenCodeUrl, setOpenCodeUrl } from "./opencode-state"

const SERVER_PORT = 4096
const SERVER_HOST = "localhost"
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`
const HEALTH_ENDPOINT = `${SERVER_URL}/health`
const MAX_RETRIES = 30
const RETRY_DELAY_MS = 1000

let serverProcess: ReturnType<typeof spawn> | null = null
let isStarting = false
let healthCheckRetries = 0

/**
 * Check if the OpenCode server is running by making a simple HTTP request
 */
async function isServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_ENDPOINT, (res) => {
      // Server is responding
      console.log(`[OpenCodeServer] Health check successful: ${res.statusCode}`)
      resolve(res.statusCode >= 200 && res.statusCode < 500)
      res.resume()
    })

    req.on("error", () => {
      // Server is not running
      resolve(false)
    })

    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })

    req.setTimeout(2000) // 2 second timeout
  })
}

/**
 * Wait for server to become healthy with retries
 */
async function waitForServerHealth(): Promise<boolean> {
  healthCheckRetries = 0

  while (healthCheckRetries < MAX_RETRIES) {
    console.log(
      `[OpenCodeServer] Health check attempt ${healthCheckRetries + 1}/${MAX_RETRIES}`
    )
    const isHealthy = await isServerRunning()

    if (isHealthy) {
      console.log("[OpenCodeServer] Server is healthy!")
      return true
    }

    healthCheckRetries++
    if (healthCheckRetries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  console.error(
    `[OpenCodeServer] Server failed to become healthy after ${MAX_RETRIES} attempts`
  )
  return false
}

/**
 * Start to OpenCode server using PowerShell command
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (serverProcess) {
      console.log("[OpenCodeServer] Server process already exists, reusing it")
      resolve()
      return
    }

    console.log("[OpenCodeServer] Starting OpenCode server...")
    console.log(
      `[OpenCodeServer] Command: opencode serve --port ${SERVER_PORT}`
    )

    // On Windows, spawn PowerShell to run the command
    const command = process.platform === "win32" ? "powershell.exe" : "bash"
    const args =
      process.platform === "win32"
        ? [
            "-Command",
            `opencode serve --port ${SERVER_PORT}`,
          ]
        : ["-c", `opencode serve --port ${SERVER_PORT}`]

    serverProcess = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    })

    serverProcess.stdout?.on("data", (data) => {
      console.log(`[OpenCodeServer] ${data.toString().trim()}`)
    })

    serverProcess.stderr?.on("data", (data) => {
      console.error(`[OpenCodeServer] ${data.toString().trim()}`)
    })

    serverProcess.on("error", (error) => {
      console.error("[OpenCodeServer] Failed to start server:", error)
      serverProcess = null
      isStarting = false
      reject(error)
    })

    serverProcess.on("exit", (code, signal) => {
      console.log(
        `[OpenCodeServer] Server process exited with code ${code}, signal ${signal}`
      )
      serverProcess = null
      isStarting = false
    })

    // Give it a moment to start
    setTimeout(() => {
      console.log("[OpenCodeServer] Server process started")
      resolve()
    }, 500)
  })
}

/**
 * Stop the OpenCode server (optional cleanup)
 */
function stopServer(): void {
  if (serverProcess) {
    console.log("[OpenCodeServer] Stopping server...")
    serverProcess.kill()
    serverProcess = null
    isStarting = false
  }
}

/**
 * Ensure to OpenCode server is running
 * This is the main entry point that will be called during app startup
 */
export async function ensureServerReady(): Promise<{ url: string; healthy: boolean }> {
  console.log("[OpenCodeServer] Checking if server is ready...")

  // Check if already running
  const isRunning = await isServerRunning()
  if (isRunning) {
    console.log("[OpenCodeServer] Server is already running")
    setOpenCodeUrl(SERVER_URL)
    return { url: SERVER_URL, healthy: true }
  }

  // Prevent concurrent startup attempts
  if (isStarting) {
    console.log("[OpenCodeServer] Server is already starting, waiting...")
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return ensureServerReady() // Retry after waiting
  }

  isStarting = true

  try {
    // Start the server
    await startServer()

    // Wait for it to become healthy
    const isHealthy = await waitForServerHealth()

    if (isHealthy) {
      setOpenCodeUrl(SERVER_URL)
      return { url: SERVER_URL, healthy: true }
    } else {
      throw new Error("Server failed to start or become healthy")
    }
  } catch (error) {
    console.error("[OpenCodeServer] Failed to ensure server is ready:", error)
    throw error
  } finally {
    isStarting = false
  }
}

/**
 * Get current server status for UI updates with connection details
 */
export async function getServerStatus(): Promise<{
  running: boolean
  url: string
  connected?: boolean
}> {
  const running = await isServerRunning()
  return {
    running,
    url: SERVER_URL,
    connected: running,
  }
}

/**
 * Clean shutdown function - called when app closes
 */
export function cleanupServer(): void {
  stopServer()
}
