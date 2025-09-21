const { query } = require('../config/database');

const cartController = {
  // Get cart items
  getCart: async (req, res) => {
    try {
      const result = await query(
        `SELECT c.id, c.quantity, p.*, u.name as shopkeeper_name
         FROM cart c
         JOIN products p ON c.product_id = p.id
         JOIN users u ON p.shopkeeper_id = u.id
         WHERE c.customer_id = $1`,
        [req.user.id]
      );

      const total = result.rows.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);

      res.json({
        items: result.rows,
        total: parseFloat(total.toFixed(2))
      });
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Error fetching cart' });
    }
  },

  // Add item to cart
  addToCart: async (req, res) => {
    try {
      const { productId, quantity = 1 } = req.body;

      // Check if product exists and has enough stock
      const productCheck = await query(
        'SELECT * FROM products WHERE id = $1',
        [productId]
      );

      if (productCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const product = productCheck.rows[0];
      if (product.stock < quantity) {
        return res.status(400).json({ message: 'Not enough stock available' });
      }

      // Check if item already exists in cart
      const cartCheck = await query(
        'SELECT * FROM cart WHERE customer_id = $1 AND product_id = $2',
        [req.user.id, productId]
      );

      let result;
      if (cartCheck.rows.length > 0) {
        // Update quantity if item exists
        const newQuantity = cartCheck.rows[0].quantity + quantity;
        if (newQuantity > product.stock) {
          return res.status(400).json({ message: 'Not enough stock available' });
        }

        result = await query(
          'UPDATE cart SET quantity = $1 WHERE customer_id = $2 AND product_id = $3 RETURNING *',
          [newQuantity, req.user.id, productId]
        );
      } else {
        // Add new item to cart
        result = await query(
          'INSERT INTO cart (customer_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
          [req.user.id, productId, quantity]
        );
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Error adding to cart' });
    }
  },

  // Update cart item quantity
  updateQuantity: async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;

      if (quantity < 1) {
        return res.status(400).json({ message: 'Quantity must be at least 1' });
      }

      // Check if cart item exists and belongs to user
      const cartCheck = await query(
        `SELECT c.*, p.stock 
         FROM cart c 
         JOIN products p ON c.product_id = p.id
         WHERE c.id = $1 AND c.customer_id = $2`,
        [id, req.user.id]
      );

      if (cartCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      // Check if enough stock is available
      if (quantity > cartCheck.rows[0].stock) {
        return res.status(400).json({ message: 'Not enough stock available' });
      }

      const result = await query(
        'UPDATE cart SET quantity = $1 WHERE id = $2 AND customer_id = $3 RETURNING *',
        [quantity, id, req.user.id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating cart:', error);
      res.status(500).json({ message: 'Error updating cart' });
    }
  },

  // Remove item from cart
  removeFromCart: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await query(
        'DELETE FROM cart WHERE id = $1 AND customer_id = $2 RETURNING *',
        [id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Cart item not found' });
      }

      res.json({ message: 'Item removed from cart' });
    } catch (error) {
      console.error('Error removing from cart:', error);
      res.status(500).json({ message: 'Error removing from cart' });
    }
  },

  // Clear cart
  clearCart: async (req, res) => {
    try {
      await query(
        'DELETE FROM cart WHERE customer_id = $1',
        [req.user.id]
      );

      res.json({ message: 'Cart cleared successfully' });
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: 'Error clearing cart' });
    }
  }
};

module.exports = cartController;