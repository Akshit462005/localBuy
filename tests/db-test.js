const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
    const pool = new Pool({
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT),
        database: process.env.POSTGRES_DB,
        ssl: false
    });

    try {
        // Test connection
        const client = await pool.connect();
        console.log('✅ Database connection successful');

        // Test tables existence
        const tables = ['users', 'products', 'orders', 'order_items'];
        for (const table of tables) {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [table]);
            
            if (result.rows[0].exists) {
                console.log(`✅ Table '${table}' exists`);
            } else {
                console.log(`❌ Table '${table}' does not exist`);
            }
        }

        // Test table columns
        console.log('\nChecking table columns:');
        
        // Users table
        const userColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.log('\nUsers table columns:');
        userColumns.rows.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        });

        // Products table
        const productColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products';
        `);
        console.log('\nProducts table columns:');
        productColumns.rows.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        });

        client.release();
    } catch (err) {
        console.error('❌ Database test failed:', err.message);
    } finally {
        await pool.end();
    }
}

// Run the test
testDatabaseConnection();