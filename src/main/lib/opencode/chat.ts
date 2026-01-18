import crypto from 'crypto'
import { getDatabase, subChats, chats } from '../db'
import { eq } from 'drizzle-orm'
import { sessionManager } from './session-manager'

export interface OpenCodeStreamingInput {
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
    emitError: (error: unknown, context: string) => void
    safeComplete: () => void
    abortController: AbortController
    existingMessages: any[]
    askUser?: (toolUseId: string, questions: any[]) => Promise<{ approved: boolean, answers?: Record<string, string>, message?: string }>
}

export type OpenCodeChatOptions = OpenCodeStreamingInput

// Helper to detect language from file path for syntax highlighting
function getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescript',
        'js': 'javascript',
        'jsx': 'javascript',
        'py': 'python',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'md': 'markdown',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'xml': 'xml',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'sql': 'sql',
        'sh': 'bash',
        'bash': 'bash',
    }
    return languageMap[ext || ''] || 'plaintext'
}


export async function runOpenCodeChat({
    input,
    emit,
    emitError,
    safeComplete,
    abortController,
    existingMessages,
    askUser,
}: OpenCodeStreamingInput) {
    const db = getDatabase()

    try {
        const apiUrl = process.env.OPENCODE_SERVER_URL || 'http://localhost:4098'
        console.log('[OpenCode] Starting chat')

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

        let sessionId = input.sessionId
        if (!sessionId) {
            const sessionResponse = await fetch(`${apiUrl}/session`, {
                method: 'POST',
                headers: createAuthHeaders({ 'Content-Type': 'application/json', 'x-opencode-directory': input.cwd }),
                body: JSON.stringify({ title: input.chatId || 'Chat Session' }),
                signal: abortController.signal,
            })

            if (!sessionResponse.ok) {
                throw new Error(`Failed to create session: ${sessionResponse.status}`)
            }

            const sessionData = await sessionResponse.json()
            sessionId = sessionData.id
            console.log('[OpenCode] Created session:', sessionId)

            // Save sessionId to database immediately so it can be reused
            db.update(subChats)
                .set({ sessionId, updatedAt: new Date() })
                .where(eq(subChats.id, input.subChatId))
                .run()
        } else {
            console.log('[OpenCode] Reusing existing session:', sessionId)
        }

        // Register session with manager (will cancel any old session for this subchat)
        if (sessionId) {
            sessionManager.registerSession(input.subChatId, sessionId, abortController)
        }

        // Save original user prompt (without system reminder) to database for display
        const messagesToSave = [
            ...existingMessages,
            { id: `msg-${Date.now()}`, role: 'user', parts: [{ type: 'text', text: input.prompt }] },
        ]

        db.update(subChats)
            .set({ messages: JSON.stringify(messagesToSave), updatedAt: new Date() })
            .where(eq(subChats.id, input.subChatId))
            .run()

        // Prepend system prompt to the prompt sent to OpenCode (agent context only, not visible to user)
        // Add PowerShell instruction: try PowerShell first, then bash if it doesn't work
        const powershellInstruction = "IMPORTANT: When executing terminal commands, use PowerShell commands first. If PowerShell commands don't work or are not available, then try bash commands as a fallback."
        const combinedSystemPrompt = input.systemPrompt
            ? `${powershellInstruction}\n\n${input.systemPrompt}`
            : powershellInstruction

        // Send user message separately (not combined with system prompt)
        const parts: any[] = [{ type: 'text', text: input.prompt }]

        if (input.images && input.images.length > 0) {
            for (const img of input.images) {
                parts.push({ type: 'image', mime: img.mediaType, data: img.base64Data })
            }
        }

        let providerID = 'opencode'
        let modelID = input.model || 'glm-4.7-free'

        if (modelID.includes('/')) {
            [providerID, modelID] = modelID.split('/', 2)
        }

        const requestBody: any = {
            parts,
            systemPrompt: combinedSystemPrompt  // Send system prompt separately
        }
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

        if (input.model) requestBody.model = { providerID, modelID }

        const messageHeaders = createAuthHeaders({
            'Content-Type': 'application/json',
            'x-opencode-directory': input.cwd,
        })

        console.log('[OpenCode] Sending prompt_async to session:', sessionId)
        const promptResponse = await fetch(`${apiUrl}/session/${sessionId}/prompt_async`, {
            method: 'POST',
            headers: messageHeaders,
            body: JSON.stringify(requestBody),
            signal: abortController.signal,
        })

        if (!promptResponse.ok) {
            const errorText = await promptResponse.text()
            emit({ type: 'text-delta', id: crypto.randomUUID(), delta: `❌ OpenCode Error: ${promptResponse.status}\n\n${errorText}` })
            emit({ type: 'finish' })
            safeComplete()
            return
        }

        console.log('[OpenCode] Subscribing to event stream...')
        const eventResponse = await fetch(`${apiUrl}/global/event`, {
            headers: createAuthHeaders({}),
            signal: abortController.signal, // Cancel event stream when session is aborted
        })

        if (!eventResponse.ok) {
            throw new Error(`Failed to connect to event stream: ${eventResponse.status}`)
        }

        let hasReceivedData = false
        const assistantParts: any[] = []
        const startTime = Date.now()
        let userMessageEchoed = false
        let reasoningId: string | null = null
        let accumulatedReasoning = ''

        // Track pending questions so we can auto-reject them if user sends new message
        let pendingQuestionId: string | null = null

        // Track processed events to prevent duplicates from OpenCode server spam
        const processedEvents = new Set<string>()

        // Track cumulative text content from OpenCode (they send full text each time, not deltas)
        const lastTextContent = new Map<string, string>()
        
        // Batch events to reduce emit overhead
        let eventBatch: any[] = []
        let lastBatchEmitTime = Date.now()
        const BATCH_INTERVAL_MS = 50 // Emit batched events every 50ms
        
        const flushEventBatch = () => {
            if (eventBatch.length > 0) {
                // Process batch - for now just emit individually but this reduces frequency
                for (const event of eventBatch) {
                    emit(event)
                }
                eventBatch = []
                lastBatchEmitTime = Date.now()
            }
        }
        
        // Set up periodic batch flushing
        const batchFlushInterval = setInterval(flushEventBatch, BATCH_INTERVAL_MS)

        emit({ type: 'start' })
        emit({ type: 'start-step' })

        const reader = eventResponse.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        if (!reader) {
            throw new Error('No response body available')
        }

        // Set up a timeout to detect if OpenCode server is not responding
        let lastEventTime = Date.now()
        const EVENT_TIMEOUT_MS = 30000 // 30 seconds without any events

        const timeoutChecker = setInterval(() => {
            const timeSinceLastEvent = Date.now() - lastEventTime
            if (timeSinceLastEvent > EVENT_TIMEOUT_MS && !hasReceivedData) {
                console.error('[OpenCode] No events received from server after 30 seconds')
                clearInterval(timeoutChecker)

                // Emit error message to user but DON'T complete the stream
                // This allows the user to cancel manually or wait longer
                const errorId = crypto.randomUUID()
                emit({ type: 'text-start', id: errorId })
                emit({
                    type: 'text-delta',
                    id: errorId,
                    delta: `\n\n⚠️ **OpenCode Server Slow Response**\n\n` +
                        `The OpenCode server hasn't sent any events for 30 seconds. This could mean:\n\n` +
                        `1. The server is processing a complex request\n2. Network connectivity issues\n3. Server overload\n\n` +
                        `You can:\n- Wait longer for a response\n- Cancel and try again\n- Check your network connection`,
                })
                emit({ type: 'text-end', id: errorId })

                // DON'T cancel the reader or complete - let it keep waiting
                // User can manually stop if needed
            }
        }, 5000) // Check every 5 seconds


        try {
            while (true) {
                const { done, value } = await reader.read()

                if (done) {
                    console.log('[OpenCode] Stream ended')
                    break
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data:')) continue

                    try {
                        const jsonStr = line.substring(5).trim()
                        const event = JSON.parse(jsonStr)

                        // OpenCode structure: { payload: { type: "...", properties: {...} } }
                        const eventType = event.payload?.type
                        const props = event.payload?.properties || {}
                        const eventSessionID = props.sessionID || props.part?.sessionID || props.info?.sessionID || (eventType === 'question.asked' ? props.sessionID : undefined)

                        // Filter by session - skip events from other sessions silently
                        if (eventSessionID && eventSessionID !== sessionId) {
                            continue
                        }

                        // Only log events for OUR session (after filtering)
                        const importantEvents = ['question.asked', 'session.status', 'session.idle', 'message.error', 'message.part.updated', 'message.updated']
                        if (importantEvents.includes(eventType)) {
                            console.log('[OpenCode] Event:', eventType, 'session:', eventSessionID, 'props:', JSON.stringify(props).substring(0, 200))
                        }

                        // CRITICAL: Deduplicate events to prevent OpenCode server spam
                        // BUT: Don't deduplicate text parts - they contain cumulative updates
                        // Create unique event ID based on event type and relevant properties
                        const isTextPart = props.part?.type === 'text'
                        const eventId = `${eventType}-${props.part?.id || props.info?.id || ''}-${props.part?.callID || ''}`

                        if (!isTextPart && processedEvents.has(eventId)) {
                            // Skip duplicate event silently (don't log to avoid spam)
                            // But allow text parts through since they have cumulative updates
                            continue
                        }

                        if (!isTextPart) {
                            processedEvents.add(eventId)
                        }

                        // Update last event time to reset timeout
                        lastEventTime = Date.now()
                        hasReceivedData = true

                        // Handle question.asked
                        // props matches Request schema: { id, questions, ... }
                        if (eventType === 'question.asked') {
                            const requestID = props.id
                            const questions = props.questions || []
                            console.log('[OpenCode] Question asked:', { requestID, questions })

                            // Use AI to think through the decision instead of simple defaults
                            const autoAnswers: Record<string, string> = {}

                            // Show thinking indicator
                            const thinkingId = crypto.randomUUID()
                            emit({
                                type: 'tool-input-available',
                                toolCallId: thinkingId,
                                toolName: 'Thinking',
                                input: { text: 'Analyzing question options and making informed decision...' }
                            })

                            for (const q of questions) {
                                let decidedAnswer = ''

                                // Check database for previous answer first
                                try {
                                    const { questionPreferences } = await import('../db')
                                    const { eq, and, desc } = await import('drizzle-orm')

                                    const prefs = db.select()
                                        .from(questionPreferences)
                                        .where(
                                            and(
                                                eq(questionPreferences.subChatId, input.subChatId),
                                                eq(questionPreferences.questionText, q.question)
                                            )
                                        )
                                        .orderBy(desc(questionPreferences.lastUsedAt))
                                        .limit(1)
                                        .all()

                                    if (prefs.length > 0) {
                                        decidedAnswer = prefs[0].answerText
                                        console.log(`[OpenCode] Using previous decision for "${q.question}": ${decidedAnswer}`)
                                    }
                                } catch (dbError) {
                                    // Ignore DB errors, will use AI reasoning
                                }

                                // If no previous answer, use AI reasoning to decide
                                if (!decidedAnswer) {
                                    let reasoning = `\n**Question:** ${q.question}\n\n`

                                    // Analyze options if available
                                    if (q.options && q.options.length > 0) {
                                        reasoning += `**Available options:**\n`
                                        for (const option of q.options) {
                                            reasoning += `- ${option}\n`
                                        }
                                        reasoning += `\n**Analysis:**\n`

                                        // For production/shipping context, prefer safe, standard options
                                        // Look for keywords that indicate best practices
                                        const safeKeywords = ['standard', 'recommended', 'default', 'stable', 'production', 'yes', 'proceed', 'continue']
                                        const riskyKeywords = ['experimental', 'beta', 'skip', 'no', 'cancel', 'unsafe']

                                        let bestOption = q.options[0] // Fallback to first option
                                        let bestScore = -1

                                        for (const option of q.options) {
                                            const optionLower = option.toLowerCase()
                                            let score = 0

                                            // Score based on keywords
                                            for (const keyword of safeKeywords) {
                                                if (optionLower.includes(keyword)) score += 2
                                            }
                                            for (const keyword of riskyKeywords) {
                                                if (optionLower.includes(keyword)) score -= 3
                                            }

                                            reasoning += `  • "${option}": `
                                            if (score > 0) {
                                                reasoning += `✓ Recommended for production (score: +${score})\n`
                                            } else if (score < 0) {
                                                reasoning += `⚠ May be risky (score: ${score})\n`
                                            } else {
                                                reasoning += `Neutral option\n`
                                            }

                                            if (score > bestScore) {
                                                bestScore = score
                                                bestOption = option
                                            }
                                        }

                                        decidedAnswer = bestOption
                                        reasoning += `\n**Decision:** Selecting "${decidedAnswer}" as it's most suitable for production deployment.\n`
                                    }
                                    // For yes/no questions
                                    else if (q.question.toLowerCase().includes('?')) {
                                        const questionLower = q.question.toLowerCase()

                                        // Analyze the question context
                                        if (questionLower.includes('proceed') || questionLower.includes('continue') ||
                                            questionLower.includes('confirm') || questionLower.includes('install')) {
                                            decidedAnswer = 'yes'
                                            reasoning += `**Analysis:** Question asks for confirmation to proceed.\n`
                                            reasoning += `**Decision:** Proceeding with "yes" to continue the workflow.\n`
                                        } else if (questionLower.includes('skip') || questionLower.includes('cancel')) {
                                            decidedAnswer = 'no'
                                            reasoning += `**Analysis:** Question asks about skipping or canceling.\n`
                                            reasoning += `**Decision:** Selecting "no" to maintain standard workflow.\n`
                                        } else {
                                            decidedAnswer = 'yes'
                                            reasoning += `**Analysis:** General confirmation question.\n`
                                            reasoning += `**Decision:** Defaulting to "yes" for forward progress.\n`
                                        }
                                    }
                                    // For text input
                                    else {
                                        decidedAnswer = 'auto'
                                        reasoning += `**Analysis:** Open-ended question requiring text input.\n`
                                        reasoning += `**Decision:** Using "auto" to let the system choose optimal defaults.\n`
                                    }

                                    // Update thinking block with reasoning
                                    emit({
                                        type: 'tool-input-available',
                                        toolCallId: thinkingId,
                                        toolName: 'Thinking',
                                        input: { text: reasoning }
                                    })

                                    console.log(`[OpenCode] AI decided for "${q.question}": ${decidedAnswer}`)
                                }

                                autoAnswers[q.question] = decidedAnswer
                            }

                            // Complete thinking block
                            emit({
                                type: 'tool-output-available',
                                toolCallId: thinkingId,
                                output: { completed: true }
                            })

                            // Format answers as plain text
                            const answerTexts = questions.map((q: any) => {
                                const ans = autoAnswers[q.question]
                                if (!ans) return ''
                                return `${q.question}: ${ans}`
                            }).filter(Boolean)

                            const answerMessage = answerTexts.join('\n')

                            // Send auto-answer to OpenCode
                            const replyResponse = await fetch(`${apiUrl}/question/${requestID}/reply`, {
                                method: 'POST',
                                headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
                                body: JSON.stringify({
                                    answers: questions.map((q: any) => {
                                        const ans = autoAnswers[q.question]
                                        if (!ans) return []
                                        if (q.allowMultiple && ans.includes(',')) {
                                            return ans.split(',').map((a: string) => a.trim()).filter(Boolean)
                                        }
                                        return [ans]
                                    }),
                                    message: answerMessage
                                })
                            })

                            if (replyResponse.ok) {
                                console.log('[OpenCode] Auto-decision sent successfully')

                                // Save decisions to database for future reference
                                try {
                                    const { questionPreferences } = await import('../db')
                                    const { createId } = await import('../db/utils')
                                    const { eq, and } = await import('drizzle-orm')

                                    for (const q of questions) {
                                        const answer = autoAnswers[q.question]
                                        if (answer) {
                                            // Check if preference already exists
                                            const existing = db.select()
                                                .from(questionPreferences)
                                                .where(
                                                    and(
                                                        eq(questionPreferences.subChatId, input.subChatId),
                                                        eq(questionPreferences.questionText, q.question)
                                                    )
                                                )
                                                .get()

                                            if (existing) {
                                                // Update existing preference
                                                db.update(questionPreferences)
                                                    .set({
                                                        answerText: answer,
                                                        usedCount: existing.usedCount + 1,
                                                        lastUsedAt: new Date()
                                                    })
                                                    .where(eq(questionPreferences.id, existing.id))
                                                    .run()
                                            } else {
                                                // Insert new preference
                                                db.insert(questionPreferences)
                                                    .values({
                                                        id: createId(),
                                                        subChatId: input.subChatId,
                                                        sessionId: sessionId || null,
                                                        requestId: requestID,
                                                        questionText: q.question,
                                                        questionHeader: q.header || null,
                                                        answerText: answer,
                                                        createdAt: new Date(),
                                                        usedCount: 1,
                                                        lastUsedAt: new Date(),
                                                    })
                                                    .run()
                                            }

                                            console.log(`[OpenCode] Saved decision: ${q.question} = ${answer}`)
                                        }
                                    }
                                } catch (dbError) {
                                    console.error('[OpenCode] Failed to save decisions:', dbError)
                                }

                                // Show the final decision in the UI
                                emit({
                                    type: 'text-delta',
                                    id: crypto.randomUUID(),
                                    delta: `\n\n✓ **Auto-decided:** ${answerMessage}\n\n`
                                })
                            } else {
                                console.error('[OpenCode] Failed to send auto-decision:', replyResponse.status)
                            }

                            // Continue processing events immediately
                            console.log('[OpenCode] Auto-decision complete, stream continues...')
                            continue
                        }

                        // Handle message.part.updated (text, tools, reasoning)
                        if (eventType === 'message.part.updated' && props.part) {
                            const part = props.part

                            // Skip the first user message echo (OpenCode sends back the prompt)
                            if (!userMessageEchoed && part.type === 'text' && part.text === input.prompt) {
                                console.log('[OpenCode] Skipping user message echo')
                                userMessageEchoed = true
                                continue
                            }

                            if (part.type === 'text' && part.text) {
                                // OpenCode sends CUMULATIVE text (full message so far), not delta
                                // We need to track previous text and only emit the NEW part
                                const previousText = lastTextContent.get(part.id) || ''
                                const newText = part.text

                                // Only log significant updates to reduce overhead
                                if (newText.length - previousText.length > 100 || !previousText) {
                                    console.log(`[OpenCode] Text update: prev=${previousText.length} new=${newText.length} partId=${part.id}`)
                                }

                                if (newText.length > previousText.length && newText.startsWith(previousText)) {
                                    // Extract only the new delta
                                    const delta = newText.substring(previousText.length)

                                    if (delta) {
                                        // Only emit if there's actually new content
                                        const textId = part.id || crypto.randomUUID()

                                        // Emit start only if this is the first chunk for this text part
                                        if (!previousText) {
                                            emit({ type: 'text-start', id: textId })
                                        }

                                        emit({ type: 'text-delta', id: textId, delta })

                                        // Update tracking
                                        lastTextContent.set(part.id, newText)

                                        // Update assistant parts (replace existing or add new)
                                        const existingIndex = assistantParts.findIndex(p => p.type === 'text' && p.id === part.id)
                                        if (existingIndex >= 0) {
                                            assistantParts[existingIndex] = { type: 'text', text: newText, id: part.id }
                                        } else {
                                            assistantParts.push({ type: 'text', text: newText, id: part.id })
                                        }
                                    }
                                } else if (newText !== previousText) {
                                    // Text was replaced or is completely different - emit full text
                                    console.log('[OpenCode] Text replaced, emitting full content')
                                    const textId = part.id || crypto.randomUUID()
                                    emit({ type: 'text-start', id: textId })
                                    emit({ type: 'text-delta', id: textId, delta: newText })
                                    emit({ type: 'text-end', id: textId })
                                    lastTextContent.set(part.id, newText)
                                    assistantParts.push({ type: 'text', text: newText, id: part.id })
                                }
                            } else if (part.type === 'tool') {
                                const toolCallId = part.callID || part.id || crypto.randomUUID()
                                const rawToolName = part.tool || 'unknown'

                                // Map OpenCode tool names to UI tool names (PascalCase for Registry lookup)
                                const toolMap: Record<string, string> = {
                                    // User Interaction
                                    'question': 'AskUserQuestion', // Maps OpenCode's "question" tool to UI's "AskUserQuestion"
                                    // File Operations
                                    'write': 'Write',
                                    'write_file': 'Write',
                                    'write_to_file': 'Write',
                                    'force_write_to_file': 'Write',
                                    'edit': 'Edit',
                                    'edit_file': 'Edit',
                                    'replace_file_content': 'Edit',
                                    'multi_replace_file_content': 'Edit',
                                    'read': 'Read',
                                    'read_file': 'Read',
                                    'read_file_content': 'Read',
                                    'list': 'Glob',
                                    'list_files': 'Glob',
                                    'list_dir': 'Glob',
                                    'find_by_name': 'Glob',

                                    // Search
                                    'grep': 'Grep',
                                    'grep_search': 'Grep',

                                    // Terminal
                                    'run_command': 'Bash',
                                    'send_command_input': 'Bash',
                                    'bash': 'Bash',

                                    // Planning & Todos
                                    'todowrite': 'TodoWrite',
                                    'todo': 'TodoWrite',
                                    'create_todo': 'TodoWrite',
                                    'update_todo': 'TodoWrite',
                                    'todoread': 'TodoRead',
                                    'plan_enter': 'PlanWrite',
                                    'plan': 'PlanWrite',
                                    'create_plan': 'PlanWrite',
                                    'update_plan': 'PlanWrite',
                                    'plan_exit': 'ExitPlanMode',
                                    'exit_plan_mode': 'ExitPlanMode',

                                    // Web
                                    'websearch': 'WebSearch',
                                    'web_search': 'WebSearch',
                                    'webfetch': 'WebFetch',
                                    'fetch_url': 'WebFetch',
                                    'task': 'Task',
                                    'browser_subagent': 'Task',

                                    // Browser Preview
                                    'open_browser_preview': 'OpenBrowserPreview',
                                    'browser_preview': 'OpenBrowserPreview',
                                    'preview_browser': 'OpenBrowserPreview',

                                    // Notebook
                                    'notebook_edit': 'NotebookEdit',

                                    // System
                                    'reasoning': 'Thinking',
                                    'skill': 'Skill',
                                    'patch': 'Patch',
                                    'batch': 'Batch',
                                    'codesearch': 'CodeSearch',
                                    'lsp': 'Lsp',
                                    'context_summary': 'ContextSummary'
                                }

                                const mappedToolName = toolMap[rawToolName] || rawToolName

                                // Extract and format tool data for better UI rendering
                                const toolInput = part.state?.input || {}
                                const toolOutput = part.state?.output

                                // Normalize OpenCode's property names to match Claude Code's expected format
                                let enhancedInput = { ...toolInput }

                                // For Read tool - normalize to file_path
                                if (mappedToolName === 'Read') {
                                    enhancedInput = {
                                        ...toolInput,
                                        file_path: toolInput.filePath || toolInput.file_path || toolInput.path,
                                    }
                                }

                                // For Write tool - normalize to file_path and content
                                if (mappedToolName === 'Write') {
                                    enhancedInput = {
                                        ...toolInput,
                                        file_path: toolInput.filePath || toolInput.file_path || toolInput.path,
                                        content: toolInput.content,
                                    }
                                }

                                // For Edit tool - normalize to file_path, old_string, new_string
                                if (mappedToolName === 'Edit') {
                                    enhancedInput = {
                                        ...toolInput,
                                        file_path: toolInput.filePath || toolInput.file_path || toolInput.path,
                                        old_string: toolInput.oldString || toolInput.old_string || toolInput.targetContent,
                                        new_string: toolInput.newString || toolInput.new_string || toolInput.replacementContent,
                                    }
                                }

                                // For OpenBrowserPreview tool - emit special chunk to open browser preview
                                if (mappedToolName === 'OpenBrowserPreview') {
                                    // Support both url and port parameters
                                    let url = toolInput.url || toolInput.url_path
                                    if (!url && toolInput.port) {
                                        // If port is provided, construct URL
                                        url = `http://localhost:${toolInput.port}`
                                    }
                                    if (!url) {
                                        url = 'http://localhost:3000' // Default
                                    }
                                    // Emit special chunk type that UI can handle to open browser preview
                                    emit({ type: 'open-browser-preview', chatId: input.chatId, url })
                                    // Also emit as tool for UI rendering
                                    emit({ type: 'tool-input-available', toolCallId, toolName: mappedToolName, input: enhancedInput })
                                    // Mark as completed immediately (no output needed)
                                    emit({ type: 'tool-output-available', toolCallId, output: { completed: true, url } })
                                } else {
                                    emit({ type: 'tool-input-available', toolCallId, toolName: mappedToolName, input: enhancedInput })
                                }

                                // Auto-detect port from Bash tool outputs
                                if (mappedToolName === 'Bash' && toolOutput) {
                                    const outputText = typeof toolOutput === 'string'
                                        ? toolOutput
                                        : (toolOutput.stdout || toolOutput.output || toolOutput.stderr || '')

                                    // Try to extract port from output (common patterns)
                                    const portPatterns = [
                                        /listening on (?:port )?(\d+)/i,
                                        /started on port (\d+)/i,
                                        /running on (?:http:\/\/localhost:|port )(\d+)/i,
                                        /localhost:(\d+)/i,
                                        /http:\/\/localhost:(\d+)/i,
                                        /:(\d{4,5})/i, // Common port range
                                    ]

                                    for (const pattern of portPatterns) {
                                        const match = outputText.match(pattern)
                                        if (match && match[1]) {
                                            const port = parseInt(match[1], 10)
                                            if (port >= 1000 && port <= 65535) { // Valid port range
                                                const url = `http://localhost:${port}`
                                                console.log(`[OpenCode] Auto-detected port ${port} from bash output, opening browser preview`)
                                                emit({ type: 'open-browser-preview', chatId: input.chatId, url })
                                                break
                                            }
                                        }
                                    }
                                }

                                if (toolOutput) {
                                    // Format output for code blocks
                                    let formattedOutput = toolOutput

                                    // For Read tool, format as code block with file info
                                    if (mappedToolName === 'Read' && typeof toolOutput === 'string') {
                                        const filePath = toolInput.filePath || toolInput.path || 'file'
                                        formattedOutput = {
                                            content: toolOutput,
                                            path: filePath,
                                            language: getLanguageFromPath(filePath),
                                        }
                                    }

                                    emit({ type: 'tool-output-available', toolCallId, output: formattedOutput })
                                }

                                // Store tool in format UI expects: type: "tool-Write", "tool-Edit", etc.
                                const toolPart: any = {
                                    type: `tool-${mappedToolName}`, // e.g., "tool-Write", "tool-Edit"
                                    toolCallId,
                                    input: enhancedInput,
                                    state: toolOutput ? 'output-available' : 'input-available',
                                }

                                if (toolOutput) {
                                    toolPart.output = toolOutput
                                }

                                assistantParts.push(toolPart)
                            }
                            else if (part.type === 'reasoning' && part.text) {
                                // Accumulate reasoning into a single thinking block
                                if (!reasoningId) {
                                    reasoningId = crypto.randomUUID()
                                    emit({ type: 'tool-input-available', toolCallId: reasoningId, toolName: 'Thinking', input: { text: part.text } })
                                    accumulatedReasoning = part.text
                                } else {
                                    // Update existing thinking block with accumulated text
                                    accumulatedReasoning += '\n' + part.text
                                    emit({ type: 'tool-input-available', toolCallId: reasoningId, toolName: 'Thinking', input: { text: accumulatedReasoning } })
                                }
                            }
                        }


                        // Handle message.updated (track assistant messages but don't complete yet)
                        else if (eventType === 'message.updated' && props.info?.role === 'assistant') {
                            console.log('[OpenCode] Assistant message updated')

                            // Check for errors in the message
                            if (props.info?.error) {
                                const error = props.info.error
                                const errorMessage = error.data?.message || error.message || 'Unknown error'
                                console.error('[OpenCode] Message error:', error)

                                // Display error to user
                                const errorId = crypto.randomUUID()
                                emit({ type: 'text-start', id: errorId })
                                emit({
                                    type: 'text-delta',
                                    id: errorId,
                                    delta: `\n\n❌ **OpenCode Error:** ${errorMessage}\n\n` +
                                        `This is likely an API configuration issue. Please check:\n` +
                                        `- Your OpenCode server is running\n` +
                                        `- API keys are configured correctly\n` +
                                        `- The model is available\n\n`
                                })
                                emit({ type: 'text-end', id: errorId })
                            }
                            // Don't complete here - wait for session.status idle
                        }

                        // Handle session.status (completion and errors)
                        else if (eventType === 'session.status' && props.status) {
                            const status = props.status

                            if (status.type === 'idle') {
                                // Session is idle - this means the response is complete
                                console.log('[OpenCode] Session idle - completing')

                                // Close any open text parts
                                for (const [textId, _] of lastTextContent) {
                                    emit({ type: 'text-end', id: textId })
                                }
                                lastTextContent.clear()

                                // Complete thinking block if it exists
                                if (reasoningId) {
                                    emit({ type: 'tool-output-available', toolCallId: reasoningId, output: { completed: true } })
                                }

                                const endTime = Date.now()
                                emit({ type: 'message-metadata', metadata: { sessionId, model: input.model || 'gpt-4o', provider: 'opencode', duration: endTime - startTime, tokenUsage: {}, cost: 0 } })

                                // Trigger diff refresh so changes show up immediately
                                emit({ type: 'refresh-diff' })

                                // Only save assistant message if we have content
                                // (errors are already displayed above, no need to save empty message)
                                if (assistantParts.length > 0) {
                                    const finalMessages = [...messagesToSave, { id: `msg-${Date.now()}`, role: 'assistant', parts: assistantParts }]
                                    db.update(subChats).set({ messages: JSON.stringify(finalMessages), sessionId, updatedAt: new Date() }).where(eq(subChats.id, input.subChatId)).run()

                                    // Track file changes from messages
                                    try {
                                        const { trackFileChangesFromMessages } = await import('../db/file-changes-tracker')
                                        await trackFileChangesFromMessages(input.chatId, input.subChatId, finalMessages, sessionId)
                                    } catch (error) {
                                        console.error('[OpenCode] Error tracking file changes:', error)
                                    }
                                } else {
                                    // No response received from the model - show error
                                    console.warn('[OpenCode] Session completed but no assistant response received')
                                    const errorId = crypto.randomUUID()
                                    emit({ type: 'text-start', id: errorId })
                                    emit({
                                        type: 'text-delta',
                                        id: errorId,
                                        delta: `\n\n⚠️ **No response from ${input.model || 'GLM-4.7'}**\n\n` +
                                            `The model received your message but did not generate a response. This could be due to:\n\n` +
                                            `1. **Model Configuration** - The model may not be properly configured in OpenCode\n` +
                                            `2. **API Credentials** - Missing or invalid API keys for this model\n` +
                                            `3. **Model Availability** - The model may be unavailable or overloaded\n` +
                                            `4. **Request Format** - The request may not be compatible with this model\n\n` +
                                            `**Suggestions:**\n` +
                                            `- Check OpenCode server logs for errors\n` +
                                            `- Verify API keys in OpenCode settings\n` +
                                            `- Try a different model (e.g., GPT-4)\n` +
                                            `- Check the OpenCode providers.json configuration\n\n`
                                    })
                                    emit({ type: 'text-end', id: errorId })

                                    // Just update session ID and timestamp
                                    db.update(subChats).set({ sessionId, updatedAt: new Date() }).where(eq(subChats.id, input.subChatId)).run()
                                }
                                db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, input.chatId)).run()

                                flushEventBatch() // Flush any remaining batched events
                                clearInterval(timeoutChecker) // Clean up timeout checker
                                clearInterval(batchFlushInterval) // Clean up batch flush interval
                                sessionManager.unregisterSession(input.subChatId) // Clean up session
                                emit({ type: 'finish-step' })
                                emit({ type: 'finish' })
                                reader.cancel()
                                safeComplete()
                                return
                            }
                            else if (status.type === 'error') {
                                emit({ type: 'text-delta', id: crypto.randomUUID(), delta: `⚠️ ${status.message || 'OpenCode error'}` })
                            }
                            else if (status.type === 'retry') {
                                console.log('[OpenCode] Retrying:', status.message)
                            }
                        }
                    } catch (error) {
                        console.error('[OpenCode] Parse error:', error)
                    }
                }
            }

            if (!hasReceivedData) {
                emit({ type: 'text-delta', id: crypto.randomUUID(), delta: '❌ No response from OpenCode' })
            }
            flushEventBatch() // Flush any remaining batched events
            clearInterval(timeoutChecker) // Clean up timeout checker
            clearInterval(batchFlushInterval) // Clean up batch flush interval
            sessionManager.unregisterSession(input.subChatId) // Clean up session
            emit({ type: 'finish' })
            safeComplete()

        } catch (streamError) {
            console.error('[OpenCode] Stream error:', streamError)

            // Check if this is an intentional abort (user cancelled or cleanup)
            const isAbortError = streamError instanceof Error &&
                (streamError.name === 'AbortError' || streamError.message?.includes('aborted'))

            // Cancel any pending questions when stream is aborted
            if (pendingQuestionId) {
                console.log('[OpenCode] Cancelling pending question due to abort:', pendingQuestionId)
                try {
                    await fetch(`${apiUrl}/question/${pendingQuestionId}/reply`, {
                        method: 'POST',
                        headers: createAuthHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            answers: [],
                            message: 'Cancelled by user'
                        })
                    }).catch(err => console.warn('[OpenCode] Failed to cancel question:', err))
                } catch (cancelError) {
                    console.warn('[OpenCode] Error cancelling question:', cancelError)
                }
                pendingQuestionId = null
            }

            // Only show error message if this is NOT an intentional abort
            if (!isAbortError && !hasReceivedData) {
                emit({ type: 'text-delta', id: crypto.randomUUID(), delta: '❌ OpenCode streaming failed' })
            }

            flushEventBatch() // Flush any remaining batched events
            clearInterval(timeoutChecker) // Clean up timeout checker
            clearInterval(batchFlushInterval) // Clean up batch flush interval
            sessionManager.unregisterSession(input.subChatId) // Clean up session
            emit({ type: 'finish' })
            safeComplete()
        }

    } catch (error) {
        console.error('[OpenCode] Error:', error)
        emit({ type: 'text-delta', id: crypto.randomUUID(), delta: `❌ ${error instanceof Error ? error.message : String(error)}` })
        emit({ type: 'finish' })
        safeComplete()
    }
}
