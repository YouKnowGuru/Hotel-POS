-- Paradise Tomza Menu Seed
-- Clears all existing menu items and inserts the Paradise Tomza menu

DELETE FROM menu_items;

INSERT INTO menu_items (name, price, category, description, isAvailable, isDeleted) VALUES

-- Refreshing Drinks
('Lassi', 80, 'Refreshing Drinks', 'Chilled refreshing lassi', true, false),
('Apple Juice', 80, 'Refreshing Drinks', 'Fresh apple juice', true, false),
('Mango Juice', 80, 'Refreshing Drinks', 'Fresh mango juice', true, false),
('Ice Coke', 70, 'Refreshing Drinks', 'Chilled Coca-Cola on ice', true, false),
('Ice Fanta', 70, 'Refreshing Drinks', 'Chilled Fanta on ice', true, false),
('Ice Tea', 90, 'Refreshing Drinks', 'Refreshing iced tea', true, false),
('Cold Coffee', 100, 'Refreshing Drinks', 'Chilled cold coffee', true, false),
('Red Bull', 90, 'Refreshing Drinks', 'Energy drink', true, false),

-- Local Village Spirits
('Tongba', 200, 'Local Village Spirits', 'Traditional local millet brew', true, false),
('Ara With Gongdo (1 Bottle)', 250, 'Local Village Spirits', 'Local spirit Ara served with Gongdo, 1 bottle', true, false),
('Changkoe With Egg (Per Pot)', 200, 'Local Village Spirits', 'Changkoe served with egg, per pot', true, false),
('Bangchang (Per Pot)', 250, 'Local Village Spirits', 'Traditional Bangchang per pot', true, false),

-- Bhutanese Bar Selection
('K5', 200, 'Bhutanese Bar Selection', 'K5 Bhutanese whisky', true, false),
('11000', 130, 'Bhutanese Bar Selection', '11000 beer', true, false),
('Lager', 130, 'Bhutanese Bar Selection', 'Lager beer', true, false),
('Breezer', 250, 'Bhutanese Bar Selection', 'Breezer flavoured drink', true, false),
('Highland', 80, 'Bhutanese Bar Selection', 'Highland drink', true, false),
('Zumzin (S)', 250, 'Bhutanese Bar Selection', 'Zumzin small bottle', true, false),
('Zumzin (L)', 500, 'Bhutanese Bar Selection', 'Zumzin large bottle', true, false),
('Soju', 300, 'Bhutanese Bar Selection', 'Korean Soju', true, false),

-- Tomza
('Veg Tomza (With Egg)', 350, 'Tomza', 'Vegetable Tomza with egg', true, false),
('Veg Tomza (Without Egg)', 350, 'Tomza', 'Vegetable Tomza without egg', true, false),
('Shakam Tomza', 400, 'Tomza', 'Dried beef Tomza', true, false),
('Sikam Tomza', 400, 'Tomza', 'Pork fat Tomza', true, false),
('Dry Fish Tomza', 350, 'Tomza', 'Dried fish Tomza', true, false),
('Goep Tomza', 350, 'Tomza', 'Tripe Tomza', true, false),
('Ribs Tomza', 350, 'Tomza', 'Ribs Tomza', true, false),
('Chicken Tomza', 350, 'Tomza', 'Chicken Tomza', true, false),
('Pork Bayzom Tomza', 350, 'Tomza', 'Pork Bayzom Tomza', true, false),
('Mixed Tomza', 500, 'Tomza', 'Mixed Tomza platter', true, false),
('Shakam Datshi Tomza (On Order)', 400, 'Tomza', 'Shakam Datshi Tomza - made on order', true, false),

-- Snacks
('Chicken Chilli', 350, 'Snacks', 'Spicy chicken chilli', true, false),
('Beef Chilli', 350, 'Snacks', 'Spicy beef chilli', true, false),
('Wai Wai Chat', 70, 'Snacks', 'Wai Wai noodle chat snack', true, false),
('Potato Stix', 170, 'Snacks', 'Crispy potato stix', true, false),
('Salad', 250, 'Snacks', 'Fresh garden salad', true, false),
('French Fries', 100, 'Snacks', 'Crispy golden french fries', true, false),
('Beef Fry', 350, 'Snacks', 'Pan-fried beef', true, false),

-- Hot Beverages
('Honey Lemon Tea', 80, 'Hot Beverages', 'Hot tea with honey and lemon', true, false),
('Milk Tea', 50, 'Hot Beverages', 'Classic hot milk tea', true, false),
('Suja', 50, 'Hot Beverages', 'Traditional Bhutanese butter tea', true, false),
('Black Coffee', 50, 'Hot Beverages', 'Hot black coffee', true, false),
('Milk Coffee', 80, 'Hot Beverages', 'Hot coffee with milk', true, false),
('Hot Chocolate', 100, 'Hot Beverages', 'Rich hot chocolate drink', true, false),

-- Noodles
('Samyang Combo', 250, 'Noodles', 'Samyang spicy noodle combo', true, false),
('Cheese Koka', 100, 'Noodles', 'Koka noodles with cheese', true, false),
('Egg Koka', 150, 'Noodles', 'Koka noodles with egg', true, false);

-- Migration: Add bill_requested column to orders table (safe if already exists)
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_requested BOOLEAN DEFAULT FALSE;