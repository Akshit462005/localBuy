const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false }
});

async function updateInventory() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating inventory for existing products...');
        
        // Read the SQL update script
        const sqlPath = path.join(__dirname, '..', 'database', 'update_inventory.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split and execute SQL commands
        const commands = sql.split(';').filter(cmd => cmd.trim() && !cmd.trim().startsWith('--'));
        
        await client.query('BEGIN');
        
        for (const command of commands) {
            if (command.trim()) {
                console.log('Executing:', command.substring(0, 80) + '...');
                const result = await client.query(command.trim());
                
                if (result.rows && result.rows.length > 0) {
                    console.log('📊 Sample inventory after update:');
                    result.rows.slice(0, 10).forEach(row => {
                        console.log(`  ${row.name}: ${row.stock_quantity} units (₹${row.price})`);
                    });
                }
            }
        }
        
        await client.query('COMMIT');
        console.log('✅ Inventory update completed successfully!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating inventory:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    updateInventory().catch(console.error);
}

module.exports = { updateInventory };