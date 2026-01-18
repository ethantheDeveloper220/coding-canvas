// Migration script using drizzle ORM
import { getDatabase, subChats } from './src/main/lib/db/index.js'
import { eq } from 'drizzle-orm'

const db = getDatabase()

try {
    // Update all subChats with mode='agent' to mode='build'
    const result = db.update(subChats)
        .set({ mode: 'build' })
        .where(eq(subChats.mode, 'agent'))
        .run()

    console.log(`✅ Updated ${result.changes} subChats from 'agent' to 'build'`)

    // Verify
    const remaining = db.select()
        .from(subChats)
        .where(eq(subChats.mode, 'agent'))
        .all()

    console.log(`Remaining subChats with 'agent' mode: ${remaining.length}`)

    if (remaining.length === 0) {
        console.log('✅ Migration successful!')
    }
} catch (error) {
    console.error('❌ Migration failed:', error)
}
