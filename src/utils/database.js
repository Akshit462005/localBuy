const { Pool } = require('pg');

// Create a single pool instance optimized for serverless/Vercel environment
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false }, // Enable SSL for Aiven
    // Serverless-optimized connection pool configuration
    max: 1, // Single connection for serverless to avoid conflicts
    min: 0, // No minimum connections - let pool scale to zero
    idleTimeoutMillis: 5000, // Close idle connections quickly (5 seconds)
    connectionTimeoutMillis: 3000, // Fail fast if can't connect (3 seconds)
    acquireTimeoutMillis: 3000, // Short timeout for acquiring connections
    maxUses: 100, // Refresh connections more frequently for serverless
    statement_timeout: 15000, // Shorter query timeout (15 seconds)
    query_timeout: 15000,
    application_name: 'LocalBuy_Serverless' // Identify serverless connections
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