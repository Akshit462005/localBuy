const express = require('express');
const router = express.Router();

// Middleware for API authentication
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Get user cart data
router.get('/cart', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        // This would typically fetch from database
        // For now, return empty cart structure
        res.json({
            success: true,
            cart: {
                items: [],
                total: 0,
                count: 0
            }
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

// Add item to cart
router.post('/cart/add', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { productId, quantity = 1 } = req.body;
        
        if (!productId) {
            return res.status(400).json({ error: 'Product ID required' });
        }
        
        // This would typically add to database
        // For now, return success response
        res.json({
            success: true,
            message: 'Item added to cart',
            cart: {
                items: [{ productId, quantity }],
                total: 0,
                count: 1
            }
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ error: 'Failed to add item to cart' });
    }
});

// Update cart item
router.put('/cart/update', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { productId, quantity } = req.body;
        
        if (!productId || quantity < 0) {
            return res.status(400).json({ error: 'Valid product ID and quantity required' });
        }
        
        // This would typically update database
        res.json({
            success: true,
            message: 'Cart updated',
            cart: {
                items: [{ productId, quantity }],
                total: 0,
                count: quantity > 0 ? 1 : 0
            }
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// Remove item from cart
router.delete('/cart/remove/:productId', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { productId } = req.params;
        
        // This would typically remove from database
        res.json({
            success: true,
            message: 'Item removed from cart',
            cart: {
                items: [],
                total: 0,
                count: 0
            }
        });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ error: 'Failed to remove item from cart' });
    }
});

// Get user preferences
router.get('/preferences', requireAuth, (req, res) => {
    try {
        const preferences = req.session.preferences || {
            theme: 'light',
            viewMode: 'grid',
            notifications: true,
            autoSave: true
        };
        
        res.json({
            success: true,
            preferences
        });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

// Update user preferences
router.post('/preferences', requireAuth, (req, res) => {
    try {
        const { theme, viewMode, notifications, autoSave } = req.body;
        
        req.session.preferences = {
            ...req.session.preferences,
            theme,
            viewMode,
            notifications,
            autoSave
        };
        
        res.json({
            success: true,
            message: 'Preferences updated',
            preferences: req.session.preferences
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// Get user session data
router.get('/session', (req, res) => {
    try {
        const sessionData = {
            user: req.session.user || null,
            isAuthenticated: !!req.session.user,
            theme: req.session.theme || 'light',
            preferences: req.session.preferences || {}
        };
        
        res.json({
            success: true,
            session: sessionData
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session data' });
    }
});

// Sync cache data with server
router.post('/sync', requireAuth, async (req, res) => {
    try {
        const { cartData, preferences, recentlyViewed } = req.body;
        const userId = req.session.user.id;
        
        // Update session with synced data
        if (preferences) {
            req.session.preferences = { ...req.session.preferences, ...preferences };
        }
        
        // This would typically sync with database
        // For now, just acknowledge the sync
        res.json({
            success: true,
            message: 'Data synced successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error syncing data:', error);
        res.status(500).json({ error: 'Failed to sync data' });
    }
});

// Get product details for cache
router.get('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // This would typically fetch from database
        // For now, return basic product structure
        res.json({
            success: true,
            product: {
                id: parseInt(id),
                name: `Product ${id}`,
                price: 99.99,
                description: `Description for product ${id}`,
                image_url: null,
                shopkeeper_name: 'Sample Shop',
                in_stock: true
            }
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// Search products with caching hints
router.get('/search', async (req, res) => {
    try {
        const { q: query, limit = 20, offset = 0 } = req.query;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        
        // This would typically search database
        // For now, return empty results
        res.json({
            success: true,
            query: query.trim(),
            results: [],
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            cached: false,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Health check for cache system
router.get('/health', (req, res) => {
    res.json({
        success: true,
        cache: {
            enabled: true,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        },
        session: {
            active: !!req.session.user,
            id: req.session.id
        }
    });
});

module.exports = router;