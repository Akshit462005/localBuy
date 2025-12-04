-- Update existing products with random stock quantities for testing
-- This is a one-time update to add inventory to existing products

UPDATE products 
SET stock_quantity = CASE 
    WHEN name ILIKE '%banana%' THEN 25
    WHEN name ILIKE '%apple%' THEN 50
    WHEN name ILIKE '%bread%' THEN 30
    WHEN name ILIKE '%milk%' THEN 40
    WHEN name ILIKE '%juice%' THEN 35
    WHEN name ILIKE '%coffee%' THEN 20
    WHEN name ILIKE '%tea%' THEN 45
    WHEN name ILIKE '%rice%' THEN 100
    WHEN name ILIKE '%pasta%' THEN 60
    WHEN name ILIKE '%chocolate%' THEN 15
    ELSE FLOOR(RANDOM() * 50) + 10  -- Random stock between 10-59 for other products
END
WHERE stock_quantity = 0 OR stock_quantity IS NULL;

-- Show updated inventory
SELECT name, stock_quantity, price 
FROM products 
ORDER BY stock_quantity ASC 
LIMIT 20;