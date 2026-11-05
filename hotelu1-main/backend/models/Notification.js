const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

/**
 * Persistent staff notification feed.
 *
 * Alerts used to be derived in the browser from the *current* order state,
 * which meant a "New order" alert disappeared as soon as the kitchen changed
 * the status. Storing events gives every device the same history, keeps
 * read/dismiss state in sync across staff, and survives a page reload.
 *
 * `read_by` / `dismissed_by` are JSON arrays of user ids: one shared row per
 * event, but each staff member has their own read state.
 */
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  // Deterministic key (e.g. "order-placed-42") so a retried request or a
  // duplicate socket path can never create the same alert twice.
  dedupe_key: { type: DataTypes.STRING(160), allowNull: false, unique: true },
  category: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'order' },
  type: { type: DataTypes.STRING(64), allowNull: false },
  severity: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'info' },
  title: { type: DataTypes.STRING(180), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  order_id: { type: DataTypes.INTEGER, allowNull: true },
  table_label: { type: DataTypes.STRING(120), allowNull: true },
  subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
  read_by: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
  dismissed_by: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Notification;
