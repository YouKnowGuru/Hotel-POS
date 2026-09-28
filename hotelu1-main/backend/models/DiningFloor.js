const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

/**
 * Registry of dining floors (ground, first, terrace, …) shown in Table
 * Management tabs, the Add Table picker and the QR sticker generator.
 * `key` is the stable id stored on dining_tables.floor (never renamed —
 * renaming only changes the display label), `label` is what staff see.
 */
const DiningFloor = sequelize.define(
  "DiningFloor",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING(20), allowNull: false },
    label: { type: DataTypes.STRING(50), allowNull: false },
    // Kept for multi-branch parity with dining_tables (single-branch
    // deployments store NULL and get global floors).
    subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "dining_floors",
    timestamps: false,
    indexes: [{ unique: true, fields: ["key", "subfranchise_id"] }],
  }
);

module.exports = DiningFloor;
