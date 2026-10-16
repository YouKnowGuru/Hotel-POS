const User = require('./models/User');
const sequelize = require('./models/sequelize');
const bcrypt = require('bcrypt');

async function seedUsers() {
  try {
    // SECURITY GUARD: this script creates well-known demo credentials
    // (admin/admin, waiter/pass, manager/pass2). Running it against a real
    // production database resets every admin password to a value that is
    // publicly committed to the repository, giving anyone with repo access
    // full admin control. Production seeding must be deliberate.
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEMO_SEED) {
      console.error(
        'Refusing to seed demo credentials in production.\n' +
        'These are committed demo logins (admin/admin, waiter/pass, ...).\n' +
        'If you REALLY intend to reset a live database to publicly-known\n' +
        'passwords, set ALLOW_DEMO_SEED=1 — then rotate those passwords\n' +
        'immediately after first login.'
      );
      process.exit(1);
    }
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
