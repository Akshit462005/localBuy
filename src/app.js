require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();

// 1. TRUST PROXY (Critical for Vercel HTTPS)
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// 2. REDIS SETUP (Robust logic for Cloud)
let redisStore = null;

// Wrap Redis setup in an async wrapper or simple try/catch block
try {
    const RedisStore = require('connect-redis')(session);
    const { createClient } = require('redis');
    
    let redisClient;
    
    // Check for full URL first (Standard for Vercel/Render/Heroku)
    if (process.env.REDIS_URL) {
        redisClient = createClient({ url: process.env.REDIS_URL });
    } else {
        // Fallback to individual components
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                tls: process.env.REDIS_TLS === 'true'
            },
            username: process.env.REDIS_USERNAME || 'default',
            password: process.env.REDIS_PASSWORD || undefined,
            database: parseInt(process.env.REDIS_DB) || 0
        });
    }

    redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis successfully');
    });

    // Attempt connection
    redisClient.connect().then(() => {
        redisStore = new RedisStore({ 
            client: redisClient,
            prefix: 'localbuy:'
        });
    }).catch(err => {
        console.log('Redis connection failed (using memory):', err.message);
    });

} catch (error) {
    console.error('Redis setup failed (using memory):', error.message);
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

// Cookie parser for backup authentication
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// 3. CORRECT STATIC PATH FOR VERCEL
app.use(express.static(path.join(process.cwd(), 'public')));

// Session configuration
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: true, // Force session save on Vercel
    saveUninitialized: false,
    name: 'localbuy.sid',
    cookie: {
        secure: process.env.NODE_ENV === 'production' && !process.env.DISABLE_SECURE_COOKIE,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: 'lax'
    }
};

// Apply store if initialized (Note: This might be null if Redis connects slowly, which is fine)
if (redisStore) {
    sessionConfig.store = redisStore;
    console.log('✅ Using Redis session store');
} else {
    console.log('⚠️  Using memory session store - sessions may not persist on Vercel!');
    // For Vercel, we need to be more aggressive with session saving
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        sessionConfig.resave = true;
        console.log('🔄 Enabled aggressive session saving for serverless environment');
    }
}

app.use(session(sessionConfig));

// Session debugging middleware (only in development or when DEBUG is enabled)
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_SESSIONS === 'true') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        console.log('Session ID:', req.sessionID);
        console.log('Has token:', !!req.session?.token);
        console.log('Has user:', !!req.session?.user);
        if (req.session?.user) {
            console.log('User role:', req.session.user.role);
        }
        next();
    });
}

// Set view engine
app.set('view engine', 'ejs');

// 4. CORRECT VIEWS PATH FOR VERCEL
app.set('views', path.join(process.cwd(), 'views'));

// Add cache middleware
app.use('/api', (req, res, next) => {
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
app.use('/api', require('./routes/api'));

// Home route
app.get('/', (req, res) => {
    const cacheData = {
        user: req.session.user || null,
        timestamp: new Date().toISOString(),
        theme: req.session.theme || 'light'
    };
    res.render('home', cacheData);
});

// Database Init
async function initDb() {
    try {
        const client = await pool.connect();
        console.log('Database connection successful');
        client.release();
    } catch (err) {
        console.error('Error connecting to database:', err);
    }
}

// SSL Config (Local only)
function getSSLOptions() {
    try {
        // Use __dirname here because SSL certs are local development files
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

// 5. SERVER STARTUP (Local vs Vercel)
if (require.main === module) {
    const sslOptions = getSSLOptions();
    
    app.listen(PORT, () => {
        console.log(`🚀 HTTP Server is running on http://localhost:${PORT}`);
        initDb();
    });
    
    if (sslOptions) {
        https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
            console.log(`🔒 HTTPS Server is running on https://localhost:${HTTPS_PORT}`);
            console.log('✅ SSL/TLS encryption enabled');
        });
    } else {
        console.log('⚠️  SSL certificates not found. Run: node scripts/generate-ssl-cert.js');
    }
}

// 6. EXPORT APP
module.exports = app;
