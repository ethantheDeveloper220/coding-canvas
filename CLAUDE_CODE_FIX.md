# Claude Code Connection - Complete Fix Guide

## ✅ Issues Fixed

### 1. Database Schema Mismatch
**Problem**: Schema was PostgreSQL but app uses SQLite  
**Solution**: Converted all schema files to SQLite

### 2. Missing Migrations
**Problem**: No migration files existed  
**Solution**: Generated migrations with `npm run db:generate`

### 3. Table Conflicts
**Problem**: Old PostgreSQL tables conflicted with new SQLite schema  
**Solution**: Created database reset script to start fresh

### 4. Poor Error Messages
**Problem**: Connection errors weren't helpful  
**Solution**: Added comprehensive error handling with detailed messages

## 🚀 Quick Fix Steps

If you're seeing the Claude Code connection error, follow these steps:

### Option A: Using NPM Scripts (Recommended)

```bash
# Run the automated fix (stops app, resets DB, generates migrations)
npm run db:fix

# Then start the app
npm run dev
```

### Option B: Manual Steps

#### Step 1: Reset the Database
```powershell
# Stop the app first (close Electron window)
# Then run:
npm run db:reset
# OR manually:
powershell -ExecutionPolicy Bypass -File .\scripts\reset-database.ps1
```

#### Step 2: Generate Migrations (if needed)
```bash
npm run db:generate
```

#### Step 3: Start the App
```bash
npm run dev
```

### Step 3: Check Database Initialization
You should see in the console:
```
[DB] Initializing database at: C:\Users\...\Agents Dev\data\agents.db
[DB] Running migrations from: ...\drizzle
[DB] Migrations completed
```

## 🔍 Understanding the Error

The error you saw:
```
table `chats` already exists
```

This happened because:
1. The old database had PostgreSQL-style tables
2. We changed the schema to SQLite
3. Drizzle tried to create new tables but found old ones
4. The structures were incompatible

## 📝 What Changed

### Files Modified:
1. **src/main/lib/db/schema/index.ts**
   - `pgTable` → `sqliteTable`
   - `timestamp` → `integer` with timestamp mode
   - Imports from `pg-core` → `sqlite-core`

2. **drizzle.config.ts**
   - `dialect: "postgresql"` → `dialect: "sqlite"`
   - Removed PostgreSQL connection string

3. **src/main/lib/trpc/routers/claude-code.ts**
   - Added comprehensive error handling
   - Added detailed logging
   - Added network error detection
   - Added helpful error messages

### Files Created:
1. **drizzle/** - Migration files
   - `0000_spooky_the_santerians.sql`
   - `meta/_journal.json`
   - `meta/0000_snapshot.json`

2. **scripts/reset-database.ps1** - Database reset utility

## 🎯 Testing Claude Code Connection

After the fix, when you try to connect Claude Code:

### Expected Behavior:
1. Click "Connect Claude Code" button
2. You'll see one of these messages:

**If backend is NOT running:**
```
Cannot connect to backend server at http://localhost:3000. 
Make sure the server is running.
```

**If not authenticated:**
```
Not authenticated with 21st.dev. Please sign in first.
```

**If backend endpoint missing:**
```
Backend API endpoint not found. Make sure the server is 
running at http://localhost:3000
```

### What You Need:
To actually complete the Claude Code connection, you need:

1. **Backend Server Running** at `http://localhost:3000` (dev) or `https://21st.dev` (prod)
2. **Be Signed In** to the desktop app
3. **Backend has Claude Code OAuth endpoints** implemented

## 🛠️ Backend Requirements

The backend server needs these endpoints:

```
POST /api/auth/claude-code/start
- Headers: x-desktop-token
- Returns: { sandboxId, sandboxUrl, sessionId }
```

The backend creates a CodeSandbox instance that handles the Anthropic OAuth flow.

## 📊 Database Location

Your SQLite database is stored at:
```
Windows: C:\Users\<YourName>\AppData\Roaming\Agents Dev\data\agents.db
```

You can inspect it with tools like:
- DB Browser for SQLite
- DBeaver
- SQLite CLI

## 🔐 How Tokens Are Stored

When you successfully connect Claude Code:
1. OAuth token is encrypted using Electron's `safeStorage`
2. Stored in the `claude_code_credentials` table
3. Token is decrypted on-demand when needed
4. Disconnecting deletes the token from local storage

## 🐛 Troubleshooting

### App won't start after database reset
- Make sure all Electron processes are closed
- Check if database files are still locked
- Restart your computer if needed

### Migrations still failing
- Delete the entire `Agents Dev` folder in AppData
- Run `npm run db:generate` again
- Start the app fresh

### Claude Code connection still not working
- Check if you're signed in to the desktop app
- Verify backend server is running
- Check browser console for detailed error messages
- Look for `[ClaudeCode]` logs in the Electron console

## 📚 Additional Resources

- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Electron safeStorage**: https://www.electronjs.org/docs/latest/api/safe-storage
- **SQLite Docs**: https://www.sqlite.org/docs.html

## ✨ Summary

The Claude Code connection is now properly configured with:
- ✅ Correct SQLite schema
- ✅ Working migrations
- ✅ Clean database
- ✅ Detailed error messages
- ✅ Proper error handling

The connection will work once you have the backend server running with the OAuth endpoints!
