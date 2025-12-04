const express = require('express');
const router = express.Router();
const { auth, isUser } = require('../middleware/auth');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB,
    ssl: { rejectUnauthorized: false } // Enable SSL for Aiven
});

// User dashboard - Show all products with cache support
router.get('/dashboard', auth, isUser, async (req, res) => {
    try {
        const result = await pool.query('SELECT p.*, u.username as shopkeeper_name FROM products p JOIN users u ON p.shopkeeper_id = u.id');
        
        // Check if user wants cached version
        const useCached = req.query.cached === 'true';
        const templateName = useCached ? 'user/dashboard-cached' : 'user/dashboard';
        
        const viewData = {
            products: result.rows,
            user: req.user,
            cached: useCached,
            timestamp: new Date().toISOString()
        };
        
        res.render(templateName, viewData);
    } catch (err) {
        res.render('error', { message: 'Error fetching products' });
    }
});

// Add to cart with API support
router.post('/add-to-cart', auth, isUser, async (req, res) => {
    try {
        const { productId } = req.body;
        console.log('🛒 Add to cart request:', { productId, userId: req.user?.id, sessionId: req.sessionID });
        
        if (!req.session.cart) {
            req.session.cart = [];
            console.log('📝 Initialized new cart for session:', req.sessionID);
        }
        
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        const product = result.rows[0];
        
        if (!product) {
            console.log('❌ Product not found:', productId);
            if (req.headers['accept']?.includes('application/json') || 
                req.headers['content-type']?.includes('application/json') || 
                req.query.format === 'json') {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Product not found' 
                });
            }
            return res.render('error', { message: 'Product not found' });
        }
        
        console.log('✅ Found product:', { id: product.id, name: product.name, price: product.price });
        
        const cartItem = req.session.cart.find(item => item.id === product.id);
        if (cartItem) {
            cartItem.quantity += 1;
            console.log('📈 Updated existing cart item quantity:', cartItem.quantity);
        } else {
            req.session.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image_url: product.image_url,
                description: product.description
            });
            console.log('➕ Added new item to cart');
        }
        
        console.log('🛒 Current cart contents:', req.session.cart);
        
        // Also save to database for persistence on serverless environments
        pool.query(`
            INSERT INTO cart (user_id, product_id, quantity) 
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, product_id) 
            DO UPDATE SET quantity = cart.quantity + 1
        `, [req.user.id, product.id, 1])
        .then(() => {
            console.log('💾 Cart also saved to database');
        })
        .catch(dbErr => {
            console.error('⚠️ Database cart save failed:', dbErr);
        });
        
        // Force session save before responding
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Failed to save cart' });
            }
            
            console.log('💾 Cart saved successfully to session:', req.sessionID);
        
            // API response for cache integration
            if (req.headers['accept']?.includes('application/json') || 
                req.headers['content-type']?.includes('application/json') || 
                req.query.format === 'json') {
                
                const cart = req.session.cart || [];
                const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const count = cart.reduce((sum, item) => sum + item.quantity, 0);
                
                console.log('📡 Sending JSON response:', { count, total, itemsCount: cart.length });
                
                return res.json({
                    success: true,
                    message: 'Product added to cart',
                    cart: {
                        items: cart,
                        total: total,
                        count: count
                    }
                });
            }
            
            console.log('🔄 Redirecting to cart page');
            res.redirect('/user/cart');
        });
    } catch (err) {
        console.error('❌ Add to cart error:', err);
        if (req.headers['accept']?.includes('application/json') || 
            req.headers['content-type']?.includes('application/json') || 
            req.query.format === 'json') {
            return res.status(500).json({ 
                success: false, 
                error: 'Error adding to cart: ' + err.message 
            });
        }
        res.render('error', { message: 'Error adding to cart: ' + err.message });
    }
});

// View cart with cache support and database fallback
router.get('/cart', auth, isUser, async (req, res) => {
    try {
        console.log('🛒 GET /cart - Session ID:', req.sessionID);
        console.log('🛒 GET /cart - Session exists:', !!req.session);
        console.log('🛒 GET /cart - User in session:', req.session?.user?.name || 'No user');
        console.log('🛒 GET /cart - Raw cart data:', req.session.cart);
        
        let cart = req.session.cart || [];
        
        // If session cart is empty, try database fallback
        if (cart.length === 0) {
            console.log('⚠️ Session cart empty, checking database');
            const dbCartResult = await pool.query(`
                SELECT c.quantity, p.id, p.name, p.price, p.image_url, p.description 
                FROM cart c 
                JOIN products p ON c.product_id = p.id 
                WHERE c.user_id = $1
            `, [req.user.id]);
            
            cart = dbCartResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                price: row.price,
                quantity: row.quantity,
                image_url: row.image_url,
                description: row.description
            }));
            
            // Restore to session if we found items in database
            if (cart.length > 0) {
                req.session.cart = cart;
                console.log('🔄 Restored', cart.length, 'items from database to session');
            }
        }
        
        console.log('🛒 GET /cart - Processed cart:', cart);
        console.log('🛒 GET /cart - Cart items count:', cart.length);
    
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        console.log('🛒 GET /cart - Total calculated:', total);
        console.log('🛒 GET /cart - Count calculated:', count);
        
        // API response for cache integration
        if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
            return res.json({
                success: true,
                cart: {
                    items: cart,
                    total: total,
                    count: count
                }
            });
        }
        
        const viewData = {
            cart,
            total,
            count,
            user: req.user
        };
        
        console.log('🛒 GET /cart - Rendering with data:', viewData);
        res.render('user/cart', viewData);
    } catch (err) {
        console.error('❌ Cart view error:', err);
        res.render('error', { message: 'Error loading cart: ' + err.message });
    }
});

// Update cart
router.post('/update-cart', auth, isUser, async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const cart = req.session.cart || [];
        
        const cartItem = cart.find(item => item.id === parseInt(productId));
        if (cartItem) {
            if (parseInt(quantity) === 0) {
                req.session.cart = cart.filter(item => item.id !== parseInt(productId));
                // Remove from database too
                await pool.query('DELETE FROM cart WHERE user_id = $1 AND product_id = $2', 
                    [req.user.id, parseInt(productId)]);
            } else {
                cartItem.quantity = parseInt(quantity);
                // Update in database too
                await pool.query(`
                    INSERT INTO cart (user_id, product_id, quantity) 
                    VALUES ($1, $2, $3)
                    ON CONFLICT (user_id, product_id) 
                    DO UPDATE SET quantity = $3
                `, [req.user.id, parseInt(productId), parseInt(quantity)]);
            }
        }
        
        res.redirect('/user/cart');
    } catch (err) {
        console.error('❌ Cart update error:', err);
        res.redirect('/user/cart');
    }
});

// Remove item from cart
router.delete('/remove-from-cart/:productId', auth, isUser, async (req, res) => {
    try {
        const { productId } = req.params;
        const cart = req.session.cart || [];
        
        console.log('🗑️ Remove item request:', { productId, userId: req.user.id });
        
        // Remove from session cart
        req.session.cart = cart.filter(item => item.id !== parseInt(productId));
        
        // Remove from database
        await pool.query('DELETE FROM cart WHERE user_id = $1 AND product_id = $2', 
            [req.user.id, parseInt(productId)]);
        
        console.log('✅ Item removed successfully from cart');
        
        // Calculate new totals
        const newCart = req.session.cart || [];
        const total = newCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const count = newCart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({
            success: true,
            message: 'Item removed from cart',
            cart: {
                items: newCart,
                total: total,
                count: count
            }
        });
    } catch (err) {
        console.error('❌ Remove cart item error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to remove item from cart' 
        });
    }
});

// Checkout
router.post('/checkout', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('🛒 Checkout started for user:', req.user.id);
        console.log('🛒 Session cart:', req.session.cart);
        
        await client.query('BEGIN');
        
        // Try to get cart from session first, then fallback to database
        let cart = req.session.cart || [];
        
        // If session cart is empty, try to get from database as fallback
        if (cart.length === 0) {
            console.log('⚠️ Session cart empty, checking database cart');
            const dbCartResult = await client.query(`
                SELECT c.quantity, p.id, p.name, p.price, p.image_url, p.description 
                FROM cart c 
                JOIN products p ON c.product_id = p.id 
                WHERE c.user_id = $1
            `, [req.user.id]);
            
            cart = dbCartResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                price: row.price,
                quantity: row.quantity,
                image_url: row.image_url,
                description: row.description
            }));
            
            console.log('🛒 Retrieved cart from database:', cart.length, 'items');
        }
        
        if (cart.length === 0) {
            console.log('❌ Cart is empty in both session and database');
            throw new Error('Cart is empty');
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        console.log('💰 Order total calculated:', total);
        
        // Create order
        const orderResult = await client.query(
            'INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING id',
            [req.user.id, total]
        );
        
        const orderId = orderResult.rows[0].id;
        console.log('📋 Order created with ID:', orderId);
        
        // Create order items
        for (const item of cart) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity, item.price]
            );
            console.log('➕ Added item to order:', item.name);
        }
        
        // Clear both session and database cart
        await client.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
        console.log('🗑️ Database cart cleared');
        
        await client.query('COMMIT');
        console.log('✅ Database transaction committed');
        
        // Clear session cart and save
        req.session.cart = [];
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error after checkout:', err);
                // Still redirect even if session save fails since DB is cleared
                return res.redirect('/user/orders');
            }
            
            console.log('💾 Session saved after cart clear');
            console.log('🔄 Redirecting to orders page');
            res.redirect('/user/orders');
        });
        
    } catch (err) {
        console.error('❌ Checkout error:', err);
        await client.query('ROLLBACK');
        res.render('error', { message: 'Error processing order: ' + err.message });
    } finally {
        client.release();
    }
});

// View orders
router.get('/orders', auth, isUser, async (req, res) => {
    try {
        console.log('📋 Fetching orders for user:', req.user.id);
        
        const result = await pool.query(`
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'name', p.name,
                               'quantity', oi.quantity,
                               'price', oi.price,
                               'id', p.id,
                               'image_url', p.image_url,
                               'description', p.description
                           )
                       ) FILTER (WHERE oi.id IS NOT NULL),
                       '[]'::json
                   ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = $1
            GROUP BY o.id, o.total_amount, o.status, o.created_at
            ORDER BY o.created_at DESC
        `, [req.user.id]);
        
        console.log('📋 Found orders:', result.rows.length);
        res.render('user/orders', { orders: result.rows });
    } catch (err) {
        console.error('❌ Error fetching orders:', err);
        res.render('error', { message: 'Error fetching orders: ' + err.message });
    }
});

// Debug route for troubleshooting (remove in production)
router.get('/debug-session', auth, isUser, (req, res) => {
    res.json({
        sessionId: req.sessionID,
        userId: req.user?.id,
        userRole: req.user?.role,
        cartItems: req.session.cart?.length || 0,
        hasToken: !!req.session.token,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;