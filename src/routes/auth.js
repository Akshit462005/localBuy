const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false } // Enable SSL for Aiven
});

// Login page
router.get('/login', (req, res) => {
    res.render('auth/login');
});

// Register page
router.get('/register', (req, res) => {
    res.render('auth/register');
});

// Register handler
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        // Validate input
        if (!username || !email || !password || !role) {
            return res.render('auth/register', { 
                error: 'All fields are required',
                values: { username, email, role }
            });
        }

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.render('auth/register', {
                error: 'User with this email or username already exists',
                values: { username, email, role }
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
            [username, email, hashedPassword, role]
        );

        res.redirect('/auth/login');
    } catch (err) {
        console.error('Registration error:', err);
        res.render('auth/register', { 
            error: 'Registration failed. Please try again.',
            values: { 
                username: req.body.username || '', 
                email: req.body.email || '', 
                role: req.body.role || 'user' 
            }
        });
    }
});

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.render('auth/login', { error: 'User not found' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.render('auth/login', { error: 'Invalid password' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            'your-jwt-secret',
            { expiresIn: '1h' }
        );

        req.session.token = token;
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            loginTime: new Date().toISOString()
        };

        // API response for cache integration
        if (req.headers['content-type']?.includes('application/json') || req.query.format === 'json') {
            return res.json({
                success: true,
                message: 'Login successful',
                user: req.session.user,
                redirectUrl: user.role === 'shopkeeper' ? '/shopkeeper/dashboard' : '/user/dashboard'
            });
        }

        if (user.role === 'shopkeeper') {
            res.redirect('/shopkeeper/dashboard');
        } else {
            res.redirect('/user/dashboard');
        }
    } catch (err) {
        res.render('error', { message: 'Login failed' });
    }
});

// Logout with cache cleanup
router.get('/logout', (req, res) => {
    // API response for cache integration
    if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Logout failed' });
            }
            res.json({
                success: true,
                message: 'Logout successful',
                redirectUrl: '/'
            });
        });
    } else {
        req.session.destroy();
        res.redirect('/');
    }
});

module.exports = router;