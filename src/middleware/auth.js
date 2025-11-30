const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        const token = req.session?.token;
        if (!token) {
            console.log('No token found in session:', req.sessionID);
            return res.redirect('/auth/login');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production');
        req.user = decoded;
        next();
    } catch (err) {
        console.log('JWT verification failed:', err.message);
        req.session?.destroy?.();
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