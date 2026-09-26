const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const Permission = require("../models/Permission");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

// Verify JWT Token (supports Authorization header and httpOnly cookie)
const verifyToken = (req, res, next) => {
  let token = req.headers["authorization"]?.split(" ")[1];
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ success: false, message: "Invalid or expired token" });
    req.user = decoded;
    next();
  });
};

// Verify Admin Role
const verifyAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Check specific permission
const checkPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Admin has all permissions
      if (req.user.role === "admin") {
        return next();
      }

      // Check if user has permission through their role
      const role = await Role.findOne({ where: { name: req.user.role } });
      if (!role) {
        return res.status(403).json({ message: "Role not found" });
      }

      const permission = await Permission.findOne({
        where: { name: permissionName },
      });
      if (!permission) {
        return res.status(403).json({ message: "Permission not found" });
      }

      const rolePermission = await RolePermission.findOne({
        where: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      if (!rolePermission) {
        return res.status(403).json({
          message: `Permission denied: ${permissionName}`,
        });
      }

      next();
    } catch (err) {
      res
        .status(500)
        .json({ message: "Permission check error", error: err.message });
    }
  };
};

// Get user permissions
const getUserPermissions = async (username) => {
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return [];

    // Admin gets all permissions
    if (user.role === "admin") {
      const allPermissions = await Permission.findAll();
      return allPermissions.map((p) => p.name);
    }

    // Get permissions for user's role
    const role = await Role.findOne({ where: { name: user.role } });
    if (!role) return [];

    const rolePermissions = await RolePermission.findAll({
      where: { roleId: role.id },
      include: { model: Permission },
    });

    return rolePermissions.map((rp) => rp.Permission.name);
  } catch (err) {
    console.error("Error getting user permissions:", err);
    return [];
  }
};

module.exports = {
  verifyToken,
  verifyAdmin,
  checkPermission,
  getUserPermissions,
};
