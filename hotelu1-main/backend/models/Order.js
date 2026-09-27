const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Order = sequelize.define(
  "Order",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    table_name: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "preparing",
        "ready",
        "delivered",
        "completed",
        "NOT_AVAILABLE",
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    total: { type: DataTypes.FLOAT, allowNull: false },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    // Number of guests seated at the table for this order (dine-in).
    // Captured by staff when the order is placed; drives the guest count
    // shown on Table Management cards.
    guests: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    token: { type: DataTypes.STRING, allowNull: true }, // For takeaway orders
    bill_requested: { type: DataTypes.BOOLEAN, defaultValue: false },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    bill_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
    payment_method: { type: DataTypes.STRING, allowNull: true },
    payment_status: { type: DataTypes.STRING, allowNull: true },
    // Payment-first QR orders are kept out of the kitchen until a staff
    // member has reviewed the submitted proof.
    payment_proof_image: { type: DataTypes.TEXT('long'), allowNull: true },
    payment_transaction_id: { type: DataTypes.STRING, allowNull: true },
    payment_submitted_at: { type: DataTypes.DATE, allowNull: true },
    payment_verified_at: { type: DataTypes.DATE, allowNull: true },
    payment_verified_by: { type: DataTypes.INTEGER, allowNull: true },
    payment_rejection_reason: { type: DataTypes.TEXT, allowNull: true },
    payment_access_token: { type: DataTypes.STRING, allowNull: true },
    subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: true },

    // Chef performance tracking — when a kitchen user moves an order
    // to `preparing` we stamp `preparing_at` + `chef_id` + `chef_name`,
    // and when they move it to `ready` we stamp `ready_at`. The Reports
    // page uses these to compute per-chef prep-time analytics.
    preparing_at: { type: DataTypes.DATE, allowNull: true },
    ready_at: { type: DataTypes.DATE, allowNull: true },
    chef_id: { type: DataTypes.INTEGER, allowNull: true },
    chef_name: { type: DataTypes.STRING, allowNull: true },

    // Where the order originated from. For internal orders this stays
    // null (we infer "in-house" from the `type` field). For aggregator
    // webhooks (Zomato, Swiggy, UberEats, custom mobile apps) we stamp
    // the source slug + the aggregator-side identifiers so we can
    // ack/refund/refer to them later.
    source: { type: DataTypes.STRING, allowNull: true },
    external_order_id: { type: DataTypes.STRING, allowNull: true },
    customer_name: { type: DataTypes.STRING, allowNull: true },
    customer_phone: { type: DataTypes.STRING, allowNull: true },
    delivery_address: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "orders",
    timestamps: false,
  },
);

module.exports = Order;
