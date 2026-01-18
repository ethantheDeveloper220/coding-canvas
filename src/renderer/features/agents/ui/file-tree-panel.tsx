"use client"

import { useMemo, useState, useEffect } from "react"
import { trpc, trpcClient } from "@/lib/trpc"
import {
  TreeProvider,
  TreeView,
  TreeNode,
  TreeNodeTrigger,
  TreeNodeContent,
  TreeExpander,
  TreeIcon,
  TreeLabel,
} from "@/components/ui/tree"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MonacoEditor } from "@/components/ui/monaco-editor"
import { FileCode, FileJson, FileText, Folder, FolderOpen, Save, X, FileQuestion, FolderOpen as FolderIcon, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { EmptyState } from "@/components/ui/empty-state"

interface FileTreePanelProps {
  projectPath: string | null
}

interface OpenFile {
  path: string
  content: string
  originalContent: string
  isDirty: boolean
}

interface FileNode {
  path: string
  name: string
  type: "file" | "folder"
  children?: FileNode[]
  status?: "modified" | "added" | "deleted" | "untracked" | null
}

function buildFileTree(files: Array<{ path: string; type: "file" | "folder" }>): FileNode[] {
  const root: Record<string, FileNode> = {}

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const pathSoFar = parts.slice(0, i + 1).join("/")

      if (!current[part]) {
        current[part] = {
          path: pathSoFar,
          name: part,
          type: isLast ? file.type : "folder",
          children: isLast && file.type === "file" ? undefined : {},
        }
      }

      if (!isLast && current[part].children && typeof current[part].children === "object") {
        current = current[part].children as Record<string, FileNode>
      }
    }
  }

  function convertToArray(nodes: Record<string, FileNode>): FileNode[] {
    return Object.values(nodes)
      .map((node) => ({
        ...node,
        children:
          node.children && typeof node.children === "object"
            ? convertToArray(node.children as Record<string, FileNode>)
            : undefined,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
  }

  return convertToArray(root)
}

function getFileIcon(path: string) {
  const ext = path.split(".").pop()?.toLowerCase()
  if (ext === "tsx" || ext === "ts" || ext === "jsx" || ext === "js") {
    return <FileCode className="h-4 w-4" />
  }
  if (ext === "json") {
    return <FileJson className="h-4 w-4" />
  }
  return <FileText className="h-4 w-4" />
}

function getStatusColor(status: FileNode["status"]): string {
  switch (status) {
    case "modified":
      return "text-yellow-600 dark:text-yellow-500"
    case "added":
      return "text-green-600 dark:text-green-500"
    case "deleted":
      return "text-red-600 dark:text-red-500"
    case "untracked":
      return "text-blue-600 dark:text-blue-500"
    default:
      return ""
  }
}

function getStatusIndicator(status: FileNode["status"]): string {
  switch (status) {
    case "modified":
      return "M"
    case "added":
      return "A"
    case "deleted":
      return "D"
    case "untracked":
      return "U"
    default:
      return ""
  }
}

function renderTreeNode(
  node: FileNode,
  level: number = 0,
  isLast: boolean = false,
  onFileClick?: (path: string) => void,
  onFileRightClick?: (path: string, e: React.MouseEvent) => void,
  onCopyPath?: (path: string) => void,
  onRevealInFinder?: (path: string) => void,
  onOpenInExternalEditor?: (path: string) => void,
  onDownloadZip?: (path: string) => void,
): React.ReactNode {
  const hasChildren = node.children && node.children.length > 0
  const nodeId = node.path
  const isFile = node.type === "file"
  const statusColor = getStatusColor(node.status)
  const statusIndicator = getStatusIndicator(node.status)

  return (
    <TreeNode key={nodeId} nodeId={nodeId} level={level} isLast={isLast}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeNodeTrigger
              onClick={() => {
                if (isFile && onFileClick) {
                  onFileClick(node.path)
                }
              }}
              onContextMenu={(e) => {
                if (onFileRightClick || onDownloadZip) {
                  e.preventDefault()
                  if (isFile && onFileRightClick) {
                    onFileRightClick(node.path, e)
                  }
                }
              }}
            >
              <TreeExpander hasChildren={hasChildren || false} />
              <TreeIcon
                hasChildren={hasChildren || false}
                icon={isFile ? getFileIcon(node.path) : undefined}
              />
              <TreeLabel className={cn("flex items-center gap-2", statusColor)}>
                {node.name}
                {statusIndicator && (
                  <span className={cn("text-xs font-medium px-1 py-0.5 rounded", statusColor)}>
                    {statusIndicator}
                  </span>
                )}
              </TreeLabel>
            </TreeNodeTrigger>
          </div>
        </ContextMenuTrigger>
        {isFile && (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onFileClick?.(node.path)}>
              Open in Monaco Editor
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onOpenInExternalEditor?.(node.path)}>
              Open in External Editor
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onCopyPath?.(node.path)}>
              Copy Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRevealInFinder?.(node.path)}>
              Reveal in File Explorer
            </ContextMenuItem>
          </ContextMenuContent>
        )}
        {!isFile && (
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onCopyPath?.(node.path)}>
              Copy Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onRevealInFinder?.(node.path)}>
              Reveal in File Explorer
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onDownloadZip?.(node.path)}>
              <Download className="mr-2 h-4 w-4" />
              Download as ZIP
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
      {hasChildren && (
        <TreeNodeContent hasChildren>
          {node.children!.map((child, idx) =>
            renderTreeNode(
              child,
              level + 1,
              idx === node.children!.length - 1,
              onFileClick,
              onFileRightClick,
              onCopyPath,
              onRevealInFinder,
              onOpenInExternalEditor,
              onDownloadZip,
            )
          )}
        </TreeNodeContent>
      )}
    </TreeNode>
  )
}

export function FileTreePanel({ projectPath }: FileTreePanelProps) {
  const [openFiles, setOpenFiles] = useState<Map<string, OpenFile>>(new Map())
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileNode["status"]>>(new Map())

  const openInFinderMutation = trpc.external.openInFinder.useMutation()
  const openInEditorMutation = trpc.external.openFileInEditor.useMutation()
  const createZipMutation = trpc.files.createZip.useMutation()

  const { data: fileList = [], isLoading } = trpc.files.search.useQuery(
    {
      projectPath: projectPath || "",
      query: "",
      limit: 1000, // Get more files for tree view
    },
    {
      enabled: !!projectPath,
      refetchInterval: 3000, // Refetch every 3 seconds to update status
    }
  )

  // Fetch git status for all files at once using getStatus endpoint
  const { data: gitStatus } = trpc.changes.getStatus.useQuery(
    {
      worktreePath: projectPath || "",
      defaultBranch: "main",
    },
    {
      enabled: !!projectPath,
      refetchInterval: 3000, // Refetch every 3 seconds to update status
      staleTime: 2000,
    }
  )

  // Build status map from git status response
  useEffect(() => {
    if (!gitStatus) {
      setFileStatuses(new Map())
      return
    }

    const newStatuses = new Map<string, FileNode["status"]>()
    
    // Map all changed files from git status to our status map
    for (const file of gitStatus.staged) {
      newStatuses.set(file.path, file.status)
    }
    for (const file of gitStatus.unstaged) {
      newStatuses.set(file.path, file.status)
    }
    for (const file of gitStatus.untracked) {
      newStatuses.set(file.path, file.status)
    }

    setFileStatuses(newStatuses)
  }, [gitStatus])

  // Recursively add status to tree nodes
  function addStatusToTree(nodes: FileNode[]): FileNode[] {
    return nodes.map((node) => ({
      ...node,
      status: fileStatuses.get(node.path) || null,
      children: node.children ? addStatusToTree(node.children) : undefined,
    }))
  }

  const treeData = useMemo(() => {
    if (!fileList.length) return []
    const tree = buildFileTree(fileList)
    return addStatusToTree(tree)
  }, [fileList, fileStatuses])

  const handleFileClick = async (filePath: string) => {
    if (!projectPath) return

    // Check if file is already open
    if (openFiles.has(filePath)) {
      setActiveFile(filePath)
      setIsEditorOpen(true)
      return
    }

    try {
      // Read file content
      const result = await trpcClient.changes.readWorkingFile.query({
        worktreePath: projectPath,
        filePath,
      })

      if (result.ok) {
        const file: OpenFile = {
          path: filePath,
          content: result.content,
          originalContent: result.content,
          isDirty: false,
        }
        setOpenFiles((prev) => new Map(prev).set(filePath, file))
        setActiveFile(filePath)
        setIsEditorOpen(true)
      } else {
        toast.error(`Failed to open file: ${result.reason}`)
      }
    } catch (error) {
      toast.error(`Error opening file: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleFileRightClick = (filePath: string, e: React.MouseEvent) => {
    e.preventDefault()
    // Context menu will handle the action
  }

  const handleCopyPath = async (filePath: string) => {
    if (!projectPath) return
    const absolutePath = `${projectPath}/${filePath}`
    try {
      await navigator.clipboard.writeText(absolutePath)
      toast.success("Path copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy path")
    }
  }

  const handleRevealInFinder = (filePath: string) => {
    if (!projectPath) return
    const absolutePath = `${projectPath}/${filePath}`
    openInFinderMutation.mutate(absolutePath)
  }

  const handleOpenInExternalEditor = (filePath: string) => {
    if (!projectPath) return
    const absolutePath = `${projectPath}/${filePath}`
    openInEditorMutation.mutate({ path: absolutePath, cwd: projectPath })
  }

  const handleDownloadZip = async (folderPath: string) => {
    if (!projectPath) return

    const toastId = toast.loading("Creating zip archive...")

    try {
      const result = await createZipMutation.mutateAsync({
        projectPath,
        folderPath,
      })

      // Convert base64 to blob and download
      const byteCharacters = atob(result.zipContent)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: "application/zip" })

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.zipName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Zip file downloaded: ${result.zipName}`, { id: toastId })
    } catch (error) {
      toast.error(`Failed to create zip: ${error instanceof Error ? error.message : "Unknown error"}`, { id: toastId })
    }
  }

  const handleSave = async () => {
    if (!activeFile || !projectPath) return

    const file = openFiles.get(activeFile)
    if (!file || !file.isDirty) return

    try {
      await trpcClient.changes.saveFile.mutate({
        worktreePath: projectPath,
        filePath: activeFile,
        content: file.content,
      })

      // Update file state
      setOpenFiles((prev) => {
        const newMap = new Map(prev)
        const updatedFile = newMap.get(activeFile)
        if (updatedFile) {
          newMap.set(activeFile, {
            ...updatedFile,
            originalContent: updatedFile.content,
            isDirty: false,
          })
        }
        return newMap
      })

      toast.success("File saved successfully")
    } catch (error) {
      toast.error(`Failed to save file: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    if (!activeFile) return

    setOpenFiles((prev) => {
      const newMap = new Map(prev)
      const file = newMap.get(activeFile)
      if (file) {
        const newContent = value || ""
        newMap.set(activeFile, {
          ...file,
          content: newContent,
          isDirty: newContent !== file.originalContent,
        })
      }
      return newMap
    })
  }

  const handleCloseEditor = () => {
    const file = activeFile ? openFiles.get(activeFile) : null
    if (file?.isDirty) {
      // TODO: Show confirmation dialog
      if (confirm("You have unsaved changes. Are you sure you want to close?")) {
        setIsEditorOpen(false)
        setActiveFile(null)
      }
    } else {
      setIsEditorOpen(false)
      setActiveFile(null)
    }
  }

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      md: "markdown",
      css: "css",
      html: "html",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      go: "go",
      rs: "rust",
      php: "php",
      rb: "ruby",
      sh: "shell",
      yml: "yaml",
      yaml: "yaml",
    }
    return langMap[ext || ""] || "plaintext"
  }

  if (!projectPath) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <EmptyState
          title="No Project Path"
          description="Select a project to view its file structure."
          icons={[FolderIcon]}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <EmptyState
          title="Loading Files"
          description="Scanning project directory..."
          icons={[FolderIcon, FileText]}
        />
      </div>
    )
  }

  if (!treeData.length) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <EmptyState
          title="No Files Found"
          description="This project directory appears to be empty or no files match the current view."
          icons={[FileQuestion]}
        />
      </div>
    )
  }

  const activeFileData = activeFile ? openFiles.get(activeFile) : null

  const handleDownloadProjectZip = () => {
    // Download the entire project root (empty string means project root)
    handleDownloadZip("")
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Header with Download as ZIP button */}
        <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">File Tree</span>
          </div>
          {projectPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadProjectZip}
              disabled={createZipMutation.isPending}
              className="gap-2 h-7"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Download as ZIP</span>
            </Button>
          )}
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-auto">
          <TreeProvider
            defaultExpandedIds={treeData.slice(0, 5).map((n) => n.path)} // Expand first 5 folders
            showLines={true}
            showIcons={true}
            selectable={true}
            multiSelect={false}
          >
            <TreeView>
              {treeData.map((node, idx) =>
                renderTreeNode(
                  node,
                  0,
                  idx === treeData.length - 1,
                  handleFileClick,
                  handleFileRightClick,
                  handleCopyPath,
                  handleRevealInFinder,
                  handleOpenInExternalEditor,
                  handleDownloadZip,
                )
              )}
            </TreeView>
          </TreeProvider>
        </div>
      </div>

      {/* Monaco Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={(open) => {
        if (!open) {
          handleCloseEditor()
        } else {
          setIsEditorOpen(true)
        }
      }}>
        <DialogContent className="max-w-6xl w-[90vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <DialogTitle className="flex items-center gap-2">
                  {activeFile && (
                    <>
                      {getFileIcon(activeFile)}
                      <span className="font-mono text-sm">{activeFile}</span>
                      {activeFileData?.isDirty && (
                        <span className="text-xs text-muted-foreground">(modified)</span>
                      )}
                    </>
                  )}
                </DialogTitle>
                {activeFile && (
                  <DialogDescription>
                    Edit file content in Monaco Editor
                  </DialogDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFileData?.isDirty && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save (Ctrl+S)
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseEditor}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
            {activeFileData && (
              <MonacoEditor
                value={activeFileData.content}
                onChange={handleEditorChange}
                language={getLanguageFromPath(activeFile)}
                readOnly={false}
                theme="vs-dark"
                height="calc(90vh - 120px)"
                onSave={handleSave}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
