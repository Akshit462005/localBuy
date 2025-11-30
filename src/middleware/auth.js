const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        // Try to get token from session first, then from cookie as backup
        let token = req.session?.token || req.cookies?.auth_token;
        
        if (!token) {
            console.log('No token found in session or cookies, sessionID:', req.sessionID);
            return res.redirect('/auth/login');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production');
        req.user = decoded;
        
        // If token came from cookie but not session, restore session
        if (!req.session?.token && req.cookies?.auth_token) {
            req.session.token = token;
            console.log('Restored token to session from cookie');
        }
        
        next();
    } catch (err) {
        console.log('JWT verification failed:', err.message);
        req.session?.destroy?.();
        res.clearCookie('auth_token');
        res.redirect('/auth/login');
    }
};

const isShopkeeper = (req, res, next) => {
    if (req.user && req.user.role === 'shopkeeper') {
        next();
    } else {
        res.status(403).render('error', { message: 'Access denied. Shopkeeper only.' });
    }
};

const isUser = (req, res, next) => {
    if (req.user && req.user.role === 'user') {
        next();
    } else {
        res.status(403).render('error', { message: 'Access denied. User only.' });
    }
};

module.exports = { auth, isShopkeeper, isUser };