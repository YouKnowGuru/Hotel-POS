require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('./models/sequelize');
const MenuItem = require('./models/MenuItem');

async function seedMenu() {
  try {
    await MenuItem.sync();
    console.log('Clearing existing menu items...');

    // Clear existing menu items first (safe delete via isDeleted or hard delete)
    await sequelize.query('DELETE FROM menu_items');
    console.log('All existing menu items deleted.');

    const sqlPath = path.join(__dirname, 'menu_items_seed.sql');
    const sqlString = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons to execute queries one by one
    const queries = sqlString
      .split(';')
      .map(q => q.trim())
      .filter(q => q !== '' && !q.startsWith('--'));

    for (const query of queries) {
      if (query) {
        await sequelize.query(query);
      }
    }

    console.log('Paradise Tomza menu items seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding menu items:', error);
    process.exit(1);
  }
}

seedMenu();
