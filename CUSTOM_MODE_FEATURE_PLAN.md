# Custom Mode Feature Implementation Plan

## Overview
Enhance the ChatModeSelector to support custom modes with prompt rules and presets, organized into Main (presets) and Custom (user-created) sections.

## Files to Modify

1. **`src/renderer/features/agents/components/chat-mode-selector.tsx`**
   - Update to support custom modes
   - Add modal for managing custom modes
   - Separate Main and Custom mode tabs

2. **`src/renderer/features/agents/components/custom-mode-modal.tsx`** (NEW)
   - Modal dialog with Main and Custom tabs
   - Prompt rules editor
   - Preset configuration editor
   - Create/edit/delete custom modes

3. **`src/renderer/features/agents/lib/custom-modes.ts`** (NEW)
   - Storage utilities for custom modes
   - Type definitions for custom modes
   - Validation and management functions

## Implementation Details

### 1. Custom Mode Modal Component

**Features:**
- Two tabs: "Main" (presets) and "Custom" (user-created)
- Main tab shows built-in modes with descriptions
- Custom tab allows:
  - Creating new custom modes
  - Editing existing custom modes
  - Deleting custom modes
  - Adding prompt rules (text editor)
  - Configuring presets (JSON or form-based)
- Theme-aware styling matching the app

### 2. Custom Mode Storage

**Storage Options:**
- Use localStorage for user-specific custom modes
- Store as JSON: `{ id, name, promptRules, preset, icon, color }`
- Persist across sessions

### 3. Prompt Rules Editor

**Features:**
- Multi-line text area for prompt rules
- Syntax highlighting (optional)
- Preview mode
- Save/cancel actions
- Character count

### 4. Preset Configuration

**Features:**
- JSON editor or form-based configuration
- Predefined preset templates
- Validation
- Import/export functionality

### 5. Updated ChatModeSelector

**Changes:**
- Show "Custom" option in dropdown
- Click "Custom" or manage button opens modal
- Display custom modes in Custom section
- Allow selecting custom modes
- Show custom mode indicator

### 6. Integration

**Integration Points:**
- Update ChatMode type to include custom mode IDs
- Pass custom mode configurations to chat transport
- Apply prompt rules when custom mode is selected
- Use presets for default configurations

## Category Feature Plan (Separate)

### Overview
Enhance category system with better organization and management.

### Features:
1. **Category Groups**
   - Organize categories into groups (e.g., "Development", "Design", "IoT")
   - Drag-and-drop reordering
   
2. **Category Templates**
   - Predefined category sets
   - Quick apply templates
   
3. **Category Rules**
   - Auto-categorization rules
   - Category-based filtering
   
4. **Category Statistics**
   - Usage counts
   - Task distribution
   
5. **Category Colors & Icons**
   - Custom color picker
   - Icon library selection

## Theme Integration

- Match existing VS Code theme styling
- Use theme-aware colors for all UI elements
- Smooth animations and transitions
- Consistent with Terminal sidebar and other panels

## Expected Results

- Users can create custom modes with prompt rules
- Custom modes are organized and easy to manage
- Presets can be configured per custom mode
- Main modes remain unchanged and always available
- Custom modes are persisted and available across sessions
- UI matches theme and feels native to the application
