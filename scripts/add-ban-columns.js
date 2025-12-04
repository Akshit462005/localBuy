const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false }, // Enable SSL for Aiven
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 3000
});

async function addBanColumns() {
    const client = await pool.connect();
    
    try {
        console.log('Adding ban-related columns to users table...');
        
        // Add columns if they don't exist
        await client.query(`
            DO $$ 
            BEGIN 
                -- Add is_banned column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_banned') THEN
                    ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT false;
                    RAISE NOTICE 'Added is_banned column';
                END IF;
                
                -- Add banned_at column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banned_at') THEN
                    ALTER TABLE users ADD COLUMN banned_at TIMESTAMP NULL;
                    RAISE NOTICE 'Added banned_at column';
                END IF;
                
                -- Add banned_by column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banned_by') THEN
                    ALTER TABLE users ADD COLUMN banned_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
                    RAISE NOTICE 'Added banned_by column';
                END IF;
                
                -- Add ban_reason column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'ban_reason') THEN
                    ALTER TABLE users ADD COLUMN ban_reason TEXT NULL;
                    RAISE NOTICE 'Added ban_reason column';
                END IF;
            END $$;
        `);
        
        console.log('✅ Successfully added ban-related columns to users table');
        
        // Verify the columns were added
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('is_banned', 'banned_at', 'banned_by', 'ban_reason')
            ORDER BY column_name
        `);
        
        console.log('✅ Column verification:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
        });
        
    } catch (error) {
        console.error('❌ Error adding ban columns:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
if (require.main === module) {
    addBanColumns()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { addBanColumns };