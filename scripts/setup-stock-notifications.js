#!/usr/bin/env node

/**
 * Stock Notification Setup Script
 * Run this script to initialize the stock_notifications table in your database
 */

require('dotenv').config();
const pool = require('../src/utils/database');
const fs = require('fs');
const path = require('path');

async function setupStockNotifications() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting Stock Notifications Setup...\n');
        
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'database', 'stock_notifications_migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('⏳ Executing migration file as a single batch...');
        await client.query(migrationSQL);
        console.log('✅ Success\n');
        
        console.log('✅ Stock Notifications table setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Configure email settings in your .env file:');
        console.log('   - EMAIL_SERVICE=gmail');
        console.log('   - EMAIL_USER=your-email@gmail.com');
        console.log('   - EMAIL_PASSWORD=your-app-password');
        console.log('2. Set APP_URL to your application URL');
        console.log('3. Restart your application\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error setting up stock notifications:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

// Run the setup
setupStockNotifications();
