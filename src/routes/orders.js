const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Validation middleware
const orderValidation = [
  body('delivery_address').trim().notEmpty().withMessage('Delivery address is required'),
  body('payment_method')
    .isIn(['cod', 'upi', 'card'])
    .withMessage('Invalid payment method')
];

const statusValidation = [
  body('status')
    .isIn(['processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status'),
  body('message').optional().trim()
];

// Protected routes
router.use(auth.authenticateUser);

// Routes for all authenticated users
router.get('/history', orderController.getOrderHistory);
router.get('/:id', orderController.getOrder);

// Routes for customers only
router.post('/',
  auth.isCustomer,
  orderValidation,
  orderController.createOrder
);

// Routes for shopkeepers only
router.patch('/:id/status',
  auth.isShopkeeper,
  statusValidation,
  orderController.updateStatus
);

module.exports = router;