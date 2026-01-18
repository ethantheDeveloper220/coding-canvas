/**
 * Custom Mode Management
 * Handles storage and management of user-created custom modes
 */

export interface CustomMode {
  id: string
  name: string
  description?: string
  promptRules?: string
  preset?: Record<string, any>
  icon?: string
  color?: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = "custom-chat-modes"

/**
 * Get all custom modes from storage
 */
export function getCustomModes(): CustomMode[] {
  if (typeof window === "undefined") return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to load custom modes:", error)
    return []
  }
}

/**
 * Save custom modes to storage
 */
export function saveCustomModes(modes: CustomMode[]): void {
  if (typeof window === "undefined") return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes))
  } catch (error) {
    console.error("Failed to save custom modes:", error)
  }
}

/**
 * Add or update a custom mode
 */
export function saveCustomMode(mode: CustomMode): void {
  const modes = getCustomModes()
  const index = modes.findIndex((m) => m.id === mode.id)
  
  const modeToSave: CustomMode = {
    ...mode,
    updatedAt: Date.now(),
  }
  
  if (index >= 0) {
    // Update existing
    modes[index] = modeToSave
  } else {
    // Add new
    modes.push({
      ...modeToSave,
      createdAt: Date.now(),
    })
  }
  
  saveCustomModes(modes)
}

/**
 * Delete a custom mode
 */
export function deleteCustomMode(modeId: string): void {
  const modes = getCustomModes()
  const filtered = modes.filter((m) => m.id !== modeId)
  saveCustomModes(filtered)
}

/**
 * Get a custom mode by ID
 */
export function getCustomModeById(id: string): CustomMode | undefined {
  const modes = getCustomModes()
  return modes.find((m) => m.id === id)
}

/**
 * Generate a unique ID for a new custom mode
 */
export function generateCustomModeId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
