-- Stock Notifications Table Migration
-- Run this script to add stock notification functionality

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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_notifications_product_sent 
ON stock_notifications(product_id, notification_sent);

CREATE INDEX IF NOT EXISTS idx_stock_notifications_user 
ON stock_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_stock_notifications_pending 
ON stock_notifications(product_id) WHERE notification_sent = false;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_notifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_notifications_timestamp
BEFORE UPDATE ON stock_notifications
FOR EACH ROW
EXECUTE FUNCTION update_stock_notifications_timestamp();
