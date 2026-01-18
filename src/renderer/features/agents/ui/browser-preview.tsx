"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useAtom } from "jotai"
import { Button } from "../../../components/ui/button"
import { RotateCw, ExternalLinkIcon } from "lucide-react"
import {
  IconDoubleChevronRight,
  IconChatBubble,
} from "../../../components/ui/icons"
import { PreviewUrlInput } from "./preview-url-input"
import { previewPathAtomFamily } from "../atoms"
import { cn } from "../../../lib/utils"
import { atomWithStorage } from "jotai/utils"

// Atom to persist localhost URL per chat (full URL for iframe src)
export const browserPreviewUrlAtomFamily = (chatId: string) =>
  atomWithStorage<string>(`browser-preview-url-${chatId}`, "http://localhost:3000")

interface BrowserPreviewProps {
  chatId: string
  hideHeader?: boolean
  onClose?: () => void
  isMobile?: boolean
}

export function BrowserPreview({
  chatId,
  hideHeader = false,
  onClose,
  isMobile = false,
}: BrowserPreviewProps) {
  // Memoize atoms to prevent creating new ones on every render
  const browserPreviewUrlAtom = useMemo(
    () => browserPreviewUrlAtomFamily(chatId),
    [chatId]
  )
  const previewPathAtom = useMemo(
    () => previewPathAtomFamily(chatId),
    [chatId]
  )

  // Full URL atom (e.g., "http://localhost:3000")
  const [baseUrl, setBaseUrl] = useAtom(browserPreviewUrlAtom)
  // Path atom (e.g., "/dashboard")
  const [currentPath, setCurrentPath] = useAtom(previewPathAtom)
  const [isLoaded, setIsLoaded] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Parse base URL to extract host and protocol
  const baseHost = useMemo(() => {
    try {
      const url = new URL(baseUrl)
      return url.host // e.g., "localhost:3000"
    } catch {
      return null
    }
  }, [baseUrl])

  // Compute full preview URL from base URL + path
  const previewUrl = useMemo(() => {
    try {
      const url = new URL(baseUrl)
      // Preserve pathname from base URL if it exists, otherwise use currentPath
      const basePath = url.pathname !== '/' ? url.pathname : ''
      const fullPath = basePath + currentPath
      url.pathname = fullPath || '/'
      return url.toString()
    } catch {
      return baseUrl + currentPath
    }
  }, [baseUrl, currentPath])

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.chatId === chatId && e.detail?.url) {
        try {
          const newUrl = new URL(e.detail.url)
          // Update base URL (preserve path if already set)
          const newBaseUrl = `${newUrl.protocol}//${newUrl.host}`
          setBaseUrl(newBaseUrl)
          // Update path if provided in the URL
          if (newUrl.pathname && newUrl.pathname !== '/') {
            setCurrentPath(newUrl.pathname + newUrl.search + newUrl.hash)
          }
          setIsLoaded(false)
        } catch {
          // If URL parsing fails, just set it as-is
          setBaseUrl(e.detail.url)
          setIsLoaded(false)
        }
      }
    }

    window.addEventListener("open-browser-preview", handler as EventListener)
    return () => window.removeEventListener("open-browser-preview", handler as EventListener)
  }, [chatId]) // Only depend on chatId - setters are stable when atoms are memoized

  const handleReload = useCallback(() => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setIsLoaded(false)
    setReloadKey((prev) => prev + 1)
    setTimeout(() => setIsRefreshing(false), 400)
  }, [isRefreshing])

  // Handle path changes from PreviewUrlInput
  const handlePathChange = useCallback((path: string) => {
    setCurrentPath(path)
    setIsLoaded(false)
  }, [setCurrentPath])

  return (
    <div
      className={cn(
        "flex flex-col bg-tl-background",
        isMobile ? "h-full w-full" : "h-full",
      )}
    >
      {/* Mobile Header */}
      {isMobile && !hideHeader && (
        <div
          className="flex-shrink-0 bg-background/95 backdrop-blur border-b h-11 min-h-[44px] max-h-[44px]"
          data-mobile-browser-preview-header
          style={{
            // @ts-expect-error - WebKit-specific property for Electron window dragging
            WebkitAppRegion: "drag",
          }}
        >
          <div
            className="flex h-full items-center px-2 gap-2"
            style={{
              // @ts-expect-error - WebKit-specific property
              WebkitAppRegion: "no-drag",
            }}
          >
            {/* Chat button */}
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
              >
                <IconChatBubble className="h-4 w-4" />
                <span className="sr-only">Back to chat</span>
              </Button>
            )}

            {/* Reload button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReload}
              disabled={isRefreshing}
              className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
            >
              <RotateCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
            </Button>

            {/* Path Input using PreviewUrlInput */}
            {baseHost && (
              <div className="flex-1 min-w-0 mx-1">
                <PreviewUrlInput
                  baseHost={baseHost}
                  currentPath={currentPath}
                  onPathChange={handlePathChange}
                  isLoading={!isLoaded}
                  variant="mobile"
                />
              </div>
            )}
            {!baseHost && (
              <div className="flex-1 min-w-0 mx-1 text-xs text-muted-foreground truncate text-center">
                {baseUrl}
              </div>
            )}

            {/* External link button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(previewUrl, "_blank")}
              className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
            >
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      {!isMobile && !hideHeader && (
        <div className="flex items-center justify-between px-3 h-10 bg-tl-background flex-shrink-0">
          {/* Left: Refresh */}
          <div className="flex items-center gap-1 flex-1">
            <Button
              variant="ghost"
              onClick={handleReload}
              disabled={isRefreshing}
              className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md"
            >
              <RotateCw
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground",
                  isRefreshing && "animate-spin",
                )}
              />
            </Button>
          </div>

          {/* Center: Path Input using PreviewUrlInput */}
          <div className="flex-1 mx-2 min-w-0 flex items-center justify-center">
            {baseHost ? (
              <PreviewUrlInput
                baseHost={baseHost}
                currentPath={currentPath}
                onPathChange={handlePathChange}
                isLoading={!isLoaded}
                variant="default"
              />
            ) : (
              <div className="text-xs text-muted-foreground truncate text-center max-w-[350px]">
                {baseUrl}
              </div>
            )}
          </div>

          {/* Right: External link + Close */}
          <div className="flex items-center justify-end gap-1 flex-1">
            <Button
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md"
              onClick={() => window.open(previewUrl, "_blank")}
            >
              <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>

            {onClose && (
              <Button
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] rounded-md"
                onClick={onClose}
              >
                <IconDoubleChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          "flex-1 relative flex items-center justify-center overflow-hidden",
          isMobile ? "w-full h-full" : "px-1 pb-1",
        )}
      >
        <div className="relative overflow-hidden w-full h-full flex-shrink-0 bg-background border-[0.5px] rounded-sm">
          <iframe
            ref={iframeRef}
            key={reloadKey}
            src={previewUrl}
            width="100%"
            height="100%"
            style={{ border: "none", borderRadius: "8px" }}
            title="Browser Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-top-navigation"
            onLoad={() => setIsLoaded(true)}
            onError={() => setIsLoaded(true)}
          />

          {/* Loading overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10 rounded-[inherit]">
              <div className="w-6 h-6 animate-pulse">
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-label="21st logo"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M358.333 0C381.345 0 400 18.6548 400 41.6667V295.833C400 298.135 398.134 300 395.833 300H270.833C268.532 300 266.667 301.865 266.667 304.167V395.833C266.667 398.134 264.801 400 262.5 400H41.6667C18.6548 400 0 381.345 0 358.333V304.72C0 301.793 1.54269 299.081 4.05273 297.575L153.76 207.747C157.159 205.708 156.02 200.679 152.376 200.065L151.628 200H4.16667C1.86548 200 6.71103e-08 198.135 0 195.833V104.167C1.07376e-06 101.865 1.86548 100 4.16667 100H162.5C164.801 100 166.667 98.1345 166.667 95.8333V4.16667C166.667 1.86548 168.532 1.00666e-07 170.833 0H358.333ZM170.833 100C168.532 100 166.667 101.865 166.667 104.167V295.833C166.667 298.135 168.532 300 170.833 300H262.5C264.801 300 266.667 298.135 266.667 295.833V104.167C266.667 101.865 264.801 100 262.5 100H170.833Z"
                    fill="currentColor"
                    className="text-muted-foreground"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
