STOCK NOTIFICATION SYSTEM - ARCHITECTURE & FLOW DIAGRAMS
========================================================

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCALBUY PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FRONTEND (Browser)                                              │
│  ┌──────────────────────┐                                       │
│  │  Dashboard.ejs       │                                       │
│  │  - Products List     │                                       │
│  │  - [Notify Me] Btn   │                                       │
│  │  - Toast Messages    │                                       │
│  └──────────────────────┘                                       │
│           │                                                      │
│           ├─ notifyWhenAvailable()                               │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │ BROWSER STORAGE                                     │       │
│  │ ├─ localStorage: stockNotifications = [1, 2, 3]     │       │
│  │ └─ sessionStorage: cartItems                        │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      NETWORK                                    │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ HTTP/HTTPS                                           │      │
│  │ POST   /user/api/notify-when-available              │      │
│  │ GET    /user/api/notifications                      │      │
│  │ DELETE /user/api/notifications/:id                  │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      BACKEND (Node.js)                          │
│                                                                  │
│  ┌─ ROUTES ─────────────────────────────────────────┐          │
│  │ src/routes/user.js                                │          │
│  │ ├─ POST /notify-when-available                    │          │
│  │ ├─ GET /notifications                             │          │
│  │ ├─ DELETE /notifications/:id                      │          │
│  │ └─ GET /notifications/unsubscribe/:id             │          │
│  └───────────────────────────────────────────────────┘          │
│           │                                                      │
│           ▼                                                      │
│  ┌─ SERVICES ────────────────────────────────────────┐          │
│  │                                                    │          │
│  │  ┌──────────────────────────────────────┐        │          │
│  │  │ stockNotificationManager.js          │        │          │
│  │  │ ├─ handleStockUpdate()               │        │          │
│  │  │ ├─ getPendingNotifications()         │        │          │
│  │  │ ├─ getUserNotifications()            │        │          │
│  │  │ └─ removeNotificationSubscription() │        │          │
│  │  └──────────────────────────────────────┘        │          │
│  │           │                                       │          │
│  │           ▼                                       │          │
│  │  ┌──────────────────────────────────────┐        │          │
│  │  │ emailService.js                      │        │          │
│  │  │ ├─ initializeTransporter()           │        │          │
│  │  │ ├─ sendStockAvailableEmail()         │        │          │
│  │  │ └─ sendNotificationEmails()          │        │          │
│  │  └──────────────────────────────────────┘        │          │
│  │           │                                       │          │
│  │           ▼                                       │          │
│  │    [SMTP Service]                                │          │
│  │    (Gmail/SendGrid/AWS)                          │          │
│  │                                                    │          │
│  └────────────────────────────────────────────────────┘          │
│           │                                                      │
│           ▼                                                      │
│  ┌─ DATABASE ────────────────────────────────────────┐          │
│  │ PostgreSQL                                         │          │
│  │ ┌─────────────────────────────────────┐           │          │
│  │ │ stock_notifications                 │           │          │
│  │ ├─ id (PK)                            │           │          │
│  │ ├─ user_id (FK)                       │           │          │
│  │ ├─ product_id (FK)                    │           │          │
│  │ ├─ product_name                       │           │          │
│  │ ├─ user_email                         │           │          │
│  │ ├─ created_at                         │           │          │
│  │ ├─ notification_sent                  │           │          │
│  │ └─ sent_at                            │           │          │
│  │ [Indexes]                              │           │          │
│  │ ├─ (product_id, notification_sent)    │           │          │
│  │ ├─ (user_id)                          │           │          │
│  │ └─ (product_id) WHERE notification..  │           │          │
│  └─────────────────────────────────────────┘           │          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Subscription Flow

```
USER SUBSCRIBES TO PRODUCT
═══════════════════════════

1. User Views Product
   └─► Product.stock_quantity = 0
   
2. User Clicks "Notify Me When Available"
   └─► onclick="notifyWhenAvailable(productId)"
   
3. Frontend Function Executes
   ┌──────────────────────────────────────────────────┐
   │ notifyWhenAvailable(productId)                   │
   │ ├─ Find product in allProducts                   │
   │ ├─ Validate productId                            │
   │ ├─ Show loading toast                            │
   │ └─ Call API                                      │
   └──────────────────────────────────────────────────┘
   
4. API Request
   POST /user/api/notify-when-available
   {
     "productId": 1
   }
   
5. Backend Processing
   ┌──────────────────────────────────────────────────┐
   │ POST Handler                                     │
   │ ├─ Validate productId (required)                 │
   │ ├─ Check product exists                          │
   │ ├─ Check user not already subscribed             │
   │ ├─ Create record in stock_notifications table    │
   │ └─ Return success with notificationId            │
   └──────────────────────────────────────────────────┘
   
6. Database Update
   INSERT INTO stock_notifications
   (user_id, product_id, product_name, 
    shopkeeper_id, user_email, notification_sent)
   VALUES (123, 1, 'Laptop', 5, 'user@email.com', false)
   
7. Backend Response
   {
     "success": true,
     "message": "You will be notified when...",
     "notificationId": 456
   }
   
8. Frontend Updates
   ├─ Save to localStorage
   ├─ Update button state (disabled, "✓ Enabled")
   ├─ Show success toast
   └─ Log to console
   
9. User Sees Confirmation
   ✅ "You'll be notified when Laptop is back in stock!"
```

---

## Notification Sending Flow

```
NOTIFICATION SENDING FLOW
═════════════════════════

1. Shopkeeper Updates Stock
   PUT /shopkeeper/update-product/1
   { "stock_quantity": 5 }
   
2. Backend Detects Stock Change
   ├─ Old stock_quantity: 0
   └─ New stock_quantity: 5
   
3. Trigger Notification Handler
   await handleStockUpdate(
       productId: 1,
       newStockQuantity: 5,
       oldStockQuantity: 0
   )
   
4. Check If Notifications Needed
   IF (oldStock === 0 OR oldStock === null)
      AND newStock > 0 THEN
      ├─ Get product details
      ├─ Query pending notifications
      └─ Proceed with sending
   ELSE
      └─ Return early (no notifications needed)
   
5. Database Query
   SELECT sn.*, u.email
   FROM stock_notifications sn
   LEFT JOIN users u ON sn.user_id = u.id
   WHERE sn.product_id = 1
     AND sn.notification_sent = false
   
   Results:
   ┌────┬───────┬──────────────┬────────────┐
   │ id │ email │ product_name │ sent       │
   ├────┼───────┼──────────────┼────────────┤
   │ 10 │ a@x   │ Laptop       │ false      │
   │ 11 │ b@y   │ Laptop       │ false      │
   │ 12 │ c@z   │ Laptop       │ false      │
   └────┴───────┴──────────────┴────────────┘
   
6. Send Email to Each Subscriber
   ┌──────────────────────────────────────────┐
   │ For each pending notification:            │
   │                                          │
   │ await sendStockAvailableEmail(            │
   │     email: "a@x.com",                    │
   │     productName: "Laptop",               │
   │     productId: 1,                        │
   │     shopkeeperName: "TechShop"          │
   │ )                                        │
   │                                          │
   │ Generates:                               │
   │ ├─ SMTP Connection                       │
   │ ├─ HTML Email with template              │
   │ ├─ Subject line                          │
   │ └─ Send via transporter                  │
   └──────────────────────────────────────────┘
   
7. Email Content Sent
   From: noreply@yourdomain.com
   To: a@x.com
   Subject: ✅ Good news! "Laptop" is back in stock!
   
   Body (HTML):
   ┌─────────────────────────────────────────┐
   │ Great News! 🎉                          │
   │                                         │
   │ Product: Laptop                         │
   │ Seller: TechShop                        │
   │                                         │
   │ [View Product Button]                   │
   │                                         │
   │ [Unsubscribe Link]                      │
   └─────────────────────────────────────────┘
   
8. Update Database Records
   UPDATE stock_notifications
   SET notification_sent = true,
       sent_at = NOW()
   WHERE product_id = 1 AND user_id = 123
   
   Status Change:
   notification_sent: false → true
   sent_at: null → 2024-12-10T10:30:00Z
   
9. Return Result
   {
     "success": true,
     "emailsSent": 3,
     "emailsFailed": 0,
     "message": "Notifications sent to 3 users"
   }
   
10. User Receives Email
    User clicks [View Product] or [Unsubscribe]
    Redirected to product page or unsubscribe page
```

---

## Database State Transitions

```
SUBSCRIPTION LIFECYCLE
═════════════════════

INITIAL STATE (After Subscribe)
┌──────────────────────────────────┐
│ notification_sent: false         │
│ sent_at: NULL                    │
│ created_at: 2024-12-10T10:00:00Z │
│ updated_at: 2024-12-10T10:00:00Z │
└──────────────────────────────────┘
         │
         ├─ User unsubscribes manually
         │  └─► DELETE from database
         │  
         └─ Stock becomes available
            └─ handleStockUpdate() called
               │
               ▼
NOTIFICATION SENT STATE
┌──────────────────────────────────┐
│ notification_sent: true          │
│ sent_at: 2024-12-10T11:00:00Z   │
│ created_at: 2024-12-10T10:00:00Z │
│ updated_at: 2024-12-10T11:00:00Z │
└──────────────────────────────────┘
         │
         ├─ User clicks unsubscribe in email
         │  └─► Manual deletion OR auto-cleanup
         │  
         └─ Auto-cleanup after 30 days (optional)
            └─► DELETE old sent notifications
```

---

## Email Service Configuration Flow

```
EMAIL SERVICE INITIALIZATION
════════════════════════════

1. Environment Check
   ├─ Is EMAIL_USER defined? YES/NO
   ├─ Is EMAIL_PASSWORD defined? YES/NO
   └─ EMAIL_SERVICE specified?
   
2. Service Selection
   
   IF Gmail:
   ├─ EMAIL_SERVICE=gmail
   ├─ EMAIL_USER=your-email@gmail.com
   ├─ EMAIL_PASSWORD=app-specific-password
   └─ Config: {
        service: 'gmail',
        auth: { user, pass }
      }
   
   IF SendGrid:
   ├─ EMAIL_SERVICE=sendgrid
   ├─ EMAIL_USER=apikey
   ├─ EMAIL_PASSWORD=sendgrid-api-key
   └─ Config: {
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: { user, pass }
      }
   
   IF Development Mode (No Config):
   ├─ NODE_ENV=development
   ├─ Use Mock Transporter
   └─ Log to console instead of sending
   
3. Connection Test
   transporter.verify((error, success) => {
       IF success
       └─► ✅ Email service ready
       IF error
       └─► ❌ Email config error - check logs
   })
   
4. Ready to Send
   └─► transporter.sendMail(mailOptions)
       └─► Returns Promise
```

---

## API Error Flow

```
ERROR HANDLING FLOW
═══════════════════

REQUEST VALIDATION
├─ productId missing
│  └─► 400 Bad Request
│      "Product ID is required"
│
├─ Invalid product ID
│  └─► 404 Not Found
│      "Product not found"
│
└─ User not authenticated
   └─► 401 Unauthorized
       (Handled by auth middleware)

SUBSCRIPTION CHECK
├─ Already subscribed
│  └─► 400 Bad Request
│      "Already subscribed to notifications"
│
└─ First-time subscription
   └─► 201 Created
       Store in database

DATABASE ERROR
├─ UNIQUE constraint violation
│  └─► 400 Bad Request
│      (Handled by try-catch)
│
├─ Connection error
│  └─► 500 Server Error
│      "Database connection failed"
│
└─ Query error
   └─► 500 Server Error
       "Failed to create subscription"

EMAIL ERROR
├─ Invalid email config
│  └─► 500 Server Error
│      "Email service not configured"
│
├─ SMTP connection failed
│  └─► 500 Server Error
│      "Failed to send email"
│
└─ Email rejected
   └─► Log error, mark as failed
       Retry on next opportunity
```

---

## Key Metrics & Monitoring Points

```
MONITORING CHECKLIST
════════════════════

Subscription Metrics
├─ Total subscribers: COUNT(*)
├─ Pending notifications: COUNT(*) WHERE notification_sent = false
├─ Emails sent: COUNT(*) WHERE notification_sent = true
└─ Avg response time: < 100ms

Email Metrics
├─ Emails sent per day
├─ Email delivery rate
├─ Click-through rate
└─ Unsubscribe rate

Error Metrics
├─ Failed subscriptions
├─ Failed emails
├─ Database errors
└─ API errors

Performance Metrics
├─ API response time: < 200ms
├─ Email sending time: < 2s
├─ Database query time: < 10ms
└─ Page load impact: ~0ms
```

---

## Security Checkpoints

```
SECURITY VALIDATION
═══════════════════

API Request Entry
├─ ✅ User authentication (require login)
├─ ✅ Session validation
└─ ✅ CSRF protection

Input Validation
├─ ✅ Product ID exists
├─ ✅ User owns the data
└─ ✅ No SQL injection (parameterized)

Database Operations
├─ ✅ User isolation (WHERE user_id = $1)
├─ ✅ Unique constraint (prevents duplicates)
├─ ✅ Transaction safety
└─ ✅ Audit trail (timestamps)

Email Operations
├─ ✅ Email validation
├─ ✅ Rate limiting (optional)
└─ ✅ Unsubscribe verification

Response Handling
├─ ✅ No sensitive data in errors
├─ ✅ Proper HTTP status codes
└─ ✅ CORS headers configured
```

---

## File Organization

```
Project Structure
═════════════════

localBuy/
│
├── database/
│   └── stock_notifications_migration.sql
│
├── src/
│   ├── routes/
│   │   └── user.js (with API endpoints)
│   │
│   └── services/
│       ├── emailService.js
│       └── stockNotificationManager.js
│
├── scripts/
│   └── setup-stock-notifications.js
│
├── views/
│   └── user/
│       └── dashboard.ejs (with notify functions)
│
├── Documentation/
│   ├── STOCK_NOTIFICATIONS_SETUP.md
│   ├── STOCK_NOTIFICATIONS_QUICKSTART.md
│   ├── IMPLEMENTATION_SUMMARY.md
│   ├── IMPLEMENTATION_CHECKLIST.md
│   ├── BUTTON_EXAMPLES.html
│   ├── .env.email.example
│   └── README_STOCK_NOTIFICATIONS.md
│
├── package.json (updated with nodemailer)
└── .env (add email configuration)
```

---

## Summary

The stock notification system provides:
- ✅ User-friendly subscription interface
- ✅ Reliable email delivery
- ✅ Secure database storage
- ✅ Error handling and logging
- ✅ Easy integration with existing codebase

All components work together to deliver a seamless experience for users who want to be notified when their favorite products are back in stock!
