require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sequelize = require('./models/sequelize');

async function seedMenu() {
  try {
    const sqlPath = path.join(__dirname, 'menu_items_seed.sql');
    const sqlString = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons to execute queries one by one
    const queries = sqlString.split(';').filter(q => q.trim() !== '');
    
    for (const query of queries) {
      if (query.trim()) {
        await sequelize.query(query);
      }
    }
    
    console.log('Menu items seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding menu items:', error);
    process.exit(1);
  }
}

seedMenu();
