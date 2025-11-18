require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection using environment variables
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
});

async function setupSchema() {
  try {
    console.log('🔄 Setting up database schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ Database schema created successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - products');
    console.log('   - cart');
    console.log('   - orders');
    console.log('   - order_items');
    console.log('🔧 Sample data inserted for testing');
    
  } catch (error) {
    console.error('❌ Error setting up database schema:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure PostgreSQL is running and the connection details are correct');
    } else if (error.code === '3D000') {
      console.log('💡 Database "localbuy_db" does not exist. Please create it first:');
      console.log('   psql -U postgres -c "CREATE DATABASE localbuy_db;"');
    }
  } finally {
    await pool.end();
  }
}

setupSchema();