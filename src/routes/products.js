const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

// Validation middleware
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('gender').optional().isIn(['male', 'female', 'unisex']).withMessage('Invalid gender'),
  body('age_range').optional().trim(),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
];

// Public routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProduct);

// Protected routes (shopkeeper only)
router.post('/',
  auth.authenticateUser,
  auth.isShopkeeper,
  productValidation,
  productController.createProduct
);

router.put('/:id',
  auth.authenticateUser,
  auth.isShopkeeper,
  productValidation,
  productController.updateProduct
);

router.delete('/:id',
  auth.authenticateUser,
  auth.isShopkeeper,
  productController.deleteProduct
);

router.patch('/:id/stock',
  auth.authenticateUser,
  auth.isShopkeeper,
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  productController.updateStock
);

module.exports = router;