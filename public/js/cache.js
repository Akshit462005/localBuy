/**
 * Browser Cache Manager using Session Storage
 * Handles caching of user data, cart items, and application state
 */

class BrowserCache {
    constructor() {
        this.isSupported = this.checkSupport();
        this.prefix = 'localBuy_';
    }

    /**
     * Check if sessionStorage is supported
     */
    checkSupport() {
        try {
            return typeof(Storage) !== 'undefined' && sessionStorage !== null;
        } catch (e) {
            return false;
        }
    }

    /**
     * Generate cache key with prefix
     */
    getKey(key) {
        return this.prefix + key;
    }

    /**
     * Set item in session storage
     */
    set(key, value, expireMinutes = null) {
        if (!this.isSupported) {
            console.warn('Session storage not supported');
            return false;
        }

        try {
            const item = {
                value: value,
                timestamp: Date.now(),
                expires: expireMinutes ? Date.now() + (expireMinutes * 60 * 1000) : null
            };

            sessionStorage.setItem(this.getKey(key), JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Failed to set cache item:', e);
            return false;
        }
    }

    /**
     * Get item from session storage
     */
    get(key) {
        if (!this.isSupported) {
            return null;
        }

        try {
            const itemStr = sessionStorage.getItem(this.getKey(key));
            if (!itemStr) {
                return null;
            }

            const item = JSON.parse(itemStr);
            
            // Check if expired
            if (item.expires && Date.now() > item.expires) {
                this.remove(key);
                return null;
            }

            return item.value;
        } catch (e) {
            console.error('Failed to get cache item:', e);
            return null;
        }
    }

    /**
     * Remove item from session storage
     */
    remove(key) {
        if (!this.isSupported) {
            return false;
        }

        try {
            sessionStorage.removeItem(this.getKey(key));
            return true;
        } catch (e) {
            console.error('Failed to remove cache item:', e);
            return false;
        }
    }

    /**
     * Clear all LocalBuy cache items
     */
    clear() {
        if (!this.isSupported) {
            return false;
        }

        try {
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    sessionStorage.removeItem(key);
                }
            });
            return true;
        } catch (e) {
            console.error('Failed to clear cache:', e);
            return false;
        }
    }

    /**
     * Get all cached items
     */
    getAll() {
        if (!this.isSupported) {
            return {};
        }

        const items = {};
        try {
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    const cleanKey = key.replace(this.prefix, '');
                    items[cleanKey] = this.get(cleanKey);
                }
            });
            return items;
        } catch (e) {
            console.error('Failed to get all cache items:', e);
            return {};
        }
    }

    /**
     * Check if item exists in cache
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Get cache size in bytes (approximate)
     */
    getSize() {
        if (!this.isSupported) {
            return 0;
        }

        let size = 0;
        try {
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    size += sessionStorage.getItem(key).length;
                }
            });
            return size;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const all = this.getAll();
        return {
            itemCount: Object.keys(all).length,
            sizeBytes: this.getSize(),
            sizeMB: (this.getSize() / 1024 / 1024).toFixed(2),
            supported: this.isSupported
        };
    }
}

// Create global cache instance
window.BrowserCache = BrowserCache;
window.cache = new BrowserCache();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserCache;
}