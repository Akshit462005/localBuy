const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

// All routes require admin authentication
router.use(auth.authenticateUser, auth.isAdmin);

// Validation middleware
const userUpdateValidation = [
  body('role')
    .optional()
    .isIn(['customer', 'shopkeeper', 'admin'])
    .withMessage('Invalid role'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// User management routes
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id', userUpdateValidation, adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;