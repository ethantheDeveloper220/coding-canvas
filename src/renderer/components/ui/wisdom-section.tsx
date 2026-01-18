"use client"

import React, { useState, useMemo } from "react"
import { ChevronDown, Lightbulb, TrendingUp, BarChart3, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import type { CardType } from "./kanban"

interface WisdomSectionProps {
  isExpanded: boolean
  onToggle: () => void
  stats: {
    total: number
    backlog: number
    todo: number
    doing: number
    done: number
    completed: number
    percentage: number
  } | null
  cards: CardType[]
  themeBg: string
}

const TIPS = [
  "Use drag-and-drop to move tasks between statuses",
  "Click on a task to edit its details",
  "Tasks are automatically saved to the database",
  "Organize tasks by priority in the backlog",
  "Mark tasks as complete to track progress",
  "Use the timeline view to see task progression",
]

const SHORTCUTS = [
  { key: "Click + Drag", desc: "Move task between statuses" },
  { key: "Click task", desc: "Edit task details" },
  { key: "Add task", desc: "Create new task in any status" },
]

export function WisdomSection({ isExpanded, onToggle, stats, cards, themeBg }: WisdomSectionProps) {
  const [activeTab, setActiveTab] = useState<"tips" | "insights" | "stats">("tips")
  const [tipIndex, setTipIndex] = useState(0)

  // Rotate tips
  React.useEffect(() => {
    if (!isExpanded || activeTab !== "tips") return
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isExpanded, activeTab])

  // Generate AI suggestions based on task status
  const aiSuggestions = useMemo(() => {
    if (!stats || stats.total === 0) return []
    
    const suggestions: string[] = []
    
    if (stats.done === 0 && stats.total > 0) {
      suggestions.push("💡 Start by moving some tasks to 'In Progress' to begin making progress")
    }
    
    if (stats.doing === 0 && stats.todo > 0) {
      suggestions.push("🚀 You have tasks ready - consider starting one from your TODO list")
    }
    
    if (stats.backlog > stats.todo + stats.doing) {
      suggestions.push("📋 Consider prioritizing your backlog - move important tasks to TODO")
    }
    
    if (stats.percentage > 50 && stats.percentage < 100) {
      suggestions.push(`✨ Great progress! You're ${stats.percentage}% done - keep it up!`)
    }
    
    if (stats.done === stats.total && stats.total > 0) {
      suggestions.push("🎉 All tasks completed! Great work!")
    }
    
    if (stats.doing > 3) {
      suggestions.push("⚡ You have many tasks in progress - consider focusing on fewer at once")
    }
    
    return suggestions.length > 0 ? suggestions : ["🎯 Keep adding tasks to build your roadmap"]
  }, [stats])

  // Progress insights
  const progressInsights = useMemo(() => {
    if (!stats) return null
    
    const insights = {
      completionRate: stats.percentage,
      activeTasks: stats.doing,
      pendingTasks: stats.todo + stats.backlog,
      doneTasks: stats.done,
      averagePerStatus: stats.total > 0 ? Math.round(stats.total / 4) : 0,
    }
    
    return insights
  }, [stats])

  if (!stats) return null

  return (
    <div className="border-b flex-shrink-0" style={{ borderBottomColor: "rgba(255, 255, 255, 0.1)" }}>
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-2 py-1.5",
          "hover:bg-accent/30 transition-colors duration-150",
          "text-xs font-medium text-foreground/80"
        )}
        aria-expanded={isExpanded}
        aria-label="Toggle wisdom section"
      >
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
          <span>Wisdom & Insights</span>
          {!isExpanded && stats.total > 0 && (
            <span className="text-muted-foreground">
              ({stats.percentage}% complete)
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
            style={{ backgroundColor: themeBg }}
          >
            <div className="px-2 py-2 border-t" style={{ borderTopColor: "rgba(255, 255, 255, 0.1)" }}>
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-2 p-0.5 rounded-md bg-muted/20">
                <button
                  onClick={() => setActiveTab("tips")}
                  className={cn(
                    "flex-1 px-2 py-1 text-xs rounded transition-all duration-200",
                    activeTab === "tips"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tips
                </button>
                <button
                  onClick={() => setActiveTab("insights")}
                  className={cn(
                    "flex-1 px-2 py-1 text-xs rounded transition-all duration-200",
                    activeTab === "insights"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("stats")}
                  className={cn(
                    "flex-1 px-2 py-1 text-xs rounded transition-all duration-200",
                    activeTab === "stats"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center justify-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    Stats
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {activeTab === "tips" && (
                  <motion.div
                    key="tips"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    <div className="bg-muted/20 rounded-md p-2 min-h-[60px] flex items-center">
                      <p className="text-xs text-foreground leading-relaxed">
                        {TIPS[tipIndex]}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {SHORTCUTS.map((shortcut, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span>{shortcut.desc}</span>
                          <code className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px]">
                            {shortcut.key}
                          </code>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "insights" && (
                  <motion.div
                    key="insights"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {aiSuggestions.length > 0 ? (
                      aiSuggestions.map((suggestion, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2"
                        >
                          <p className="text-xs text-foreground leading-relaxed">
                            {suggestion}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                      <div className="bg-muted/20 rounded-md p-2 min-h-[60px] flex items-center">
                        <p className="text-xs text-muted-foreground">
                          Add tasks to get AI-powered suggestions
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "stats" && progressInsights && (
                  <motion.div
                    key="stats"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Completion</span>
                        <span className="font-medium text-foreground">
                          {progressInsights.completionRate}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressInsights.completionRate}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/20 rounded-md p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Total</div>
                        <div className="text-lg font-semibold text-foreground">
                          {stats.total}
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-md p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Active</div>
                        <div className="text-lg font-semibold text-blue-500">
                          {progressInsights.activeTasks}
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-md p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Pending</div>
                        <div className="text-lg font-semibold text-yellow-500">
                          {progressInsights.pendingTasks}
                        </div>
                      </div>
                      <div className="bg-muted/20 rounded-md p-2">
                        <div className="text-xs text-muted-foreground mb-0.5">Done</div>
                        <div className="text-lg font-semibold text-emerald-500">
                          {progressInsights.doneTasks}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
