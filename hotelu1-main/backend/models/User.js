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
  // Incremented whenever the account's authorization changes (role,
  // branch, password, deletion). Tokens issued before the bump are
  // rejected by verifyToken, so deleted/demoted staff lose access
  // immediately instead of holding a valid JWT for up to 24h.
  tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'users',
  timestamps: false,
});

module.exports = User; 