# Safe Update Guide for 1code-main

## Current Situation
Your `1code-main` directory is NOT a git repository, so we need to manually update it while preserving your customizations.

## What We've Added/Modified

### New Features Created:
1. **Landing & Pricing Pages**
   - `src/renderer/features/landing/landing-page.tsx`
   - `src/renderer/features/landing/pricing-page.tsx`
   - `src/renderer/features/landing/index.ts`

2. **Agent Manager**
   - `src/renderer/features/agents/components/settings-tabs/agents-manager-tab.tsx`
   - Updated: `src/renderer/features/agents/components/agents-settings-dialog.tsx`

3. **Multi-Agent Mode**
   - `src/renderer/features/agents/components/multi-agent-prompts.tsx`
   - Updated: `src/renderer/features/agents/main/new-chat-form.tsx`

4. **OpenCode Tool Support**
   - Updated: `src/main/lib/trpc/routers/claude.ts` (enhanced tool call handling)

5. **App Routing**
   - Updated: `src/renderer/App.tsx` (added hash routing for landing/pricing)

## Safe Update Process

### Option 1: Manual Backup & Selective Update (Recommended)

1. **Backup Your Customizations**
   ```powershell
   # Create backup directory
   mkdir C:\Users\EthFR\Downloads\1code-backup
   
   # Copy modified files
   Copy-Item "C:\Users\EthFR\Downloads\1code-main\1code-main\src\renderer\features\landing" -Destination "C:\Users\EthFR\Downloads\1code-backup\landing" -Recurse
   Copy-Item "C:\Users\EthFR\Downloads\1code-main\1code-main\src\renderer\features\agents\components\multi-agent-prompts.tsx" -Destination "C:\Users\EthFR\Downloads\1code-backup\"
   Copy-Item "C:\Users\EthFR\Downloads\1code-main\1code-main\src\renderer\features\agents\components\settings-tabs\agents-manager-tab.tsx" -Destination "C:\Users\EthFR\Downloads\1code-backup\"
   Copy-Item "C:\Users\EthFR\Downloads\1code-main\1code-main\src\main\lib\trpc\routers\claude.ts" -Destination "C:\Users\EthFR\Downloads\1code-backup\"
   ```

2. **Download Latest 1code-main**
   - Get the latest version from the source
   - Extract to a new folder: `C:\Users\EthFR\Downloads\1code-main-new`

3. **Restore Your Customizations**
   ```powershell
   # Copy your custom features back
   Copy-Item "C:\Users\EthFR\Downloads\1code-backup\landing" -Destination "C:\Users\EthFR\Downloads\1code-main-new\1code-main\src\renderer\features\" -Recurse
   Copy-Item "C:\Users\EthFR\Downloads\1code-backup\multi-agent-prompts.tsx" -Destination "C:\Users\EthFR\Downloads\1code-main-new\1code-main\src\renderer\features\agents\components\"
   Copy-Item "C:\Users\EthFR\Downloads\1code-backup\agents-manager-tab.tsx" -Destination "C:\Users\EthFR\Downloads\1code-main-new\1code-main\src\renderer\features\agents\components\settings-tabs\"
   ```

4. **Manually Merge Modified Files**
   - Compare and merge changes in:
     - `src/renderer/App.tsx`
     - `src/renderer/features/agents/main/new-chat-form.tsx`
     - `src/renderer/features/agents/components/agents-settings-dialog.tsx`
     - `src/main/lib/trpc/routers/claude.ts`

### Option 2: Initialize Git & Track Changes

```powershell
cd C:\Users\EthFR\Downloads\1code-main\1code-main

# Initialize git
git init

# Add all current files
git add .

# Commit current state
git commit -m "Current state with custom features"

# Add upstream remote (if you have the original repo URL)
git remote add upstream <ORIGINAL_REPO_URL>

# Fetch latest
git fetch upstream

# Merge (will show conflicts for modified files)
git merge upstream/main
```

### Option 3: Use a Diff Tool

1. Download latest 1code-main to a separate folder
2. Use a diff tool like:
   - **WinMerge** (free)
   - **Beyond Compare**
   - **VS Code** (built-in diff)
3. Compare directories and selectively copy updates

## Files to Watch During Update

These files were modified and may conflict:

| File | What We Changed |
|------|----------------|
| `src/renderer/App.tsx` | Added hash routing for landing/pricing pages |
| `src/renderer/features/agents/main/new-chat-form.tsx` | Added multi-agent mode toggle and component |
| `src/renderer/features/agents/components/agents-settings-dialog.tsx` | Added Agents tab |
| `src/main/lib/trpc/routers/claude.ts` | Enhanced OpenCode tool call handling |

## After Update

1. **Reinstall Dependencies**
   ```powershell
   npm install
   cd opencode\packages\opencode
   bun install
   ```

2. **Test Everything**
   ```powershell
   npm run dev
   ```

3. **Verify Features Work**
   - Landing page (`#/`)
   - Pricing page (`#/pricing`)
   - Agent Manager (Settings → Agents)
   - Multi-agent mode (toggle in new chat)
   - OpenCode tool calls

## Need Help?

If you get the original 1code-main repository URL, I can help you set up git properly and merge updates automatically!

---

**Recommendation**: Use Option 1 (Manual Backup) for safety, or Option 2 if you want version control going forward.
