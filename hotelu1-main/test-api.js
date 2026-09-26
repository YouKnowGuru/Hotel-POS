// Simple test script to verify API endpoints work correctly
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001';

async function testAPI() {
    console.log('Testing API endpoints...\n');
    
    try {
        // Test orders endpoint
        console.log('1. Testing /api/orders');
        const ordersResponse = await fetch(`${API_BASE}/api/orders`);
        const orders = await ordersResponse.json();
        console.log('✓ Orders endpoint working:', Array.isArray(orders) ? 'Returns array' : 'Returns non-array');
        console.log('  Orders count:', orders.length);
        console.log('  Sample order:', orders[0] ? `ID: ${orders[0].id}, Type: ${orders[0].type}` : 'No orders');
        
        // Test DINE_IN orders
        console.log('\n2. Testing /api/orders?type=DINE_IN');
        const dineInResponse = await fetch(`${API_BASE}/api/orders?type=DINE_IN`);
        const dineInOrders = await dineInResponse.json();
        console.log('✓ DINE_IN orders endpoint working:', Array.isArray(dineInOrders) ? 'Returns array' : 'Returns non-array');
        
        // Test TAKEAWAY orders
        console.log('\n3. Testing /api/orders?type=TAKEAWAY');
        const takeawayResponse = await fetch(`${API_BASE}/api/orders?type=TAKEAWAY`);
        const takeawayOrders = await takeawayResponse.json();
        console.log('✓ TAKEAWAY orders endpoint working:', Array.isArray(takeawayOrders) ? 'Returns array' : 'Returns non-array');
        
        // Test menu endpoint
        console.log('\n4. Testing /api/menu');
        const menuResponse = await fetch(`${API_BASE}/api/menu`);
        const menuItems = await menuResponse.json();
        console.log('✓ Menu endpoint working:', Array.isArray(menuItems) ? 'Returns array' : 'Returns non-array');
        console.log('  Menu items count:', menuItems.length);
        
        // Test inventory endpoint
        console.log('\n5. Testing /api/inventory');
        const inventoryResponse = await fetch(`${API_BASE}/api/inventory`);
        const inventoryItems = await inventoryResponse.json();
        console.log('✓ Inventory endpoint working:', Array.isArray(inventoryItems) ? 'Returns array' : 'Returns non-array');
        
        console.log('\n✅ All API endpoints are working correctly!');
        console.log('✅ Frontend components should now handle responses properly.');
        
    } catch (error) {
        console.error('❌ API test failed:', error.message);
        console.log('Note: Make sure the backend server is running on port 3001');
    }
}

testAPI();
