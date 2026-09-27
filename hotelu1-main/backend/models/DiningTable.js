const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

/**
 * Single source of truth for the restaurant floor plan. QR Management,
 * Table Management and the QR occupancy guard all read this list, so a
 * table only exists if it is registered here — generating a sticker and
 * seating guests can never drift apart.
 */
const DiningTable = sequelize.define(
  "DiningTable",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // Canonical public label used in QR URLs and order.table_name ("T5").
    table_number: { type: DataTypes.STRING(20), allowNull: false },
    label: { type: DataTypes.STRING(50), allowNull: true },
    floor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ground" },
    capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    // Staff-set flag; the QR status endpoint surfaces it so guests scanning
    // a reserved table's code see it before ordering.
    is_reserved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "dining_tables",
    timestamps: false,
    indexes: [
      { unique: true, fields: ["table_number", "subfranchise_id"] },
    ],
  }
);

module.exports = DiningTable;
