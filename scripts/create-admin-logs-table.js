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

async function createAdminLogsTable() {
    const client = await pool.connect();
    
    try {
        console.log('Creating admin_logs table...');
        
        // Create admin_logs table if it doesn't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                target_type VARCHAR(50),
                target_id INTEGER,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Creating indexes for admin_logs table...');
        
        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action)
        `);
        
        console.log('✅ Successfully created admin_logs table and indexes');
        
        // Verify the table was created
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'admin_logs'
            ORDER BY ordinal_position
        `);
        
        console.log('✅ Table structure verification:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
    } catch (error) {
        console.error('❌ Error creating admin_logs table:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
if (require.main === module) {
    createAdminLogsTable()
        .then(() => {
            console.log('Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { createAdminLogsTable };