import crypto from 'crypto'
import { getDatabase, subChats, chats } from '../db'
import { eq } from 'drizzle-orm'

interface OpenCodeStreamingInput {
    input: {
        subChatId: string
        chatId: string
        prompt: string
        cwd: string
        mode: 'plan' | 'build' | 'scaling' | 'designer' | 'debug'
        sessionId?: string
        model?: string
        images?: Array<{
            base64Data: string
            mediaType: string
            filename?: string
        }>
        projectPath?: string
        maxThinkingTokens?: number
        agentType?: string
        systemPrompt?: string // Mode-specific system prompt to prepend
    }
    emit: (chunk: any) => void
    emitError: (context: string, error: unknown) => void
    safeComplete: () => void
    abortController: AbortController
    existingMessages: any[]
}

export async function runOpenCodeChatStreaming({
    input,
    emit,
    emitError,
    safeComplete,
    abortController,
    existingMessages,
}: OpenCodeStreamingInput) {
    const db = getDatabase()

    try {
        // Get OpenCode server URL from environment
        const apiUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096'
        console.log('[OpenCode] Starting chat with OpenCode API (STREAMING)')
        console.log('[OpenCode] Model:', input.model || 'opencode/glm-4.7-free')
        console.log('[OpenCode] API URL:', apiUrl)
        console.log('[OpenCode] Working directory:', input.cwd)

        // Create auth headers if credentials are provided
        const createAuthHeaders = (baseHeaders: Record<string, string> = {}) => {
            const headers = { ...baseHeaders }
            const username = process.env.OPENCODE_SERVER_USERNAME
            const password = process.env.OPENCODE_SERVER_PASSWORD

            if (username && password) {
                const auth = Buffer.from(`${username}:${password}`).toString('base64')
                headers['Authorization'] = `Basic ${auth}`
            }

            return headers
        }

        // Get or create session
        let sessionId = input.sessionId
        if (!sessionId) {
            console.log('[OpenCode] Creating new session')
            const headers = createAuthHeaders({
                'Content-Type': 'application/json',
                'x-opencode-directory': input.cwd,
            })

            const sessionResponse = await fetch(`${apiUrl}/session`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title: input.chatId || 'Chat Session',
                }),
                signal: abortController.signal,
            })

            if (!sessionResponse.ok) {
                const errorText = await sessionResponse.text()
                throw new Error(`Failed to create session: ${sessionResponse.status} - ${errorText}`)
            }

            const sessionData = await sessionResponse.json()
            sessionId = sessionData.id
            console.log('[OpenCode] Created session:', sessionId)
        } else {
            console.log('[OpenCode] Using existing session:', sessionId)
        }

        // Save original user prompt (without system reminder) to database for display
        const messagesToSave = [
            ...existingMessages,
            {
                id: `msg-${Date.now()}`,
                role: 'user',
                parts: [{ type: 'text', text: input.prompt }],
            },
        ]

        db.update(subChats)
            .set({
                messages: JSON.stringify(messagesToSave),
                updatedAt: new Date(),
            })
            .where(eq(subChats.id, input.subChatId))
            .run()

        // Prepend system prompt to the prompt sent to OpenCode (agent context only, not visible to user)
        const agentPrompt = input.systemPrompt
            ? `${input.systemPrompt}\n\n${input.prompt}`
            : input.prompt

        // Build message parts for the prompt
        const parts: any[] = []

        // Add text prompt (with system reminder for agent context)
        parts.push({
            type: 'text',
            text: agentPrompt
        })

        // Add images if provided
        if (input.images && input.images.length > 0) {
            for (const img of input.images) {
                parts.push({
                    type: 'image',
                    mime: img.mediaType,
                    data: img.base64Data
                })
            }
        }

        console.log('[OpenCode] Sending prompt with', parts.length, 'parts')

        // Parse model ID to extract provider and model
        let providerID = 'opencode'
        let modelID = input.model || 'glm-4.7-free'

        if (modelID.includes('/')) {
            [providerID, modelID] = modelID.split('/', 2)
        }

        console.log('[OpenCode] Using model:', { providerID, modelID })

        const requestBody: any = { parts }

        // Map each mode to OpenCode-supported modes (plan, build, or agent)
        // OpenCode API only accepts: "plan", "build", or "agent"
        let opencodeMode: 'plan' | 'build' | 'agent' = 'build'
        if (input.mode === 'plan') {
            opencodeMode = 'plan'
        } else {
            // All other modes (build, scaling, designer, debug, agent) map to 'build' for full tool access
            opencodeMode = 'build'
        }
        // Ensure we never send an invalid mode to the API
        if (opencodeMode !== 'plan' && opencodeMode !== 'build' && opencodeMode !== 'agent') {
            console.warn(`[OpenCode] Invalid mode detected: ${opencodeMode}, defaulting to 'build'`)
            opencodeMode = 'build'
        }
        requestBody.mode = opencodeMode
        if (input.mode !== opencodeMode) {
            console.log(`[OpenCode] Mode mapping: ${input.mode} -> ${opencodeMode}`)
        }
        console.log(`[OpenCode] Final requestBody.mode: ${requestBody.mode}`)

        // Add model information if specified
        if (input.model) {
            requestBody.model = {
                providerID,
                modelID
            }
        }

        const messageHeaders = createAuthHeaders({
            'Content-Type': 'application/json',
            'x-opencode-directory': input.cwd,
        })

        console.log('[OpenCode] Sending request to:', `${apiUrl}/session/${sessionId}/prompt_async`)
        console.log('[OpenCode] Request body:', JSON.stringify(requestBody, null, 2))

        // Step 1: Send prompt_async (returns immediately)
        const promptResponse = await fetch(`${apiUrl}/session/${sessionId}/prompt_async`, {
            method: 'POST',
            headers: messageHeaders,
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
        })

        if (!promptResponse.ok) {
            const errorText = await promptResponse.text()
            console.error('[OpenCode] Error response:', errorText)

            emit({
                type: 'text-delta',
                id: crypto.randomUUID(),
                delta: `❌ OpenCode Error: ${promptResponse.status}\n\n${errorText}`,
            })
            emit({ type: 'finish' })
            safeComplete()
            return
        }

        console.log('[OpenCode] Prompt sent, subscribing to event stream...')

        // Get or create the singleton global EventSource
        // const eventSource = getGlobalEventSource(apiUrl)
        // console.log('[OpenCode] Using global EventSource, will filter by session:', sessionId)

        let hasReceivedData = false
        const assistantParts: any[] = []
        const startTime = Date.now()

        // Track processed message IDs to prevent duplicates
        const processedMessageIds = new Set<string>()
        const processedPartIds = new Set<string>()

        // Emit initial events
        emit({ type: 'start' })
        emit({ type: 'start-step' })

        // Create session-specific handler
        const sessionHandler = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                console.log('[OpenCode] SSE event:', data.type, data.sessionID)

                // Filter events for this session only
                if (data.sessionID !== sessionId) {
                    return
                }

                // Deduplicate messages - skip if we've already processed this message
                if (data.info?.id && processedMessageIds.has(data.info.id)) {
                    console.log('[OpenCode] Skipping duplicate message:', data.info.id)
                    return
                }

                // Deduplicate parts - skip if we've already processed this part
                if (data.part?.id && processedPartIds.has(data.part.id)) {
                    console.log('[OpenCode] Skipping duplicate part:', data.part.id)
                    return
                }

                // Mark message/part as processed
                if (data.info?.id) processedMessageIds.add(data.info.id)
                if (data.part?.id) processedPartIds.add(data.part.id)

                hasReceivedData = true

                // Handle text chunks
                if (data.type === 'text' && data.text) {
                    const textId = crypto.randomUUID()
                    emit({ type: 'text-start', id: textId })
                    emit({ type: 'text-delta', id: textId, delta: data.text })
                    emit({ type: 'text-end', id: textId })
                    assistantParts.push({ type: 'text', text: data.text })
                }

                // Handle reasoning/thinking
                else if (data.type === 'reasoning' && data.text) {
                    const reasoningId = crypto.randomUUID()
                    emit({
                        type: 'tool-input-available',
                        toolCallId: reasoningId,
                        toolName: 'Thinking',
                        input: { text: data.text },
                    })
                    emit({
                        type: 'tool-output-available',
                        toolCallId: reasoningId,
                        output: { completed: true },
                    })
                }

                // Handle tool calls
                else if (data.type === 'tool') {
                    const toolCallId = data.callID || crypto.randomUUID()
                    const toolName = data.tool || 'unknown'

                    // Show user-friendly status message
                    const toolStatusMessages: Record<string, string> = {
                        'write_file': 'Writing code',
                        'edit_file': 'Editing file',
                        'read_file': 'Reading file',
                        'run_command': 'Running command',
                        'bash': 'Executing command',
                        'grep': 'Searching code',
                        'find_files': 'Finding files',
                        'list_dir': 'Listing directory',
                        'git_diff': 'Checking changes',
                        'git_commit': 'Committing changes',
                        'create_file': 'Creating file',
                        'delete_file': 'Deleting file',
                        'move_file': 'Moving file',
                    }
                    const statusMessage = toolStatusMessages[toolName] || `Using ${toolName}`

                    emit({
                        type: 'tool-input-available',
                        toolCallId,
                        toolName: statusMessage,
                        input: data.state?.input || {},
                    })

                    if (data.state?.output) {
                        emit({
                            type: 'tool-output-available',
                            toolCallId,
                            output: data.state.output,
                        })
                    }

                    assistantParts.push({
                        type: 'tool-use',
                        id: toolCallId,
                        name: toolName,
                        input: data.state?.input || {},
                    })

                    if (data.state?.output) {
                        assistantParts.push({
                            type: 'tool-result',
                            tool_use_id: toolCallId,
                            content: data.state.output,
                        })
                    }
                }

                // Handle completion
                else if (data.type === 'finish' || data.type === 'complete' || data.type === 'step-finish') {
                    const endTime = Date.now()
                    const duration = endTime - startTime

                    // Emit metadata
                    emit({
                        type: 'message-metadata',
                        metadata: {
                            sessionId,
                            model: input.model || 'gpt-4o',
                            provider: 'opencode',
                            duration,
                            tokenUsage: {},
                            cost: 0,
                        },
                    })

                    // Save to database
                    const finalMessages = [
                        ...messagesToSave,
                        {
                            id: `msg-${Date.now()}`,
                            role: 'assistant',
                            parts: assistantParts,
                        },
                    ]

                    db.update(subChats)
                        .set({
                            messages: JSON.stringify(finalMessages),
                            sessionId: sessionId,
                            updatedAt: new Date(),
                        })
                        .where(eq(subChats.id, input.subChatId))
                        .run()

                    db.update(chats)
                        .set({ updatedAt: new Date() })
                        .where(eq(chats.id, input.chatId))
                        .run()

                    emit({ type: 'finish-step' })
                    emit({ type: 'finish' })

                    cleanup()
                    safeComplete()
                }
            } catch (error) {
                console.error('[OpenCode] Error parsing SSE event:', error)
            }
        }

        // Cleanup function
        const cleanup = () => {
            console.log('[OpenCode] Cleaning up session handler')
        }

        // Handle abort
        abortController.signal.addEventListener('abort', () => {
            console.log('[OpenCode] Aborting stream')
            cleanup()
        })
    } catch (error) {
        console.error('[OpenCode] Error:', error)
        emitError('OpenCode streaming error', error)
    }
}