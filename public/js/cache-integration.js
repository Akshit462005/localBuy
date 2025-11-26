/**
 * LocalBuy Browser Cache Integration
 * Main integration script for all caching functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 LocalBuy Browser Cache System Initialized');

    // Initialize both cache systems
    initializeCacheSystems();

    // Initialize cache debug panel
    if (window.location.search.includes('debug=cache')) {
        initCacheDebugPanel();
    }

    // Auto-save form data
    initFormAutoSave();

    // Setup product interactions
    setupProductInteractions();

    // Setup search caching
    setupSearchCaching();

    // Show cache status
    showCacheStatus();
});

/**
 * Initialize both Session Storage and Local Storage cache systems
 */
function initializeCacheSystems() {
    try {
        // Initialize Local Storage cache systems only if not already done
        if (!window.localCache) {
            window.localCache = new LocalStorageCache();
        }
        if (!window.persistentCart) {
            window.persistentCart = new PersistentCartManager(window.localCache);
        }
        if (!window.persistentPrefs) {
            window.persistentPreferences = new PersistentPreferencesManager(window.localCache);
        }
        
        // Initialize existing cache systems if not already done
        if (!window.cache) {
            window.cache = new BrowserCache();
        }
        if (!window.cartManager) {
            window.cartManager = new CartManager();
        }
        if (!window.userSessionManager) {
            window.userSessionManager = new UserSessionManager();
        }
        
        // Sync between cache systems after a short delay to ensure everything is initialized
        setTimeout(() => {
            syncCacheSystems();
        }, 100);
        
        console.log('✅ Both Session and Local Storage cache systems initialized');
    } catch (error) {
        console.error('❌ Error initializing cache systems:', error);
    }
}

/**
 * Sync data between Session Storage and Local Storage
 */
function syncCacheSystems() {
    try {
        // Ensure all managers are initialized
        if (!window.persistentCart || !window.persistentPreferences || !window.cartManager || !window.userSessionManager) {
            console.warn('⚠️ Not all cache managers are initialized yet');
            return;
        }
        
        // Sync cart data from persistent to session
        const persistentCartData = window.persistentCart.getSummary();
        if (persistentCartData && persistentCartData.items && persistentCartData.items.length > 0) {
            persistentCartData.items.forEach(item => {
                window.cartManager.addItem(item);
            });
        }
        
        // Sync preferences from persistent to session
        const persistentTheme = window.persistentPreferences.getTheme();
        if (persistentTheme) {
            // Use savePreferences method which exists in UserSessionManager
            window.userSessionManager.savePreferences({
                theme: persistentTheme
            });
        }
        
        console.log('🔄 Cache systems synced');
    } catch (error) {
        console.error('Error syncing cache systems:', error);
    }
}

/**
 * Initialize cache debug panel
 */
function initCacheDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.innerHTML = `
        <div style="position: fixed; top: 10px; left: 10px; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px; z-index: 10001; max-width: 300px; font-size: 12px;">
            <h4>Cache Debug Panel</h4>
            <div id="cache-stats"></div>
            <div id="cache-items"></div>
            <button onclick="window.cache.clear(); location.reload();">Clear Cache</button>
        </div>
    `;
    document.body.appendChild(debugPanel);

    updateCacheDebugInfo();
    setInterval(updateCacheDebugInfo, 2000);
}

/**
 * Update cache debug information
 */
function updateCacheDebugInfo() {
    const stats = window.cache.getStats();
    const items = window.cache.getAll();

    document.getElementById('cache-stats').innerHTML = `
        <strong>Stats:</strong><br>
        Items: ${stats.itemCount}<br>
        Size: ${stats.sizeMB} MB<br>
        Supported: ${stats.supported}
    `;

    document.getElementById('cache-items').innerHTML = `
        <strong>Items:</strong><br>
        ${Object.keys(items).map(key => `${key}: ${typeof items[key]}`).join('<br>')}
    `;
}

/**
 * Initialize form auto-save functionality
 */
function initFormAutoSave() {
    const forms = document.querySelectorAll('form[data-autosave]');
    
    forms.forEach(form => {
        const formName = form.getAttribute('data-autosave');
        
        // Restore saved data
        const savedData = window.userSessionManager?.restoreFormData(formName);
        if (savedData) {
            restoreFormFields(form, savedData);
        }

        // Save on input
        form.addEventListener('input', debounce((event) => {
            const formData = getFormData(form);
            window.userSessionManager?.saveFormData(formName, formData);
            showSavedIndicator(form);
        }, 1000));

        // Clear on submit
        form.addEventListener('submit', () => {
            window.userSessionManager?.clearFormData(formName);
        });
    });
}

/**
 * Setup product interaction handlers
 */
function setupProductInteractions() {
    // Add to cart buttons
    document.addEventListener('click', (event) => {
        if (event.target.matches('.add-to-cart, .add-to-cart-btn')) {
            event.preventDefault();
            handleAddToCart(event.target);
        }
    });

    // Product quick view
    document.addEventListener('click', (event) => {
        if (event.target.matches('.product-quick-view')) {
            event.preventDefault();
            handleProductQuickView(event.target);
        }
    });

    // Recently viewed products
    trackRecentlyViewedProducts();
}

/**
 * Handle add to cart action
 */
function handleAddToCart(button) {
    const productCard = button.closest('.product-card, .product-item');
    if (!productCard) return;

    const product = {
        id: productCard.getAttribute('data-product-id') || Date.now().toString(),
        name: productCard.querySelector('.product-name, .product-title')?.textContent || 'Unknown Product',
        price: parseFloat(productCard.querySelector('.product-price')?.textContent?.replace(/[^0-9.]/g, '')) || 0,
        image: productCard.querySelector('.product-image')?.src || null,
        quantity: 1
    };

    // Add to both cache systems
    if (window.cartManager) {
        window.cartManager.addItem(product);
    }
    
    if (window.persistentCart) {
        window.persistentCart.addItem(product);
    }
    
    // Show notification
    showNotification(`${product.name} added to cart!`, 'success');
}

/**
 * Handle product quick view
 */
function handleProductQuickView(button) {
    const productId = button.getAttribute('data-product-id');
    if (!productId) return;

    // Cache the view
    const viewData = {
        productId: productId,
        viewedAt: Date.now(),
        referrer: window.location.pathname
    };

    window.cache.set(`product_view_${productId}`, viewData, 60);
    
    // Track in recently viewed
    addToRecentlyViewed(productId);
}

/**
 * Track recently viewed products
 */
function trackRecentlyViewedProducts() {
    const productElements = document.querySelectorAll('.product-detail, .product-page');
    
    productElements.forEach(element => {
        const productId = element.getAttribute('data-product-id');
        if (productId) {
            addToRecentlyViewed(productId);
        }
    });
}

/**
 * Add product to recently viewed list
 */
function addToRecentlyViewed(productId) {
    const recentlyViewed = window.cache.get('recently_viewed') || [];
    
    // Remove if already exists
    const index = recentlyViewed.indexOf(productId);
    if (index > -1) {
        recentlyViewed.splice(index, 1);
    }
    
    // Add to beginning
    recentlyViewed.unshift(productId);
    
    // Keep only last 10
    if (recentlyViewed.length > 10) {
        recentlyViewed.pop();
    }
    
    window.cache.set('recently_viewed', recentlyViewed, 24 * 60); // Cache for 24 hours
}

/**
 * Setup search result caching
 */
function setupSearchCaching() {
    const searchForms = document.querySelectorAll('.search-form, form[action*="search"]');
    
    searchForms.forEach(form => {
        form.addEventListener('submit', (event) => {
            const searchQuery = form.querySelector('input[type="search"], input[name*="search"], input[name="q"]')?.value;
            if (searchQuery) {
                cacheSearchQuery(searchQuery);
            }
        });
    });

    // Setup search suggestions
    const searchInputs = document.querySelectorAll('input[type="search"], input[name*="search"]');
    searchInputs.forEach(input => {
        input.addEventListener('input', debounce((event) => {
            showSearchSuggestions(input, event.target.value);
        }, 300));
    });
}

/**
 * Cache search query
 */
function cacheSearchQuery(query) {
    // Session storage (temporary)
    const searches = window.cache.get('search_history') || [];
    
    // Remove if already exists
    const index = searches.indexOf(query);
    if (index > -1) {
        searches.splice(index, 1);
    }
    
    // Add to beginning
    searches.unshift(query);
    
    // Keep only last 20 searches
    if (searches.length > 20) {
        searches.pop();
    }
    
    window.cache.set('search_history', searches, 7 * 24 * 60); // Cache for 7 days
    
    // Persistent storage (survives browser restart)
    if (window.persistentPrefs) {
        window.persistentPrefs.addSearchQuery(query);
    }
}

/**
 * Show search suggestions
 */
function showSearchSuggestions(input, query) {
    if (query.length < 2) return;

    let suggestions = [];
    
    // Get suggestions from persistent storage first
    if (window.persistentPrefs) {
        suggestions = window.persistentPrefs.getSearchSuggestions(query, 5);
    }
    
    // Fallback to session storage if no persistent suggestions
    if (suggestions.length === 0) {
        const searches = window.cache.get('search_history') || [];
        suggestions = searches.filter(search => 
            search.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);
    }

    if (suggestions.length > 0) {
        showSuggestionDropdown(input, suggestions);
    }
}

/**
 * Show suggestion dropdown
 */
function showSuggestionDropdown(input, suggestions) {
    // Remove existing dropdown
    const existingDropdown = document.querySelector('.search-suggestions');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    // Create new dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'search-suggestions';
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-top: none;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    `;

    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = suggestion;
        item.style.cssText = `
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        `;
        
        item.addEventListener('click', () => {
            input.value = suggestion;
            dropdown.remove();
            input.form?.submit();
        });
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f5f5f5';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'white';
        });
        
        dropdown.appendChild(item);
    });

    // Position dropdown
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);

    // Hide on click outside
    setTimeout(() => {
        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target) && event.target !== input) {
                dropdown.remove();
            }
        }, { once: true });
    }, 100);
}

/**
 * Show cache status indicator
 */
function showCacheStatus() {
    const status = document.createElement('div');
    status.className = 'cache-status';
    status.textContent = `Cache: ${window.cache.getStats().itemCount} items`;
    document.body.appendChild(status);

    // Show briefly on page load
    setTimeout(() => status.classList.add('show'), 1000);
    setTimeout(() => status.classList.remove('show'), 3000);
}

/**
 * Utility function: debounce
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get form data as object
 */
function getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    return data;
}

/**
 * Restore form fields from data
 */
function restoreFormFields(form, data) {
    Object.keys(data).forEach(key => {
        const field = form.querySelector(`[name="${key}"]`);
        if (field) {
            field.value = data[key];
        }
    });
}

/**
 * Show saved indicator on form
 */
function showSavedIndicator(form) {
    form.classList.add('saved');
    setTimeout(() => {
        form.classList.remove('saved');
    }, 2000);
}

/**
 * Show notification
 */
function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notification-container') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

/**
 * Create notification container if it doesn't exist
 */
function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}