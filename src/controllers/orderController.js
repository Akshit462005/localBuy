const { query } = require('../config/database');
const { validationResult } = require('express-validator');

const orderController = {
  // Place new order
  createOrder: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { delivery_address, payment_method } = req.body;
      
      // Start transaction
      await query('BEGIN');

      try {
        // Get cart items
        const cartItems = await query(
          `SELECT c.*, p.price, p.stock, p.name
           FROM cart c
           JOIN products p ON c.product_id = p.id
           WHERE c.customer_id = $1`,
          [req.user.id]
        );

        if (cartItems.rows.length === 0) {
          throw new Error('Cart is empty');
        }

        // Calculate total price
        const total_price = cartItems.rows.reduce((sum, item) => {
          return sum + (item.price * item.quantity);
        }, 0);

        // Create order
        const orderResult = await query(
          `INSERT INTO orders 
           (customer_id, total_price, payment_method, status, delivery_address)
           VALUES ($1, $2, $3, 'placed', $4)
           RETURNING *`,
          [req.user.id, total_price, payment_method, delivery_address]
        );

        const order = orderResult.rows[0];

        // Create order items and update product stock
        for (const item of cartItems.rows) {
          if (item.quantity > item.stock) {
            throw new Error(`Not enough stock for ${item.name}`);
          }

          // Create order item
          await query(
            `INSERT INTO order_items 
             (order_id, product_id, quantity, price_at_time)
             VALUES ($1, $2, $3, $4)`,
            [order.id, item.product_id, item.quantity, item.price]
          );

          // Update product stock
          await query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }

        // Clear cart
        await query('DELETE FROM cart WHERE customer_id = $1', [req.user.id]);

        // Create initial order log
        await query(
          'INSERT INTO order_logs (order_id, status, message) VALUES ($1, $2, $3)',
          [order.id, 'placed', 'Order placed successfully']
        );

        // Commit transaction
        await query('COMMIT');

        res.status(201).json({
          message: 'Order placed successfully',
          order: {
            ...order,
            items: cartItems.rows.map(item => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price
            }))
          }
        });
      } catch (error) {
        // Rollback transaction on error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(error.message === 'Cart is empty' ? 400 : 500)
         .json({ message: error.message || 'Error creating order' });
    }
  },

  // Get order details
  getOrder: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if user has access to this order
      const orderQuery = req.user.role === 'customer'
        ? `SELECT o.*, u.name as customer_name,
             (SELECT json_agg(json_build_object(
               'id', oi.id,
               'name', p.name,
               'quantity', oi.quantity,
               'price', oi.price_at_time
             ))
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = o.id) as items
           FROM orders o
           JOIN users u ON o.customer_id = u.id
           WHERE o.id = $1 AND o.customer_id = $2`
        : `SELECT o.*, u.name as customer_name,
             (SELECT json_agg(json_build_object(
               'id', oi.id,
               'name', p.name,
               'quantity', oi.quantity,
               'price', oi.price_at_time
             ))
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = o.id) as items
           FROM orders o
           JOIN users u ON o.customer_id = u.id
           JOIN order_items oi ON o.id = oi.order_id
           JOIN products p ON oi.product_id = p.id
           WHERE o.id = $1 AND p.shopkeeper_id = $2
           GROUP BY o.id, u.name`;

      const result = await query(
        orderQuery,
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Get order logs
      const logsResult = await query(
        `SELECT * FROM order_logs 
         WHERE order_id = $1 
         ORDER BY created_at DESC`,
        [id]
      );

      res.json({
        ...result.rows[0],
        logs: logsResult.rows
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ message: 'Error fetching order' });
    }
  },

  // Update order status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, message } = req.body;

      const validStatuses = ['processing', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      // Check if user has access to update this order
      const orderCheck = await query(
        `SELECT o.* FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE o.id = $1 AND p.shopkeeper_id = $2
         LIMIT 1`,
        [id, req.user.id]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Order not found or unauthorized' });
      }

      // Update order status
      const result = await query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );

      // Log the status change
      await query(
        'INSERT INTO order_logs (order_id, status, message) VALUES ($1, $2, $3)',
        [id, status, message || `Order status updated to ${status}`]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Error updating order status' });
    }
  },

  // Get order history
  getOrderHistory: async (req, res) => {
    try {
      let query;
      let params = [];

      if (req.user.role === 'customer') {
        query = `
          SELECT o.*, array_agg(json_build_object(
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.price_at_time
          )) as items
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          JOIN products p ON oi.product_id = p.id
          WHERE o.customer_id = $1
          GROUP BY o.id
          ORDER BY o.created_at DESC
        `;
        params = [req.user.id];
      } else if (req.user.role === 'shopkeeper') {
        query = `
          SELECT DISTINCT o.*, u.name as customer_name,
          array_agg(json_build_object(
            'name', p.name,
            'quantity', oi.quantity,
            'price', oi.price_at_time
          )) as items
          FROM orders o
          JOIN users u ON o.customer_id = u.id
          JOIN order_items oi ON o.id = oi.order_id
          JOIN products p ON oi.product_id = p.id
          WHERE p.shopkeeper_id = $1
          GROUP BY o.id, u.name
          ORDER BY o.created_at DESC
        `;
        params = [req.user.id];
      }

      const result = await query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching order history:', error);
      res.status(500).json({ message: 'Error fetching order history' });
    }
  }
};

module.exports = orderController;