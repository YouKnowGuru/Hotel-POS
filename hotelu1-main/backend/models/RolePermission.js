const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const RolePermission = sequelize.define(
  "RolePermission",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "role_id",
    },
    permissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "permission_id",
    },
  },
  {
    tableName: "role_permissions",
    timestamps: false,
  }
);

module.exports = RolePermission;
