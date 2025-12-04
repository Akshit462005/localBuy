/**
 * Global Cart Counter - Updates cart badge/count across all pages
 */

class CartCounter {
    constructor() {
        this.init();
    }

    init() {
        // Update cart count on page load
        this.updateCartCount();
        
        // Set up periodic updates (every 30 seconds)
        setInterval(() => {
            this.updateCartCount();
        }, 30000);

        // Listen for custom cart update events
        window.addEventListener('cartUpdated', () => {
            this.updateCartCount();
        });
    }

    /**
     * Fetch current cart count from server and update all cart badges
     */
    async updateCartCount() {
        try {
            // Try the public cart count endpoint first
            const response = await fetch('/user/api/cart/count');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateCartElements(data.count || 0);
                    return;
                }
            }
            
            // Fallback to full cart endpoint if count endpoint fails
            const cartResponse = await fetch('/user/cart?format=json');
            if (cartResponse.ok) {
                const contentType = cartResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const cartData = await cartResponse.json();
                    if (cartData.success) {
                        const cartCount = cartData.cart.count || 0;
                        this.updateCartElements(cartCount);
                        return;
                    }
                }
            }
            
            // If all else fails, fallback to 0
            this.updateCartElements(0);
        } catch (error) {
            console.error('Failed to update cart count:', error);
            // Fallback to 0 on error
            this.updateCartElements(0);
        }
    }

    /**
     * Update all cart count elements on the page
     */
    updateCartElements(count) {
        // Update cart badges and counts
        const cartElements = document.querySelectorAll(
            '#cartCount, .cart-count, .cart-badge, #cart-badge'
        );
        
        cartElements.forEach(element => {
            element.textContent = count;
            
            // Hide badge if count is 0
            if (element.classList.contains('cart-badge') || element.classList.contains('cart-count')) {
                element.style.display = count > 0 ? 'inline' : 'none';
            }
        });

        // Update cart icons to show "has items" state
        const cartIcons = document.querySelectorAll('.cart-icon');
        cartIcons.forEach(icon => {
            icon.classList.toggle('has-items', count > 0);
        });

        // Trigger custom event for other components
        window.dispatchEvent(new CustomEvent('cartCountUpdated', { 
            detail: { count } 
        }));
    }

    /**
     * Manually trigger cart count update (can be called from other scripts)
     */
    refresh() {
        this.updateCartCount();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.cartCounter = new CartCounter();
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CartCounter;
}