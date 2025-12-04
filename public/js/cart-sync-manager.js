/**
 * Enhanced Cart Synchronization Manager
 * Handles synchronization between localStorage, session, and database
 */

class CartSyncManager {
    constructor() {
        this.localStorageKey = 'localbuy_cart';
        this.syncInProgress = false;
        this.lastSyncTime = 0;
        this.syncInterval = 30000; // 30 seconds
        this.maxRetries = 3;
        
        console.log('🔄 Cart Sync Manager initialized');
        this.init();
    }

    /**
     * Initialize cart synchronization
     */
    async init() {
        try {
            // Load cart from various sources
            const localCart = this.getLocalCart();
            const serverCart = await this.getServerCart();
            
            // Merge and sync carts
            const mergedCart = this.mergeCarts(localCart, serverCart);
            
            // Save merged cart to all locations
            await this.saveCartEverywhere(mergedCart);
            
            // Set up periodic sync
            this.startPeriodicSync();
            
            console.log('✅ Cart synchronization completed');
        } catch (error) {
            console.error('❌ Cart sync initialization failed:', error);
        }
    }

    /**
     * Get cart from localStorage
     */
    getLocalCart() {
        try {
            const cartData = localStorage.getItem(this.localStorageKey);
            if (cartData) {
                const cart = JSON.parse(cartData);
                console.log('📱 Loaded local cart:', cart);
                return cart;
            }
        } catch (error) {
            console.error('Error loading local cart:', error);
        }
        
        return { items: [], total: 0, count: 0, lastUpdated: 0 };
    }

    /**
     * Save cart to localStorage
     */
    saveLocalCart(cart) {
        try {
            cart.lastUpdated = Date.now();
            localStorage.setItem(this.localStorageKey, JSON.stringify(cart));
            console.log('💾 Saved cart to localStorage');
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }



    /**
     * Get cart from server
     */
    async getServerCart() {
        try {
            const response = await fetch('/user/api/cart', {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🌐 Loaded server cart:', data.cart);
                return data.cart || { items: [], total: 0, count: 0, lastUpdated: 0 };
            }
        } catch (error) {
            console.error('Error fetching server cart:', error);
        }
        
        return { items: [], total: 0, count: 0, lastUpdated: 0 };
    }

    /**
     * Save cart to server
     */
    async saveServerCart(cart) {
        try {
            const response = await fetch('/user/api/cart/sync', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ cart: cart })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('🌐 Saved cart to server');
                return data.success;
            }
        } catch (error) {
            console.error('Error saving cart to server:', error);
        }
        
        return false;
    }

    /**
     * Merge carts from different sources
     */
    mergeCarts(localCart, serverCart) {
        console.log('🔀 Merging carts...');
        
        // Only prevent restoration if server cart is empty AND we have a recent clear flag
        // This prevents normal cart sync from being blocked
        try {
            const cartClearedAt = localStorage.getItem('cart_cleared_at');
            if (cartClearedAt && 
                (Date.now() - parseInt(cartClearedAt)) < 120000 && // 2 minutes only
                (!serverCart.items?.length || serverCart.items.length === 0)) {
                console.log('🛑 Cart was recently cleared and server is empty, respecting clear');
                // Clear the flag after respecting it once
                localStorage.removeItem('cart_cleared_at');
                return { items: [], total: 0, count: 0, lastUpdated: Date.now() };
            }
        } catch(e) {}
        
        // If one cart is empty, return the other
        if (!localCart.items?.length) return serverCart;
        if (!serverCart.items?.length) return localCart;
        
        // Use the most recently updated cart as base
        let baseCart = localCart.lastUpdated > serverCart.lastUpdated ? localCart : serverCart;
        let otherCart = baseCart === localCart ? serverCart : localCart;
        
        // Merge items from both carts
        const mergedItems = [...baseCart.items];
        
        otherCart.items.forEach(otherItem => {
            const existingItemIndex = mergedItems.findIndex(item => item.id === otherItem.id);
            
            if (existingItemIndex !== -1) {
                // Keep the item with higher quantity
                if (otherItem.quantity > mergedItems[existingItemIndex].quantity) {
                    mergedItems[existingItemIndex] = otherItem;
                }
            } else {
                mergedItems.push(otherItem);
            }
        });
        
        const mergedCart = {
            items: mergedItems,
            total: 0,
            count: 0,
            lastUpdated: Math.max(localCart.lastUpdated, serverCart.lastUpdated)
        };
        
        this.calculateCartTotals(mergedCart);
        
        console.log('✅ Cart merge completed:', mergedCart);
        return mergedCart;
    }

    /**
     * Calculate cart totals
     */
    calculateCartTotals(cart) {
        cart.count = cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        cart.total = cart.items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
    }

    /**
     * Save cart to all locations
     */
    async saveCartEverywhere(cart) {
        const tasks = [];
        
        // Save to localStorage
        tasks.push(Promise.resolve(this.saveLocalCart(cart)));
        
        // Save to server
        tasks.push(this.saveServerCart(cart));
        
        try {
            await Promise.allSettled(tasks);
            console.log('💾 Cart saved to all locations');
            
            // Update UI
            this.updateCartUI(cart);
        } catch (error) {
            console.error('Error saving cart everywhere:', error);
        }
    }

    /**
     * Add item to cart with sync
     */
    async addItem(product) {
        try {
            this.syncInProgress = true;
            
            const cart = this.getLocalCart();
            const existingItemIndex = cart.items.findIndex(item => item.id === product.id);
            
            if (existingItemIndex !== -1) {
                cart.items[existingItemIndex].quantity += product.quantity || 1;
            } else {
                cart.items.push({
                    id: product.id,
                    name: product.name,
                    price: parseFloat(product.price) || 0,
                    quantity: product.quantity || 1,
                    image: product.image_url || product.image,
                    shopkeeper: product.shopkeeper_name,
                    addedAt: Date.now()
                });
            }
            
            this.calculateCartTotals(cart);
            await this.saveCartEverywhere(cart);
            
            this.showNotification(`${product.name} added to cart!`, 'success');
            
            return cart;
        } catch (error) {
            console.error('Error adding item to cart:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Remove item from cart with sync
     */
    async removeItem(productId) {
        try {
            this.syncInProgress = true;
            
            const cart = this.getLocalCart();
            cart.items = cart.items.filter(item => item.id !== productId);
            
            this.calculateCartTotals(cart);
            await this.saveCartEverywhere(cart);
            
            this.showNotification('Item removed from cart', 'info');
            
            return cart;
        } catch (error) {
            console.error('Error removing item from cart:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Update item quantity with sync
     */
    async updateQuantity(productId, quantity) {
        try {
            this.syncInProgress = true;
            
            if (quantity <= 0) {
                return await this.removeItem(productId);
            }
            
            const cart = this.getLocalCart();
            const item = cart.items.find(item => item.id === productId);
            
            if (item) {
                item.quantity = quantity;
                this.calculateCartTotals(cart);
                await this.saveCartEverywhere(cart);
            }
            
            return cart;
        } catch (error) {
            console.error('Error updating quantity:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Clear cart with sync
     */
    async clearCart() {
        try {
            this.syncInProgress = true;
            
            const emptyCart = { items: [], total: 0, count: 0, lastUpdated: Date.now() };
            await this.saveCartEverywhere(emptyCart);
            
            this.showNotification('Cart cleared', 'info');
            
            return emptyCart;
        } catch (error) {
            console.error('Error clearing cart:', error);
            throw error;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Start periodic synchronization
     */
    startPeriodicSync() {
        setInterval(async () => {
            if (!this.syncInProgress && (Date.now() - this.lastSyncTime) > this.syncInterval) {
                console.log('🔄 Performing periodic cart sync');
                await this.init();
                this.lastSyncTime = Date.now();
            }
        }, this.syncInterval);
    }

    /**
     * Update cart UI elements
     */
    updateCartUI(cart) {
        // Update cart counter
        const cartCounter = document.getElementById('cartCount') || document.querySelector('.cart-count');
        if (cartCounter) {
            cartCounter.textContent = cart.count || 0;
            cartCounter.style.display = cart.count > 0 ? 'block' : 'none';
        }
        
        // Trigger custom event for other components
        window.dispatchEvent(new CustomEvent('cartUpdated', { 
            detail: { cart: cart }
        }));
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            console.log(`📢 ${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Get current cart state
     */
    getCurrentCart() {
        return this.getLocalCart();
    }
}

// Initialize cart sync manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.cartSyncManager) {
        window.cartSyncManager = new CartSyncManager();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CartSyncManager;
}