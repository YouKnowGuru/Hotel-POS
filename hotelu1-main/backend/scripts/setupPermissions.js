/**
 * Setup Script: Initialize Permissions and Roles
 *
 * This script creates default permissions and roles in the database.
 * Run this after your first backend startup to set up the permission system.
 */

const sequelize = require("../models/sequelize");
const Permission = require("../models/Permission");
const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");

// Define all permissions (comprehensive for all roles)
const PERMISSIONS = [
  // User Management (5)
  {
    name: "view_users",
    category: "user_management",
    description: "View all users",
  },
  {
    name: "create_user",
    category: "user_management",
    description: "Create new users",
  },
  {
    name: "edit_user",
    category: "user_management",
    description: "Edit user details",
  },
  {
    name: "delete_user",
    category: "user_management",
    description: "Delete users",
  },
  {
    name: "manage_roles",
    category: "user_management",
    description: "Manage roles and permissions",
  },

  // Menu Management (4)
  {
    name: "view_menu",
    category: "menu_management",
    description: "View menu items",
  },
  {
    name: "create_menu_item",
    category: "menu_management",
    description: "Create menu items",
  },
  {
    name: "edit_menu_item",
    category: "menu_management",
    description: "Edit menu items",
  },
  {
    name: "delete_menu_item",
    category: "menu_management",
    description: "Delete menu items",
  },

  // Order Management (5)
  {
    name: "view_orders",
    category: "order_management",
    description: "View orders",
  },
  {
    name: "create_order",
    category: "order_management",
    description: "Create orders",
  },
  {
    name: "edit_order",
    category: "order_management",
    description: "Edit orders",
  },
  {
    name: "delete_order",
    category: "order_management",
    description: "Delete orders",
  },
  {
    name: "manage_qr_codes",
    category: "order_management",
    description: "Manage QR codes and access QR ordering",
  },
  {
    name: "mark_order_preparing",
    category: "order_management",
    description: "Mark orders as preparing in KDS",
  },
  {
    name: "mark_order_ready",
    category: "order_management",
    description: "Mark orders as ready for pickup in KDS",
  },
  {
    name: "confirm_order_delivery",
    category: "order_management",
    description: "Confirm order delivery and generate bills",
  },

  // Inventory Management (2)
  {
    name: "view_inventory",
    category: "inventory_management",
    description: "View inventory",
  },
  {
    name: "edit_inventory",
    category: "inventory_management",
    description: "Edit and manage inventory",
  },

  // Billing (3)
  {
    name: "view_billing",
    category: "billing",
    description: "View billing information",
  },
  {
    name: "process_payments",
    category: "billing",
    description: "Process and manage payments",
  },
  {
    name: "view_bills",
    category: "billing",
    description: "View and access bills",
  },

  // Reporting & Operations (3)
  {
    name: "view_dashboard",
    category: "reporting",
    description: "View analytics dashboard",
  },
  {
    name: "view_reports",
    category: "reporting",
    description: "View detailed reports",
  },
  {
    name: "kitchen_display",
    category: "reporting",
    description: "Access kitchen display system (KDS)",
  },

  // Settings & Admin (2)
  {
    name: "manage_settings",
    category: "settings",
    description: "Manage system settings",
  },
  {
    name: "manage_subfranchise",
    category: "settings",
    description: "Manage sub-franchises",
  },
];

// Define default roles with comprehensive permissions
const ROLES = [
  // 1. ADMIN - Full system access (24/25 permissions)
  {
    name: "admin",
    description: "Super Admin - Full system access",
    permissions: [
      // User Management
      "view_users",
      "create_user",
      "edit_user",
      "delete_user",
      "manage_roles",
      // Menu Management
      "view_menu",
      "create_menu_item",
      "edit_menu_item",
      "delete_menu_item",
      // Order Management
      "view_orders",
      "create_order",
      "edit_order",
      "delete_order",
      "manage_qr_codes",
      // Inventory Management
      "view_inventory",
      "edit_inventory",
      // Billing
      "view_billing",
      "process_payments",
      "view_bills",
      // Reporting & Operations
      "view_dashboard",
      "view_reports",
      "kitchen_display",
      // Settings
      "manage_settings",
      "manage_subfranchise",
    ],
  },

  // 2. FRANCHISE - Franchise owner (10 permissions)
  {
    name: "franchise",
    description:
      "Franchise owner - Manages sub-franchises and receives reports",
    permissions: [
      // User Management
      "view_users",
      "create_user",
      "edit_user",
      "manage_roles",
      // Menu Management
      "view_menu",
      // Order Management
      "view_orders",
      // Reporting & Operations
      "view_dashboard",
      "view_reports",
      "manage_qr_codes",
      // Settings
      "manage_subfranchise",
    ],
  },

  // 3. SUBFRANCHISE - Sub-franchise owner/manager (17 permissions)
  {
    name: "subfranchise",
    description:
      "Sub-franchise owner - Full operational control for one location",
    permissions: [
      // User Management
      "view_users",
      "create_user",
      "edit_user",
      // Menu Management
      "view_menu",
      "create_menu_item",
      "edit_menu_item",
      "delete_menu_item",
      // Order Management
      "view_orders",
      "create_order",
      "edit_order",
      "delete_order",
      "manage_qr_codes",
      // Inventory Management
      "view_inventory",
      "edit_inventory",
      // Billing
      "view_billing",
      "view_bills",
      // Reporting & Operations
      "view_dashboard",
      "kitchen_display",
    ],
  },

  // 4. MANAGER - Restaurant manager (16 permissions)
  {
    name: "manager",
    description: "Restaurant Manager - Day-to-day operational management",
    permissions: [
      // User Management
      "view_users",
      "create_user",
      "edit_user",
      // Menu Management
      "view_menu",
      "create_menu_item",
      "edit_menu_item",
      // Order Management
      "view_orders",
      "create_order",
      "edit_order",
      "manage_qr_codes",
      // Inventory Management
      "view_inventory",
      "edit_inventory",
      // Billing
      "view_billing",
      "view_bills",
      // Reporting & Operations
      "view_dashboard",
      "view_reports",
    ],
  },

  // 5. WAITER - Waiter/Server (8 permissions)
  {
    name: "waiter",
    description: "Waiter/Server - Takes orders and processes payments",
    permissions: [
      // Menu Management
      "view_menu",
      // Order Management
      "view_orders",
      "create_order",
      "edit_order",
      "manage_qr_codes",
      // Billing
      "view_billing",
      "process_payments",
      "view_bills",
    ],
  },

  // 6. CUSTOMER - QR ordering guest (1 permission)
  {
    name: "customer",
    description: "Customer - QR code ordering access only",
    permissions: [
      // Order Management
      "manage_qr_codes",
    ],
  },
];

async function setupPermissions() {
  try {
    console.log("Starting permission setup...");

    // Check connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Sync models
    await sequelize.sync({ alter: true });
    console.log("✅ Database models synchronized");

    // Create permissions
    console.log("\n📝 Creating permissions...");
    for (const perm of PERMISSIONS) {
      const [permission, created] = await Permission.findOrCreate({
        where: { name: perm.name },
        defaults: perm,
      });
      if (created) console.log(`  ✓ Created permission: ${perm.name}`);
    }

    // Create roles and assign permissions
    console.log("\n🔐 Creating roles with permissions...");
    for (const roleData of ROLES) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: {
          name: roleData.name,
          description: roleData.description,
          isDefault: true,
        },
      });

      if (created) console.log(`  ✓ Created role: ${roleData.name}`);

      // Remove existing permissions for this role
      await RolePermission.destroy({ where: { roleId: role.id } });

      // Add new permissions
      for (const permName of roleData.permissions) {
        const permission = await Permission.findOne({
          where: { name: permName },
        });
        if (permission) {
          await RolePermission.findOrCreate({
            where: { roleId: role.id, permissionId: permission.id },
          });
        }
      }

      console.log(
        `  ✓ Assigned ${roleData.permissions.length} permissions to ${roleData.name}`,
      );
    }

    console.log("\n✨ Permission setup completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`  • Permissions created: ${PERMISSIONS.length}`);
    console.log(`  • Roles created: ${ROLES.length}`);
    console.log(
      '\n🎉 You can now manage permissions in the "Permission Management" section!',
    );

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up permissions:", error);
    process.exit(1);
  }
}

// Run setup
setupPermissions();
