const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

// Immutable-ish audit trail for privileged/administrative actions:
// user management, role & permission changes, settings writes,
// payment verification decisions, payroll approve/pay/delete and
// location (branch) management. Written best-effort by server.js's
// logAudit() — an audit write failure must never block the action it
// records, but failures are surfaced loudly in the server log.
const AuditLog = sequelize.define("AuditLog", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  actor_id: { type: DataTypes.INTEGER, allowNull: true },
  actor_username: { type: DataTypes.STRING, allowNull: true },
  actor_role: { type: DataTypes.STRING(50), allowNull: true },
  // Fixed, server-chosen action names (e.g. "user.update") — never derived
  // from request bodies, so log entries can't be forged via user input.
  action: { type: DataTypes.STRING(100), allowNull: false },
  target_type: { type: DataTypes.STRING(50), allowNull: false },
  target_id: { type: DataTypes.STRING(50), allowNull: true },
  // JSON string with non-sensitive context (field names, counts). Secrets
  // (passwords, tokens, hashes) must never be placed here.
  detail: { type: DataTypes.TEXT, allowNull: true },
  ip: { type: DataTypes.STRING(64), allowNull: true },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "audit_logs",
  timestamps: false,
  updatedAt: false,
});

module.exports = AuditLog;
