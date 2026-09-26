/**
 * One-time fix: add missing orders.subfranchise_id column.
 * Run: node scripts/fix-database.js
 */
require("dotenv").config();
const sequelize = require("../models/sequelize");
const SubFranchise = require("../models/SubFranchise");
const { runSafeMigrations } = require("./safeMigrations");

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to database");
    await runSafeMigrations(sequelize, { SubFranchise });
    const [orders] = await sequelize.query(
      "SELECT COUNT(*) AS cnt FROM orders"
    );
    console.log("Orders in database:", orders[0]?.cnt ?? orders[0]);
    console.log("Done. Restart backend with: npm start");
    process.exit(0);
  } catch (e) {
    console.error("Fix failed:", e.message);
    process.exit(1);
  }
})();
