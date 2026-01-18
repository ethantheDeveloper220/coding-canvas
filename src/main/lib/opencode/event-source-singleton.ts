// Singleton global event stream connection for OpenCode
// This is shared across all chats to avoid multiple connections to /global/event

type SessionHandler = (eventData: any) => Promise<void>

let globalStreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null
let globalStreamUrl: string | null = null
let isReading = false
const sessionHandlers = new Map<string, SessionHandler>()

// Initialize or get the global stream reader
export async function getGlobalStreamReader(apiUrl: string, createAuthHeaders: (headers?: Record<string, string>) => Record<string, string>): Promise<void> {
    const eventUrl = `${apiUrl}/global/event`

    // If we already have a reader for this URL and it's reading, return
    if (globalStreamReader && globalStreamUrl === eventUrl && isReading) {
        return
    }

    // Close old reader if URL changed
    if (globalStreamReader) {
        console.log('[OpenCode] Closing old global stream')
        try {
            await globalStreamReader.cancel()
        } catch (e) {
            // Ignore errors on cancel
        }
        globalStreamReader = null
    }

    // Create new global stream
    console.log('[OpenCode] Creating new global stream:', eventUrl)
    const eventResponse = await fetch(eventUrl, {
        headers: createAuthHeaders({}),
    })

    if (!eventResponse.ok) {
        throw new Error(`Failed to connect to event stream: ${eventResponse.status}`)
    }

    globalStreamReader = eventResponse.body?.getReader() || null
    globalStreamUrl = eventUrl

    if (!globalStreamReader) {
        throw new Error('No response body available')
    }

    // Start reading the stream
    isReading = true
    readStream()
}

async function readStream() {
    if (!globalStreamReader) return

    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (isReading) {
            const { done, value } = await globalStreamReader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (!line.trim() || !line.startsWith('data:')) continue

                try {
                    const eventData = JSON.parse(line.substring(5).trim())

                    // Broadcast to all session handlers
                    for (const handler of sessionHandlers.values()) {
                        // Call handler without awaiting to avoid blocking
                        handler(eventData).catch(err =>
                            console.error('[OpenCode] Handler error:', err)
                        )
                    }
                } catch (error) {
                    console.error('[OpenCode] Parse error:', error)
                }
            }
        }
    } catch (error) {
        console.error('[OpenCode] Stream error:', error)
        isReading = false
    }
}

// Register a session-specific handler
export function registerSessionHandler(sessionId: string, handler: SessionHandler): void {
    sessionHandlers.set(sessionId, handler)
    console.log('[OpenCode] Registered session handler for:', sessionId)
}

// Unregister a session-specific handler
export function unregisterSessionHandler(sessionId: string): void {
    sessionHandlers.delete(sessionId)
    console.log('[OpenCode] Removed session handler for:', sessionId)
}

// Stop the global stream
export async function stopGlobalStream(): Promise<void> {
    isReading = false
    if (globalStreamReader) {
        try {
            await globalStreamReader.cancel()
        } catch (e) {
            // Ignore errors
        }
        globalStreamReader = null
        globalStreamUrl = null
    }
}
