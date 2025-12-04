const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'localbuy',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function updateOrderSchema() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating order system schema...');
        
        // Create order_tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS order_tracking (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                status VARCHAR(50) NOT NULL,
                location VARCHAR(255),
                description TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Order tracking table created');
        
        // Create reviews table
        await client.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, product_id, order_id)
            );
        `);
        console.log('✅ Reviews table created');
        
        // Create order_status_history table
        await client.query(`
            CREATE TABLE IF NOT EXISTS order_status_history (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
                old_status VARCHAR(50),
                new_status VARCHAR(50) NOT NULL,
                changed_by INTEGER REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Order status history table created');
        
        // Add indexes for performance
        await client.query('CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_order_tracking_timestamp ON order_tracking(timestamp DESC);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at DESC);');
        
        console.log('✅ Database indexes created');
        
        // Update existing orders to have proper status if they don't
        const result = await client.query(`
            UPDATE orders 
            SET status = 'pending' 
            WHERE status IS NULL OR status = ''
        `);
        
        if (result.rowCount > 0) {
            console.log(`✅ Updated ${result.rowCount} orders to have 'pending' status`);
        }
        
        console.log('🎉 Order system schema update completed successfully!');
        
    } catch (error) {
        console.error('❌ Error updating schema:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

updateOrderSchema().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});