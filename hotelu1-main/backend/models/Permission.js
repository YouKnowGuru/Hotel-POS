const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Permission = sequelize.define(
  "Permission",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      comment: 'Permission identifier (e.g., "view_dashboard", "manage_users")',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Human-readable description",
    },
    category: {
      type: DataTypes.ENUM(
        "user_management",
        "menu_management",
        "order_management",
        "inventory_management",
        "billing",
        "reporting",
        "settings"
      ),
      allowNull: false,
    },
  },
  {
    tableName: "permissions",
    timestamps: false,
  }
);

module.exports = Permission;
