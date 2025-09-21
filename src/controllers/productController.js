const { query } = require('../config/database');
const { validationResult } = require('express-validator');

const productController = {
  // Get all products with filtering
  getAllProducts: async (req, res) => {
    try {
      const { category, gender, age_range, minPrice, maxPrice } = req.query;
      let conditions = [];
      let values = [];
      let valueIndex = 1;

      if (category) {
        conditions.push(`category = $${valueIndex}`);
        values.push(category);
        valueIndex++;
      }

      if (gender) {
        conditions.push(`gender = $${valueIndex}`);
        values.push(gender);
        valueIndex++;
      }

      if (age_range) {
        conditions.push(`age_range = $${valueIndex}`);
        values.push(age_range);
        valueIndex++;
      }

      if (minPrice) {
        conditions.push(`price >= $${valueIndex}`);
        values.push(minPrice);
        valueIndex++;
      }

      if (maxPrice) {
        conditions.push(`price <= $${valueIndex}`);
        values.push(maxPrice);
        valueIndex++;
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
      
      const result = await query(
        `SELECT p.*, u.name as shopkeeper_name 
         FROM products p 
         JOIN users u ON p.shopkeeper_id = u.id 
         ${whereClause} 
         ORDER BY p.created_at DESC`,
        values
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Error fetching products' });
    }
  },

  // Get a single product
  getProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT p.*, u.name as shopkeeper_name 
         FROM products p 
         JOIN users u ON p.shopkeeper_id = u.id 
         WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: 'Error fetching product' });
    }
  },

  // Create a new product
  createProduct: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        description,
        price,
        category,
        gender,
        age_range,
        stock
      } = req.body;

      const result = await query(
        `INSERT INTO products 
         (name, description, price, category, gender, age_range, stock, shopkeeper_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, description, price, category, gender, age_range, stock, req.user.id]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Error creating product' });
    }
  },

  // Update a product
  updateProduct: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        name,
        description,
        price,
        category,
        gender,
        age_range,
        stock
      } = req.body;

      // Check if product exists and belongs to the shopkeeper
      const checkProduct = await query(
        'SELECT * FROM products WHERE id = $1 AND shopkeeper_id = $2',
        [id, req.user.id]
      );

      if (checkProduct.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found or unauthorized' });
      }

      const result = await query(
        `UPDATE products 
         SET name = $1, description = $2, price = $3, category = $4, 
             gender = $5, age_range = $6, stock = $7
         WHERE id = $8 AND shopkeeper_id = $9
         RETURNING *`,
        [name, description, price, category, gender, age_range, stock, id, req.user.id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Error updating product' });
    }
  },

  // Delete a product
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if product exists and belongs to the shopkeeper
      const checkProduct = await query(
        'SELECT * FROM products WHERE id = $1 AND shopkeeper_id = $2',
        [id, req.user.id]
      );

      if (checkProduct.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found or unauthorized' });
      }

      await query('DELETE FROM products WHERE id = $1 AND shopkeeper_id = $2', [id, req.user.id]);

      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Error deleting product' });
    }
  },

  // Update product stock
  updateStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { stock } = req.body;

      if (typeof stock !== 'number' || stock < 0) {
        return res.status(400).json({ message: 'Invalid stock value' });
      }

      const result = await query(
        'UPDATE products SET stock = $1 WHERE id = $2 AND shopkeeper_id = $3 RETURNING *',
        [stock, id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found or unauthorized' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating stock:', error);
      res.status(500).json({ message: 'Error updating stock' });
    }
  }
};

module.exports = productController;