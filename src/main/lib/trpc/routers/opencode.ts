import { z } from 'zod'
import { router, publicProcedure } from '../index'
import { getOpenCodeUrl, setOpenCodeUrl } from '../../opencode-state'

// OpenCode API configuration - can be updated via setPort
// OpenCode API configuration - managed via opencode-state


export const opencodeRouter = router({
    // Set OpenCode server port
    setPort: publicProcedure
        .input(z.object({ port: z.number() }))
        .mutation(async ({ input }) => {
            const newUrl = `http://localhost:${input.port}`
            setOpenCodeUrl(newUrl)
            return { success: true, url: newUrl }
        }),

    // Get current OpenCode server URL
    getServerUrl: publicProcedure.query(async () => {
        return getOpenCodeUrl()
    }),

    // Get available models from OpenCode
    getModels: publicProcedure.query(async () => {
        try {
            const response = await fetch(`${getOpenCodeUrl()}/provider`)
            if (!response.ok) {
                throw new Error(`OpenCode API error: ${response.status}`)
            }
            const data = await response.json()

            // OpenCode returns: { all: Provider[], default: Record<string, string>, connected: string[] }
            const models: Record<string, { id: string; name: string; provider: string }> = {}
            let providersList: any[] = []

            if (data.all && Array.isArray(data.all)) {
                providersList = data.all
            } else if (Array.isArray(data)) {
                providersList = data
            } else if (data && typeof data === 'object') {
                // Check if it's the "provider" wrapper from config file or just the map
                // If data has "provider" key which is object (like full config), use that
                const source = (data.provider && typeof data.provider === 'object') ? data.provider : data

                providersList = Object.entries(source).map(([id, p]: [string, any]) => ({
                    ...p,
                    id: p.id || id
                }))
            }

            // Parse providers
            providersList.forEach((provider: any) => {
                // Models can be array or object
                const processModel = (modelIdRaw: string, modelData: any) => {
                    const modelId = `${provider.id}/${modelIdRaw}`
                    models[modelId] = {
                        id: modelId,
                        name: modelData.name || modelData.id || modelIdRaw,
                        provider: provider.name || provider.id,
                    }
                }

                if (provider.models) {
                    if (Array.isArray(provider.models)) {
                        provider.models.forEach((model: any) => {
                            processModel(model.id, model)
                        })
                    } else if (typeof provider.models === 'object') {
                        Object.entries(provider.models).forEach(([modelKey, modelData]: [string, any]) => {
                            processModel(modelData.id || modelKey, modelData)
                        })
                    }
                }
            })

            // If no models found, return defaults
            if (Object.keys(models).length === 0) {
                console.log('[OpenCode] No models found, using defaults')
                return {
                    'anthropic/claude-3-5-sonnet-20241022': {
                        id: 'anthropic/claude-3-5-sonnet-20241022',
                        name: 'Claude 3.5 Sonnet',
                        provider: 'Anthropic',
                    },
                    'anthropic/claude-3-opus-20240229': {
                        id: 'anthropic/claude-3-opus-20240229',
                        name: 'Claude 3 Opus',
                        provider: 'Anthropic',
                    },
                    'anthropic/claude-3-haiku-20240307': {
                        id: 'anthropic/claude-3-haiku-20240307',
                        name: 'Claude 3 Haiku',
                        provider: 'Anthropic',
                    },
                    'openai/gpt-4': {
                        id: 'openai/gpt-4',
                        name: 'GPT-4',
                        provider: 'OpenAI',
                    },
                }
            }

            console.log('[OpenCode] Fetched', Object.keys(models).length, 'models')
            return models
        } catch (error) {
            console.error('[OpenCode] Failed to fetch models:', error)
            // Return default models as fallback
            return {
                'anthropic/claude-3-5-sonnet-20241022': {
                    id: 'anthropic/claude-3-5-sonnet-20241022',
                    name: 'Claude 3.5 Sonnet',
                    provider: 'Anthropic',
                },
                'anthropic/claude-3-opus-20240229': {
                    id: 'anthropic/claude-3-opus-20240229',
                    name: 'Claude 3 Opus',
                    provider: 'Anthropic',
                },
                'anthropic/claude-3-haiku-20240307': {
                    id: 'anthropic/claude-3-haiku-20240307',
                    name: 'Claude 3 Haiku',
                    provider: 'Anthropic',
                },
                'openai/gpt-4': {
                    id: 'openai/gpt-4',
                    name: 'GPT-4',
                    provider: 'OpenAI',
                },
            }
        }
    }),

    // Create a new OpenCode session
    createSession: publicProcedure
        .input(
            z.object({
                directory: z.string().optional(),
                agent: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const params = new URLSearchParams()
                if (input.directory) params.append('directory', input.directory)

                const response = await fetch(`${getOpenCodeUrl()}/session?${params}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        agent: input.agent || 'build',
                    }),
                })

                if (!response.ok) {
                    throw new Error(`OpenCode API error: ${response.status}`)
                }

                const session = await response.json()
                console.log('[OpenCode] Session created:', session.id)
                return session
            } catch (error) {
                console.error('[OpenCode] Failed to create session:', error)
                throw error
            }
        }),

    // Send a message to OpenCode session
    sendMessage: publicProcedure
        .input(
            z.object({
                sessionId: z.string(),
                message: z.string(),
                directory: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const params = new URLSearchParams()
                if (input.directory) params.append('directory', input.directory)

                const response = await fetch(
                    `${getOpenCodeUrl()}/session/${input.sessionId}/message?${params}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: input.message,
                        }),
                    }
                )

                if (!response.ok) {
                    throw new Error(`OpenCode API error: ${response.status}`)
                }

                return await response.json()
            } catch (error) {
                console.error('[OpenCode] Failed to send message:', error)
                throw error
            }
        }),

    // Get session messages (for streaming)
    getSessionMessages: publicProcedure
        .input(
            z.object({
                sessionId: z.string(),
                directory: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            try {
                const params = new URLSearchParams()
                if (input.directory) params.append('directory', input.directory)

                const response = await fetch(
                    `${getOpenCodeUrl()}/session/${input.sessionId}/message?${params}`
                )

                if (!response.ok) {
                    throw new Error(`OpenCode API error: ${response.status}`)
                }

                return await response.json()
            } catch (error) {
                console.error('[OpenCode] Failed to get messages:', error)
                throw error
            }
        }),

    // Get OpenCode health status
    getHealth: publicProcedure.query(async () => {
        try {
            const response = await fetch(`${getOpenCodeUrl()}/global/health`)
            if (!response.ok) {
                return { healthy: false, version: null }
            }
            const data = await response.json()
            return data
        } catch (error) {
            console.error('[OpenCode] Health check failed:', error)
            return { healthy: false, version: null }
        }
    }),

    // Get OpenCode configuration
    getConfig: publicProcedure.query(async () => {
        try {
            const response = await fetch(`${getOpenCodeUrl()}/config`)
            if (!response.ok) {
                throw new Error(`OpenCode API error: ${response.status}`)
            }
            return await response.json()
        } catch (error) {
            console.error('[OpenCode] Failed to fetch config:', error)
            return null
        }
    }),

    // Update OpenCode configuration
    updateConfig: publicProcedure
        .input(
            z.object({
                provider: z.string().optional(),
                model: z.string().optional(),
                apiKey: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const response = await fetch(`${getOpenCodeUrl()}/config`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(input),
                })

                if (!response.ok) {
                    throw new Error(`OpenCode API error: ${response.status}`)
                }

                return await response.json()
            } catch (error) {
                console.error('[OpenCode] Failed to update config:', error)
                throw error
            }
        }),
})
