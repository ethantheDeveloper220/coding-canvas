import { z } from 'zod'
import { router, publicProcedure } from '../index'
import { getOpenCodeUrl, setOpenCodeUrl } from '../../opencode-state'
import { getFileDiff, getFileStatus } from '../../opencode/diff'

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
        console.log('[OpenCode] getModels called')
        try {
            // Read directly from providers.json file
            const os = await import('os')
            const path = await import('path')
            const fs = await import('fs/promises')

            const configPath = path.join(os.homedir(), '.config', 'opencode', 'providers.json')
            const models: Record<string, { id: string; name: string; provider: string }> = {}
            console.log('[OpenCode] Config path:', configPath)

            try {
                const fileContent = await fs.readFile(configPath, 'utf-8')
                const providersData = JSON.parse(fileContent)

                // Parse providers from file
                if (providersData && typeof providersData === 'object') {
                    Object.entries(providersData).forEach(([providerId, providerData]: [string, any]) => {
                        const provider = providerData
                        const providerName = provider.name || providerId

                        // Parse models from provider
                        if (provider.models && typeof provider.models === 'object') {
                            Object.entries(provider.models).forEach(([modelKey, modelData]: [string, any]) => {
                                const model = modelData
                                const modelId = `${providerId}/${model.id || modelKey}`

                                models[modelId] = {
                                    id: modelId,
                                    name: model.name || model.id || modelKey,
                                    provider: providerName,
                                }
                            })
                        }
                    })
                }

                console.log('[OpenCode] Loaded', Object.keys(models).length, 'models from providers.json')
                // models loaded from providers.json

            } catch (fileError) {
                console.warn('[OpenCode] providers.json not found or invalid')
            }

            // 2. Try to generate models from auth.json
            try {
                const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json')
                const authContent = await fs.readFile(authPath, 'utf-8').catch(() => null)

                if (authContent) {
                    const authData = JSON.parse(authContent)

                    // Helper to add if not exists
                    const add = (id: string, name: string, provider: string) => {
                        if (!models[id]) {
                            models[id] = { id, name, provider }
                        }
                    }

                    // OpenAI Models
                    if (authData.openai) {
                        add('openai/gpt-4o', 'GPT-4o', 'OpenAI')
                        add('openai/gpt-4-turbo', 'GPT-4 Turbo', 'OpenAI')
                        add('openai/gpt-3.5-turbo', 'GPT-3.5 Turbo', 'OpenAI')
                    }

                    // Anthropic Models
                    if (authData.anthropic) {
                        add('anthropic/claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'Anthropic')
                        add('anthropic/claude-3-opus-20240229', 'Claude 3 Opus', 'Anthropic')
                        add('anthropic/claude-3-haiku-20240307', 'Claude 3 Haiku', 'Anthropic')
                    }

                    // Groq Models
                    if (authData.groq) {
                        add('groq/llama3-70b-8192', 'Llama 3 70B', 'Groq')
                        add('groq/llama3-8b-8192', 'Llama 3 8B', 'Groq')
                        add('groq/mixtral-8x7b-32768', 'Mixtral 8x7B', 'Groq')
                        add('groq/gemma-7b-it', 'Gemma 7B', 'Groq')
                    }

                    // OpenRouter Models
                    if (authData.openrouter) {
                        add('openrouter/anthropic/claude-3-opus', 'Claude 3 Opus (Router)', 'OpenRouter')
                        add('openrouter/anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet (Router)', 'OpenRouter')
                        add('openrouter/mistralai/mixtral-8x22b', 'Mixtral 8x22B (Router)', 'OpenRouter')
                        add('openrouter/meta-llama/llama-3-70b-instruct', 'Llama 3 70B (Router)', 'OpenRouter')
                    }

                    // LM Studio
                    if (authData.lmstudio) {
                        add('lmstudio/local-model', 'LM Studio Local', 'LM Studio')
                    }

                    if (Object.keys(models).length > 0) {
                        console.log('[OpenCode] Have models after auth.json check:', Object.keys(models).length)
                    }
                }
            } catch (e) {
                // Ignore auth error
            }

            // 3. Try to load models from opencode.json (legacy/user-specific)
            try {
                const legacyPath = path.join(os.homedir(), '.config', 'opencode', 'opencode.json')
                const legacyContent = await fs.readFile(legacyPath, 'utf-8').catch(() => null)

                if (legacyContent) {
                    const legacyData = JSON.parse(legacyContent)
                    // opencode.json can be { "opencode": { models: ... }, "openai": { models: ... } }
                    // merge everything that looks like a provider
                    if (legacyData && typeof legacyData === 'object') {
                        Object.entries(legacyData).forEach(([key, val]: [string, any]) => {
                            if (key === '$schema' || key === 'autoupdate') return

                            // Check if it looks like a provider definition
                            if (val && (val.models || val.name)) {
                                const providerId = key
                                const providerName = val.name || key
                                if (val.models && typeof val.models === 'object') {
                                    Object.entries(val.models).forEach(([mKey, mVal]: [string, any]) => {
                                        const mId = mVal.id || mKey
                                        // Avoid duplicates if already added
                                        const fullId = `${providerId}/${mId}`
                                        if (!models[fullId]) {
                                            models[fullId] = {
                                                id: fullId,
                                                name: mVal.name || mId,
                                                provider: providerName
                                            }
                                        }
                                    })
                                }
                            }
                        })
                    }
                }
            } catch (e) {
                // Ignore
            }

            // If we have any models, return them
            if (Object.keys(models).length > 0) {
                console.log('[OpenCode] Returning', Object.keys(models).length, 'models (merged)')
                return models
            }

            // 3. Fallback to API if absolutely nothing found locally
            console.log('[OpenCode] No local models from files, trying API...')
            const response = await fetch(`${getOpenCodeUrl()}/provider`)
            if (!response.ok) {
                throw new Error(`OpenCode API error: ${response.status}`)
            }
            const data = await response.json()

            const apiModels: Record<string, { id: string; name: string; provider: string }> = {}
            let providersList: any[] = []

            if (data.all && Array.isArray(data.all)) {
                providersList = data.all
            } else if (Array.isArray(data)) {
                providersList = data
            } else if (data && typeof data === 'object') {
                const source = (data.provider && typeof data.provider === 'object') ? data.provider : data
                providersList = Object.entries(source).map(([id, p]: [string, any]) => ({
                    ...p,
                    id: p.id || id
                }))
            }

            providersList.forEach((provider: any) => {
                const processModel = (modelIdRaw: string, modelData: any) => {
                    const modelId = `${provider.id}/${modelIdRaw}`
                    apiModels[modelId] = {
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

            return apiModels
        } catch (error) {
            console.error('[OpenCode] Failed to get models:', error)
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
    // Add a custom model to providers.json
    addModel: publicProcedure
        .input(
            z.object({
                provider: z.string(),
                modelName: z.string(),
                modelId: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const os = await import('os')
                const path = await import('path')
                const fs = await import('fs/promises')

                // Ensure directory exists
                const configDir = path.join(os.homedir(), '.config', 'opencode')
                await fs.mkdir(configDir, { recursive: true })

                const configPath = path.join(configDir, 'providers.json')

                // Read existing config or create new
                let providersData: any = {}
                try {
                    const fileContent = await fs.readFile(configPath, 'utf-8')
                    providersData = JSON.parse(fileContent)
                } catch {
                    // File doesn't exist or is invalid, start fresh
                    providersData = {}
                }

                const providerKey = input.provider.toLowerCase().replace(/\s+/g, '-')

                // Initialize provider if needed
                if (!providersData[providerKey]) {
                    providersData[providerKey] = {
                        id: providerKey,
                        name: input.provider,
                        models: {}
                    }
                }

                // Add model
                providersData[providerKey].models[input.modelId] = {
                    id: input.modelId,
                    name: input.modelName
                }

                // Write back to file
                await fs.writeFile(configPath, JSON.stringify(providersData, null, 2), 'utf-8')

                // Also try to update legacy location if it exists, just in case
                try {
                    const legacyPath = path.join(os.homedir(), '.opencode', 'providers.json')
                    await fs.writeFile(legacyPath, JSON.stringify(providersData, null, 2), 'utf-8')
                } catch { }

                console.log(`[OpenCode] Added model ${input.modelId} to ${configPath}`)
                return { success: true }
            } catch (error) {
                console.error('[OpenCode] Failed to add model:', error)
                throw error
            }
        }),
    // Import full configuration from JSON
    importConfig: publicProcedure
        .input(z.object({ configJson: z.string() }))
        .mutation(async ({ input }) => {
            try {
                const os = await import('os')
                const path = await import('path')
                const fs = await import('fs/promises')

                let newConfig: any
                try {
                    newConfig = JSON.parse(input.configJson)
                } catch (e) {
                    throw new Error("Invalid JSON format")
                }

                // Basic validation - check if it looks like our schema
                // Expecting either { "providerName": { ... } } or just standard format
                if (typeof newConfig !== 'object' || newConfig === null) {
                    throw new Error("Config must be an object")
                }

                // Ensure directory exists
                const configDir = path.join(os.homedir(), '.config', 'opencode')
                await fs.mkdir(configDir, { recursive: true })
                const configPath = path.join(configDir, 'providers.json')

                // Read existing config
                let currentConfig: any = {}
                try {
                    const content = await fs.readFile(configPath, 'utf-8')
                    currentConfig = JSON.parse(content)
                } catch { }

                // Merge: simple top-level merge for now, allowing overwrite
                const mergedConfig = { ...currentConfig, ...newConfig }

                // Write back
                await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8')
                console.log(`[OpenCode] Imported config to ${configPath}`)

                return { success: true, count: Object.keys(newConfig).length }
            } catch (error) {
                console.error('[OpenCode] Failed to import config:', error)
                throw error
            }
        }),

    // Get git diff for a single file (GitHub-style)
    getFileDiff: publicProcedure
        .input(
            z.object({
                worktreePath: z.string(),
                filePath: z.string(),
            })
        )
        .query(async ({ input }) => {
            return getFileDiff(input.worktreePath, input.filePath)
        }),

    // Get git status for a single file
    getFileStatus: publicProcedure
        .input(
            z.object({
                worktreePath: z.string(),
                filePath: z.string(),
            })
        )
        .query(async ({ input }) => {
            return getFileStatus(input.worktreePath, input.filePath)
        }),
})
