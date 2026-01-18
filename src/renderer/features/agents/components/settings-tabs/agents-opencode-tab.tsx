"use client"

import { useState } from "react"
import { trpc } from "../../../../lib/trpc"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Textarea } from "../../../../components/ui/textarea"
import { Label } from "../../../../components/ui/label"
import { toast } from "sonner"
import { CheckIcon, XIcon } from "lucide-react"

import { useAtom } from "jotai"
import { opencodeDisabledProvidersAtom } from "../../atoms"
import { Switch } from "../../../../components/ui/switch"

export function AgentsOpenCodeTab() {
    const [port, setPort] = useState(4096)
    const [isSaving, setIsSaving] = useState(false)
    const [disabledProviders, setDisabledProviders] = useAtom(opencodeDisabledProvidersAtom)
    const [newModel, setNewModel] = useState({ provider: '', name: '', id: '' })
    const [isAddingModel, setIsAddingModel] = useState(false)
    const [importJson, setImportJson] = useState('')
    const [isImporting, setIsImporting] = useState(false)
    const [showImport, setShowImport] = useState(false)

    // Import config mutation
    const importConfigMutation = trpc.opencode.importConfig.useMutation({
        onSuccess: (data) => {
            toast.success(`Imported ${data.count} items successfully`)
            setIsImporting(false)
            setImportJson('')
            setShowImport(false)
            refetchModels()
        },
        onError: (error) => {
            toast.error(`Failed to import config: ${error.message}`)
            setIsImporting(false)
        },
    })

    const handleImport = () => {
        if (!importJson.trim()) return
        setIsImporting(true)
        importConfigMutation.mutate({ configJson: importJson })
    }

    // Add model mutation
    const addModelMutation = trpc.opencode.addModel.useMutation({
        onSuccess: () => {
            toast.success("Model added successfully")
            setIsAddingModel(false)
            setNewModel({ provider: '', name: '', id: '' })
            refetchModels()
        },
        onError: (error) => {
            toast.error(`Failed to add model: ${error.message}`)
            setIsAddingModel(false)
        },
    })

    const handleAckAddModel = () => {
        setIsAddingModel(true)
        addModelMutation.mutate({
            provider: newModel.provider,
            modelName: newModel.name,
            modelId: newModel.id,
        })
    }

    // Fetch current server URL
    const { data: serverUrl } = trpc.opencode.getServerUrl.useQuery()

    // Fetch health status
    const { data: health, refetch: refetchHealth } = trpc.opencode.getHealth.useQuery()

    // Fetch models count
    const { data: models, refetch: refetchModels } = trpc.opencode.getModels.useQuery()

    // Compute providers and filtered models
    const allModels = models ? Object.values(models) : []
    const providers = Array.from(new Set(allModels.map(m => m.provider))).sort()

    const filteredModels = allModels.filter(m => !disabledProviders.includes(m.provider))
    const modelCount = filteredModels.length

    const handleToggleProvider = (providerName: string) => {
        setDisabledProviders(prev => {
            const newDisabled = [...prev]
            if (newDisabled.includes(providerName)) {
                return newDisabled.filter(p => p !== providerName)
            } else {
                return [...newDisabled, providerName]
            }
        })
    }

    // Set port mutation
    const setPortMutation = trpc.opencode.setPort.useMutation({
        onSuccess: () => {
            toast.success("OpenCode port updated successfully")
            setIsSaving(false)
            // Refetch health to verify connection
            setTimeout(() => {
                refetchHealth()
                refetchModels()
            }, 500)
        },
        onError: (error) => {
            toast.error(`Failed to update port: ${error.message}`)
            setIsSaving(false)
        },
    })

    const handleSavePort = () => {
        if (port < 1 || port > 65535) {
            toast.error("Port must be between 1 and 65535")
            return
        }
        setIsSaving(true)
        setPortMutation.mutate({ port })
    }

    const handleTestConnection = () => {
        refetchHealth()
        refetchModels()
        toast.info("Testing connection...")
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h3 className="text-lg font-semibold">OpenCode Integration</h3>
                <p className="text-sm text-muted-foreground">
                    Configure your OpenCode server connection
                </p>
            </div>

            {/* Connection Status */}
            <div className="space-y-3 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection Status</span>
                    <div className="flex items-center gap-2">
                        {health?.healthy ? (
                            <>
                                <CheckIcon className="h-4 w-4 text-green-500" />
                                <span className="text-sm text-green-500">Connected</span>
                            </>
                        ) : (
                            <>
                                <XIcon className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-red-500">Disconnected</span>
                            </>
                        )}
                    </div>
                </div>

                {health?.version && (
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Version</span>
                        <span className="font-mono">{health.version}</span>
                    </div>
                )}

                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Server URL</span>
                    <span className="font-mono text-xs">{serverUrl || 'http://localhost:4096'}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Available Models</span>
                    <span className="font-medium">{modelCount} {disabledProviders.length > 0 && `(filtered from ${allModels.length})`}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    <></> Models are loaded from your local configuration (~/.config/opencode/providers.json) or the OpenCode API.
                </p>
            </div>

            {/* Port Configuration */}
            <div className="space-y-3">
                <Label htmlFor="opencode-port">Server Port</Label>
                <div className="flex gap-2">
                    <Input
                        id="opencode-port"
                        type="number"
                        min="1"
                        max="65535"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        placeholder="4096"
                        className="flex-1"
                    />
                    <Button
                        onClick={handleSavePort}
                        disabled={isSaving}
                        size="sm"
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            {/* Add Custom Model */}
            <div className="space-y-3 pt-4 border-t border-border">
                <div className="space-y-1">
                    <h4 className="text-sm font-medium">Add Custom Model</h4>
                    <p className="text-xs text-muted-foreground">
                        Add a model to your local configuration (~/.config/opencode/providers.json).
                    </p>
                </div>

                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="provider-name" className="text-xs">Provider Name</Label>
                            <Input
                                id="provider-name"
                                placeholder="e.g. OpenAI"
                                value={newModel.provider}
                                onChange={e => setNewModel(prev => ({ ...prev, provider: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="model-name" className="text-xs">Model Display Name</Label>
                            <Input
                                id="model-name"
                                placeholder="e.g. GPT-4 Custom"
                                value={newModel.name}
                                onChange={e => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="model-id" className="text-xs">Model ID</Label>
                        <div className="flex gap-2">
                            <Input
                                id="model-id"
                                placeholder="e.g. gpt-4-1106-preview"
                                value={newModel.id}
                                onChange={e => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                                className="flex-1"
                            />
                            <Button
                                onClick={handleAckAddModel}
                                disabled={isAddingModel || !newModel.provider || !newModel.id || !newModel.name}
                            >
                                {isAddingModel ? "Adding..." : "Add Model"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Import JSON */}
            <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium">Import Models JSON</h4>
                        <p className="text-xs text-muted-foreground">
                            Bulk import models from a JSON configuration.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowImport(!showImport)}
                    >
                        {showImport ? "Hide" : "Import"}
                    </Button>
                </div>

                {showImport && (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
                        <div className="space-y-1.5">
                            <Label htmlFor="import-json" className="text-xs">JSON Config</Label>
                            <Textarea
                                id="import-json"
                                placeholder='{ "openai": { "models": { "gpt-4-custom": { "name": "Custom GPT-4" } } } }'
                                value={importJson}
                                onChange={e => setImportJson(e.target.value)}
                                className="font-mono text-xs h-32"
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                onClick={handleImport}
                                disabled={isImporting || !importJson.trim()}
                            >
                                {isImporting ? "Importing..." : "Import Config"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Default: 4096. Change this if your OpenCode server runs on a different port.
            </p>



            {/* Enabled Providers */}
            {
                health?.healthy && models && providers.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium">Enabled Providers</h4>
                        <div className="space-y-2 p-3 rounded-lg border bg-card">
                            {providers.map((provider) => (
                                <div key={provider} className="flex items-center justify-between">
                                    <span className="text-sm">{provider}</span>
                                    <Switch
                                        checked={!disabledProviders.includes(provider)}
                                        onCheckedChange={() => handleToggleProvider(provider)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Test Connection Button */}
            <div>
                <Button
                    onClick={handleTestConnection}
                    variant="outline"
                    size="sm"
                >
                    Test Connection
                </Button>
            </div>

            {/* Help Text */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
                <h4 className="text-sm font-medium">How to start OpenCode server:</h4>
                <div className="space-y-1 text-xs text-muted-foreground font-mono">
                    <p>cd opencode/packages/opencode</p>
                    <p>bun run dev</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    The server will start on port 4096 by default. Make sure it's running before using OpenCode features.
                </p>
            </div>

            {/* Models List (filtered) */}
            {
                health?.healthy && filteredModels.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium">Available Models</h4>
                        <div className="max-h-48 overflow-y-auto space-y-1 p-3 rounded-lg border bg-card">
                            {filteredModels.map((model) => (
                                <div
                                    key={model.id}
                                    className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50"
                                >
                                    <span className="font-medium">{model.name}</span>
                                    <span className="text-muted-foreground">{model.provider}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </div >
    )
}
