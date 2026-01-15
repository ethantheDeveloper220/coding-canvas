import { useState } from "react"
import { Users, Plus, Trash2, Crown, Zap, Sparkles } from "lucide-react"
import { cn } from "../../../../lib/utils"

// Mock user tier - replace with actual user data from your auth system
type UserTier = "free" | "pro" | "max"

interface Agent {
    id: string
    name: string
    status: "active" | "idle"
    createdAt: Date
}

const TIER_LIMITS = {
    free: 1,
    pro: 5,
    max: Infinity,
}

const TIER_INFO = {
    free: {
        name: "Free",
        icon: Sparkles,
        color: "text-slate-500",
        bgColor: "bg-slate-500/10",
    },
    pro: {
        name: "Pro",
        icon: Zap,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    max: {
        name: "Max",
        icon: Crown,
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
}

export function AgentsManagerTab() {
    // Mock data - replace with actual data from your state management
    const [userTier] = useState<UserTier>("free")
    const [agents, setAgents] = useState<Agent[]>([
        {
            id: "1",
            name: "Main Agent",
            status: "active",
            createdAt: new Date(),
        },
    ])

    const tierLimit = TIER_LIMITS[userTier]
    const tierInfo = TIER_INFO[userTier]
    const TierIcon = tierInfo.icon
    const canAddMore = agents.length < tierLimit

    const handleAddAgent = () => {
        if (!canAddMore) return

        const newAgent: Agent = {
            id: Date.now().toString(),
            name: `Agent ${agents.length + 1}`,
            status: "idle",
            createdAt: new Date(),
        }
        setAgents([...agents, newAgent])
    }

    const handleRemoveAgent = (id: string) => {
        setAgents(agents.filter((agent) => agent.id !== id))
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold">Agent Manager</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Manage your active AI agents
                        </p>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", tierInfo.bgColor)}>
                        <TierIcon className={cn("w-4 h-4", tierInfo.color)} />
                        <span className={cn("text-sm font-medium", tierInfo.color)}>
                            {tierInfo.name}
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-6">
                    {/* Usage Stats */}
                    <div className="p-4 rounded-lg border border-border bg-card">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium">Active Agents</span>
                            <span className="text-sm text-muted-foreground">
                                {agents.length} / {tierLimit === Infinity ? "∞" : tierLimit}
                            </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                                className={cn(
                                    "h-full transition-all duration-300",
                                    agents.length >= tierLimit ? "bg-destructive" : "bg-primary"
                                )}
                                style={{
                                    width: tierLimit === Infinity ? "100%" : `${(agents.length / tierLimit) * 100}%`,
                                }}
                            />
                        </div>
                        {!canAddMore && tierLimit !== Infinity && (
                            <p className="text-xs text-destructive mt-2">
                                Agent limit reached. Upgrade to add more agents.
                            </p>
                        )}
                    </div>

                    {/* Agents List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">Your Agents</h4>
                            <button
                                onClick={handleAddAgent}
                                disabled={!canAddMore}
                                className={cn(
                                    "h-7 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                                    canAddMore
                                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Agent
                            </button>
                        </div>

                        {agents.length === 0 ? (
                            <div className="p-8 text-center border border-dashed border-border rounded-lg">
                                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No agents yet</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Click "Add Agent" to create your first agent
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {agents.map((agent) => (
                                    <div
                                        key={agent.id}
                                        className="p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Users className="w-4 h-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{agent.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {agent.status === "active" ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                                Idle
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveAgent(agent.id)}
                                                className="h-7 w-7 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Upgrade CTA */}
                    {userTier !== "max" && (
                        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {userTier === "free" ? (
                                        <Zap className="w-4 h-4 text-primary" />
                                    ) : (
                                        <Crown className="w-4 h-4 text-primary" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h5 className="text-sm font-medium mb-1">
                                        {userTier === "free" ? "Upgrade to Pro" : "Upgrade to Max"}
                                    </h5>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {userTier === "free"
                                            ? "Get up to 5 agents and unlock advanced features"
                                            : "Get unlimited agents and premium support"}
                                    </p>
                                    <button
                                        onClick={() => {
                                            window.location.hash = "#/pricing"
                                        }}
                                        className="h-7 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                                    >
                                        View Plans
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tier Comparison */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Plan Comparison</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {(["free", "pro", "max"] as UserTier[]).map((tier) => {
                                const info = TIER_INFO[tier]
                                const Icon = info.icon
                                const limit = TIER_LIMITS[tier]
                                const isCurrent = tier === userTier

                                return (
                                    <div
                                        key={tier}
                                        className={cn(
                                            "p-3 rounded-lg border text-center",
                                            isCurrent
                                                ? "border-primary bg-primary/5"
                                                : "border-border bg-card"
                                        )}
                                    >
                                        <Icon className={cn("w-4 h-4 mx-auto mb-2", info.color)} />
                                        <p className="text-xs font-medium mb-1">{info.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {limit === Infinity ? "Unlimited" : `${limit} agent${limit > 1 ? "s" : ""}`}
                                        </p>
                                        {isCurrent && (
                                            <div className="mt-2">
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                                    Current
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
