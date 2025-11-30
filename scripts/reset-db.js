require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false } // Enable SSL for Aiven
});

async function resetDatabase() {
    try {
        // Drop existing tables if they exist
        await pool.query(`
            DROP TABLE IF EXISTS order_items CASCADE;
            DROP TABLE IF EXISTS orders CASCADE;
            DROP TABLE IF EXISTS products CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        `);

        console.log('✅ Existing tables dropped successfully');

        // Create tables with correct schema
        await pool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                price DECIMAL(10,2) NOT NULL,
                image_url TEXT,
                shopkeeper_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                total_amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                product_id INTEGER REFERENCES products(id),
                quantity INTEGER NOT NULL,
                price DECIMAL(10,2) NOT NULL
            );
        `);

        console.log('✅ New tables created successfully');
        
        // Create a test user
        const hashedPassword = '$2a$10$rGxJ7Jp6.XkL3vfyR4FPYu4dYFZB.OZE9Agjc1xr8qIYoEhJ1H2jG'; // password: test123
        await pool.query(`
            INSERT INTO users (username, email, password, role)
            VALUES 
                ('testuser', 'test@example.com', $1, 'user'),
                ('testshop', 'shop@example.com', $1, 'shopkeeper')
        `, [hashedPassword]);

        console.log('✅ Test users created successfully');
        console.log('\nTest User Credentials:');
        console.log('User Account:');
        console.log('Email: test@example.com');
        console.log('Password: test123');
        console.log('\nShopkeeper Account:');
        console.log('Email: shop@example.com');
        console.log('Password: test123');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

resetDatabase();