require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const https = require('https');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Redis setup (optional - will fall back to memory store if Redis fails)
let redisStore = null;
try {
    const RedisStore = require('connect-redis')(session);
    const { createClient } = require('redis');
    
    // Prefer a full REDIS_URL if provided (supports username/password and TLS)
    const redisUrl = process.env.REDIS_URL;
    let redisClient;
    if (redisUrl) {
        redisClient = createClient({ url: redisUrl });
    } else if (process.env.REDIS_USERNAME) {
        const username = process.env.REDIS_USERNAME;
        const password = process.env.REDIS_PASSWORD || '';
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT || 6379;
        const tls = process.env.REDIS_TLS === 'true';
        const scheme = tls ? 'rediss' : 'redis';
        const url = `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
        redisClient = createClient({ url });
    } else {
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            },
            password: process.env.REDIS_PASSWORD || undefined,
            database: process.env.REDIS_DB || 0
        });
    }

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        console.log('Falling back to memory store for sessions');
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis successfully');
    });

    // Connect to Redis
    redisClient.connect()
        .then(() => {
            redisStore = new RedisStore({ 
                client: redisClient,
                prefix: 'localbuy:'
            });
        })
        .catch((err) => {
            console.error('Redis connection failed:', err);
            console.log('Using memory store for sessions');
        });
} catch (error) {
    console.error('Redis setup failed:', error);
    console.log('Using memory store for sessions');
}

// Database connection
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false } // Enable SSL for Aiven
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration with Redis store (fallback to memory store)
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
};

// Add Redis store if available
if (redisStore) {
    sessionConfig.store = redisStore;
    console.log('Using Redis for session storage');
} else {
    console.log('Using memory store for session storage');
}

app.use(session(sessionConfig));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Add cache middleware for API responses
app.use('/api', (req, res, next) => {
    // Add cache headers for API responses
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const shopkeeperRoutes = require('./routes/shopkeeper');
const userRoutes = require('./routes/user');

app.use('/auth', authRoutes);
app.use('/shopkeeper', shopkeeperRoutes);
app.use('/user', userRoutes);

// API routes for cache integration
app.use('/api', require('./routes/api'));

// Home route with cache support
app.get('/', (req, res) => {
    const cacheData = {
        user: req.session.user || null,
        timestamp: new Date().toISOString(),
        theme: req.session.theme || 'light'
    };
    res.render('home', cacheData);
});

// Check database connection
async function initDb() {
    try {
        const client = await pool.connect();
        console.log('Database connection successful');
        client.release();
    } catch (err) {
        console.error('Error connecting to database:', err);
    }
}

// Export app for testing
function createApp() {
    return app;
}
// SSL Certificate configuration
function getSSLOptions() {
    try {
        const sslPath = path.join(__dirname, '..', 'ssl');
        const keyPath = path.join(sslPath, 'key.pem');
        const certPath = path.join(sslPath, 'cert.pem');
        
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            return {
                key: fs.readFileSync(keyPath),
                cert: fs.readFileSync(certPath)
            };
        }
    } catch (error) {
        console.warn('SSL certificates not found, running HTTP only');
    }
    return null;
}

if (require.main === module) {
    const sslOptions = getSSLOptions();
    
    // Start HTTP server
    app.listen(PORT, () => {
        console.log(`🚀 HTTP Server is running on http://localhost:${PORT}`);
        initDb();
    });
    
    // Start HTTPS server if SSL certificates are available
    if (sslOptions) {
        https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
            console.log(`🔒 HTTPS Server is running on https://localhost:${HTTPS_PORT}`);
            console.log('✅ SSL/TLS encryption enabled');
        });
    } else {
        console.log('⚠️  SSL certificates not found. Run: node scripts/generate-ssl-cert.js');
    }
}

module.exports = app;
