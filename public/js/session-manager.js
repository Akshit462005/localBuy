/**
 * User Session Management with Browser Caching
 * Handles user authentication state and preferences
 */

class UserSessionManager {
    constructor() {
        this.cache = window.cache || new BrowserCache();
        this.userKey = 'user_session';
        this.preferencesKey = 'user_preferences';
        this.init();
    }

    /**
     * Initialize session manager
     */
    init() {
        this.restoreUserSession();
        this.setupEventListeners();
    }

    /**
     * Save user session data
     */
    saveUserSession(userData) {
        const session = {
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                role: userData.role
            },
            loginTime: Date.now(),
            isLoggedIn: true
        };

        // Cache for 24 hours
        this.cache.set(this.userKey, session, 24 * 60);
        this.updateUIForLoggedInUser(session.user);
        return session;
    }

    /**
     * Get current user session
     */
    getUserSession() {
        return this.cache.get(this.userKey);
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        const session = this.getUserSession();
        return session && session.isLoggedIn;
    }

    /**
     * Get current user data
     */
    getCurrentUser() {
        const session = this.getUserSession();
        return session ? session.user : null;
    }

    /**
     * Clear user session (logout)
     */
    clearUserSession() {
        this.cache.remove(this.userKey);
        this.updateUIForLoggedOutUser();
        
        // Also clear cart if needed
        if (window.cartManager) {
            window.cartManager.clearCart();
        }
    }

    /**
     * Save user preferences
     */
    savePreferences(preferences) {
        const existingPrefs = this.cache.get(this.preferencesKey) || {};
        const updatedPrefs = { ...existingPrefs, ...preferences };
        
        this.cache.set(this.preferencesKey, updatedPrefs);
        this.applyPreferences(updatedPrefs);
        return updatedPrefs;
    }

    /**
     * Get user preferences
     */
    getPreferences() {
        return this.cache.get(this.preferencesKey) || {
            theme: 'light',
            language: 'en',
            currency: 'USD',
            notifications: true
        };
    }

    /**
     * Apply preferences to UI
     */
    applyPreferences(preferences) {
        // Apply theme
        if (preferences.theme) {
            document.body.className = document.body.className.replace(/theme-\w+/, '');
            document.body.classList.add(`theme-${preferences.theme}`);
        }

        // Apply language
        if (preferences.language) {
            document.documentElement.lang = preferences.language;
        }

        // Trigger preferences update event
        const event = new CustomEvent('preferencesUpdated', { 
            detail: preferences 
        });
        window.dispatchEvent(event);
    }

    /**
     * Restore user session on page load
     */
    restoreUserSession() {
        const session = this.getUserSession();
        if (session && session.isLoggedIn) {
            this.updateUIForLoggedInUser(session.user);
        } else {
            this.updateUIForLoggedOutUser();
        }

        // Apply saved preferences
        const preferences = this.getPreferences();
        this.applyPreferences(preferences);
    }

    /**
     * Update UI for logged-in user
     */
    updateUIForLoggedInUser(user) {
        // Update user info displays
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = user.username;
        });

        const userEmailElements = document.querySelectorAll('.user-email');
        userEmailElements.forEach(element => {
            element.textContent = user.email;
        });

        // Show/hide elements based on login state
        const loggedInElements = document.querySelectorAll('.logged-in-only');
        loggedInElements.forEach(element => {
            element.style.display = 'block';
        });

        const loggedOutElements = document.querySelectorAll('.logged-out-only');
        loggedOutElements.forEach(element => {
            element.style.display = 'none';
        });

        // Show/hide role-specific elements
        const roleElements = document.querySelectorAll(`[data-role]`);
        roleElements.forEach(element => {
            const requiredRole = element.getAttribute('data-role');
            element.style.display = user.role === requiredRole ? 'block' : 'none';
        });

        // Update navigation
        this.updateNavigation(user);
    }

    /**
     * Update UI for logged-out user
     */
    updateUIForLoggedOutUser() {
        // Hide logged-in elements
        const loggedInElements = document.querySelectorAll('.logged-in-only');
        loggedInElements.forEach(element => {
            element.style.display = 'none';
        });

        // Show logged-out elements
        const loggedOutElements = document.querySelectorAll('.logged-out-only');
        loggedOutElements.forEach(element => {
            element.style.display = 'block';
        });

        // Hide all role-specific elements
        const roleElements = document.querySelectorAll(`[data-role]`);
        roleElements.forEach(element => {
            element.style.display = 'none';
        });
    }

    /**
     * Update navigation based on user role
     */
    updateNavigation(user) {
        const nav = document.querySelector('.main-navigation');
        if (!nav) return;

        // Add role-based navigation items
        if (user.role === 'shopkeeper') {
            this.addNavItem(nav, 'Dashboard', '/shopkeeper/dashboard');
            this.addNavItem(nav, 'Add Product', '/shopkeeper/add-product');
        } else if (user.role === 'user') {
            this.addNavItem(nav, 'Dashboard', '/user/dashboard');
            this.addNavItem(nav, 'Orders', '/user/orders');
            this.addNavItem(nav, 'Cart', '/user/cart');
        }
    }

    /**
     * Add navigation item
     */
    addNavItem(nav, text, href) {
        const existingItem = nav.querySelector(`a[href="${href}"]`);
        if (existingItem) return;

        const navItem = document.createElement('a');
        navItem.href = href;
        navItem.textContent = text;
        navItem.className = 'nav-link';
        nav.appendChild(navItem);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for logout clicks
        document.addEventListener('click', (event) => {
            if (event.target.matches('.logout-btn, .logout-link')) {
                event.preventDefault();
                this.handleLogout();
            }
        });

        // Listen for form submissions
        document.addEventListener('submit', (event) => {
            if (event.target.matches('.login-form')) {
                this.handleLoginForm(event);
            }
        });
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            // Call server logout endpoint
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            // Clear session regardless of server response
            this.clearUserSession();
            
            // Redirect to home page
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            // Clear session even if server call fails
            this.clearUserSession();
            window.location.href = '/';
        }
    }

    /**
     * Handle login form submission
     */
    handleLoginForm(event) {
        // This would be called after successful server login
        // The server response would contain user data
        event.preventDefault();
        
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Logging in...';
            submitBtn.disabled = true;
        }
    }

    /**
     * Save form data temporarily
     */
    saveFormData(formName, data) {
        const formKey = `form_${formName}`;
        this.cache.set(formKey, data, 30); // Cache for 30 minutes
    }

    /**
     * Restore form data
     */
    restoreFormData(formName) {
        const formKey = `form_${formName}`;
        return this.cache.get(formKey);
    }

    /**
     * Clear form data
     */
    clearFormData(formName) {
        const formKey = `form_${formName}`;
        this.cache.remove(formKey);
    }
}

// Initialize session manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.userSessionManager = new UserSessionManager();
    
    // Listen for session update events
    window.addEventListener('preferencesUpdated', (event) => {
        console.log('User preferences updated:', event.detail);
    });
});

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserSessionManager;
}