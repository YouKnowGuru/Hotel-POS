// Complete API Testing Guide with JWT Authentication
// This script demonstrates how to test all API endpoints with direct calls

const API_BASE = "http://localhost:3001";
let authToken = null;

// Helper function for API calls with JWT
async function apiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (authToken) {
    options.headers["Authorization"] = `Bearer ${authToken}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`\n${method} ${endpoint}`);
  if (body) console.log("Body:", JSON.stringify(body, null, 2));

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    console.log(`Status: ${response.status}`);
    console.log("Response:", JSON.stringify(data, null, 2));

    return { status: response.status, data };
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

async function runTests() {
  console.log("========================================");
  console.log("API Testing Guide - Real Database Mode");
  console.log("========================================\n");

  // 1. LOGIN - Get JWT Token
  console.log("STEP 1: LOGIN AND GET JWT TOKEN");
  console.log("-------------------------------------");
  const loginResponse = await apiCall("POST", "/login", {
    username: "admin",
    password: "admin",
  });

  if (loginResponse && loginResponse.status === 200) {
    authToken = loginResponse.data.token;
    console.log("\n✅ Login successful!");
    console.log(`Token: ${authToken.substring(0, 20)}...`);
  } else {
    console.log("\n❌ Login failed!");
    return;
  }

  // 2. GET MENU (No auth required)
  console.log("\n\nSTEP 2: GET MENU ITEMS (No Auth)");
  console.log("-------------------------------------");
  await apiCall("GET", "/api/menu");

  // 3. GET USERS (Admin only)
  console.log("\n\nSTEP 3: GET ALL USERS (Admin Only)");
  console.log("-------------------------------------");
  await apiCall("GET", "/api/users");

  // 4. CREATE NEW USER (Admin only)
  console.log("\n\nSTEP 4: CREATE NEW USER (Admin Only)");
  console.log("-------------------------------------");
  await apiCall("POST", "/api/users", {
    username: "newcashier1",
    password: "pass123",
    name: "New Cashier",
    role: "cashier",
  });

  // 5. CREATE NEW USER - Waiter
  console.log("\n\nSTEP 5: CREATE NEW WAITER");
  console.log("-------------------------------------");
  await apiCall("POST", "/api/users", {
    username: "newwaiter1",
    password: "pass123",
    name: "New Waiter",
    role: "waiter",
  });

  // 6. GET ORDERS
  console.log("\n\nSTEP 6: GET ORDERS");
  console.log("-------------------------------------");
  await apiCall("GET", "/api/orders");

  // 7. CREATE ORDER
  console.log("\n\nSTEP 7: CREATE ORDER");
  console.log("-------------------------------------");
  await apiCall("POST", "/api/orders", {
    table_name: "T5",
    type: "DINE_IN",
    status: "pending",
    total: 45.99,
    items: [
      {
        name: "Burger",
        quantity: 2,
        price: 19.99,
        menuItemId: 1,
      },
      {
        name: "Fries",
        quantity: 1,
        price: 4.99,
        menuItemId: 2,
      },
    ],
  });

  // 8. GET INVENTORY
  console.log("\n\nSTEP 8: GET INVENTORY");
  console.log("-------------------------------------");
  await apiCall("GET", "/api/inventory");

  // 9. CREATE INVENTORY ITEM
  console.log("\n\nSTEP 9: CREATE INVENTORY ITEM");
  console.log("-------------------------------------");
  await apiCall("POST", "/api/inventory", {
    name: "Cheese Slice",
    currentStock: 150,
    minStock: 20,
  });

  // 10. CREATE MENU ITEM
  console.log("\n\nSTEP 10: CREATE MENU ITEM");
  console.log("-------------------------------------");
  await apiCall("POST", "/api/menu", {
    name: "Grilled Chicken",
    price: 24.99,
    category: "Main Course",
    description: "Juicy grilled chicken breast with herbs",
  });

  console.log("\n\n========================================");
  console.log("All API Tests Completed!");
  console.log("========================================");
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { apiCall, runTests };
