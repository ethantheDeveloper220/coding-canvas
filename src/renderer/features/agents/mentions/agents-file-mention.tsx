"use client"

import { cn } from "../../../lib/utils"
import { api } from "../../../lib/mock-api"
import { trpc } from "../../../lib/trpc"
import { keepPreviousData } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  createElement,
  memo,
} from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import type { FileMentionOption } from "./agents-mentions-editor"
import { MENTION_PREFIXES } from "./agents-mentions-editor"
import {
  FilesIcon,
  IconSpinner,
  SkillIcon,
} from "../../../components/ui/icons"
import { TerminalSquare } from "lucide-react"
import { useAtomValue } from "jotai"
import { terminalsAtom, terminalCwdAtom } from "../../terminal/atoms"

// Custom folder icon matching design
function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none"
      className={className}
    >
      <path 
        d="M4 8V6C4 4.89543 4.89543 4 6 4H14C15.1046 4 16 4.89543 16 6M4 8H8.17548C8.70591 8 9.21462 8.21071 9.58969 8.58579L11.4181 10.4142C11.7932 10.7893 12.3019 11 12.8323 11H16M4 8C3.44987 8 3.00391 8.44597 3.00391 8.99609V18C3.00391 19.1046 3.89934 20 5.00391 20H19.0039C20.1085 20 21.0039 19.1046 21.0039 18V12.0039C21.0039 11.4495 20.5544 11 20 11M16 11V6M16 11H20M16 6H18C19.1046 6 20 6.89543 20 8V11" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinejoin="round"
      />
    </svg>
  )
}
import {
  TypeScriptIcon,
  JavaScriptIcon,
  PythonIcon,
  GoIcon,
  RustIcon,
  CodeIcon,
  ReactIcon,
  MarkdownInfoIcon,
  MarkdownIcon,
  CSSIcon,
  HTMLIcon,
  SCSSIcon,
  JSONIcon,
  YAMLIcon,
  ShellIcon,
  SQLIcon,
  GraphQLIcon,
  PrismaIcon,
  DockerIcon,
  TOMLIcon,
  JavaIcon,
  CIcon,
  CppIcon,
  CSharpIcon,
  PHPIcon,
  RubyIcon,
  KotlinIcon,
  VueIcon,
  SvelteIcon,
  AstroIcon,
  SwiftIcon,
} from "../../../icons/framework-icons"

interface ChangedFile {
  filePath: string
  displayPath: string
  additions: number
  deletions: number
}

interface AgentsFileMentionProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mention: FileMentionOption) => void
  searchText: string
  position: { top: number; left: number }
  teamId?: string
  repository?: string
  sandboxId?: string
  branch?: string // For fetching files from specific branch via GitHub API
  projectPath?: string // For fetching files from local project directory (desktop)
  changedFiles?: ChangedFile[] // Files changed in current sub-chat (shown at top)
  chatId?: string // Chat ID for terminal filtering
}

// Known file extensions with icons
const KNOWN_FILE_ICON_EXTENSIONS = new Set([
  "tsx",
  "ts",
  "js",
  "mjs",
  "cjs",
  "jsx",
  "py",
  "pyw",
  "pyi",
  "go",
  "rs",
  "md",
  "mdx",
  "css",
  "html",
  "htm",
  "scss",
  "sass",
  "json",
  "jsonc",
  "yaml",
  "yml",
  "sh",
  "bash",
  "zsh",
  "sql",
  "graphql",
  "gql",
  "prisma",
  "dockerfile",
  "toml",
  "env",
  "java",
  "c",
  "h",
  "cpp",
  "cc",
  "cxx",
  "hpp",
  "cs",
  "php",
  "rb",
  "kt",
  "vue",
  "svelte",
  "astro",
  "swift",
])

// Get file icon component based on file extension
// If returnNullForUnknown is true, returns null for unknown file types instead of default icon
export function getFileIconByExtension(
  filename: string,
  returnNullForUnknown = false,
) {
  const filenameLower = filename.toLowerCase()

  // Special handling for files without extensions (like Dockerfile)
  if (filenameLower === "dockerfile" || filenameLower.endsWith("/dockerfile")) {
    return DockerIcon
  }

  // Special handling for .env files
  // Get the base filename (without path)
  const baseFilename = filenameLower.split("/").pop() || filenameLower
  // .env (without suffix) -> TOML icon
  // .env.local, .env.example, .env.development, etc. -> Shell icon
  if (baseFilename === ".env") {
    return TOMLIcon
  }
  if (baseFilename.startsWith(".env.")) {
    // .env.local, .env.example, .env.development, etc.
    return ShellIcon
  }

  // Special handling for markdown files
  // README files -> MarkdownInfoIcon (with exclamation mark)
  // Other .md/.mdx files -> MarkdownIcon (standard markdown icon)
  if (filenameLower.endsWith(".md") || filenameLower.endsWith(".mdx")) {
    const nameWithoutExt = filenameLower.replace(/\.(md|mdx)$/, "")
    if (nameWithoutExt === "readme") {
      return MarkdownInfoIcon
    }
    return MarkdownIcon
  }

  // Special handling for JavaScript files
  // Ensure .js/.mjs/.cjs files use JavaScriptIcon, not JSONIcon
  if (
    filenameLower.endsWith(".js") ||
    filenameLower.endsWith(".mjs") ||
    filenameLower.endsWith(".cjs")
  ) {
    return JavaScriptIcon
  }

  const ext = filename.split(".").pop()?.toLowerCase() || ""

  switch (ext) {
    case "tsx":
      return ReactIcon
    case "ts":
      return TypeScriptIcon
    case "js":
    case "mjs":
    case "cjs":
      return JavaScriptIcon
    case "jsx":
      return ReactIcon
    case "py":
    case "pyw":
    case "pyi":
      return PythonIcon
    case "go":
      return GoIcon
    case "rs":
      return RustIcon
    case "md":
    case "mdx":
      // This case is handled above in special handling, but kept as fallback
      // Check if it's README
      const nameWithoutExt = filenameLower.replace(/\.(md|mdx)$/, "")
      if (nameWithoutExt === "readme") {
        return MarkdownInfoIcon
      }
      return MarkdownIcon
    case "css":
      return CSSIcon
    case "html":
    case "htm":
      return HTMLIcon
    case "scss":
    case "sass":
      return SCSSIcon
    case "json":
    case "jsonc":
      return JSONIcon
    case "yaml":
    case "yml":
      return YAMLIcon
    case "sh":
    case "bash":
    case "zsh":
      return ShellIcon
    case "sql":
      return SQLIcon
    case "graphql":
    case "gql":
      return GraphQLIcon
    case "prisma":
      return PrismaIcon
    case "dockerfile":
      return DockerIcon
    case "toml":
      return TOMLIcon
    case "env":
      // This handles .env files, but we already handled them above
      // This is a fallback for edge cases
      return TOMLIcon
    case "java":
      return JavaIcon
    case "c":
    case "h":
      return CIcon
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
      return CppIcon
    case "cs":
      return CSharpIcon
    case "php":
      return PHPIcon
    case "rb":
      return RubyIcon
    case "kt":
      return KotlinIcon
    case "vue":
      return VueIcon
    case "svelte":
      return SvelteIcon
    case "astro":
      return AstroIcon
    case "swift":
      return SwiftIcon
    default:
      return returnNullForUnknown ? null : FilesIcon
  }
}

// Create SVG icon element in DOM based on file extension or type
export function createFileIconElement(filename: string, type?: "file" | "folder" | "skill" | "terminal"): SVGSVGElement {
  const IconComponent = type === "skill"
    ? SkillIcon
    : type === "terminal"
      ? TerminalSquare
      : type === "folder" 
        ? FolderOpenIcon 
        : (getFileIconByExtension(filename) ?? FilesIcon)

  // Create a temporary container
  const container = document.createElement("div")
  container.style.display = "none"
  container.style.position = "absolute"
  container.style.visibility = "hidden"
  document.body.appendChild(container)

  // Create React element
  const iconElement = createElement(IconComponent, {
    className: "h-3 w-3 text-muted-foreground flex-shrink-0",
  })

  const root = createRoot(container)

  // Render synchronously using flushSync
  flushSync(() => {
    root.render(iconElement)
  })

  // Extract the SVG element
  const svgElement = container.querySelector("svg")

  // Clean up
  root.unmount()
  if (container.parentNode) {
    document.body.removeChild(container)
  }

  if (!svgElement || !(svgElement instanceof SVGSVGElement)) {
    // Fallback: create a simple file icon
    const fallbackSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    )
    fallbackSvg.setAttribute("width", "12")
    fallbackSvg.setAttribute("height", "12")
    fallbackSvg.setAttribute("viewBox", "0 0 24 24")
    fallbackSvg.setAttribute("fill", "none")
    fallbackSvg.setAttribute("stroke", "currentColor")
    fallbackSvg.setAttribute("stroke-width", "2")
    fallbackSvg.setAttribute("stroke-linecap", "round")
    fallbackSvg.setAttribute("stroke-linejoin", "round")
    fallbackSvg.className.baseVal =
      "h-3 w-3 text-muted-foreground flex-shrink-0"

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    path.setAttribute(
      "d",
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    )
    fallbackSvg.appendChild(path)

    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    )
    polyline.setAttribute("points", "14 2 14 8 20 8")
    fallbackSvg.appendChild(polyline)

    return fallbackSvg
  }

  // Clone the SVG to avoid issues
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement
  clonedSvg.setAttribute("class", "h-3 w-3 text-muted-foreground flex-shrink-0")

  return clonedSvg
}

// Folder icon component for consistency with file icons
function FolderIcon({ className }: { className?: string }) {
  return <FolderOpenIcon className={className} />
}

// Skill icon component (local wrapper for getOptionIcon)
function SkillIconWrapper({ className }: { className?: string }) {
  return <SkillIcon className={className} />
}

// Terminal icon component
function TerminalIconWrapper({ className }: { className?: string }) {
  return <TerminalSquare className={className} />
}

/**
 * Get icon component for a file, folder, skill, or terminal option
 */
export function getOptionIcon(option: { label: string; type?: "file" | "folder" | "skill" | "terminal" }) {
  if (option.type === "skill") {
    return SkillIconWrapper
  }
  if (option.type === "terminal") {
    return TerminalIconWrapper
  }
  if (option.type === "folder") {
    return FolderIcon
  }
  return getFileIconByExtension(option.label) ?? FilesIcon
}

/**
 * Render folder path as a tree structure for tooltip
 * e.g., "apps/web/app" becomes:
 *   📁 apps
 *     📁 web
 *       📁 app
 */
function renderFolderTree(path: string) {
  const parts = path.split("/").filter(Boolean)
  const lastIndex = parts.length - 1
  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      {parts.map((part, index) => {
        const isLast = index === lastIndex
        return (
          <div
            key={index}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              isLast ? "text-foreground" : "text-muted-foreground"
            )}
            style={{ paddingLeft: `${index * 20}px` }}
          >
            <FolderOpenIcon className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              isLast ? "text-foreground/70" : "text-muted-foreground"
            )} />
            <span className={isLast ? "font-medium" : ""}>{part}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Sort files by relevance to search query
 * Priority: exact match > starts with > shorter match > contains in filename > alphabetical
 */
function sortFilesByRelevance<T extends { label: string; path?: string }>(
  files: T[],
  searchText: string,
): T[] {
  if (!searchText) return files

  const searchLower = searchText.toLowerCase()

  return [...files].sort((a, b) => {
    const aLabelLower = a.label.toLowerCase()
    const bLabelLower = b.label.toLowerCase()

    // Get filename without extension for matching
    const aNameNoExt = aLabelLower.replace(/\.[^.]+$/, "")
    const bNameNoExt = bLabelLower.replace(/\.[^.]+$/, "")

    // Priority 1: EXACT match (chat.tsx when searching "chat")
    const aExact = aNameNoExt === searchLower
    const bExact = bNameNoExt === searchLower
    if (aExact && !bExact) return -1
    if (!aExact && bExact) return 1

    // Priority 2: filename STARTS with query
    const aStartsWith = aNameNoExt.startsWith(searchLower)
    const bStartsWith = bNameNoExt.startsWith(searchLower)
    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1

    // Priority 3: If both start with query, shorter name = higher match %
    if (aStartsWith && bStartsWith) {
      if (aNameNoExt.length !== bNameNoExt.length) {
        return aNameNoExt.length - bNameNoExt.length // shorter first
      }
    }

    // Priority 4: filename CONTAINS query (but doesn't start with it)
    const aFilenameMatch = aLabelLower.includes(searchLower)
    const bFilenameMatch = bLabelLower.includes(searchLower)
    if (aFilenameMatch && !bFilenameMatch) return -1
    if (!aFilenameMatch && bFilenameMatch) return 1

    // Finally: alphabetically by label
    return a.label.localeCompare(b.label)
  })
}

// Memoized to prevent re-renders when parent re-renders
export const AgentsFileMention = memo(function AgentsFileMention({
  isOpen,
  onClose,
  onSelect,
  searchText,
  position,
  teamId,
  repository,
  sandboxId,
  branch,
  projectPath,
  changedFiles = [],
  chatId,
}: AgentsFileMentionProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const placementRef = useRef<"above" | "below" | null>(null)
  const [debouncedSearchText, setDebouncedSearchText] = useState(searchText)

  // Tooltip state
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [tooltipContent, setTooltipContent] = useState("")
  const [tooltipType, setTooltipType] = useState<"file" | "folder" | "skill" | "terminal">("file")
  const [tooltipPlacement, setTooltipPlacement] = useState<"left" | "right">("left")
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Get terminals for this chat
  const allTerminals = useAtomValue(terminalsAtom)
  const terminalCwds = useAtomValue(terminalCwdAtom)
  const terminals = useMemo(
    () => (chatId ? allTerminals[chatId] || [] : []),
    [allTerminals, chatId],
  )

  // Fetch skills from filesystem (cached for 5 minutes)
  const { data: skills = [], isFetching: isFetchingSkills } = trpc.skills.listEnabled.useQuery(undefined, {
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // 5 minutes - skills don't change frequently
  })

  // Debounce search text (300ms to match canvas implementation)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // Fetch files from API
  // Priority: sandboxId (includes uncommitted) > branch (GitHub API) > cached file_tree
  const {
    data: fileResults = [],
    isLoading,
    isFetching,
    error,
  } = api.github.searchFiles.useQuery(
    {
      teamId: teamId!,
      repository: repository!,
      query: debouncedSearchText || "",
      limit: 50,
      sandboxId: sandboxId,
      branch: branch, // Pass branch for GitHub API fetch
      projectPath: projectPath, // For local project file search (desktop)
    },
    {
      // Enable if we have projectPath (desktop) OR teamId with repository/sandboxId/branch (web)
      enabled: isOpen && (!!projectPath || (!!teamId && (!!repository || !!sandboxId || !!branch))),
      staleTime: 5000,
      refetchOnWindowFocus: false,
      // Keep showing previous results while fetching new ones
      placeholderData: keepPreviousData,
    },
  )
  // Convert changed files to options (shown at top in separate group)
  const changedFileOptions: FileMentionOption[] = useMemo(() => {
    if (!changedFiles.length) return []

    const searchLower = debouncedSearchText.toLowerCase()

    const mapped = changedFiles
      .filter(
        (file) =>
          !searchLower || file.filePath.toLowerCase().includes(searchLower),
      )
      .map((file) => {
        const pathParts = file.filePath.split("/")
        const fileName = pathParts.pop() || file.filePath
        const dirPath = pathParts.join("/") || "/"

        return {
          id: `changed:${file.filePath}`,
          label: fileName,
          path: file.filePath,
          repository: repository || "",
          truncatedPath: dirPath,
          additions: file.additions,
          deletions: file.deletions,
        }
      })

    // Sort by relevance using shared function
    return sortFilesByRelevance(mapped, debouncedSearchText)
  }, [changedFiles, debouncedSearchText, repository])

  // Convert API results to options with truncated path
  // Exclude files that are already in changedFileOptions
  const changedFilePaths = useMemo(
    () => new Set(changedFiles.map((f) => f.filePath)),
    [changedFiles],
  )

  const repoFileOptions: FileMentionOption[] = useMemo(() => {
    const mapped = fileResults
      .filter((file) => !changedFilePaths.has(file.path))
      .map((file) => {
        // Get directory path (without filename/foldername) for inline display
        const pathParts = file.path.split("/")
        const dirPath = pathParts.slice(0, -1).join("/") || "/"

        return {
          id: file.id,
          label: file.label,
          path: file.path,
          repository: file.repository,
          truncatedPath: dirPath,
          type: (file as { type?: "file" | "folder" }).type,
        }
      })

    // Sort by relevance using shared function
    return sortFilesByRelevance(mapped, debouncedSearchText)
  }, [fileResults, changedFilePaths, debouncedSearchText])

  // Convert skills to mention options
  const skillOptions: FileMentionOption[] = useMemo(() => {
    const searchLower = debouncedSearchText.toLowerCase()
    
    return skills
      .filter(skill => 
        !searchLower || 
        skill.name.toLowerCase().includes(searchLower) ||
        skill.description.toLowerCase().includes(searchLower)
      )
      .map(skill => ({
        id: `${MENTION_PREFIXES.SKILL}${skill.name}`,
        label: skill.name,
        path: skill.description,
        repository: "",
        truncatedPath: skill.description,
        type: "skill" as const,
      }))
  }, [skills, debouncedSearchText])

  // Convert terminals to mention options
  const terminalOptions: FileMentionOption[] = useMemo(() => {
    const searchLower = debouncedSearchText.toLowerCase()
    
    return terminals
      .filter(terminal => 
        !searchLower || 
        terminal.name.toLowerCase().includes(searchLower)
      )
      .map(terminal => {
        const cwd = terminalCwds[terminal.paneId] || ""
        return {
          id: `${MENTION_PREFIXES.TERMINAL}${terminal.id}`,
          label: terminal.name,
          path: cwd,
          repository: "",
          truncatedPath: cwd,
          type: "terminal" as const,
          terminalId: terminal.id,
          paneId: terminal.paneId,
        }
      })
  }, [terminals, terminalCwds, debouncedSearchText])

  // Combined options for keyboard navigation
  // When searching: merge all and sort globally (filename matches first)
  // When not searching: keep groups separate (skills first, then terminals, then changed files, then repo files)
  const options: FileMentionOption[] = useMemo(() => {
    if (debouncedSearchText) {
      // When searching: merge all files, skills, and terminals, sort globally
      const allItems = [...skillOptions, ...terminalOptions, ...changedFileOptions, ...repoFileOptions]
      return sortFilesByRelevance(allItems, debouncedSearchText)
    }

    // No search: keep groups (skills first, then terminals, then changed files, then repo files)
    return [...skillOptions, ...terminalOptions, ...changedFileOptions, ...repoFileOptions]
  }, [skillOptions, terminalOptions, changedFileOptions, repoFileOptions, debouncedSearchText])

  // Flag to determine if we're in search mode (no groups)
  const isSearchMode = debouncedSearchText.length > 0

  // Track previous values for smarter selection reset
  const prevIsOpenRef = useRef(isOpen)
  const prevSearchRef = useRef(debouncedSearchText)

  // CONSOLIDATED: Single useLayoutEffect for selection management (was 3 separate)
  useLayoutEffect(() => {
    const didJustOpen = isOpen && !prevIsOpenRef.current
    const didSearchChange = debouncedSearchText !== prevSearchRef.current

    // Reset to 0 when opening or search changes
    if (didJustOpen || didSearchChange) {
      setSelectedIndex(0)
    }
    // Clamp to valid range if options shrunk
    else if (options.length > 0 && selectedIndex >= options.length) {
      setSelectedIndex(Math.max(0, options.length - 1))
    }

    // Update refs
    prevIsOpenRef.current = isOpen
    prevSearchRef.current = debouncedSearchText
  }, [isOpen, debouncedSearchText, options.length, selectedIndex])

  // Reset placement when closed
  useEffect(() => {
    if (!isOpen) {
      placementRef.current = null
      setTooltipVisible(false)
    }
  }, [isOpen])

  // Update tooltip when selected/hovered item changes
  // OPTIMIZED: Use requestAnimationFrame to batch DOM reads and prevent layout thrashing
  useEffect(() => {
    if (!isOpen) return

    const activeIndex = hoverIndex ?? selectedIndex
    const activeOption = options[activeIndex]

    if (!activeOption?.path || !dropdownRef.current) {
      setTooltipVisible(false)
      return
    }

    // Use rAF to batch DOM reads and avoid layout thrashing
    const rafId = requestAnimationFrame(() => {
      if (!dropdownRef.current) return

      const elements = dropdownRef.current.querySelectorAll(
        "[data-option-index]",
      )
      const selectedElement = elements[activeIndex] as HTMLElement

      if (selectedElement) {
        const rect = selectedElement.getBoundingClientRect()
        const dropdownRect = dropdownRef.current.getBoundingClientRect()

        // Estimate tooltip width (rough calculation based on content)
        // ~6px per character for monospace font at 10px + 16px padding
        const estimatedTooltipWidth = Math.min(
          activeOption.path.length * 6 + 16,
          320, // max-w-xs = 320px
        )

        // Check if tooltip fits on the left
        const spaceOnLeft = dropdownRect.left - 8 // 8px gap
        const fitsOnLeft = spaceOnLeft >= estimatedTooltipWidth

        if (fitsOnLeft) {
          setTooltipPlacement("left")
          setTooltipPosition({
            top: rect.top,
            left: dropdownRect.left - 4,
          })
        } else {
          setTooltipPlacement("right")
          setTooltipPosition({
            top: rect.top,
            left: dropdownRect.right + 4,
          })
        }

        setTooltipContent(activeOption.path)
        setTooltipType(activeOption.type || "file")
        setTooltipVisible(true)
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [selectedIndex, hoverIndex, options, isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex((prev) => (prev + 1) % options.length)
          break
        case "ArrowUp":
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          setSelectedIndex(
            (prev) => (prev - 1 + options.length) % options.length,
          )
          break
        case "Enter":
          if (e.shiftKey) return
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          if (options[selectedIndex]) {
            onSelect(options[selectedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          onClose()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true })
  }, [isOpen, options, selectedIndex, onSelect, onClose])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return

    // Account for header element
    const headerOffset = 1
    if (selectedIndex === 0) {
      dropdownRef.current.scrollTo({ top: 0, behavior: "auto" })
      return
    }

    const elements = dropdownRef.current.querySelectorAll("[data-option-index]")
    const selectedElement = elements[selectedIndex] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex, isOpen])

  // Click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Calculate dropdown dimensions (matching canvas style)
  const dropdownWidth = 320
  const itemHeight = 28
  const headerHeight = 24
  const requestedHeight = Math.min(
    options.length * itemHeight + headerHeight + 8,
    200,
  )
  const gap = 8

  // Decide placement like Radix Popover (auto-flip top/bottom)
  const safeMargin = 10
  const caretOffsetBelow = 20 // small offset so list doesn't overlap caret line
  const availableBelow =
    window.innerHeight - (position.top + caretOffsetBelow) - safeMargin
  const availableAbove = position.top - safeMargin

  // Compute desired placement, but lock it for the duration of the open state
  // Prefer above if there's more space above, or if below doesn't fit
  if (placementRef.current === null) {
    const condition1 =
      availableAbove >= requestedHeight && availableBelow < requestedHeight
    const condition2 =
      availableAbove > availableBelow && availableAbove >= requestedHeight
    const shouldPlaceAbove = condition1 || condition2
    placementRef.current = shouldPlaceAbove ? "above" : "below"
  }
  const placeAbove = placementRef.current === "above"

  // Compute final top based on placement
  let finalTop = placeAbove
    ? position.top - gap
    : position.top + gap + caretOffsetBelow

  // Slight left bias to better align with '@'
  const leftOffset = -4
  let finalLeft = position.left + leftOffset

  // Adjust horizontal overflow
  if (finalLeft + dropdownWidth > window.innerWidth - safeMargin) {
    finalLeft = window.innerWidth - dropdownWidth - safeMargin
  }
  if (finalLeft < safeMargin) {
    finalLeft = safeMargin
  }

  // Compute actual maxHeight based on available space on the chosen side
  const computedMaxHeight = Math.max(
    80,
    Math.min(
      requestedHeight,
      placeAbove ? availableAbove - gap : availableBelow - gap,
    ),
  )
  const transformY = placeAbove ? "translateY(-100%)" : "translateY(0)"

  return (
    <>
      <div
        ref={dropdownRef}
        className="fixed z-[99999] overflow-hidden rounded-[10px] border border-border bg-popover py-1 text-xs text-popover-foreground shadow-lg dark"
        style={{
          top: finalTop,
          left: finalLeft,
          width: `${dropdownWidth}px`,
          maxHeight: `${computedMaxHeight}px`,
          overflowY: "auto",
          transform: transformY,
        }}
      >
        {/* Initial loading state (no previous data) */}
        {isLoading && options.length === 0 && (
          <div className="flex items-center gap-1.5 h-7 px-1.5 mx-1 text-xs text-muted-foreground">
            <IconSpinner className="h-3.5 w-3.5" />
            <span>Loading files...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="h-7 px-1.5 mx-1 flex items-center text-xs text-muted-foreground">
            Error loading files
          </div>
        )}

        {/* Empty state (only show when not fetching) */}
        {!isLoading && !isFetching && !error && options.length === 0 && (
          <div className="h-7 px-1.5 mx-1 flex items-center text-xs text-muted-foreground">
            {debouncedSearchText
              ? `No files matching "${debouncedSearchText}"`
              : "No files found"}
          </div>
        )}

        {/* File list */}
        {!isLoading && !error && options.length > 0 && (
          <>
            {/* Search mode: flat list sorted by relevance */}
            {isSearchMode ? (
              <>
                <div className="px-2.5 py-1.5 mx-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <span>Files & Folders</span>
                  {isFetching && !isLoading && (
                    <IconSpinner className="h-2.5 w-2.5" />
                  )}
                </div>
                {options.map((option, index) => {
                  const isSelected = selectedIndex === index
                  const OptionIcon = getOptionIcon(option)
                  return (
                    <div
                      key={option.id}
                      data-option-index={index}
                      onClick={() => onSelect(option)}
                      onMouseEnter={() => {
                        setHoverIndex(index)
                        setSelectedIndex(index)
                      }}
                      onMouseLeave={() => {
                        setHoverIndex((prev) => (prev === index ? null : prev))
                      }}
                      className={cn(
                        "group inline-flex w-[calc(100%-8px)] mx-1 items-center whitespace-nowrap outline-none",
                        "h-7 px-1.5 justify-start text-xs rounded-md",
                        "transition-colors cursor-pointer select-none gap-1.5",
                        isSelected
                          ? "dark:bg-neutral-800 bg-accent text-foreground"
                          : "text-muted-foreground dark:hover:bg-neutral-800 hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <OptionIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="flex items-center gap-1 w-full min-w-0">
                        <span className="shrink-0 whitespace-nowrap">
                          {option.label}
                        </span>
                        {/* Diff stats for changed files */}
                        {(option.additions || option.deletions) && (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono">
                            {option.additions ? (
                              <span className="text-green-500">
                                +{option.additions}
                              </span>
                            ) : null}
                            {option.deletions ? (
                              <span className="text-red-500">
                                -{option.deletions}
                              </span>
                            ) : null}
                          </span>
                        )}
                        {option.truncatedPath && (
                          <span
                            className="text-muted-foreground flex-1 min-w-0 ml-2 font-mono overflow-hidden text-[10px]"
                            style={{
                              direction: "rtl",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ direction: "ltr" }}>
                              {option.truncatedPath}
                            </span>
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </>
            ) : (
              /* Browse mode: show groups */
              <>
                {/* Skills group */}
                {skillOptions.length > 0 && (
                  <>
                    <div className="px-2.5 py-1.5 mx-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <span>Skills</span>
                      {isFetchingSkills && <IconSpinner className="h-2.5 w-2.5" />}
                    </div>
                    {skillOptions.map((option, skillIndex) => {
                      const index = skillIndex
                      const isSelected = selectedIndex === index
                      return (
                        <div
                          key={option.id}
                          data-option-index={index}
                          onClick={() => onSelect(option)}
                          onMouseEnter={() => {
                            setHoverIndex(index)
                            setSelectedIndex(index)
                          }}
                          onMouseLeave={() => {
                            setHoverIndex((prev) =>
                              prev === index ? null : prev,
                            )
                          }}
                          className={cn(
                            "group inline-flex w-[calc(100%-8px)] mx-1 items-center whitespace-nowrap outline-none",
                            "h-7 px-1.5 justify-start text-xs rounded-md",
                            "transition-colors cursor-pointer select-none gap-1.5",
                            isSelected
                              ? "dark:bg-neutral-800 bg-accent text-foreground"
                              : "text-muted-foreground dark:hover:bg-neutral-800 hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <SkillIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="flex items-center gap-1 w-full min-w-0">
                            <span className="shrink-0 whitespace-nowrap font-medium">
                              {option.label}
                            </span>
                            {option.truncatedPath && (
                              <span
                                className="text-muted-foreground flex-1 min-w-0 ml-2 overflow-hidden text-[10px] truncate"
                              >
                                {option.truncatedPath}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Changed files group */}
                {changedFileOptions.length > 0 && (
                  <>
                    <div className="px-2.5 py-1.5 mx-1 text-xs font-medium text-muted-foreground">
                      Changed in this chat
                    </div>
                    {changedFileOptions.map((option, changedIdx) => {
                      const index = skillOptions.length + changedIdx
                      const isSelected = selectedIndex === index
                      const OptionIcon = getOptionIcon(option)
                      return (
                        <div
                          key={option.id}
                          data-option-index={index}
                          onClick={() => onSelect(option)}
                          onMouseEnter={() => {
                            setHoverIndex(index)
                            setSelectedIndex(index)
                          }}
                          onMouseLeave={() => {
                            setHoverIndex((prev) =>
                              prev === index ? null : prev,
                            )
                          }}
                          className={cn(
                            "group inline-flex w-[calc(100%-8px)] mx-1 items-center whitespace-nowrap outline-none",
                            "h-7 px-1.5 justify-start text-xs rounded-md",
                            "transition-colors cursor-pointer select-none gap-1.5",
                            isSelected
                              ? "dark:bg-neutral-800 bg-accent text-foreground"
                              : "text-muted-foreground dark:hover:bg-neutral-800 hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <OptionIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex items-center gap-1 w-full min-w-0">
                            <span className="shrink-0 whitespace-nowrap">
                              {option.label}
                            </span>
                            {(option.additions || option.deletions) && (
                              <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono">
                                {option.additions ? (
                                  <span className="text-green-500">
                                    +{option.additions}
                                  </span>
                                ) : null}
                                {option.deletions ? (
                                  <span className="text-red-500">
                                    -{option.deletions}
                                  </span>
                                ) : null}
                              </span>
                            )}
                            {option.truncatedPath && (
                              <span
                                className="text-muted-foreground flex-1 min-w-0 ml-2 font-mono overflow-hidden text-[10px]"
                                style={{
                                  direction: "rtl",
                                  textAlign: "left",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span style={{ direction: "ltr" }}>
                                  {option.truncatedPath}
                                </span>
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Repo files group */}
                {repoFileOptions.length > 0 && (
                  <>
                    <div className="px-2.5 py-1.5 mx-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <span>Files & Folders</span>
                      {isFetching && !isLoading && (
                        <IconSpinner className="h-2.5 w-2.5" />
                      )}
                    </div>
                    {repoFileOptions.map((option, repoIndex) => {
                      const index = skillOptions.length + changedFileOptions.length + repoIndex
                      const isSelected = selectedIndex === index
                      const OptionIcon = getOptionIcon(option)
                      return (
                        <div
                          key={option.id}
                          data-option-index={index}
                          onClick={() => onSelect(option)}
                          onMouseEnter={() => {
                            setHoverIndex(index)
                            setSelectedIndex(index)
                          }}
                          onMouseLeave={() => {
                            setHoverIndex((prev) =>
                              prev === index ? null : prev,
                            )
                          }}
                          className={cn(
                            "group inline-flex w-[calc(100%-8px)] mx-1 items-center whitespace-nowrap outline-none",
                            "h-7 px-1.5 justify-start text-xs rounded-md",
                            "transition-colors cursor-pointer select-none gap-1.5",
                            isSelected
                              ? "dark:bg-neutral-800 bg-accent text-foreground"
                              : "text-muted-foreground dark:hover:bg-neutral-800 hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <OptionIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="flex items-center gap-1 w-full min-w-0">
                            <span className="shrink-0 whitespace-nowrap">
                              {option.label}
                            </span>
                            {option.truncatedPath && (
                              <span
                                className="text-muted-foreground flex-1 min-w-0 ml-2 font-mono overflow-hidden text-[10px]"
                                style={{
                                  direction: "rtl",
                                  textAlign: "left",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <span style={{ direction: "ltr" }}>
                                  {option.truncatedPath}
                                </span>
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Tooltip for full path (tree view for folders) */}
      {tooltipVisible && tooltipContent && (
        <div
          className={cn(
            "fixed z-[100000] bg-popover border border-border rounded-lg shadow-lg dark",
            tooltipType === "folder" ? "px-3 py-2" : "px-2 py-1 max-w-xs"
          )}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: tooltipPlacement === "left" ? "translateX(-100%)" : "translateX(0)",
          }}
        >
          {tooltipType === "folder" ? (
            renderFolderTree(tooltipContent)
          ) : (
            <div className="text-foreground/90 font-mono text-[10px] truncate whitespace-nowrap">
              {tooltipContent}
            </div>
          )}
        </div>
      )}
    </>
  )
})
