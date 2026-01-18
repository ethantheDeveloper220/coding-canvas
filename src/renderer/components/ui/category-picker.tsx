"use client"

import React, { useState, useRef, useEffect } from "react"
import { Hash, Plus, X, Check, Settings, Sparkles, FileText } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export interface Category {
  id: string
  name: string
  color: string
  type?: "main" | "custom" // Distinguish between main and custom categories
  promptRules?: string // Prompt rules for custom categories
  preset?: string // Preset configuration
}

// Main (default) categories with Notion-like colors
const MAIN_CATEGORIES: Category[] = [
  { id: "default", name: "General", color: "bg-gray-500/20 text-gray-500", type: "main" },
  { id: "iot", name: "IoT", color: "bg-blue-500/20 text-blue-500", type: "main" },
  { id: "frontend", name: "Frontend", color: "bg-purple-500/20 text-purple-500", type: "main" },
  { id: "backend", name: "Backend", color: "bg-green-500/20 text-green-500", type: "main" },
  { id: "mobile", name: "Mobile", color: "bg-orange-500/20 text-orange-500", type: "main" },
  { id: "devops", name: "DevOps", color: "bg-red-500/20 text-red-500", type: "main" },
  { id: "design", name: "Design", color: "bg-pink-500/20 text-pink-500", type: "main" },
]

const CATEGORY_COLORS = [
  "bg-gray-500/20 text-gray-500",
  "bg-blue-500/20 text-blue-500",
  "bg-purple-500/20 text-purple-500",
  "bg-green-500/20 text-green-500",
  "bg-orange-500/20 text-orange-500",
  "bg-red-500/20 text-red-500",
  "bg-pink-500/20 text-pink-500",
  "bg-yellow-500/20 text-yellow-500",
  "bg-indigo-500/20 text-indigo-500",
  "bg-teal-500/20 text-teal-500",
]

interface CategoryPickerProps {
  selectedCategory?: string
  onSelectCategory: (category: string | undefined) => void
  onCreateCategory?: (name: string) => void
  categories?: Category[]
}

export function CategoryPicker({
  selectedCategory,
  onSelectCategory,
  onCreateCategory,
  categories = MAIN_CATEGORIES,
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [selectedMode, setSelectedMode] = useState<"main" | "custom">("main")
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Separate main and custom categories
  const mainCategories = categories.filter(c => c.type === "main" || !c.type)
  const userCustomCategories = [...customCategories, ...categories.filter(c => c.type === "custom")]
  const allCategories = [...mainCategories, ...userCustomCategories]
  
  const selectedCat = allCategories.find((c) => c.id === selectedCategory) || 
    allCategories.find((c) => c.name === selectedCategory)
  
  // Get current category list based on mode
  const currentCategories = selectedMode === "main" ? mainCategories : userCustomCategories

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
        setNewCategoryName("")
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return

    const newCategory: Category = {
      id: `custom-${Date.now()}`,
      name: newCategoryName.trim(),
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
      type: "custom",
    }

    setCustomCategories((prev) => [...prev, newCategory])
    onSelectCategory(newCategory.name)
    onCreateCategory?.(newCategory.name)
    setNewCategoryName("")
    setIsCreating(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
          "transition-all duration-150 hover:bg-accent/50",
          selectedCat
            ? cn("bg-background border border-border", selectedCat.color)
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {selectedCat ? (
          <>
            <Hash className="h-3 w-3" />
            <span>{selectedCat.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelectCategory(undefined)
              }}
              className="ml-1 hover:bg-foreground/10 rounded p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </>
        ) : (
          <>
            <Hash className="h-3 w-3" />
            <span>Add category</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
          >
            <div className="max-h-[360px] overflow-y-auto">
              {/* Mode Selector */}
              <div className="sticky top-0 z-10 bg-popover border-b border-border p-1 flex gap-1">
                <button
                  onClick={() => setSelectedMode("main")}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
                    selectedMode === "main"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Main
                </button>
                <button
                  onClick={() => setSelectedMode("custom")}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
                    selectedMode === "custom"
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  Custom
                </button>
              </div>

              {/* Category List */}
              <div className="p-1">
                {selectedMode === "custom" && userCustomCategories.length === 0 && !isCreating && (
                  <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                    <p className="mb-1">No custom categories yet</p>
                    <p className="text-muted-foreground/70">Create your first custom category below</p>
                  </div>
                )}

                {/* Existing Categories */}
                {currentCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    onSelectCategory(category.name)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                    "transition-colors duration-150 hover:bg-accent/50",
                    selectedCategory === category.id || selectedCategory === category.name
                      ? "bg-accent"
                      : ""
                  )}
                >
                  <div className={cn("w-4 h-4 rounded flex items-center justify-center", category.color)}>
                    <Hash className="h-2.5 w-2.5" />
                  </div>
                  <span className="flex-1 text-left">{category.name}</span>
                  {selectedCategory === category.id || selectedCategory === category.name ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : null}
                </button>
              ))}

              {/* Create New Category - Only in Custom mode */}
              {selectedMode === "custom" && (
                <>
                  {isCreating ? (
                    <div className="p-2 border-t border-border mt-1 pt-2 space-y-2">
                      <Input
                        ref={inputRef}
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleCreateCategory()
                          } else if (e.key === "Escape") {
                            setIsCreating(false)
                            setNewCategoryName("")
                          }
                        }}
                        placeholder="Category name..."
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          onClick={handleCreateCategory}
                          className="h-6 text-xs flex-1"
                          disabled={!newCategoryName.trim()}
                        >
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsCreating(false)
                            setNewCategoryName("")
                          }}
                          className="h-6 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setIsCreating(true)
                        setSelectedMode("custom")
                        setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                        "transition-colors duration-150 hover:bg-accent/50",
                        "text-muted-foreground hover:text-foreground border-t border-border mt-1 pt-2"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create custom category</span>
                    </button>
                  )}
                </>
              )}

              {/* Switch to Custom mode hint in Main mode */}
              {selectedMode === "main" && userCustomCategories.length > 0 && (
                <button
                  onClick={() => setSelectedMode("custom")}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs",
                    "transition-colors duration-150 hover:bg-accent/50",
                    "text-muted-foreground hover:text-foreground border-t border-border mt-1 pt-2"
                  )}
                >
                  <span>View {userCustomCategories.length} custom categor{userCustomCategories.length === 1 ? 'y' : 'ies'}</span>
                  <span className="ml-auto text-muted-foreground/70">→</span>
                </button>
              )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
