const express = require('express');
const router = express.Router();
const { auth, isShopkeeper } = require('../middleware/auth');
const path = require('path');
const bcrypt = require('bcrypt');

// Centralized database connection
const pool = require('../utils/database');

// Redis cache utility
const redisCache = require('../utils/redis');

// Image URL utility functions
const { validateImageUrl, convertGoogleDriveLink } = require('../utils/imageDownloader');

// Helper function to log admin actions
async function logAdminAction(adminId, action, targetType, targetId, details, pool) {
    try {
        await pool.query(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
            [adminId, action, targetType, targetId, details]
        );
    } catch (err) {
        console.error('Failed to log admin action:', err);
    }
}

// Admin/Shopkeeper dashboard with real statistics
router.get('/dashboard', auth, isShopkeeper, async (req, res) => {
    try {
        // Get products for this shopkeeper
        const productsResult = await pool.query(
            'SELECT * FROM products WHERE shopkeeper_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        
        // Get real dashboard statistics
        const statsQueries = await Promise.all([
            // Total users count
            pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['user']),
            // Total products count
            pool.query('SELECT COUNT(*) as count FROM products'),
            // Total orders count
            pool.query('SELECT COUNT(*) as count FROM orders'),
            // Total revenue
            pool.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status != $1', ['cancelled']),
            // Pending orders
            pool.query('SELECT COUNT(*) as count FROM orders WHERE status = $1', ['pending']),
            // New users this month
            pool.query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE) AND role = $1', ['user']),
            // Orders this month
            pool.query('SELECT COUNT(*) as count FROM orders WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE)'),
            // Revenue this month
            pool.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE) AND status != $1', ['cancelled'])
        ]);

        const stats = {
            totalUsers: parseInt(statsQueries[0].rows[0].count),
            totalProducts: parseInt(statsQueries[1].rows[0].count),
            totalOrders: parseInt(statsQueries[2].rows[0].count),
            totalRevenue: parseFloat(statsQueries[3].rows[0].revenue),
            pendingOrders: parseInt(statsQueries[4].rows[0].count),
            newUsersThisMonth: parseInt(statsQueries[5].rows[0].count),
            ordersThisMonth: parseInt(statsQueries[6].rows[0].count),
            revenueThisMonth: parseFloat(statsQueries[7].rows[0].revenue)
        };

        // Get recent activities for dashboard
        const recentActivities = await pool.query(`
            (SELECT 'order' as type, o.id, u.username as user_name, o.total_amount as amount, o.created_at, o.status
             FROM orders o 
             JOIN users u ON o.user_id = u.id 
             ORDER BY o.created_at DESC 
             LIMIT 5)
            UNION ALL
            (SELECT 'user' as type, u.id, u.username as user_name, 0 as amount, u.created_at, 'registered' as status
             FROM users u 
             WHERE u.role = 'user' 
             ORDER BY u.created_at DESC 
             LIMIT 3)
            ORDER BY created_at DESC
            LIMIT 8
        `);

        res.render('shopkeeper/dashboard', { 
            products: productsResult.rows,
            stats: stats,
            recentActivities: recentActivities.rows,
            user: req.user
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('error', { message: 'Error loading dashboard: ' + err.message });
    }
});

// Real-time metrics for dashboard (shopkeeper-specific)
router.get('/dashboard/metrics', auth, isShopkeeper, async (req, res) => {
    try {
        const shopkeeperId = req.user.id;

        // ensure redis client is connected (best-effort)
        try {
            if (!redisCache.client.isOpen) {
                console.log('🔄 Connecting to Redis for dashboard metrics...');
                await redisCache.connect();
            }
        } catch (e) {
            console.warn('⚠️ Redis cache not available, continuing without cache:', e.message);
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
            console.log('💾 Storing dashboard metrics in cache:', cacheKey);
            const setResult = await redisCache.set(cacheKey, payload, 10); // 10 seconds
            if (setResult) {
                console.log('✅ Dashboard metrics cached successfully');
            } else {
                console.log('❌ Failed to cache dashboard metrics');
            }
        } catch (e) {
            console.warn('❌ Redis SET failed:', e.message || e);
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

        // Get debug info
        const debugInfo = await redisCache.getDebugInfo();

        res.json({ 
            key: cacheKey, 
            exists, 
            ttl, 
            value,
            redisDebug: debugInfo
        });
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
router.post('/add-product', auth, isShopkeeper, async (req, res) => {
    try {
        const { name, description, price, stock_quantity, image_url } = req.body;
        
        // Validate required fields
        if (!name || !description || !price || stock_quantity === undefined) {
            return res.render('shopkeeper/add-product', { 
                error: 'Name, description, price, and stock quantity are required',
                values: { name, description, price, stock_quantity, image_url }
            });
        }
        
        let processedImageUrl = null;
        
        // Process image URL if provided
        if (image_url && image_url.trim()) {
            const validation = validateImageUrl(image_url.trim());
            
            if (!validation.valid) {
                return res.render('shopkeeper/add-product', { 
                    error: validation.error,
                    values: { name, description, price, stock_quantity, image_url }
                });
            }
            
            // Convert Google Drive links to direct URLs for better compatibility
            processedImageUrl = convertGoogleDriveLink(image_url.trim());
            console.log('Using image URL directly:', processedImageUrl);
        }

        await pool.query(
            'INSERT INTO products (name, description, price, stock_quantity, image_url, shopkeeper_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, description, price, parseInt(stock_quantity) || 0, processedImageUrl, req.user.id]
        );

        res.redirect('/shopkeeper/dashboard');
    } catch (err) {
        console.error('Add product error:', err);
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
router.post('/edit-product/:id', auth, isShopkeeper, async (req, res) => {
    try {
        const { name, description, price, stock_quantity, image_url, keep_existing_image } = req.body;
        
        let processedImageUrl = req.body.existing_image; // Keep existing by default
        
        // If new image URL is provided and we're not keeping existing
        if (image_url && image_url.trim() && !keep_existing_image) {
            const validation = validateImageUrl(image_url.trim());
            
            if (!validation.valid) {
                return res.render('shopkeeper/edit-product', { 
                    product: { id: req.params.id, name, description, price, image_url: req.body.existing_image },
                    error: validation.error
                });
            }
            
            // Convert Google Drive links to direct URLs for better compatibility
            processedImageUrl = convertGoogleDriveLink(image_url.trim());
            console.log('Using new image URL directly:', processedImageUrl);
        }

        await pool.query(
            'UPDATE products SET name = $1, description = $2, price = $3, stock_quantity = $4, image_url = $5 WHERE id = $6 AND shopkeeper_id = $7',
            [name, description, price, parseInt(stock_quantity) || 0, processedImageUrl, req.params.id, req.user.id]
        );

        res.redirect('/shopkeeper/dashboard');
    } catch (err) {
        console.error('Update product error:', err);
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

// ===== ADMIN MANAGEMENT ENDPOINTS =====

// User Management
router.get('/admin/users', auth, isShopkeeper, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        let whereClause = "WHERE role = 'user'";
        let params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status !== 'all') {
            if (status === 'banned') {
                whereClause += ` AND is_banned = true`;
            } else if (status === 'active') {
                whereClause += ` AND (is_banned = false OR is_banned IS NULL)`;
            }
        }

        const usersResult = await pool.query(`
            SELECT id, name, email, created_at, is_banned, banned_at, ban_reason,
                   (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count,
                   (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = users.id AND status != 'cancelled') as total_spent
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM users ${whereClause}
        `, params);

        const totalUsers = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            success: true,
            users: usersResult.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalUsers: totalUsers
            }
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// Get user details
router.get('/admin/users/:id', auth, isShopkeeper, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const userResult = await pool.query(`
            SELECT u.id, u.username as name, u.email, u.created_at, u.is_banned, u.banned_at, u.ban_reason,
                   COUNT(DISTINCT o.id) as order_count,
                   COALESCE(SUM(o.total_amount), 0) as total_spent,
                   COUNT(DISTINCT r.id) as review_count
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id AND o.status != 'cancelled'
            LEFT JOIN reviews r ON u.id = r.user_id
            WHERE u.id = $1 AND u.role = 'user'
            GROUP BY u.id, u.username, u.email, u.created_at, u.is_banned, u.banned_at, u.ban_reason
        `, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get recent orders
        const ordersResult = await pool.query(`
            SELECT id, total_amount, status, created_at
            FROM orders 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 10
        `, [userId]);

        res.json({
            success: true,
            user: userResult.rows[0],
            recentOrders: ordersResult.rows
        });
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch user details' });
    }
});

// Ban/unban user
router.post('/admin/users/:id/ban', auth, isShopkeeper, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = parseInt(req.params.id);
        const { ban, reason } = req.body;
        
        await client.query('BEGIN');
        
        if (ban) {
            await client.query(
                'UPDATE users SET is_banned = true, banned_at = CURRENT_TIMESTAMP, banned_by = $1, ban_reason = $2 WHERE id = $3',
                [req.user.id, reason, userId]
            );
            await logAdminAction(req.user.id, 'ban_user', 'user', userId, reason, client);
        } else {
            await client.query(
                'UPDATE users SET is_banned = false, banned_at = NULL, banned_by = NULL, ban_reason = NULL WHERE id = $1',
                [userId]
            );
            await logAdminAction(req.user.id, 'unban_user', 'user', userId, 'User unbanned', client);
        }
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: ban ? 'User banned successfully' : 'User unbanned successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating user ban status:', err);
        res.status(500).json({ success: false, error: 'Failed to update user status' });
    } finally {
        client.release();
    }
});

// Delete user
router.delete('/admin/users/:id', auth, isShopkeeper, async (req, res) => {
    const client = await pool.connect();
    try {
        const userId = parseInt(req.params.id);
        
        await client.query('BEGIN');
        
        // Check if user has active orders
        const activeOrders = await client.query(
            'SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status NOT IN ($2, $3, $4)',
            [userId, 'delivered', 'cancelled', 'refunded']
        );
        
        if (parseInt(activeOrders.rows[0].count) > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete user with active orders' 
            });
        }
        
        await client.query('DELETE FROM users WHERE id = $1 AND role = $2', [userId, 'user']);
        await logAdminAction(req.user.id, 'delete_user', 'user', userId, 'User account deleted', client);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting user:', err);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    } finally {
        client.release();
    }
});

// Product Management
router.get('/admin/products', auth, isShopkeeper, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        let whereClause = "WHERE 1=1";
        let params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (status !== 'all') {
            whereClause += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const productsResult = await pool.query(`
            SELECT p.id, p.name, p.description, p.price, p.image_url, p.status, p.created_at,
                   u.username as shopkeeper_name, u.email as shopkeeper_email,
                   (SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = p.id AND o.status != 'cancelled') as sales_count,
                   (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating
            FROM products p
            JOIN users u ON p.shopkeeper_id = u.id
            ${whereClause}
            ORDER BY p.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM products p ${whereClause}
        `, params);

        res.json({
            success: true,
            products: productsResult.rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
                totalProducts: parseInt(countResult.rows[0].count)
            }
        });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

// Update product status
router.put('/admin/products/:id/status', auth, isShopkeeper, async (req, res) => {
    const client = await pool.connect();
    try {
        const productId = parseInt(req.params.id);
        const { status } = req.body;
        
        const validStatuses = ['active', 'pending', 'rejected', 'suspended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        
        await client.query('BEGIN');
        
        await client.query(
            'UPDATE products SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
            [status, req.user.id, productId]
        );
        
        await logAdminAction(req.user.id, 'update_product_status', 'product', productId, `Status changed to ${status}`, client);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Product status updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating product status:', err);
        res.status(500).json({ success: false, error: 'Failed to update product status' });
    } finally {
        client.release();
    }
});

// Order Management
router.get('/admin/orders', auth, isShopkeeper, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const status = req.query.status || 'all';

        let whereClause = "WHERE 1=1";
        let params = [];
        let paramIndex = 1;

        if (status !== 'all') {
            whereClause += ` AND o.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        const ordersResult = await pool.query(`
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   u.username as user_name, u.email as user_email,
                   COUNT(oi.id) as item_count
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            ${whereClause}
            GROUP BY o.id, o.total_amount, o.status, o.created_at, u.username, u.email
            ORDER BY o.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const countResult = await pool.query(`
            SELECT COUNT(*) FROM orders o ${whereClause}
        `, params);

        res.json({
            success: true,
            orders: ordersResult.rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
                totalOrders: parseInt(countResult.rows[0].count)
            }
        });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// Get order details for admin
router.get('/admin/orders/:id', auth, isShopkeeper, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        const orderResult = await pool.query(`
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   u.username as user_name, u.email as user_email,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'name', p.name,
                               'quantity', oi.quantity,
                               'price', oi.price,
                               'id', p.id,
                               'image_url', p.image_url
                           )
                       ) FILTER (WHERE oi.id IS NOT NULL),
                       '[]'::json
                   ) as items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.id = $1
            GROUP BY o.id, o.total_amount, o.status, o.created_at, u.username, u.email
        `, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        res.json({ success: true, order: orderResult.rows[0] });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch order details' });
    }
});

// Update order status (admin)
router.put('/admin/orders/:id/status', auth, isShopkeeper, async (req, res) => {
    const client = await pool.connect();
    try {
        const orderId = parseInt(req.params.id);
        const { status, location, description } = req.body;
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        
        await client.query('BEGIN');
        
        // Get current status
        const currentResult = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const oldStatus = currentResult.rows[0].status;
        
        // Update order status
        await client.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
        
        // Add to status history
        await client.query(
            'INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason) VALUES ($1, $2, $3, $4, $5)',
            [orderId, oldStatus, status, req.user.id, `Status updated by admin`]
        );
        
        // Add tracking information if provided
        if (location || description) {
            await client.query(
                'INSERT INTO order_tracking (order_id, status, location, description) VALUES ($1, $2, $3, $4)',
                [orderId, status, location, description]
            );
        }
        
        await logAdminAction(req.user.id, 'update_order_status', 'order', orderId, `Status: ${oldStatus} → ${status}`, client);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating order status:', err);
        res.status(500).json({ success: false, error: 'Failed to update order status' });
    } finally {
        client.release();
    }
});

// Reviews Management
router.get('/admin/reviews', auth, isShopkeeper, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        const reviewsResult = await pool.query(`
            SELECT r.id, r.rating, r.comment, r.created_at,
                   u.username as user_name, u.email as user_email,
                   p.name as product_name, p.id as product_id
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const countResult = await pool.query('SELECT COUNT(*) FROM reviews');

        res.json({
            success: true,
            reviews: reviewsResult.rows,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
                totalReviews: parseInt(countResult.rows[0].count)
            }
        });
    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
    }
});

// Delete review
router.delete('/admin/reviews/:id', auth, isShopkeeper, async (req, res) => {
    const client = await pool.connect();
    try {
        const reviewId = parseInt(req.params.id);
        
        await client.query('BEGIN');
        
        await client.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
        await logAdminAction(req.user.id, 'delete_review', 'review', reviewId, 'Review deleted by admin', client);
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting review:', err);
        res.status(500).json({ success: false, error: 'Failed to delete review' });
    } finally {
        client.release();
    }
});

// Reports and Analytics
router.get('/admin/reports/sales', auth, isShopkeeper, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        let dateFilter;
        switch (period) {
            case 'week':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case 'month':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            case 'year':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '365 days'";
                break;
            default:
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
        }

        const salesData = await pool.query(`
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as order_count,
                SUM(total_amount) as revenue
            FROM orders 
            WHERE ${dateFilter} AND status != 'cancelled'
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY date
        `);

        const topProducts = await pool.query(`
            SELECT 
                p.name,
                p.id,
                SUM(oi.quantity) as total_sold,
                SUM(oi.quantity * oi.price) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.${dateFilter} AND o.status != 'cancelled'
            GROUP BY p.id, p.name
            ORDER BY total_sold DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            salesData: salesData.rows,
            topProducts: topProducts.rows
        });
    } catch (err) {
        console.error('Error generating sales report:', err);
        res.status(500).json({ success: false, error: 'Failed to generate sales report' });
    }
});

// User analytics
router.get('/admin/reports/users', auth, isShopkeeper, async (req, res) => {
    try {
        const userStats = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_month,
                COUNT(*) FILTER (WHERE is_banned = true) as banned_users,
                COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN u.id END) as users_with_orders
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.role = 'user'
        `);

        const userGrowth = await pool.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as new_users
            FROM users 
            WHERE role = 'user' AND created_at >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `);

        res.json({
            success: true,
            userStats: userStats.rows[0],
            userGrowth: userGrowth.rows
        });
    } catch (err) {
        console.error('Error generating user analytics:', err);
        res.status(500).json({ success: false, error: 'Failed to generate user analytics' });
    }
});

// Export data
router.get('/admin/export/:type', auth, isShopkeeper, async (req, res) => {
    try {
        const { type } = req.params;
        const { format = 'csv' } = req.query;

        let data = [];
        let filename = '';

        switch (type) {
            case 'users':
                const usersResult = await pool.query(`
                    SELECT id, name, email, created_at, is_banned,
                           (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
                    FROM users WHERE role = 'user' ORDER BY created_at DESC
                `);
                data = usersResult.rows;
                filename = 'users_export.csv';
                break;
            
            case 'orders':
                const ordersResult = await pool.query(`
                    SELECT o.id, o.total_amount, o.status, o.created_at,
                           u.username as user_name, u.email as user_email
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    ORDER BY o.created_at DESC
                `);
                data = ordersResult.rows;
                filename = 'orders_export.csv';
                break;
            
            case 'products':
                const productsResult = await pool.query(`
                    SELECT p.id, p.name, p.description, p.price, p.status, p.created_at,
                           u.username as shopkeeper_name
                    FROM products p
                    JOIN users u ON p.shopkeeper_id = u.id
                    ORDER BY p.created_at DESC
                `);
                data = productsResult.rows;
                filename = 'products_export.csv';
                break;
            
            default:
                return res.status(400).json({ success: false, error: 'Invalid export type' });
        }

        if (format === 'csv') {
            const csv = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csv);
        } else {
            res.json({ success: true, data: data });
        }

        await logAdminAction(req.user.id, 'export_data', type, null, `Exported ${data.length} ${type} records`, pool);
    } catch (err) {
        console.error('Error exporting data:', err);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

// Dashboard Stats API - Real-time statistics
router.get('/api/dashboard-stats', auth, isShopkeeper, async (req, res) => {
    try {
        const statsQueries = await Promise.all([
            // Total users count
            pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['user']),
            // Total products count
            pool.query('SELECT COUNT(*) as count FROM products'),
            // Total orders count
            pool.query('SELECT COUNT(*) as count FROM orders'),
            // Total revenue
            pool.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE status != $1', ['cancelled']),
            // New users this month
            pool.query('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE) AND role = $1', ['user']),
            // Orders this month
            pool.query('SELECT COUNT(*) as count FROM orders WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE)'),
            // Revenue this month
            pool.query('SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE) AND status != $1', ['cancelled'])
        ]);

        const stats = {
            totalUsers: parseInt(statsQueries[0].rows[0].count),
            totalProducts: parseInt(statsQueries[1].rows[0].count),
            totalOrders: parseInt(statsQueries[2].rows[0].count),
            totalRevenue: parseFloat(statsQueries[3].rows[0].revenue),
            newUsersThisMonth: parseInt(statsQueries[4].rows[0].count),
            ordersThisMonth: parseInt(statsQueries[5].rows[0].count),
            revenueThisMonth: parseFloat(statsQueries[6].rows[0].revenue)
        };

        res.json({ success: true, data: stats });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
    }
});

// Sales Chart Data API - Monthly sales data for chart
router.get('/api/sales-chart-data', auth, isShopkeeper, async (req, res) => {
    try {
        // Get monthly sales data for the last 12 months
        const salesData = await pool.query(`
            SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
                COALESCE(SUM(total_amount), 0) as total_sales
            FROM orders 
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
                AND status != 'cancelled'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        `);

        const labels = [];
        const data = [];
        
        // Create labels for last 12 months and fill data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        
        for (let i = 0; i < 12; i++) {
            const monthIndex = (currentMonth - 11 + i + 12) % 12;
            labels.push(monthNames[monthIndex]);
        }

        // Fill data array with actual sales or 0
        const salesMap = {};
        salesData.rows.forEach(row => {
            salesMap[row.month] = parseFloat(row.total_sales);
        });

        labels.forEach(month => {
            data.push(salesMap[month] || 0);
        });

        res.json({ 
            success: true, 
            labels: labels.slice(-6), // Show last 6 months
            data: data.slice(-6)
        });
    } catch (err) {
        console.error('Error fetching sales chart data:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
    }
});

// Category Chart Data API - Product category distribution
router.get('/api/category-chart-data', auth, isShopkeeper, async (req, res) => {
    try {
        // Get product count by category
        const categoryData = await pool.query(`
            SELECT 
                category,
                COUNT(*) as product_count
            FROM products 
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category
            ORDER BY product_count DESC
            LIMIT 6
        `);

        if (categoryData.rows.length === 0) {
            return res.json({
                success: true,
                labels: ['No Categories'],
                data: [1],
                backgroundColor: ['#cccccc']
            });
        }

        const labels = categoryData.rows.map(row => row.category);
        const data = categoryData.rows.map(row => parseInt(row.product_count));
        const backgroundColor = [
            '#4a90e2',
            '#5c6ac4', 
            '#00c853',
            '#ff6b35',
            '#f39c12',
            '#e74c3c'
        ];

        res.json({ 
            success: true, 
            labels: labels,
            data: data,
            backgroundColor: backgroundColor.slice(0, labels.length)
        });
    } catch (err) {
        console.error('Error fetching category chart data:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch category data' });
    }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',');
    });
    
    return csvHeaders + '\n' + csvRows.join('\n');
}

module.exports = router;