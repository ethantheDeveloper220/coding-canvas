# Custom Modifications Build Script

This script helps you maintain your custom modifications when updating from the upstream repository.

## What It Does

The build script preserves your OpenCode integration and other custom changes by:
1. **Creating git patches** of your modifications
2. **Backing up modified files** to `.custom-files/`
3. **Pulling updates** from upstream
4. **Reapplying your changes** automatically

## Quick Start

### Save Your Current Changes
```bash
node build-script.js save-patches
node build-script.js backup
```

### Update from Upstream
```bash
node build-script.js update
```

This will:
- Save your current changes as patches
- Backup all modified files
- Pull from upstream
- Automatically reapply your changes

### Restore from Backup (if needed)
```bash
node build-script.js restore
```

## Commands

| Command | Description |
|---------|-------------|
| `save-patches` | Save current modifications as git patches |
| `backup` | Backup all custom files to `.custom-files/` |
| `apply-patches` | Apply saved patches to current code |
| `restore` | Restore custom files from backup |
| `update` | Pull from upstream and reapply changes |
| `help` | Show help message |

## Modified Files Tracked

The script automatically tracks these files:
- `src/main/lib/opencode/chat.ts` - OpenCode chat handler
- `src/main/lib/opencode/index.ts` - OpenCode exports
- `src/main/lib/opencode-state.ts` - OpenCode state management
- `src/main/lib/trpc/routers/opencode.ts` - OpenCode TRPC router
- `src/main/lib/trpc/routers/claude.ts` - Claude router with OpenCode routing
- `src/renderer/features/agents/main/new-chat-form.tsx` - Agent selector UI
- `src/renderer/features/agents/main/active-chat.tsx` - Transport creation
- `src/renderer/features/agents/lib/ipc-chat-transport.ts` - Transport with agentType
- `src/renderer/features/agents/atoms/index.ts` - Agent atoms

## Workflow Example

### Before Pulling Updates
```bash
# 1. Save your work
node build-script.js save-patches
node build-script.js backup

# 2. Commit any important changes
git add .
git commit -m "My custom changes"
```

### Pulling Updates
```bash
# Option 1: Use the update command (recommended)
node build-script.js update

# Option 2: Manual update
git pull origin main
node build-script.js apply-patches
```

### If There Are Conflicts
```bash
# Check the patch files
ls .patches/

# Manually apply patches
git apply .patches/uncommitted-changes.patch

# Or restore from backup
node build-script.js restore
```

## Directory Structure

```
1code-main/
├── build-script.js          # This script
├── .patches/                # Git patches (auto-generated)
│   ├── uncommitted-changes.patch
│   └── staged-changes.patch
└── .custom-files/           # File backups (auto-generated)
    └── src/
        ├── main/
        └── renderer/
```

## Tips

1. **Run `save-patches` regularly** to keep backups of your work
2. **Commit important changes** before updating
3. **Check for conflicts** after running `update`
4. **Keep `.patches/` and `.custom-files/`** in `.gitignore`

## Troubleshooting

### Patches Won't Apply
If patches have conflicts:
1. Check `.patches/uncommitted-changes.patch`
2. Manually merge the changes
3. Or use `node build-script.js restore` to restore from backup

### Files Not Backed Up
Add them to the `MODIFIED_FILES` array in `build-script.js`

### Lost Changes
Check `.custom-files/` directory for backups
