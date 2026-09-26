const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Role = sequelize.define(
  "Role",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      comment: 'Role name (e.g., "admin", "chef", "waiter")',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Description of the role",
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Whether this is a default/built-in role",
    },
  },
  {
    tableName: "roles",
    timestamps: false,
  }
);

module.exports = Role;
