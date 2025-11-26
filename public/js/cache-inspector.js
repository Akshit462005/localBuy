/**
 * LocalBuy Cache Inspector
 * Run this in your browser console to inspect cache data
 */

(function() {
    'use strict';
    
    // Styles for console output
    const styles = {
        header: 'color: #4CAF50; font-weight: bold; font-size: 16px;',
        section: 'color: #2196F3; font-weight: bold; font-size: 14px;',
        key: 'color: #FF9800; font-weight: bold;',
        value: 'color: #9C27B0;',
        empty: 'color: #757575; font-style: italic;',
        stats: 'color: #F44336; font-weight: bold;'
    };
    
    console.log('%c🚀 LocalBuy Cache Inspector', styles.header);
    console.log('%c================================', styles.header);
    
    if (!window.cache) {
        console.log('%c❌ Cache system not initialized!', styles.stats);
        console.log('Make sure you\'re on a page with cache.js loaded.');
        return;
    }
    
    // Cache Statistics
    console.log('%c\n📊 Cache Statistics:', styles.section);
    const stats = window.cache.getStats();
    console.log('%cTotal Items: %c' + stats.itemCount, styles.key, styles.value);
    console.log('%cCache Size: %c' + stats.sizeMB + ' MB', styles.key, styles.value);
    console.log('%cSupported: %c' + stats.supported, styles.key, styles.value);
    
    // All Cache Data
    console.log('%c\n🗂️ All Cache Data:', styles.section);
    const allData = window.cache.getAll();
    if (Object.keys(allData).length === 0) {
        console.log('%cNo cache data found', styles.empty);
    } else {
        Object.entries(allData).forEach(([key, value]) => {
            console.log('%c' + key + ': %c', styles.key, styles.value, value);
        });
    }
    
    // Shopping Cart
    console.log('%c\n🛒 Shopping Cart:', styles.section);
    if (window.cartManager) {
        const cartItems = window.cartManager.getItems();
        if (cartItems.length === 0) {
            console.log('%cCart is empty', styles.empty);
        } else {
            console.log('%cCart Items:', styles.key, cartItems);
            console.log('%cCart Total: %c$' + window.cartManager.getTotal(), styles.key, styles.value);
        }
    } else {
        console.log('%cCart Manager not available', styles.empty);
    }
    
    // User Session
    console.log('%c\n👤 User Session:', styles.section);
    if (window.userSessionManager) {
        const userData = window.userSessionManager.getUserData();
        if (userData) {
            console.log('%cUser Data:', styles.key, userData);
        } else {
            console.log('%cNo user logged in', styles.empty);
        }
        
        const preferences = window.userSessionManager.getAllPreferences();
        if (Object.keys(preferences).length > 0) {
            console.log('%cPreferences:', styles.key, preferences);
        } else {
            console.log('%cNo preferences saved', styles.empty);
        }
    } else {
        console.log('%cSession Manager not available', styles.empty);
    }
    
    // Search History
    console.log('%c\n🔍 Search History:', styles.section);
    const searchHistory = window.cache.get('search_history');
    if (searchHistory && searchHistory.length > 0) {
        console.log('%cRecent Searches:', styles.key, searchHistory);
    } else {
        console.log('%cNo search history', styles.empty);
    }
    
    // Recently Viewed
    console.log('%c\n👁️ Recently Viewed:', styles.section);
    const recentlyViewed = window.cache.get('recently_viewed');
    if (recentlyViewed && recentlyViewed.length > 0) {
        console.log('%cRecently Viewed Products:', styles.key, recentlyViewed);
    } else {
        console.log('%cNo recently viewed products', styles.empty);
    }
    
    // Session Storage Raw Data
    console.log('%c\n💾 Session Storage (Raw):', styles.section);
    const sessionStorageData = {};
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key.startsWith('localbuy_')) {
            try {
                sessionStorageData[key] = JSON.parse(sessionStorage.getItem(key));
            } catch (e) {
                sessionStorageData[key] = sessionStorage.getItem(key);
            }
        }
    }
    
    if (Object.keys(sessionStorageData).length > 0) {
        console.log('%cLocalBuy Session Storage:', styles.key, sessionStorageData);
    } else {
        console.log('%cNo LocalBuy data in session storage', styles.empty);
    }
    
    // Utility Functions
    console.log('%c\n🛠️ Utility Functions:', styles.section);
    console.log('%cwindow.inspectCache() %c- Run this function anytime to inspect cache', styles.key, styles.value);
    console.log('%cwindow.clearCache() %c- Clear all cache data', styles.key, styles.value);
    console.log('%cwindow.exportCache() %c- Export cache data as JSON', styles.key, styles.value);
    
    // Add utility functions to window
    window.inspectCache = function() {
        console.clear();
        // Re-run this script
        eval(arguments.callee.toString().replace('(function() {', '').replace(/}\)\(\);$/, ''));
    };
    
    window.clearCache = function() {
        if (window.cache) window.cache.clear();
        if (window.cartManager) window.cartManager.clearCart();
        if (window.userSessionManager) window.userSessionManager.clearAllPreferences();
        console.log('%c🗑️ Cache cleared!', styles.stats);
    };
    
    window.exportCache = function() {
        const exportData = {
            timestamp: new Date().toISOString(),
            stats: window.cache ? window.cache.getStats() : {},
            allCache: window.cache ? window.cache.getAll() : {},
            cart: window.cartManager ? window.cartManager.getItems() : [],
            session: window.userSessionManager ? {
                userData: window.userSessionManager.getUserData(),
                preferences: window.userSessionManager.getAllPreferences()
            } : {},
            sessionStorage: sessionStorageData
        };
        
        console.log('%c📥 Cache Export Data:', styles.stats, exportData);
        return exportData;
    };
    
    console.log('%c\n✅ Cache inspection complete!', styles.header);
    
})();