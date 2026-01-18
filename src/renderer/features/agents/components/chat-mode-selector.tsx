"use client"

import { useState, useEffect } from "react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "../../../components/ui/dropdown-menu"
import { AgentIcon, PlanIcon } from "../../../components/ui/icons"
import { Zap, Palette, Bug, Code, FileText, Settings, Plus } from "lucide-react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../../lib/utils"
import { CustomModeModal } from "./custom-mode-modal"
import { getCustomModes, type CustomMode } from "../lib/custom-modes"

export type ChatMode = "plan" | "build" | "scaling" | "designer" | "debug" | string // string for custom modes

interface ChatModeSelectorProps {
    value: ChatMode
    onChange: (mode: ChatMode) => void
    disabled?: boolean
}

const chatModeOptions = [
    {
        id: "build" as const,
        label: "Build",
        icon: Code, // Code icon for Build
    },
    {
        id: "plan" as const,
        label: "Plan",
        icon: PlanIcon, // PlanIcon for Plan
    },
    {
        id: "scaling" as const,
        label: "Scaling",
        icon: Zap, // Zap/lightning icon for Scaling
    },
    {
        id: "designer" as const,
        label: "Designer",
        icon: Palette, // Palette icon for Designer
    },
    {
        id: "debug" as const,
        label: "Debug",
        icon: Bug, // Bug icon for Debug
    },
]

export function ChatModeSelector({
    value,
    onChange,
    disabled,
}: ChatModeSelectorProps) {
    const [customModes, setCustomModes] = useState<CustomMode[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // Load custom modes
    useEffect(() => {
        setCustomModes(getCustomModes())
    }, [isModalOpen])

    // Find selected mode
    const selectedMainMode = chatModeOptions.find((opt) => opt.id === value)
    const selectedCustomMode = customModes.find((m) => m.id === value)
    
    const selectedOption = selectedMainMode || (selectedCustomMode ? {
        id: selectedCustomMode.id,
        label: selectedCustomMode.name,
        icon: FileText,
    } : chatModeOptions[0])
    
    const Icon = selectedOption.icon

    const handleSelectMode = (modeId: ChatMode | string) => {
        onChange(modeId as ChatMode)
        setIsDropdownOpen(false)
    }

    return (
        <>
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
                            disabled && "opacity-50 pointer-events-none",
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{selectedOption.label}</span>
                        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[200px]">
                    {/* Main Modes */}
                    <div className="px-2 py-1.5">
                        <div className="text-xs font-medium text-muted-foreground mb-1.5">Main</div>
                        {chatModeOptions.map((option) => {
                            const isSelected = value === option.id
                            const OptionIcon = option.icon
                            return (
                                <DropdownMenuItem
                                    key={option.id}
                                    onClick={() => handleSelectMode(option.id)}
                                    className="gap-2 justify-between rounded-md"
                                >
                                    <div className="flex items-center gap-2">
                                        <OptionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>{option.label}</span>
                                    </div>
                                    {isSelected && <span className="text-xs opacity-50">✓</span>}
                                </DropdownMenuItem>
                            )
                        })}
                    </div>

                    {/* Custom Modes */}
                    {customModes.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5">
                                <div className="text-xs font-medium text-muted-foreground mb-1.5">Custom</div>
                                {customModes.map((mode) => {
                                    const isSelected = value === mode.id
                                    return (
                                        <DropdownMenuItem
                                            key={mode.id}
                                            onClick={() => handleSelectMode(mode.id)}
                                            className="gap-2 justify-between rounded-md"
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{mode.name}</span>
                                            </div>
                                            {isSelected && <span className="text-xs opacity-50">✓</span>}
                                        </DropdownMenuItem>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* Manage Custom Modes */}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            setIsDropdownOpen(false)
                            setIsModalOpen(true)
                        }}
                        className="gap-2 rounded-md"
                    >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Manage Custom Modes</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom Mode Modal */}
            <CustomModeModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onSelectMode={handleSelectMode}
            />
        </>
    )
}
