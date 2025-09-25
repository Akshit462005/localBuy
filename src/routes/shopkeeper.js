const express = require('express');
const router = express.Router();
const { auth, isShopkeeper } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB
});

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: function(req, file, cb) {
        checkFileType(file, cb);
    }
});

// Check file type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
}

// Shopkeeper dashboard
router.get('/dashboard', auth, isShopkeeper, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE shopkeeper_id = $1',
            [req.user.id]
        );
        res.render('shopkeeper/dashboard', { products: result.rows });
    } catch (err) {
        res.render('error', { message: 'Error fetching products' });
    }
});

// Add product page
router.get('/add-product', auth, isShopkeeper, (req, res) => {
    res.render('shopkeeper/add-product');
});

// Add product handler
router.post('/add-product', auth, isShopkeeper, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        await pool.query(
            'INSERT INTO products (name, description, price, image_url, shopkeeper_id) VALUES ($1, $2, $3, $4, $5)',
            [name, description, price, image_url, req.user.id]
        );

        res.redirect('/shopkeeper/dashboard');
    } catch (err) {
        res.render('error', { message: 'Error adding product' });
    }
});

// Edit product page
router.get('/edit-product/:id', auth, isShopkeeper, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND shopkeeper_id = $2',
            [req.params.id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.render('error', { message: 'Product not found' });
        }

        res.render('shopkeeper/edit-product', { product: result.rows[0] });
    } catch (err) {
        res.render('error', { message: 'Error fetching product' });
    }
});

// Update product
router.post('/edit-product/:id', auth, isShopkeeper, upload.single('image'), async (req, res) => {
    try {
        const { name, description, price } = req.body;
        const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;

        await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, image_url = $4 WHERE id = $5 AND shopkeeper_id = $6',
            [name, description, price, image_url, req.params.id, req.user.id]
        );

        res.redirect('/shopkeeper/dashboard');
    } catch (err) {
        res.render('error', { message: 'Error updating product' });
    }
});

// Delete product
router.post('/delete-product/:id', auth, isShopkeeper, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM products WHERE id = $1 AND shopkeeper_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        
        if (result.rowCount === 0) {
            return res.render('error', { message: 'Product not found or you do not have permission to delete it' });
        }
        
        res.redirect('/shopkeeper/dashboard');
    } catch (err) {
        console.error('Error deleting product:', err);
        res.render('error', { message: 'Error deleting product: ' + err.message });
    }
});

module.exports = router;