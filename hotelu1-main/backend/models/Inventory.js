const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  material_name: { type: DataTypes.STRING, allowNull: true },
  current_stock: { type: DataTypes.FLOAT, allowNull: true },
  min_stock: { type: DataTypes.FLOAT, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: true },
  unit_price: { type: DataTypes.FLOAT, allowNull: true },
  unit: { type: DataTypes.STRING, allowNull: true },
  supplier: { type: DataTypes.STRING, allowNull: true },
  // GST Input fields
  purchase_price: { type: DataTypes.FLOAT, allowNull: true },   // price paid per unit when purchasing
  gst_rate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 }, // GST % on purchase (input GST)
  last_purchase_date: { type: DataTypes.DATEONLY, allowNull: true },
}, {
  tableName: 'inventory',
  timestamps: false,
});

module.exports = Inventory;