"use client"

import React, { Dispatch, SetStateAction, useState, DragEvent, FormEvent, useMemo } from "react"
import { Plus, Trash2, Circle, CheckCircle2, Clock, ListTodo, Hash, Filter } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CategoryPicker } from "./category-picker"
import type { CardType } from "./kanban"

export interface TimelineProps {
  cards?: CardType[]
  onCardsChange?: (cards: CardType[]) => void
}

const DEFAULT_CARDS: CardType[] = []

// Status configuration with theme-aware colors
const STATUS_CONFIG = {
  backlog: {
    label: "Backlog",
    icon: ListTodo,
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-muted",
  },
  todo: {
    label: "TODO",
    icon: Circle,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  doing: {
    label: "In Progress",
    icon: Clock,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  done: {
    label: "Complete",
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
} as const

export const Timeline = ({ cards: externalCards, onCardsChange }: TimelineProps) => {
  const [internalCards, setInternalCards] = useState<CardType[]>(DEFAULT_CARDS)
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  
  const cards = externalCards ?? internalCards
  const setCards = onCardsChange 
    ? (updater: CardType[] | ((prev: CardType[]) => CardType[])) => {
        const newCards = typeof updater === 'function' ? updater(cards) : updater
        onCardsChange(newCards)
      }
    : setInternalCards

  // Filter cards by category if selected
  const filteredCards = useMemo(() => {
    if (!selectedCategory) return cards
    return cards.filter(card => card.category === selectedCategory)
  }, [cards, selectedCategory])

  // Get unique categories
  const categories = useMemo(() => {
    const catSet = new Set<string>()
    cards.forEach(card => {
      if (card.category) catSet.add(card.category)
    })
    return Array.from(catSet)
  }, [cards])

  // Group cards by status and sort chronologically
  const groupedCards = useMemo(() => {
    const groups: Record<string, CardType[]> = {
      backlog: [],
      todo: [],
      doing: [],
      done: [],
    }
    
    filteredCards.forEach(card => {
      if (groups[card.column]) {
        groups[card.column].push(card)
      }
    })
    
    return groups
  }, [filteredCards])

  // Get all cards in timeline order
  const timelineItems = useMemo(() => {
    return [
      ...groupedCards.backlog,
      ...groupedCards.todo,
      ...groupedCards.doing,
      ...groupedCards.done,
    ]
  }, [groupedCards])

  const handleCategoryChange = (cardId: string, category: string | undefined) => {
    const updatedCards = cards.map(card =>
      card.id === cardId ? { ...card, category } : card
    )
    setCards(updatedCards)
  }

  return (
    <div className={cn("h-full w-full bg-background text-foreground overflow-y-auto")}>
      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={cn(
              "px-2 py-1 rounded-md text-xs transition-colors duration-150",
              !selectedCategory
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2 py-1 rounded-md text-xs transition-colors duration-150",
                "inline-flex items-center gap-1",
                selectedCategory === cat
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Hash className="h-3 w-3" />
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="relative p-4 space-y-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => {
          const statusCards = groupedCards[status as keyof typeof groupedCards]
          if (statusCards.length === 0) return null

          return (
            <StatusGroup
              key={status}
              status={status as CardType["column"]}
              config={config}
              cards={statusCards}
              allCards={cards}
              setCards={setCards}
              onCategoryChange={handleCategoryChange}
            />
          )
        })}
        
        {timelineItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Circle className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {selectedCategory ? `No tasks in ${selectedCategory}` : "No tasks yet"}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {selectedCategory ? "Try a different category filter" : "Add a new task to get started"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

type StatusGroupProps = {
  status: CardType["column"]
  config: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]
  cards: CardType[]
  allCards: CardType[]
  setCards: Dispatch<SetStateAction<CardType[]>>
  onCategoryChange: (cardId: string, category: string | undefined) => void
}

const StatusGroup = ({ status, config, cards: statusCards, allCards: cards, setCards, onCategoryChange }: StatusGroupProps) => {
  const Icon = config.icon
  const [activeCard, setActiveCard] = useState<string | null>(null)

  const handleDragStart = (e: DragEvent, card: CardType) => {
    e.dataTransfer.setData("cardId", card.id)
    setActiveCard(card.id)
  }

  const handleDragEnd = (e: DragEvent) => {
    const cardId = e.dataTransfer.getData("cardId")
    setActiveCard(null)

    const indicators = getIndicators(status)
    const { element } = getNearestIndicator(e, indicators)

    const before = element.dataset.before || "-1"

    if (before !== cardId) {
      let copy = [...cards]
      let cardToTransfer = copy.find((c) => c.id === cardId)
      if (!cardToTransfer) return
      
      cardToTransfer = { ...cardToTransfer, column: status }
      copy = copy.filter((c) => c.id !== cardId)

      const moveToBack = before === "-1"
      if (moveToBack) {
        copy.push(cardToTransfer)
      } else {
        const insertAtIndex = copy.findIndex((el) => el.id === before)
        if (insertAtIndex === undefined) return
        copy.splice(insertAtIndex, 0, cardToTransfer)
      }

      setCards(copy)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    highlightIndicator(e, status)
  }

  const clearHighlights = () => {
    const indicators = getIndicators(status)
    indicators.forEach((i) => {
      i.style.opacity = "0"
    })
  }

  const highlightIndicator = (e: DragEvent, column: string) => {
    const indicators = getIndicators(column)
    clearHighlights()
    const el = getNearestIndicator(e, indicators)
    el.element.style.opacity = "1"
  }

  const getNearestIndicator = (e: DragEvent, indicators: HTMLElement[]) => {
    const DISTANCE_OFFSET = 50
    const el = indicators.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect()
        const offset = e.clientY - (box.top + DISTANCE_OFFSET)
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child }
        } else {
          return closest
        }
      },
      {
        offset: Number.NEGATIVE_INFINITY,
        element: indicators[indicators.length - 1],
      }
    )
    return el
  }

  const getIndicators = (column: string) => {
    return Array.from(
      document.querySelectorAll(
        `[data-column="${column}"]`
      ) as unknown as HTMLElement[]
    )
  }

  const handleDragLeave = () => {
    clearHighlights()
  }

  return (
    <div className="relative">
      {/* Status Header */}
      <div className="flex items-center gap-2 mb-3 sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2">
        <Icon className={cn("h-4 w-4", config.color)} />
        <h3 className={cn("text-sm font-medium", config.color)}>{config.label}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {statusCards.length}
        </span>
      </div>

      {/* Timeline Line */}
      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />

      {/* Cards */}
      <div
        className="space-y-2 ml-6"
        onDrop={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <AnimatePresence mode="popLayout">
          {statusCards.map((card, index) => (
            <TimelineCard
              key={card.id}
              card={card}
              index={index}
              config={config}
              handleDragStart={handleDragStart}
              activeCard={activeCard}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </AnimatePresence>

        {/* Drop Indicator */}
        <DropIndicator beforeId={null} column={status} />
        
        {/* Add Card Button */}
        <AddCard column={status} setCards={setCards} config={config} onCategoryChange={onCategoryChange} />
      </div>
    </div>
  )
}

type TimelineCardProps = {
  card: CardType
  index: number
  config: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]
  handleDragStart: (e: DragEvent, card: CardType) => void
  activeCard: string | null
  onCategoryChange: (cardId: string, category: string | undefined) => void
}

const TimelineCard = ({ card, index, config, handleDragStart, activeCard, onCategoryChange }: TimelineCardProps) => {
  const isActive = activeCard === card.id
  const [isHovered, setIsHovered] = useState(false)
  
  // Get category color class
  const getCategoryColor = (category?: string) => {
    if (!category) return "bg-gray-500/20 text-gray-500"
    const categoryMap: Record<string, string> = {
      "IoT": "bg-blue-500/20 text-blue-500",
      "Frontend": "bg-purple-500/20 text-purple-500",
      "Backend": "bg-green-500/20 text-green-500",
      "Mobile": "bg-orange-500/20 text-orange-500",
      "DevOps": "bg-red-500/20 text-red-500",
      "Design": "bg-pink-500/20 text-pink-500",
    }
    return categoryMap[category] || "bg-gray-500/20 text-gray-500"
  }
  
  return (
    <>
      <DropIndicator beforeId={card.id} column={card.column} />
      <motion.div
        layout
        layoutId={card.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, delay: index * 0.05 }}
        draggable="true"
        onDragStart={(e) => handleDragStart(e as unknown as DragEvent, card)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group relative cursor-grab rounded-lg border bg-card active:cursor-grabbing",
          "hover:bg-accent/50 transition-all duration-200 ease-out",
          "hover:shadow-md hover:shadow-black/5",
          isActive && "opacity-50 scale-95",
          config.borderColor,
          // Notion-like subtle border and padding
          "border-border/30 hover:border-border/60",
          "shadow-sm"
        )}
      >
        {/* Timeline Dot */}
        <div className={cn(
          "absolute -left-[29px] top-3 h-2 w-2 rounded-full border-2 bg-background",
          config.bgColor,
          config.borderColor
        )} />
        
        {/* Card Content - Notion-like */}
        <div className="p-3.5 space-y-2.5">
          <p className="text-sm text-foreground leading-relaxed font-medium">
            {card.title}
          </p>
          
          {/* Category Badge and Picker Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {card.category && (
              <div className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium",
                "border border-transparent",
                getCategoryColor(card.category)
              )}>
                <Hash className="h-3 w-3" />
                {card.category}
              </div>
            )}
            
            {/* Category Picker on Hover - Notion-like */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <CategoryPicker
                    selectedCategory={card.category}
                    onSelectCategory={(cat) => onCategoryChange(card.id, cat)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  )
}

type DropIndicatorProps = {
  beforeId: string | null
  column: string
}

const DropIndicator = ({ beforeId, column }: DropIndicatorProps) => {
  return (
    <div
      data-before={beforeId || "-1"}
      data-column={column}
      className="my-0.5 h-0.5 w-full bg-primary opacity-0 transition-opacity"
    />
  )
}

type AddCardProps = {
  column: CardType["column"]
  setCards: Dispatch<SetStateAction<CardType[]>>
  config: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]
  onCategoryChange?: (cardId: string, category: string | undefined) => void
}

const AddCard = ({ column, setCards, config, onCategoryChange }: AddCardProps) => {
  const [text, setText] = useState("")
  const [adding, setAdding] = useState(false)
  const [category, setCategory] = useState<string | undefined>(undefined)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!text.trim().length) return

    const newCard: CardType = {
      column,
      title: text.trim(),
      id: Math.random().toString(),
      category,
    }

    setCards((pv) => [...pv, newCard])
    setText("")
    setCategory(undefined)
    setAdding(false)
  }

  return (
    <>
      {adding ? (
        <motion.form
          layout
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={handleSubmit}
          className="mt-2 p-3 rounded-lg border border-border/50 bg-background shadow-sm"
        >
          <textarea
            onChange={(e) => setText(e.target.value)}
            value={text}
            autoFocus
            placeholder="Add new task..."
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 resize-none"
            rows={3}
          />
          <div className="mt-2 space-y-2">
            {/* Category Picker */}
            <div onClick={(e) => e.stopPropagation()}>
              <CategoryPicker
                selectedCategory={category}
                onSelectCategory={setCategory}
                categories={[
                  { id: "iot", name: "IoT", color: "bg-blue-500/20 text-blue-500" },
                  { id: "frontend", name: "Frontend", color: "bg-purple-500/20 text-purple-500" },
                  { id: "backend", name: "Backend", color: "bg-green-500/20 text-green-500" },
                  { id: "mobile", name: "Mobile", color: "bg-orange-500/20 text-orange-500" },
                  { id: "devops", name: "DevOps", color: "bg-red-500/20 text-red-500" },
                  { id: "design", name: "Design", color: "bg-pink-500/20 text-pink-500" },
                ]}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false)
                setText("")
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.button
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setAdding(true)}
          className={cn(
            "mt-2 flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground",
            "transition-all duration-200 hover:text-foreground hover:bg-accent/50 rounded-md",
            "border border-dashed border-border hover:border-solid"
          )}
        >
          <Plus className="h-3 w-3" />
          <span>Add task</span>
        </motion.button>
      )}
    </>
  )
}
