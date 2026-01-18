"use client"

import React, {
  Dispatch,
  SetStateAction,
  useState,
  DragEvent,
  FormEvent,
} from "react"
import { Plus, Trash2, Flame } from "lucide-react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type ColumnType = "backlog" | "todo" | "doing" | "done"

export type CardType = {
  title: string
  id: string
  column: ColumnType
  category?: string
}

const DEFAULT_CARDS: CardType[] = [
  { title: "Add authentication system", id: "1", column: "backlog" },
  { title: "Implement file upload feature", id: "2", column: "backlog" },
  { title: "Set up database migrations", id: "3", column: "backlog" },
  { title: "Create API documentation", id: "4", column: "backlog" },
  {
    title: "Optimize performance for large datasets",
    id: "5",
    column: "todo",
  },
  { title: "Add error handling middleware", id: "6", column: "todo" },
  { title: "Implement caching strategy", id: "7", column: "todo" },
  {
    title: "Refactor state management",
    id: "8",
    column: "doing",
  },
  { title: "Add unit tests for core features", id: "9", column: "doing" },
  {
    title: "Deploy to production environment",
    id: "10",
    column: "done",
  },
]

export interface KanbanProps {
  cards?: CardType[]
  onCardsChange?: (cards: CardType[]) => void
}

export const Kanban = ({ cards: externalCards, onCardsChange }: KanbanProps) => {
  const [internalCards, setInternalCards] = useState(DEFAULT_CARDS)
  
  const cards = externalCards ?? internalCards
  const setCards = onCardsChange 
    ? (updater: CardType[] | ((prev: CardType[]) => CardType[])) => {
        const newCards = typeof updater === 'function' ? updater(cards) : updater
        onCardsChange(newCards)
      }
    : setInternalCards

  return (
    <div className={cn("h-full w-full bg-background text-foreground")}>
      <Board cards={cards} setCards={setCards} />
    </div>
  )
}

type BoardProps = {
  cards: CardType[]
  setCards: Dispatch<SetStateAction<CardType[]>>
}

const Board = ({ cards, setCards }: BoardProps) => {
  return (
    <div className="flex h-full w-full gap-3 overflow-x-auto overflow-y-hidden p-4">
      <Column
        title="Backlog"
        column="backlog"
        headingColor="text-muted-foreground"
        cards={cards}
        setCards={setCards}
      />
      <Column
        title="TODO"
        column="todo"
        headingColor="text-yellow-500"
        cards={cards}
        setCards={setCards}
      />
      <Column
        title="In progress"
        column="doing"
        headingColor="text-blue-500"
        cards={cards}
        setCards={setCards}
      />
      <Column
        title="Complete"
        column="done"
        headingColor="text-emerald-500"
        cards={cards}
        setCards={setCards}
      />
      <BurnBarrel setCards={setCards} />
    </div>
  )
}

type ColumnProps = {
  title: string
  headingColor: string
  cards: CardType[]
  column: ColumnType
  setCards: Dispatch<SetStateAction<CardType[]>>
}

const Column = ({
  title,
  headingColor,
  cards,
  column,
  setCards,
}: ColumnProps) => {
  const [active, setActive] = useState(false)

  const handleDragStart = (e: DragEvent, card: CardType) => {
    e.dataTransfer.setData("cardId", card.id)
  }

  const handleDragEnd = (e: DragEvent) => {
    const cardId = e.dataTransfer.getData("cardId")

    setActive(false)
    clearHighlights()

    const indicators = getIndicators()
    const { element } = getNearestIndicator(e, indicators)

    const before = element.dataset.before || "-1"

    if (before !== cardId) {
      let copy = [...cards]

      let cardToTransfer = copy.find((c) => c.id === cardId)
      if (!cardToTransfer) return
      cardToTransfer = { ...cardToTransfer, column }

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
    highlightIndicator(e)

    setActive(true)
  }

  const clearHighlights = (els?: HTMLElement[]) => {
    const indicators = els || getIndicators()

    indicators.forEach((i) => {
      i.style.opacity = "0"
    })
  }

  const highlightIndicator = (e: DragEvent) => {
    const indicators = getIndicators()

    clearHighlights(indicators)

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

  const getIndicators = () => {
    return Array.from(
      document.querySelectorAll(
        `[data-column="${column}"]`
      ) as unknown as HTMLElement[]
    )
  }

  const handleDragLeave = () => {
    clearHighlights()
    setActive(false)
  }

  const filteredCards = cards.filter((c) => c.column === column)

  return (
    <div className="w-56 shrink-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className={cn("font-medium", headingColor)}>{title}</h3>
        <span className="rounded text-sm text-muted-foreground">
          {filteredCards.length}
        </span>
      </div>
      <div
        onDrop={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "h-full w-full min-h-[200px] rounded-md border border-border transition-colors",
          active ? "bg-accent/50" : "bg-background"
        )}
      >
        {filteredCards.map((c) => {
          return <Card key={c.id} {...c} handleDragStart={handleDragStart} />
        })}
        <DropIndicator beforeId={null} column={column} />
        <AddCard column={column} setCards={setCards} />
      </div>
    </div>
  )
}

type CardProps = CardType & {
  handleDragStart: Function
}

const Card = ({ title, id, column, handleDragStart }: CardProps) => {
  return (
    <>
      <DropIndicator beforeId={id} column={column} />
      <motion.div
        layout
        layoutId={id}
        draggable="true"
        onDragStart={(e) => handleDragStart(e, { title, id, column })}
        className="cursor-grab rounded-md border border-border bg-card p-3 active:cursor-grabbing hover:bg-accent/50 transition-colors"
      >
        <p className="text-sm text-foreground">{title}</p>
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

const BurnBarrel = ({
  setCards,
}: {
  setCards: Dispatch<SetStateAction<CardType[]>>
}) => {
  const [active, setActive] = useState(false)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setActive(true)
  }

  const handleDragLeave = () => {
    setActive(false)
  }

  const handleDragEnd = (e: DragEvent) => {
    const cardId = e.dataTransfer.getData("cardId")

    setCards((pv) => pv.filter((c) => c.id !== cardId))

    setActive(false)
  }

  return (
    <div
      onDrop={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "mt-10 grid h-56 w-56 shrink-0 place-content-center rounded-md border text-3xl transition-colors",
        active
          ? "border-destructive bg-destructive/20 text-destructive"
          : "border-border bg-muted/20 text-muted-foreground"
      )}
    >
      {active ? <Flame className="h-6 w-6 animate-bounce" /> : <Trash2 className="h-6 w-6" />}
    </div>
  )
}

type AddCardProps = {
  column: ColumnType
  setCards: Dispatch<SetStateAction<CardType[]>>
}

const AddCard = ({ column, setCards }: AddCardProps) => {
  const [text, setText] = useState("")
  const [adding, setAdding] = useState(false)

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!text.trim().length) return

    const newCard = {
      column,
      title: text.trim(),
      id: Math.random().toString(),
    }

    setCards((pv) => [...pv, newCard])

    setText("")
    setAdding(false)
  }

  return (
    <>
      {adding ? (
        <motion.form layout onSubmit={handleSubmit} className="mt-2 p-2">
          <textarea
            onChange={(e) => setText(e.target.value)}
            value={text}
            autoFocus
            placeholder="Add new task..."
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          />
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false)
                setText("")
              }}
            >
              Close
            </Button>
            <Button
              type="submit"
              size="sm"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </motion.form>
      ) : (
        <motion.button
          layout
          onClick={() => setAdding(true)}
          className="mt-2 flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/50 rounded-md"
        >
          <Plus className="h-3 w-3" />
          <span>Add card</span>
        </motion.button>
      )}
    </>
  )
}
