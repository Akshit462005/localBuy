const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const auth = {
    authenticateUser: async (req, res, next) => {
        const token = req.cookies.token;
        if (!token) {
            return res.redirect('/auth/login');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await query(
                'SELECT id, name, email, role FROM users WHERE id = $1',
                [decoded.id]
            );

            if (user.rows.length === 0) {
                res.clearCookie('token');
                return res.redirect('/auth/login');
            }

            req.user = user.rows[0];
            res.locals.user = user.rows[0];
            next();
        } catch (error) {
            res.clearCookie('token');
            return res.redirect('/auth/login');
        }
    },

    redirectIfNotAuthenticated: (req, res, next) => {
        if (!req.cookies.token) {
            return res.redirect('/auth/login');
        }
        next();
    },

    redirectIfAuthenticated: (req, res, next) => {
        if (req.cookies.token) {
            return res.redirect('/dashboard');
        }
        next();
    },

    authorizeRole: (roles) => {
        if (typeof roles === 'string') {
            roles = [roles];
        }
        return (req, res, next) => {
            if (!req.user) {
                return res.redirect('/auth/login');
            }
            if (!roles.includes(req.user.role)) {
                return res.redirect('/dashboard');
            }
            next();
        };
    },

    isAdmin: (req, res, next) => {
        return auth.authorizeRole('admin')(req, res, next);
    },

    isCustomer: (req, res, next) => {
        return auth.authorizeRole('customer')(req, res, next);
    },

    isShopkeeper: (req, res, next) => {
        return auth.authorizeRole('shopkeeper')(req, res, next);
    }
};

module.exports = auth;