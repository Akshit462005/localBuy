// Quick test to verify database functionality
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection and tables...');
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📋 Tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check users count
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👥 Users in database: ${usersCount.rows[0].count}`);
    
    // Check products count
    const productsCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`📦 Products in database: ${productsCount.rows[0].count}`);
    
    console.log('✅ Database test completed successfully!');
    
    client.release();
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();