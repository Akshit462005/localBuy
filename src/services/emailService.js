const nodemailer = require('nodemailer');

// Configure your email service
let transporter;

// Initialize transporter based on environment
function initializeTransporter() {
    if (!transporter) {
        const emailConfig = {
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        };

        // For development/testing
        if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
            console.warn('⚠️ Email service not configured. Using test mode.');
            transporter = {
                sendMail: async (mailOptions) => {
                    console.log('📧 [TEST MODE] Email would be sent:');
                    console.log('  To:', mailOptions.to);
                    console.log('  Subject:', mailOptions.subject);
                    return { messageId: 'test-' + Date.now() };
                }
            };
        } else {
            transporter = nodemailer.createTransport(emailConfig);
        }
    }
    return transporter;
}

async function sendStockAvailableEmail(userEmail, productName, productId, shopkeeperName) {
    try {
        const transport = initializeTransporter();
        
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@localbuy.com',
            to: userEmail,
            subject: `✅ Good news! "${productName}" is back in stock!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h2 style="color: #28a745; margin: 0; font-size: 28px;">Great News! 🎉</h2>
                        </div>
                        
                        <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            Hi there,
                        </p>
                        
                        <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                            The product you were waiting for is now available! Here are the details:
                        </p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <h3 style="color: #333; margin: 0 0 10px 0; font-size: 18px;">${productName}</h3>
                            <p style="color: #666; margin: 0 0 15px 0;"><strong>Seller:</strong> ${shopkeeperName || 'LocalBuy Store'}</p>
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/user/dashboard" 
                               style="display: inline-block; background-color: #28a745; color: white; 
                                      padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px;">
                                View Product
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                            Visit <strong>LocalBuy</strong> now to add it to your cart before it runs out again!
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                        
                        <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 0;">
                            You received this email because you subscribed to stock notifications for this product.
                        </p>
                        <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/user/notifications/unsubscribe/${productId}" style="color: #28a745; text-decoration: none;">
                                Unsubscribe from this product
                            </a>
                        </p>
                    </div>
                </div>
            `
        };
        
        const info = await transport.sendMail(mailOptions);
        console.log(`📧 Email sent successfully to ${userEmail} for product: ${productName}`);
        console.log('   Message ID:', info.messageId);
        return true;
        
    } catch (error) {
        console.error('❌ Error sending email to', userEmail, ':', error.message);
        return false;
    }
}

async function sendNotificationEmails(productId, productName, shopkeeperName) {
    try {
        const pool = require('./database');
        
        // Find all pending notifications for this product
        const result = await pool.query(`
            SELECT DISTINCT user_id, user_email 
            FROM stock_notifications 
            WHERE product_id = $1 AND notification_sent = false
        `, [productId]);
        
        if (result.rows.length === 0) {
            console.log(`ℹ️ No pending notifications for product ${productId}`);
            return { sent: 0, failed: 0 };
        }
        
        console.log(`🔔 Sending notifications to ${result.rows.length} subscribers for product: ${productName}`);
        
        let sent = 0;
        let failed = 0;
        
        for (const row of result.rows) {
            const emailSent = await sendStockAvailableEmail(
                row.user_email,
                productName,
                productId,
                shopkeeperName
            );
            
            if (emailSent) {
                // Mark as sent
                await pool.query(`
                    UPDATE stock_notifications 
                    SET notification_sent = true, sent_at = CURRENT_TIMESTAMP
                    WHERE product_id = $1 AND user_id = $2
                `, [productId, row.user_id]);
                sent++;
            } else {
                failed++;
            }
        }
        
        console.log(`✅ Notification results - Sent: ${sent}, Failed: ${failed}`);
        return { sent, failed };
        
    } catch (error) {
        console.error('❌ Error in sendNotificationEmails:', error);
        return { sent: 0, failed: 0 };
    }
}

module.exports = {
    initializeTransporter,
    sendStockAvailableEmail,
    sendNotificationEmails
};
