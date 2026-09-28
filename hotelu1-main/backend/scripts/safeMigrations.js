const { DataTypes } = require("sequelize");

/**
 * Add missing columns/tables without sequelize.sync({ alter: true }).
 * alter:true on users caused "Too many keys" and broke orders queries.
 */
async function runSafeMigrations(sequelize, models = {}) {
  const { SubFranchise, DiningFloor } = models;
  const qi = sequelize.getQueryInterface();

  try {
    const tables = await qi.showAllTables();
    const tableNames = tables.map((t) =>
      typeof t === "string" ? t : t.tableName || t
    );

    if (tableNames.includes("orders")) {
      const ordersDesc = await qi.describeTable("orders");
      if (!ordersDesc.subfranchise_id) {
        await qi.addColumn("orders", "subfranchise_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added orders.subfranchise_id");
      }

      // Chef performance columns — added incrementally so existing
      // databases pick them up on the next boot without losing data.
      if (!ordersDesc.preparing_at) {
        await qi.addColumn("orders", "preparing_at", {
          type: DataTypes.DATE,
          allowNull: true,
        });
        console.log("Migration: added orders.preparing_at");
      }
      if (!ordersDesc.ready_at) {
        await qi.addColumn("orders", "ready_at", {
          type: DataTypes.DATE,
          allowNull: true,
        });
        console.log("Migration: added orders.ready_at");
      }
      if (!ordersDesc.chef_id) {
        await qi.addColumn("orders", "chef_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added orders.chef_id");
      }
      if (!ordersDesc.chef_name) {
        await qi.addColumn("orders", "chef_name", {
          type: DataTypes.STRING,
          allowNull: true,
        });
        console.log("Migration: added orders.chef_name");
      }

      // Aggregator integration columns (Zomato / Swiggy / UberEats /
      // custom mobile apps). Added incrementally — existing rows stay
      // intact, new orders fill them in.
      if (!ordersDesc.source) {
        await qi.addColumn("orders", "source", {
          type: DataTypes.STRING,
          allowNull: true,
        });
        console.log("Migration: added orders.source");
      }
      if (!ordersDesc.external_order_id) {
        await qi.addColumn("orders", "external_order_id", {
          type: DataTypes.STRING,
          allowNull: true,
        });
        console.log("Migration: added orders.external_order_id");
      }
      if (!ordersDesc.customer_name) {
        await qi.addColumn("orders", "customer_name", {
          type: DataTypes.STRING,
          allowNull: true,
        });
        console.log("Migration: added orders.customer_name");
      }
      if (!ordersDesc.customer_phone) {
        await qi.addColumn("orders", "customer_phone", {
          type: DataTypes.STRING,
          allowNull: true,
        });
        console.log("Migration: added orders.customer_phone");
      }
      if (!ordersDesc.delivery_address) {
        await qi.addColumn("orders", "delivery_address", {
          type: DataTypes.TEXT,
          allowNull: true,
        });
        console.log("Migration: added orders.delivery_address");
      }

      // Payment-first QR ordering fields. These are deliberately added with
      // the query interface so existing production databases upgrade without
      // a destructive schema alter.
      const paymentColumns = {
        // Older installations may pre-date the original payment fields too.
        payment_method: { type: DataTypes.STRING, allowNull: true },
        payment_status: { type: DataTypes.STRING, allowNull: true },
        payment_proof_image: { type: DataTypes.TEXT('long'), allowNull: true },
        payment_transaction_id: { type: DataTypes.STRING, allowNull: true },
        payment_submitted_at: { type: DataTypes.DATE, allowNull: true },
        payment_verified_at: { type: DataTypes.DATE, allowNull: true },
        payment_verified_by: { type: DataTypes.INTEGER, allowNull: true },
        payment_rejection_reason: { type: DataTypes.TEXT, allowNull: true },
        payment_access_token: { type: DataTypes.STRING, allowNull: true },
      };
      for (const [column, definition] of Object.entries(paymentColumns)) {
        if (!ordersDesc[column]) {
          await qi.addColumn('orders', column, definition);
          console.log(`Migration: added orders.${column}`);
        }
      }

      // Bring older databases up to the current MenuItem model as well.
      if (tableNames.includes("menu_items")) {
        const menuDesc = await qi.describeTable("menu_items");
        if (!menuDesc.isDeleted) {
          await qi.addColumn("menu_items", "isDeleted", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          });
          console.log("Migration: added menu_items.isDeleted");
        }
      }

      // Bring older databases up to the current Order model as well. Missing
      // columns otherwise make Sequelize's SELECT fail before an order can be
      // displayed, even if the new payment feature is not being used.
      const legacyOrderColumns = {
        bill_requested: { type: DataTypes.BOOLEAN, defaultValue: false },
        delivered_at: { type: DataTypes.DATE, allowNull: true },
        bill_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
        customer_id: { type: DataTypes.INTEGER, allowNull: true },
        updated_at: { type: DataTypes.DATE, allowNull: true },
        // Guest count captured by staff at order time (dine-in table
        // management shows it on the table card).
        guests: { type: DataTypes.INTEGER, allowNull: true },
        // Anonymous QR device-session token (see Order.client_session).
        client_session: { type: DataTypes.STRING(100), allowNull: true },
      };
      for (const [column, definition] of Object.entries(legacyOrderColumns)) {
        if (!ordersDesc[column]) {
          await qi.addColumn('orders', column, definition);
          console.log(`Migration: added orders.${column}`);
        }
      }
    }

    if (tableNames.includes("users")) {
      const usersDesc = await qi.describeTable("users");
      if (!usersDesc.subfranchise_id) {
        await qi.addColumn("users", "subfranchise_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added users.subfranchise_id");
      }
      if (!usersDesc.tokenVersion) {
        await qi.addColumn("users", "tokenVersion", {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        });
        console.log("Migration: added users.tokenVersion");
      }
    }

    if (tableNames.includes("sub_franchises")) {
      const sfDesc = await qi.describeTable("sub_franchises");
      if (!sfDesc.owner_user_id) {
        await qi.addColumn("sub_franchises", "owner_user_id", {
          type: DataTypes.INTEGER,
          allowNull: true,
        });
        console.log("Migration: added sub_franchises.owner_user_id");
      }
    }

    // ── Dining tables (single source of truth for floor plan + QR codes) ──
    if (!tableNames.includes("dining_tables")) {
      await qi.createTable("dining_tables", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        table_number: { type: DataTypes.STRING(20), allowNull: false },
        label: { type: DataTypes.STRING(50), allowNull: true },
        floor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ground" },
        capacity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
        is_reserved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
      });
      console.log("Migration: created dining_tables table");
      // Seed the default floor plan (matches the previous hardcoded UI list)
      // so existing deployments see exactly the same tables after upgrade.
      const DiningTable = models.DiningTable;
      if (DiningTable) {
        const ground = [4, 2, 6, 4, 8, 2];
        const first = [4, 4, 6, 2, 4, 10];
        const rows = [
          ...ground.map((c, i) => ({ table_number: `T${i + 1}`, floor: "ground", capacity: c })),
          ...first.map((c, i) => ({ table_number: `T${i + 7}`, floor: "first", capacity: c })),
        ];
        try {
          await DiningTable.bulkCreate(rows);
          console.log(`Migration: seeded ${rows.length} dining tables`);
        } catch (e) {
          console.warn("Migration: dining_tables seed skipped:", e.message);
        }
      }
    }
    if (tableNames.includes("dining_tables")) {
      const dtDesc = await qi.describeTable("dining_tables");
      const dtCols = {
        label: { type: DataTypes.STRING(50), allowNull: true },
        is_reserved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      };
      for (const [col, def] of Object.entries(dtCols)) {
        if (!dtDesc[col]) {
          await qi.addColumn("dining_tables", col, def);
          console.log(`Migration: added dining_tables.${col}`);
        }
      }
      // Seed the default floor plan when the registry is empty. This can
      // happen on first boot (model.sync created the empty table before
      // migrations ran) or after a manual wipe.
      const DiningTable = models.DiningTable;
      if (DiningTable) {
        try {
          const count = await DiningTable.count();
          if (count === 0) {
            const ground = [4, 2, 6, 4, 8, 2];
            const first = [4, 4, 6, 2, 4, 10];
            const rows = [
              ...ground.map((c, i) => ({ table_number: `T${i + 1}`, floor: "ground", capacity: c })),
              ...first.map((c, i) => ({ table_number: `T${i + 7}`, floor: "first", capacity: c })),
            ];
            await DiningTable.bulkCreate(rows);
            console.log(`Migration: seeded ${rows.length} dining tables`);
          }
        } catch (e) {
          console.warn("Migration: dining_tables seed skipped:", e.message);
        }
      }
    }

    // ── Dining floors registry (labels shown on floor tabs / pickers) ──
    if (!tableNames.includes("dining_floors")) {
      await qi.createTable("dining_floors", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        key: { type: DataTypes.STRING(20), allowNull: false },
        label: { type: DataTypes.STRING(50), allowNull: false },
        subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
      });
      console.log("Migration: created dining_floors table");
    }
    if (tableNames.includes("dining_floors") && DiningFloor) {
      try {
        const count = await DiningFloor.count();
        if (count === 0) {
          // Matches the original hardcoded UI list so upgrades look identical.
          await DiningFloor.bulkCreate([
            { key: "ground", label: "Ground Floor" },
            { key: "first", label: "First Floor" },
          ]);
          console.log("Migration: seeded default floors (ground, first)");
        }
      } catch (e) {
        console.warn("Migration: dining_floors seed skipped:", e.message);
      }
    }

    if (!tableNames.includes("user_permissions")) {
      await qi.createTable("user_permissions", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        permission_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });
      console.log("Migration: created user_permissions table");
    }

    if (tableNames.includes("inventory")) {
      const invDesc = await qi.describeTable("inventory");
      const invCols = {
        unit: { type: DataTypes.STRING, allowNull: true },
        supplier: { type: DataTypes.STRING, allowNull: true },
        unit_price: { type: DataTypes.FLOAT, allowNull: true },
        purchase_price: { type: DataTypes.FLOAT, allowNull: true },
        gst_rate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
        last_purchase_date: { type: DataTypes.DATEONLY, allowNull: true },
      };
      for (const [col, def] of Object.entries(invCols)) {
        if (!invDesc[col]) {
          await qi.addColumn("inventory", col, def);
          console.log(`Migration: added inventory.${col}`);
        }
      }
    }

    if (SubFranchise) {
      await SubFranchise.sync();
      console.log("Migration: sub_franchises table ready");
    }

    // ── Attendance table ─────────────────────────────────────────────────────
    if (!tableNames.includes("attendance")) {
      await qi.createTable("attendance", {
        id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        user_id:         { type: DataTypes.INTEGER, allowNull: false },
        user_name:       { type: DataTypes.STRING,  allowNull: false },
        user_role:       { type: DataTypes.STRING,  allowNull: false },
        subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
        date:            { type: DataTypes.DATEONLY, allowNull: false },
        clock_in:        { type: DataTypes.DATE,    allowNull: true },
        clock_out:       { type: DataTypes.DATE,    allowNull: true },
        break_start:     { type: DataTypes.DATE,    allowNull: true },
        break_end:       { type: DataTypes.DATE,    allowNull: true },
        status:          { type: DataTypes.STRING,  allowNull: false, defaultValue: 'present' },
        leave_type:      { type: DataTypes.STRING,  allowNull: true },
        notes:           { type: DataTypes.TEXT,    allowNull: true },
        total_hours:     { type: DataTypes.FLOAT,   allowNull: true },
        break_hours:     { type: DataTypes.FLOAT,   allowNull: true },
        net_hours:       { type: DataTypes.FLOAT,   allowNull: true },
        overtime_hours:  { type: DataTypes.FLOAT,   allowNull: true },
        shift:           { type: DataTypes.STRING,  allowNull: true, defaultValue: 'full_day' },
        expected_hours:  { type: DataTypes.FLOAT,   allowNull: true, defaultValue: 8 },
        approved_by:     { type: DataTypes.INTEGER, allowNull: true },
        approved_at:     { type: DataTypes.DATE,    allowNull: true },
        is_approved:     { type: DataTypes.BOOLEAN, defaultValue: false },
        created_at:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
        updated_at:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
      });
      console.log("Migration: created attendance table");
    }
    // ─────────────────────────────────────────────────────────────────────────

  } catch (err) {
    console.warn("Safe migration warning:", err.message);
  }
}

module.exports = { runSafeMigrations };
