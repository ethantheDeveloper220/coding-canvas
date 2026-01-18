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
        const apiUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:4098'
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
        // Add PowerShell instruction: try PowerShell first, then bash if it doesn't work
        const powershellInstruction = "IMPORTANT: When executing terminal commands, use PowerShell commands first. If PowerShell commands don't work or are not available, then try bash commands as a fallback."
        const combinedSystemPrompt = input.systemPrompt 
            ? `${powershellInstruction}\n\n${input.systemPrompt}`
            : powershellInstruction
        
        const agentPrompt = `${combinedSystemPrompt}\n\n${input.prompt}`

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

        // Step 2: Subscribe to global event stream for real-time updates
        const eventUrl = `${apiUrl}/global/event`
        const eventSource = new EventSource(eventUrl)

        let hasReceivedData = false
        const assistantParts: any[] = []
        const startTime = Date.now()
        
        // Track text parts to avoid creating new IDs for each chunk
        const textPartIds = new Map<string, string>()
        let currentTextId: string | null = null
        let lastEmitTime = 0
        const EMIT_THROTTLE_MS = 16 // ~60fps, smooth updates without overwhelming the UI

        // Emit initial events
        emit({ type: 'start' })
        emit({ type: 'start-step' })

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                
                // Filter events for this session only (do this first, before logging)
                if (data.sessionID !== sessionId) {
                    return
                }
                
                // Only log important events to reduce overhead
                if (data.type !== 'text') {
                    console.log('[OpenCode] SSE event:', data.type, data.sessionID)
                }

                hasReceivedData = true

                // Handle text chunks with throttling
                if (data.type === 'text' && data.text) {
                    // Reuse the same text ID for continuous text streaming
                    if (!currentTextId) {
                        currentTextId = crypto.randomUUID()
                        emit({ type: 'text-start', id: currentTextId })
                    }
                    
                    // Throttle emit to avoid overwhelming the UI
                    const now = Date.now()
                    if (now - lastEmitTime >= EMIT_THROTTLE_MS) {
                        emit({ type: 'text-delta', id: currentTextId, delta: data.text })
                        lastEmitTime = now
                    }
                    
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
                    
                    // End current text part if exists
                    if (currentTextId) {
                        emit({ type: 'text-end', id: currentTextId })
                        currentTextId = null
                    }

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

                    eventSource.close()
                    safeComplete()
                }
            } catch (error) {
                console.error('[OpenCode] Error parsing SSE event:', error)
            }
        }

        eventSource.onerror = (error) => {
            console.error('[OpenCode] SSE error:', error)
            eventSource.close()

            if (!hasReceivedData) {
                emit({
                    type: 'text-delta',
                    id: crypto.randomUUID(),
                    delta: '❌ OpenCode streaming connection failed. Check if the server is running.',
                })
            }

            emit({ type: 'finish' })
            safeComplete()
        }

        // Handle abort
        abortController.signal.addEventListener('abort', () => {
            console.log('[OpenCode] Aborting stream')
            eventSource.close()
        })

        // Fallback timeout: close after 5 minutes
        setTimeout(() => {
            if (eventSource.readyState !== EventSource.CLOSED) {
                console.warn('[OpenCode] Stream timeout after 5 minutes')
                eventSource.close()
                emit({ type: 'finish' })
                safeComplete()
            }
        }, 300000)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[OpenCode] Chat error:', error)

        emit({
            type: 'text-delta',
            id: crypto.randomUUID(),
            delta: `❌ OpenCode Error: ${errorMessage}`,
        })
        emit({ type: 'finish' })
        safeComplete()
    }
}
