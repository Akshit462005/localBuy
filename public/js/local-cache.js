/**
 * LocalBuy Local Storage Cache Manager
 * Persistent browser caching using Local Storage API
 * Data survives browser restarts and sessions
 */

class LocalStorageCache {
    constructor(prefix = 'localbuy_local_') {
        this.prefix = prefix;
        this.isSupported = this.checkSupport();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            removes: 0
        };
        
        if (this.isSupported) {
            this.cleanup();
            console.log('✅ LocalStorage Cache initialized');
        } else {
            console.warn('⚠️ LocalStorage not supported, using fallback');
        }
    }
    
    /**
     * Check if Local Storage is supported
     */
    checkSupport() {
        try {
            const testKey = '__localstorage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
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
     * Set item in local storage with expiration
     */
    set(key, value, expirationMinutes = null) {
        if (!this.isSupported) {
            console.warn('LocalStorage not supported');
            return false;
        }
        
        try {
            const cacheKey = this.getKey(key);
            const cacheItem = {
                value: value,
                timestamp: Date.now(),
                expiration: expirationMinutes ? Date.now() + (expirationMinutes * 60 * 1000) : null,
                type: typeof value
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
            this.stats.sets++;
            
            console.log(`📦 LocalStorage SET: ${key}`, { value, expirationMinutes });
            return true;
        } catch (error) {
            console.error('LocalStorage SET error:', error);
            
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                this.clearExpired();
                // Try again after cleanup
                try {
                    const cacheKey = this.getKey(key);
                    const cacheItem = {
                        value: value,
                        timestamp: Date.now(),
                        expiration: expirationMinutes ? Date.now() + (expirationMinutes * 60 * 1000) : null,
                        type: typeof value
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
                    this.stats.sets++;
                    return true;
                } catch (retryError) {
                    console.error('LocalStorage SET retry failed:', retryError);
                }
            }
            return false;
        }
    }
    
    /**
     * Get item from local storage
     */
    get(key) {
        if (!this.isSupported) {
            return null;
        }
        
        try {
            const cacheKey = this.getKey(key);
            const cached = localStorage.getItem(cacheKey);
            
            if (!cached) {
                this.stats.misses++;
                return null;
            }
            
            const cacheItem = JSON.parse(cached);
            
            // Check expiration
            if (cacheItem.expiration && Date.now() > cacheItem.expiration) {
                this.remove(key);
                this.stats.misses++;
                console.log(`⏰ LocalStorage EXPIRED: ${key}`);
                return null;
            }
            
            this.stats.hits++;
            console.log(`📦 LocalStorage GET: ${key}`, cacheItem.value);
            return cacheItem.value;
        } catch (error) {
            console.error('LocalStorage GET error:', error);
            this.stats.misses++;
            return null;
        }
    }
    
    /**
     * Remove item from local storage
     */
    remove(key) {
        if (!this.isSupported) {
            return false;
        }
        
        try {
            const cacheKey = this.getKey(key);
            localStorage.removeItem(cacheKey);
            this.stats.removes++;
            console.log(`🗑️ LocalStorage REMOVE: ${key}`);
            return true;
        } catch (error) {
            console.error('LocalStorage REMOVE error:', error);
            return false;
        }
    }
    
    /**
     * Clear all cache items with our prefix
     */
    clear() {
        if (!this.isSupported) {
            return false;
        }
        
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            console.log(`🗑️ LocalStorage CLEARED: ${keysToRemove.length} items`);
            return true;
        } catch (error) {
            console.error('LocalStorage CLEAR error:', error);
            return false;
        }
    }
    
    /**
     * Clear expired items
     */
    clearExpired() {
        if (!this.isSupported) {
            return 0;
        }
        
        let clearedCount = 0;
        const now = Date.now();
        
        try {
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    try {
                        const cached = localStorage.getItem(key);
                        if (cached) {
                            const cacheItem = JSON.parse(cached);
                            if (cacheItem.expiration && now > cacheItem.expiration) {
                                keysToRemove.push(key);
                            }
                        }
                    } catch (parseError) {
                        // Remove corrupted entries
                        keysToRemove.push(key);
                    }
                }
            }
            
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                clearedCount++;
            });
            
            if (clearedCount > 0) {
                console.log(`🧹 LocalStorage cleanup: ${clearedCount} expired items removed`);
            }
        } catch (error) {
            console.error('LocalStorage cleanup error:', error);
        }
        
        return clearedCount;
    }
    
    /**
     * Get all cache items
     */
    getAll() {
        if (!this.isSupported) {
            return {};
        }
        
        const allItems = {};
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    const originalKey = key.substring(this.prefix.length);
                    const value = this.get(originalKey);
                    if (value !== null) {
                        allItems[originalKey] = value;
                    }
                }
            }
        } catch (error) {
            console.error('LocalStorage getAll error:', error);
        }
        
        return allItems;
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        let itemCount = 0;
        let totalSize = 0;
        
        if (this.isSupported) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(this.prefix)) {
                        itemCount++;
                        const value = localStorage.getItem(key);
                        if (value) {
                            totalSize += new Blob([value]).size;
                        }
                    }
                }
            } catch (error) {
                console.error('LocalStorage stats error:', error);
            }
        }
        
        return {
            itemCount,
            sizeMB: totalSize / (1024 * 1024),
            sizeKB: totalSize / 1024,
            supported: this.isSupported,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: this.stats.hits + this.stats.misses > 0 ? 
                (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) : 0,
            operations: {
                sets: this.stats.sets,
                removes: this.stats.removes,
                total: this.stats.hits + this.stats.misses + this.stats.sets + this.stats.removes
            }
        };
    }
    
    /**
     * Check if key exists (without retrieving value)
     */
    has(key) {
        if (!this.isSupported) {
            return false;
        }
        
        const cacheKey = this.getKey(key);
        return localStorage.getItem(cacheKey) !== null;
    }
    
    /**
     * Get keys of all cached items
     */
    keys() {
        if (!this.isSupported) {
            return [];
        }
        
        const keys = [];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keys.push(key.substring(this.prefix.length));
                }
            }
        } catch (error) {
            console.error('LocalStorage keys error:', error);
        }
        
        return keys;
    }
    
    /**
     * Initialize cleanup on page load
     */
    cleanup() {
        // Clean up expired items on initialization
        this.clearExpired();
        
        // Set up periodic cleanup (every 10 minutes)
        if (typeof window !== 'undefined') {
            setInterval(() => {
                this.clearExpired();
            }, 10 * 60 * 1000);
        }
    }
    
    /**
     * Export cache data
     */
    export() {
        return {
            timestamp: new Date().toISOString(),
            stats: this.getStats(),
            data: this.getAll()
        };
    }
    
    /**
     * Import cache data
     */
    import(data, overwrite = false) {
        if (!data || !data.data) {
            console.error('Invalid import data');
            return false;
        }
        
        let imported = 0;
        
        try {
            Object.entries(data.data).forEach(([key, value]) => {
                if (!overwrite && this.has(key)) {
                    return; // Skip existing keys if not overwriting
                }
                
                // Set with no expiration for imported data
                if (this.set(key, value)) {
                    imported++;
                }
            });
            
            console.log(`📥 LocalStorage imported: ${imported} items`);
            return true;
        } catch (error) {
            console.error('LocalStorage import error:', error);
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalStorageCache;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LocalStorageCache = LocalStorageCache;
}