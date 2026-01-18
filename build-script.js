#!/usr/bin/env node

/**
 * Build Script - Preserve Custom Modifications
 * 
 * This script helps maintain custom modifications when updating from upstream.
 * It creates patches of your changes and can reapply them after pulling updates.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PATCHES_DIR = path.join(__dirname, '.patches');
const CUSTOM_FILES_DIR = path.join(__dirname, '.custom-files');

// Files we've modified
const MODIFIED_FILES = [
    'src/main/lib/opencode/chat.ts',
    'src/main/lib/opencode/index.ts',
    'src/main/lib/opencode-state.ts',
    'src/main/lib/trpc/routers/opencode.ts',
    'src/main/lib/trpc/routers/claude.ts',
    'src/renderer/features/agents/main/new-chat-form.tsx',
    'src/renderer/features/agents/main/active-chat.tsx',
    'src/renderer/features/agents/lib/ipc-chat-transport.ts',
    'src/renderer/features/agents/atoms/index.ts',
];

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function exec(command, options = {}) {
    try {
        return execSync(command, {
            encoding: 'utf8',
            stdio: options.silent ? 'pipe' : 'inherit',
            ...options
        });
    } catch (error) {
        if (!options.ignoreError) {
            console.error(`Command failed: ${command}`);
            console.error(error.message);
            process.exit(1);
        }
        return null;
    }
}

function savePatches() {
    console.log('📦 Saving custom modifications as patches...\n');
    ensureDir(PATCHES_DIR);

    // Create a patch for all uncommitted changes
    const uncommittedPatch = path.join(PATCHES_DIR, 'uncommitted-changes.patch');
    exec(`git diff > "${uncommittedPatch}"`, { silent: true });

    if (fs.existsSync(uncommittedPatch) && fs.statSync(uncommittedPatch).size > 0) {
        console.log('✅ Saved uncommitted changes to:', uncommittedPatch);
    } else {
        console.log('ℹ️  No uncommitted changes found');
    }

    // Create a patch for staged changes
    const stagedPatch = path.join(PATCHES_DIR, 'staged-changes.patch');
    exec(`git diff --cached > "${stagedPatch}"`, { silent: true });

    if (fs.existsSync(stagedPatch) && fs.statSync(stagedPatch).size > 0) {
        console.log('✅ Saved staged changes to:', stagedPatch);
    }

    console.log('\n✨ Patches saved successfully!\n');
}

function backupFiles() {
    console.log('💾 Backing up custom files...\n');
    ensureDir(CUSTOM_FILES_DIR);

    for (const file of MODIFIED_FILES) {
        const sourcePath = path.join(__dirname, file);
        if (fs.existsSync(sourcePath)) {
            const backupPath = path.join(CUSTOM_FILES_DIR, file);
            ensureDir(path.dirname(backupPath));
            fs.copyFileSync(sourcePath, backupPath);
            console.log(`✅ Backed up: ${file}`);
        } else {
            console.log(`⚠️  File not found: ${file}`);
        }
    }

    console.log('\n✨ Backup complete!\n');
}

function applyPatches() {
    console.log('🔧 Applying saved patches...\n');

    const uncommittedPatch = path.join(PATCHES_DIR, 'uncommitted-changes.patch');
    const stagedPatch = path.join(PATCHES_DIR, 'staged-changes.patch');

    // Apply staged changes first
    if (fs.existsSync(stagedPatch) && fs.statSync(stagedPatch).size > 0) {
        console.log('Applying staged changes...');
        const result = exec(`git apply --check "${stagedPatch}"`, { silent: true, ignoreError: true });
        if (result !== null) {
            exec(`git apply "${stagedPatch}"`);
            console.log('✅ Staged changes applied');
        } else {
            console.log('⚠️  Staged patch has conflicts - manual merge required');
            console.log(`   Patch file: ${stagedPatch}`);
        }
    }

    // Apply uncommitted changes
    if (fs.existsSync(uncommittedPatch) && fs.statSync(uncommittedPatch).size > 0) {
        console.log('Applying uncommitted changes...');
        const result = exec(`git apply --check "${uncommittedPatch}"`, { silent: true, ignoreError: true });
        if (result !== null) {
            exec(`git apply "${uncommittedPatch}"`);
            console.log('✅ Uncommitted changes applied');
        } else {
            console.log('⚠️  Uncommitted patch has conflicts - manual merge required');
            console.log(`   Patch file: ${uncommittedPatch}`);
        }
    }

    console.log('\n✨ Patches applied!\n');
}

function restoreFiles() {
    console.log('📂 Restoring custom files from backup...\n');

    for (const file of MODIFIED_FILES) {
        const backupPath = path.join(CUSTOM_FILES_DIR, file);
        if (fs.existsSync(backupPath)) {
            const targetPath = path.join(__dirname, file);
            ensureDir(path.dirname(targetPath));
            fs.copyFileSync(backupPath, targetPath);
            console.log(`✅ Restored: ${file}`);
        }
    }

    console.log('\n✨ Files restored!\n');
}

function updateFromUpstream() {
    console.log('🔄 Updating from upstream...\n');

    // Save current changes
    savePatches();
    backupFiles();

    // Stash any uncommitted changes
    console.log('Stashing current changes...');
    exec('git stash push -m "Auto-stash before update"', { ignoreError: true });

    // Pull from upstream
    console.log('Pulling from upstream...');
    exec('git pull origin main');

    // Try to apply patches
    console.log('\nAttempting to reapply your changes...');
    applyPatches();

    console.log('\n✅ Update complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Check for any conflicts');
    console.log('   2. Run: npm install (if package.json changed)');
    console.log('   3. Run: npm run dev');
    console.log('\n   If there are conflicts, check .patches/ directory for patch files');
}

function showHelp() {
    console.log(`
📦 Build Script - Custom Modifications Manager

Usage: node build-script.js [command]

Commands:
  save-patches    Save current modifications as git patches
  backup          Backup all custom files
  apply-patches   Apply saved patches to current code
  restore         Restore custom files from backup
  update          Pull from upstream and reapply changes
  help            Show this help message

Examples:
  node build-script.js save-patches
  node build-script.js update
    `);
}

// Main
const command = process.argv[2];

switch (command) {
    case 'save-patches':
        savePatches();
        break;
    case 'backup':
        backupFiles();
        break;
    case 'apply-patches':
        applyPatches();
        break;
    case 'restore':
        restoreFiles();
        break;
    case 'update':
        updateFromUpstream();
        break;
    case 'help':
    default:
        showHelp();
        break;
}
