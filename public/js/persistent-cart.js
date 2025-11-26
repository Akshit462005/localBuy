/**
 * LocalBuy Persistent Cart Manager
 * Uses Local Storage for persistent shopping cart across browser sessions
 */

class PersistentCartManager {
    constructor(localCache) {
        this.localCache = localCache;
        this.cartKey = 'persistent_cart';
        this.wishlistKey = 'persistent_wishlist';
        this.cartHistory = 'cart_history';
        
        // Initialize cart from storage
        this.cart = this.loadCart();
        this.wishlist = this.loadWishlist();
        
        console.log('🛒 Persistent Cart Manager initialized');
    }
    
    /**
     * Load cart from local storage
     */
    loadCart() {
        const savedCart = this.localCache.get(this.cartKey);
        return savedCart || {
            items: [],
            total: 0,
            count: 0,
            lastUpdated: Date.now()
        };
    }
    
    /**
     * Save cart to local storage
     */
    saveCart() {
        this.cart.lastUpdated = Date.now();
        this.localCache.set(this.cartKey, this.cart, 30 * 24 * 60); // 30 days
        this.updateCartHistory();
        this.notifyCartUpdate();
    }
    
    /**
     * Add item to persistent cart
     */
    addItem(product) {
        try {
            const existingItem = this.cart.items.find(item => item.id === product.id);
            
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + (product.quantity || 1);
                existingItem.lastUpdated = Date.now();
            } else {
                const cartItem = {
                    id: product.id,
                    name: product.name,
                    price: parseFloat(product.price) || 0,
                    quantity: product.quantity || 1,
                    image: product.image || product.image_url || null,
                    shopkeeper: product.shopkeeper_name || product.shopkeeper || null,
                    addedAt: Date.now(),
                    lastUpdated: Date.now()
                };
                
                this.cart.items.push(cartItem);
            }
            
            this.updateCartTotals();
            this.saveCart();
            
            console.log(`🛒 Added to persistent cart:`, product);
            return true;
        } catch (error) {
            console.error('Error adding to persistent cart:', error);
            return false;
        }
    }
    
    /**
     * Remove item from persistent cart
     */
    removeItem(productId) {
        try {
            const initialLength = this.cart.items.length;
            this.cart.items = this.cart.items.filter(item => item.id !== productId);
            
            if (this.cart.items.length < initialLength) {
                this.updateCartTotals();
                this.saveCart();
                console.log(`🗑️ Removed from persistent cart: ${productId}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error removing from persistent cart:', error);
            return false;
        }
    }
    
    /**
     * Update item quantity
     */
    updateQuantity(productId, quantity) {
        try {
            const item = this.cart.items.find(item => item.id === productId);
            
            if (!item) {
                return false;
            }
            
            if (quantity <= 0) {
                return this.removeItem(productId);
            }
            
            item.quantity = quantity;
            item.lastUpdated = Date.now();
            
            this.updateCartTotals();
            this.saveCart();
            
            console.log(`🔢 Updated quantity for ${productId}: ${quantity}`);
            return true;
        } catch (error) {
            console.error('Error updating quantity:', error);
            return false;
        }
    }
    
    /**
     * Clear entire cart
     */
    clearCart() {
        try {
            this.cart = {
                items: [],
                total: 0,
                count: 0,
                lastUpdated: Date.now()
            };
            
            this.saveCart();
            console.log('🗑️ Persistent cart cleared');
            return true;
        } catch (error) {
            console.error('Error clearing persistent cart:', error);
            return false;
        }
    }
    
    /**
     * Get all cart items
     */
    getItems() {
        return [...this.cart.items];
    }
    
    /**
     * Get cart summary
     */
    getSummary() {
        return {
            items: this.cart.items,
            total: this.cart.total,
            count: this.cart.count,
            lastUpdated: this.cart.lastUpdated,
            isEmpty: this.cart.items.length === 0
        };
    }
    
    /**
     * Get cart total
     */
    getTotal() {
        return this.cart.total;
    }
    
    /**
     * Get cart item count
     */
    getCount() {
        return this.cart.count;
    }
    
    /**
     * Update cart totals
     */
    updateCartTotals() {
        this.cart.total = this.cart.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        
        this.cart.count = this.cart.items.reduce((sum, item) => {
            return sum + item.quantity;
        }, 0);
    }
    
    /**
     * Wishlist Management
     */
    loadWishlist() {
        return this.localCache.get(this.wishlistKey) || [];
    }
    
    saveWishlist() {
        this.localCache.set(this.wishlistKey, this.wishlist, 90 * 24 * 60); // 90 days
    }
    
    addToWishlist(product) {
        try {
            const existingIndex = this.wishlist.findIndex(item => item.id === product.id);
            
            if (existingIndex === -1) {
                const wishlistItem = {
                    id: product.id,
                    name: product.name,
                    price: parseFloat(product.price) || 0,
                    image: product.image || product.image_url || null,
                    addedAt: Date.now()
                };
                
                this.wishlist.push(wishlistItem);
                this.saveWishlist();
                console.log(`💖 Added to wishlist:`, product);
                return true;
            }
            
            return false; // Already in wishlist
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            return false;
        }
    }
    
    removeFromWishlist(productId) {
        try {
            const initialLength = this.wishlist.length;
            this.wishlist = this.wishlist.filter(item => item.id !== productId);
            
            if (this.wishlist.length < initialLength) {
                this.saveWishlist();
                console.log(`💔 Removed from wishlist: ${productId}`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error removing from wishlist:', error);
            return false;
        }
    }
    
    getWishlist() {
        return [...this.wishlist];
    }
    
    isInWishlist(productId) {
        return this.wishlist.some(item => item.id === productId);
    }
    
    /**
     * Move item from wishlist to cart
     */
    moveToCart(productId) {
        const item = this.wishlist.find(item => item.id === productId);
        if (item) {
            this.addItem({ ...item, quantity: 1 });
            this.removeFromWishlist(productId);
            return true;
        }
        return false;
    }
    
    /**
     * Cart History
     */
    updateCartHistory() {
        try {
            const history = this.localCache.get(this.cartHistory) || [];
            
            // Add current cart state to history
            const historyEntry = {
                timestamp: Date.now(),
                itemCount: this.cart.count,
                total: this.cart.total,
                items: this.cart.items.length
            };
            
            history.unshift(historyEntry);
            
            // Keep only last 50 entries
            if (history.length > 50) {
                history.splice(50);
            }
            
            this.localCache.set(this.cartHistory, history, 30 * 24 * 60);
        } catch (error) {
            console.error('Error updating cart history:', error);
        }
    }
    
    getCartHistory() {
        return this.localCache.get(this.cartHistory) || [];
    }
    
    /**
     * Sync with server cart
     */
    async syncWithServer() {
        try {
            // Get server cart
            const response = await fetch('/api/cart', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const serverCart = await response.json();
                
                // Merge local and server cart
                if (serverCart.success && serverCart.cart) {
                    this.mergeServerCart(serverCart.cart);
                }
            }
        } catch (error) {
            console.error('Error syncing with server:', error);
        }
    }
    
    /**
     * Merge server cart with local cart
     */
    mergeServerCart(serverCart) {
        try {
            if (serverCart.items && Array.isArray(serverCart.items)) {
                serverCart.items.forEach(serverItem => {
                    const localItem = this.cart.items.find(item => item.id === serverItem.id);
                    
                    if (!localItem) {
                        // Add server item to local cart
                        this.addItem(serverItem);
                    } else if (serverItem.quantity > localItem.quantity) {
                        // Update quantity if server has more
                        this.updateQuantity(serverItem.id, serverItem.quantity);
                    }
                });
            }
            
            console.log('🔄 Cart synced with server');
        } catch (error) {
            console.error('Error merging server cart:', error);
        }
    }
    
    /**
     * Notify cart update (for UI updates)
     */
    notifyCartUpdate() {
        // Dispatch custom event
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('cartUpdated', {
                detail: {
                    cart: this.getSummary(),
                    timestamp: Date.now()
                }
            });
            
            window.dispatchEvent(event);
            
            // Update cart badge if it exists
            const cartBadge = document.querySelector('.cart-badge, #cart-badge');
            if (cartBadge) {
                cartBadge.textContent = this.cart.count;
                cartBadge.style.display = this.cart.count > 0 ? 'inline' : 'none';
            }
        }
    }
    
    /**
     * Get cart statistics
     */
    getStats() {
        const history = this.getCartHistory();
        
        return {
            currentItems: this.cart.count,
            currentTotal: this.cart.total,
            totalProducts: this.cart.items.length,
            wishlistItems: this.wishlist.length,
            lastUpdated: this.cart.lastUpdated,
            historyEntries: history.length,
            averageItemPrice: this.cart.items.length > 0 ? 
                (this.cart.total / this.cart.count).toFixed(2) : 0
        };
    }
    
    /**
     * Export cart data
     */
    export() {
        return {
            cart: this.cart,
            wishlist: this.wishlist,
            history: this.getCartHistory(),
            stats: this.getStats(),
            exportedAt: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentCartManager;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PersistentCartManager = PersistentCartManager;
}