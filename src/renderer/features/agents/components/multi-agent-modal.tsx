"use client"

import { useState } from "react"
import { X, Plus, Trash2, Users } from "lucide-react"
import { Button } from "../../../components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../../../components/ui/dialog"
import { cn } from "../../../lib/utils"

interface AgentConfig {
    id: string
    prompt: string
    model: string
}

interface MultiAgentModalProps {
    isOpen: boolean
    onClose: () => void
    onRun: (agents: AgentConfig[]) => void
    defaultPrompt?: string
    availableModels: Array<{ id: string; name: string }>
}

export function MultiAgentModal({
    isOpen,
    onClose,
    onRun,
    defaultPrompt = "",
    availableModels,
}: MultiAgentModalProps) {
    const [agents, setAgents] = useState<AgentConfig[]>([
        { id: "1", prompt: defaultPrompt, model: availableModels[0]?.id || "" },
    ])

    const addAgent = () => {
        if (agents.length < 5) {
            setAgents([
                ...agents,
                {
                    id: Date.now().toString(),
                    prompt: defaultPrompt,
                    model: availableModels[0]?.id || "",
                },
            ])
        }
    }

    const removeAgent = (id: string) => {
        if (agents.length > 1) {
            setAgents(agents.filter((a) => a.id !== id))
        }
    }

    const updateAgent = (id: string, field: "prompt" | "model", value: string) => {
        setAgents(
            agents.map((a) => (a.id === id ? { ...a, [field]: value } : a))
        )
    }

    const handleRun = () => {
        onRun(agents)
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-300">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 animate-pulse-subtle">
                                <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Multi-Agent Run</h2>
                                <p className="text-xs text-muted-foreground">Configure up to 5 agents to run simultaneously</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 hover:scale-110"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {agents.map((agent, index) => (
                        <div
                            key={agent.id}
                            className={cn(
                                "p-4 border border-border rounded-lg bg-gradient-to-br from-muted/30 to-muted/10",
                                "transform transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
                                "animate-in slide-in-from-top-4 fade-in-0"
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                        {index + 1}
                                    </div>
                                    <h3 className="text-sm font-semibold">
                                        Agent {index + 1}
                                    </h3>
                                </div>
                                {agents.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeAgent(agent.id)}
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 hover:scale-110 hover:rotate-90"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Model selector */}
                            <div className="mb-3">
                                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                                    Model
                                </label>
                                <select
                                    value={agent.model}
                                    onChange={(e) =>
                                        updateAgent(agent.id, "model", e.target.value)
                                    }
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 hover:border-primary/50"
                                >
                                    {availableModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Prompt textarea */}
                            <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                                    Prompt
                                </label>
                                <textarea
                                    value={agent.prompt}
                                    onChange={(e) =>
                                        updateAgent(agent.id, "prompt", e.target.value)
                                    }
                                    placeholder="Enter prompt for this agent..."
                                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-h-[100px] resize-y hover:border-primary/50"
                                />
                            </div>
                        </div>
                    ))}

                    {/* Add agent button */}
                    {agents.length < 5 && (
                        <Button
                            variant="outline"
                            onClick={addAgent}
                            className="w-full group hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 hover:scale-[1.02] animate-in fade-in-0 slide-in-from-bottom-2"
                        >
                            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                            Add Agent ({agents.length}/5)
                        </Button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                        {agents.length} agent{agents.length > 1 ? "s" : ""} configured
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="hover:bg-muted transition-all duration-200 hover:scale-105"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRun}
                            disabled={agents.some((a) => !a.prompt.trim())}
                            className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Run {agents.length} Agent{agents.length > 1 ? "s" : ""}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
