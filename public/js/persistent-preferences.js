/**
 * LocalBuy Persistent Preferences Manager
 * Uses Local Storage for user preferences that persist across browser sessions
 */

class PersistentPreferencesManager {
    constructor(localCache) {
        this.localCache = localCache;
        this.prefsKey = 'user_preferences';
        this.searchHistoryKey = 'search_history';
        this.recentlyViewedKey = 'recently_viewed';
        this.browsingHistoryKey = 'browsing_history';
        
        // Load existing preferences
        this.preferences = this.loadPreferences();
        this.searchHistory = this.loadSearchHistory();
        this.recentlyViewed = this.loadRecentlyViewed();
        
        // Apply saved theme immediately
        this.applyTheme();
        
        console.log('⚙️ Persistent Preferences Manager initialized');
    }
    
    /**
     * Load preferences from local storage
     */
    loadPreferences() {
        const defaultPrefs = {
            theme: 'light',
            language: 'en',
            currency: 'INR',
            viewMode: 'grid',
            itemsPerPage: 20,
            notifications: true,
            emailNotifications: true,
            autoSave: true,
            showPrices: true,
            compactMode: false,
            highContrast: false,
            reducedMotion: false,
            fontSize: 'medium',
            sortPreference: 'name',
            filterPreferences: {},
            dashboardLayout: 'default',
            sidebarCollapsed: false,
            showRecentlyViewed: true,
            showRecommendations: true,
            privacyMode: false,
            analyticsEnabled: true,
            lastUpdated: Date.now()
        };
        
        const saved = this.localCache.get(this.prefsKey);
        return saved ? { ...defaultPrefs, ...saved } : defaultPrefs;
    }
    
    /**
     * Save preferences to local storage
     */
    savePreferences() {
        this.preferences.lastUpdated = Date.now();
        this.localCache.set(this.prefsKey, this.preferences, 365 * 24 * 60); // 1 year
        console.log('💾 Preferences saved');
    }
    
    /**
     * Set a single preference
     */
    setPreference(key, value) {
        try {
            const oldValue = this.preferences[key];
            this.preferences[key] = value;
            this.savePreferences();
            
            // Apply specific preference changes
            this.applyPreferenceChange(key, value, oldValue);
            
            console.log(`⚙️ Preference updated: ${key} = ${value}`);
            return true;
        } catch (error) {
            console.error('Error setting preference:', error);
            return false;
        }
    }
    
    /**
     * Get a single preference
     */
    getPreference(key, defaultValue = null) {
        return this.preferences.hasOwnProperty(key) ? this.preferences[key] : defaultValue;
    }
    
    /**
     * Get all preferences
     */
    getAllPreferences() {
        return { ...this.preferences };
    }
    
    /**
     * Reset preferences to defaults
     */
    resetPreferences() {
        this.preferences = this.loadPreferences();
        this.localCache.remove(this.prefsKey);
        this.applyAllPreferences();
        console.log('🔄 Preferences reset to defaults');
    }
    
    /**
     * Theme Management
     */
    setTheme(theme) {
        if (['light', 'dark', 'auto'].includes(theme)) {
            this.setPreference('theme', theme);
            this.applyTheme();
        }
    }
    
    getTheme() {
        return this.getPreference('theme', 'light');
    }
    
    toggleTheme() {
        const current = this.getTheme();
        const next = current === 'light' ? 'dark' : 'light';
        this.setTheme(next);
        return next;
    }
    
    applyTheme() {
        try {
            const theme = this.getTheme();
            const body = document.body;
            
            if (body) {
                // Remove existing theme classes
                body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
                
                // Add current theme class
                body.classList.add(`theme-${theme}`);
                
                // Set CSS custom property
                document.documentElement.setAttribute('data-theme', theme);
                
                // Handle auto theme
                if (theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
                }
                
                console.log(`🎨 Theme applied: ${theme}`);
            }
        } catch (error) {
            console.error('Error applying theme:', error);
        }
    }
    
    /**
     * Search History Management
     */
    loadSearchHistory() {
        return this.localCache.get(this.searchHistoryKey) || [];
    }
    
    saveSearchHistory() {
        this.localCache.set(this.searchHistoryKey, this.searchHistory, 90 * 24 * 60); // 90 days
    }
    
    addSearchQuery(query) {
        try {
            const trimmedQuery = query.trim().toLowerCase();
            
            if (trimmedQuery.length < 2) {
                return false;
            }
            
            // Remove if already exists
            this.searchHistory = this.searchHistory.filter(q => q.query !== trimmedQuery);
            
            // Add to beginning
            this.searchHistory.unshift({
                query: trimmedQuery,
                timestamp: Date.now(),
                count: 1
            });
            
            // Keep only last 100 searches
            if (this.searchHistory.length > 100) {
                this.searchHistory.splice(100);
            }
            
            this.saveSearchHistory();
            console.log(`🔍 Search query added: ${trimmedQuery}`);
            return true;
        } catch (error) {
            console.error('Error adding search query:', error);
            return false;
        }
    }
    
    getSearchHistory() {
        return [...this.searchHistory];
    }
    
    getSearchSuggestions(query, limit = 5) {
        if (!query || query.length < 2) {
            return [];
        }
        
        const lowerQuery = query.toLowerCase();
        return this.searchHistory
            .filter(item => item.query.includes(lowerQuery))
            .slice(0, limit)
            .map(item => item.query);
    }
    
    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
        console.log('🗑️ Search history cleared');
    }
    
    /**
     * Recently Viewed Management
     */
    loadRecentlyViewed() {
        return this.localCache.get(this.recentlyViewedKey) || [];
    }
    
    saveRecentlyViewed() {
        this.localCache.set(this.recentlyViewedKey, this.recentlyViewed, 30 * 24 * 60); // 30 days
    }
    
    addRecentlyViewed(product) {
        try {
            const productData = {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image || product.image_url,
                category: product.category,
                shopkeeper: product.shopkeeper_name || product.shopkeeper,
                viewedAt: Date.now()
            };
            
            // Remove if already exists
            this.recentlyViewed = this.recentlyViewed.filter(item => item.id !== product.id);
            
            // Add to beginning
            this.recentlyViewed.unshift(productData);
            
            // Keep only last 50 items
            if (this.recentlyViewed.length > 50) {
                this.recentlyViewed.splice(50);
            }
            
            this.saveRecentlyViewed();
            console.log(`👁️ Recently viewed added: ${product.name}`);
            return true;
        } catch (error) {
            console.error('Error adding to recently viewed:', error);
            return false;
        }
    }
    
    getRecentlyViewed(limit = 10) {
        return this.recentlyViewed.slice(0, limit);
    }
    
    clearRecentlyViewed() {
        this.recentlyViewed = [];
        this.saveRecentlyViewed();
        console.log('🗑️ Recently viewed cleared');
    }
    
    /**
     * Browsing History
     */
    addToBrowsingHistory(page) {
        try {
            const history = this.localCache.get(this.browsingHistoryKey) || [];
            
            const historyEntry = {
                url: page.url || window.location.href,
                title: page.title || document.title,
                timestamp: Date.now(),
                duration: page.duration || 0
            };
            
            history.unshift(historyEntry);
            
            // Keep only last 100 pages
            if (history.length > 100) {
                history.splice(100);
            }
            
            this.localCache.set(this.browsingHistoryKey, history, 7 * 24 * 60); // 7 days
        } catch (error) {
            console.error('Error adding to browsing history:', error);
        }
    }
    
    getBrowsingHistory() {
        return this.localCache.get(this.browsingHistoryKey) || [];
    }
    
    /**
     * Apply preference change
     */
    applyPreferenceChange(key, value, oldValue) {
        try {
            switch (key) {
                case 'theme':
                    this.applyTheme();
                    break;
                    
                case 'fontSize':
                    this.applyFontSize(value);
                    break;
                    
                case 'highContrast':
                    this.applyHighContrast(value);
                    break;
                    
                case 'reducedMotion':
                    this.applyReducedMotion(value);
                    break;
                    
                case 'compactMode':
                    this.applyCompactMode(value);
                    break;
                    
                case 'sidebarCollapsed':
                    this.applySidebarState(value);
                    break;
            }
            
            // Dispatch preference change event
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('preferenceChanged', {
                    detail: { key, value, oldValue }
                });
                window.dispatchEvent(event);
            }
        } catch (error) {
            console.error('Error applying preference change:', error);
        }
    }
    
    /**
     * Apply all preferences
     */
    applyAllPreferences() {
        this.applyTheme();
        this.applyFontSize(this.getPreference('fontSize'));
        this.applyHighContrast(this.getPreference('highContrast'));
        this.applyReducedMotion(this.getPreference('reducedMotion'));
        this.applyCompactMode(this.getPreference('compactMode'));
    }
    
    /**
     * Apply font size
     */
    applyFontSize(size) {
        const body = document.body;
        if (body) {
            body.classList.remove('font-small', 'font-medium', 'font-large');
            body.classList.add(`font-${size}`);
        }
    }
    
    /**
     * Apply high contrast
     */
    applyHighContrast(enabled) {
        const body = document.body;
        if (body) {
            body.classList.toggle('high-contrast', enabled);
        }
    }
    
    /**
     * Apply reduced motion
     */
    applyReducedMotion(enabled) {
        const body = document.body;
        if (body) {
            body.classList.toggle('reduced-motion', enabled);
        }
    }
    
    /**
     * Apply compact mode
     */
    applyCompactMode(enabled) {
        const body = document.body;
        if (body) {
            body.classList.toggle('compact-mode', enabled);
        }
    }
    
    /**
     * Apply sidebar state
     */
    applySidebarState(collapsed) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed', collapsed);
        }
    }
    
    /**
     * Import/Export
     */
    export() {
        return {
            preferences: this.preferences,
            searchHistory: this.searchHistory,
            recentlyViewed: this.recentlyViewed,
            browsingHistory: this.getBrowsingHistory(),
            exportedAt: new Date().toISOString()
        };
    }
    
    import(data, overwrite = false) {
        try {
            if (data.preferences) {
                if (overwrite) {
                    this.preferences = { ...data.preferences };
                } else {
                    this.preferences = { ...this.preferences, ...data.preferences };
                }
                this.savePreferences();
                this.applyAllPreferences();
            }
            
            if (data.searchHistory && overwrite) {
                this.searchHistory = [...data.searchHistory];
                this.saveSearchHistory();
            }
            
            if (data.recentlyViewed && overwrite) {
                this.recentlyViewed = [...data.recentlyViewed];
                this.saveRecentlyViewed();
            }
            
            console.log('📥 Preferences imported successfully');
            return true;
        } catch (error) {
            console.error('Error importing preferences:', error);
            return false;
        }
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            totalPreferences: Object.keys(this.preferences).length,
            searchQueries: this.searchHistory.length,
            recentlyViewedItems: this.recentlyViewed.length,
            browsingHistoryPages: this.getBrowsingHistory().length,
            theme: this.getTheme(),
            lastUpdated: this.preferences.lastUpdated
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersistentPreferencesManager;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.PersistentPreferencesManager = PersistentPreferencesManager;
}