const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Bill = sequelize.define(
  "Bill",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    subtotal: { type: DataTypes.FLOAT, allowNull: false },
    tax: { type: DataTypes.FLOAT, allowNull: false },
    total: { type: DataTypes.FLOAT, allowNull: false },
    payment_method: { type: DataTypes.STRING, allowNull: true },
    bill_status: {
      type: DataTypes.ENUM("pending", "paid", "cancelled"),
      defaultValue: "pending",
    },
    generated_at: { type: DataTypes.DATE, allowNull: false },
    paid_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "bills",
    timestamps: false,
  },
);

module.exports = Bill;
