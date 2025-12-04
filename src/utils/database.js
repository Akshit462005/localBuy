const { Pool } = require('pg');

// Create a single pool instance with conservative connection limits for cloud hosting
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false }, // Enable SSL for Aiven
    // Conservative connection pool configuration for cloud databases
    max: 3, // Very limited max connections to avoid "too many clients"
    min: 1, // Keep at least one connection alive
    idleTimeoutMillis: 10000, // Close idle connections after 10 seconds
    connectionTimeoutMillis: 5000, // Return error after 5 seconds if unable to connect
    acquireTimeoutMillis: 20000, // Pool will wait up to 20 seconds for connection
    maxUses: 1000, // Close (and replace) a connection after it has been used 1000 times
    statement_timeout: 30000, // Query timeout (30 seconds)
    query_timeout: 30000,
    application_name: 'LocalBuy_App' // Help identify connections in database logs
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

// Pool connection events for monitoring
pool.on('connect', (client) => {
    console.log('🔗 New database connection established');
});

pool.on('acquire', (client) => {
    console.log('📤 Database connection acquired from pool');
});

pool.on('release', (client) => {
    console.log('📥 Database connection released back to pool');
});

// Test the connection with retry logic
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
            console.log('✅ Database connection pool initialized successfully');
            console.log('🕒 Database time:', result.rows[0].current_time);
            console.log('📊 Pool status - Total:', pool.totalCount, 'Idle:', pool.idleCount, 'Waiting:', pool.waitingCount);
            return true;
        } catch (err) {
            console.error(`❌ Database connection test failed (attempt ${i + 1}/${retries}):`, err.message);
            if (i < retries - 1) {
                console.log('🔄 Retrying in 2 seconds...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    console.error('❌ All database connection attempts failed. Application may not function properly.');
    return false;
}

// Initialize connection test
testConnection();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🔄 Closing database connection pool...');
    pool.end(() => {
        console.log('✅ Database connection pool closed');
        process.exit(0);
    });
});

// Enhanced query wrapper with retry logic
async function queryWithRetry(text, params, retries = 2) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await pool.query(text, params);
            return result;
        } catch (err) {
            console.error(`❌ Query failed (attempt ${i + 1}/${retries}):`, err.message);
            if (i < retries - 1 && (err.code === 'ECONNRESET' || err.message.includes('too many clients'))) {
                console.log('🔄 Retrying query in 1 second...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                throw err;
            }
        }
    }
}

// Export both the pool and enhanced query function
module.exports = {
    ...pool,
    query: queryWithRetry,
    connect: pool.connect.bind(pool),
    end: pool.end.bind(pool),
    on: pool.on.bind(pool),
    removeListener: pool.removeListener.bind(pool),
    get totalCount() { return pool.totalCount; },
    get idleCount() { return pool.idleCount; },
    get waitingCount() { return pool.waitingCount; }
};