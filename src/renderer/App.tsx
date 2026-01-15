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
 * Main content router - decides which page to show based on route and onboarding state
 */
function AppContent() {
  const [currentRoute, setCurrentRoute] = useState(window.location.hash || "#/")

  const anthropicOnboardingCompleted = useAtomValue(
    anthropicOnboardingCompletedAtom
  )
  const selectedProject = useAtomValue(selectedProjectAtom)

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash || "#/")
    }
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
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

  // Route handling
  if (currentRoute === "#/" || currentRoute === "") {
    return <LandingPage />
  }

  if (currentRoute === "#/pricing") {
    return <PricingPage />
  }

  // For app routes, check onboarding state
  // 1. Anthropic onboarding not completed -> AnthropicOnboardingPage
  // 2. No valid project selected -> SelectRepoPage
  // 3. Otherwise -> AgentsLayout
  if (!anthropicOnboardingCompleted) {
    return <AnthropicOnboardingPage />
  }

  if (!validatedProject && !isLoadingProjects) {
    return <SelectRepoPage />
  }

  return <AgentsLayout />
}

export function App() {
  // Initialize analytics on mount
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

    // Cleanup on unmount
    return () => {
      shutdown()
    }
  }, [])

  return (
    <JotaiProvider store={appStore}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <VSCodeThemeProvider>
          <TooltipProvider delayDuration={100}>
            <TRPCProvider>
              <div
                data-agents-page
                className="h-screen w-screen bg-background text-foreground overflow-hidden"
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
