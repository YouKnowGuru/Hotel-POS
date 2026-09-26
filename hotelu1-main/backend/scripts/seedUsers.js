const bcrypt = require('bcrypt');
const User = require('../models/User');
const MenuItem = require('../models/MenuItem');

const users = [
  { username: 'admin', password: 'admin', role: 'admin', name: 'Super Admin' },
  { username: 'franchise1', password: 'pass', role: 'franchise', name: 'Franchise A' },
  { username: 'subfranchise1', password: 'pass', role: 'subfranchise', name: 'Sub-Franchise X' },
  { username: 'manager1', password: 'pass', role: 'manager', name: 'Restaurant Manager' },
  { username: 'waiter1', password: 'pass', role: 'waiter', name: 'John Doe' },
];

async function seedUsers() {
  for (const user of users) {
    const existing = await User.findOne({ where: { username: user.username } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await User.create({ ...user, password: hashedPassword });
      console.log(`Created user: ${user.username}`);
    } else {
      console.log(`User already exists: ${user.username}`);
    }
  }
  await User.bulkCreate([
    {
      username: 'customer',
      password: await bcrypt.hash('pass', 10),
      role: 'customer',
      name: 'Customer'
    }
  ]);
  process.exit();
}

async function seedMenuItems() {
  const categories = [
    'Starters',
    'Main Course',
    'Desserts',
    'Beverages',
    'Salads'
  ];
  const items = [];
  categories.forEach((cat, cIdx) => {
    for (let i = 1; i <= 10; i++) {
      items.push({
        name: `${cat} Item ${i}`,
        description: `Delicious ${cat.toLowerCase()} item number ${i}`,
        price: (cIdx + 1) * 50 + i * 5,
        category: cat
      });
    }
  });
  await MenuItem.bulkCreate(items);
  console.log('Dummy menu items seeded.');
}

(async () => {
  try {
    await seedUsers();
    await seedMenuItems();
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})(); 