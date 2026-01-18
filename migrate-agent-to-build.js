// Migration script to update "agent" mode to "build" mode in the database
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get database path
const dbPath = path.join(os.homedir(), '.1code', 'db.sqlite');
console.log('Database path:', dbPath);

const db = new Database(dbPath);

try {
    // Update subChats table
    const subChatsResult = db.prepare(`
        UPDATE subChats 
        SET mode = 'build' 
        WHERE mode = 'agent'
    `).run();

    console.log(`Updated ${subChatsResult.changes} subChats from 'agent' to 'build'`);

    // Verify the update
    const remaining = db.prepare(`
        SELECT COUNT(*) as count 
        FROM subChats 
        WHERE mode = 'agent'
    `).get();

    console.log(`Remaining subChats with 'agent' mode: ${remaining.count}`);

    if (remaining.count === 0) {
        console.log('✅ Migration successful! All "agent" modes have been updated to "build"');
    } else {
        console.log('⚠️ Some records still have "agent" mode');
    }

} catch (error) {
    console.error('❌ Migration failed:', error);
} finally {
    db.close();
}
