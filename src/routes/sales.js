const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const salesController = require('../controllers/salesController');

// All routes require admin authentication
router.use(auth.authenticateUser, auth.isAdmin);

// Dashboard data
router.get('/dashboard', salesController.getDashboardData);

// Export sales report
router.get('/export', salesController.exportReport);

module.exports = router;