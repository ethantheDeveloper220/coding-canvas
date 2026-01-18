import { eq } from 'drizzle-orm'
import { getDatabase } from '../db'
import { chats, subChats } from '../db/schema'
import simpleGit from 'simple-git'
import * as fs from 'fs'
import * as path from 'path'

// Supported text file extensions that should be included in diffs
const SUPPORTED_TEXT_EXTENSIONS = [
  // Programming languages
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift',
  '.scala', '.kt', '.dart', '.lua', '.r', '.m', '.sh', '.ps1', '.bat', '.cmd',
  // Web technologies
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl', '.stylus',
  // Data formats
  '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.csv', '.tsv', '.sql', '.graphql', '.gql',
  // Documentation
  '.md', '.markdown', '.txt', '.rst', '.adoc', '.tex',
  // Config files
  '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc',
  'Dockerfile', 'Makefile', 'Rakefile', 'CMakeLists.txt',
  // Other text files
  '.log', '.out', '.err',
  // Package files
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.json',
  'Gemfile', 'requirements.txt', 'Pipfile', 'Cargo.toml', 'pom.xml', 'build.gradle',
]

// Binary file extensions to exclude from diffs
const BINARY_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.ogg', '.flac', '.aac',
  '.zip', '.rar', '.tar', '.gz', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.psd', '.ai', '.sketch', '.fig',
]

// Get file icon based on extension
function getFileIcon(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  
  // Programming languages
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return '🟨'
  if (['.ts', '.tsx', '.d.ts'].includes(ext)) return '🔷'
  if (ext === '.vue') return '💚'
  if (ext === '.svelte') return '🔴'
  if (ext === '.py') return '🐍'
  if (ext === '.java') return '☕'
  if (['.c', '.cpp', '.h', '.hpp'].includes(ext)) return '⚙️'
  if (ext === '.cs') return '🔷'
  if (ext === '.php') return '🐘'
  if (ext === '.rb') return '💎'
  if (ext === '.go') return '🐹'
  if (ext === '.rs') return '🦀'
  if (ext === '.swift') return '🦉'
  if (['.scala', '.kt', '.dart'].includes(ext)) return '🎯'
  
  // Web technologies
  if (['.html', '.htm'].includes(ext)) return '🌐'
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) return '🎨'
  if (['.json', '.xml'].includes(ext)) return '📄'
  
  // Data/config
  if (['.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext)) return '⚙️'
  if (['.md', '.markdown', '.rst'].includes(ext)) return '📝'
  if (['.sql', '.graphql', '.gql'].includes(ext)) return '🗃️'
  
  // Special files
  if (filePath.endsWith('package.json')) return '📦'
  if (filePath.endsWith('Dockerfile')) return '🐳'
  if (filePath.endsWith('Makefile')) return '🔨'
  if (['.gitignore', '.gitattributes', '.editorconfig'].includes(path.basename(filePath))) return '🔧'
  
  // Default
  return '📄'
}

/**
 * Get diff for OpenCode chats
 * This function checks both the worktree git diff AND OpenCode session changes
 */
export async function getOpenCodeDiff(chatId: string): Promise<{ diff: string | null; error?: string }> {
    const db = getDatabase()

    // Get chat and worktree path
    const chat = db
        .select()
        .from(chats)
        .where(eq(chats.id, chatId))
        .get()

    if (!chat?.worktreePath) {
        return { diff: null, error: 'No worktree path' }
    }

    const worktreePath = chat.worktreePath

    // Check if worktree exists
    if (!fs.existsSync(worktreePath)) {
        return { diff: null, error: 'Worktree path does not exist' }
    }

    try {
        const git = simpleGit(worktreePath)

        // Check if it's a git repository
        const isRepo = await git.checkIsRepo()
        if (!isRepo) {
            console.log('[OpenCodeDiff] Not a git repo, initializing...')
            await git.init()
            await git.add('.')
        }

        // Get git status
        const status = await git.status()
        console.log('[OpenCodeDiff] Git status:', {
            modified: status.modified.length,
            created: status.created.length,
            deleted: status.deleted.length,
            renamed: status.renamed.length,
        })

        // If no changes, check if we need to stage OpenCode changes
        if (status.modified.length === 0 && status.created.length === 0) {
            console.log('[OpenCodeDiff] No git changes detected, checking for unstaged files...')

            // Get all supported text files in directory (sync)
            // Only scan files we're confident are text files to improve performance
            const allFiles = getAllFilesSync(worktreePath)
            if (allFiles.length > 0) {
                console.log('[OpenCodeDiff] Found supported unstaged files:', allFiles.length)
                // Stage all supported text files
                if (allFiles.length > 0) {
                    await git.add(allFiles)
                }
            }
        }

        // Get diff (staged and unstaged)
        let diff = ''

        // Try to get diff against HEAD
        try {
            diff = await git.diff(['HEAD'])
        } catch (e) {
            // No HEAD yet (new repo), show all files as new
            console.log('[OpenCodeDiff] No HEAD, showing all files as new')
            diff = await git.diff(['--cached'])
        }

        // If still no diff, try unstaged
        if (!diff) {
            diff = await git.diff()
        }

        // Filter out binary files and unsupported files from the diff
        if (diff) {
            diff = filterUnsupportedFilesFromDiff(diff)
            // Add a summary header with file count and icons
            const fileCount = (diff.match(/diff --git/g) || []).length
            if (fileCount > 0) {
                const header = `// Diff for ${fileCount} supported file${fileCount > 1 ? 's' : ''}\n`
                diff = header + diff
            }
        }

        console.log('[OpenCodeDiff] Generated filtered diff length:', diff.length)
        return { diff: diff || null }
    } catch (error) {
        console.error('[OpenCodeDiff] Error generating diff:', error)
        return { diff: null, error: String(error) }
    }
}

/**
 * Check if a file is binary by analyzing its content
 * This is more reliable than just checking the extension
 */
function isFileBinaryByContent(filePath: string): boolean {
    try {
        // Read first few bytes to check for binary content
        const fileDescriptor = fs.openSync(filePath, 'r')
        const buffer = Buffer.alloc(512)
        const bytesRead = fs.readSync(fileDescriptor, buffer, 0, 512, 0)
        fs.closeSync(fileDescriptor)
        
        // Check for null bytes (common in binary files)
        if (buffer.includes(0)) {
            return true
        }
        
        // Check ratio of non-printable characters
        let nonPrintableCount = 0
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i]
            // Non-printable ASCII range (except for common whitespace like \t, \n, \r)
            if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                nonPrintableCount++
            }
        }
        
        // If more than 30% non-printable, likely binary
        const ratio = nonPrintableCount / bytesRead
        return ratio > 0.3
    } catch (error) {
        // If we can't read the file, assume binary
        console.log(`[OpenCodeDiff] Error checking file content, assuming binary: ${filePath}`, error)
        return true
    }
}

/**
 * Check if a file is binary by extension and content
 */
function isBinaryFile(filePath: string, checkContent = false): boolean {
    // First check by extension (faster)
    const ext = path.extname(filePath).toLowerCase()
    const isBinaryByExt = BINARY_EXTENSIONS.includes(ext)
    
    // If extension indicates binary, no need to check content
    if (isBinaryByExt) {
        return true
    }
    
    // If file has no extension or text extension, optionally check content
    if (checkContent) {
        const fullPath = path.resolve(filePath)
        if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
            return isFileBinaryByContent(fullPath)
        }
    }
    
    return false
}

/**
 * Check if a file is a supported text file with improved detection
 */
function isSupportedTextFile(filePath: string, checkContent = false): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const basename = path.basename(filePath)
    
    // First check by extension (faster)
    if (SUPPORTED_TEXT_EXTENSIONS.includes(ext)) {
        // If it has a text extension, optionally verify it's actually text
        if (checkContent && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
            return !isFileBinaryByContent(filePath)
        }
        return true
    }
    
    // Check special files by name
    const specialFiles = [
        'Dockerfile', 'Makefile', 'Rakefile', 'CMakeLists.txt', 
        '.gitignore', '.gitattributes', '.editorconfig', 
        'package.json', 'package-lock.json', 'yarn.lock', 
        'Gemfile', 'requirements.txt', 'Pipfile', 'Cargo.toml',
        'tsconfig.json', 'jest.config.js', 'webpack.config.js',
        'vite.config.js', 'vite.config.ts', 'next.config.js',
        '.env.example', '.env.local', '.env.development',
        '.babelrc', '.eslintrc.js', '.eslintrc.json',
        'prettier.config.js', 'prettierrc.json', 'tailwind.config.js'
    ]
    
    if (specialFiles.includes(basename)) {
        // For special files, optionally verify they're text
        if (checkContent && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
            return !isFileBinaryByContent(filePath)
        }
        return true
    }
    
    // Files without extension but likely text (like scripts, config files)
    if (!ext) {
        const textFilesNoExt = ['LICENSE', 'README', 'CHANGELOG', 'CONTRIBUTING', 
                              'INSTALL', 'NEWS', 'TODO', 'HISTORY',
                              'COPYING', 'CODE_OF_CONDUCT', 'VERSION']
        
        if (textFilesNoExt.includes(basename.toUpperCase())) {
            if (checkContent && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
                return !isFileBinaryByContent(filePath)
            }
            return true
        }
    }
    
    // If content checking is enabled and file exists, verify it's actually text
    if (checkContent && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        return !isFileBinaryByContent(filePath)
    }
    
    return false
}

/**
 * Filter out binary files and unsupported files from git diff output
 * Removes entries that contain "Binary files ... differ" and filters by supported file types
 * Also improves handling of non-existent files
 */
function filterUnsupportedFilesFromDiff(diffText: string): string {
    if (!diffText) return diffText

    const lines = diffText.split('\n')
    const filteredLines: string[] = []
    let i = 0

    while (i < lines.length) {
        // Check if this line starts a new diff block
        if (lines[i].startsWith('diff --git ')) {
            // Extract the file path from the diff line
            // Format: diff --git a/src/file.js b/src/file.js
            const match = lines[i].match(/diff --git a\/(.*?) b\/(.*?)$/)
            if (!match) {
                // Skip this block if we can't parse the file path
                while (i < lines.length && !lines[i].startsWith('diff --git ')) {
                    i++
                }
                continue
            }
            
            const filePath = match[1] // a/file path
            let isBinary = false
            let isSupported = true
            
            // Check if file is binary or unsupported
            // First try with extension-based detection
            if (isBinaryFile(filePath)) {
                isBinary = true
            } else if (!isSupportedTextFile(filePath)) {
                isSupported = false
            } else {
                // For ambiguous files (no extension or text extension), check content if worktree path is known
                // This provides better accuracy for files with misleading extensions
                try {
                    const fullPath = path.join(process.cwd(), filePath) // Adjust path as needed
                    if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
                        // Use content-based detection as the final check
                        if (isFileBinaryByContent(fullPath)) {
                            isBinary = true
                        } else if (!isSupportedTextFile(filePath, true)) {
                            isSupported = false
                        }
                    }
                } catch (error) {
                    // If we can't check content, fall back to extension-based detection
                    console.log(`[OpenCodeDiff] Could not check file content, using extension: ${filePath}`)
                }
            }
            
            // Collect all lines for this diff block
            const blockLines: string[] = []
            
            // Collect lines until next diff block or end
            while (i < lines.length) {
                const line = lines[i]
                blockLines.push(line)

                // Check if this is a binary file indicator (additional check)
                if (
                    (line.includes('Binary files') && line.includes('differ')) ||
                    line.includes('GIT binary patch') ||
                    (line.startsWith('Binary files ') && line.endsWith(' differ'))
                ) {
                    isBinary = true
                }

                // Stop if we hit the next diff block (but include the line starting the next block)
                i++
                if (i < lines.length && lines[i].startsWith('diff --git ')) {
                    break
                }
            }

            // Only include this block if it's not binary and is a supported text file
            if (!isBinary && isSupported) {
                // Add file icon as a comment for better visualization
                const icon = getFileIcon(filePath)
                const iconComment = `// ${icon} ${filePath}`
                
                // Log the file being included for debugging
                console.log(`[OpenCodeDiff] Including file in diff: ${filePath}`)
                
                // Insert the icon comment after the diff line
                for (let j = 0; j < blockLines.length; j++) {
                    filteredLines.push(blockLines[j])
                    if (j === 0) { // After the diff --git line
                        filteredLines.push(iconComment)
                    }
                }
            } else {
                // Log why we're skipping this file
                const reason = isBinary ? 'binary' : 'unsupported'
                console.log(`[OpenCodeDiff] Skipping ${reason} file: ${filePath}`)
            }
        } else {
            // Line doesn't start a diff block, just copy it
            filteredLines.push(lines[i])
            i++
        }
    }

    return filteredLines.join('\n')
}

/**
 * Get all supported text files in a directory recursively (synchronous)
 */
function getAllFilesSync(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath)

    files.forEach((file) => {
        const filePath = path.join(dirPath, file)

        // Skip .git directory and node_modules
        if (file === '.git' || file === 'node_modules' || file === '.git') return

        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFilesSync(filePath, arrayOfFiles)
        } else {
            // Only include supported text files, with content verification for better accuracy
            // This filters out files with misleading extensions
            if (isSupportedTextFile(filePath, true)) {
                arrayOfFiles.push(filePath)
            }
        }
    })

    return arrayOfFiles
}

/**
 * Get git diff for a single file
 * Returns GitHub-style diff for the file
 */
export async function getFileDiff(
    worktreePath: string,
    filePath: string
): Promise<{ diff: string | null; error?: string }> {
    if (!fs.existsSync(worktreePath)) {
        return { diff: null, error: 'Worktree path does not exist' }
    }

    try {
        const git = simpleGit(worktreePath)

        // Check if it's a git repository
        const isRepo = await git.checkIsRepo()
        if (!isRepo) {
            return { diff: null, error: 'Not a git repository' }
        }

        // Try to get diff against HEAD (includes staged and unstaged)
        let diff = ''
        try {
            // First try unstaged diff
            diff = await git.diff(['--', filePath])
            
            // If no unstaged diff, try staged
            if (!diff) {
                diff = await git.diff(['--cached', '--', filePath])
            }

            // If still no diff, try against HEAD
            if (!diff) {
                diff = await git.diff(['HEAD', '--', filePath])
            }
        } catch (e) {
            // File might be untracked, try to show it as new file
            const fullPath = path.join(worktreePath, filePath)
            if (fs.existsSync(fullPath)) {
                // Check if this is a supported text file with content verification
                if (!isSupportedTextFile(filePath, true)) {
                    console.log(`[OpenCodeDiff] Skipping unsupported or binary file: ${filePath}`)
                    return { diff: null }
                }
                
                // Create a diff showing the entire file as new
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8')
                    const icon = getFileIcon(filePath)
                    diff = `diff --git a/${filePath} b/${filePath}\n// ${icon} ${filePath}\nnew file mode 100644\nindex 0000000..${Buffer.from(content).toString('hex').substring(0, 7)}\n--- /dev/null\n+++ b/${filePath}\n${content.split('\n').map(line => `+${line}`).join('\n')}`
                } catch (readError) {
                    // If we can't read as UTF-8, it's likely binary
                    console.log(`[OpenCodeDiff] File appears to be binary: ${filePath}`)
                    return { diff: null }
                }
            } else {
                console.log(`[OpenCodeDiff] File does not exist: ${filePath}`)
                // Create a diff showing a deleted file
                const icon = getFileIcon(filePath)
                diff = `diff --git a/${filePath} b/${filePath}\n// ${icon} ${filePath}\n--- a/${filePath}\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-File was deleted\n`
            }
        }

        // Filter out binary files and unsupported files from the diff
        if (diff) {
            const filtered = filterUnsupportedFilesFromDiff(diff)
            return { diff: filtered || null }
        }

        return { diff: null }
    } catch (error) {
        console.error('[OpenCodeDiff] Error generating file diff:', error)
        return { diff: null, error: String(error) }
    }
}

/**
 * Get git status for a single file
 * Returns 'modified', 'added', 'deleted', 'untracked', or null if unchanged
 */
export async function getFileStatus(
    worktreePath: string,
    filePath: string
): Promise<{ status: 'modified' | 'added' | 'deleted' | 'untracked' | null; error?: string }> {
    if (!fs.existsSync(worktreePath)) {
        return { status: null, error: 'Worktree path does not exist' }
    }

    try {
        const git = simpleGit(worktreePath)

        // Check if it's a git repository
        const isRepo = await git.checkIsRepo()
        if (!isRepo) {
            // Check if file exists - if so, it's untracked
            const fullPath = path.join(worktreePath, filePath)
            if (fs.existsSync(fullPath)) {
                return { status: 'untracked' }
            }
            return { status: null }
        }

        const status = await git.status()

        // Check if file is in created/added files (staged or unstaged)
        if (status.created.includes(filePath)) {
            return { status: 'added' }
        }

        // Check if file is in deleted files
        if (status.deleted.includes(filePath)) {
            return { status: 'deleted' }
        }

        // Check if file is in modified files (staged or unstaged)
        if (status.modified.includes(filePath)) {
            return { status: 'modified' }
        }

        // Check if file is untracked (not in git yet)
        if (status.not_added.includes(filePath)) {
            return { status: 'untracked' }
        }

        // Check staged files (files that are staged but not in the above lists)
        try {
            const stagedFiles = await git.diff(['--cached', '--name-only'])
            if (stagedFiles && stagedFiles.includes(filePath)) {
                // Check if it's a new file in staging (would be in created)
                // or modified (would be in modified above)
                // Since it's staged but not in created/modified, it's likely modified
                return { status: 'modified' }
            }
        } catch {
            // Ignore errors checking staged files
        }

        return { status: null }
    } catch (error) {
        console.error('[OpenCodeDiff] Error getting file status:', error)
        return { status: null, error: String(error) }
    }
}

/**
 * Extract file changes from OpenCode session messages
 * This parses the tool calls to find write/edit operations
 */
export function extractOpenCodeChanges(chatId: string): Array<{
    type: 'write' | 'edit'
    filePath: string
    content?: string
    oldContent?: string
    newContent?: string
}> {
    const db = getDatabase()

    // Get all sub-chats for this chat
    const allSubChats = db
        .select()
        .from(subChats)
        .where(eq(subChats.chatId, chatId))
        .all()

    const changes: Array<any> = []

    for (const subChat of allSubChats) {
        if (!subChat.messages) continue

        try {
            const messages = JSON.parse(subChat.messages)

            for (const message of messages) {
                if (message.role !== 'assistant') continue
                if (!message.parts) continue

                for (const part of message.parts) {
                    // Check for Write tool
                    if (part.type === 'tool-Write' && part.input) {
                        changes.push({
                            type: 'write',
                            filePath: part.input.file_path || part.input.path,
                            content: part.input.content,
                        })
                    }

                    // Check for Edit tool
                    if (part.type === 'tool-Edit' && part.input) {
                        changes.push({
                            type: 'edit',
                            filePath: part.input.file_path || part.input.path,
                            oldContent: part.input.old_string,
                            newContent: part.input.new_string,
                        })
                    }
                }
            }
        } catch (e) {
            console.error('[OpenCodeDiff] Error parsing messages:', e)
        }
    }

    console.log('[OpenCodeDiff] Extracted changes:', changes.length)
    return changes
}
