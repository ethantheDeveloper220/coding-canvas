 #warning opencode super experimental⚠️#


# Code Canvas 🎨

> **AI-powered desktop application for intelligent code assistance**  
> Transform your coding workflow with intelligent agents that understand your codebase and execute tasks in real-time.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/21st-dev/21st/releases)

---

## ✨ Key Features

### 🤖 AI Agent Integration
- **Claude Code** - Anthropic's powerful AI coding assistant
- **OpenCode** - Support for 75+ LLM providers via Models.dev
- **Multi-Agent Orchestration** - Run up to 5 agents simultaneously (tier-based)
- **Dynamic Model Selection** - Choose from available models per agent
- **Local & Remote Execution** - Use models locally or via API

### 📋 Plan & Agent Modes
- **Plan Mode** - Read-only analysis with code suggestions (safe mode)
- **Agent Mode** - Full code execution with bash, file edits, and web search capabilities
- **Mode Switching** - Seamlessly switch between modes during sessions

### 🔧 Real-time Tool Execution
- **Live Tool Execution** - Watch bash commands, file edits, and web searches happen in real-time
- **Visual Tool Blocks** - Beautiful UI components for each tool type (bash, edit, write, web search, etc.)
- **Execution Status** - See pending, in-progress, and completed states
- **Streaming Updates** - Real-time streaming of AI responses and tool outputs

### 🌳 Git Worktree Isolation
- **Isolated Sessions** - Each chat session runs in its own Git worktree
- **Safe Experimentation** - Test changes without affecting your main branch
- **Automatic Cleanup** - Worktrees are managed automatically
- **Merge Support** - Easy integration of changes back to main branch

### 💻 Integrated Terminal
- **Full Terminal Access** - Complete terminal integration with xterm.js
- **Syntax Highlighting** - Enhanced terminal experience
- **Command History** - Access to full command history
- **Multiple Terminal Tabs** - Run multiple terminal sessions
- **Search Functionality** - Search terminal output

### 📊 Visual Change Tracking
- **Beautiful Diff Viewer** - Side-by-side diff visualization with syntax highlighting
- **File Search & Filter** - Search and filter changed files by name, type, or status
- **Change Categories** - Filter by Added, Modified, Deleted, or Unchanged
- **Commit Management** - Visual commit history with stats and file previews
- **PR-ready Diffs** - Generate PR-ready change summaries

### 📁 Project Management
- **Local Folder Linking** - Link local project folders to sessions
- **Automatic Git Detection** - Detects Git remotes automatically
- **Multi-Project Support** - Manage multiple projects simultaneously
- **Project Sidebar** - Easy navigation between projects and sessions

### 🎯 Session Memory & Context
- **Session Persistence** - Sessions are saved and can be resumed
- **Context Summaries** - AI maintains context across conversations
- **Message Chaining** - Full conversation history preserved
- **AGENTS.md Support** - Automatic context from project documentation

### 🔍 Advanced Search & Filtering
- **Diff Search** - Search within diff content
- **File Search** - Find files by name or path
- **Sort Options** - Sort by Name, Type, Size, or Date
- **Filter Controls** - Multiple filter options for organizing changes

### 🎨 Modern UI/UX
- **Beautiful Design** - Modern, clean interface with smooth animations
- **Theme Support** - Light/dark mode with system theme detection
- **VSCode Theme Integration** - Use your favorite VSCode themes
- **Responsive Layout** - Resizable panels and adaptive layouts
- **Landing & Pricing Pages** - Built-in marketing pages

### 🛠️ Developer Tools
- **Monaco Editor** - Full-featured code editor with IntelliSense
- **File Preview** - Quick file previews with syntax highlighting
- **Context Menus** - Right-click menus for quick actions
- **Keyboard Shortcuts** - Power user keyboard navigation
- **Slash Commands** - `/plan`, `/agent`, `/clear` and more

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop** | Electron 33.4.5, electron-vite, electron-builder |
| **UI Framework** | React 19, TypeScript 5.4.5, Tailwind CSS |
| **Components** | Radix UI, Lucide icons, Motion animations |
| **State Management** | Jotai, Zustand, React Query |
| **Backend** | tRPC, Drizzle ORM, better-sqlite3 |
| **Code Editor** | Monaco Editor with syntax highlighting |
| **Terminal** | xterm.js with multiple addons |
| **AI SDKs** | @anthropic-ai/claude-code, OpenCode |
| **Package Manager** | Bun |

---

## 📦 Installation

### Download Pre-built Binaries

Download the latest release for your platform:

- **macOS**: `.dmg` (Intel & Apple Silicon) - [Download](https://github.com/21st-dev/21st/releases)
- **Windows**: `.exe` installer or portable - [Download](https://github.com/21st-dev/21st/releases)
- **Linux**: `.AppImage` or `.deb` - [Download](https://github.com/21st-dev/21st/releases)

### System Requirements

- **macOS**: macOS 10.13 or later
- **Windows**: Windows 10 or later
- **Linux**: Most modern distributions

---

## 💻 Development

### Prerequisites

- [Bun](https://bun.sh) package manager (recommended) or npm/yarn
- Node.js 18+ (if not using Bun)
- Python (for native module building)
- Xcode Command Line Tools (macOS only)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/code-canvas.git
cd code-canvas

# Install dependencies
bun install

# Start development server
bun run dev
```

### Development Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Electron with hot reload |
| `bun run build` | Compile TypeScript |
| `bun run package` | Package for current platform (directory) |
| `bun run package:mac` | Build macOS (DMG + ZIP) |
| `bun run package:win` | Build Windows (NSIS + portable) |
| `bun run package:linux` | Build Linux (AppImage + DEB) |
| `bun run db:generate` | Generate database migrations |
| `bun run db:push` | Push schema to database (dev only) |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run ts:check` | Type-check TypeScript |

### Web Mode Development

The app can also run in a browser for faster development:

```bash
# Development mode (Vite + Node server)
bun run web:dev

# Production build
bun run web:build
bun run web:server
```

---

## 📚 Architecture

### Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window lifecycle
│   ├── auth-manager.ts      # OAuth flow, token refresh
│   ├── auth-store.ts        # Encrypted credential storage
│   ├── windows/main.ts      # Window creation, IPC handlers
│   └── lib/
│       ├── db/              # Drizzle ORM + SQLite
│       │   ├── index.ts     # DB init, auto-migrate
│       │   └── schema/      # Database schema definitions
│       └── trpc/routers/    # tRPC routers (projects, chats, claude, opencode)
│
├── preload/                 # IPC bridge (context isolation)
│   └── index.ts             # Exposes desktopApi + tRPC bridge
│
└── renderer/                # React 19 UI
    ├── App.tsx              # Root component with providers
    ├── features/
    │   ├── agents/          # Main chat interface
    │   │   ├── main/        # active-chat.tsx, new-chat-form.tsx
    │   │   ├── ui/          # Tool renderers, preview, diff view
    │   │   ├── commands/    # Slash commands (/plan, /agent, /clear)
    │   │   └── components/  # Agent management, settings
    │   ├── changes/         # Change tracking and diff views
    │   ├── terminal/        # Terminal integration
    │   ├── landing/         # Landing and pricing pages
    │   ├── onboarding/      # Onboarding flows
    │   └── layout/          # Main layout with resizable panels
    ├── components/ui/       # Radix UI component wrappers
    └── lib/
        ├── atoms/           # Global Jotai atoms
        ├── stores/          # Global Zustand stores
        └── trpc.ts          # tRPC client setup
```

### Database

- **Engine**: SQLite with better-sqlite3
- **ORM**: Drizzle ORM
- **Location**: `{userData}/data/agents.db`
- **Auto-migration**: Runs on app startup

**Schema:**
- `projects` - Project folders linked to the app
- `chats` - Chat sessions with worktree paths
- `sub_chats` - Sub-conversations within chats with messages and session IDs

### Communication

- **IPC**: Type-safe tRPC over Electron IPC
- **State**: Jotai for UI state, Zustand for persisted state, React Query for server state
- **Streaming**: Real-time message and tool execution streaming via tRPC subscriptions

---

## 🚀 Features in Detail

### Multi-Agent Workflows

Run multiple AI agents simultaneously on the same or different tasks:

- Add up to 5 agents per session (tier-based limits)
- Each agent can use different models
- Independent prompts for each agent
- Combined results view

### Tool Types

The app visualizes various tool executions:

- **Bash Tool** - Terminal command execution
- **Edit Tool** - File modifications with diff preview
- **Write Tool** - New file creation
- **Web Search** - Internet search results
- **Web Fetch** - HTTP requests and responses
- **Task Tool** - Sub-task delegation
- **Plan Tool** - Implementation planning
- **Todo Tool** - Task management

### Git Integration

Deep Git integration for safe development:

- Automatic worktree creation per session
- Worktree cleanup on session end
- Git status detection
- Visual diff generation
- Commit history browsing
- Branch management support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Powered by [Anthropic Claude](https://www.anthropic.com/) and [OpenCode](https://opencode.ai/)

---

## 📧 Support

- **Discord**: [Join our community](https://discord.gg/Qx4rFunqvY)
- **Issues**: [GitHub Issues](https://github.com/yourusername/code-canvas/issues)
- **Documentation**: See the [docs](docs/) folder for detailed guides

---

**Made with ❤️ by the Code Canvas team**
