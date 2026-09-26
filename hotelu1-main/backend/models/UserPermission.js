const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const UserPermission = sequelize.define(
  "UserPermission",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    permissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "permission_id",
    },
  },
  {
    tableName: "user_permissions",
    timestamps: false,
    indexes: [{ unique: true, fields: ["user_id", "permission_id"] }],
  }
);

module.exports = UserPermission;
