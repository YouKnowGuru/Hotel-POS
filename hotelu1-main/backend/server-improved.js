// IMPROVED SERVER.JS - Better Error Handling & Real Database Focus
// This version prioritizes real database usage and removes silent mock data fallbacks

require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { Sequelize } = require("sequelize");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const MenuItem = require("./models/MenuItem");
const Order = require("./models/Order");
const OrderItem = require("./models/OrderItem");
const Inventory = require("./models/Inventory");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const sequelize = require("./models/sequelize");

let dbConnected = false;

sequelize
  .authenticate()
  .then(() => {
    console.log("\n✅ SUCCESS: MySQL connection established!");
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    dbConnected = true;
  })
  .catch((err) => {
    console.error("\n❌ ERROR: Unable to connect to MySQL!");
    console.error("Details:", err.message);
    console.log("\n📝 Troubleshooting Steps:");
    console.log("1. Verify MySQL is running: mysql -u root -p");
    console.log("2. Create database: CREATE DATABASE mrbeast_db;");
    console.log("3. Check credentials in: backend/models/sequelize.js");
    console.log("4. Restart the server after fixing the issue");
    process.exit(1); // Exit if DB not available
  });

// Set up associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// Sync all models
sequelize
  .sync({ alter: true })
  .then(() => console.log("✅ Database models synchronized successfully."))
  .catch((err) => console.error("❌ Model sync error:", err));

// ============================================================================
// AUTHENTICATION
// ============================================================================

// Default admin credentials for demo mode
const defaultUsers = {
  admin: { password: "admin", role: "admin", name: "Admin User" },
  franchise1: { password: "pass", role: "franchise", name: "Franchise Owner" },
  subfranchise1: {
    password: "pass",
    role: "subfranchise",
    name: "Sub Franchise Owner",
  },
  manager1: { password: "pass", role: "manager", name: "Manager" },
  waiter1: { password: "pass", role: "waiter", name: "Waiter" },
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided. Login first." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ============================================================================
// LOGIN ENDPOINT
// ============================================================================

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    // Check default credentials first
    if (
      defaultUsers[username] &&
      defaultUsers[username].password === password
    ) {
      const user = {
        username,
        role: defaultUsers[username].role,
        name: defaultUsers[username].name,
      };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "24h" });
      return res.json({
        message: "Login successful",
        token,
        user,
      });
    }

    if (!dbConnected) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = await User.findOne({ where: { username } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const userData = {
        username: user.username,
        role: user.role,
        name: user.name,
      };
      const token = jwt.sign(userData, JWT_SECRET, { expiresIn: "24h" });
      res.json({
        message: "Login successful",
        token,
        user: userData,
      });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  } catch (err) {
    res.status(500).json({ message: "Login error", error: err.message });
  }
});

// ============================================================================
// MENU ENDPOINTS
// ============================================================================

app.get("/api/menu", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({
        message: "Service unavailable - Database not connected",
        note: "Check server logs for connection details",
      });
    }
    const menuItems = await MenuItem.findAll();
    res.json(menuItems);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res
      .status(500)
      .json({ message: "Error fetching menu items", error: err.message });
  }
});

app.post("/api/menu", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    const newItem = await MenuItem.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating menu item", error: err.message });
  }
});

app.put("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    const { id } = req.params;
    const [updated] = await MenuItem.update(req.body, { where: { id } });
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      res.json({ message: "Menu item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating menu item", error: err.message });
  }
});

app.delete("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    const { id } = req.params;
    const deleted = await MenuItem.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Menu item deleted" });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting menu item", error: err.message });
  }
});

// ============================================================================
// ORDERS ENDPOINTS
// ============================================================================

app.get("/api/orders", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const { status, type, table_name, tableId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (table_name) where.table_name = table_name;
    if (tableId) where.table_name = tableId; // Support both table_name and tableId

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, as: "items" }],
      order: [["timestamp", "DESC"]],
    });
    res.json(orders);
  } catch (err) {
    console.error("Error in /api/orders:", err);
    res
      .status(500)
      .json({ message: "Error fetching orders", error: err.message });
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const { table_name, items, total, status, type, timestamp } = req.body;
    const order = await Order.create({
      table_name,
      total,
      status,
      type,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await OrderItem.create({
          orderId: order.id,
          menuItemId: item.productId || item.menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: item.price,
        });
      }
    }

    const orderWithItems = await Order.findByPk(order.id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    res.status(201).json(orderWithItems);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating order", error: err.message });
  }
});

app.put("/api/orders/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const { id } = req.params;
    const { status, items } = req.body;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (status) order.status = status;
    await order.save();

    if (items && Array.isArray(items)) {
      await OrderItem.destroy({ where: { orderId: id } });
      for (const item of items) {
        await OrderItem.create({
          orderId: id,
          menuItemId: item.productId || item.menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: item.price,
        });
      }
    }

    const updatedOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating order", error: err.message });
  }
});

app.put("/api/orders/:id/request-bill", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.bill_requested = true;
    await order.save();
    res.json({ message: "Bill requested", order });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error requesting bill", error: err.message });
  }
});

// ============================================================================
// INVENTORY ENDPOINTS
// ============================================================================

app.get("/api/inventory", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    const items = await Inventory.findAll();
    res.json(items);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res
      .status(500)
      .json({ message: "Error fetching inventory", error: err.message });
  }
});

app.post("/api/inventory", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    const newItem = await Inventory.create(req.body);
    res.status(201).json(newItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating inventory item", error: err.message });
  }
});

app.put("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const { id } = req.params;
    const [updated] = await Inventory.update(req.body, { where: { id } });
    if (updated) {
      const updatedItem = await Inventory.findByPk(id);
      res.json({ message: "Inventory item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Inventory item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating inventory item", error: err.message });
  }
});

// ============================================================================
// USER REGISTRATION (Public)
// ============================================================================

app.post("/register", async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
    });

    res.status(201).json({
      message: "User registered",
      user: { username: user.username, role: user.role, name: user.name },
    });
  } catch (err) {
    res.status(500).json({ message: "Registration error", error: err.message });
  }
});

// ============================================================================
// USER MANAGEMENT (Admin Only)
// ============================================================================

// Create new user (admin only)
app.post("/api/users", verifyToken, async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create users" });
    }

    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    if (!username || !password || !role || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const validRoles = [
      "admin",
      "franchise",
      "subfranchise",
      "manager",
      "waiter",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
    });

    res.status(201).json({
      message: "User created successfully",
      user: { username: user.username, role: user.role, name: user.name },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating user", error: err.message });
  }
});

// Get all users (admin only)
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view users" });
    }

    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }

    const users = await User.findAll({
      attributes: ["username", "role", "name"],
    });
    res.json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: err.message });
  }
});

// ============================================================================
// SERVER START
// ============================================================================

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`\n✅ Backend server running at http://${HOST}:${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.x.x:${PORT} (your IP)`);
  console.log("\n📚 API Documentation: See API_TESTING_GUIDE.md");
  console.log("🧪 Run tests with: node api-test-complete.js\n");
});
