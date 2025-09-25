const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        const token = req.session.token;
        if (!token) {
            return res.redirect('/auth/login');
        }

        const decoded = jwt.verify(token, 'your-jwt-secret');
        req.user = decoded;
        next();
    } catch (err) {
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