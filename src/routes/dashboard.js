const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { query } = require('../config/database');

// Customer Dashboard
router.get('/customer', 
  auth.authenticateUser,
  auth.isCustomer,
  async (req, res) => {
    try {
      // Fetch customer's orders
      const orders = await query(
        `SELECT o.*, array_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'price', oi.price_at_time)) as items 
         FROM orders o 
         JOIN order_items oi ON o.id = oi.order_id 
         JOIN products p ON oi.product_id = p.id 
         WHERE o.customer_id = $1 
         GROUP BY o.id 
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );

      res.render('dashboard/customer', {
        title: 'Customer Dashboard',
        orders: orders.rows,
        user: req.user
      });
    } catch (error) {
      console.error('Error fetching customer dashboard:', error);
      res.status(500).json({ message: 'Error loading dashboard' });
    }
});

// Shopkeeper Dashboard
router.get('/shopkeeper',
  auth.authenticateUser,
  auth.isShopkeeper,
  async (req, res) => {
    try {
      // Fetch shopkeeper's products and recent orders
      const products = await query(
        'SELECT * FROM products WHERE shopkeeper_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      );

      const orders = await query(
        `SELECT o.*, array_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'price', oi.price_at_time)) as items 
         FROM orders o 
         JOIN order_items oi ON o.id = oi.order_id 
         JOIN products p ON oi.product_id = p.id 
         WHERE p.shopkeeper_id = $1 
         GROUP BY o.id 
         ORDER BY o.created_at DESC 
         LIMIT 10`,
        [req.user.id]
      );

      res.render('dashboard/shopkeeper', {
        title: 'Shopkeeper Dashboard',
        products: products.rows,
        recentOrders: orders.rows,
        user: req.user
      });
    } catch (error) {
      console.error('Error fetching shopkeeper dashboard:', error);
      res.status(500).json({ message: 'Error loading dashboard' });
    }
});

// Admin Dashboard
router.get('/admin',
  auth.authenticateUser,
  auth.isAdmin,
  async (req, res) => {
    try {
      // Fetch summary statistics
      const stats = await query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
          (SELECT COUNT(*) FROM users WHERE role = 'shopkeeper') as total_shopkeepers,
          (SELECT COUNT(*) FROM products) as total_products,
          (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders
      `);

      // Fetch recent orders
      const recentOrders = await query(
        `SELECT o.*, u.name as customer_name, array_agg(json_build_object('name', p.name, 'quantity', oi.quantity)) as items 
         FROM orders o 
         JOIN users u ON o.customer_id = u.id 
         JOIN order_items oi ON o.id = oi.order_id 
         JOIN products p ON oi.product_id = p.id 
         GROUP BY o.id, u.name 
         ORDER BY o.created_at DESC 
         LIMIT 10`
      );

      res.render('dashboard/admin', {
        title: 'Admin Dashboard',
        stats: stats.rows[0],
        recentOrders: recentOrders.rows,
        user: req.user
      });
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      res.status(500).json({ message: 'Error loading dashboard' });
    }
});

module.exports = router;