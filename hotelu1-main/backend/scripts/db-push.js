/**
 * Create/sync all tables + run incremental safe migrations.
 * Run: node scripts/db-push.js
 */
require("dotenv").config();

const sequelize = require("../models/sequelize");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Inventory = require("../models/Inventory");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const UserPermission = require("../models/UserPermission");
const Bill = require("../models/Bill");
const Settings = require("../models/Settings");
const SubFranchise = require("../models/SubFranchise");
const { runSafeMigrations } = require("./safeMigrations");

void User;
void MenuItem;
void Order;
void OrderItem;
void Inventory;
void Permission;
void Role;
void RolePermission;
void Bill;
void Settings;

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");

    await sequelize.sync();
    console.log("Tables synced (create missing only)");

    await runSafeMigrations(sequelize, { SubFranchise });
    await UserPermission.sync();
    console.log("Safe migrations complete");

    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log("Tables:", tables.map((t) => (typeof t === "string" ? t : t.tableName || t)).join(", "));

    process.exit(0);
  } catch (err) {
    console.error("DB push failed:", err.message);
    if (err.parent) console.error(err.parent.message || err.parent);
    process.exit(1);
  }
})();
