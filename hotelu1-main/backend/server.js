// Load environment variables from .env file
require('dotenv').config();

const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { Sequelize, Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const MenuItem = require("./models/MenuItem");
const Order = require("./models/Order");
const OrderItem = require("./models/OrderItem");
const Inventory = require("./models/Inventory");
const Permission = require("./models/Permission");
const Role = require("./models/Role");
const RolePermission = require("./models/RolePermission");
const UserPermission = require("./models/UserPermission");
const Bill = require("./models/Bill");
const Settings = require("./models/Settings");
const SubFranchise = require("./models/SubFranchise");
const Attendance = require("./models/Attendance");
const Payroll = require("./models/Payroll");
const bcrypt = require("bcrypt");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}
if (JWT_SECRET === "change-this-to-a-long-random-string-in-production" || JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET must be a strong random string (at least 32 characters). Generate one with: openssl rand -hex 64");
  process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    return true;
  }
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
};

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Socket.IO CORS blocked: ${origin}`));
    },
    credentials: true,
  },
});

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    socket.user = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (_) {
    return next(new Error("Authentication failed: invalid or expired token"));
  }
});

const isNotAvailableStatus = (status) => {
  if (typeof status !== "string") return false;
  const normalized = status.replace(/[^a-z]/gi, "").toUpperCase();
  return normalized === "NOTAVAILABLE";
};

app.use(cors(corsOptions));
app.use(helmet({ contentSecurityPolicy: false }));
// Payment screenshots are submitted as an image data URL. Keep this bounded
// while allowing a normal phone screenshot (the client also validates 3 MB).
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/", (_req, res) => {
  res.json({
    name: "Hotel POS System API",
    status: "online",
    database: dbConnected ? "connected" : "disconnected",
    healthCheck: "/healthz",
    message: "This is the backend API server. Please access the application through your Vercel frontend URL.",
  });
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", db: dbConnected, time: new Date().toISOString() });
});

// Mock data for demo mode
const mockOrders = [
  {
    id: 1,
    table_name: "T1",
    status: "completed",
    total: 25.99,
    timestamp: new Date("2026-02-12T10:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 12.99 },
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
    ],
  },
  {
    id: 2,
    table_name: "Takeaway",
    status: "completed",
    total: 18.5,
    timestamp: new Date("2026-02-12T11:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 1, price: 3.0 },
    ],
  },
  {
    id: 3,
    table_name: "T2",
    status: "completed",
    total: 42.98,
    timestamp: new Date("2026-02-12T12:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 3, price: 3.0 },
    ],
  },
  {
    id: 4,
    table_name: "T3",
    status: "completed",
    total: 31.0,
    timestamp: new Date("2026-02-12T13:20:00"),
    type: "DINE_IN",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
    ],
  },
  {
    id: 5,
    table_name: "Takeaway",
    status: "completed",
    total: 15.5,
    timestamp: new Date("2026-02-12T14:10:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
    ],
  },
  {
    id: 6,
    table_name: "QR-001",
    status: "completed",
    total: 22.98,
    timestamp: new Date("2026-02-12T15:30:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 1, price: 3.0 },
    ],
  },
  {
    id: 7,
    table_name: "T4",
    status: "completed",
    total: 38.97,
    timestamp: new Date("2026-02-12T16:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 8,
    table_name: "Takeaway",
    status: "completed",
    total: 51.48,
    timestamp: new Date("2026-02-12T17:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
    ],
  },
  {
    id: 9,
    table_name: "T5",
    status: "completed",
    total: 12.99,
    timestamp: new Date("2026-02-12T18:15:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 12.99 },
    ],
  },
  {
    id: 10,
    table_name: "QR-002",
    status: "completed",
    total: 29.97,
    timestamp: new Date("2026-02-12T19:00:00"),
    type: "QR_CODE",
    items: [
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  // Add some orders from previous days for weekly/monthly reports
  {
    id: 11,
    table_name: "T1",
    status: "completed",
    total: 35.97,
    timestamp: new Date("2026-02-11T12:00:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 12,
    table_name: "Takeaway",
    status: "completed",
    total: 45.99,
    timestamp: new Date("2026-02-10T13:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 5, price: 3.0 },
    ],
  },
  {
    id: 13,
    table_name: "T2",
    status: "completed",
    total: 25.98,
    timestamp: new Date("2026-02-09T18:45:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 12.99 },
    ],
  },
  {
    id: 14,
    table_name: "QR-003",
    status: "completed",
    total: 18.49,
    timestamp: new Date("2026-02-08T14:20:00"),
    type: "QR_CODE",
    items: [
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 4, price: 3.0 },
    ],
  },
  // Add some orders from previous month for yearly reports
  {
    id: 15,
    table_name: "T3",
    status: "completed",
    total: 62.96,
    timestamp: new Date("2026-01-15T19:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
    ],
  },
  {
    id: 16,
    table_name: "Takeaway",
    status: "completed",
    total: 78.48,
    timestamp: new Date("2026-01-20T12:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 3, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 6, price: 3.0 },
    ],
  },
  // Add today's orders for real data visibility
  {
    id: 17,
    table_name: "T1",
    status: "completed",
    total: 45.98,
    timestamp: new Date("2026-02-13T10:30:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 18,
    table_name: "Takeaway",
    status: "completed",
    total: 31.49,
    timestamp: new Date("2026-02-13T12:45:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 1, price: 4.99 },
    ],
  },
  {
    id: 19,
    table_name: "QR-004",
    status: "completed",
    total: 52.96,
    timestamp: new Date("2026-02-13T14:20:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 20,
    table_name: "T2",
    status: "completed",
    total: 28.98,
    timestamp: new Date("2026-02-13T16:10:00"),
    type: "DINE_IN",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 1, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 4, price: 3.0 },
    ],
  },
  {
    id: 21,
    table_name: "Takeaway",
    status: "completed",
    total: 39.97,
    timestamp: new Date("2026-02-13T17:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 1, name: "Classic Burger", quantity: 1, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 4, price: 4.99 },
    ],
  },
  // Add historical data from previous years
  {
    id: 22,
    table_name: "T1",
    status: "completed",
    total: 85.96,
    timestamp: new Date("2025-12-25T12:00:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 2, name: "French Fries", quantity: 5, price: 4.99 },
      { id: 4, name: "Coca Cola", quantity: 3, price: 3.0 },
    ],
  },
  {
    id: 23,
    table_name: "Takeaway",
    status: "completed",
    total: 62.99,
    timestamp: new Date("2025-11-15T14:30:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 3, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 2, price: 4.99 },
    ],
  },
  {
    id: 24,
    table_name: "QR-005",
    status: "completed",
    total: 125.95,
    timestamp: new Date("2025-10-20T18:45:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 4, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 4, name: "Coca Cola", quantity: 6, price: 3.0 },
    ],
  },
  {
    id: 25,
    table_name: "T2",
    status: "completed",
    total: 45.98,
    timestamp: new Date("2024-08-10T16:20:00"),
    type: "DINE_IN",
    items: [
      { id: 1, name: "Classic Burger", quantity: 2, price: 19.99 },
      { id: 4, name: "Coca Cola", quantity: 2, price: 3.0 },
    ],
  },
  {
    id: 26,
    table_name: "Takeaway",
    status: "completed",
    total: 78.47,
    timestamp: new Date("2024-06-05T13:15:00"),
    type: "TAKEAWAY",
    items: [
      { id: 3, name: "Margherita Pizza", quantity: 4, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 3, price: 4.99 },
    ],
  },
  {
    id: 27,
    table_name: "QR-006",
    status: "completed",
    total: 92.94,
    timestamp: new Date("2024-03-15T19:30:00"),
    type: "QR_CODE",
    items: [
      { id: 1, name: "Classic Burger", quantity: 3, price: 19.99 },
      { id: 3, name: "Margherita Pizza", quantity: 2, price: 15.5 },
      { id: 2, name: "French Fries", quantity: 4, price: 4.99 },
    ],
  },
];

// ...existing code...

let mockSubFranchises = [
  {
    id: 1,
    name: "Downtown Branch",
    code: "SF-DT",
    address: "Main Road",
    city: "Hyderabad",
    phone: "9876543210",
    email: "downtown@restaurant.com",
    manager_name: "Ravi Kumar",
    status: "active",
    notes: "",
    owner_user_id: null,
  },
];

function getNextMockId(arr) {
  if (arr.length === 0) return 1;
  return Math.max(...arr.map((item) => item.id || 0)) + 1;
}

const mockInventory = [
  { id: 1, material_name: "Beef Patty", current_stock: 50, min_stock: 10, unit: "pcs", supplier: "Apex Foods", unit_price: 60, purchase_price: 45, gst_rate: 5, last_purchase_date: "2026-09-01", status: "In Stock" },
  { id: 2, material_name: "Burger Buns", current_stock: 100, min_stock: 20, unit: "pcs", supplier: "Daily Bakery", unit_price: 15, purchase_price: 10, gst_rate: 5, last_purchase_date: "2026-09-10", status: "In Stock" },
  { id: 3, material_name: "Potatoes", current_stock: 25, min_stock: 5, unit: "kg", supplier: "Farmer Coop", unit_price: 30, purchase_price: 20, gst_rate: 0, last_purchase_date: "2026-09-15", status: "In Stock" },
  { id: 4, material_name: "Pizza Dough", current_stock: 30, min_stock: 8, unit: "pcs", supplier: "Italian Supplies", unit_price: 40, purchase_price: 25, gst_rate: 12, last_purchase_date: "2026-09-18", status: "In Stock" },
  { id: 5, material_name: "Cheese & Butter", current_stock: 15, min_stock: 5, unit: "kg", supplier: "Highland Dairy", unit_price: 320, purchase_price: 260, gst_rate: 12, last_purchase_date: "2026-09-20", status: "In Stock" },
  { id: 6, material_name: "Cooking Oil", current_stock: 40, min_stock: 10, unit: "L", supplier: "Sunbeam Wholesalers", unit_price: 160, purchase_price: 130, gst_rate: 5, last_purchase_date: "2026-09-21", status: "In Stock" },
];

let mockMenuItems = [
  { id: 1, name: "Ema Datshi", price: 120, category: "Main Course", description: "Traditional Bhutanese chili & cheese stew", isAvailable: true },
  { id: 2, name: "Kewa Datshi", price: 110, category: "Main Course", description: "Bhutanese potatoes cooked with local cheese", isAvailable: true },
  { id: 3, name: "Shamu Datshi", price: 130, category: "Main Course", description: "Mushroom and cheese delicacy", isAvailable: true },
  { id: 4, name: "Classic Burger", price: 95, category: "Starters", description: "Juicy beef patty with fresh lettuce and sauce", isAvailable: true },
  { id: 5, name: "French Fries", price: 60, category: "Starters", description: "Crispy golden french fries", isAvailable: true },
  { id: 6, name: "Vegetable Momos", price: 80, category: "Starters", description: "Steamed dumplings served with spicy ezay", isAvailable: true },
  { id: 7, name: "Chicken Momos", price: 100, category: "Starters", description: "Juicy chicken steamed dumplings", isAvailable: true },
  { id: 8, name: "Margherita Pizza", price: 180, category: "Chinese", description: "Cheese and tomato basil pizza", isAvailable: true },
  { id: 9, name: "Chicken Biryani", price: 190, category: "Biryani", description: "Aromatic basmati rice cooked with spiced chicken", isAvailable: true },
  { id: 10, name: "Butter Naan", price: 35, category: "Breads", description: "Tandoor baked flatbread with butter", isAvailable: true },
  { id: 11, name: "Roti", price: 20, category: "Breads", description: "Whole wheat freshly cooked flatbread", isAvailable: true },
  { id: 12, name: "Suja (Butter Tea)", price: 40, category: "Beverages", description: "Traditional Bhutanese salted butter tea", isAvailable: true },
  { id: 13, name: "Coca Cola", price: 40, category: "Beverages", description: "Chilled 330ml can", isAvailable: true },
  { id: 14, name: "Fresh Lime Soda", price: 50, category: "Beverages", description: "Refreshing sweet and salty soda", isAvailable: true },
  { id: 15, name: "Gulab Jamun", price: 60, category: "Desserts", description: "Warm milk dumplings in saffron sugar syrup", isAvailable: true },
  { id: 16, name: "Vanilla Ice Cream", price: 55, category: "Desserts", description: "Classic creamy vanilla scoop", isAvailable: true }
];

const sequelize = require("./models/sequelize");
const { runSafeMigrations } = require("./scripts/safeMigrations");
const {
  computeLocationStats,
  computeStatsFromOrderList,
  enrichSubFranchise,
} = require("./utils/franchiseStats");

let dbConnected = false;

// Test database connection and start server
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log("Database connected successfully");
    
    // Create missing tables only (never alter:true — breaks users indexes)
    const allModels = [User, MenuItem, Order, OrderItem, Bill, Inventory, SubFranchise, Role, Permission, Settings, Attendance, Payroll];
    for (const model of allModels) {
      try { await model.sync(); } catch (e) { console.warn(`Sync warning for ${model.tableName}: ${e.message}`); }
    }
    // Junction tables without DB-level FK constraints
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL
      ) ENGINE=InnoDB`);
    } catch (_) {}
    try {
      await sequelize.query(`CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        permission_id INT NOT NULL
      ) ENGINE=InnoDB`);
    } catch (_) {}
    await runSafeMigrations(sequelize, { SubFranchise });
    console.log("Database synchronized successfully");

    dbConnected = true;
    
    // Seed demo users only if they don't already exist (don't overwrite passwords)
    const demoUsersList = [
      { username: "admin", password: "admin", role: "admin", name: "Administrator" },
      { username: "manager", password: "pass2", role: "manager", name: "Manager User" },
      { username: "waiter", password: "pass", role: "waiter", name: "Waiter User" },
    ];
    
    for (const demoUser of demoUsersList) {
      try {
        const existing = await User.findOne({ where: { username: demoUser.username } });
        if (!existing) {
          const hashedPassword = await bcrypt.hash(demoUser.password, 10);
          await User.create({
            username: demoUser.username,
            password: hashedPassword,
            role: demoUser.role,
            name: demoUser.name,
          });
          console.log(`Created demo user: ${demoUser.username}`);
        }
      } catch (err) {
        console.error(`Error with demo user ${demoUser.username}:`, err.message);
      }
    }
  } catch (error) {
    console.error("Database connection failed:", error.message);
    console.warn("Server starting without database connection - using fallback authentication");
    dbConnected = false;
  }
  
}

// DB init runs before the HTTP server starts (see boot() at end of file)

// Set up associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
Order.hasOne(Bill, { foreignKey: "orderId", as: "bill" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menuItemId" });

// Permission system associations (constraints:false to avoid FK type mismatches with existing tables)
Role.hasMany(RolePermission, { foreignKey: "roleId", as: "RolePermissions" });
RolePermission.belongsTo(Role, { foreignKey: "roleId", constraints: false });
RolePermission.belongsTo(Permission, {
  foreignKey: "permissionId",
  as: "Permission",
  constraints: false,
});
Permission.hasMany(RolePermission, { foreignKey: "permissionId" });
User.hasMany(UserPermission, { foreignKey: "userId", as: "UserPermissions" });
UserPermission.belongsTo(User, { foreignKey: "userId", constraints: false });
UserPermission.belongsTo(Permission, { foreignKey: "permissionId", as: "Permission", constraints: false });
Permission.hasMany(UserPermission, { foreignKey: "permissionId" });

async function getOwnedSubFranchiseIds(userId) {
  if (!dbConnected) {
    return mockSubFranchises
      .filter((s) => Number(s.owner_user_id) === Number(userId))
      .map((s) => Number(s.id));
  }
  const rows = await SubFranchise.findAll({
    where: { owner_user_id: userId },
    attributes: ["id"],
  });
  return rows.map((r) => Number(r.id));
}

/** All location IDs a franchise owner may access (owned + linked on user account). */
async function getFranchiseLocationIds(user) {
  if (!user || user.role !== "franchise") return [];
  const ids = new Set();
  if (user.subfranchise_id != null) {
    ids.add(Number(user.subfranchise_id));
  }
  const owned = await getOwnedSubFranchiseIds(user.id);
  owned.forEach((id) => ids.add(id));
  return [...ids];
}

async function resolveOrderSubFranchiseId(req, bodySubfranchiseId) {
  // Branch-assigned staff always stamp orders to their restaurant.
  if (isBranchAssignedStaff(req.user)) {
    return Number(req.user.subfranchise_id);
  }
  if (req.user?.role === "subfranchise" && req.user.subfranchise_id != null) {
    return Number(req.user.subfranchise_id);
  }
  if (req.user?.role === "franchise") {
    const locIds = await getFranchiseLocationIds(req.user);
    if (locIds.length === 0) return null;
    const requested =
      bodySubfranchiseId != null ? Number(bodySubfranchiseId) : null;
    if (requested != null && locIds.includes(requested)) return requested;
    if (locIds.length === 1) return locIds[0];
    return requested;
  }
  if (bodySubfranchiseId != null) return Number(bodySubfranchiseId);
  // Main-branch HQ staff (no subfranchise_id) → HQ orders only.
  if (req.user && isMainBranchStaff(req.user.role)) {
    return null;
  }
  if (req.user?.subfranchise_id != null) return Number(req.user.subfranchise_id);
  return null;
}

const BRANCH_STAFF_ROLES = ["manager", "waiter", "cashier"];

function isMainBranchStaff(role) {
  return role && ["admin", "manager", "waiter", "cashier"].includes(role);
}

function isBranchAssignedStaff(user) {
  return (
    user &&
    BRANCH_STAFF_ROLES.includes(String(user.role || "").toLowerCase()) &&
    user.subfranchise_id != null
  );
}

/**
 * Resolve which restaurant/branch rows a login may see.
 *   admin        → all rows (no filter)
 *   franchise    → owned franchise locations
 *   subfranchise → single linked location
 *   staff w/ subfranchise_id → that location only
 *   main-branch staff (no subfranchise_id) → HQ rows only (subfranchise_id IS NULL)
 */
async function getBranchScopeForUser(user, query = {}) {
  if (!user) {
    return { type: "main" };
  }
  if (user.role === "admin") {
    if (query.subfranchise_id != null && query.subfranchise_id !== "") {
      return { type: "branch", id: Number(query.subfranchise_id) };
    }
    if (query.scope === "main") {
      return { type: "main" };
    }
    return { type: "all" };
  }
  if (user.role === "subfranchise" && user.subfranchise_id != null) {
    return { type: "branch", id: Number(user.subfranchise_id) };
  }
  if (user.role === "franchise") {
    const locIds = await getFranchiseLocationIds(user);
    return { type: "branches", ids: locIds.map(Number) };
  }
  if (isBranchAssignedStaff(user)) {
    return { type: "branch", id: Number(user.subfranchise_id) };
  }
  if (isMainBranchStaff(user.role)) {
    return { type: "main" };
  }
  return { type: "all" };
}

async function loadBranchMeta(subfranchiseId) {
  if (subfranchiseId == null) {
    return {
      id: null,
      name: "Main Branch / Headquarters",
      code: "HQ",
      city: null,
    };
  }
  if (!dbConnected) {
    const row = mockSubFranchises.find(
      (s) => Number(s.id) === Number(subfranchiseId)
    );
    return row
      ? {
          id: row.id,
          name: row.name,
          code: row.code,
          city: row.city,
        }
      : { id: subfranchiseId, name: `Branch #${subfranchiseId}`, code: null };
  }
  const row = await SubFranchise.findByPk(subfranchiseId);
  if (!row) {
    return { id: subfranchiseId, name: `Branch #${subfranchiseId}`, code: null };
  }
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    city: row.city,
  };
}

/** Apply order list filters: each restaurant login sees only its own orders. */
async function applyOrderScopeToWhere(whereClause, req, query = {}) {
  const scope = await getBranchScopeForUser(req?.user, query);
  if (scope.type === "all") {
    return whereClause;
  }
  if (scope.type === "main") {
    whereClause.subfranchise_id = { [Op.is]: null };
    return whereClause;
  }
  if (scope.type === "branch") {
    whereClause.subfranchise_id = scope.id;
    return whereClause;
  }
  if (scope.type === "branches") {
    whereClause.subfranchise_id =
      scope.ids.length > 0 ? { [Op.in]: scope.ids } : -1;
    return whereClause;
  }
  return whereClause;
}

async function assertOrderInScope(req, order, res) {
  if (!req.user) return true;
  if (req.user.role === "admin") return true;

  const oid = order.subfranchise_id;
  const scope = await getBranchScopeForUser(req.user);

  if (scope.type === "all") return true;

  if (scope.type === "main") {
    if (oid != null) {
      res.status(403).json({
        message: "This order belongs to another restaurant branch",
      });
      return false;
    }
    return true;
  }

  if (scope.type === "branch") {
    if (Number(oid) !== Number(scope.id)) {
      res.status(403).json({ message: "Order not in your restaurant scope" });
      return false;
    }
    return true;
  }

  if (scope.type === "branches") {
    if (!scope.ids.length || !scope.ids.includes(Number(oid))) {
      res.status(403).json({ message: "Order not in your franchise scope" });
      return false;
    }
    return true;
  }

  return true;
}

async function getPermissionsForUser(user) {
  if (!user) return [];
  if (user.role === "admin") return ["*"];

  if (user.role === "franchise" || user.role === "subfranchise") {
    if (!dbConnected) {
      return mockUserPermissions[user.id] || [];
    }
    const userPerms = await UserPermission.findAll({
      where: { userId: user.id },
      include: [{ model: Permission, as: "Permission" }],
    });
    return userPerms.map((up) => up.Permission?.name).filter(Boolean);
  }

  if (!dbConnected) {
    const rolePermissions = {
      manager: [
        "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders",
        "create_order", "view_orders", "edit_order", "view_inventory",
        "manage_inventory", "edit_inventory", "view_billing", "process_payments",
        "view_bills", "kitchen_display", "view_menu", "manage_menu",
        "create_menu_item", "edit_menu_item", "delete_menu_item",
        "mark_order_preparing", "mark_order_ready", "confirm_order_delivery",
      ],
      waiter: [
        "view_dashboard", "manage_qr_codes", "create_order", "view_orders",
        "edit_order", "kitchen_display", "confirm_order_delivery",
      ],

    };
    return rolePermissions[user.role] || [];
  }

  const role = await Role.findOne({ where: { name: user.role } });
  if (!role) return [];
  const rolePermissions = await RolePermission.findAll({
    where: { roleId: role.id },
    include: [{ model: Permission, as: "Permission" }],
  });
  return rolePermissions.map((rp) => rp.Permission?.name).filter(Boolean);
}

// Mock users array for demo mode (in-memory storage)
// Passwords are hashed at boot via initMockUsers()
let mockUsers = [];

async function initMockUsers() {
  const demoList = [
    { username: "admin", password: "admin", role: "admin", name: "Administrator" },
    { username: "manager", password: "pass2", role: "manager", name: "Manager User" },
    { username: "waiter", password: "pass", role: "waiter", name: "Waiter User" },
  ];
  const hashedList = [];
  for (const u of demoList) {
    const hash = await bcrypt.hash(u.password, 10);
    hashedList.push({ ...u, password: hash });
  }
  mockUsers = hashedList.map((u, i) => ({ id: i + 1, ...u }));
}
const mockUserPermissions = {};

// Middleware to verify JWT token (supports Authorization header and httpOnly cookie)
const verifyToken = (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Optional token verification - allows QR-based guest orders without token
const optionalToken = (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (_) {
      req.user = null;
    }
  }
  next();
};

// Login Endpoint
app.post("/api/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", { username, password: "***" });
  
  try {
    // Try database authentication first if connected
    if (dbConnected) {
      try {
        const user = await User.findOne({ where: { username } });
        if (user) {
          // Always use bcrypt compare
          let passwordMatch = false;
          if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$'))) {
            passwordMatch = await bcrypt.compare(password, user.password);
          } else {
            // Plain text password in DB — reject and require re-hashing
            console.warn(`User ${user.username} has a plain text password in the database. Please re-seed users with hashed passwords.`);
            passwordMatch = false;
          }
          
          if (passwordMatch) {
            const branch = await loadBranchMeta(user.subfranchise_id);
            const userData = {
              id: user.id,
              username: user.username,
              role: user.role,
              name: user.name,
              subfranchise_id: user.subfranchise_id || null,
              branch,
            };
            const token = jwt.sign(
              {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
                subfranchise_id: user.subfranchise_id || null,
              },
              JWT_SECRET,
              { expiresIn: "24h" }
            );
            res.cookie("token", token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 24 * 60 * 60 * 1000,
            });
            console.log("Login successful with database user:", username);
            return res.json({
              success: true,
              user: userData,
              token,
            });
          } else {
            // Password doesn't match - return error (don't fall back to mockUsers)
            console.log("Invalid password for database user:", username);
            return res.status(401).json({ 
              success: false,
              message: "Invalid credentials" 
            });
          }
        } else {
          // User not found in database - return error (don't fall back to mockUsers)
          console.log("User not found in database:", username);
          return res.status(401).json({ 
            success: false,
            message: "Invalid credentials" 
          });
        }
      } catch (dbError) {
        console.log("Database authentication error:", dbError.message);
        return res.status(401).json({ 
          success: false,
          message: "Invalid credentials" 
        });
      }
    }
    
    // Only use mockUsers fallback when database is NOT connected
    const mockUser = mockUsers.find(u => u.username === username);
    const mockPasswordMatch = mockUser ? await bcrypt.compare(password, mockUser.password) : false;
    if (mockUser && mockPasswordMatch) {
      const branch = await loadBranchMeta(mockUser.subfranchise_id || null);
      const userData = {
        id: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
        name: mockUser.name,
        subfranchise_id: mockUser.subfranchise_id || null,
        branch,
      };
      const token = jwt.sign(
        {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
          name: mockUser.name,
          subfranchise_id: mockUser.subfranchise_id || null,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
      console.log("Login successful with mock user:", username);
      return res.json({
        success: true,
        user: userData,
        token,
      });
    }
    
    console.log("Invalid credentials for user:", username);
    return res.status(401).json({ 
      success: false,
      message: "Invalid credentials" 
    });
    
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false,
      message: "Login error", 
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message 
    });
  }
});

/** Current login context — which restaurant/branch this session belongs to. */
app.get("/api/me/context", verifyToken, async (req, res) => {
  try {
    const scope = await getBranchScopeForUser(req.user);
    let branch = null;
    if (scope.type === "branch") {
      branch = await loadBranchMeta(scope.id);
    } else if (scope.type === "main") {
      branch = await loadBranchMeta(null);
    } else if (scope.type === "all" && req.user.role === "admin") {
      branch = {
        id: null,
        name: "All Restaurants",
        code: "ALL",
        city: null,
      };
    } else if (scope.type === "branches") {
      branch = {
        id: null,
        name: "Franchise Locations",
        code: "FR",
        city: `${scope.ids.length} location(s)`,
      };
    }
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        name: req.user.name,
        subfranchise_id: req.user.subfranchise_id || null,
      },
      scope: scope.type,
      branch,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Menu Endpoints (public read for QR ordering, auth-protected for staff)
app.get("/api/menu", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(mockMenuItems);
    }
    const menuItems = await MenuItem.findAll();
    res.json(menuItems);
  } catch (error) {
    console.error("Database error in /api/menu, falling back to mockMenuItems:", error.message);
    res.json(mockMenuItems);
  }
});

app.post("/api/menu", verifyToken, async (req, res) => {
  try {
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or manager can create menu items" });
    }
    const { name, price, category, description, image, isAvailable } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }
    if (!dbConnected) {
      const newItem = {
        id: getNextMockId(mockMenuItems),
        name,
        price: Number(price),
        category,
        description: description || "",
        image: image || null,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      };
      mockMenuItems.push(newItem);
      return res.status(201).json(newItem);
    }
    const newItem = await MenuItem.create({ name, price, category, description, image, isAvailable });
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error creating menu item in DB, saving to mockMenuItems:", err.message);
    const newItem = {
      id: getNextMockId(mockMenuItems),
      name: req.body.name,
      price: Number(req.body.price),
      category: req.body.category,
      description: req.body.description || "",
      image: req.body.image || null,
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true,
    };
    mockMenuItems.push(newItem);
    res.status(201).json(newItem);
  }
});

app.put("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or manager can update menu items" });
    }
    const id = parseInt(req.params.id);
    const { name, price, category, description, image, isAvailable } = req.body;
    if (!dbConnected) {
      const item = mockMenuItems.find((m) => m.id === id);
      if (!item) return res.status(404).json({ message: "Menu item not found" });
      if (name !== undefined) item.name = name;
      if (price !== undefined) item.price = Number(price);
      if (category !== undefined) item.category = category;
      if (description !== undefined) item.description = description;
      if (image !== undefined) item.image = image;
      if (isAvailable !== undefined) item.isAvailable = isAvailable;
      return res.json({ message: "Menu item updated", item });
    }
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    const [updated] = await MenuItem.update(updateData, { where: { id } });
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      res.json({ message: "Menu item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error("Error updating menu item in DB, fallback to mockMenuItems:", err.message);
    const id = parseInt(req.params.id);
    const item = mockMenuItems.find((m) => m.id === id);
    if (item) {
      Object.assign(item, req.body);
      return res.json({ message: "Menu item updated", item });
    }
    res.status(500).json({ message: "Error updating menu item", error: err.message });
  }
});

app.delete("/api/menu/:id", verifyToken, async (req, res) => {
  try {
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or manager can delete menu items" });
    }
    if (!dbConnected) {
      const index = mockMenuItems.findIndex(
        (m) => m.id === parseInt(req.params.id),
      );
      if (index !== -1) {
        mockMenuItems.splice(index, 1);
        return res.json({ message: "Menu item deleted" });
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    const { id } = req.params;
    
    // First, delete any order items that reference this menu item
    await OrderItem.destroy({ where: { menuItemId: id } });
    
    // Then delete the menu item
    const deleted = await MenuItem.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Menu item deleted successfully" });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error("Delete menu item error:", err);
    res
      .status(500)
      .json({ message: "Error deleting menu item", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Menu Item Availability Endpoint
app.put("/api/menu/:id/availability", verifyToken, async (req, res) => {
  try {
    if (!["admin", "manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Only admin or manager can update menu availability" });
    }
    const { isAvailable } = req.body;
    const { id } = req.params;
    
    console.log('Availability update request:', { id, isAvailable, dbConnected });
    
    if (!dbConnected) {
      console.log('Using mock data for availability update');
      const item = mockMenuItems.find((m) => m.id === parseInt(id));
      if (item) {
        item.isAvailable = isAvailable;
        console.log('Mock item updated:', item);
        return res.json({ message: "Menu item availability updated", item });
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    
    const [updated] = await MenuItem.update(
      { isAvailable },
      { where: { id } }
    );
    if (updated) {
      const updatedItem = await MenuItem.findByPk(id);
      console.log('Updated item from database:', updatedItem);
      res.json({ message: "Menu item availability updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Menu item not found" });
    }
  } catch (err) {
    console.error('Error in availability endpoint:', err);
    res
      .status(500)
      .json({ message: "Error updating menu item availability", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

function tableNameVariants(tableId) {
  const t = String(tableId || "")
    .replace(/^T/i, "")
    .trim();
  return [...new Set([String(tableId), t, `T${t}`, `Table ${t}`, `table ${t}`])];
}

function orderMatchesTableId(order, tableId) {
  if (!tableId) return true;
  const names = tableNameVariants(tableId);
  return names.some(
    (n) => String(order.table_name).toLowerCase() === String(n).toLowerCase()
  );
}

function scopeOrdersForUser(orders, user, query = {}) {
  if (!user) {
    return orders.filter((o) => o.subfranchise_id == null);
  }
  if (user.role === "admin") {
    if (query.subfranchise_id != null && query.subfranchise_id !== "") {
      return orders.filter(
        (o) => Number(o.subfranchise_id) === Number(query.subfranchise_id)
      );
    }
    if (query.scope === "main") {
      return orders.filter((o) => o.subfranchise_id == null);
    }
    return orders;
  }
  if (user?.role === "subfranchise" && user.subfranchise_id != null) {
    return orders.filter(
      (o) => Number(o.subfranchise_id) === Number(user.subfranchise_id)
    );
  }
  if (isBranchAssignedStaff(user)) {
    return orders.filter(
      (o) => Number(o.subfranchise_id) === Number(user.subfranchise_id)
    );
  }
  if (user?.role === "franchise" && user.id != null) {
    const locIds = new Set();
    if (user.subfranchise_id != null) locIds.add(Number(user.subfranchise_id));
    mockSubFranchises
      .filter((s) => Number(s.owner_user_id) === Number(user.id))
      .forEach((s) => locIds.add(Number(s.id)));
    return orders.filter((o) => locIds.has(Number(o.subfranchise_id)));
  }
  if (isMainBranchStaff(user.role)) {
    return orders.filter((o) => o.subfranchise_id == null);
  }
  return orders;
}

// Orders Endpoints
app.get("/api/orders", optionalToken, async (req, res) => {
  try {
    const { status, type, table_name, tableId, date, startDate, endDate } = req.query;
    if (!dbConnected) {
      // Return mock data in demo mode
      let filteredOrders = scopeOrdersForUser([...mockOrders], req.user, req.query);

      if (status)
        filteredOrders = filteredOrders.filter((o) => o.status === status);
      if (type) filteredOrders = filteredOrders.filter((o) => o.type === type);
      if (table_name)
        filteredOrders = filteredOrders.filter(
          (o) => o.table_name === table_name,
        );
      if (tableId)
        filteredOrders = filteredOrders.filter((o) =>
          orderMatchesTableId(o, tableId)
        );
      
      // Apply date filtering for mock data
      if (date) {
        const filterDate = new Date(date);
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate.toDateString() === filterDate.toDateString();
        });
      } else if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.timestamp);
          return orderDate >= start && orderDate <= end;
        });
      }
      
      res.json(filteredOrders);
      return;
    }
    
    let whereClause = {};
    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (table_name) whereClause.table_name = table_name;
    if (tableId) {
      whereClause.table_name = { [Op.in]: tableNameVariants(tableId) };
    }
    await applyOrderScopeToWhere(whereClause, req, req.query);

    if (date) {
      const filterDate = new Date(date);
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      whereClause.timestamp = {
        [Op.gte]: startOfDay,
        [Op.lte]: endOfDay,
      };
    } else if (startDate && endDate) {
      whereClause.timestamp = {
        [Op.gte]: new Date(startDate + 'T00:00:00'),
        [Op.lte]: new Date(endDate + 'T23:59:59'),
      };
    }
    
    const orders = await Order.findAll({
      where: whereClause,
      include: [
        { model: OrderItem, as: "items" },
        { model: Bill, as: "bill", required: false },
      ],
      order: [["timestamp", "DESC"]],
    });
    res.json(orders);
  } catch (err) {
    console.error("Error in /api/orders:", err);
    res.status(500).json({
      message: "Error fetching orders",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
    });
  }
});

// Generate unique takeaway token (numeric only for easy readability)
const generateTakeawayToken = () => {
  // Generate 4-digit numeric token (0001 to 9999)
  const random = crypto.randomInt(1, 10000);
  return random.toString().padStart(4, '0');
};

async function getTaxDiscountSettings() {
  const defaults = { taxPercent: 5, discountPercent: 0 };
  if (!dbConnected) return defaults;
  try {
    const allSettings = await Settings.findAll();
    const map = {};
    allSettings.forEach((s) => {
      map[s.key] = JSON.parse(s.value);
    });
    return {
      taxPercent: Number(map.taxPercent) || defaults.taxPercent,
      discountPercent: Number(map.discountPercent) || defaults.discountPercent,
    };
  } catch (_) {
    return defaults;
  }
}

function getItemsSubtotal(items = []) {
  return items.reduce(
    (sum, item) =>
      sum + (Number(item.price) || 0) * (item.quantity || item.qty || 1),
    0
  );
}

function calculateOrderTotals(subtotal, settings) {
  const taxPercent = Number(settings.taxPercent) || 0;
  const discountPercent = Number(settings.discountPercent) || 0;
  const safeSubtotal = Number(subtotal) || 0;
  const discountAmount = safeSubtotal * (discountPercent / 100);
  const afterDiscount = safeSubtotal - discountAmount;
  const taxAmount = afterDiscount * (taxPercent / 100);
  const total = Math.round((afterDiscount + taxAmount) * 100) / 100;
  return {
    subtotal: Math.round(safeSubtotal * 100) / 100,
    discount: discountPercent,
    discountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxPercent,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total,
  };
}

function attachTotalsToOrder(order, items, totals) {
  const base = order.toJSON ? order.toJSON() : { ...order };
  const normalizedItems = (items || base.items || []).map((item) => ({
    ...item,
    qty: item.qty ?? item.quantity,
    quantity: item.quantity ?? item.qty,
  }));
  return { ...base, items: normalizedItems, ...totals };
}

app.post("/api/orders", strictLimiter, optionalToken, async (req, res) => {
  try {
    const {
      table_name,
      items,
      type,
      parentOrderId,
      subfranchise_id,
    } = req.body;
    let linkedSubFranchiseId = await resolveOrderSubFranchiseId(
      req,
      subfranchise_id
    );
    if (req.user?.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      if (locIds.length === 0) {
        return res.status(400).json({
          message:
            "No franchise location linked. Ask admin to link your account to a location.",
        });
      }
      if (linkedSubFranchiseId == null || !locIds.includes(linkedSubFranchiseId)) {
        return res.status(400).json({
          message:
            locIds.length > 1
              ? "Select a valid franchise location for this order"
              : "Could not assign order to your franchise location",
        });
      }
    }
    const settings = await getTaxDiscountSettings();
    const paymentFirst = req.body.payment_first === true;
    const paymentAccessToken = paymentFirst ? crypto.randomBytes(24).toString('hex') : null;
    const subtotal =
      req.body.subtotal != null
        ? Number(req.body.subtotal)
        : getItemsSubtotal(items || []);
    const totals = calculateOrderTotals(subtotal, settings);

    if (!dbConnected) {
      const newOrder = {
        id: getNextMockId(mockOrders),
        table_name,
        items,
        status: "pending",
        payment_status: paymentFirst ? "awaiting_payment" : null,
        payment_access_token: paymentAccessToken,
        type: type || "DINE_IN",
        parentOrderId,
        subfranchise_id: linkedSubFranchiseId,
        timestamp: new Date(),
        token: type === "TAKEAWAY" ? generateTakeawayToken() : null,
        ...totals,
      };
      mockOrders.push(newOrder);
      // An unpaid QR order must never alert the kitchen.
      if (!paymentFirst) io.emit("order_created");
      const responseOrder = { ...newOrder, paymentAccessToken };
      delete responseOrder.payment_access_token;
      return res.json(responseOrder);
    }

    const newOrder = await Order.create({
      table_name,
      total: totals.total,
      status: "pending",
      type: type || "DINE_IN",
      parentOrderId,
      subfranchise_id: linkedSubFranchiseId,
      timestamp: new Date(),
      token: type === "TAKEAWAY" ? generateTakeawayToken() : null,
      payment_status: paymentFirst ? "awaiting_payment" : null,
      payment_access_token: paymentAccessToken,
    });
    if (items && Array.isArray(items)) {
      for (const item of items) {
        let verifiedPrice = Number(item.price) || 0;
        const menuItemId = item.productId || item.menuItemId;
        if (menuItemId && dbConnected) {
          const menuItem = await MenuItem.findByPk(menuItemId);
          if (menuItem) {
            verifiedPrice = Number(menuItem.price);
          }
        }
        await OrderItem.create({
          orderId: newOrder.id,
          menuItemId: menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: verifiedPrice,
        });
      }
    }
    const orderWithItems = await Order.findByPk(newOrder.id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    if (!paymentFirst) io.emit("order_created");
    const responseOrder = attachTotalsToOrder(orderWithItems, orderWithItems.items, totals);
    responseOrder.paymentAccessToken = paymentAccessToken;
    delete responseOrder.payment_access_token;
    res
      .status(201)
      .json(responseOrder);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating order", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Public endpoint used by the QR customer page. The one-time access token is
// returned only when the order is created, so knowing an order number alone is
// not enough to attach a payment screenshot to someone else's order.
// When a QR-menu customer refreshes their browser, this endpoint restores the
// payment session only for the same table and only while payment is still due.
app.get("/api/orders/:id/payment-session", async (req, res) => {
  try {
    const tableId = req.query.tableId;
    if (!tableId) return res.status(400).json({ message: "Table is required" });
    const eligible = (order) =>
      order && orderMatchesTableId(order, tableId) &&
      ["awaiting_payment", "rejected"].includes(order.payment_status);
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === Number(req.params.id));
      if (!eligible(order)) return res.status(404).json({ message: "Payment session is unavailable" });
      return res.json({ orderId: order.id, total: order.total, paymentAccessToken: order.payment_access_token });
    }
    const order = await Order.findByPk(req.params.id);
    if (!eligible(order)) return res.status(404).json({ message: "Payment session is unavailable" });
    res.json({ orderId: order.id, total: order.total, paymentAccessToken: order.payment_access_token });
  } catch (_) {
    res.status(500).json({ message: "Could not restore payment session" });
  }
});

app.put("/api/orders/:id/payment-proof", strictLimiter, async (req, res) => {
  try {
    const { paymentAccessToken, proofImage } = req.body || {};
    if (!paymentAccessToken || !proofImage) {
      return res.status(400).json({ message: "Payment screenshot is required" });
    }
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(proofImage) || proofImage.length > 4 * 1024 * 1024) {
      return res.status(400).json({ message: "Upload a PNG, JPG, or WebP screenshot smaller than 3 MB" });
    }
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === Number(req.params.id));
      if (!order || order.payment_access_token !== paymentAccessToken) return res.status(404).json({ message: "Order not found" });
      order.payment_transaction_id = null;
      order.payment_proof_image = proofImage;
      order.payment_submitted_at = new Date();
      order.payment_status = "verification_pending";
      io.emit("payment_verification_submitted", { orderId: order.id });
      return res.json({ message: "Payment proof submitted for review", orderId: order.id, payment_status: order.payment_status });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order || order.payment_access_token !== paymentAccessToken) return res.status(404).json({ message: "Order not found" });
    order.payment_transaction_id = null;
    order.payment_proof_image = proofImage;
    order.payment_submitted_at = new Date();
    order.payment_status = "verification_pending";
    order.payment_rejection_reason = null;
    await order.save();
    io.emit("payment_verification_submitted", { orderId: order.id });
    io.emit("order_status_updated", { orderId: order.id, status: order.status, payment_status: order.payment_status });
    res.json({ message: "Payment proof submitted for review", orderId: order.id, payment_status: order.payment_status });
  } catch (err) {
    res.status(500).json({ message: "Could not submit payment proof" });
  }
});

app.put("/api/orders/:id/payment-verification", verifyToken, async (req, res) => {
  try {
    const decision = String(req.body?.decision || "").toLowerCase();
    const rejectionReason = String(req.body?.rejectionReason || "").trim();
    if (!["approve", "reject"].includes(decision)) return res.status(400).json({ message: "Choose approve or reject" });
    if (decision === "reject" && !rejectionReason) return res.status(400).json({ message: "A rejection reason is required" });
    const allowedRoles = ["admin", "manager", "franchise", "subfranchise"];
    if (!allowedRoles.includes(String(req.user?.role || "").toLowerCase())) return res.status(403).json({ message: "Only payment reviewers can verify payments" });
    const update = (order) => {
      if (order.payment_status !== "verification_pending") return "No payment proof is awaiting review";
      order.payment_verified_by = req.user.id;
      order.payment_verified_at = new Date();
      if (decision === "approve") {
        order.payment_status = "paid";
        order.payment_method = "qr_payment";
        // Chef removed: Approved order goes directly to waiter
        order.status = "ready";
        order.ready_at = new Date();
        order.payment_rejection_reason = null;
      } else {
        order.payment_status = "rejected";
        order.payment_rejection_reason = rejectionReason.slice(0, 500);
      }
      return null;
    };
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === Number(req.params.id));
      if (!order || !(await assertOrderInScope(req, order, res))) return;
      const problem = update(order); if (problem) return res.status(409).json({ message: problem });
      io.emit("order_status_updated", { orderId: order.id, status: order.status, payment_status: order.payment_status });
      if (decision === "approve") {
        io.emit("new_order", order);
        io.emit("order_created");
      }
      return res.json({ message: `Payment ${decision}d`, order });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;
    const problem = update(order); if (problem) return res.status(409).json({ message: problem });
    await order.save();
    io.emit("order_status_updated", { orderId: order.id, status: order.status, payment_status: order.payment_status });
    if (decision === "approve") {
      io.emit("new_order", order);
      io.emit("order_created");
    }
    res.json({ message: `Payment ${decision}d`, order });
  } catch (err) {
    res.status(500).json({ message: "Could not verify payment" });
  }
});

// Direct admin order approval (Bypasses kitchen, sends directly to waiter)
app.put("/api/orders/:id/approve", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "manager", "franchise", "subfranchise"];
    if (!allowedRoles.includes(String(req.user?.role || "").toLowerCase())) {
      return res.status(403).json({ message: "Only admin/managers can approve orders" });
    }
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === Number(req.params.id));
      if (!order || !(await assertOrderInScope(req, order, res))) return;
      order.status = "ready";
      order.ready_at = new Date().toISOString();
      if (order.payment_status === "verification_pending") {
        order.payment_status = "paid";
        order.payment_verified_by = req.user.id;
        order.payment_verified_at = new Date();
      }
      io.emit("order_status_updated", { orderId: order.id, status: "ready" });
      io.emit("new_order", order);
      io.emit("order_created");
      return res.json({ message: "Order approved and sent to waiter", order });
    }
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;
    order.status = "ready";
    order.ready_at = new Date();
    if (order.payment_status === "verification_pending") {
      order.payment_status = "paid";
      order.payment_verified_by = req.user.id;
      order.payment_verified_at = new Date();
    }
    await order.save();
    io.emit("order_status_updated", { orderId: order.id, status: "ready" });
    io.emit("new_order", order);
    io.emit("order_created");
    res.json({ message: "Order approved and sent to waiter", order });
  } catch (err) {
    res.status(500).json({ message: "Could not approve order" });
  }
});

app.put("/api/orders/:id", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        const { status, items, total } = req.body;
        const prevStatus = order.status;
        if (status) {
          order.status = status;

          // Kitchen analytics — mirror the DB path for the in-memory mock
          // store so a backend running without a database still records
          // who started/finished an order and when.
          const lowered = String(status).toLowerCase();
          const prevLower = String(prevStatus || "").toLowerCase();
          if (lowered === "preparing" && prevLower !== "preparing") {
            if (!order.preparing_at) order.preparing_at = new Date().toISOString();
            if (!order.chef_id && req.user?.id) order.chef_id = req.user.id;
            if (!order.chef_name && req.user?.name) order.chef_name = req.user.name;
          }
          if (lowered === "ready" && prevLower !== "ready") {
            if (!order.ready_at) order.ready_at = new Date().toISOString();
            if (!order.chef_id && req.user?.id) order.chef_id = req.user.id;
            if (!order.chef_name && req.user?.name) order.chef_name = req.user.name;
          }
        }
        if (total !== undefined) order.total = total;
        if (items && Array.isArray(items)) {
          order.items = items;
        }

        if (status && prevStatus !== status) {
          io.emit('order_status_updated', { orderId: req.params.id, status: status });
          if (String(status).toLowerCase() === 'ready') {
            io.emit('new_order', order);
            io.emit('order_created');
          }
        }

        return res.json({ message: "Order updated", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    const { id } = req.params;
    const { status, items, total } = req.body;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;

    // Capture the previous status BEFORE we mutate it, so we can detect
    // transitions (e.g. "pending → preparing") for kitchen analytics.
    const prevStatusForKitchen = order.status;

    // Update order status for all orders including Takeaway
    if (status) {
      order.status = status;

      // ----- Kitchen performance tracking ---------------------------------
      // When a kitchen user moves an order to "preparing" for the first
      // time, stamp who started it and when. When the same/another
      // kitchen user marks it "ready", stamp ready_at so we can compute
      // prep time (= ready_at - preparing_at) on the Reports page.
      const lowered = String(status).toLowerCase();
      const prevLower = String(prevStatusForKitchen || "").toLowerCase();

      if (lowered === "preparing" && prevLower !== "preparing") {
        if (!order.preparing_at) order.preparing_at = new Date();
        if (!order.chef_id && req.user?.id) order.chef_id = req.user.id;
        if (!order.chef_name && req.user?.name) order.chef_name = req.user.name;
      }

      if (lowered === "ready" && prevLower !== "ready") {
        if (!order.ready_at) order.ready_at = new Date();
        // If kitchen staff went straight from pending → ready (rare, but legal
        // through the KDS) capture them here too, so the analytics page
        // doesn't drop the order.
        if (!order.chef_id && req.user?.id) order.chef_id = req.user.id;
        if (!order.chef_name && req.user?.name) order.chef_name = req.user.name;
      }
    }
    if (total !== undefined) order.total = total;
    await order.save();
    
    // Optionally update items if provided
    if (items && Array.isArray(items)) {
      await OrderItem.destroy({ where: { orderId: id } });
      for (const item of items) {
        let verifiedPrice = Number(item.price) || 0;
        const menuItemId = item.productId || item.menuItemId;
        if (menuItemId && dbConnected) {
          const menuItem = await MenuItem.findByPk(menuItemId);
          if (menuItem) {
            verifiedPrice = Number(menuItem.price);
          }
        }
        await OrderItem.create({
          orderId: id,
          menuItemId: menuItemId || null,
          name: item.name,
          quantity: item.quantity || item.qty || 1,
          price: verifiedPrice,
        });
      }
    }
    
    // Emit socket event for all orders when status is changing.
    // (Use prevStatusForKitchen captured above; reading order.status here
    // would be wrong since we already mutated it.)
    if (status && prevStatusForKitchen !== status) {
      io.emit('order_status_updated', { orderId: id, status: status });
      if (String(status).toLowerCase() === 'ready') {
        io.emit('new_order', order);
        io.emit('order_created');
      }
    }
    const updatedOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    
    res.json({ message: "Order updated", order: updatedOrder });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating order", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Mark Order as Not Available Endpoint
app.put("/api/orders/:id/not-available", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "NOT_AVAILABLE";
        io.emit("order_status_updated", { orderId: req.params.id, status: "NOT_AVAILABLE" });
        return res.json({ message: "Order marked as not available", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;

    order.status = "NOT_AVAILABLE";
    await order.save();

    io.emit("order_status_updated", { orderId: id, status: "NOT_AVAILABLE" });
    
    const updatedOrder = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });
    
    res.json({ message: "Order marked as not available", order: updatedOrder });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error marking order as not available", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get Live Orders Count Endpoint
app.get("/api/orders/live-count", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const liveOrders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (order) =>
          ["PENDING", "PREPARING", "READY", "DELIVERED", "pending", "preparing", "ready", "delivered"].includes(
            order.status
          )
      );
      return res.json({ count: liveOrders.length });
    }

    const whereClause = {
      status: {
        [Op.in]: [
          "PENDING",
          "PREPARING",
          "READY",
          "DELIVERED",
          "pending",
          "preparing",
          "ready",
          "delivered",
        ],
      },
    };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const liveOrdersCount = await Order.count({ where: whereClause });
    
    res.json({ count: liveOrdersCount });
  } catch (err) {
    console.error("Error fetching live orders count:", err);
    res.status(500).json({ message: "Error fetching live orders count", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get Total Orders Count Endpoint (exclude NOT_AVAILABLE)
app.get("/api/orders/total-count", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const totalOrders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (order) => order.status !== "NOT_AVAILABLE"
      );
      return res.json({ count: totalOrders.length });
    }

    const whereClause = {
      status: { [Op.notIn]: ["NOT_AVAILABLE", "not_available"] },
    };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const totalOrdersCount = await Order.count({ where: whereClause });

    res.json({ count: totalOrdersCount });
  } catch (err) {
    console.error("Error fetching total orders count:", err);
    res.status(500).json({ message: "Error fetching total orders count", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Delete Order Endpoint - Delete order and its associated items
app.delete("/api/orders/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!dbConnected) {
      const orderIndex = mockOrders.findIndex((o) => o.id === parseInt(id));
      if (orderIndex === -1) {
        return res.status(404).json({ message: "Not found" });
      }
      // Allow deletion of empty orders (total = 0) or NOT_AVAILABLE orders
      const order = mockOrders[orderIndex];
      console.log('Mock order to delete:', order);
      if (order.total > 0 && !isNotAvailableStatus(order.status)) {
        console.log('Cannot delete order - total > 0 and not NOT_AVAILABLE:', order.total, order.status);
        return res.status(400).json({
          message: "Only empty orders or NOT_AVAILABLE orders can be deleted",
        });
      }
      mockOrders.splice(orderIndex, 1);
      console.log('Order deleted from mock data');
      return res.json({ success: true });
    }

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Not found" });
    if (!(await assertOrderInScope(req, order, res))) return;

    console.log('Order to delete:', order.dataValues);

    // Allow deletion of empty orders (total = 0) or NOT_AVAILABLE orders
    if (order.total > 0 && !isNotAvailableStatus(order.status)) {
      console.log('Cannot delete order - total > 0 and not NOT_AVAILABLE:', order.total, order.status);
      return res.status(400).json({
        message: "Only empty orders or NOT_AVAILABLE orders can be deleted",
      });
    }

    await OrderItem.destroy({ where: { orderId: order.id } });
    await order.destroy();

    console.log('Order deleted from database');

    // Emit socket event to update dashboard
    io.emit('order_deleted', { orderId: id });

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).json({ message: "Error deleting order", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Request Bill Endpoint - Works for both authenticated and QR customers
app.put("/api/orders/:id/request-bill", optionalToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.bill_requested = true;
        return res.json({ message: "Bill requested", order });
      }
      return res.status(404).json({ message: "Order not found" });
    }
    const { id } = req.params;
    const order = await Order.findByPk(id, { include: [{ model: OrderItem, as: "items" }] });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.user && !(await assertOrderInScope(req, order, res))) return;
    order.bill_requested = true;
    await order.save();

    // Auto-generate bill if not already generated
    let bill = await Bill.findOne({ where: { orderId: id } });
    if (!bill) {
      const settings = await getTaxDiscountSettings();
      const subtotal = (order.items || []).reduce(
        (sum, item) => sum + item.price * item.quantity, 0
      );
      const totals = calculateOrderTotals(subtotal, settings);
      bill = await Bill.create({
        orderId: order.id,
        subtotal: totals.subtotal,
        tax: totals.taxAmount,
        total: totals.total,
        bill_status: "pending",
        generated_at: new Date(),
      });
    }

    io.emit('order_status_updated', { orderId: parseInt(id), status: order.status, bill_requested: true });
    res.json({ message: "Bill requested", order, bill });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error requesting bill", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Reset Order Endpoint - Delete NOT_AVAILABLE orders and their items
app.put("/api/orders/:id/reset", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const orderIndex = mockOrders.findIndex((o) => o.id === parseInt(req.params.id));
      if (orderIndex !== -1) {
        const order = mockOrders[orderIndex];
        if (isNotAvailableStatus(order.status)) {
          mockOrders.splice(orderIndex, 1);
          return res.json({
            success: true,
            message: "Order deleted successfully",
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            message: "Only NOT_AVAILABLE orders can be reset" 
          });
        }
      }
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }
    
    const { id } = req.params;
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found" 
      });
    }
    if (!(await assertOrderInScope(req, order, res))) return;

    if (!isNotAvailableStatus(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Only NOT_AVAILABLE orders can be reset" 
      });
    }
    
    // Delete associated order items first
    await OrderItem.destroy({ where: { orderId: id } });
    
    // Delete the order
    await Order.destroy({ where: { id } });

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ 
        success: false, 
        message: "Error resetting order", 
        error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message 
      });
  }
});

// Confirm Delivery Endpoint - Mark order as delivered and auto-generate bill
app.put("/api/orders/:id/confirm-delivery", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "delivered";
        order.delivered_at = new Date();
        order.bill_generated = true;
        
        // Emit socket event to update dashboard
        io.emit('order_status_updated', { orderId: req.params.id, status: 'delivered' });
        
        return res.json({
          message: "Order delivered and bill generated",
          order,
        });
      }
      return res.status(404).json({ message: "Order not found" });
    }

    const { id } = req.params;
    const { tax_rate } = req.body;
    const order = await Order.findByPk(id, {
      include: [{ model: OrderItem, as: "items" }],
    });

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;
    if (order.status !== "ready") {
      return res.status(400).json({
        message: "Order must be in 'ready' status to confirm delivery",
      });
    }

    // Update order status
    order.status = "delivered";
    order.delivered_at = new Date();
    order.bill_generated = true;
    await order.save();

    // Emit socket event to update dashboard
    io.emit('order_status_updated', { orderId: id, status: 'delivered' });

    // Auto-generate bill using globally configured Tax & Discount
    const settings = await getTaxDiscountSettings();
    const subtotal = (order.items || []).reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const totals = calculateOrderTotals(subtotal, settings);

    const bill = await Bill.create({
      orderId: order.id,
      subtotal: totals.subtotal,
      tax: totals.taxAmount,
      total: totals.total,
      bill_status: "pending",
      generated_at: new Date(),
    });

    res.json({
      message: "Order delivered and bill generated",
      order,
      bill,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error confirming delivery", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get bills for an order
app.get("/api/orders/:id/bill", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ message: "No bill system in demo mode" });
    }

    const { id } = req.params;
    const bill = await Bill.findOne({ where: { orderId: id } });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found for this order" });
    }

    res.json(bill);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error retrieving bill", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get all delivered orders (for billing page)
app.get("/api/orders/status/delivered", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const orders = scopeOrdersForUser(mockOrders, req.user, req.query).filter(
        (o) => o.status === "delivered"
      );
      return res.json(orders);
    }

    const whereClause = { status: "delivered" };
    await applyOrderScopeToWhere(whereClause, req, req.query);

    const orders = await Order.findAll({
      where: whereClause,
      include: [{ model: OrderItem, as: "items" }],
      order: [["delivered_at", "DESC"]],
    });

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      message: "Error retrieving delivered orders",
      error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message,
    });
  }
});

// Complete order and mark bill as paid
app.put("/api/orders/:id/complete-payment", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      const order = mockOrders.find((o) => o.id === parseInt(req.params.id));
      if (order) {
        order.status = "completed";
        order.payment_method = req.body.payment_method || "cash";
        order.bill_generated = true; // Mark bill as generated to remove from live orders
        
        // Emit socket event to update dashboard
        io.emit('order_status_updated', { orderId: req.params.id, status: 'completed' });
        
        return res.json({
          message: "Payment completed and order closed",
          order,
        });
      }
      return res.status(404).json({ message: "Order not found" });
    }

    const { id } = req.params;
    const { payment_method } = req.body;

    const order = await Order.findByPk(id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!(await assertOrderInScope(req, order, res))) return;

    order.status = "completed";
    order.payment_method = payment_method || "cash";
    order.bill_generated = true; // Mark bill as generated to remove from live orders
    await order.save();

    // Emit socket event to update dashboard
    io.emit('order_status_updated', { orderId: id, status: 'completed' });

    // Update bill status to paid
    const bill = await Bill.findOne({ where: { orderId: id } });
    if (bill) {
      bill.bill_status = "paid";
      bill.paid_at = new Date();
      bill.payment_method = payment_method || "cash";
      await bill.save();
    }

    res.json({
      message: "Payment completed and order closed",
      order,
      bill,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error completing payment", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Inventory Endpoints
app.get("/api/inventory", verifyToken, async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json(mockInventory);
    }
    const items = await Inventory.findAll();
    res.json(items);
  } catch (err) {
    console.error("Error fetching inventory:", err);
    res.json(mockInventory);
  }
});

app.post("/api/inventory", verifyToken, async (req, res) => {
  try {
    const { material_name, current_stock, min_stock, unit, supplier, unit_price, purchase_price, gst_rate, last_purchase_date } = req.body;
    
    // Validate required fields
    if (!material_name || current_stock === undefined || min_stock === undefined) {
      return res.status(400).json({ message: "Material name, current stock, and min stock are required" });
    }

    // Check for duplicate material names
    if (dbConnected) {
      const existing = await Inventory.findOne({ where: { material_name } });
      if (existing) {
        return res.status(409).json({ message: "Material with this name already exists" });
      }
    } else {
      const existing = mockInventory.find(item => (item.material_name || item.name) === material_name);
      if (existing) {
        return res.status(409).json({ message: "Material with this name already exists" });
      }
    }

    // Auto-set status based on stock levels
    const status = current_stock > min_stock ? "In Stock" : "Out of Stock";

    if (!dbConnected) {
      const newItem = { 
        id: getNextMockId(mockInventory), 
        material_name, 
        current_stock: parseFloat(current_stock), 
        min_stock: parseFloat(min_stock),
        unit: unit || 'kg',
        supplier: supplier || '',
        unit_price: unit_price ? parseFloat(unit_price) : null,
        purchase_price: purchase_price ? parseFloat(purchase_price) : null,
        gst_rate: gst_rate ? parseFloat(gst_rate) : 0,
        last_purchase_date: last_purchase_date || null,
        status 
      };
      mockInventory.push(newItem);
      return res.status(201).json(newItem);
    }
    
    const newItem = await Inventory.create({
      material_name,
      current_stock: parseFloat(current_stock),
      min_stock: parseFloat(min_stock),
      unit: unit || 'kg',
      supplier: supplier || '',
      unit_price: unit_price ? parseFloat(unit_price) : null,
      purchase_price: purchase_price ? parseFloat(purchase_price) : null,
      gst_rate: gst_rate ? parseFloat(gst_rate) : 0,
      last_purchase_date: last_purchase_date || null,
      status
    });
    res.status(201).json(newItem);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating inventory item", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

app.put("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { current_stock, min_stock, status, operation, unit, supplier, unit_price, purchase_price, gst_rate, last_purchase_date } = req.body;
    
    if (!dbConnected) {
      const item = mockInventory.find((i) => i.id === parseInt(id));
      if (item) {
        // Handle different operations
        if (operation === 'add') {
          item.current_stock = (item.current_stock || 0) + 1;
        } else if (operation === 'remove') {
          item.current_stock = Math.max(0, (item.current_stock || 0) - 1);
        } else if (current_stock !== undefined) {
          item.current_stock = Math.max(0, parseFloat(current_stock));
        }
        
        // Update min_stock if provided
        if (min_stock !== undefined) {
          item.min_stock = parseFloat(min_stock);
        }
        
        // Auto-update status if not explicitly set
        if (status !== undefined) {
          item.status = status;
        } else {
          item.status = item.current_stock > item.min_stock ? "In Stock" : "Out of Stock";
        }
        
        return res.json({ message: "Inventory item updated", item });
      }
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const inventoryItem = await Inventory.findByPk(id);
    if (!inventoryItem) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    // Handle different operations
    let updateData = {};
    if (operation === 'add') {
      updateData.current_stock = Math.max(0, (inventoryItem.current_stock || 0) + 1);
    } else if (operation === 'remove') {
      updateData.current_stock = Math.max(0, (inventoryItem.current_stock || 0) - 1);
    } else {
      if (current_stock !== undefined) updateData.current_stock = Math.max(0, parseFloat(current_stock));
      if (min_stock !== undefined) updateData.min_stock = parseFloat(min_stock);
      if (unit !== undefined) updateData.unit = unit;
      if (supplier !== undefined) updateData.supplier = supplier;
      if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price);
      if (purchase_price !== undefined) updateData.purchase_price = parseFloat(purchase_price);
      if (gst_rate !== undefined) updateData.gst_rate = parseFloat(gst_rate);
      if (last_purchase_date !== undefined) updateData.last_purchase_date = last_purchase_date;
    }

    // Auto-update status if not explicitly provided
    if (status !== undefined) {
      updateData.status = status;
    } else {
      const currentStock = updateData.current_stock !== undefined ? updateData.current_stock : inventoryItem.current_stock;
      const minStock = updateData.min_stock !== undefined ? updateData.min_stock : inventoryItem.min_stock;
      updateData.status = currentStock > minStock ? "In Stock" : "Out of Stock";
    }

    const [updated] = await Inventory.update(updateData, { where: { id } });
    if (updated) {
      const updatedItem = await Inventory.findByPk(id);
      res.json({ message: "Inventory item updated", item: updatedItem });
    } else {
      res.status(404).json({ message: "Inventory item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating inventory item", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

app.delete("/api/inventory/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!dbConnected) {
      const index = mockInventory.findIndex((i) => i.id === parseInt(id));
      if (index !== -1) {
        const deletedItem = mockInventory.splice(index, 1)[0];
        return res.json({ message: "Inventory item deleted", item: deletedItem });
      }
      return res.status(404).json({ message: "Inventory item not found" });
    }

    const deleted = await Inventory.destroy({ where: { id } });
    if (deleted) {
      res.json({ message: "Inventory item deleted successfully" });
    } else {
      res.status(404).json({ message: "Inventory item not found" });
    }
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting inventory item", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// User Registration Endpoint (admin only)
app.post("/register", strictLimiter, verifyToken, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admins can register users" });
  }
  const { username, password, role, name } = req.body;
  try {
    if (!dbConnected) {
      return res
        .status(201)
        .json({ message: "User registered", user: { username, role, name } });
    }
    const existing = await User.findOne({ where: { username } });
    if (existing)
      return res.status(409).json({ message: "Username already exists" });
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
    res.status(500).json({ message: "Registration error", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Admin-only endpoint to create new users
app.post("/api/users", strictLimiter, verifyToken, async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create users" });
    }

    // Validate inputs
    if (!username || !password || !role || !name) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate role
    const validRoles = [
      "admin",
      "franchise",
      "subfranchise",
      "manager",
      "waiter",
      "cashier",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!dbConnected) {
      // Demo mode - create user in mockUsers array
      const { username, password, role, name } = req.body;
      
      // Check if username already exists
      const existing = mockUsers.find(u => u.username === username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const hashedForMock = await bcrypt.hash(password, 10);
      const newUser = {
        id: getNextMockId(mockUsers),
        username,
        password: hashedForMock,
        role,
        name,
        subfranchise_id:
          req.body.subfranchise_id != null && req.body.subfranchise_id !== ""
            ? Number(req.body.subfranchise_id)
            : null,
      };
      mockUsers.push(newUser);

      const created = {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        name: newUser.name,
        subfranchise_id: newUser.subfranchise_id || null,
      };
      io.emit("user_created", created);
      return res.status(201).json({
        message: "User created successfully",
        user: created,
      });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Username already exists" });
    }

    const { subfranchise_id: linkLocationId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const branchId =
      linkLocationId != null && linkLocationId !== ""
        ? Number(linkLocationId)
        : null;
    const user = await User.create({
      username,
      password: hashedPassword,
      role,
      name,
      subfranchise_id:
        role === "admin"
          ? null
          : branchId,
    });

    if (role === "franchise" && linkLocationId) {
      await SubFranchise.update(
        { owner_user_id: user.id },
        { where: { id: linkLocationId } }
      );
    }

    const created = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      subfranchise_id: user.subfranchise_id,
    };
    io.emit("user_created", created);
    res.status(201).json({
      message: "User created successfully",
      user: created,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating user", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get all users (admin only)
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view users" });
    }

    if (!dbConnected) {
      // Return mock users in demo mode
      return res.json(mockUsers.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      })));
    }

    const users = await User.findAll({
      attributes: ["id", "username", "role", "name", "subfranchise_id"],
    });
    res.json(users);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Update user (admin only)
app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update users" });
    }

    const { id } = req.params;
    const { username, role, name, password } = req.body;

    // Prevent admin from changing their own role
    if (String(id) === String(req.user.id) && role && role !== req.user.role) {
      return res.status(400).json({ message: "Cannot change your own role" });
    }

    if (!dbConnected) {
      // Demo mode - update user in mockUsers array
      const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
      if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = mockUsers[userIndex];
      
      // Validate role
      const validRoles = [
        "admin",
        "franchise",
        "subfranchise",
        "manager",
        "waiter",
        "cashier",
      ];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      if (username && username !== user.username) {
        const existing = mockUsers.find(u => u.username === username);
        if (existing) {
          return res.status(409).json({ message: "Username already exists" });
        }
        user.username = username;
      }
      
      if (role) user.role = role;
      if (name) user.name = name;
      if (password) {
        user.password = await bcrypt.hash(password, 10);
      }
      
      const updatedMock = {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        subfranchise_id: user.subfranchise_id || null,
      };
      io.emit("user_updated", updatedMock);
      return res.json({
        message: "User updated successfully",
        user: updatedMock,
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role
    const validRoles = [
      "admin",
      "franchise",
      "subfranchise",
      "manager",
      "waiter",
      "cashier",
    ];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username } });
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      user.username = username;
    }

    if (role) user.role = role;
    if (name) user.name = name;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    const { subfranchise_id: linkLocationId } = req.body;
    if (linkLocationId !== undefined) {
      user.subfranchise_id = linkLocationId || null;
    }

    await user.save();

    if (user.role === "franchise" && linkLocationId) {
      await SubFranchise.update(
        { owner_user_id: user.id },
        { where: { id: linkLocationId } }
      );
    }

    const updated = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      subfranchise_id: user.subfranchise_id,
    };
    io.emit("user_updated", updated);
    res.json({
      message: "User updated successfully",
      user: updated,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating user", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Delete user (admin only)
app.delete("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete users" });
    }

    const { id } = req.params;

    if (!dbConnected) {
      // Demo mode - delete user from mockUsers array
      const userIndex = mockUsers.findIndex(u => u.id === parseInt(id));
      if (userIndex === -1) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const user = mockUsers[userIndex];
      
      // Prevent deleting yourself
      if (user.username === req.user.username) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const removed = mockUsers.splice(userIndex, 1)[0];
      io.emit("user_deleted", { id: removed?.id });

      return res.json({ message: "User deleted successfully" });
    }

    // Prevent deleting yourself
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.username === req.user.username) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    const deletedId = user.id;
    await user.destroy();
    io.emit("user_deleted", { id: deletedId });

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting user", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// ===== PERMISSION MANAGEMENT ENDPOINTS =====

// Get all permissions
app.get("/api/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can view permissions" });
    }

    if (!dbConnected) {
      return res.json([
        { id: 1, name: "view_dashboard", category: "reporting" },
        { id: 2, name: "manage_users", category: "user_management" },
        { id: 3, name: "manage_menu", category: "menu_management" },
        { id: 4, name: "manage_orders", category: "order_management" },
        { id: 5, name: "manage_inventory", category: "inventory_management" },
        { id: 6, name: "view_billing", category: "billing" },
        { id: 7, name: "view_users", category: "user_management" },
        { id: 8, name: "create_user", category: "user_management" },
        { id: 9, name: "edit_user", category: "user_management" },
        { id: 10, name: "delete_user", category: "user_management" },
        { id: 11, name: "manage_roles", category: "user_management" },
        { id: 12, name: "view_menu", category: "menu_management" },
        { id: 13, name: "create_menu_item", category: "menu_management" },
        { id: 14, name: "edit_menu_item", category: "menu_management" },
        { id: 15, name: "delete_menu_item", category: "menu_management" },
        { id: 16, name: "view_orders", category: "order_management" },
        { id: 17, name: "create_order", category: "order_management" },
        { id: 18, name: "edit_order", category: "order_management" },
        { id: 19, name: "delete_order", category: "order_management" },
        { id: 20, name: "manage_qr_codes", category: "order_management" },
        { id: 21, name: "mark_order_preparing", category: "order_management" },
        { id: 22, name: "mark_order_ready", category: "order_management" },
        {
          id: 23,
          name: "confirm_order_delivery",
          category: "order_management",
        },
        { id: 24, name: "view_inventory", category: "inventory_management" },
        { id: 25, name: "edit_inventory", category: "inventory_management" },
        { id: 26, name: "view_billing", category: "billing" },
        { id: 27, name: "process_payments", category: "billing" },
        { id: 28, name: "view_bills", category: "billing" },
        { id: 29, name: "view_dashboard", category: "reporting" },
        { id: 30, name: "view_reports", category: "reporting" },
        { id: 31, name: "kitchen_display", category: "reporting" },
        { id: 32, name: "manage_settings", category: "settings" },
        { id: 33, name: "manage_subfranchise", category: "settings" },
      ]);
    }

    const permissions = await Permission.findAll();
    res.json(permissions);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching permissions", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get all roles with their permissions
app.get("/api/roles", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view roles" });
    }

    if (!dbConnected) {
      return res.json([
        {
          id: 1,
          name: "admin",
          description: "Full access",
          permissions: ["*"],
        },
        {
          id: 2,
          name: "franchise",
          description: "Franchise owner access",
          permissions: [],
        },
        {
          id: 3,
          name: "waiter",
          description: "Waiter access",
          permissions: [],
        },

      ]);
    }

    const roles = await Role.findAll({
      include: [
        {
          model: RolePermission,
          as: "RolePermissions",
          include: [
            {
              model: Permission,
              as: "Permission",
            },
          ],
        },
      ],
    });

    const formattedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.RolePermissions.map((rp) => rp.Permission.name),
    }));

    res.json(formattedRoles);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching roles", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Create role (admin only)
app.post("/api/roles", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create roles" });
    }

    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    if (!dbConnected) {
      return res.status(201).json({
        message: "Role created successfully",
        role: { id: 1, name, description, permissions },
      });
    }

    const existing = await Role.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: "Role already exists" });
    }

    const role = await Role.create({ name, description });

    if (permissions && Array.isArray(permissions)) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({
          where: { name: permName },
        });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.status(201).json({
      message: "Role created successfully",
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating role", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Update role permissions (admin only)
app.put("/api/roles/:id/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update roles" });
    }

    const { id } = req.params;
    const { permissions } = req.body;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Remove existing permissions
    await RolePermission.destroy({ where: { roleId: id } });

    // Add new permissions
    if (permissions && Array.isArray(permissions)) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({
          where: { name: permName },
        });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.json({
      message: "Role permissions updated successfully",
      role: { id: role.id, name: role.name, permissions },
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating role", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Create a new permission (admin only)
app.post("/api/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can create permissions" });
    }

    const { name, description, category } = req.body;

    if (!dbConnected) {
      return res.status(400).json({ message: "Database not connected" });
    }

    const existing = await Permission.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: "Permission already exists" });
    }

    const permission = await Permission.create({
      name,
      description: description || "",
      category: category || "general",
    });

    res.status(201).json({
      message: "Permission created successfully",
      permission,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error creating permission", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get user's permissions
app.get("/api/my-permissions", verifyToken, async (req, res) => {
  try {
    const permissions = await getPermissionsForUser(req.user);
    res.json({ permissions, role: req.user.role });
  } catch (err) {
    console.error(`❌ Error fetching permissions:`, err);
    res
      .status(500)
      .json({ message: "Error fetching permissions", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Get all users with their permissions (for Permission Management)
app.get("/api/users-with-permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can view user permissions" });
    }

    if (!dbConnected) {
      // Demo mode - return mock users with role-based permissions
      const rolePermissions = {
        admin: ["*"],
        manager: [
          "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders", 
          "create_order", "view_orders", "edit_order", "view_inventory", 
          "manage_inventory", "edit_inventory", "view_billing", "process_payments", 
          "view_bills", "kitchen_display", "view_menu", "manage_menu", 
          "create_menu_item", "edit_menu_item", "delete_menu_item",
          "mark_order_preparing", "mark_order_ready", "confirm_order_delivery"
        ],
        waiter: [
          "view_dashboard", "manage_qr_codes", "create_order", "view_orders", 
          "edit_order", "view_billing", "process_payments", "kitchen_display"
        ],

        franchise: [
          "view_dashboard", "view_reports", "manage_qr_codes", "manage_orders", 
          "create_order", "view_orders", "view_inventory", "view_billing", 
          "view_bills", "kitchen_display", "view_menu", "manage_subfranchise"
        ],
        subfranchise: [
          "view_dashboard", "manage_qr_codes", "create_order", "view_orders", 
          "view_inventory", "view_billing", "kitchen_display", "view_menu"
        ]
      };

      const usersWithPermissions = mockUsers.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions:
          user.role === "franchise" || user.role === "subfranchise"
            ? mockUserPermissions[user.id] || []
            : rolePermissions[user.role] || [],
      }));

      return res.json(usersWithPermissions.filter((u) => u.role !== "admin"));
    }

    const users = await User.findAll();

    const usersWithPermissions = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: await getPermissionsForUser(user),
      }))
    );

    res.json(usersWithPermissions.filter((u) => u.role !== "admin"));
  } catch (err) {
    console.error("Error fetching users with permissions:", err);
    res.status(500).json({ message: "Error fetching users with permissions", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Update user permissions (for Permission Management)
app.put("/api/users/:id/permissions", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update user permissions" });
    }

    const { id } = req.params;
    const { permissions } = req.body;

    const user = await User.findByPk(id);
    if (!user && dbConnected) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser =
      user ||
      mockUsers.find((u) => Number(u.id) === Number(id));

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role === "franchise" || targetUser.role === "subfranchise") {
      if (!dbConnected) {
        mockUserPermissions[targetUser.id] = permissions || [];
        return res.json({
          message: "Permissions updated successfully",
          userId: id,
          permissions: permissions || [],
        });
      }
      await UserPermission.destroy({ where: { userId: targetUser.id } });
      if (permissions && permissions.length > 0) {
        for (const permName of permissions) {
          const permission = await Permission.findOne({ where: { name: permName } });
          if (permission) {
            await UserPermission.create({
              userId: targetUser.id,
              permissionId: permission.id,
            });
          }
        }
      }
      return res.json({
        message: "Permissions updated successfully",
        userId: id,
        role: targetUser.role,
        permissions: permissions || [],
      });
    }

    if (!dbConnected) {
      return res.json({
        message: "Permissions updated (demo mode)",
        userId: id,
        permissions: permissions || [],
      });
    }

    const role = await Role.findOne({ where: { name: targetUser.role } });
    if (!role) {
      return res.status(404).json({ message: "Role not found for user" });
    }

    await RolePermission.destroy({ where: { roleId: role.id } });

    if (permissions && permissions.length > 0) {
      for (const permName of permissions) {
        const permission = await Permission.findOne({ where: { name: permName } });
        if (permission) {
          await RolePermission.create({
            roleId: role.id,
            permissionId: permission.id,
          });
        }
      }
    }

    res.json({
      message: "Permissions updated successfully",
      userId: id,
      role: targetUser.role,
      permissions: permissions || [],
    });
  } catch (err) {
    console.error("Error updating user permissions:", err);
    res.status(500).json({ message: "Error updating user permissions", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// ============================================================================
// SETTINGS API ENDPOINTS
// ============================================================================

// Get all settings or a specific setting by key (publicly readable so QR menu can get tax rates)
app.get("/api/settings", optionalToken, async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!dbConnected) {
      // Fallback to defaults in demo mode
      const defaults = {
        taxPercent: 5,
        discountPercent: 0
      };
      if (key) {
        return res.json({ key, value: defaults[key] ?? null });
      }
      return res.json(defaults);
    }
    
    if (key) {
      const setting = await Settings.findOne({ where: { key } });
      if (setting) {
        let parsedValue;
        try { parsedValue = JSON.parse(setting.value); } catch { parsedValue = setting.value; }
        return res.json({ key: setting.key, value: parsedValue });
      }
      // A missing optional setting is a normal first-run state. Returning a
      // successful null avoids noisy browser 404s for defaults such as the
      // tax configuration and the admin-uploaded payment QR.
      return res.json({ key, value: null });
    }
    
    const allSettings = await Settings.findAll();
    const settingsMap = {};
    allSettings.forEach(s => {
      try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
    });
    res.json(settingsMap);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ message: "Error fetching settings", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Update or create a setting (admin only)
app.put("/api/settings", verifyToken, async (req, res) => {
  try {
    // Check if user is admin - req.user is set by verifyToken middleware
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only admin can update settings" });
    }
    
    const { key, value, description } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ message: "Key and value are required" });
    }
    
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    
    const [setting, created] = await Settings.upsert({
      key,
      value: JSON.stringify(value),
      description: description || '',
      updated_at: new Date()
    });
    
    res.json({
      message: created ? "Setting created" : "Setting updated",
      key,
      value
    });
  } catch (err) {
    console.error("Error updating setting:", err);
    res.status(500).json({ message: "Error updating setting", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// Batch update settings (admin only)
app.put("/api/settings/batch", verifyToken, async (req, res) => {
  try {
    // Check if user is admin - req.user is set by verifyToken middleware
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only admin can update settings" });
    }
    
    const settings = req.body; // { taxPercent: 10, discountPercent: 5 }
    
    if (!dbConnected) {
      return res.status(503).json({ message: "Database not connected" });
    }
    
    const results = [];
    for (const [key, value] of Object.entries(settings)) {
      const [setting, created] = await Settings.upsert({
        key,
        value: JSON.stringify(value),
        description: `Setting for ${key}`,
        updated_at: new Date()
      });
      results.push({ key, value, created });
    }
    
    res.json({
      message: "Settings updated successfully",
      settings: results
    });
  } catch (err) {
    console.error("Error batch updating settings:", err);
    res.status(500).json({ message: "Error updating settings", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// ============================================================================
// SUB-FRANCHISE & FRANCHISE OVERVIEW
// ============================================================================

const franchiseViewAuth = (req, res, next) => {
  if (
    !req.user ||
    !["admin", "franchise", "subfranchise"].includes(req.user.role)
  ) {
    return res.status(403).json({ message: "Franchise access required" });
  }
  next();
};

const franchiseManageAuth = (req, res, next) => {
  if (!req.user || !["admin", "franchise"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Only admin or franchise owner can manage locations" });
  }
  next();
};

async function loadFranchiseData() {
  if (!dbConnected) {
    return {
      orders: mockOrders,
      menuCount: 10,
      subfranchises: mockSubFranchises,
      users: mockUsers,
    };
  }
  const [orders, menuCount, subfranchises, users] = await Promise.all([
    Order.findAll({ order: [["timestamp", "DESC"]] }),
    MenuItem.count(),
    SubFranchise.findAll({ order: [["name", "ASC"]] }),
    User.findAll({ attributes: ["id", "username", "role", "subfranchise_id"] }),
  ]);
  return { orders, menuCount, subfranchises, users };
}

function canAccessLocation(req, locationId) {
  if (req.user.role === "subfranchise") {
    return Number(req.user.subfranchise_id) === Number(locationId);
  }
  return true;
}

app.get("/api/subfranchises", verifyToken, franchiseViewAuth, async (req, res) => {
  try {
    const { orders, subfranchises, users } = await loadFranchiseData();
    let list = subfranchises;
    if (req.user.role === "subfranchise") {
      list = list.filter(
        (s) => Number(s.id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      list = list.filter((s) => locIds.includes(Number(s.id)));
    }
    const enriched = list.map((sf) => {
      const loginUser = users.find(
        (u) => Number(u.subfranchise_id) === Number(sf.id)
      );
      return enrichSubFranchise(sf, orders, loginUser);
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get(
  "/api/subfranchises/:id/detail",
  verifyToken,
  franchiseViewAuth,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only admin can open location drill-down details" });
      }
      if (!canAccessLocation(req, id)) {
        return res.status(403).json({ message: "Access denied for this location" });
      }
      const { orders, subfranchises, users } = await loadFranchiseData();
      const sf = subfranchises.find((s) => Number(s.id) === id);
      if (!sf) return res.status(404).json({ message: "Location not found" });

      const loginUser = users.find((u) => Number(u.subfranchise_id) === id);
      const locOrders = orders.filter((o) => Number(o.subfranchise_id) === id);
      const stats = computeLocationStats(orders, id);

      const recentOrders = locOrders.slice(0, 25).map((o) => {
        const j = o.toJSON ? o.toJSON() : o;
        return {
          id: j.id,
          table_name: j.table_name,
          status: j.status,
          total: j.total,
          type: j.type,
          timestamp: j.timestamp,
        };
      });

      res.json({
        location: enrichSubFranchise(sf, orders, loginUser),
        stats,
        recentOrders,
        loginUsername: loginUser?.username || null,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

app.post("/api/subfranchises", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const {
      login_username,
      login_password,
      name,
      code,
      address,
      city,
      phone,
      email,
      manager_name,
      status,
      notes,
    } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: "Name and code are required" });
    }
    const sfData = {
      name,
      code,
      address,
      city,
      phone,
      email,
      manager_name,
      status: status || "active",
      notes,
    };
    if (req.user.role === "franchise") {
      sfData.owner_user_id = req.user.id;
    } else if (req.body.owner_user_id) {
      sfData.owner_user_id = req.body.owner_user_id;
    }

    if (!dbConnected) {
      const row = {
        id: getNextMockId(mockSubFranchises),
        ...sfData,
      };
      mockSubFranchises.push(row);
      if (login_username && login_password) {
        mockUsers.push({
          id: getNextMockId(mockUsers),
          username: login_username,
          password: await bcrypt.hash(login_password, 10),
          role: "subfranchise",
          name: manager_name || name,
          subfranchise_id: row.id,
        });
      }
      io.emit("subfranchise_created", row);
      return res.status(201).json(row);
    }

    const created = await SubFranchise.create(sfData);
    if (login_username && login_password) {
      const existing = await User.findOne({ where: { username: login_username } });
      if (existing) {
        return res.status(409).json({ message: "Login username already exists" });
      }
      const sfUser = await User.create({
        username: login_username,
        password: await bcrypt.hash(login_password, 10),
        role: "subfranchise",
        name: manager_name || name,
        subfranchise_id: created.id,
      });
      io.emit("user_created", {
        id: sfUser.id,
        username: sfUser.username,
        role: sfUser.role,
        name: sfUser.name,
        subfranchise_id: sfUser.subfranchise_id,
      });
    }
    io.emit("subfranchise_created", created);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.put("/api/subfranchises/:id", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { login_username, login_password, ...updates } = req.body;
    if (!dbConnected) {
      const idx = mockSubFranchises.findIndex((s) => s.id === id);
      if (idx === -1) return res.status(404).json({ message: "Not found" });
      mockSubFranchises[idx] = { ...mockSubFranchises[idx], ...updates, id };
      return res.json(mockSubFranchises[idx]);
    }
    const row = await SubFranchise.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    if (
      req.user.role === "franchise" &&
      Number(row.owner_user_id) !== Number(req.user.id)
    ) {
      return res.status(403).json({ message: "You can only edit your own locations" });
    }
    await row.update(updates);

    if (updates.owner_user_id && req.user.role === "admin") {
      const owner = await User.findByPk(updates.owner_user_id);
      if (owner?.role === "franchise") {
        await owner.update({ subfranchise_id: id });
      }
    }

    if (login_username) {
      let loginUser = await User.findOne({ where: { subfranchise_id: id } });
      if (!loginUser) {
        loginUser = await User.create({
          username: login_username,
          password: await bcrypt.hash(login_password || "pass", 10),
          role: "subfranchise",
          name: updates.manager_name || row.name,
          subfranchise_id: id,
        });
      } else {
        const patch = { username: login_username };
        if (login_password) patch.password = await bcrypt.hash(login_password, 10);
        await loginUser.update(patch);
      }
    }
    io.emit("subfranchise_updated", row);
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete("/api/subfranchises/:id", verifyToken, franchiseManageAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!dbConnected) {
      mockSubFranchises = mockSubFranchises.filter((s) => s.id !== id);
      io.emit("subfranchise_deleted", { id });
      return res.json({ message: "Deleted" });
    }
    const row = await SubFranchise.findByPk(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    await User.destroy({ where: { subfranchise_id: id } });
    await row.destroy();
    io.emit("subfranchise_deleted", { id });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/franchise/overview", verifyToken, franchiseViewAuth, async (req, res) => {
  try {
    const { orders, menuCount, subfranchises, users } = await loadFranchiseData();

    let list = subfranchises;
    if (req.user.role === "subfranchise") {
      list = list.filter(
        (s) => Number(s.id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = await getFranchiseLocationIds(req.user);
      list = list.filter((s) => locIds.includes(Number(s.id)));
    }

    const locationStats = list.map((sf) => {
      const loginUser = users.find(
        (u) => Number(u.subfranchise_id) === Number(sf.id)
      );
      return enrichSubFranchise(sf, orders, loginUser);
    });

    let scopedOrders = orders;
    if (req.user.role === "subfranchise") {
      scopedOrders = orders.filter(
        (o) => Number(o.subfranchise_id) === Number(req.user.subfranchise_id)
      );
    } else if (req.user.role === "franchise") {
      const locIds = list.map((s) => Number(s.id));
      scopedOrders = orders.filter((o) =>
        locIds.includes(Number(o.subfranchise_id))
      );
    }

    const globalStats = computeStatsFromOrderList(scopedOrders);

    const unassignedStats =
      req.user.role === "admin"
        ? computeLocationStats(orders, null)
        : null;

    const recentOrders = scopedOrders.slice(0, 40).map((o) => {
      const j = o.toJSON ? o.toJSON() : o;
      return {
        id: j.id,
        table_name: j.table_name,
        status: j.status,
        total: j.total,
        type: j.type,
        timestamp: j.timestamp,
        subfranchise_id: j.subfranchise_id,
      };
    });

    res.json({
      scope: req.user.role,
      stats: {
        totalSales: globalStats.totalSales,
        amountGenerated: globalStats.amountGenerated,
        todaySales: globalStats.todaySales,
        activeOrders: globalStats.activeOrders,
        totalOrders: globalStats.totalOrders,
        menuItems: menuCount,
        subfranchiseCount: list.length,
        pendingAmount: globalStats.pendingAmount,
      },
      unassigned: unassignedStats,
      subfranchises: locationStats,
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================================================
// Staff directory — list users grouped/filterable by branch
// ============================================================================

app.get("/api/staff", verifyToken, async (req, res) => {
  try {
    const allowedRoles = ["admin", "manager", "franchise", "subfranchise"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (!dbConnected) {
      const branches = mockSubFranchises.map((sf) => ({
        id: sf.id,
        name: sf.name,
        code: sf.code,
        city: sf.city,
      }));
      const staff = mockUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        name: u.name,
        subfranchise_id: u.subfranchise_id || null,
      }));
      return res.json({ branches, staff });
    }

    const [users, branches] = await Promise.all([
      User.findAll({
        attributes: ["id", "username", "role", "name", "subfranchise_id"],
        order: [["name", "ASC"]],
      }),
      SubFranchise.findAll({ order: [["name", "ASC"]] }),
    ]);

    let visibleBranchIds = null;
    if (req.user.role === "subfranchise") {
      visibleBranchIds = [Number(req.user.subfranchise_id)];
    } else if (req.user.role === "franchise") {
      const ids = await getFranchiseLocationIds(req.user);
      visibleBranchIds = ids.map(Number);
    }

    const filteredBranches = visibleBranchIds
      ? branches.filter((b) => visibleBranchIds.includes(Number(b.id)))
      : branches;

    const filteredStaff = visibleBranchIds
      ? users.filter(
          (u) =>
            u.subfranchise_id != null &&
            visibleBranchIds.includes(Number(u.subfranchise_id))
        )
      : users;

    res.json({
      branches: filteredBranches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        city: b.city,
        phone: b.phone,
      })),
      staff: filteredStaff.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        name: u.name,
        subfranchise_id: u.subfranchise_id,
      })),
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching staff", error: process.env.NODE_ENV === 'production' ? "Internal server error" : err.message });
  }
});

// ============================================================================
// ========================= ATTENDANCE SYSTEM APIs ==========================
// ============================================================================

const authenticate = verifyToken;

// Helper: compute hours between two Date/string values
function diffHours(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, (new Date(end) - new Date(start)) / 3600000);
}

// Helper: scope attendance where-clause by user role
async function scopedAttendanceWhere(req) {
  const where = {};
  if (req.user.role === 'subfranchise') {
    where.subfranchise_id = req.user.subfranchise_id;
  } else if (!['admin', 'manager', 'franchise'].includes(req.user.role)) {
    where.user_id = req.user.id;
  }
  return where;
}

// GET /api/attendance - list records with filters
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { date, user_id, month, year, status, subfranchise_id } = req.query;
    const where = await scopedAttendanceWhere(req);
    if (date) where.date = date;
    if (status) where.status = status;
    if (user_id && ['admin', 'manager', 'franchise'].includes(req.user.role)) {
      where.user_id = parseInt(user_id);
    }
    if (subfranchise_id && req.user.role === 'admin') {
      where.subfranchise_id = parseInt(subfranchise_id);
    }
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (year && !month) {
      where.date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    }
    const records = await Attendance.findAll({ where, order: [['date', 'DESC'], ['clock_in', 'DESC']], limit: 500 });
    res.json(records);
  } catch (err) {
    console.error('Attendance GET error:', err);
    res.status(500).json({ message: 'Error fetching attendance', error: err.message });
  }
});

// GET /api/attendance/me/status - current user today status
app.get('/api/attendance/me/status', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today }, order: [['clock_in', 'DESC']] });
    res.json(record || { status: 'not_clocked_in', date: today });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching status', error: err.message });
  }
});

// GET /api/attendance/today
app.get('/api/attendance/today', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const where = await scopedAttendanceWhere(req);
    where.date = today;
    const records = await Attendance.findAll({ where, order: [['clock_in', 'ASC']] });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching today attendance', error: err.message });
  }
});

// GET /api/attendance/summary
app.get('/api/attendance/summary', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || (new Date().getMonth() + 1);
    const y = parseInt(year) || new Date().getFullYear();
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(y, m, 0).toISOString().slice(0, 10);
    const where = await scopedAttendanceWhere(req);
    where.date = { [Op.between]: [startDate, endDate] };
    const records = await Attendance.findAll({ where });
    res.json({
      total: records.length,
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      late: records.filter(r => r.status === 'late').length,
      half_day: records.filter(r => r.status === 'half_day').length,
      on_leave: records.filter(r => r.status === 'leave').length,
      total_hours: records.reduce((s, r) => s + (r.net_hours || 0), 0).toFixed(2),
      total_overtime: records.reduce((s, r) => s + (r.overtime_hours || 0), 0).toFixed(2),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching summary', error: err.message });
  }
});

// GET /api/attendance/:id
app.get('/api/attendance/:id', authenticate, async (req, res) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (!['admin', 'manager'].includes(req.user.role) && record.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching record', error: err.message });
  }
});

// POST /api/attendance/clock-in
app.post('/api/attendance/clock-in', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const existing = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });
    if (existing) {
      if (existing.clock_in && !existing.clock_out) return res.status(400).json({ message: 'Already clocked in. Please clock out first.' });
      return res.status(400).json({ message: 'Attendance already exists for today.' });
    }
    const { notes, shift = 'full_day', expected_hours = 8 } = req.body;
    const shiftStart = new Date(now); shiftStart.setHours(9, 30, 0, 0);
    const isLate = now > shiftStart;
    const record = await Attendance.create({
      user_id: req.user.id,
      user_name: req.user.name || req.user.username,
      user_role: req.user.role,
      subfranchise_id: req.user.subfranchise_id || null,
      date: today, clock_in: now,
      status: isLate ? 'late' : 'present',
      shift, expected_hours: parseFloat(expected_hours),
      notes: notes || null,
    });
    io.emit('attendance_update', { type: 'clock_in', record });
    res.status(201).json({ message: 'Clocked in successfully', record, isLate });
  } catch (err) {
    console.error('Clock-in error:', err);
    res.status(500).json({ message: 'Error clocking in', error: err.message });
  }
});

// POST /api/attendance/clock-out
app.post('/api/attendance/clock-out', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today, clock_out: null }, order: [['clock_in', 'DESC']] });
    if (!record) return res.status(404).json({ message: 'No active clock-in found for today.' });
    const totalHours = diffHours(record.clock_in, now);
    const breakHours = diffHours(record.break_start, record.break_end);
    const netHours = Math.max(0, totalHours - breakHours);
    const overtimeHours = Math.max(0, netHours - (record.expected_hours || 8));
    let status = record.status;
    if (netHours < 4 && !['late', 'leave'].includes(status)) status = 'half_day';
    await record.update({
      clock_out: now,
      total_hours: parseFloat(totalHours.toFixed(2)),
      break_hours: parseFloat(breakHours.toFixed(2)),
      net_hours: parseFloat(netHours.toFixed(2)),
      overtime_hours: parseFloat(overtimeHours.toFixed(2)),
      status,
    });
    io.emit('attendance_update', { type: 'clock_out', record });
    res.json({ message: 'Clocked out successfully', record, summary: { totalHours: totalHours.toFixed(2), netHours: netHours.toFixed(2), overtimeHours: overtimeHours.toFixed(2) } });
  } catch (err) {
    console.error('Clock-out error:', err);
    res.status(500).json({ message: 'Error clocking out', error: err.message });
  }
});

// POST /api/attendance/break-start
app.post('/api/attendance/break-start', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today, clock_out: null } });
    if (!record) return res.status(404).json({ message: 'No active shift found.' });
    if (record.break_start && !record.break_end) return res.status(400).json({ message: 'Break already started.' });
    await record.update({ break_start: new Date(), break_end: null });
    res.json({ message: 'Break started', record });
  } catch (err) {
    res.status(500).json({ message: 'Error starting break', error: err.message });
  }
});

// POST /api/attendance/break-end
app.post('/api/attendance/break-end', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today, clock_out: null } });
    if (!record) return res.status(404).json({ message: 'No active shift found.' });
    if (!record.break_start) return res.status(400).json({ message: 'Break not started.' });
    const breakHours = diffHours(record.break_start, new Date());
    await record.update({ break_end: new Date(), break_hours: parseFloat(breakHours.toFixed(2)) });
    res.json({ message: 'Break ended', record });
  } catch (err) {
    res.status(500).json({ message: 'Error ending break', error: err.message });
  }
});

// POST /api/attendance - manual create (admin/manager)
app.post('/api/attendance', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const { user_id, user_name, user_role, subfranchise_id, date, clock_in, clock_out, break_start, break_end, status, leave_type, notes, shift, expected_hours } = req.body;
    if (!user_id || !date || !status) return res.status(400).json({ message: 'user_id, date, and status are required.' });
    const existing = await Attendance.findOne({ where: { user_id, date } });
    if (existing) return res.status(400).json({ message: 'Attendance already exists for this user on this date.' });
    const exp = parseFloat(expected_hours || 8);
    const totalHours = diffHours(clock_in, clock_out);
    const breakHours = diffHours(break_start, break_end);
    const netHours = Math.max(0, totalHours - breakHours);
    const overtimeHours = Math.max(0, netHours - exp);
    const record = await Attendance.create({
      user_id, user_name, user_role, subfranchise_id: subfranchise_id || null, date,
      clock_in: clock_in || null, clock_out: clock_out || null, break_start: break_start || null, break_end: break_end || null,
      status, leave_type: leave_type || null, notes: notes || null, shift: shift || 'full_day', expected_hours: exp,
      total_hours: parseFloat(totalHours.toFixed(2)), break_hours: parseFloat(breakHours.toFixed(2)),
      net_hours: parseFloat(netHours.toFixed(2)), overtime_hours: parseFloat(overtimeHours.toFixed(2)),
    });
    io.emit('attendance_update', { type: 'create', record });
    res.status(201).json(record);
  } catch (err) {
    console.error('Attendance create error:', err);
    res.status(500).json({ message: 'Error creating attendance', error: err.message });
  }
});

// PUT /api/attendance/:id
app.put('/api/attendance/:id', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const updates = req.body;
    const ci = updates.clock_in !== undefined ? updates.clock_in : record.clock_in;
    const co = updates.clock_out !== undefined ? updates.clock_out : record.clock_out;
    const bs = updates.break_start !== undefined ? updates.break_start : record.break_start;
    const be = updates.break_end !== undefined ? updates.break_end : record.break_end;
    const exp = updates.expected_hours !== undefined ? parseFloat(updates.expected_hours) : record.expected_hours;
    const totalHours = diffHours(ci, co);
    const breakHours = diffHours(bs, be);
    const netHours = Math.max(0, totalHours - breakHours);
    const overtimeHours = Math.max(0, netHours - exp);
    await record.update({ ...updates, total_hours: parseFloat(totalHours.toFixed(2)), break_hours: parseFloat(breakHours.toFixed(2)), net_hours: parseFloat(netHours.toFixed(2)), overtime_hours: parseFloat(overtimeHours.toFixed(2)) });
    io.emit('attendance_update', { type: 'update', record });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error updating attendance', error: err.message });
  }
});

// PUT /api/attendance/:id/approve
app.put('/api/attendance/:id/approve', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    await record.update({ is_approved: true, approved_by: req.user.id, approved_at: new Date() });
    res.json({ message: 'Approved', record });
  } catch (err) {
    res.status(500).json({ message: 'Error approving', error: err.message });
  }
});

// DELETE /api/attendance/:id (admin only)
app.delete('/api/attendance/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const record = await Attendance.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    await record.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting', error: err.message });
  }
});

// ============================================================================
// ============================================================================

// ========================= PAYROLL SYSTEM APIs ==========================

// GET /api/payroll - list payroll records
app.get('/api/payroll', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const { user_id, status, period_start, period_end, year, month } = req.query;
    const where = {};
    if (user_id) where.user_id = user_id;
    if (status) where.status = status;
    if (period_start && period_end) {
      where.pay_period_start = { [Op.gte]: period_start };
      where.pay_period_end   = { [Op.lte]: period_end };
    }
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      where.pay_period_start = { [Op.lte]: endDate };
      where.pay_period_end   = { [Op.gte]: startDate };
    }
    const records = await Payroll.findAll({ where, order: [['pay_period_start', 'DESC'], ['created_at', 'DESC']] });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payroll', error: err.message });
  }
});

// GET /api/payroll/my - current user's own payslips
app.get('/api/payroll/my', authenticate, async (req, res) => {
  try {
    const records = await Payroll.findAll({
      where: { user_id: req.user.id },
      order: [['pay_period_start', 'DESC']],
      limit: 24,
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payslips', error: err.message });
  }
});

// GET /api/payroll/summary - aggregated salary summary per user for a period
app.get('/api/payroll/summary', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const { year, month } = req.query;
    const where = {};
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      where.pay_period_start = { [Op.lte]: endDate };
      where.pay_period_end   = { [Op.gte]: startDate };
    }
    const records = await Payroll.findAll({ where });
    const totalGross = records.reduce((s, r) => s + parseFloat(r.gross_salary || 0), 0);
    const totalNet   = records.reduce((s, r) => s + parseFloat(r.net_salary   || 0), 0);
    const totalDeductions = records.reduce((s, r) => s + parseFloat(r.total_deductions || 0), 0);
    const totalBonus = records.reduce((s, r) => s + parseFloat(r.performance_bonus || 0) + parseFloat(r.festival_bonus || 0), 0);
    const byStatus = records.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    res.json({ total: records.length, totalGross, totalNet, totalDeductions, totalBonus, byStatus });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payroll summary', error: err.message });
  }
});

// GET /api/payroll/staff-config - get salary config from settings
app.get('/api/payroll/staff-config', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const setting = await Settings.findOne({ where: { key: 'payroll_staff_config' } });
    res.json(setting ? { config: setting.value } : { config: {} });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching staff config', error: err.message });
  }
});

// PUT /api/payroll/staff-config - save salary config for each user
app.put('/api/payroll/staff-config', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const { config } = req.body;
    await Settings.upsert({ key: 'payroll_staff_config', value: JSON.stringify(config), description: 'Per-staff salary configuration for payroll' });
    res.json({ message: 'Staff salary config saved', config });
  } catch (err) {
    res.status(500).json({ message: 'Error saving staff config', error: err.message });
  }
});

// GET /api/payroll/:id
app.get('/api/payroll/:id', authenticate, async (req, res) => {
  try {
    const record = await Payroll.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Payroll record not found' });
    if (!['admin', 'manager'].includes(req.user.role) && record.user_id !== req.user.id)
      return res.status(403).json({ message: 'Forbidden' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching payroll record', error: err.message });
  }
});

// POST /api/payroll - create a payroll record (manual or auto-generated)
app.post('/api/payroll', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const {
      user_id, user_name, user_role, department, subfranchise_id,
      pay_period_start, pay_period_end, pay_period_label,
      total_working_days, days_present, days_absent, days_leave, days_holiday,
      regular_hours, overtime_hours,
      basic_salary, hourly_rate, overtime_rate, overtime_pay,
      hra, transport, meals, medical, other_allowances,
      tax, provident_fund, insurance, advance_deduction, late_deduction, absent_deduction, other_deductions,
      performance_bonus, festival_bonus, tips_shared,
      status, payment_method, payment_reference, payment_date, notes,
    } = req.body;

    const totalAllowances = parseFloat(hra||0) + parseFloat(transport||0) + parseFloat(meals||0) + parseFloat(medical||0) + parseFloat(other_allowances||0);
    const totalDeductions = parseFloat(tax||0) + parseFloat(provident_fund||0) + parseFloat(insurance||0) + parseFloat(advance_deduction||0) + parseFloat(late_deduction||0) + parseFloat(absent_deduction||0) + parseFloat(other_deductions||0);
    const grossSalary = parseFloat(basic_salary||0) + parseFloat(overtime_pay||0) + totalAllowances + parseFloat(performance_bonus||0) + parseFloat(festival_bonus||0) + parseFloat(tips_shared||0);
    const netSalary = grossSalary - totalDeductions;

    let approved_by = null;
    let approved_at = null;
    let paid_by = null;
    let paid_at = null;
    if (status === 'approved') {
      approved_by = req.user.id;
      approved_at = new Date();
    } else if (status === 'paid') {
      approved_by = req.user.id;
      approved_at = new Date();
      paid_by = req.user.id;
      paid_at = payment_date || new Date();
    }

    const record = await Payroll.create({
      user_id, user_name, user_role, department, subfranchise_id,
      pay_period_start, pay_period_end, pay_period_label,
      total_working_days: total_working_days||0, days_present: days_present||0,
      days_absent: days_absent||0, days_leave: days_leave||0, days_holiday: days_holiday||0,
      regular_hours: regular_hours||0, overtime_hours: overtime_hours||0,
      basic_salary: basic_salary||0, hourly_rate: hourly_rate||0,
      overtime_rate: overtime_rate||1.5, overtime_pay: overtime_pay||0,
      hra: hra||0, transport: transport||0, meals: meals||0, medical: medical||0, other_allowances: other_allowances||0,
      total_allowances: totalAllowances,
      tax: tax||0, provident_fund: provident_fund||0, insurance: insurance||0,
      advance_deduction: advance_deduction||0, late_deduction: late_deduction||0,
      absent_deduction: absent_deduction||0, other_deductions: other_deductions||0,
      total_deductions: totalDeductions,
      performance_bonus: performance_bonus||0, festival_bonus: festival_bonus||0, tips_shared: tips_shared||0,
      gross_salary: grossSalary, net_salary: netSalary,
      status: status||'draft', payment_method, payment_reference, payment_date, notes,
      created_by: req.user.id,
      approved_by, approved_at, paid_by, paid_at,
    });
    io.emit('payroll_update', { type: 'create', record });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error creating payroll', error: err.message });
  }
});

// POST /api/payroll/generate - auto-generate payroll from attendance data
app.post('/api/payroll/generate', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const { year, month, staff_config } = req.body;
    if (!year || !month) return res.status(400).json({ message: 'year and month are required' });

    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate   = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
    const periodLabel = new Date(parseInt(year), parseInt(month)-1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const weekendDays = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(parseInt(year), parseInt(month)-1, i+1);
      return d.getDay();
    }).filter(d => d === 0).length; // Count Sundays as holidays
    const workingDays = daysInMonth - weekendDays;

    // Get all attendance for period
    const attendances = await Attendance.findAll({
      where: { date: { [Op.between]: [startDate, endDate] } },
      order: [['date', 'ASC']]
    });

    // Group by user
    const byUser = {};
    attendances.forEach(a => {
      if (!byUser[a.user_id]) byUser[a.user_id] = [];
      byUser[a.user_id].push(a);
    });

    const created = [];
    const skipped = [];

    for (const [userId, records] of Object.entries(byUser)) {
      // Check if payroll already exists for this user+period
      const existing = await Payroll.findOne({
        where: { user_id: userId, pay_period_start: startDate, pay_period_end: endDate }
      });
      if (existing) { skipped.push(userId); continue; }

      const cfg = (staff_config && staff_config[userId]) || {};
      const basicSalary   = parseFloat(cfg.basic_salary || 0);
      const hourlyRate    = parseFloat(cfg.hourly_rate  || 0);
      const otRate        = parseFloat(cfg.overtime_rate || 1.5);
      const hra           = parseFloat(cfg.hra || 0);
      const transport     = parseFloat(cfg.transport || 0);
      const meals         = parseFloat(cfg.meals || 0);
      const medical       = parseFloat(cfg.medical || 0);
      const otherAllw     = parseFloat(cfg.other_allowances || 0);
      const taxPct        = parseFloat(cfg.tax_percent || 0);
      const pfPct         = parseFloat(cfg.pf_percent  || 0);
      const insurance     = parseFloat(cfg.insurance || 0);
      const perfBonus     = parseFloat(cfg.performance_bonus || 0);

      const daysPresent  = records.filter(r => ['present','late'].includes(r.status)).length;
      const daysAbsent   = records.filter(r => r.status === 'absent').length;
      const daysLeave    = records.filter(r => r.status === 'leave').length;
      const daysHoliday  = records.filter(r => r.status === 'holiday').length;
      const regularHrs   = records.reduce((s, r) => s + (r.net_hours || 0), 0);
      const overtimeHrs  = records.reduce((s, r) => s + (r.overtime_hours || 0), 0);
      const lateDays     = records.filter(r => r.status === 'late').length;

      const overtimePay   = parseFloat((overtimeHrs * hourlyRate * otRate).toFixed(2));
      const lateDeduction = parseFloat((lateDays * (basicSalary / workingDays) * 0.1).toFixed(2)); // 10% of daily rate per late
      const absentDeduction = parseFloat((daysAbsent * (basicSalary / workingDays)).toFixed(2));
      const totalAllwc    = hra + transport + meals + medical + otherAllw;
      const grossSalary   = basicSalary + overtimePay + totalAllwc + perfBonus;
      const taxAmt        = parseFloat(((grossSalary * taxPct) / 100).toFixed(2));
      const pfAmt         = parseFloat(((grossSalary * pfPct)  / 100).toFixed(2));
      const totalDed      = taxAmt + pfAmt + insurance + lateDeduction + absentDeduction;
      const netSalary     = parseFloat((grossSalary - totalDed).toFixed(2));

      const userName = records[0].user_name;
      const userRole = records[0].user_role;

      const record = await Payroll.create({
        user_id: userId, user_name: userName, user_role: userRole,
        department: cfg.department || '',
        pay_period_start: startDate, pay_period_end: endDate, pay_period_label: periodLabel,
        total_working_days: workingDays, days_present: daysPresent,
        days_absent: daysAbsent, days_leave: daysLeave, days_holiday: daysHoliday,
        regular_hours: parseFloat(regularHrs.toFixed(2)), overtime_hours: parseFloat(overtimeHrs.toFixed(2)),
        basic_salary: basicSalary, hourly_rate: hourlyRate, overtime_rate: otRate, overtime_pay: overtimePay,
        hra, transport, meals, medical, other_allowances: otherAllw, total_allowances: totalAllwc,
        tax: taxAmt, provident_fund: pfAmt, insurance,
        late_deduction: lateDeduction, absent_deduction: absentDeduction, total_deductions: totalDed,
        performance_bonus: perfBonus, festival_bonus: 0, tips_shared: 0,
        gross_salary: parseFloat(grossSalary.toFixed(2)), net_salary: netSalary,
        status: 'draft', created_by: req.user.id,
      });
      created.push(record);
    }
    io.emit('payroll_update', { type: 'generate', count: created.length });
    res.json({ message: `Generated ${created.length} payroll records`, created, skipped });
  } catch (err) {
    res.status(500).json({ message: 'Error generating payroll', error: err.message });
  }
});

// PUT /api/payroll/:id - update payroll record
app.put('/api/payroll/:id', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const record = await Payroll.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const updates = { ...req.body };
    // Recalculate totals
    const totalAllwc = parseFloat(updates.hra||record.hra||0) + parseFloat(updates.transport||record.transport||0) + parseFloat(updates.meals||record.meals||0) + parseFloat(updates.medical||record.medical||0) + parseFloat(updates.other_allowances||record.other_allowances||0);
    const totalDed   = parseFloat(updates.tax||record.tax||0) + parseFloat(updates.provident_fund||record.provident_fund||0) + parseFloat(updates.insurance||record.insurance||0) + parseFloat(updates.advance_deduction||record.advance_deduction||0) + parseFloat(updates.late_deduction||record.late_deduction||0) + parseFloat(updates.absent_deduction||record.absent_deduction||0) + parseFloat(updates.other_deductions||record.other_deductions||0);
    const grossSalary = parseFloat(updates.basic_salary||record.basic_salary||0) + parseFloat(updates.overtime_pay||record.overtime_pay||0) + totalAllwc + parseFloat(updates.performance_bonus||record.performance_bonus||0) + parseFloat(updates.festival_bonus||record.festival_bonus||0) + parseFloat(updates.tips_shared||record.tips_shared||0);
    const netSalary = parseFloat((grossSalary - totalDed).toFixed(2));
    await record.update({ ...updates, total_allowances: totalAllwc, total_deductions: totalDed, gross_salary: parseFloat(grossSalary.toFixed(2)), net_salary: netSalary });
    io.emit('payroll_update', { type: 'update', record });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error updating payroll', error: err.message });
  }
});

// PUT /api/payroll/:id/approve
app.put('/api/payroll/:id/approve', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const record = await Payroll.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    await record.update({ status: 'approved', approved_by: req.user.id, approved_at: new Date() });
    io.emit('payroll_update', { type: 'approve', record });
    res.json({ message: 'Approved', record });
  } catch (err) {
    res.status(500).json({ message: 'Error approving payroll', error: err.message });
  }
});

// PUT /api/payroll/:id/pay
app.put('/api/payroll/:id/pay', authenticate, async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ message: 'Admin/Manager only' });
    const record = await Payroll.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const { payment_method, payment_reference, payment_date } = req.body;
    await record.update({
      status: 'paid', paid_by: req.user.id, paid_at: new Date(),
      payment_method: payment_method || record.payment_method,
      payment_reference: payment_reference || record.payment_reference,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
    });
    io.emit('payroll_update', { type: 'paid', record });
    res.json({ message: 'Marked as paid', record });
  } catch (err) {
    res.status(500).json({ message: 'Error marking as paid', error: err.message });
  }
});

// DELETE /api/payroll/:id (admin only, draft only)
app.delete('/api/payroll/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const record = await Payroll.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    if (!['draft', 'on_hold'].includes(record.status)) return res.status(400).json({ message: 'Only draft or on_hold records can be deleted' });
    await record.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting payroll', error: err.message });
  }
});

// ============================================================================
// ============================================================================

const HOST = process.env.HOST || "0.0.0.0";

async function boot() {
  await initMockUsers();
  await startServer();
  server.listen(PORT, HOST, () => {
    console.log(`Backend running at http://${HOST}:${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(
      `Database: ${dbConnected ? "connected" : "disconnected (fallback mode)"}`
    );
  });
}

boot();
