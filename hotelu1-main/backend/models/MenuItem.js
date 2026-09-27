const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const MenuItem = sequelize.define('MenuItem', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.FLOAT, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  image: { type: DataTypes.TEXT('long'), allowNull: true },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false },
  // Soft delete: deleting a menu item must never destroy historical order
  // line items (bills/receipts/reports keep their contents). The DELETE
  // endpoint flips this flag instead of destroying rows.
  isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
}, {
  tableName: 'menu_items',
  timestamps: false,
});

module.exports = MenuItem; 