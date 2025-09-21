const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');

const adminController = {
  // Get all users with filtering and pagination
  getUsers: async (req, res) => {
    try {
      const { role, search, page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;
      
      let conditions = [];
      let values = [];
      let valueIndex = 1;

      if (role) {
        conditions.push(`role = $${valueIndex}`);
        values.push(role);
        valueIndex++;
      }

      if (search) {
        conditions.push(`(name ILIKE $${valueIndex} OR email ILIKE $${valueIndex})`);
        values.push(`%${search}%`);
        valueIndex++;
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) FROM users ${whereClause}`,
        values
      );

      const totalUsers = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalUsers / limit);

      // Get users
      const users = await query(
        `SELECT id, name, email, role, created_at 
         FROM users 
         ${whereClause}
         ORDER BY created_at DESC 
         LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`,
        [...values, limit, offset]
      );

      res.json({
        users: users.rows,
        pagination: {
          total: totalUsers,
          page: parseInt(page),
          totalPages,
          hasMore: page < totalPages
        }
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Error fetching users' });
    }
  },

  // Get user details including their activity
  getUserDetails: async (req, res) => {
    try {
      const { id } = req.params;

      // Get user details
      const userResult = await query(
        `SELECT id, name, email, role, created_at 
         FROM users 
         WHERE id = $1`,
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = userResult.rows[0];

      // Get additional data based on user role
      let activity = {};

      if (user.role === 'customer') {
        // Get order history
        const orders = await query(
          `SELECT COUNT(*) as total_orders, 
                  SUM(total_price) as total_spent,
                  COUNT(*) FILTER (WHERE status = 'delivered') as completed_orders
           FROM orders 
           WHERE customer_id = $1`,
          [id]
        );
        activity.orders = orders.rows[0];

      } else if (user.role === 'shopkeeper') {
        // Get product and order stats
        const products = await query(
          `SELECT COUNT(*) as total_products,
                  SUM(stock) as total_stock
           FROM products 
           WHERE shopkeeper_id = $1`,
          [id]
        );
        
        const sales = await query(
          `SELECT COUNT(DISTINCT o.id) as total_sales,
                  SUM(oi.quantity * oi.price_at_time) as total_revenue
           FROM orders o
           JOIN order_items oi ON o.id = oi.order_id
           JOIN products p ON oi.product_id = p.id
           WHERE p.shopkeeper_id = $1 AND o.status = 'delivered'`,
          [id]
        );

        activity.products = products.rows[0];
        activity.sales = sales.rows[0];
      }

      res.json({
        user,
        activity
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({ message: 'Error fetching user details' });
    }
  },

  // Update user role or status
  updateUser: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { role, password } = req.body;

      let updateQuery = 'UPDATE users SET';
      let updateValues = [];
      let valueIndex = 1;

      if (role) {
        updateQuery += ` role = $${valueIndex},`;
        updateValues.push(role);
        valueIndex++;
      }

      if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateQuery += ` password = $${valueIndex},`;
        updateValues.push(hashedPassword);
        valueIndex++;
      }

      // Remove trailing comma
      updateQuery = updateQuery.slice(0, -1);
      updateQuery += ` WHERE id = $${valueIndex} RETURNING id, name, email, role, created_at`;
      updateValues.push(id);

      const result = await query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Error updating user' });
    }
  },

  // Delete user
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if user exists
      const userCheck = await query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Don't allow deleting other admins
      if (userCheck.rows[0].role === 'admin') {
        return res.status(403).json({ message: 'Cannot delete admin users' });
      }

      // Start transaction
      await query('BEGIN');

      try {
        // Delete user's data based on their role
        if (userCheck.rows[0].role === 'shopkeeper') {
          // Delete products
          await query('DELETE FROM products WHERE shopkeeper_id = $1', [id]);
        } else if (userCheck.rows[0].role === 'customer') {
          // Delete cart items
          await query('DELETE FROM cart WHERE customer_id = $1', [id]);
          // Mark orders as 'cancelled'
          await query(
            "UPDATE orders SET status = 'cancelled' WHERE customer_id = $1",
            [id]
          );
        }

        // Delete user
        await query('DELETE FROM users WHERE id = $1', [id]);

        await query('COMMIT');
        res.json({ message: 'User deleted successfully' });
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Error deleting user' });
    }
  }
};

module.exports = adminController;