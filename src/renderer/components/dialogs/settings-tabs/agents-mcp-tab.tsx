"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { useAtomValue } from "jotai"
import { cn } from "../../../lib/utils"
import { sessionInfoAtom, type MCPServer } from "../../../features/agents/atoms"

function getStatusText(status: string) {
  switch (status) {
    case "connected":
      return "Connected"
    case "failed":
      return "Failed"
    case "pending":
      return "Pending"
    case "needs-auth":
      return "Auth"
    default:
      return status
  }
}

function StatusDot({ status }: { status: string }) {
  const colorClass = {
    connected: "bg-green-500",
    failed: "bg-red-500",
    pending: "bg-yellow-500",
    "needs-auth": "bg-orange-500",
  }[status] || "bg-muted-foreground"

  return (
    <div
      className={cn(
        "h-2 w-2 rounded-full flex-shrink-0",
        colorClass,
      )}
    />
  )
}

interface ServerRowProps {
  server: MCPServer
  tools: string[]
  isExpanded: boolean
  onToggle: () => void
}

function ServerRow({ server, tools, isExpanded, onToggle }: ServerRowProps) {
  const hasTools = tools.length > 0

  return (
    <div>
      <button
        onClick={hasTools ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          hasTools && "hover:bg-muted/50 cursor-pointer",
          !hasTools && "cursor-default",
        )}
      >
        {/* Expand chevron */}
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0",
            isExpanded && "rotate-90",
            !hasTools && "opacity-0",
          )}
        />

        {/* Status dot */}
        <StatusDot status={server.status} />

        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {server.name}
            </span>
            {server.serverInfo?.version && (
              <span className="text-xs text-muted-foreground">
                v{server.serverInfo.version}
              </span>
            )}
          </div>
          {server.error && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {server.error}
            </p>
          )}
        </div>

        {/* Status / tool count */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {server.status === "connected" && hasTools
            ? `${tools.length} tool${tools.length !== 1 ? "s" : ""}`
            : getStatusText(server.status)}
        </span>
      </button>

      {/* Expanded tools list */}
      <AnimatePresence>
        {isExpanded && hasTools && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-10 pr-3 pb-3 space-y-1">
              {tools.map((tool) => (
                <div
                  key={tool}
                  className="text-xs text-muted-foreground font-mono py-0.5"
                >
                  {tool}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AgentsMcpTab() {
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  const sessionInfo = useAtomValue(sessionInfoAtom)
  const mcpServers = sessionInfo?.mcpServers || []
  const tools = sessionInfo?.tools || []

  // Group tools by server
  const toolsByServer = new Map<string, string[]>()
  tools.forEach((tool) => {
    const serverName = tool.split("__")[0] || "unknown"
    if (!toolsByServer.has(serverName)) {
      toolsByServer.set(serverName, [])
    }
    toolsByServer.get(serverName)!.push(tool)
  })

  return (
    <div className="p-4">
      <div className="text-sm text-muted-foreground mb-4">
        MCP servers are configured in <code className="bg-muted px-1.5 py-0.5 rounded">~/.claude.json</code>
      </div>

      <div className="space-y-1">
        {mcpServers.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No MCP servers configured
          </div>
        ) : (
          mcpServers.map((server) => (
            <ServerRow
              key={server.name}
              server={server}
              tools={toolsByServer.get(server.name) || []}
              isExpanded={expandedServer === server.name}
              onToggle={() =>
                setExpandedServer((prev) =>
                  prev === server.name ? null : server.name
                )
              }
            />
          ))
        )}
      </div>
    </div>
  )
}
