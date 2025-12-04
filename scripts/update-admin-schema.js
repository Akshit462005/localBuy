const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'localbuy',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function updateAdminSchema() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating admin management schema...');
        
        // Admin activity logs
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                target_type VARCHAR(50), -- 'user', 'product', 'order', 'shop'
                target_id INTEGER,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Admin logs table created');
        
        // Shop management
        await client.query(`
            CREATE TABLE IF NOT EXISTS shop_status (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) UNIQUE,
                shop_name VARCHAR(255) NOT NULL,
                shop_description TEXT,
                status VARCHAR(50) DEFAULT 'pending', -- pending, approved, suspended, rejected
                approved_by INTEGER REFERENCES users(id),
                approved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Shop status table created');
        
        // Support tickets
        await client.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, closed
                priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
                assigned_to INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Support tickets table created');
        
        // Financial tracking
        await client.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                shopkeeper_id INTEGER REFERENCES users(id),
                amount DECIMAL(10,2) NOT NULL,
                commission DECIMAL(10,2) NOT NULL,
                net_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending', -- pending, processed, failed
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Transactions table created');
        
        // Add banned status column to users if not exists
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS banned_by INTEGER REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS ban_reason TEXT;
        `);
        console.log('✅ User ban fields added');
        
        // Add approved status to products if not exists
        await client.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active', -- active, pending, rejected, suspended
            ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
        `);
        console.log('✅ Product approval fields added');
        
        // Add indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);',
            'CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);',
            'CREATE INDEX IF NOT EXISTS idx_shop_status_user_id ON shop_status(user_id);',
            'CREATE INDEX IF NOT EXISTS idx_shop_status_status ON shop_status(status);',
            'CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);',
            'CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);',
            'CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);',
            'CREATE INDEX IF NOT EXISTS idx_transactions_shopkeeper_id ON transactions(shopkeeper_id);',
            'CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users(is_banned);',
            'CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);'
        ];
        
        for (const indexQuery of indexes) {
            await client.query(indexQuery);
        }
        console.log('✅ Database indexes created');
        
        console.log('🎉 Admin management schema update completed successfully!');
        
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

updateAdminSchema().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});