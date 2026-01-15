import { useState } from "react"
import { Plus, X, Users } from "lucide-react"
import { cn } from "../../../lib/utils"

interface AgentPrompt {
    id: string
    model: string
    prompt: string
}

interface MultiAgentPromptsProps {
    maxAgents: number // Based on user tier: 1, 5, or Infinity
    onSend: (prompts: AgentPrompt[]) => void
    availableModels: Array<{ id: string; name: string }>
    onOpenAgentManager: () => void
}

export function MultiAgentPrompts({
    maxAgents,
    onSend,
    availableModels,
    onOpenAgentManager,
}: MultiAgentPromptsProps) {
    const [agents, setAgents] = useState<AgentPrompt[]>([
        { id: "1", model: availableModels[0]?.id || "", prompt: "" },
    ])

    const canAddMore = agents.length < maxAgents

    const handleAddAgent = () => {
        if (!canAddMore) return
        setAgents([
            ...agents,
            {
                id: Date.now().toString(),
                model: availableModels[0]?.id || "",
                prompt: "",
            },
        ])
    }

    const handleRemoveAgent = (id: string) => {
        if (agents.length === 1) return // Keep at least one
        setAgents(agents.filter((a) => a.id !== id))
    }

    const handleModelChange = (id: string, modelId: string) => {
        setAgents(agents.map((a) => (a.id === id ? { ...a, model: modelId } : a)))
    }

    const handlePromptChange = (id: string, prompt: string) => {
        setAgents(agents.map((a) => (a.id === id ? { ...a, prompt } : a)))
    }

    const handleSend = () => {
        const validPrompts = agents.filter((a) => a.prompt.trim())
        if (validPrompts.length > 0) {
            onSend(validPrompts)
            // Reset to single empty prompt
            setAgents([{ id: Date.now().toString(), model: availableModels[0]?.id || "", prompt: "" }])
        }
    }

    const hasAnyContent = agents.some((a) => a.prompt.trim())

    return (
        <div className="space-y-2">
            {/* Header with Agent Manager button */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                        {agents.length} / {maxAgents === Infinity ? "∞" : maxAgents} agent{agents.length !== 1 ? "s" : ""}
                    </span>
                </div>
                <button
                    onClick={onOpenAgentManager}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                    <Users className="w-3.5 h-3.5" />
                    Manage Agents
                </button>
            </div>

            {/* Agent Prompts */}
            <div className="space-y-2">
                {agents.map((agent, index) => (
                    <div
                        key={agent.id}
                        className="p-3 rounded-lg border border-border bg-card space-y-2"
                    >
                        {/* Header: Model selector and remove button */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Agent {index + 1}
                                </span>
                                <select
                                    value={agent.model}
                                    onChange={(e) => handleModelChange(agent.id, e.target.value)}
                                    className="h-6 px-2 text-xs rounded border border-border bg-background hover:bg-muted/50 transition-colors"
                                >
                                    {availableModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {agents.length > 1 && (
                                <button
                                    onClick={() => handleRemoveAgent(agent.id)}
                                    className="h-6 w-6 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Prompt input */}
                        <textarea
                            value={agent.prompt}
                            onChange={(e) => handlePromptChange(agent.id, e.target.value)}
                            placeholder={`Enter prompt for Agent ${index + 1}...`}
                            className="w-full min-h-[60px] px-3 py-2 text-sm rounded border border-border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                    handleSend()
                                }
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={handleAddAgent}
                    disabled={!canAddMore}
                    className={cn(
                        "h-7 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                        canAddMore
                            ? "border border-border hover:bg-muted/50 text-foreground"
                            : "border border-border text-muted-foreground cursor-not-allowed opacity-50"
                    )}
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Agent
                </button>

                <button
                    onClick={handleSend}
                    disabled={!hasAnyContent}
                    className={cn(
                        "h-7 px-4 rounded-lg text-xs font-medium transition-colors",
                        hasAnyContent
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                >
                    Run {agents.filter((a) => a.prompt.trim()).length} Agent{agents.filter((a) => a.prompt.trim()).length !== 1 ? "s" : ""}
                </button>
            </div>

            {!canAddMore && maxAgents !== Infinity && (
                <p className="text-xs text-muted-foreground text-center">
                    Agent limit reached.{" "}
                    <button
                        onClick={() => { window.location.hash = "#/pricing" }}
                        className="text-primary hover:underline"
                    >
                        Upgrade
                    </button>{" "}
                    for more agents.
                </p>
            )}
        </div>
    )
}
