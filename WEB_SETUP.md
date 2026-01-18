# Web/Browser Setup Guide

This guide explains how to run the app in a web browser instead of as an Electron desktop app.

## Overview

The app can now run in two modes:
1. **Desktop Mode** (default): Electron app with native features
2. **Web Mode**: Browser-based version accessible via HTTP

## Prerequisites

- Node.js 18+ and npm/bun
- All dependencies installed (`npm install` or `bun install`)

## Running in Web Mode

### Development Mode

Run both the Vite dev server (frontend) and the Node.js server (backend) simultaneously:

```bash
npm run web:dev
```

This will:
- Start Vite dev server on `http://localhost:3000` (frontend)
- Start the tRPC server on `http://localhost:3001` (backend API)

Open `http://localhost:3000` in your browser.

### Production Build

1. Build the frontend:
```bash
npm run web:build
```

2. Start the server:
```bash
npm run web:server
```

Or use the combined command:
```bash
npm run web:start
```

The app will be available at `http://localhost:3001`

## Architecture

### Frontend (Browser)
- React app served by Vite
- Uses HTTP-based tRPC client instead of Electron IPC
- Web-compatible API stubs replace Electron APIs

### Backend (Node.js Server)
- tRPC server handling API requests
- SQLite database (stored in `./data/agents.db`)
- Same business logic as Electron version

## Differences from Desktop Version

### Features Available in Web Mode
- ✅ All core app features
- ✅ tRPC API communication
- ✅ Database operations
- ✅ Browser notifications (with permission)
- ✅ Clipboard access (with permission)
- ✅ Fullscreen mode

### Features Not Available in Web Mode
- ❌ Native window controls (minimize, maximize, close)
- ❌ Auto-update system
- ❌ System tray integration
- ❌ Native file system access (limited)
- ❌ Terminal integration (requires separate setup)

### API Compatibility

The `desktopApi` is automatically replaced with web-compatible stubs when running in a browser. Most methods work the same way, but some are no-ops or use browser APIs instead.

## Database

The web version uses the same SQLite database as the desktop version, stored in:
- Development: `./data/agents.db`
- Production: `./data/agents.db`

Migrations are automatically run on server startup.

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use, you can change them:

```bash
PORT=3002 npm run web:server
```

### Database Errors

If you encounter database errors:
1. Delete `./data/agents.db` to reset
2. Ensure migrations are in `./drizzle/` directory
3. Check file permissions

### CORS Issues

The server is configured to allow requests from `localhost:3000`. If you need to change this, modify `src/server/index.ts`.

## Deployment

For production deployment:

1. Build the frontend:
```bash
npm run web:build
```

2. The `out/web` directory contains the static files
3. The server (`src/server/index.ts`) can be deployed to any Node.js hosting service
4. Ensure the `data` directory is writable for the database

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Set to `production` for production mode
