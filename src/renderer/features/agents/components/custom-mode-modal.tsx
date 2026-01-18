"use client"

import React, { useState, useEffect, useMemo } from "react"
import { X, Plus, Trash2, Save, FileText, Settings, Code, Check } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  getCustomModes,
  saveCustomMode,
  deleteCustomMode,
  generateCustomModeId,
  type CustomMode,
} from "../lib/custom-modes"
import { ChatMode } from "./chat-mode-selector"
import { Code as CodeIcon, Zap, Palette, Bug } from "lucide-react"
import { PlanIcon } from "@/components/ui/icons"

interface CustomModeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMode?: (mode: ChatMode | string) => void
}

// Main mode definitions
const MAIN_MODES = [
  {
    id: "build" as ChatMode,
    label: "Build",
    icon: CodeIcon,
    description: "Default mode with all tools enabled for development work",
    promptRules: "",
    preset: {},
  },
  {
    id: "plan" as ChatMode,
    label: "Plan",
    icon: PlanIcon,
    description: "Restricted mode for planning and analysis without file modifications",
    promptRules: "",
    preset: {},
  },
  {
    id: "scaling" as ChatMode,
    label: "Scaling",
    icon: Zap,
    description: "Optimize and scale your codebase",
    promptRules: "",
    preset: {},
  },
  {
    id: "designer" as ChatMode,
    label: "Designer",
    icon: Palette,
    description: "Focus on design and UI/UX improvements",
    promptRules: "",
    preset: {},
  },
  {
    id: "debug" as ChatMode,
    label: "Debug",
    icon: Bug,
    description: "Debug and fix issues in your code",
    promptRules: "",
    preset: {},
  },
]

export function CustomModeModal({ open, onOpenChange, onSelectMode }: CustomModeModalProps) {
  const [selectedTab, setSelectedTab] = useState<"main" | "custom">("main")
  const [customModes, setCustomModes] = useState<CustomMode[]>([])
  const [editingMode, setEditingMode] = useState<CustomMode | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Form state for creating/editing
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    promptRules: "",
    preset: "",
  })

  // Load custom modes when modal opens
  useEffect(() => {
    if (open) {
      setCustomModes(getCustomModes())
    }
  }, [open])

  // Handle mode selection
  const handleSelectMode = (modeId: string | ChatMode) => {
    onSelectMode?.(modeId)
    onOpenChange(false)
  }

  // Start creating new custom mode
  const handleCreateNew = () => {
    setEditingMode(null)
    setIsCreating(true)
    setFormData({
      name: "",
      description: "",
      promptRules: "",
      preset: "",
    })
  }

  // Start editing existing custom mode
  const handleEdit = (mode: CustomMode) => {
    setEditingMode(mode)
    setIsCreating(false)
    setFormData({
      name: mode.name,
      description: mode.description || "",
      promptRules: mode.promptRules || "",
      preset: mode.preset ? JSON.stringify(mode.preset, null, 2) : "",
    })
  }

  // Cancel editing/creating
  const handleCancel = () => {
    setEditingMode(null)
    setIsCreating(false)
    setFormData({
      name: "",
      description: "",
      promptRules: "",
      preset: "",
    })
  }

  // Save custom mode
  const handleSave = () => {
    if (!formData.name.trim()) return

    let preset: Record<string, any> = {}
    try {
      if (formData.preset.trim()) {
        preset = JSON.parse(formData.preset)
      }
    } catch (error) {
      alert("Invalid JSON in preset field")
      return
    }

    const mode: CustomMode = {
      id: editingMode?.id || generateCustomModeId(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      promptRules: formData.promptRules.trim() || undefined,
      preset: Object.keys(preset).length > 0 ? preset : undefined,
      createdAt: editingMode?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    saveCustomMode(mode)
    setCustomModes(getCustomModes())
    handleCancel()
  }

  // Delete custom mode
  const handleDelete = (modeId: string) => {
    if (confirm("Are you sure you want to delete this custom mode?")) {
      deleteCustomMode(modeId)
      setCustomModes(getCustomModes())
      if (editingMode?.id === modeId) {
        handleCancel()
      }
    }
  }

  const isEditing = editingMode !== null || isCreating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Chat Modes
          </DialogTitle>
          <DialogDescription>
            Manage main presets and create custom modes with prompt rules and presets
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            onClick={() => {
              setSelectedTab("main")
              handleCancel()
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2",
              selectedTab === "main"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Main
          </button>
          <button
            onClick={() => {
              setSelectedTab("custom")
              handleCancel()
            }}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2",
              selectedTab === "custom"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Custom
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {selectedTab === "main" && (
            <div className="p-4 space-y-2">
              {MAIN_MODES.map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSelectMode(mode.id)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 rounded-lg border border-border",
                      "hover:bg-accent/50 transition-colors duration-150",
                      "text-left"
                    )}
                  >
                    <div className="mt-0.5">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{mode.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {mode.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedTab === "custom" && (
            <div className="p-4 space-y-4">
              {!isEditing && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Custom Modes</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Create custom modes with prompt rules and presets
                      </p>
                    </div>
                    <Button onClick={handleCreateNew} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Mode
                    </Button>
                  </div>

                  {customModes.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-lg">
                      <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground mb-1">No custom modes yet</p>
                      <p className="text-xs text-muted-foreground/70 mb-4">
                        Create your first custom mode to get started
                      </p>
                      <Button onClick={handleCreateNew} size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Create Custom Mode
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customModes.map((mode) => (
                        <div
                          key={mode.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border border-border",
                            "hover:bg-accent/50 transition-colors duration-150"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-foreground">{mode.name}</div>
                              {mode.description && (
                                <div className="text-xs text-muted-foreground">
                                  {mode.description}
                                </div>
                              )}
                            </div>
                            {mode.promptRules && (
                              <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                                {mode.promptRules}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(mode)}
                              className="h-7"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectMode(mode.id)}
                              className="h-7"
                            >
                              Use
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(mode.id)}
                              className="h-7 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Edit/Create Form */}
              {isEditing && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 border border-border rounded-lg p-4 bg-muted/20"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">
                      {isCreating ? "Create Custom Mode" : "Edit Custom Mode"}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Mode Name *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., IoT Development"
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block">
                        Description
                      </label>
                      <Input
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="Brief description of this mode"
                        className="text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Prompt Rules
                      </label>
                      <Textarea
                        value={formData.promptRules}
                        onChange={(e) =>
                          setFormData({ ...formData, promptRules: e.target.value })
                        }
                        placeholder="Enter prompt rules that will be applied when this mode is active..."
                        className="text-sm font-mono min-h-[100px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        These rules will be prepended to user prompts when this mode is selected
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground mb-1 block flex items-center gap-1.5">
                        <Code className="h-3.5 w-3.5" />
                        Preset Configuration (JSON)
                      </label>
                      <Textarea
                        value={formData.preset}
                        onChange={(e) => setFormData({ ...formData, preset: e.target.value })}
                        placeholder='{"key": "value"}'
                        className="text-sm font-mono min-h-[80px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional JSON configuration for this mode
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!formData.name.trim()}>
                      <Save className="h-4 w-4 mr-1.5" />
                      {isCreating ? "Create" : "Save"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
