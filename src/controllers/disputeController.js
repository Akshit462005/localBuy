const { query } = require('../config/database');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = 'uploads/disputes';
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only jpeg, jpg, png, and pdf files are allowed'));
  }
}).array('attachments', 5); // Max 5 files

const disputeController = {
  // Create a new dispute
  createDispute: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { order_id, title, description, type } = req.body;
      const customer_id = req.user.id;

      // Get shopkeeper_id from order
      const orderResult = await query(
        `SELECT DISTINCT u.id as shopkeeper_id
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         JOIN users u ON p.shopkeeper_id = u.id
         WHERE o.id = $1 AND o.customer_id = $2`,
        [order_id, customer_id]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Start transaction
      const client = await query.getClient();
      try {
        await client.query('BEGIN');

        // Create dispute
        const disputeResult = await client.query(
          `INSERT INTO disputes 
           (order_id, customer_id, shopkeeper_id, title, description, type)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [order_id, customer_id, orderResult.rows[0].shopkeeper_id, title, description, type]
        );

        const dispute = disputeResult.rows[0];

        // Handle file uploads
        if (req.files && req.files.length > 0) {
          const attachmentPromises = req.files.map(file =>
            client.query(
              `INSERT INTO dispute_attachments 
               (dispute_id, file_name, file_path, file_type, uploaded_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                dispute.id,
                file.originalname,
                file.path,
                file.mimetype,
                customer_id
              ]
            )
          );

          await Promise.all(attachmentPromises);
        }

        // Add initial comment if provided
        if (req.body.comment) {
          await client.query(
            `INSERT INTO dispute_comments (dispute_id, user_id, comment)
             VALUES ($1, $2, $3)`,
            [dispute.id, customer_id, req.body.comment]
          );
        }

        await client.query('COMMIT');
        res.status(201).json(dispute);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error creating dispute:', error);
      res.status(500).json({ message: 'Error creating dispute' });
    }
  },

  // Get disputes with filtering and pagination
  getDisputes: async (req, res) => {
    try {
      const {
        status,
        priority,
        type,
        assigned_to,
        page = 1,
        limit = 10,
        sort = 'created_at',
        order = 'DESC'
      } = req.query;

      const offset = (page - 1) * limit;
      let conditions = [];
      let values = [];
      let valueIndex = 1;

      // Add filters based on user role
      if (req.user.role === 'customer') {
        conditions.push(`d.customer_id = $${valueIndex}`);
        values.push(req.user.id);
        valueIndex++;
      } else if (req.user.role === 'shopkeeper') {
        conditions.push(`d.shopkeeper_id = $${valueIndex}`);
        values.push(req.user.id);
        valueIndex++;
      }

      if (status) {
        conditions.push(`d.status = $${valueIndex}`);
        values.push(status);
        valueIndex++;
      }

      if (priority) {
        conditions.push(`d.priority = $${valueIndex}`);
        values.push(priority);
        valueIndex++;
      }

      if (type) {
        conditions.push(`d.type = $${valueIndex}`);
        values.push(type);
        valueIndex++;
      }

      if (assigned_to) {
        conditions.push(`d.assigned_to = $${valueIndex}`);
        values.push(assigned_to);
        valueIndex++;
      }

      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) 
         FROM disputes d
         ${whereClause}`,
        values
      );

      // Get disputes with related data
      const disputes = await query(
        `SELECT 
           d.*,
           c.name as customer_name,
           s.name as shopkeeper_name,
           a.name as assigned_to_name,
           o.order_number,
           (SELECT COUNT(*) FROM dispute_comments dc WHERE dc.dispute_id = d.id) as comment_count,
           (SELECT COUNT(*) FROM dispute_attachments da WHERE da.dispute_id = d.id) as attachment_count
         FROM disputes d
         JOIN users c ON d.customer_id = c.id
         JOIN users s ON d.shopkeeper_id = s.id
         JOIN orders o ON d.order_id = o.id
         LEFT JOIN users a ON d.assigned_to = a.id
         ${whereClause}
         ORDER BY d.${sort} ${order}
         LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`,
        [...values, limit, offset]
      );

      const totalDisputes = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalDisputes / limit);

      res.json({
        disputes: disputes.rows,
        pagination: {
          current: parseInt(page),
          total: totalDisputes,
          totalPages,
          hasMore: page < totalPages
        }
      });
    } catch (error) {
      console.error('Error fetching disputes:', error);
      res.status(500).json({ message: 'Error fetching disputes' });
    }
  },

  // Get dispute details
  getDisputeDetails: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get dispute details
      const disputeResult = await query(
        `SELECT 
           d.*,
           c.name as customer_name,
           s.name as shopkeeper_name,
           a.name as assigned_to_name,
           o.order_number,
           o.total_amount as order_amount,
           o.created_at as order_date
         FROM disputes d
         JOIN users c ON d.customer_id = c.id
         JOIN users s ON d.shopkeeper_id = s.id
         JOIN orders o ON d.order_id = o.id
         LEFT JOIN users a ON d.assigned_to = a.id
         WHERE d.id = $1`,
        [id]
      );

      if (disputeResult.rows.length === 0) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      const dispute = disputeResult.rows[0];

      // Check access permission
      if (!['admin'].includes(req.user.role) && 
          req.user.id !== dispute.customer_id && 
          req.user.id !== dispute.shopkeeper_id &&
          req.user.id !== dispute.assigned_to) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get comments
      const comments = await query(
        `SELECT 
           dc.*,
           u.name as user_name,
           u.role as user_role
         FROM dispute_comments dc
         JOIN users u ON dc.user_id = u.id
         WHERE dc.dispute_id = $1
         ORDER BY dc.created_at ASC`,
        [id]
      );

      // Get attachments
      const attachments = await query(
        `SELECT 
           da.*,
           u.name as uploaded_by_name
         FROM dispute_attachments da
         JOIN users u ON da.uploaded_by = u.id
         WHERE da.dispute_id = $1
         ORDER BY da.created_at ASC`,
        [id]
      );

      // Get history
      const history = await query(
        `SELECT 
           dh.*,
           u.name as changed_by_name,
           old_u.name as old_assigned_name,
           new_u.name as new_assigned_name
         FROM dispute_history dh
         JOIN users u ON dh.changed_by = u.id
         LEFT JOIN users old_u ON dh.old_assigned_to = old_u.id
         LEFT JOIN users new_u ON dh.new_assigned_to = new_u.id
         WHERE dh.dispute_id = $1
         ORDER BY dh.created_at DESC`,
        [id]
      );

      res.json({
        dispute,
        comments: comments.rows,
        attachments: attachments.rows,
        history: history.rows
      });
    } catch (error) {
      console.error('Error fetching dispute details:', error);
      res.status(500).json({ message: 'Error fetching dispute details' });
    }
  },

  // Update dispute
  updateDispute: async (req, res) => {
    const client = await query.getClient();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status, priority, assigned_to } = req.body;
      const updatedBy = req.user.id;

      await client.query('BEGIN');

      // Get current dispute state
      const currentDispute = await client.query(
        'SELECT * FROM disputes WHERE id = $1',
        [id]
      );

      if (currentDispute.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Dispute not found' });
      }

      const dispute = currentDispute.rows[0];

      // Build update query
      let updates = [];
      let values = [id];
      let valueIndex = 2;

      if (status) {
        updates.push(`status = $${valueIndex}`);
        values.push(status);
        valueIndex++;
      }

      if (priority) {
        updates.push(`priority = $${valueIndex}`);
        values.push(priority);
        valueIndex++;
      }

      if (assigned_to) {
        updates.push(`assigned_to = $${valueIndex}`);
        values.push(assigned_to);
        valueIndex++;
      }

      if (status === 'resolved') {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'No updates provided' });
      }

      // Update dispute
      const updateResult = await client.query(
        `UPDATE disputes 
         SET ${updates.join(', ')} 
         WHERE id = $1
         RETURNING *`,
        values
      );

      // Record history
      await client.query(
        `INSERT INTO dispute_history 
         (dispute_id, changed_by, old_status, new_status, 
          old_priority, new_priority, old_assigned_to, new_assigned_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          updatedBy,
          dispute.status,
          status || dispute.status,
          dispute.priority,
          priority || dispute.priority,
          dispute.assigned_to,
          assigned_to || dispute.assigned_to
        ]
      );

      await client.query('COMMIT');
      res.json(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating dispute:', error);
      res.status(500).json({ message: 'Error updating dispute' });
    } finally {
      client.release();
    }
  },

  // Add comment to dispute
  addComment: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { comment, is_internal } = req.body;
      const user_id = req.user.id;

      // Check if dispute exists and user has access
      const disputeCheck = await query(
        `SELECT customer_id, shopkeeper_id, assigned_to 
         FROM disputes 
         WHERE id = $1`,
        [id]
      );

      if (disputeCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Dispute not found' });
      }

      const dispute = disputeCheck.rows[0];

      // Check access permission
      if (!['admin'].includes(req.user.role) && 
          user_id !== dispute.customer_id && 
          user_id !== dispute.shopkeeper_id &&
          user_id !== dispute.assigned_to) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Add comment
      const result = await query(
        `INSERT INTO dispute_comments (dispute_id, user_id, comment, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, user_id, comment, is_internal && req.user.role === 'admin']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Error adding comment' });
    }
  },

  // Upload attachments
  uploadAttachments: async (req, res) => {
    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: err.message });
      }

      try {
        const { id } = req.params;
        const user_id = req.user.id;

        // Check if dispute exists and user has access
        const disputeCheck = await query(
          `SELECT customer_id, shopkeeper_id, assigned_to 
           FROM disputes 
           WHERE id = $1`,
          [id]
        );

        if (disputeCheck.rows.length === 0) {
          return res.status(404).json({ message: 'Dispute not found' });
        }

        const dispute = disputeCheck.rows[0];

        // Check access permission
        if (!['admin'].includes(req.user.role) && 
            user_id !== dispute.customer_id && 
            user_id !== dispute.shopkeeper_id &&
            user_id !== dispute.assigned_to) {
          return res.status(403).json({ message: 'Access denied' });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: 'No files uploaded' });
        }

        // Save attachments to database
        const attachmentPromises = req.files.map(file =>
          query(
            `INSERT INTO dispute_attachments 
             (dispute_id, file_name, file_path, file_type, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
              id,
              file.originalname,
              file.path,
              file.mimetype,
              user_id
            ]
          )
        );

        const results = await Promise.all(attachmentPromises);
        res.status(201).json(results.map(r => r.rows[0]));
      } catch (error) {
        console.error('Error uploading attachments:', error);
        res.status(500).json({ message: 'Error uploading attachments' });
      }
    });
  }
};

module.exports = disputeController;