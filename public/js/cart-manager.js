/**
 * Cart Management with Session Storage Caching
 * Handles shopping cart operations with browser caching
 */

class CartManager {
    constructor() {
        this.cache = window.cache || new BrowserCache();
        this.cartKey = 'shopping_cart';
        this.init();
    }

    /**
     * Initialize cart from cache or create empty cart
     */
    init() {
        if (!this.cache.has(this.cartKey)) {
            this.cache.set(this.cartKey, {
                items: [],
                total: 0,
                itemCount: 0,
                lastUpdated: Date.now()
            });
        }
        this.updateCartDisplay();
    }

    /**
     * Get current cart from cache
     */
    getCart() {
        return this.cache.get(this.cartKey) || {
            items: [],
            total: 0,
            itemCount: 0,
            lastUpdated: Date.now()
        };
    }

    /**
     * Add item to cart
     */
    addItem(product) {
        const cart = this.getCart();
        
        // Check if item already exists
        const existingItemIndex = cart.items.findIndex(item => 
            item.id === product.id
        );

        if (existingItemIndex !== -1) {
            // Update quantity
            cart.items[existingItemIndex].quantity += product.quantity || 1;
        } else {
            // Add new item
            cart.items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: product.quantity || 1,
                image: product.image || null,
                addedAt: Date.now()
            });
        }

        this.updateCartTotals(cart);
        this.saveCart(cart);
        this.showNotification(`${product.name} added to cart!`, 'success');
        return cart;
    }

    /**
     * Remove item from cart
     */
    removeItem(productId) {
        const cart = this.getCart();
        const itemIndex = cart.items.findIndex(item => item.id === productId);
        
        if (itemIndex !== -1) {
            const removedItem = cart.items.splice(itemIndex, 1)[0];
            this.updateCartTotals(cart);
            this.saveCart(cart);
            this.showNotification(`${removedItem.name} removed from cart!`, 'info');
            return cart;
        }
        
        return cart;
    }

    /**
     * Update item quantity
     */
    updateQuantity(productId, quantity) {
        const cart = this.getCart();
        const item = cart.items.find(item => item.id === productId);
        
        if (item) {
            if (quantity <= 0) {
                return this.removeItem(productId);
            } else {
                item.quantity = quantity;
                this.updateCartTotals(cart);
                this.saveCart(cart);
                return cart;
            }
        }
        
        return cart;
    }

    /**
     * Clear entire cart
     */
    clearCart() {
        const emptyCart = {
            items: [],
            total: 0,
            itemCount: 0,
            lastUpdated: Date.now()
        };
        
        this.saveCart(emptyCart);
        this.showNotification('Cart cleared!', 'info');
        return emptyCart;
    }

    /**
     * Update cart totals
     */
    updateCartTotals(cart) {
        cart.total = cart.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
        );
        cart.itemCount = cart.items.reduce((sum, item) => 
            sum + item.quantity, 0
        );
        cart.lastUpdated = Date.now();
    }

    /**
     * Save cart to cache
     */
    saveCart(cart) {
        this.cache.set(this.cartKey, cart);
        this.updateCartDisplay();
        this.triggerCartUpdateEvent(cart);
    }

    /**
     * Update cart display in UI
     */
    updateCartDisplay() {
        const cart = this.getCart();
        
        // Update cart badge
        const cartBadge = document.querySelector('.cart-badge, .cart-count');
        if (cartBadge) {
            cartBadge.textContent = cart.itemCount;
            cartBadge.style.display = cart.itemCount > 0 ? 'inline' : 'none';
        }

        // Update cart total
        const cartTotal = document.querySelector('.cart-total');
        if (cartTotal) {
            cartTotal.textContent = `$${cart.total.toFixed(2)}`;
        }

        // Update cart icon
        const cartIcon = document.querySelector('.cart-icon');
        if (cartIcon) {
            cartIcon.classList.toggle('has-items', cart.itemCount > 0);
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto-hide after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);

        // Manual close
        notification.querySelector('.notification-close').onclick = () => {
            notification.remove();
        };
    }

    /**
     * Trigger custom cart update event
     */
    triggerCartUpdateEvent(cart) {
        const event = new CustomEvent('cartUpdated', { 
            detail: cart 
        });
        window.dispatchEvent(event);
    }

    /**
     * Sync cart with server (for logged-in users)
     */
    async syncWithServer() {
        const cart = this.getCart();
        
        try {
            const response = await fetch('/api/cart/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cart)
            });

            if (response.ok) {
                const serverCart = await response.json();
                this.saveCart(serverCart);
                return serverCart;
            }
        } catch (error) {
            console.error('Failed to sync cart with server:', error);
        }

        return cart;
    }

    /**
     * Get cart summary for display
     */
    getCartSummary() {
        const cart = this.getCart();
        return {
            itemCount: cart.itemCount,
            total: cart.total,
            formattedTotal: `$${cart.total.toFixed(2)}`,
            isEmpty: cart.items.length === 0,
            lastUpdated: new Date(cart.lastUpdated).toLocaleString()
        };
    }
}

// Initialize cart manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cartManager = new CartManager();
    
    // Listen for cart update events
    window.addEventListener('cartUpdated', (event) => {
        console.log('Cart updated:', event.detail);
    });
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CartManager;
}