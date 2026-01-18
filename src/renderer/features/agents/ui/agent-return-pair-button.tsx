import { useState } from 'react'
import { Button } from '../../../components/ui/button'
import { RotateCcw, Send } from 'lucide-react'

interface ReturnPairButtonProps {
    onReturnPair: (context: string) => void
    isLoading?: boolean
    errorMessage?: string
    successMessage?: string
}

/**
 * Return Pair Button - Recalls AI with new information
 * 
 * This button allows users to send feedback/context back to the AI
 * so it can retry or continue with updated information.
 * 
 * Use cases:
 * - Tool failed → Send error details back to AI
 * - User wants to provide more context
 * - AI needs to retry with different approach
 */
export function ReturnPairButton({
    onReturnPair,
    isLoading = false,
    errorMessage,
    successMessage
}: ReturnPairButtonProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [contextInput, setContextInput] = useState('')

    const handleSubmit = () => {
        if (!contextInput.trim()) return

        onReturnPair(contextInput)
        setContextInput('')
        setIsExpanded(false)
    }

    // Auto-fill with error or success message
    const defaultContext = errorMessage || successMessage || ''

    return (
        <div className="flex flex-col gap-2">
            {!isExpanded ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setIsExpanded(true)
                        if (defaultContext) {
                            setContextInput(defaultContext)
                        }
                    }}
                    disabled={isLoading}
                    className="gap-2"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Return to AI
                </Button>
            ) : (
                <div className="flex flex-col gap-2 p-3 border border-border rounded-lg bg-muted/30">
                    <label className="text-xs font-medium text-muted-foreground">
                        Send context back to AI:
                    </label>
                    <textarea
                        value={contextInput}
                        onChange={(e) => setContextInput(e.target.value)}
                        placeholder="Describe what happened or provide additional context..."
                        className="w-full min-h-[80px] px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setIsExpanded(false)
                                setContextInput('')
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={!contextInput.trim() || isLoading}
                            className="gap-2"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Send to AI
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Hook to use Return Pair functionality
 * 
 * Usage:
 * ```tsx
 * const { returnPair, isReturning } = useReturnPair(chatId, subChatId)
 * 
 * <ReturnPairButton 
 *   onReturnPair={returnPair}
 *   isLoading={isReturning}
 *   errorMessage="Tool failed: File not found"
 * />
 * ```
 */
export function useReturnPair(chatId: string, subChatId: string) {
    const [isReturning, setIsReturning] = useState(false)

    const returnPair = async (context: string) => {
        setIsReturning(true)

        try {
            // Send message back to AI with context
            const event = new CustomEvent('send-chat-message', {
                detail: {
                    message: `[Return Pair] ${context}`,
                    chatId,
                    subChatId,
                    isReturnPair: true
                }
            })
            window.dispatchEvent(event)
        } finally {
            setIsReturning(false)
        }
    }

    return { returnPair, isReturning }
}
