const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const disputeController = require('../controllers/disputeController');

// Validation middleware
const disputeValidation = [
  body('order_id').isInt().withMessage('Invalid order ID'),
  body('title')
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters'),
  body('description')
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long'),
  body('type')
    .isIn(['order_issue', 'product_quality', 'delivery', 'payment', 'other'])
    .withMessage('Invalid dispute type')
];

const updateValidation = [
  body('status')
    .optional()
    .isIn(['open', 'in_progress', 'resolved', 'closed'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('assigned_to')
    .optional()
    .isInt()
    .withMessage('Invalid assignee ID')
];

const commentValidation = [
  body('comment')
    .isLength({ min: 1 })
    .withMessage('Comment cannot be empty'),
  body('is_internal')
    .optional()
    .isBoolean()
    .withMessage('is_internal must be a boolean')
];

// All routes require authentication
router.use(auth.authenticateUser);

// Create dispute
router.post('/', disputeValidation, disputeController.createDispute);

// Get disputes list
router.get('/', disputeController.getDisputes);

// Get dispute details
router.get('/:id', disputeController.getDisputeDetails);

// Update dispute
router.put('/:id', updateValidation, disputeController.updateDispute);

// Add comment
router.post('/:id/comments', commentValidation, disputeController.addComment);

// Upload attachments
router.post('/:id/attachments', disputeController.uploadAttachments);

module.exports = router;