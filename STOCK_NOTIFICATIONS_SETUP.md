# Stock Notification System - Implementation Guide

## Overview
The stock notification system allows users to subscribe to email notifications when out-of-stock products become available again.

## Implementation Status

### ✅ Completed Components

1. **Database Schema**
   - `stock_notifications_migration.sql` - Creates the notifications table with indexes and triggers
   - Location: `database/stock_notifications_migration.sql`

2. **Backend Services**
   - `emailService.js` - Handles email configuration and sending
   - `stockNotificationManager.js` - Manages notification subscriptions and delivery
   - Location: `src/services/`

3. **API Endpoints**
   - `POST /user/api/notify-when-available` - Subscribe to notifications
   - `GET /user/api/notifications` - Get user's subscriptions
   - `GET /user/api/notifications/product/:productId` - Check subscription status
   - `DELETE /user/api/notifications/:productId` - Unsubscribe
   - `GET /user/notifications/unsubscribe/:productId` - Public unsubscribe link

4. **Frontend Implementation**
   - `notifyWhenAvailable()` function in dashboard.ejs
   - `checkNotificationStatus()` to update UI state
   - Toast notifications for user feedback

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install nodemailer
```

### Step 2: Configure Database

Run the migration script to create the notifications table:

```bash
node scripts/setup-stock-notifications.js
```

Or manually execute the SQL:

```sql
-- From database/stock_notifications_migration.sql
CREATE TABLE IF NOT EXISTS stock_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    shopkeeper_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notification_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);
```

### Step 3: Configure Email Service

Add these environment variables to your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Application URL (used in email links)
APP_URL=http://localhost:3000
```

#### For Gmail:
1. Enable 2-Factor Authentication on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an "App Password" for Mail/Windows
4. Copy the 16-character password and use it as `EMAIL_PASSWORD`
5. Set `EMAIL_USER` to your full Gmail address

#### For Other Email Services:
- **SendGrid**: `EMAIL_SERVICE=sendgrid`, `EMAIL_USER=apikey`, `EMAIL_PASSWORD=your-api-key`
- **AWS SES**: Use nodemailer's SES transport
- **Custom SMTP**: Configure transport in `emailService.js`

### Step 4: Update Product Update Handler

When stock is updated, call the notification handler in your shopkeeper routes:

```javascript
const { handleStockUpdate } = require('../services/stockNotificationManager');

// In your product update route
router.post('/shopkeeper/update-product/:id', async (req, res) => {
    try {
        const oldStockResult = await pool.query('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
        const oldStock = oldStockResult.rows[0]?.stock_quantity || 0;
        
        // Update product with new stock
        const newStock = parseInt(req.body.stock_quantity);
        await pool.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [newStock, productId]);
        
        // Trigger notifications if stock became available
        await handleStockUpdate(productId, newStock, oldStock);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

## How It Works

### User Perspective

1. **Subscribe to Notifications**
   - User clicks "Notify Me" button on out-of-stock product
   - System stores subscription with user's email
   - User sees confirmation toast message

2. **Email Notification**
   - When shopkeeper updates stock quantity from 0 to > 0
   - System automatically sends email to all subscribed users
   - Email contains product link and call-to-action button
   - Email includes unsubscribe link

3. **Unsubscribe Options**
   - Click "Unsubscribe" in email footer
   - Delete subscription via dashboard
   - Subscription auto-removed after notification is sent

### System Flow

```
User clicks "Notify Me"
        ↓
POST /user/api/notify-when-available
        ↓
Store in stock_notifications table
        ↓
Send success response to frontend
        ↓
(Later) Shopkeeper updates stock quantity to > 0
        ↓
Trigger handleStockUpdate()
        ↓
Query pending notifications
        ↓
Send emails via nodemailer
        ↓
Mark notifications as sent
```

## Frontend HTML Integration

When displaying out-of-stock products, include:

```html
<button class="btn secondary notify-btn" onclick="notifyWhenAvailable(<%= product.id %>)">
    <i class="fas fa-bell"></i>
    Notify Me When Available
</button>
```

The function automatically:
- Validates the product exists
- Sends request to backend
- Stores locally in localStorage
- Shows success/error toast
- Updates button state

## Email Template

The email sent to users includes:

- Product name
- Shopkeeper/seller name
- Button to view product
- Unsubscribe link
- Professional styling

Example in `emailService.js`:

```javascript
async function sendStockAvailableEmail(userEmail, productName, productId, shopkeeperName) {
    const mailOptions = {
        to: userEmail,
        subject: `✅ Good news! "${productName}" is back in stock!`,
        html: `...` // Professional HTML template
    };
    
    return await transporter.sendMail(mailOptions);
}
```

## Testing

### Test Email Configuration

```javascript
// In emailService.js
const transporter = initializeTransporter();

transporter.verify((error, success) => {
    if (error) {
        console.log('Email config error:', error);
    } else {
        console.log('✅ Email service ready');
    }
});
```

### Test Subscription

```bash
# 1. Subscribe to notifications
curl -X POST http://localhost:3000/user/api/notify-when-available \
  -H "Content-Type: application/json" \
  -d '{"productId": 1}' \
  -b "sessionid=your-session-id"

# 2. Check subscription
curl http://localhost:3000/user/api/notifications/product/1 \
  -b "sessionid=your-session-id"

# 3. Update product stock (triggers emails)
curl -X POST http://localhost:3000/shopkeeper/update-product/1 \
  -H "Content-Type: application/json" \
  -d '{"stock_quantity": 5}' \
  -b "sessionid=your-session-id"
```

### Test Email Sending

Create a test file `test-email.js`:

```javascript
const { sendStockAvailableEmail } = require('./src/services/emailService');

async function test() {
    const result = await sendStockAvailableEmail(
        'your-email@example.com',
        'Test Product',
        1,
        'Test Shop'
    );
    console.log('Email sent:', result);
}

test();
```

## Troubleshooting

### Emails Not Sending

1. **Check EMAIL_SERVICE and credentials**
   ```bash
   echo $EMAIL_USER
   echo $EMAIL_PASSWORD
   ```

2. **Gmail: Enable "Less secure app access"**
   - This is an alternative to app passwords
   - Go to https://myaccount.google.com/lesssecureapps

3. **Check server logs**
   ```bash
   # Look for error messages
   npm run dev
   ```

4. **Test SMTP Connection**
   ```javascript
   const nodemailer = require('nodemailer');
   const transporter = nodemailer.createTransport({...});
   transporter.verify(console.log);
   ```

### Database Issues

1. **Table doesn't exist**
   ```bash
   node scripts/setup-stock-notifications.js
   ```

2. **Check table structure**
   ```sql
   SELECT * FROM stock_notifications;
   \d stock_notifications;
   ```

3. **Check indexes**
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'stock_notifications';
   ```

### API Response Errors

- `Product ID is required` - Ensure productId is in request body
- `Product not found` - Verify product exists in database
- `Already subscribed` - User already has active subscription
- `Failed to subscribe to notifications` - Check email service configuration

## Database Queries

### Get all pending notifications

```sql
SELECT sn.*, p.name as product_name
FROM stock_notifications sn
JOIN products p ON sn.product_id = p.id
WHERE sn.notification_sent = false
ORDER BY sn.created_at ASC;
```

### Get notifications for specific product

```sql
SELECT * FROM stock_notifications
WHERE product_id = 1 AND notification_sent = false;
```

### Get user's subscriptions

```sql
SELECT sn.*, p.name as product_name
FROM stock_notifications sn
JOIN products p ON sn.product_id = p.id
WHERE sn.user_id = 5
ORDER BY sn.created_at DESC;
```

### Delete old sent notifications (older than 30 days)

```sql
DELETE FROM stock_notifications
WHERE notification_sent = true
AND sent_at < NOW() - INTERVAL '30 days';
```

## Performance Optimization

### Indexes
The migration includes optimized indexes:

```sql
-- Fast lookup for pending notifications
CREATE INDEX idx_stock_notifications_product_sent 
ON stock_notifications(product_id, notification_sent);

-- Fast lookup for user notifications
CREATE INDEX idx_stock_notifications_user 
ON stock_notifications(user_id);

-- Fast lookup for pending only
CREATE INDEX idx_stock_notifications_pending 
ON stock_notifications(product_id) WHERE notification_sent = false;
```

### Scaling Considerations

For large-scale deployments:

1. **Queue emails**: Use Bull or RabbitMQ to queue email sending
2. **Rate limit**: Prevent rapid unsubscribe/subscribe
3. **Cache**: Cache product names and shopkeeper info
4. **Batch emails**: Send multiple emails in single transaction
5. **Archive**: Archive sent notifications to separate table

## Security Considerations

1. **Authentication**: All endpoints require user authentication
2. **Authorization**: Users can only manage their own subscriptions
3. **Input Validation**: All product IDs and emails validated
4. **SQL Injection**: Using parameterized queries
5. **Rate Limiting**: Consider adding rate limit middleware
6. **Email Verification**: Consider verifying email on subscription

## Future Enhancements

1. **SMS Notifications** - Add SMS alerts via Twilio
2. **Push Notifications** - Browser push notifications
3. **Notification Preferences** - User can choose frequency/method
4. **Bulk Operations** - Admin can trigger notifications manually
5. **Analytics** - Track notification click-through rates
6. **Multi-language** - Translate emails based on user language
7. **Scheduled Notifications** - Queue notifications for specific times

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Check database queries
4. Test email configuration separately
5. Verify all environment variables are set
