import { useEffect, useMemo, useState } from "react"
import { Provider as JotaiProvider, useAtomValue } from "jotai"
import { ThemeProvider } from "next-themes"
import { TRPCProvider } from "./contexts/TRPCProvider"
import { AgentsLayout } from "./features/layout/agents-layout"
import {
  AnthropicOnboardingPage,
  SelectRepoPage,
} from "./features/onboarding"
import { LandingPage, PricingPage } from "./features/landing"
import { TooltipProvider } from "./components/ui/tooltip"
import { appStore } from "./lib/jotai-store"
import { initAnalytics, identify, shutdown } from "./lib/analytics"
import { VSCodeThemeProvider } from "./lib/themes/theme-provider"
import { anthropicOnboardingCompletedAtom } from "./lib/atoms"
import { selectedProjectAtom } from "./features/agents/atoms"
import { trpc } from "./lib/trpc"

/**
 * Main content router - decides which page to show based on onboarding state
 */
function AppContent() {
  const anthropicOnboardingCompleted = useAtomValue(
    anthropicOnboardingCompletedAtom
  )
  const selectedProject = useAtomValue(selectedProjectAtom)

  // Hash-based routing for landing/pricing pages
  const [currentRoute, setCurrentRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setCurrentRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Fetch projects to validate selectedProject exists
  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery()

  // Validated project - only valid if exists in DB
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null
    // While loading, trust localStorage value to prevent flicker
    if (isLoadingProjects) return selectedProject
    // After loading, validate against DB
    if (!projects) return null
    const exists = projects.some((p) => p.id === selectedProject.id)
    return exists ? selectedProject : null
  }, [selectedProject, projects, isLoadingProjects])

  // Handle landing/pricing routes first
  if (currentRoute === '#/pricing') {
    return <PricingPage />
  }

  if (currentRoute === '#/' || currentRoute === '') {
    return <LandingPage />
  }

  // Determine which page to show:
  // 1. Landing/Pricing routes (handled above)
  // 2. No valid project selected -> SelectRepoPage
  // 3. Otherwise -> AgentsLayout

  // Skip Claude Code onboarding - make it optional
  // if (!anthropicOnboardingCompleted) {
  //   return <AnthropicOnboardingPage />
  // }

  if (!validatedProject && !isLoadingProjects) {
    return <SelectRepoPage />
  }

  return <AgentsLayout />
}

/**
 * Server loading component with animations and status
 */
function ServerLoadingState({
  status,
  stage,
}: {
  status: string
  stage: "checking" | "starting" | "connecting"
}) {
  const getStatusIcon = () => {
    switch (stage) {
      case "checking":
        return (
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        )
      case "starting":
        return (
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500/30 border-t-green-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
          </div>
        )
      case "connecting":
        return (
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-500 opacity-0 animate-in fade-in duration-500">
      <div className="flex flex-col items-center gap-6">
        {getStatusIcon()}
        <div className="text-center space-y-2">
          <div className="text-xl font-semibold animate-pulse">
            {stage === "checking" && "Checking Server"}
            {stage === "starting" && "Starting Server"}
            {stage === "connecting" && "Connecting to Server"}
          </div>
          <div className="text-sm text-muted-foreground max-w-md">{status}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
          <span>localhost:4096</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Server connected state with success animation
 */
function ServerConnected({ onContinue, autoContinue, onToggleAutoContinue }: {
  onContinue: () => void
  autoContinue: boolean
  onToggleAutoContinue: () => void
}) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground transition-all duration-500">
      <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-300">
        <div className="relative">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-500 animate-in fade-in zoom-in duration-300 delay-100"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
        </div>
        <div className="text-center space-y-4">
          <div className="text-2xl font-bold text-green-500 animate-in fade-in duration-300 delay-150">
            OpenCode Server Connected
          </div>
          <div className="text-sm text-muted-foreground animate-in fade-in duration-300 delay-200">
            Ready at localhost:4096
          </div>
          <button
            onClick={onContinue}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 animate-in fade-in duration-300 delay-300"
          >
            Continue
          </button>
          <label className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300 delay-400 cursor-pointer hover:text-foreground">
            <input
              type="checkbox"
              checked={autoContinue}
              onChange={(e) => {
                const newValue = e.target.checked
                localStorage.setItem("settings:auto-continue-on-connect", String(newValue))
                onToggleAutoContinue()
              }}
              className="w-4 h-4 border border-border rounded cursor-pointer accent-primary"
            />
            <span>Auto-continue next time</span>
          </label>
        </div>
      </div>
    </div>
  )
}

/**
 * Server check result component
 */
function ServerCheckFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground p-8 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-6 max-w-md">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="text-center space-y-3">
          <div className="text-2xl font-semibold text-foreground">
            Server Failed to Start
          </div>
          <div className="text-muted-foreground">
            The OpenCode server on localhost:4096 could not be started. Please ensure
            that the <code className="bg-muted px-2 py-1 rounded">opencode</code> CLI
            is installed and available in your PATH.
          </div>
        </div>
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

export function App() {
  const [serverStatus, setServerStatus] = useState<{
    loading: boolean
    status: string
    stage: "checking" | "starting" | "connecting"
    connected: boolean
    failed: boolean
    showConnectedScreen: boolean
  }>({
    loading: true,
    status: "Initializing...",
    stage: "checking",
    connected: false,
    failed: false,
    showConnectedScreen: false,
  })

  // Check if user prefers auto-continue (skip connected screen)
  const [autoContinue, setAutoContinue] = useState(() => {
    return localStorage.getItem("settings:auto-continue-on-connect") === "true"
  })

  // Initialize analytics and check server on mount
  useEffect(() => {
    initAnalytics()

    // Sync analytics opt-out status to main process
    const syncOptOutStatus = async () => {
      try {
        const optOut =
          localStorage.getItem("preferences:analytics-opt-out") === "true"
        await window.desktopApi?.setAnalyticsOptOut(optOut)
      } catch (error) {
        console.warn("[Analytics] Failed to sync opt-out status:", error)
      }
    }
    syncOptOutStatus()

    // Identify user if already authenticated
    const identifyUser = async () => {
      try {
        const user = await window.desktopApi?.getUser()
        if (user?.id) {
          identify(user.id, { email: user.email, name: user.name })
        }
      } catch (error) {
        console.warn("[Analytics] Failed to identify user:", error)
      }
    }
    identifyUser()

    // Check OpenCode server status
    const checkServer = async () => {
      try {
        // Stage 1: Check if server is already running
        setServerStatus((prev) => ({
          ...prev,
          loading: true,
          status: "Checking if server is running on localhost:4096...",
          stage: "checking",
          connected: false,
          failed: false,
        }))

        const status = await window.desktopApi?.getOpenCodeServerStatus()

        if (status?.running) {
          // Server is already running, show connected state briefly then load app
          setServerStatus({
            loading: false,
            status: "Server is ready",
            stage: "connecting",
            connected: true,
            failed: false,
            showConnectedScreen: autoContinue ? false : true,
          })

          // Show connected state for 2 seconds before loading app
          setTimeout(() => {
            setServerStatus((prev) => ({ ...prev, connected: true, loading: false }))
          }, 2000)
          return
        }

        // Stage 2: Server not running, start it
        setServerStatus((prev) => ({
          ...prev,
          loading: true,
          status: "Starting OpenCode server on localhost:4096...",
          stage: "starting",
          connected: false,
          failed: false,
        }))

        const result = await window.desktopApi?.ensureOpenCodeServerReady()

        if (result?.healthy) {
          // Server started successfully
          if (autoContinue) {
            // Auto-skip connected screen and go straight to app
            setServerStatus((prev) => ({
              ...prev,
              loading: false,
              status: "Server started successfully",
              stage: "connecting",
              connected: true,
              failed: false,
              showConnectedScreen: false,
            }))
          } else {
            // Show connected screen with continue button
            setServerStatus((prev) => ({
              ...prev,
              loading: false,
              status: "Server started successfully",
              stage: "connecting",
              connected: true,
              failed: false,
              showConnectedScreen: true,
            }))
          }
        } else {
          setServerStatus((prev) => ({
            ...prev,
            loading: false,
            status: "Server failed to start",
            stage: "connecting",
            connected: false,
            failed: true,
          }))
        }
      } catch (error) {
        console.error("[App] Server check failed:", error)
        setServerStatus((prev) => ({
          ...prev,
          loading: false,
          status: "Server check failed",
          stage: "connecting",
          connected: false,
          failed: true,
        }))
      }
    }

    checkServer()

    // Cleanup on unmount
    return () => {
      shutdown()
    }
  }, [])

  // Handle server retry
  const handleRetryServer = () => {
    setServerStatus((prev) => ({
      ...prev,
      loading: true,
      status: "Retrying...",
      stage: "checking",
      connected: false,
      failed: false,
    }))
    // Re-trigger effect by remounting (simplified approach)
    window.location.reload()
  }

  // Handle continue button click - showConnectedScreen is controlled by settings
  const handleContinue = () => {
    setServerStatus((prev) => ({ ...prev, showConnectedScreen: false }))
  }

  // Handle auto-continue toggle
  const handleToggleAutoContinue = () => {
    const newValue = !autoContinue
    setAutoContinue(newValue)
    localStorage.setItem("settings:auto-continue-on-connect", String(newValue))
  }

  // Show loading state while server is starting
  if (serverStatus.loading) {
    return (
      <ServerLoadingState status={serverStatus.status} stage={serverStatus.stage} />
    )
  }

  // Show connected state with continue button if showConnectedScreen is true
  if (serverStatus.connected && !serverStatus.loading && !serverStatus.failed && serverStatus.showConnectedScreen) {
    return (
      <ServerConnected
        onContinue={handleContinue}
        autoContinue={autoContinue}
        onToggleAutoContinue={handleToggleAutoContinue}
      />
    )
  }

  // Show error state if server failed to start
  if (serverStatus.failed) {
    return <ServerCheckFailed onRetry={handleRetryServer} />
  }

  // Only render app once server is ready and connected animation is done
  return (
    <JotaiProvider store={appStore}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <VSCodeThemeProvider>
          <TooltipProvider delayDuration={100}>
            <TRPCProvider>
              <div
                data-agents-page
                className="h-screen w-screen bg-background text-foreground overflow-hidden animate-in fade-in duration-500"
              >
                <AppContent />
              </div>
            </TRPCProvider>
          </TooltipProvider>
        </VSCodeThemeProvider>
      </ThemeProvider>
    </JotaiProvider>
  )
}
