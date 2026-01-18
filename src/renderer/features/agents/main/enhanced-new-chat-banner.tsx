"use client"

import React, { useState } from "react"
import { FolderIcon, KanbanSquare, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileTreePanel } from "../ui/file-tree-panel"
import { cn } from "@/lib/utils"
import { useAtomValue } from "jotai"
import { selectedProjectAtom } from "../atoms"

interface EnhancedNewChatBannerProps {
  className?: string
}

export function EnhancedNewChatBanner({ className }: EnhancedNewChatBannerProps) {
  const [activeTab, setActiveTab] = useState<"form" | "roadmap" | "files">("form")
  const selectedProject = useAtomValue(selectedProjectAtom)

  return (
    <div className={cn("w-full max-w-2xl mx-auto mb-4", className)}>
      <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("form")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "form"
                ? "bg-background text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <span>💬</span>
              <span>Chat</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "roadmap"
                ? "bg-background text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <KanbanSquare className="h-4 w-4" />
              <span>Roadmap</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "files"
                ? "bg-background text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <FolderOpen className="h-4 w-4" />
              <span>File Tree</span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === "form" && (
            <div className="text-center py-2 text-sm text-muted-foreground">
              <p>Create a new chat to get started</p>
              <p className="text-xs mt-1">Ask questions, get help with code, or plan your next project</p>
            </div>
          )}
          
          {activeTab === "roadmap" && (
            <div className="text-center py-8">
              <KanbanSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Roadmap Planning</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Organize your project tasks and track progress with our interactive roadmap tool
              </p>
              <Button className="gap-2">
                <KanbanSquare className="h-4 w-4" />
                Open Roadmap
              </Button>
            </div>
          )}
          
          {activeTab === "files" && (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Project File Tree</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Browse, edit, and manage your project files with our interactive file tree
              </p>
              <Button 
                className="gap-2" 
                disabled={!selectedProject}
              >
                <FolderOpen className="h-4 w-4" />
                Open File Tree
              </Button>
              {!selectedProject && (
                <p className="text-xs text-muted-foreground mt-2">
                  Select a project first to access the file tree
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}