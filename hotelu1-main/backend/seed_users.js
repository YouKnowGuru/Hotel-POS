const User = require('./models/User');
const sequelize = require('./models/sequelize');
const bcrypt = require('bcrypt');

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    // Ensure table exists
    await User.sync();

    // Clear existing users
    await User.destroy({ where: {} });
    console.log('Cleared existing users');
    
    // Seed ONLY admin with super strong password
    const adminPassword = process.env.ADMIN_PASSWORD || 'Tomza#Admin!2026@SecurePOS';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      name: 'Administrator',
      tokenVersion: 0,
    });
    
    console.log(`Created user: admin (admin) with strong password`);
    console.log('User seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error.message);
    process.exit(1);
  }
}

seedUsers();
