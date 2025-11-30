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
            if (req.headers['content-type']?.includes('application/json')) {
                return res.status(404).json({ error: 'Product not found' });
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
        
        // Force session save before responding
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Failed to save cart' });
            }
            
            console.log('💾 Cart saved successfully to session:', req.sessionID);
        
            // API response for cache integration
            if (req.headers['content-type']?.includes('application/json') || req.query.format === 'json') {
                const cart = req.session.cart || [];
                const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const count = cart.reduce((sum, item) => sum + item.quantity, 0);
                
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
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(500).json({ error: 'Error adding to cart' });
        }
        res.render('error', { message: 'Error adding to cart' });
    }
});

// View cart with cache support
router.get('/cart', auth, isUser, (req, res) => {
    console.log('🛒 GET /cart - Session ID:', req.sessionID);
    console.log('🛒 GET /cart - Session exists:', !!req.session);
    console.log('🛒 GET /cart - User in session:', req.session?.user?.name || 'No user');
    console.log('🛒 GET /cart - Raw cart data:', req.session.cart);
    
    const cart = req.session.cart || [];
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
});

// Update cart
router.post('/update-cart', auth, isUser, (req, res) => {
    const { productId, quantity } = req.body;
    const cart = req.session.cart || [];
    
    const cartItem = cart.find(item => item.id === parseInt(productId));
    if (cartItem) {
        if (parseInt(quantity) === 0) {
            req.session.cart = cart.filter(item => item.id !== parseInt(productId));
        } else {
            cartItem.quantity = parseInt(quantity);
        }
    }
    
    res.redirect('/user/cart');
});

// Checkout
router.post('/checkout', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const cart = req.session.cart || [];
        if (cart.length === 0) {
            throw new Error('Cart is empty');
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Create order
        const orderResult = await client.query(
            'INSERT INTO orders (user_id, total_amount) VALUES ($1, $2) RETURNING id',
            [req.user.id, total]
        );
        
        const orderId = orderResult.rows[0].id;
        
        // Create order items
        for (const item of cart) {
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity, item.price]
            );
        }
        
        await client.query('COMMIT');
        
        // Clear cart
        req.session.cart = [];
        
        res.redirect('/user/orders');
    } catch (err) {
        await client.query('ROLLBACK');
        res.render('error', { message: 'Error processing order' });
    } finally {
        client.release();
    }
});

// View orders
router.get('/orders', auth, isUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   json_agg(json_build_object(
                       'name', p.name,
                       'quantity', oi.quantity,
                       'price', oi.price
                   )) as items
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.user_id = $1
            GROUP BY o.id
            ORDER BY o.created_at DESC
        `, [req.user.id]);
        
        res.render('user/orders', { orders: result.rows });
    } catch (err) {
        res.render('error', { message: 'Error fetching orders' });
    }
});

module.exports = router;