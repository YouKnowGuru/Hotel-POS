require('dotenv').config();
const sequelize = require('./models/sequelize');

async function seedDemoData() {
  try {
    console.log('Seeding demo data for dashboard...');

    // 1. Seed Inventory
    await sequelize.query(`
      INSERT INTO inventory (material_name, current_stock, min_stock, status) VALUES 
      ('Tomatoes (kg)', 15.5, 5.0, 'In Stock'),
      ('Onions (kg)', 20.0, 10.0, 'In Stock'),
      ('Chicken (kg)', 8.0, 15.0, 'Low Stock'),
      ('Rice (kg)', 50.0, 20.0, 'In Stock'),
      ('Cooking Oil (L)', 3.0, 10.0, 'Low Stock'),
      ('Salt (kg)', 5.0, 2.0, 'In Stock'),
      ('Cheese (kg)', 12.0, 5.0, 'In Stock'),
      ('Flour (kg)', 45.0, 15.0, 'In Stock'),
      ('Potatoes (kg)', 30.0, 15.0, 'In Stock'),
      ('Beef (kg)', 2.0, 10.0, 'Out of Stock');
    `).catch(e => console.log('Inventory might already exist or schema mismatch:', e.message));

    // 2. Seed Orders for today
    const today = new Date();
    // Create an order from 2 hours ago
    const order1Time = new Date(today.getTime() - 2 * 60 * 60 * 1000);
    // Create an order from 1 hour ago
    const order2Time = new Date(today.getTime() - 1 * 60 * 60 * 1000);
    // Create a recent order
    const order3Time = new Date(today.getTime() - 15 * 60 * 1000);

    await sequelize.query(
      `INSERT INTO orders (table_name, status, total, timestamp, type, bill_requested, payment_method) VALUES (?, 'completed', 450.00, ?, 'dine-in', true, 'cash')`,
      { replacements: ['Table 1', order1Time] }
    ).catch(e => console.log('Orders error:', e.message));

    await sequelize.query(
      `INSERT INTO orders (table_name, status, total, timestamp, type, bill_requested, payment_method) VALUES (?, 'completed', 820.00, ?, 'dine-in', true, 'card')`,
      { replacements: ['Table 4', order2Time] }
    ).catch(e => console.log('Orders error:', e.message));

    await sequelize.query(
      `INSERT INTO orders (table_name, status, total, timestamp, type, bill_requested, payment_method) VALUES (?, 'preparing', 350.00, ?, 'takeaway', false, NULL)`,
      { replacements: ['Takeaway', order3Time] }
    ).catch(e => console.log('Orders error:', e.message));

    // Get the inserted orders
    const [orders] = await sequelize.query('SELECT id, total FROM orders ORDER BY id DESC LIMIT 3');
    
    if (orders && orders.length === 3) {
      const [o3, o2, o1] = orders; // Reverse order because of DESC limit 3
      
      // 3. Seed Order Items
      await sequelize.query(
        `INSERT INTO order_items (orderId, menuItemId, name, quantity, price) VALUES (?, 1, 'Starters Item 1', 2, 55), (?, 15, 'Main Course Item 5', 1, 125), (?, 2, 'Starters Item 2', 3, 60), (?, 12, 'Main Course Item 2', 2, 110), (?, 5, 'Starters Item 5', 1, 75)`,
        { replacements: [o1.id, o1.id, o2.id, o2.id, o3.id] }
      ).catch(e => console.log('Order Items error:', e.message));

      // 4. Seed Bills for completed orders
      await sequelize.query(
        `INSERT INTO bills (orderId, subtotal, tax, total, payment_method, bill_status, generated_at, paid_at) VALUES (?, 400.00, 50.00, 450.00, 'cash', 'paid', ?, ?), (?, 750.00, 70.00, 820.00, 'card', 'paid', ?, ?)`,
        { replacements: [o1.id, order1Time, order1Time, o2.id, order2Time, order2Time] }
      ).catch(e => console.log('Bills error:', e.message));
    }

    console.log('Demo orders and inventory successfully seeded!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding demo data:', error);
    process.exit(1);
  }
}

seedDemoData();
