require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const { Pool } = require('pg');
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    ssl: false
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
const authRoutes = require('./routes/auth');
const shopkeeperRoutes = require('./routes/shopkeeper');
const userRoutes = require('./routes/user');

app.use('/auth', authRoutes);
app.use('/shopkeeper', shopkeeperRoutes);
app.use('/user', userRoutes);

// Home route
app.get('/', (req, res) => {
    res.render('home');
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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    initDb();
});