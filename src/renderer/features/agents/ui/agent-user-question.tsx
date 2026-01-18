"use client"

import { memo, useState, useRef, useEffect } from "react"
import { Button } from "../../../components/ui/button"
import { cn } from "../../../lib/utils"
import type { PendingUserQuestions } from "../atoms"

interface AgentUserQuestionProps {
  pendingQuestions: PendingUserQuestions
  onAnswer: (answers: Record<string, string | string[]>) => void
  onSkip: () => void
  onAnswerInPrompt?: (questionsText: string) => void
}

export const AgentUserQuestion = memo(function AgentUserQuestion({
  pendingQuestions,
  onAnswer,
  onSkip,
}: AgentUserQuestionProps) {
  // Check if pendingQuestions is defined
  if (!pendingQuestions) {
    return null
  }
  
  const { questions } = pendingQuestions
  // Support both single and multiple answers per question
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Refs for text inputs to update them when clicking options
  const inputRefs = useRef<Record<string, HTMLInputElement>>({})

  const handleSubmit = async () => {
    setIsSubmitting(true)
    await onAnswer(answers)
  }

  const handleSkipAll = async () => {
    setIsSubmitting(true)
    await onSkip()
  }

  const allQuestionsAnswered = questions.every(q => {
    const answer = answers[q.question]
    if (Array.isArray(answer)) return answer.length > 0
    return answer?.trim()
  })

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Questions
            </h3>
            <span className="text-xs text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Questions */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {questions.map((q, index) => (
            <div key={index} className="space-y-2">
              <label className="text-sm font-medium text-foreground block">
                {index + 1}. {q.question}
              </label>
              <input
                type="text"
                value={answers[q.question] || ''}
                onChange={(e) => {
                  setAnswers({
                    ...answers,
                    [q.question]: e.target.value
                  })
                }}
                placeholder={q.options?.map(o => o.label).join(' / ') || 'Type your answer...'}
                disabled={isSubmitting}
                className={cn(
                  "w-full px-3 py-2 text-sm bg-background border border-border rounded-md",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  "placeholder:text-muted-foreground",
                  isSubmitting && "opacity-50 cursor-not-allowed"
                )}
                autoFocus={index === 0}
              />
              {q.options && q.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((option, optIndex) => {
                    const currentAnswer = answers[q.question]
                    const isSelected = Array.isArray(currentAnswer)
                      ? currentAnswer.includes(option.label)
                      : currentAnswer === option.label

                    return (
                      <button
                        key={optIndex}
                        onClick={() => {
                          if (q.multiSelect || q.allowMultiple) {
                            // Multiple choice - toggle selection
                            const current = answers[q.question]
                            const currentArray = Array.isArray(current) ? current : current ? [current] : []

                            if (currentArray.includes(option.label)) {
                              // Remove from selection
                              const newSelection = currentArray.filter(v => v !== option.label)
                              setAnswers({
                                ...answers,
                                [q.question]: newSelection
                              })
                            } else {
                              // Add to selection
                              setAnswers({
                                ...answers,
                                [q.question]: [...currentArray, option.label]
                              })
                            }
                          } else {
                            // Single choice - replace selection
                            setAnswers({
                              ...answers,
                              [q.question]: option.label
                            })
                            // Update text input to show selected option
                            const inputEl = document.querySelector(`input[placeholder*="${q.question}"]`) as HTMLInputElement
                            if (inputEl) {
                              inputEl.value = option.label
                            }
                          }
                        }}
                        disabled={isSubmitting}
                        className={cn(
                          "px-2 py-1 text-xs rounded-md border transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-muted/80 border-border",
                          isSubmitting && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipAll}
            disabled={isSubmitting}
          >
            Skip All
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered || isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
})
