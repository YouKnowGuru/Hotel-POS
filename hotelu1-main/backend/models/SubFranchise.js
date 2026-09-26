const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const SubFranchise = sequelize.define(
  "SubFranchise",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    address: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    manager_name: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    owner_user_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "sub_franchises",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = SubFranchise;
