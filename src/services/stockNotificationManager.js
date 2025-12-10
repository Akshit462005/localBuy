const pool = require('../utils/database');
const { sendNotificationEmails } = require('./emailService');

/**
 * Handle stock updates and send notifications
 * @param {number} productId - Product ID
 * @param {number} newStockQuantity - New stock quantity
 * @param {number} oldStockQuantity - Old stock quantity (optional)
 */
async function handleStockUpdate(productId, newStockQuantity, oldStockQuantity = 0) {
    try {
        console.log(`📦 Stock update event: Product ${productId} - Old: ${oldStockQuantity}, New: ${newStockQuantity}`);
        
        // If stock becomes available (was 0 or null, now > 0)
        if ((oldStockQuantity === 0 || oldStockQuantity === null) && newStockQuantity > 0) {
            console.log(`🔔 Stock available for product ${productId}. Sending notifications...`);
            
            // Get product details
            const productResult = await pool.query(`
                SELECT p.name, u.username as shopkeeper_name
                FROM products p
                LEFT JOIN users u ON p.shopkeeper_id = u.id
                WHERE p.id = $1
            `, [productId]);
            
            if (productResult.rows.length === 0) {
                console.log(`❌ Product ${productId} not found`);
                return { success: false, message: 'Product not found' };
            }
            
            const product = productResult.rows[0];
            const { sent, failed } = await sendNotificationEmails(
                productId,
                product.name,
                product.shopkeeper_name
            );
            
            return {
                success: true,
                message: `Notifications sent to ${sent} users`,
                emailsSent: sent,
                emailsFailed: failed
            };
        } else {
            console.log(`ℹ️ No notifications needed for product ${productId} (stock: ${oldStockQuantity} → ${newStockQuantity})`);
            return {
                success: true,
                message: 'No notifications needed',
                emailsSent: 0
            };
        }
        
    } catch (error) {
        console.error('❌ Error in handleStockUpdate:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get pending notifications for a product
 */
async function getPendingNotifications(productId) {
    try {
        const result = await pool.query(`
            SELECT sn.*, u.username as user_name
            FROM stock_notifications sn
            LEFT JOIN users u ON sn.user_id = u.id
            WHERE sn.product_id = $1 AND sn.notification_sent = false
            ORDER BY sn.created_at DESC
        `, [productId]);
        
        return result.rows;
    } catch (error) {
        console.error('❌ Error getting pending notifications:', error);
        return [];
    }
}

/**
 * Get all notifications for a user
 */
async function getUserNotifications(userId) {
    try {
        const result = await pool.query(`
            SELECT sn.*, p.name as product_name, p.image_url
            FROM stock_notifications sn
            LEFT JOIN products p ON sn.product_id = p.id
            WHERE sn.user_id = $1
            ORDER BY sn.created_at DESC
        `, [userId]);
        
        return result.rows;
    } catch (error) {
        console.error('❌ Error getting user notifications:', error);
        return [];
    }
}

/**
 * Remove a notification subscription
 */
async function removeNotificationSubscription(userId, productId) {
    try {
        const result = await pool.query(`
            DELETE FROM stock_notifications
            WHERE user_id = $1 AND product_id = $2
            RETURNING *
        `, [userId, productId]);
        
        if (result.rows.length > 0) {
            console.log(`✅ Removed notification subscription: User ${userId}, Product ${productId}`);
            return { success: true, removed: true };
        } else {
            return { success: true, removed: false, message: 'Subscription not found' };
        }
    } catch (error) {
        console.error('❌ Error removing notification subscription:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    handleStockUpdate,
    getPendingNotifications,
    getUserNotifications,
    removeNotificationSubscription
};
