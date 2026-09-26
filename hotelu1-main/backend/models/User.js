const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('admin', 'franchise', 'subfranchise', 'manager', 'waiter', 'cashier'),
    allowNull: false,
  },
  name: { type: DataTypes.STRING, allowNull: false },
  subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'users',
  timestamps: false,
});

module.exports = User; 