import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { toast } from 'sonner'
import { CustomScrollbar } from '../../../components/ui/custom-scrollbar'

interface Suggestion {
    id: string
    text: string
    icon?: React.ReactNode
    category?: 'file' | 'code' | 'debug' | 'general'
}

interface SmartSuggestionsProps {
    chatId?: string
    onSuggestionClick: (text: string) => void
    context?: {
        hasFiles?: boolean
        hasErrors?: boolean
        lastMessage?: string
        recentChanges?: string[]
    }
}

/**
 * Smart Suggestions Component
 * 
 * Shows contextual suggestions above the prompt box
 * Updates automatically when database changes (new messages, file changes, etc.)
 */
export function SmartSuggestions({
    chatId,
    onSuggestionClick,
    context = {}
}: SmartSuggestionsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [isVisible, setIsVisible] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [refreshCount, setRefreshCount] = useState(0)

    // Generate suggestions based on context
    useEffect(() => {
        const newSuggestions = generateSuggestions(context, refreshCount)
        setSuggestions(newSuggestions)
    }, [context, refreshCount])

    // Listen for database updates
    useEffect(() => {
        if (!chatId) return

        const handleDbUpdate = (event: CustomEvent) => {
            if (event.detail.chatId === chatId) {
                // Refresh suggestions when DB updates
                const newSuggestions = generateSuggestions(context, refreshCount)
                setSuggestions(newSuggestions)
            }
        }

        window.addEventListener('db-update' as any, handleDbUpdate)
        return () => window.removeEventListener('db-update' as any, handleDbUpdate)
    }, [chatId, context, refreshCount])

    const handleRefresh = () => {
        setIsRefreshing(true)
        // Simulate loading state
        setTimeout(() => {
            setRefreshCount(prev => prev + 1)
            setIsRefreshing(false)
        }, 500)
    }

    if (!isVisible || suggestions.length === 0) {
        return null
    }

    return (
        <div className="px-4 pb-3">
            <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Suggestions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            title="Refresh suggestions"
                        >
                            <svg
                                className={cn(
                                    "w-3.5 h-3.5",
                                    isRefreshing && "animate-spin"
                                )}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Hide
                        </button>
                    </div>
                </div>

                <CustomScrollbar direction="horizontal" className="-mx-1 px-1">
                    <div className="flex gap-2">
                        {isRefreshing ? (
                            // Loading state
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                                <span>Generating suggestions...</span>
                            </div>
                        ) : (
                            suggestions.map((suggestion) => (
                                <button
                                    key={suggestion.id}
                                    onClick={() => {
                                        onSuggestionClick(suggestion.text)
                                        setIsVisible(false)
                                        // Show toast notification
                                        toast.success(`Writing code: ${suggestion.text}`, {
                                            description: "Sending to AI...",
                                            duration: 2000,
                                        })
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 text-sm rounded-md border transition-all whitespace-nowrap flex-shrink-0",
                                        "hover:bg-background hover:border-primary/50",
                                        "focus:outline-none focus:ring-2 focus:ring-primary",
                                        "bg-background/50",
                                        getCategoryStyles(suggestion.category)
                                    )}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {suggestion.icon}
                                        {suggestion.text}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </CustomScrollbar>
            </div>
        </div>
    )
}

/**
 * Generate suggestions based on context
 * Uses AI to create contextual suggestions
 */
function generateSuggestions(context: SmartSuggestionsProps['context'], refreshCount: number = 0): Suggestion[] {
    const suggestions: Suggestion[] = []

    // Active chat with context - suggest improvements
    if (context?.hasFiles || context?.lastMessage) {
        // File-related improvements
        if (context.hasFiles) {
            suggestions.push({
                id: 'improve-code',
                text: 'Improve this code',
                category: 'code',
            })
            suggestions.push({
                id: 'add-features',
                text: 'Add more features',
                category: 'code',
            })
        }

        // Error-related suggestions
        if (context.hasErrors) {
            suggestions.push({
                id: 'fix-bugs',
                text: 'Fix bugs and errors',
                category: 'debug',
            })
        }

        // Recent changes - suggest next steps
        if (context.recentChanges && context.recentChanges.length > 0) {
            suggestions.push({
                id: 'continue-work',
                text: 'Continue development',
                category: 'code',
            })
        }

        // General improvements
        if (suggestions.length < 4) {
            suggestions.push({
                id: 'optimize',
                text: 'Optimize performance',
                category: 'code',
            })
        }
        if (suggestions.length < 4) {
            suggestions.push({
                id: 'add-tests',
                text: 'Add tests',
                category: 'code',
            })
        }
    }
    // New chat - suggest project types (rotate on refresh)
    else {
        const projectIdeas = [
            // Set 1
            [
                { id: 'todo-app', text: 'Todo app', category: 'general' as const },
                { id: 'blog-site', text: 'Blog website', category: 'general' as const },
                { id: 'ecommerce', text: 'E-commerce store', category: 'general' as const },
                { id: 'portfolio', text: 'Portfolio site', category: 'general' as const },
            ],
            // Set 2
            [
                { id: 'chat-app', text: 'Chat application', category: 'general' as const },
                { id: 'dashboard', text: 'Analytics dashboard', category: 'general' as const },
                { id: 'social-media', text: 'Social media app', category: 'general' as const },
                { id: 'booking-system', text: 'Booking system', category: 'general' as const },
            ],
            // Set 3
            [
                { id: 'note-app', text: 'Note-taking app', category: 'general' as const },
                { id: 'weather-app', text: 'Weather app', category: 'general' as const },
                { id: 'recipe-site', text: 'Recipe website', category: 'general' as const },
                { id: 'fitness-tracker', text: 'Fitness tracker', category: 'general' as const },
            ],
            // Set 4
            [
                { id: 'music-player', text: 'Music player', category: 'general' as const },
                { id: 'video-platform', text: 'Video platform', category: 'general' as const },
                { id: 'learning-platform', text: 'Learning platform', category: 'general' as const },
                { id: 'marketplace', text: 'Marketplace', category: 'general' as const },
            ],
        ]

        // Rotate through different sets on refresh
        const setIndex = refreshCount % projectIdeas.length
        suggestions.push(...projectIdeas[setIndex])
    }

    return suggestions.slice(0, 4) // Max 4 suggestions
}

/**
 * Get category-specific styles
 */
function getCategoryStyles(category?: Suggestion['category']): string {
    switch (category) {
        case 'file':
            return 'border-blue-500/30 text-blue-600 dark:text-blue-400'
        case 'code':
            return 'border-green-500/30 text-green-600 dark:text-green-400'
        case 'debug':
            return 'border-red-500/30 text-red-600 dark:text-red-400'
        default:
            return 'border-border text-foreground'
    }
}

/**
 * Hook to manage suggestions context
 */
export function useSuggestionsContext(chatId?: string) {
    const [context, setContext] = useState<SmartSuggestionsProps['context']>({})

    useEffect(() => {
        if (!chatId) return

        // Fetch context from database
        const fetchContext = async () => {
            try {
                // TODO: Implement tRPC call to get context
                // const result = await trpcClient.chats.getSuggestionsContext.query({ chatId })

                // For now, use placeholder
                setContext({
                    hasFiles: true,
                    hasErrors: false,
                    lastMessage: '',
                    recentChanges: [],
                })
            } catch (error) {
                console.error('[Suggestions] Error fetching context:', error)
            }
        }

        fetchContext()

        // Listen for database updates
        const handleDbUpdate = () => {
            fetchContext()
        }

        window.addEventListener('db-update' as any, handleDbUpdate)
        return () => window.removeEventListener('db-update' as any, handleDbUpdate)
    }, [chatId])

    return context
}
