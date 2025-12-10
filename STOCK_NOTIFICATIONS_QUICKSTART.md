# Stock Notification System - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install nodemailer package
```bash
npm install nodemailer
```

### 2. Add email configuration to .env
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
APP_URL=http://localhost:3000
```

**Gmail Setup:**
- Go to https://myaccount.google.com/apppasswords
- Select "Mail" and "Windows"
- Copy the 16-character password to EMAIL_PASSWORD

### 3. Create the database table
```bash
node scripts/setup-stock-notifications.js
```

### 4. Restart your server
```bash
npm run dev
```

## ✅ What's Implemented

### Database (`database/stock_notifications_migration.sql`)
- `stock_notifications` table to store user subscriptions
- Automatic indexes for fast lookups
- Timestamp triggers for auto-updates

### Backend Services (`src/services/`)

**emailService.js**
- Email configuration for Gmail, SendGrid, AWS SES, etc.
- Professional HTML email templates
- Batch email sending capability
- Test mode for development

**stockNotificationManager.js**
- Handle stock updates and trigger notifications
- Get pending notifications for products
- Get user's subscriptions
- Remove notification subscriptions
- Track notification delivery status

### API Endpoints (`src/routes/user.js`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/user/api/notify-when-available` | Subscribe to product notifications |
| GET | `/user/api/notifications` | Get user's all subscriptions |
| GET | `/user/api/notifications/product/:productId` | Check if subscribed to specific product |
| DELETE | `/user/api/notifications/:productId` | Unsubscribe from product |
| GET | `/user/notifications/unsubscribe/:productId` | Public unsubscribe link (for email) |

### Frontend (`views/user/dashboard.ejs`)

**JavaScript Functions:**
- `notifyWhenAvailable(productId)` - Subscribe to product
- `checkNotificationStatus()` - Check subscription status on page load

**Features:**
- Toast notifications for feedback
- Automatic button state updates
- LocalStorage for offline support
- Error handling and logging

## 📋 How to Use

### For Users (Frontend)
1. Browse products
2. Find an out-of-stock product
3. Click "Notify Me When Available" button
4. See success confirmation
5. Receive email when product is back in stock

### For Developers (Backend)

**Trigger notifications when stock updates:**

```javascript
const { handleStockUpdate } = require('../services/stockNotificationManager');

// When updating product stock
const oldStock = 0;
const newStock = 10;

// This will automatically send emails if stock changed from 0 to > 0
await handleStockUpdate(productId, newStock, oldStock);
```

**Check pending notifications:**

```javascript
const { getPendingNotifications } = require('../services/stockNotificationManager');

const pending = await getPendingNotifications(productId);
console.log(`${pending.length} users are waiting for this product`);
```

**Get user's subscriptions:**

```javascript
const { getUserNotifications } = require('../services/stockNotificationManager');

const userSubs = await getUserNotifications(userId);
console.log(userSubs);
```

## 📊 Database Schema

```sql
CREATE TABLE stock_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(255),
    shopkeeper_id INTEGER REFERENCES users(id),
    user_email VARCHAR(255),
    created_at TIMESTAMP,
    notification_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(user_id, product_id)
);
```

## 🧪 Testing

### Test Subscription
```bash
# Subscribe
curl -X POST http://localhost:3000/user/api/notify-when-available \
  -H "Content-Type: application/json" \
  -d '{"productId": 1}'

# Check status
curl http://localhost:3000/user/api/notifications/product/1

# Get all subscriptions
curl http://localhost:3000/user/api/notifications
```

### Test Email
Check server logs (look for "✅ Email sent successfully")

Or create `test-email.js`:
```javascript
const { sendStockAvailableEmail } = require('./src/services/emailService');

sendStockAvailableEmail(
    'test@example.com',
    'Test Product',
    1,
    'Test Shop'
).then(success => console.log(success ? '✅ Email sent' : '❌ Failed'));
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Product ID is required" | Ensure `productId` in POST body |
| "Product not found" | Verify product exists in database |
| "Already subscribed" | User already subscribed to this product |
| Email not sending | Check EMAIL_USER and EMAIL_PASSWORD in .env |
| "Table doesn't exist" | Run `node scripts/setup-stock-notifications.js` |

## 📁 File Structure

```
localBuy/
├── database/
│   └── stock_notifications_migration.sql
├── scripts/
│   └── setup-stock-notifications.js
├── src/
│   ├── routes/
│   │   └── user.js (with API endpoints)
│   └── services/
│       ├── emailService.js
│       └── stockNotificationManager.js
├── views/
│   └── user/
│       └── dashboard.ejs (with notifyWhenAvailable function)
├── .env.email.example
├── STOCK_NOTIFICATIONS_SETUP.md (detailed guide)
└── STOCK_NOTIFICATIONS_QUICKSTART.md (this file)
```

## 🔐 Security Notes

✅ All endpoints require user authentication
✅ Parameterized SQL queries (no SQL injection)
✅ Users can only manage their own subscriptions
✅ Email validation on subscription
✅ Unsubscribe verification via unique links

## 📚 Next Steps

1. **Customize email template** - Edit HTML in `emailService.js`
2. **Add SMS notifications** - Integrate Twilio or similar
3. **Add push notifications** - Use service workers
4. **Set up rate limiting** - Prevent abuse
5. **Add notification preferences** - User can choose frequency

## 📞 Support Files

- `STOCK_NOTIFICATIONS_SETUP.md` - Complete setup guide
- `STOCK_NOTIFICATIONS_QUICKSTART.md` - This file
- `.env.email.example` - Environment variable template
- `scripts/setup-stock-notifications.js` - Auto-setup script

## ✨ Features

✅ Email notifications when stock available
✅ User subscription management
✅ Professional HTML email templates
✅ Automatic email verification
✅ Public unsubscribe links
✅ Database persistence
✅ Error handling and logging
✅ Dev/test mode support
✅ Multiple email service support
✅ Batch email capability

Enjoy! 🎉
