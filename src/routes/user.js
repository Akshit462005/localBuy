const express = require('express');
const router = express.Router();
const { auth, isUser } = require('../middleware/auth');

// Centralized database connection
const pool = require('../utils/database');

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
        
        const result = await pool.query(`
            SELECT p.*, u.username as shopkeeper_name 
            FROM products p 
            LEFT JOIN users u ON p.shopkeeper_id = u.id 
            WHERE p.id = $1
        `, [productId]);
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
            // Ensure existing item has complete info
            if (!cartItem.image_url) cartItem.image_url = product.image_url;
            if (!cartItem.description) cartItem.description = product.description;
            if (!cartItem.shopkeeper_name) {
                const shopkeeperResult = await pool.query('SELECT username FROM users WHERE id = $1', [product.user_id]);
                cartItem.shopkeeper_name = shopkeeperResult.rows[0]?.username || 'Unknown Seller';
            }
            console.log('📈 Updated existing cart item with complete info:', cartItem.quantity);
        } else {
            // Get shopkeeper information
            const shopkeeperResult = await pool.query('SELECT username FROM users WHERE id = $1', [product.user_id]);
            const shopkeeperName = shopkeeperResult.rows[0]?.username || 'Unknown Seller';
            
            req.session.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image_url: product.image_url,
                description: product.description,
                shopkeeper_name: shopkeeperName
            });
            console.log('➕ Added new item to cart with complete info');
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
        
        // Enrich cart items with complete product data if missing
        if (cart.length > 0) {
            console.log('🔍 Enriching session cart with product data...');
            const enrichedCart = [];
            
            for (const item of cart) {
                // Check if item has complete data (image_url and description)
                if (!item.image_url || !item.description) {
                    console.log(`📝 Enriching item ${item.id} with missing data`);
                    const productResult = await pool.query(
                        'SELECT id, name, price, image_url, description FROM products WHERE id = $1',
                        [item.id]
                    );
                    
                    if (productResult.rows.length > 0) {
                        const product = productResult.rows[0];
                        enrichedCart.push({
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            quantity: item.quantity,
                            image_url: product.image_url,
                            description: product.description
                        });
                    } else {
                        // Product doesn't exist anymore, skip it
                        console.warn(`⚠️ Product ${item.id} not found, removing from cart`);
                    }
                } else {
                    // Item has complete data, keep as is
                    enrichedCart.push(item);
                }
            }
            
            cart = enrichedCart;
            // Update session with enriched data
            req.session.cart = cart;
        }
        
        // If session cart is still empty, try database fallback
        if (cart.length === 0) {
            console.log('⚠️ Session cart empty, checking database');
            const dbCartResult = await pool.query(`
                SELECT c.quantity, p.id, p.name, p.price, p.image_url, p.description,
                       u.username as shopkeeper_name
                FROM cart c 
                JOIN products p ON c.product_id = p.id 
                LEFT JOIN users u ON p.shopkeeper_id = u.id
                WHERE c.user_id = $1
            `, [req.user.id]);
            
            cart = dbCartResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                price: row.price,
                quantity: row.quantity,
                image_url: row.image_url,
                description: row.description,
                shopkeeper_name: row.shopkeeper_name
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

// Clear entire cart
router.post('/clear-cart', auth, isUser, async (req, res) => {
    try {
        console.log('🗑️ Clearing entire cart for user:', req.user.id);
        
        // Clear session cart
        req.session.cart = [];
        
        // Clear database cart
        await pool.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
        
        // Save session with timestamp
        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log('✅ Cart cleared successfully');
        res.json({ 
            success: true, 
            message: 'Cart cleared successfully',
            cart: { items: [], total: 0, count: 0, lastUpdated: Date.now() }
        });
    } catch (err) {
        console.error('❌ Clear cart error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to clear cart' 
        });
    }
});

// Enhanced Checkout with proper order management
router.post('/checkout', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('🛒 Enhanced checkout started for user:', req.user.id);
        console.log('🛒 Request body:', req.body);
        
        await client.query('BEGIN');
        
        // Get shipping and payment details from request
        const { 
            shippingAddress, 
            city, 
            postalCode, 
            phone,
            paymentMethod = 'cod' 
        } = req.body;
        
        // Try to get cart from session first, then fallback to database
        let cart = req.session.cart || [];
        
        // If session cart is empty, try to get from database as fallback
        if (cart.length === 0) {
            console.log('⚠️ Session cart empty, checking database cart');
            const dbCartResult = await client.query(`
                SELECT c.quantity, p.id, p.name, p.price, p.image_url, p.description, p.stock_quantity
                FROM cart c 
                JOIN products p ON c.product_id = p.id 
                WHERE c.user_id = $1 AND p.is_active = true
            `, [req.user.id]);
            
            cart = dbCartResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                price: row.price,
                quantity: row.quantity,
                image_url: row.image_url,
                description: row.description,
                stock_quantity: row.stock_quantity
            }));
            
            console.log('🛒 Retrieved cart from database:', cart.length, 'items');
        }
        
        if (cart.length === 0) {
            console.log('❌ Cart is empty in both session and database');
            throw new Error('Your cart is empty. Please add items before checkout.');
        }

        // Validate inventory for each item
        const inventoryChecks = [];
        for (const item of cart) {
            const stockResult = await client.query(
                'SELECT stock_quantity, is_active FROM products WHERE id = $1',
                [item.id]
            );
            
            if (stockResult.rows.length === 0 || !stockResult.rows[0].is_active) {
                throw new Error(`Product "${item.name}" is no longer available`);
            }
            
            const availableStock = stockResult.rows[0].stock_quantity;
            if (availableStock < item.quantity) {
                throw new Error(`Insufficient stock for "${item.name}". Available: ${availableStock}, Requested: ${item.quantity}`);
            }
            
            inventoryChecks.push({
                productId: item.id,
                requiredQuantity: item.quantity,
                availableStock: availableStock
            });
        }

        const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        console.log('💰 Order total calculated:', total.toFixed(2));
        
        // Create order with status and shipping info
        const orderResult = await client.query(`
            INSERT INTO orders (user_id, total_amount, status, shipping_address, city, postal_code, phone, payment_method) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING id
        `, [req.user.id, total, 'pending', shippingAddress, city, postalCode, phone, paymentMethod]);
        
        const orderId = orderResult.rows[0].id;
        console.log('📋 Order created with ID:', orderId);
        
        // Create initial order status history
        await client.query(
            'INSERT INTO order_status_history (order_id, new_status, changed_by, reason) VALUES ($1, $2, $3, $4)',
            [orderId, 'pending', req.user.id, 'Order placed by customer']
        );
        
        // Create order tracking entry
        await client.query(
            'INSERT INTO order_tracking (order_id, status, description) VALUES ($1, $2, $3)',
            [orderId, 'Order Placed', 'Your order has been received and is being processed']
        );
        
        // Create order items and update inventory
        for (const item of cart) {
            // Insert order item
            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity, item.price]
            );
            
            // Update product inventory
            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.id]
            );
            
            console.log('➕ Added item to order and updated inventory:', item.name);
        }
        
        // Clear both session and database cart
        await client.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
        console.log('🗑️ Database cart cleared');
        
        await client.query('COMMIT');
        console.log('✅ Enhanced checkout transaction committed');
        
        // Clear session cart and save
        req.session.cart = [];
        
        // Clear localStorage cart via sync manager if available
        if (req.headers['accept']?.includes('application/json')) {
            return res.json({
                success: true,
                orderId: orderId,
                message: 'Order placed successfully',
                redirectUrl: '/user/orders'
            });
        }
        
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error after checkout:', err);
            }
            
            console.log('💾 Session saved after cart clear');
            console.log('🔄 Redirecting to orders page');
            res.redirect('/user/orders');
        });
        
    } catch (err) {
        console.error('❌ Enhanced checkout error:', err);
        await client.query('ROLLBACK');
        
        if (req.headers['accept']?.includes('application/json')) {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }
        
        res.render('error', { message: 'Checkout failed: ' + err.message });
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
        res.render('user/orders', { orders: result.rows, user: req.user });
    } catch (err) {
        console.error('❌ Error fetching orders:', err);
        res.render('error', { message: 'Error fetching orders: ' + err.message });
    }
});

// Get order details (API)
router.get('/orders/:id', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
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
            WHERE o.user_id = $1 AND o.id = $2
            GROUP BY o.id, o.total_amount, o.status, o.created_at
        `, [req.user.id, orderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('❌ Error fetching order details:', err);
        res.status(500).json({ success: false, error: 'Error fetching order details' });
    }
});

// Cancel order
router.delete('/orders/:id/cancel', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        const orderId = parseInt(req.params.id);
        const { reason } = req.body;
        
        await client.query('BEGIN');
        
        // Check if order exists and belongs to user
        const orderResult = await client.query(
            'SELECT status FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const currentStatus = orderResult.rows[0].status;
        
        // Only allow cancellation of pending or processing orders
        if (!['pending', 'processing'].includes(currentStatus)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Order cannot be cancelled at this stage' 
            });
        }
        
        // Update order status to cancelled
        await client.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            ['cancelled', orderId]
        );
        
        // Add to order status history
        await client.query(
            'INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, reason) VALUES ($1, $2, $3, $4, $5)',
            [orderId, currentStatus, 'cancelled', req.user.id, reason || 'Cancelled by customer']
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error cancelling order:', err);
        res.status(500).json({ success: false, error: 'Error cancelling order' });
    } finally {
        client.release();
    }
});

// Track order
router.get('/orders/:id/track', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        // Verify order belongs to user
        const orderCheck = await pool.query(
            'SELECT id FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.id]
        );
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        // Get tracking information
        const trackingResult = await pool.query(`
            SELECT status, location, description, timestamp
            FROM order_tracking 
            WHERE order_id = $1 
            ORDER BY timestamp DESC
        `, [orderId]);
        
        // Get order status history
        const historyResult = await pool.query(`
            SELECT old_status, new_status, reason, created_at
            FROM order_status_history 
            WHERE order_id = $1 
            ORDER BY created_at ASC
        `, [orderId]);
        
        res.json({ 
            success: true, 
            tracking: trackingResult.rows,
            history: historyResult.rows
        });
    } catch (err) {
        console.error('❌ Error tracking order:', err);
        res.status(500).json({ success: false, error: 'Error tracking order' });
    }
});

// Generate invoice
router.get('/orders/:id/invoice', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        const result = await pool.query(`
            SELECT o.id, o.total_amount, o.status, o.created_at,
                   u.name as customer_name, u.email as customer_email,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'name', p.name,
                               'quantity', oi.quantity,
                               'price', oi.price,
                               'total', oi.quantity * oi.price
                           )
                       ) FILTER (WHERE oi.id IS NOT NULL),
                       '[]'::json
                   ) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.user_id = $1 AND o.id = $2
            GROUP BY o.id, o.total_amount, o.status, o.created_at, u.name, u.email
        `, [req.user.id, orderId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const orderData = result.rows[0];
        
        // Generate invoice HTML
        const invoiceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice #${orderData.id}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .header { text-align: center; margin-bottom: 30px; }
                .invoice-details { margin: 20px 0; }
                .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .items-table th { background-color: #f2f2f2; }
                .total { text-align: right; font-weight: bold; font-size: 18px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>LocalBuy Invoice</h1>
                <h2>Order #${orderData.id}</h2>
            </div>
            
            <div class="invoice-details">
                <p><strong>Customer:</strong> ${orderData.customer_name}</p>
                <p><strong>Email:</strong> ${orderData.customer_email}</p>
                <p><strong>Order Date:</strong> ${new Date(orderData.created_at).toLocaleDateString()}</p>
                <p><strong>Status:</strong> ${orderData.status}</p>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderData.items.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.quantity}</td>
                            <td>₹${item.price}</td>
                            <td>₹${item.total}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="total">
                <p>Total Amount: ₹${orderData.total_amount}</p>
            </div>
        </body>
        </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(invoiceHtml);
    } catch (err) {
        console.error('❌ Error generating invoice:', err);
        res.status(500).json({ success: false, error: 'Error generating invoice' });
    }
});

// Submit review
router.post('/orders/:id/review', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        const orderId = parseInt(req.params.id);
        const { productId, rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
        }
        
        await client.query('BEGIN');
        
        // Verify order belongs to user and contains the product
        const orderCheck = await client.query(`
            SELECT o.id 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = $1 AND o.user_id = $2 AND oi.product_id = $3
        `, [orderId, req.user.id, productId]);
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Order not found or does not contain this product' 
            });
        }
        
        // Insert review (unique constraint will prevent duplicates)
        await client.query(
            'INSERT INTO reviews (user_id, product_id, order_id, rating, comment) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, productId, orderId, rating, comment]
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Review submitted successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error submitting review:', err);
        
        if (err.code === '23505') { // Unique violation
            res.status(400).json({ success: false, error: 'You have already reviewed this product' });
        } else {
            res.status(500).json({ success: false, error: 'Error submitting review' });
        }
    } finally {
        client.release();
    }
});

// Update order status (for admin/shopkeeper use)
router.put('/orders/:id/status', auth, isUser, async (req, res) => {
    const client = await pool.connect();
    try {
        const orderId = parseInt(req.params.id);
        const { status, location, description } = req.body;
        
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
            });
        }
        
        await client.query('BEGIN');
        
        // Get current status
        const currentResult = await client.query(
            'SELECT status FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const oldStatus = currentResult.rows[0].status;
        
        // Update order status
        await client.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            [status, orderId]
        );
        
        // Add to status history
        await client.query(
            'INSERT INTO order_status_history (order_id, old_status, new_status, changed_by) VALUES ($1, $2, $3, $4)',
            [orderId, oldStatus, status, req.user.id]
        );
        
        // Add tracking information if provided
        if (location || description) {
            await client.query(
                'INSERT INTO order_tracking (order_id, status, location, description) VALUES ($1, $2, $3, $4)',
                [orderId, status, location, description]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating order status:', err);
        res.status(500).json({ success: false, error: 'Error updating order status' });
    } finally {
        client.release();
    }
});

// Cart API - Get current cart state
router.get('/api/cart', auth, isUser, async (req, res) => {
    try {
        console.log('🛒 API GET cart - Session ID:', req.sessionID);
        
        // Get cart from session
        const sessionCart = req.session.cart || [];
        
        // Try to get cart from database as backup
        let dbCart = [];
        try {
            const dbResult = await pool.query(`
                SELECT c.quantity, c.product_id, p.id, p.name, p.price, p.image_url, p.description, u.username as shopkeeper_name
                FROM cart c 
                JOIN products p ON c.product_id = p.id 
                LEFT JOIN users u ON p.shopkeeper_id = u.id
                WHERE c.user_id = $1
            `, [req.user.id]);
            
            dbCart = dbResult.rows.map(row => ({
                id: row.id,
                name: row.name,
                price: parseFloat(row.price),
                quantity: row.quantity,
                image_url: row.image_url,
                description: row.description,
                shopkeeper_name: row.shopkeeper_name
            }));
        } catch (dbErr) {
            console.warn('Database cart fetch failed:', dbErr);
        }
        
        // Use session cart or database cart, whichever has more items
        const cart = sessionCart.length >= dbCart.length ? sessionCart : dbCart;
        
        const total = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        const cartData = {
            items: cart,
            total: total,
            count: count,
            lastUpdated: Date.now()
        };
        
        console.log('📡 Returning cart data:', cartData);
        res.json({ success: true, cart: cartData });
        
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch cart' });
    }
});

// Cart API - Sync cart from frontend
router.post('/api/cart/sync', auth, isUser, async (req, res) => {
    try {
        const { cart } = req.body;
        console.log('🔄 API cart sync request:', cart);
        
        if (!cart || !Array.isArray(cart.items)) {
            return res.status(400).json({ success: false, error: 'Invalid cart data' });
        }
        
        // Update session cart
        req.session.cart = cart.items;
        
        // Clear existing database cart
        await pool.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
        
        // Insert new cart items to database
        if (cart.items.length > 0) {
            const insertPromises = cart.items.map(item => 
                pool.query(
                    'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)',
                    [req.user.id, item.id, item.quantity]
                )
            );
            
            await Promise.allSettled(insertPromises);
        }
        
        // Save session
        await new Promise((resolve, reject) => {
            req.session.save(err => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log('✅ Cart sync completed');
        res.json({ success: true, message: 'Cart synchronized successfully' });
        
    } catch (error) {
        console.error('Error syncing cart:', error);
        res.status(500).json({ success: false, error: 'Failed to sync cart' });
    }
});

// Public cart count endpoint (works without auth for session-based cart)
router.get('/api/cart/count', (req, res) => {
    try {
        const sessionCart = req.session?.cart || [];
        const count = sessionCart.reduce((sum, item) => sum + (item.quantity || 0), 0);
        
        res.json({ 
            success: true, 
            count: count 
        });
    } catch (error) {
        console.error('Error getting cart count:', error);
        res.json({ 
            success: true, 
            count: 0 
        });
    }
});

// Server-side search API endpoint
router.get('/api/search', auth, isUser, async (req, res) => {
    try {
        const { query, sortBy = 'name', maxPrice, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let baseQuery = `
            SELECT p.*, u.username as shopkeeper_name,
                   COUNT(*) OVER() as total_count
            FROM products p 
            JOIN users u ON p.shopkeeper_id = u.id 
            WHERE 1=1
        `;
        const queryParams = [];
        let paramIndex = 1;

        // Add search filter
        if (query && query.trim()) {
            baseQuery += ` AND (
                LOWER(p.name) LIKE LOWER($${paramIndex}) OR 
                LOWER(p.description) LIKE LOWER($${paramIndex + 1}) OR 
                LOWER(u.username) LIKE LOWER($${paramIndex + 2})
            )`;
            const searchTerm = `%${query.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
            paramIndex += 3;
        }

        // Add price filter
        if (maxPrice && !isNaN(maxPrice)) {
            baseQuery += ` AND p.price <= $${paramIndex}`;
            queryParams.push(parseFloat(maxPrice));
            paramIndex++;
        }

        // Add sorting
        switch(sortBy) {
            case 'name':
                baseQuery += ' ORDER BY p.name ASC';
                break;
            case 'price-low':
                baseQuery += ' ORDER BY p.price ASC';
                break;
            case 'price-high':
                baseQuery += ' ORDER BY p.price DESC';
                break;
            case 'shop':
                baseQuery += ' ORDER BY u.username ASC';
                break;
            default:
                baseQuery += ' ORDER BY p.created_at DESC';
        }

        // Add pagination
        baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(parseInt(limit), offset);

        console.log('🔍 Search Query:', { query, sortBy, maxPrice, page, limit });
        console.log('📝 SQL:', baseQuery);
        console.log('📊 Params:', queryParams);

        const result = await pool.query(baseQuery, queryParams);
        
        const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
        const totalPages = Math.ceil(totalCount / limit);
        
        res.json({
            success: true,
            products: result.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalCount: totalCount,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        console.error('Error searching products:', err);
        res.status(500).json({ success: false, error: 'Error searching products' });
    }
});

// Order Status API - Get order details with tracking
router.get('/api/orders/:id', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        // Get order details with user verification
        const orderResult = await pool.query(`
            SELECT o.*, 
                   u.username as customer_name,
                   u.email as customer_email
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            WHERE o.id = $1 AND o.user_id = $2
        `, [orderId, req.user.id]);
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const order = orderResult.rows[0];
        
        // Get order items
        const itemsResult = await pool.query(`
            SELECT oi.*, p.name, p.image_url, u.username as shopkeeper_name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN users u ON p.shopkeeper_id = u.id
            WHERE oi.order_id = $1
        `, [orderId]);
        
        // Get status history
        const historyResult = await pool.query(`
            SELECT osh.*, u.username as changed_by_name
            FROM order_status_history osh
            LEFT JOIN users u ON osh.changed_by = u.id
            WHERE osh.order_id = $1
            ORDER BY osh.created_at DESC
        `, [orderId]);
        
        // Get tracking information
        const trackingResult = await pool.query(`
            SELECT * FROM order_tracking 
            WHERE order_id = $1 
            ORDER BY timestamp DESC
        `, [orderId]);
        
        res.json({
            success: true,
            order: {
                ...order,
                items: itemsResult.rows,
                statusHistory: historyResult.rows,
                tracking: trackingResult.rows
            }
        });
        
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch order details' });
    }
});

// Order Status Update Notification API
router.post('/api/orders/:id/notify', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { enableNotifications } = req.body;
        
        // In a real app, this would update notification preferences
        // For now, we'll just return success
        console.log(`📧 Order ${orderId} notification settings updated:`, enableNotifications);
        
        res.json({ 
            success: true, 
            message: 'Notification preferences updated successfully' 
        });
        
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
});

// Order Status Progress API - Get estimated delivery and progress
router.get('/api/orders/:id/progress', auth, isUser, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        
        // Verify order belongs to user
        const orderCheck = await pool.query(
            'SELECT status, created_at FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.user.id]
        );
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const order = orderCheck.rows[0];
        const progress = calculateOrderProgress(order.status, order.created_at);
        
        res.json({
            success: true,
            progress: progress
        });
        
    } catch (error) {
        console.error('Error calculating order progress:', error);
        res.status(500).json({ success: false, error: 'Failed to calculate progress' });
    }
});

// Helper function to calculate order progress
function calculateOrderProgress(status, createdAt) {
    const statusSteps = {
        'pending': { step: 1, label: 'Order Placed', percentage: 20 },
        'processing': { step: 2, label: 'Processing', percentage: 40 },
        'shipped': { step: 3, label: 'Shipped', percentage: 70 },
        'delivered': { step: 4, label: 'Delivered', percentage: 100 },
        'cancelled': { step: 0, label: 'Cancelled', percentage: 0 }
    };
    
    const currentStep = statusSteps[status] || statusSteps['pending'];
    const orderDate = new Date(createdAt);
    const estimatedDelivery = new Date(orderDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
    
    return {
        currentStep: currentStep.step,
        currentLabel: currentStep.label,
        percentage: currentStep.percentage,
        estimatedDelivery: estimatedDelivery.toISOString(),
        daysSinceOrder: Math.floor((Date.now() - orderDate.getTime()) / (24 * 60 * 60 * 1000)),
        isCompleted: status === 'delivered',
        isCancelled: status === 'cancelled'
    };
}

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