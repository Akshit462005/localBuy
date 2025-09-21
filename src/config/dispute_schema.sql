-- Create enum for dispute status
CREATE TYPE dispute_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);

-- Create enum for dispute priority
CREATE TYPE dispute_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);

-- Create enum for dispute type
CREATE TYPE dispute_type AS ENUM (
    'order_issue',
    'product_quality',
    'delivery',
    'payment',
    'other'
);

-- Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    customer_id INTEGER REFERENCES users(id),
    shopkeeper_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type dispute_type NOT NULL,
    priority dispute_priority NOT NULL DEFAULT 'medium',
    status dispute_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    assigned_to INTEGER REFERENCES users(id)
);

-- Create dispute comments table for communication thread
CREATE TABLE IF NOT EXISTS dispute_comments (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER REFERENCES disputes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_internal BOOLEAN DEFAULT false -- For admin-only notes
);

-- Create dispute attachments table
CREATE TABLE IF NOT EXISTS dispute_attachments (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER REFERENCES disputes(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create dispute history table for tracking status changes
CREATE TABLE IF NOT EXISTS dispute_history (
    id SERIAL PRIMARY KEY,
    dispute_id INTEGER REFERENCES disputes(id) ON DELETE CASCADE,
    changed_by INTEGER REFERENCES users(id),
    old_status dispute_status,
    new_status dispute_status,
    old_priority dispute_priority,
    new_priority dispute_priority,
    old_assigned_to INTEGER REFERENCES users(id),
    new_assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update disputes.updated_at
CREATE OR REPLACE FUNCTION update_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_disputes_updated_at_trigger
    BEFORE UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_disputes_updated_at();

-- Create index for common queries
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_customer_id ON disputes(customer_id);
CREATE INDEX idx_disputes_shopkeeper_id ON disputes(shopkeeper_id);
CREATE INDEX idx_disputes_assigned_to ON disputes(assigned_to);
CREATE INDEX idx_dispute_comments_dispute_id ON dispute_comments(dispute_id);