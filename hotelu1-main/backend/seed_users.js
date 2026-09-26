const User = require('./models/User');
const sequelize = require('./models/sequelize');
const bcrypt = require('bcrypt');

async function seedUsers() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    // Clear existing users
    await User.destroy({ where: {} });
    console.log('Cleared existing users');
    
    // Create default users
    const defaultUsers = [
      { username: 'admin', password: 'admin', role: 'admin', name: 'Administrator' },
      { username: 'waiter', password: 'pass', role: 'waiter', name: 'Waiter User' },
      { username: 'manager', password: 'pass2', role: 'manager', name: 'Manager User' },
    ];
    
    for (const user of defaultUsers) {
      // Hash the password
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await User.create({
        username: user.username,
        password: hashedPassword,
        role: user.role,
        name: user.name
      });
      
      console.log(`Created user: ${user.username} (${user.role})`);
    }
    
    console.log('User seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error.message);
    process.exit(1);
  }
}

seedUsers();
