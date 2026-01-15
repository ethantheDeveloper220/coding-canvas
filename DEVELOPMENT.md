# Development Scripts Guide

## Available NPM Scripts

### Full Stack Development
```bash
npm run dev          # Run both frontend (renderer) and backend (main) together
npm run build        # Build both frontend and backend
npm run preview      # Preview the built app
```

### Backend Only (Main Process)
```bash
npm run dev:main     # Run ONLY the Electron backend in dev mode
npm run build:main   # Build ONLY the Electron backend
```

### Frontend Only (Renderer Process)
```bash
npm run dev:renderer # Run ONLY the frontend in dev mode
npm run build:renderer # Build ONLY the frontend
```

### Database Management
```bash
npm run db:generate  # Generate database migrations from schema
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run db:reset     # Reset the database (delete and recreate)
npm run db:fix       # Run complete Claude Code fix (reset DB + generate migrations)
```

### Building & Packaging
```bash
npm run package      # Package app for current platform
npm run package:mac  # Package for macOS
npm run package:win  # Package for Windows
npm run package:linux # Package for Linux
npm run dist         # Build distributable
```

### Other Utilities
```bash
npm run ts:check     # TypeScript type checking
npm run icon:generate # Generate app icons
npm run claude:download # Download Claude binary for current platform
npm run claude:download:all # Download Claude binaries for all platforms
```

## When to Use What

### During Active Development
- **Full stack**: `npm run dev` - Use this most of the time
- **Backend only**: `npm run dev:main` - When working on:
  - Database schemas
  - tRPC routers
  - Electron main process
  - IPC handlers
  - File system operations
- **Frontend only**: `npm run dev:renderer` - When working on:
  - UI components
  - React components
  - Styling
  - Frontend logic

### Database Changes
1. Modify schema in `src/main/lib/db/schema/index.ts`
2. Run `npm run db:generate` to create migrations
3. Restart the app - migrations run automatically

### If Database Issues Occur
```bash
npm run db:fix       # Automated fix: stops app, resets DB, generates migrations
# OR manually:
npm run db:reset     # Just reset the database
npm run db:generate  # Just generate migrations
```

## Architecture Overview

```
1code-main/
├── src/
│   ├── main/          # Backend (Electron main process)
│   │   ├── index.ts   # Entry point
│   │   ├── lib/
│   │   │   ├── db/    # Database (SQLite + Drizzle)
│   │   │   ├── trpc/  # API routers
│   │   │   └── claude/ # Claude integration
│   │   └── windows/   # Window management
│   │
│   ├── renderer/      # Frontend (React)
│   │   ├── index.html
│   │   ├── features/  # Feature modules
│   │   └── components/ # UI components
│   │
│   └── preload/       # Preload scripts (bridge)
│
├── drizzle/           # Database migrations
├── scripts/           # Utility scripts
└── out/               # Build output
```

## Common Development Workflows

### Workflow 1: Adding a New Feature
1. `npm run dev` - Start full development server
2. Make changes to frontend/backend
3. Hot reload happens automatically
4. Test in the Electron window

### Workflow 2: Database Schema Changes
1. Stop the app if running
2. Edit `src/main/lib/db/schema/index.ts`
3. Run `npm run db:generate`
4. Run `npm run dev`
5. Check console for "[DB] Migrations completed"

### Workflow 3: Debugging Backend Only
1. `npm run dev:main` - Faster startup, no frontend
2. Check console logs for backend behavior
3. Test tRPC endpoints
4. Debug database queries

### Workflow 4: Debugging Frontend Only
1. `npm run dev:renderer` - Just the React app
2. Open browser DevTools
3. Test UI components
4. Check React component tree

## Environment Variables

The app uses these environment variables:

- `ELECTRON_RENDERER_URL` - Set by electron-vite in dev mode
- `NODE_ENV` - `development` or `production`

## Troubleshooting

### "Module not found" errors
```bash
npm install
npm run postinstall  # Rebuilds native modules
```

### Database errors
```bash
npm run db:fix  # Complete database reset and fix
```

### Build errors
```bash
rm -rf out node_modules
npm install
npm run build
```

### Electron won't start
1. Check if port 5173/5174 is already in use
2. Kill any existing Electron processes
3. Delete `out/` folder and rebuild

## Tips

- **Fast iteration**: Use `dev:main` or `dev:renderer` for faster startup
- **Database GUI**: Use `npm run db:studio` to inspect database visually
- **Type safety**: Run `npm run ts:check` before committing
- **Clean build**: Delete `out/` folder if you get weird errors

## Production Build

```bash
# 1. Build the app
npm run build

# 2. Package for your platform
npm run package:win   # or :mac or :linux

# 3. Find the output in release/ folder
```

## Next Steps

- Read `CLAUDE_CODE_FIX.md` for Claude Code setup
- Check `README.md` for project overview
- See `RELEASE.md` for release process
