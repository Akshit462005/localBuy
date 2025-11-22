const express = require('express');
const router = express.Router();
const { auth, isShopkeeper } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { Pool } = require('pg');

// Redis cache utility
const redisCache = require('../utils/redis');

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

// Real-time metrics for dashboard (shopkeeper-specific)
router.get('/dashboard/metrics', auth, isShopkeeper, async (req, res) => {
    try {
        const shopkeeperId = req.user.id;

        // ensure redis client is connected (best-effort)
        try {
            if (!redisCache.client.isOpen) await redisCache.connect();
        } catch (e) {
            console.warn('Redis cache not available, continuing without cache');
        }

        const cacheKey = `shopkeeper:${shopkeeperId}:dashboard_metrics`;

        // Try cache first
        try {
            const cached = await redisCache.get(cacheKey);
            if (cached) {
                return res.json(Object.assign({ fromCache: true }, cached));
            }
        } catch (e) {
            console.warn('Redis GET failed, continuing to fetch from DB');
        }

        // Total products for this shopkeeper
        const productsPromise = pool.query(
            'SELECT COUNT(*) AS total_products FROM products WHERE shopkeeper_id = $1',
            [shopkeeperId]
        );

        // Total revenue from order_items for this shopkeeper's products
        const revenuePromise = pool.query(
            `SELECT COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE p.shopkeeper_id = $1`,
            [shopkeeperId]
        );

        // Total orders that include this shopkeeper's products
        const ordersPromise = pool.query(
            `SELECT COUNT(DISTINCT oi.order_id) AS total_orders
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE p.shopkeeper_id = $1`,
            [shopkeeperId]
        );

        // Total unique customers who ordered this shopkeeper's products
        const customersPromise = pool.query(
            `SELECT COUNT(DISTINCT o.user_id) AS total_customers
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             JOIN orders o ON oi.order_id = o.id
             WHERE p.shopkeeper_id = $1`,
            [shopkeeperId]
        );

        const [productsRes, revenueRes, ordersRes, customersRes] = await Promise.all([
            productsPromise,
            revenuePromise,
            ordersPromise,
            customersPromise
        ]);

        const totalProducts = parseInt(productsRes.rows[0].total_products, 10) || 0;
        const totalRevenue = parseFloat(revenueRes.rows[0].total_revenue) || 0;
        const totalOrders = parseInt(ordersRes.rows[0].total_orders, 10) || 0;
        const totalCustomers = parseInt(customersRes.rows[0].total_customers, 10) || 0;

        const payload = { totalProducts, totalRevenue, totalOrders, totalCustomers };

        // store in cache (short TTL for near-real-time)
        try {
            await redisCache.set(cacheKey, payload, 10); // 10 seconds
        } catch (e) {
            console.warn('Redis SET failed:', e.message || e);
        }

        res.json(Object.assign({ fromCache: false }, payload));
    } catch (err) {
        console.error('Error fetching dashboard metrics:', err);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// Endpoint to inspect cache key and value for this shopkeeper (for demo/debug)
router.get('/dashboard/metrics/cache', auth, isShopkeeper, async (req, res) => {
    try {
        const shopkeeperId = req.user.id;
        const cacheKey = `shopkeeper:${shopkeeperId}:dashboard_metrics`;

        try {
            if (!redisCache.client.isOpen) await redisCache.connect();
        } catch (e) {
            console.warn('Redis cache not available');
        }

        const exists = await redisCache.exists(cacheKey);
        const value = exists ? await redisCache.get(cacheKey) : null;
        let ttl = null;
        try {
            if (redisCache.client.isOpen) ttl = await redisCache.client.ttl(cacheKey);
        } catch (e) {
            // ignore
        }

        res.json({ key: cacheKey, exists, ttl, value });
    } catch (err) {
        console.error('Error fetching cache info:', err);
        res.status(500).json({ error: 'Failed to fetch cache info' });
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
        const productId = parseInt(req.params.id, 10);
        if (Number.isNaN(productId)) {
            return res.render('error', { message: 'Invalid product id' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create backup table (if not exists) and copy referencing order_items
            const backupTable = `backup_order_items_product_${productId}`;
            // create table structure if not exists
            await client.query(`CREATE TABLE IF NOT EXISTS ${backupTable} (LIKE order_items INCLUDING ALL)`);
            // insert referencing rows into backup
            const insertRes = await client.query(
                `INSERT INTO ${backupTable} SELECT * FROM order_items WHERE product_id = $1 RETURNING *`,
                [productId]
            );

            // delete referencing order_items
            const delOrderItemsRes = await client.query(
                'DELETE FROM order_items WHERE product_id = $1',
                [productId]
            );

            // delete product (restrict to shopkeeper)
            const delProductRes = await client.query(
                'DELETE FROM products WHERE id = $1 AND shopkeeper_id = $2 RETURNING *',
                [productId, req.user.id]
            );

            if (delProductRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.render('error', { message: 'Product not found or you do not have permission to delete it' });
            }

            await client.query('COMMIT');

            // Invalidate cache for shopkeeper dashboard metrics
            try {
                const cacheKey = `shopkeeper:${req.user.id}:dashboard_metrics`;
                if (redisCache && redisCache.client && redisCache.client.isOpen) {
                    await redisCache.del(cacheKey);
                }
            } catch (e) {
                console.warn('Failed to invalidate redis cache after product delete:', e.message || e);
            }

            // Redirect to dashboard with success flag
            return res.redirect('/shopkeeper/dashboard?deleted=1');
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error deleting product:', err);
        res.render('error', { message: 'Error deleting product: ' + err.message });
    }
});

module.exports = router;