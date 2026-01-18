import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { join } from "path"
import { existsSync, mkdirSync } from "fs"
import * as schema from "../main/lib/db/schema"

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let sqlite: Database.Database | null = null

/**
 * Get the database path for web mode
 */
function getDatabasePath(): string {
  // Use a local data directory for web mode
  const dataDir = join(process.cwd(), "data")
  
  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  return join(dataDir, "agents.db")
}

/**
 * Get the migrations folder path
 */
function getMigrationsPath(): string {
  return join(process.cwd(), "drizzle")
}

/**
 * Initialize the database with Drizzle ORM
 */
export function initDatabase() {
  if (db) {
    return db
  }

  const dbPath = getDatabasePath()
  console.log(`[DB] Initializing database at: ${dbPath}`)

  // Create SQLite connection
  sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")

  // Create Drizzle instance
  db = drizzle(sqlite, { schema })

  // Run migrations
  const migrationsPath = getMigrationsPath()
  console.log(`[DB] Running migrations from: ${migrationsPath}`)

  try {
    migrate(db, { migrationsFolder: migrationsPath })
    console.log("[DB] Migrations completed")
  } catch (error) {
    console.error("[DB] Migration error:", error)
    throw error
  }

  return db
}

/**
 * Get the database instance
 */
export function getDatabase() {
  if (!db) {
    return initDatabase()
  }
  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close()
    sqlite = null
    db = null
    console.log("[DB] Database connection closed")
  }
}

// Re-export schema for convenience
export * from "../main/lib/db/schema"
