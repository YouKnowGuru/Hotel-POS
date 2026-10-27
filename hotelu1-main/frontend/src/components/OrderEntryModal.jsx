import React, { useState, useEffect } from 'react';
import { authFetch, getAPI_URL } from '../utils/api';
import { enrichOrderWithTotals, fetchAndCacheGlobalSettings, calculateOrderTotals } from '../utils/orderTotals';
import Notification from './Notification';
import useCurrency from '../hooks/useCurrency';
import { Users } from 'lucide-react';
import {
 loadRestaurantInfo,
 buildKitchenSlipHtml,
 buildCustomerReceiptHtml,
 calculateTotals as calcReceiptTotals,
 loadTaxDiscountSettings,
 openReceiptForPrint,
} from '../utils/receiptPrint';

const OrderEntryModal = ({ table, onClose, onOrderPlaced, locationSettings, nextOrderId, setNextOrderId, orderType, initialOrder }) => {
 const { format: fmt } = useCurrency(locationSettings);
 const [menu, setMenu] = useState([]);
 const [cart, setCart] = useState({});
 const [notification, setNotification] = useState(null);
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');
 const [categories, setCategories] = useState(['All']);
 const [showReceipt, setShowReceipt] = useState(false);
 const [confirmedOrder, setConfirmedOrder] = useState(null);
 const [showMobileCart, setShowMobileCart] = useState(false);
 const [paymentMethod, setPaymentMethod] = useState('cash');
 const [isSubmitting, setIsSubmitting] = useState(false);
 // Shared tax/discount settings (fetched once) so totals always match
 // what the backend charges — Service charge + GST.
 const [taxSettings, setTaxSettings] = useState(null);

 // Load the admin's Billing & Taxation settings once on open.
 useEffect(() => {
 fetchAndCacheGlobalSettings().then(setTaxSettings).catch(() => {});
 }, []);
 // Dine-in only: how many guests are seated at this table. Stored on the
 // order and displayed on the Table Management card.
 const [guests, setGuests] = useState(2);
 
 // Payment modal states for takeaway orders
 const [showPaymentModal, setShowPaymentModal] = useState(false);
 const [pendingOrder, setPendingOrder] = useState(null);
 const [paymentAmount, setPaymentAmount] = useState(0);

 useEffect(() => {
 fetch(`${getAPI_URL()}/api/menu`)
 .then(res => {
 if (!res.ok) throw new Error(`Menu API ${res.status}`);
 return res.json();
 })
 .then(data => {
 // Show all items first, then filter available ones
 const allItems = data;
 const availableMenu = data.filter(item => item.isAvailable === true);
 
 // Extract categories from menu items with smart categorization
 const uniqueCategories = ['All', ...new Set(availableMenu.map(item => {
 // Check if item name contains 'veg' (case insensitive)
 if (item.name && item.name.toLowerCase().includes('veg')) {
 return 'Veg'; // Always return 'Veg' with capital V
 }
 // Check if description contains 'veg'
 if (item.description && item.description.toLowerCase().includes('veg')) {
 return 'Veg'; // Always return 'Veg' with capital V
 }
 // Normalize other categories to consistent casing
 const category = item.category || 'Other';
 if (category.toLowerCase() === 'veg') {
 return 'Veg'; // Convert 'veg' to 'Veg'
 }
 return category;
 }).filter(Boolean))];
 setCategories(uniqueCategories);
 
 // Set the menu to available items
 setMenu(availableMenu);
 /* No success toast here: it used to render on top of the modal header
    (z-[3000] fixed toast) and block the close button on phones. */
 })
 .catch(err => {
 console.error('OrderEntryModal: Error fetching menu:', err);
 setNotification({ message: 'Error loading menu items', type: 'error' });
 });
 }, []);

 // For "Add More Items", handle differently for Takeaway vs Dine-in
 useEffect(() => {
 if (initialOrder && initialOrder.items) {
 if (initialOrder.table_name === 'Takeaway') {
 // For Takeaway, pre-fill cart with existing items (same order)
 const prefill = {};
 initialOrder.items.forEach(item => {
 const itemId = item.productId || item.menuItemId || item.id;
 prefill[itemId] = {
 ...item,
 id: itemId,
 productId: itemId,
 qty: item.quantity || item.qty || 1
 };
 });
 setCart(prefill);
 setNotification({ message: 'Takeaway order loaded - Add more items to same order', type: 'info' });
 setTimeout(() => setNotification(null), 2000);
 } else {
 // For Dine-in, start with empty cart (separate orders)
 setCart({});
 setNotification({ message: 'Cart cleared - Add only new items', type: 'info' });
 setTimeout(() => setNotification(null), 2000);
 }
 }
 }, [initialOrder]);

 const addToCart = (item) => {
 const itemId = item.id || item.productId;
 setCart(prevCart => ({
 ...prevCart,
 [itemId]: {
 ...item,
 id: itemId,
 productId: itemId,
 qty: (prevCart[itemId]?.qty || 0) + 1
 }
 }));
 setNotification({ message: `${item.name} added to cart!`, type: 'success' });
 setTimeout(() => setNotification(null), 3000);
 };

 const updateCartQty = (itemId, change) => {
 setCart(prevCart => {
 const item = prevCart[itemId];
 if (!item) return prevCart;
 
 const newQty = item.qty + change;
 if (newQty <= 0) {
 const { [itemId]: _, ...rest } = prevCart;
 return rest;
 }
 
 return {
 ...prevCart,
 [itemId]: { ...item, qty: newQty }
 };
 });
 };

 const clearCart = () => {
 setCart({});
 setNotification({ message: "Cart cleared!", type: "success" });
 setTimeout(() => setNotification(null), 3000);
 };

 // Print kitchen token + customer bill (thermal 80mm) for the
 // just-paid takeaway order. Called automatically after the
 // payment is marked complete.
 const printTakeawayBill = async (order, methodLabel) => {
 try {
 const info = loadRestaurantInfo();
 const taxDiscount = loadTaxDiscountSettings();
 const totals = calcReceiptTotals(order, taxDiscount);
 const kitchenHtml = buildKitchenSlipHtml(order, info);
 const paymentLabel = String(methodLabel || 'Cash').toUpperCase();
 const customerHtml = buildCustomerReceiptHtml(order, totals, info, {
 qrCodeDataUrl: '',
 paymentLabel,
 });
 openReceiptForPrint(
 `${kitchenHtml}${customerHtml}`,
 `Takeaway Bill #${order.id}`
 );
 } catch (e) {
 console.error('Print failed:', e);
 }
 };

 // Handle payment completion for takeaway orders
 const handlePaymentComplete = async () => {
 if (!pendingOrder) return;

 try {
 // Complete payment + close the order on the server.
 // BUGFIX: this used to call /api/orders/:id/status — an endpoint that
 // does not exist — so the request always 404'd and the warn() below
 // hid it. The order stayed "pending"/unpaid while a receipt claiming
 // "PAID" was printed. /complete-payment sets status completed,
 // payment paid and closes the bill in one go.
 const response = await authFetch(`/api/orders/${pendingOrder.id}/complete-payment`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 payment_method: paymentMethod
 })
 });

 if (!response.ok) {
 // BUGFIX: this used to "succeed" silently — the receipt printed as PAID
 // while the server kept the order pending forever, dead-ending the
 // takeaway board on "Waiting for kitchen". Now we surface the error
 // and keep the payment modal open so the cashier can retry; nothing
 // else is closed until the server confirms the payment.
 const errData = await response.json().catch(() => ({}));
 setNotification({ message: errData.message || 'Payment could not be completed — please try again', type: 'error' });
 setTimeout(() => setNotification(null), 5000);
 return;
 }

 const data = await response.json().catch(() => ({}));
 const finalOrder = { ...pendingOrder, ...(data?.order || {}), paymentMethod };
 finalOrder.status = 'completed';
 finalOrder.payment_status = 'paid';

 // Close payment modal
 setShowPaymentModal(false);

 // Show token receipt
 setConfirmedOrder(finalOrder);
 setShowReceipt(true);

 // Call onOrderPlaced to add to active orders
 onOrderPlaced(finalOrder);

 // Auto-open the printable bill (kitchen token + customer
 // receipt). User can hit Cancel in the print dialog if
 // they don't want a paper copy.
 printTakeawayBill(finalOrder, paymentMethod);

 // Close main order modal
 onClose();

 } catch (error) {
 console.error('Payment error:', error);
 // Even if error, show receipt
 setShowPaymentModal(false);
 setConfirmedOrder(pendingOrder);
 setShowReceipt(true);
 onOrderPlaced(pendingOrder);
 printTakeawayBill(pendingOrder, paymentMethod);
 onClose();
 }
 };

 const placeOrder = async () => {
 const orderItems = Object.values(cart).map(item => ({
 productId: item.productId || item.id,
 name: item.name,
 quantity: item.qty,
 price: item.price
 }));
 
 if (orderItems.length === 0) {
 setNotification({ message: "Cart is empty. Please add items.", type: "error" });
 setTimeout(() => setNotification(null), 3000);
 return;
 }
 
 // Validate table information
 if (!table || !table.id) {
 setNotification({ message: "Table information is missing. Please try again.", type: "error" });
 setTimeout(() => setNotification(null), 3000);
 return;
 }
 
 // Get global tax and discount settings
 const globalSettings = taxSettings || JSON.parse(localStorage.getItem('globalTaxDiscount') || '{"taxPercent": 5, "discountPercent": 0}');
 const taxPercent = globalSettings.taxPercent || 5;
 const discountPercent = globalSettings.discountPercent || 0;
 
 // Calculate subtotal, discount, service charge, tax, and total —
 // with the SAME calculator as every other ordering flow.
 const subtotal = Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
 const totals = calculateOrderTotals(subtotal, taxSettings);
 const discountAmount = totals.discountAmount;
 const serviceCharge = totals.serviceCharge;
 const serviceChargePercent = totals.serviceChargePercent;
 const taxAmount = totals.taxAmount;
 const finalTotal = totals.total;
 
 // For existing orders, identify new items vs existing items
 let newOrder = {
 table_name: table && table.id ? table.id : (orderType === 'TAKEAWAY' ? 'Takeaway' : 'Unknown'),
 items: orderItems,
 subtotal: subtotal,
 discount: discountPercent,
 discountAmount: discountAmount,
 serviceCharge: serviceCharge,
 serviceChargePercent: serviceChargePercent,
 taxPercent: taxPercent,
 taxAmount: taxAmount,
 total: finalTotal,
 type: orderType,
 timestamp: new Date().toISOString()
 };

 // Guest count rides along with dine-in orders only.
 if (orderType !== 'TAKEAWAY') {
 newOrder.guests = Math.max(1, Math.min(50, Math.round(Number(guests) || 1)));
 }

 // If editing existing order, handle differently for Takeaway vs Dine-in
 if (initialOrder && initialOrder.id) {
 if (initialOrder.table_name === 'Takeaway') {
 // For Takeaway, update the existing order with all items (existing + new)
 try {
 // Combine all items (existing + new)
 const allItems = Object.values(cart);
 // Calculate totals with the shared calculator for takeaway updates
 const newSubtotal = allItems.reduce((sum, item) => sum + (item.price * (item.quantity || item.qty || 1)), 0);
 const updTotals = calculateOrderTotals(newSubtotal, taxSettings);

 const updateResponse = await authFetch(`/api/orders/${initialOrder.id}`, {
 method: 'PUT',
 body: JSON.stringify({
 items: allItems,
 subtotal: newSubtotal,
 discount: updTotals.discountPercent,
 discountAmount: updTotals.discountAmount,
 serviceCharge: updTotals.serviceCharge,
 serviceChargePercent: updTotals.serviceChargePercent,
 taxPercent: updTotals.taxPercent,
 taxAmount: updTotals.taxAmount,
 total: updTotals.total,
 status: 'pending'
 })
 });

 if (!updateResponse.ok) {
 throw new Error('Failed to update takeaway order');
 }
 
 const updatedOrder = await updateResponse.json();
 setCart({});
 onOrderPlaced(updatedOrder);
 setNotification({ message: `Takeaway Order #${updatedOrder.id} updated successfully!`, type: 'success' });
 setTimeout(() => {
 setNotification(null);
 onClose();
 }, 1500);
 return;
 } catch (error) {
 console.error('Error updating takeaway order:', error);
 setNotification({ message: `Error updating takeaway order: ${error.message}`, type: 'error' });
 setTimeout(() => setNotification(null), 3000);
 return;
 }
 } else {
 // For Dine-in, create a new separate order instead of updating existing
 newOrder.parentOrderId = initialOrder.id;
 newOrder.status = 'pending';
 }
 } else {
 // For completely new orders
 newOrder.status = 'pending';
 }
 
 // For new orders (not additional items), proceed with normal flow
 try {
 const res = await authFetch('/api/orders', {
 method: 'POST',
 body: JSON.stringify(newOrder)
 });

 if (!res.ok) {
 const errData = await res.json().catch(() => ({}));
 throw new Error(errData.message || 'Failed to save order');
 }
 const placedOrder = await res.json();
 setCart({});
 
 // For takeaway orders, show payment modal first, then receipt
 if (orderType === 'TAKEAWAY') {
 await fetchAndCacheGlobalSettings();
 const enriched = enrichOrderWithTotals(placedOrder);
 setPendingOrder(enriched);
 setPaymentAmount(enriched.total || 0);
 setShowPaymentModal(true);
 // Don't call onOrderPlaced yet - wait for payment
 } else {
 // For dine-in, use original flow
 onOrderPlaced(placedOrder);
 // The parent page (DineInManagement) already fires its own
 // "Order for T5 placed! (#X)" toast for this callback — showing a
 // second one here stacked duplicate popups on every order. Keep the
 // brief beat so the parent toast is readable, then close the modal.
 setTimeout(() => {
 onClose();
 }, 1500);
 }
 } catch (error) {
 console.error('Order placement error:', error);
 setNotification({ message: `Error placing order: ${error.message}`, type: 'error' });
 setTimeout(() => setNotification(null), 3000);
 }
 };

 const handlePlaceOrder = async () => {
 setIsSubmitting(true);
 await placeOrder();
 setIsSubmitting(false);
 };

 // Filter menu items based on category and search
 const filteredMenu = menu.filter(item => {
 // Smart categorization for filtering
 let itemCategory = item.category || 'Other';
 
 // Check if item name contains 'veg' (case insensitive)
 if (item.name && item.name.toLowerCase().includes('veg')) {
 itemCategory = 'Veg'; // Always use 'Veg' with capital V
 }
 // Check if description contains 'veg'
 else if (item.description && item.description.toLowerCase().includes('veg')) {
 itemCategory = 'Veg'; // Always use 'Veg' with capital V
 }
 // Normalize existing veg categories
 else if (itemCategory && itemCategory.toLowerCase() === 'veg') {
 itemCategory = 'Veg'; // Convert 'veg' to 'Veg'
 }
 
 const matchesCategory = selectedCategory === 'All' || itemCategory === selectedCategory;
 const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 // Get category icon
 const getCategoryIcon = (category) => {
 const icons = {
 'Starters': '🍲',
 'Biryani': '🍛',
 'Fast Food': '🍔',
 'Beverages': '🥤',
 'Desserts': '🍰',
 'Chinese': '🥡',
 'Veg': '🥬',
 'Other': '🍽️'
 };
 return icons[category] || '🍽️';
 };

 // Highlight search term in text
 const highlightText = (text, searchTerm) => {
 if (!searchTerm) return text;
 
 const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
 return (
 <span>
 {parts.map((part, index) => 
 part.toLowerCase() === searchTerm.toLowerCase() ? 
 <span key={index} className="bg-yellow-200 font-bold text-indigo-700 px-0.5 rounded">{part}</span> : 
 part
 )}
 </span>
 );
 };

 /* BUGFIX (takeaway missing service charge & GST): the modal used to add
 only a discount + GST on the raw subtotal, so the displayed total never
 matched the rest of the system. All totals now flow through the same
 shared calculator used by the QR menu and the printed receipts. */
 const takeTotals = calculateOrderTotals(
 Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0),
 taxSettings
 );
 const totalAmount = takeTotals.total;

 return (
 <>
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
 {/* Modal Header - Orange Theme */}
 <div className="flex justify-between items-center p-4 sm:p-6 border-b border-indigo-100 bg-indigo-600 flex-shrink-0">
 <h3 className="text-lg sm:text-2xl font-bold text-white">
 New {orderType === 'TAKEAWAY' ? 'Takeaway' : 'Dine-In'} Order for {table && table.id === 'Takeaway' ? 'Takeaway' : table && table.id ? `Table ${table.id}` : ''}
 </h3>
 <button 
 onClick={onClose} 
 className="text-white/80 hover:text-white bg-white/30 hover:bg-white/30 rounded-full p-2 transition-colors"
 >
 <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
 </svg>
 </button>
 </div>
 {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
 <div className="p-3 sm:p-6 flex-grow overflow-hidden flex flex-col">
 <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 flex-grow min-h-0">
 {/* Menu Items Panel - Full width on mobile, 3/4 on desktop */}
 <div className="flex-1 lg:flex-[3] bg-indigo-50 p-3 sm:p-6 rounded-xl border border-indigo-100 overflow-hidden flex flex-col min-h-0 max-h-[calc(100vh-120px)] lg:max-h-none">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 flex-shrink-0 gap-2 sm:gap-0">
 <h4 className="text-lg sm:text-2xl font-bold text-gray-800 flex items-center">
 <span className="mr-1 sm:mr-2 text-lg sm:text-2xl">🍽️</span> Menu Items
 </h4>
 <div className="flex items-center space-x-2">
 <div className="relative">
 <input
 type="text"
 placeholder="Search items"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-3 sm:pl-4 pr-8 sm:pr-10 py-1.5 sm:py-2.5 border-2 border-indigo-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-32 sm:w-56 text-xs sm:text-sm font-medium transition-all duration-200 bg-white shadow-sm"
 />
 {searchTerm && (
 <button
 onClick={() => setSearchTerm('')}
 className="absolute right-2 sm:right-3 top-1.5 sm:top-2.5 text-gray-400 hover:text-gray-600 transition-colors text-xs sm:text-sm"
 >
 ✕
 </button>
 )}
 </div>
 </div>
 </div>
 
 {/* Category Tabs */}
 <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4 flex-shrink-0">
 {categories.map(category => (
 <button
 key={category}
 onClick={() => setSelectedCategory(category)}
 className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition-all duration-200 text-xs sm:text-sm ${
 selectedCategory === category
 ? 'bg-gradient-to-r from-indigo-600 to-red-400 text-white shadow-lg transform scale-105'
 : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-400 hover:shadow-md'
 }`}
 >
 <span className="mr-0.5 sm:mr-1 text-xs sm:text-sm">{getCategoryIcon(category)}</span>
 <span className="text-xs sm:text-sm">{category}</span>
 </button>
 ))}
 </div>
 
 <div className="flex-grow overflow-hidden min-h-0">
 {filteredMenu.length === 0 ? (
 <div className="text-center py-4 sm:py-8 h-full flex items-center justify-center">
 <div>
 {searchTerm ? (
 <>
 <div className="text-4xl sm:text-6xl mb-2 sm:mb-4">🔍</div>
 <p className="text-gray-500 text-sm sm:text-lg mb-1 sm:mb-2">No items found for "{searchTerm}"</p>
 <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-4">Try different keywords or browse categories</p>
 </>
 ) : (
 <>
 <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
 <span className="text-3xl">🍽️</span>
 </div>
 <p className="text-gray-600 font-medium mb-1">No menu items available</p>
 <p className="text-xs text-gray-400">Try selecting a different category</p>
 </>
 )}
 </div>
 </div>
 ) : (
 <div className="h-full overflow-y-auto pr-1 sm:pr-2">
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
 {filteredMenu.map(item => {
 // Smart categorization for display with consistent casing
 let displayCategory = item.category || 'Other';
 
 // Check if item name contains 'veg' (case insensitive)
 if (item.name && item.name.toLowerCase().includes('veg')) {
 displayCategory = 'Veg'; // Always use 'Veg' with capital V
 }
 // Check if description contains 'veg'
 else if (item.description && item.description.toLowerCase().includes('veg')) {
 displayCategory = 'Veg'; // Always use 'Veg' with capital V
 }
 // Normalize existing veg categories
 else if (displayCategory && displayCategory.toLowerCase() === 'veg') {
 displayCategory = 'Veg'; // Convert 'veg' to 'Veg'
 }
 
 return (
 <div key={item.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-102 overflow-hidden group border border-indigo-100">
 {/* Food Image - Circular like MenuManagement */}
 <div className="w-full h-24 sm:h-28 bg-indigo-50 flex items-center justify-center border-b border-indigo-200">
 <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center">
 {item.image ? (
 <img 
 src={item.image} 
 alt={item.name}
 className="w-full h-full object-cover"
 />
 ) : (
 <span className="text-2xl sm:text-3xl">{getCategoryIcon(displayCategory)}</span>
 )}
 </div>
 </div>
 <div className="p-2 sm:p-3">
 {/* Available Badge */}
 <div className="mb-2">
 <span className="bg-green-100 text-green-700 text-[10px] sm:text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center">
 <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
 Available
 </span>
 </div>
 {/* Item Name */}
 <h5 className="font-bold text-gray-800 text-xs sm:text-sm mb-1 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-1">
 {highlightText(item.name, searchTerm)}
 </h5>
 {/* Category */}
 <p className="text-[10px] sm:text-xs text-gray-500 mb-2">
 {displayCategory}
 </p>
 {/* Price and Add Button */}
 <div className="flex items-center justify-between">
 <p className="text-sm sm:text-base font-bold text-indigo-600">
 {fmt(item.price)}
 </p>
 <button
 onClick={() => addToCart(item)}
 className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center font-bold text-sm shadow-md transition-all duration-200 transform hover:scale-110 flex-shrink-0"
 >
 +
 </button>
 </div>
 </div>
 </div>
 )})}
 </div>
 </div>
 )}
 </div>
 </div>
 {/* Right Panel - Current Order - Hidden on mobile, visible on tablet+ */}
 <div className="hidden md:flex flex-1 md:max-w-[280px] bg-white flex-col rounded-xl border border-indigo-100 shadow-sm">
 <div className="p-3 sm:p-4 bg-indigo-50/50 border-b border-indigo-100 flex-shrink-0">
 <h4 className="text-base sm:text-lg font-bold text-gray-800 flex items-center">
 <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 Current Order
 </h4>
 </div>
 <div className="flex-grow overflow-hidden">
 {Object.keys(cart).length === 0 ? (
 <div className="h-full flex items-center justify-center">
 <div className="text-center">
 <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
 <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 </div>
 <p className="text-gray-600 font-medium mb-1">Add items to order</p>
 <p className="text-xs text-gray-400">Select delicious items from the menu</p>
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col">
 <div className="space-y-1.5 sm:space-y-2 flex-grow overflow-y-auto pr-1 sm:pr-2">
 {Object.values(cart).map(item => (
 <div key={item.id} className="bg-white rounded-xl p-2 sm:p-3 shadow-sm border border-indigo-200 hover:shadow-md transition-shadow">
 <div className="flex items-center justify-between">
 <div className="flex-1 min-w-0">
 <h6 className="font-bold text-gray-800 text-xs sm:text-sm truncate">{item.name}</h6>
 <p className="text-xs text-gray-500">
 {fmt(item.price)} × {item.qty}
 </p>
 </div>
 <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-1 sm:ml-2">
 <button
 onClick={() => updateCartQty(item.id, -1)}
 className="bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-sm sm:text-base font-bold transition-colors shadow-sm"
 >
 -
 </button>
 <span className="font-bold text-gray-900 w-6 sm:w-7 text-center text-sm sm:text-base bg-indigo-50 rounded-lg">{item.qty}</span>
 <button
 onClick={() => updateCartQty(item.id, 1)}
 className="bg-green-500 hover:bg-green-600 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-sm sm:text-base font-bold transition-colors shadow-sm"
 >
 +
 </button>
 </div>
 </div>
 <div className="mt-1 pt-1 border-t border-indigo-100">
 <p className="text-xs font-semibold text-indigo-600">
 Item Total: {fmt(item.price * item.qty)}
 </p>
 </div>
 </div>
 ))}
 </div>
 <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t-2 border-gray-300 flex-shrink-0">
 <div className="space-y-1 text-xs sm:text-sm mb-2 sm:mb-3">
 <div className="flex justify-between text-gray-500">
 <span>Subtotal</span><span className="font-semibold tabular-nums">{fmt(takeTotals.subtotal)}</span>
 </div>
 <div className="flex justify-between text-gray-500">
 <span>Service charge ({takeTotals.serviceChargePercent}%)</span><span className="font-semibold tabular-nums">+{fmt(takeTotals.serviceCharge)}</span>
 </div>
 <div className="flex justify-between text-gray-500">
 <span>GST ({takeTotals.taxPercent}%)</span><span className="font-semibold tabular-nums">+{fmt(takeTotals.taxAmount)}</span>
 </div>
 {takeTotals.discountPercent > 0 && (
 <div className="flex justify-between text-green-600">
 <span>Discount ({takeTotals.discountPercent}%)</span><span className="font-semibold tabular-nums">-{fmt(takeTotals.discountAmount)}</span>
 </div>
 )}
 <div className="flex justify-between items-center pt-1">
 <span className="text-sm sm:text-base font-bold text-gray-800">Total:</span>
 <span className="text-lg sm:text-xl font-bold text-green-600">{fmt(totalAmount)}</span>
 </div>
 </div>
 <div className="bg-gradient-to-r from-indigo-600 to-red-100 p-1.5 sm:p-2 rounded-lg">
 <p className="text-xs text-gray-600 text-center">
 🎉 Great choice! Your order is ready to confirm.
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 {/* Footer - Orange Theme - Hidden on mobile */}
 <div className="hidden md:flex p-3 sm:p-4 border-t border-indigo-100 bg-indigo-50/50 flex-col sm:flex-row justify-between items-center flex-shrink-0 gap-3 sm:gap-0">
 <div className="text-left text-center sm:text-left">
 <p className="text-xs sm:text-sm text-gray-600 font-medium">Order Summary</p>
 <p className="text-lg sm:text-xl font-bold text-indigo-600">
 {fmt(totalAmount)} <span className="text-gray-500 text-sm">• {Object.keys(cart).length} items</span>
 </p>
 </div>
 <div className="flex space-x-2 sm:space-x-3">
 <button
 onClick={clearCart}
 disabled={Object.keys(cart).length === 0}
 className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center ${
 Object.keys(cart).length === 0
 ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
 : 'bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm'
 }`}
 >
 <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 Clear Cart
 </button>
 <button
 onClick={placeOrder}
 disabled={Object.keys(cart).length === 0}
 className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center ${
 Object.keys(cart).length === 0
 ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
 : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transform hover:scale-105'
 }`}
 >
 <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 Confirm Order
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Takeaway Order Receipt Modal - Orange Theme - z-[100] to stay above Notification toasts */}
 {showReceipt && confirmedOrder && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
 {/* BUGFIX: constrain the card to the viewport so it's scrollable on small phones instead of clipping */}
 <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-hidden flex flex-col animate-scale-in border border-indigo-100">
 {/* Header - Orange */}
 <div className="bg-indigo-600 p-6 text-center">
 <div className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center mx-auto mb-3">
 <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <h2 className="text-2xl font-bold text-white">Order Confirmed!</h2>
 <p className="text-indigo-100 text-sm mt-1">Your takeaway order has been placed</p>
 </div>

 {/* Receipt Content */}
 <div className="p-6">
 {/* Order Token - Main highlight */}
 <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6 text-center">
 <p className="text-amber-700 text-xs font-semibold uppercase tracking-wide mb-1">Your Order Token</p>
 <p className="text-3xl sm:text-4xl font-bold text-amber-800 tracking-wider break-all">{confirmedOrder.token}</p>
 <p className="text-amber-600 text-xs mt-2">Show this token when collecting your order</p>
 </div>

 {/* Order Details */}
 <div className="space-y-3 mb-6">
 <div className="flex justify-between text-sm">
 <span className="text-gray-500">Order ID</span>
 <span className="font-semibold text-gray-900">#{confirmedOrder.id}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-gray-500">Date & Time</span>
 <span className="font-semibold text-gray-900">{new Date(confirmedOrder.timestamp).toLocaleString()}</span>
 </div>
 <div className="flex justify-between text-sm">                        <span className="text-gray-500">Status</span>
                        {/* REAL payment state — a paid takeaway used to read
                            "Pending" while the board said waiting-for-kitchen */}
                        {confirmedOrder.payment_status === 'paid' || confirmedOrder.status === 'completed' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Paid — Order Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
 </div>
 </div>

 {/* Items */}
 <div className="border-t border-gray-200 pt-4 mb-4">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h3>
 <div className="space-y-2 max-h-32 overflow-y-auto">
 {(confirmedOrder.items || []).map((item, idx) => (
 <div key={idx} className="flex justify-between text-sm">
 <span className="text-gray-700">{item.qty || item.quantity}x {item.name}</span>
 <span className="font-medium text-gray-900">{fmt(item.price * (item.qty || item.quantity || 1))}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Total */}
 <div className="border-t-2 border-gray-200 pt-4 mb-6">
 <div className="flex justify-between items-center">
 <span className="text-lg font-bold text-gray-900">Total Amount</span>
 <span className="text-2xl font-bold text-blue-600">{fmt(confirmedOrder.total)}</span>
 </div>
 </div>

 {/* Instructions */}
 <div className="bg-blue-50 rounded-lg p-4 mb-6">
 <p className="text-sm text-blue-800 text-center">
 <strong>Important:</strong> Please show your token <strong>{confirmedOrder.token}</strong> at the counter to collect your order.
 </p>
 </div>

 {/* Actions */}
 <div className="flex gap-3">
 <button
 onClick={() => {
 window.print();
 }}
 className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
 </svg>
 Print
 </button>
 <button
 onClick={() => {
 setShowReceipt(false);
 onClose();
 }}
 className="flex-1 inline-flex items-center justify-center px-4 py-2.5 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
 >
 Done
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 {/* Floating Cart Button for Mobile - z-[100] so it stays above Notification toasts (z-[90]) */}
 <div className="md:hidden fixed bottom-4 right-4 z-[100]">
 <button
 onClick={() => setShowMobileCart(true)}
 className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-xl transition-all transform hover:scale-110 relative"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 {Object.keys(cart).length > 0 && (
 <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
 {Object.keys(cart).length}
 </span>
 )}
 </button>
 </div>

 {/* Mobile Cart Panel */}
 {showMobileCart && (
 <div className="md:hidden fixed inset-0 z-[100] flex items-end pointer-events-none">
 <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setShowMobileCart(false)} />
 <div className="relative bg-white w-full rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto">
 <div className="flex flex-col flex-1 overflow-hidden">
 <div className="p-4 overflow-y-auto h-full">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
 <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 Your Cart ({Object.keys(cart).length} items)
 </h3>
 <div className="flex items-center gap-2">
 {Object.keys(cart).length > 0 && (
 <button
 onClick={() => { clearCart(); setShowMobileCart(false); }}
 className="p-2 hover:bg-red-100 text-red-500 rounded-full transition-colors"
 title="Clear Cart"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 <button
 onClick={() => setShowMobileCart(false)}
 className="p-2 hover:bg-gray-100 rounded-full transition-colors"
 >
 <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>

 {Object.keys(cart).length === 0 ? (
 <div className="text-center py-8">
 <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 <p className="text-gray-600 text-lg font-medium">Your cart is empty</p>
 <p className="text-gray-400 text-sm mt-2">Add items to get started!</p>
 </div>
 ) : (
 <>
 <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
 {Object.values(cart).map(item => (
 <div key={item.id} className="flex items-center justify-between bg-indigo-50 p-3 rounded-xl gap-2">
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-gray-800 truncate">{item.name}</p>
 <p className="text-sm text-indigo-600 font-medium whitespace-nowrap">{fmt(item.price)} each</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => updateCartQty(item.id, -1)}
 className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center font-bold transition-colors"
 >
 −
 </button>
 <span className="w-8 text-center font-bold text-lg">{item.qty}</span>
 <button
 onClick={() => updateCartQty(item.id, 1)}
 className="w-8 h-8 bg-green-100 hover:bg-green-200 text-green-600 rounded-lg flex items-center justify-center font-bold transition-colors"
 >
 +
 </button>
 </div>
 </div>
 ))}
 </div>
 <div className="border-t-2 border-indigo-100 pt-4 mt-4">
 <div className="flex justify-between items-center mb-4">
 <span className="text-lg font-semibold text-gray-700">Order Summary</span>
 <span className="text-2xl font-bold text-indigo-600">
 {fmt(Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0))}
 </span>
 </div>

 {/* Payment Method Selection */}
 <div className="grid grid-cols-2 gap-2 mb-4">
 {['cash', 'card'].map(method => (
 <button
 key={method}
 onClick={() => setPaymentMethod(method)}
 className={`p-3 rounded-xl font-bold text-sm transition-all ${
 paymentMethod === method
 ? 'bg-indigo-600 text-white shadow-lg'
 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
 }`}
 >
 {method === 'cash' ? '💵 Cash' : '💳 Card'}
 </button>
 ))}
 </div>

 {/* Guests seated at this table (dine-in only) */}
 {orderType !== 'TAKEAWAY' && (
 <div className="flex items-center justify-between bg-blue-50/70 rounded-xl px-3 py-2.5 mb-4">
 <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
 <Users className="w-4 h-4 text-blue-500" />
 Guests
 </span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setGuests(g => Math.max(1, Number(g) - 1))}
 className="w-8 h-8 rounded-full bg-white border border-blue-200 text-blue-600 font-bold text-lg leading-none hover:bg-blue-100 transition-colors disabled:opacity-40"
 disabled={Number(guests) <= 1}
 aria-label="Fewer guests"
 >
 −
 </button>
 <input
 type="number"
 min="1"
 max="50"
 value={guests}
 onChange={(e) =>
 setGuests(e.target.value === '' ? '' : Math.max(1, Math.min(50, Math.round(Number(e.target.value) || 1))))
 }
 className="w-14 text-center font-bold text-gray-800 bg-white border border-blue-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
 />
 <button
 type="button"
 onClick={() => setGuests(g => Math.min(50, Number(g) + 1))}
 className="w-8 h-8 rounded-full bg-white border border-blue-200 text-blue-600 font-bold text-lg leading-none hover:bg-blue-100 transition-colors disabled:opacity-40"
 disabled={Number(guests) >= 50}
 aria-label="More guests"
 >
 +
 </button>
 </div>
 </div>
 )}

 {/* Place Order Button */}
 <button
 onClick={handlePlaceOrder}
 disabled={isSubmitting}
 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
 >
 {isSubmitting ? (
 <>
 <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 Placing Order...
 </>
 ) : (
 <>
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 Place Order • {fmt(totalAmount)}
 </>
 )}
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Payment Modal for Takeaway Orders - z-[100] to stay above Notification toasts */}
 {showPaymentModal && pendingOrder && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 text-center">
 <h2 className="text-xl font-bold text-white">Payment</h2>
 <p className="text-green-100 text-sm">Complete your takeaway order payment</p>
 </div>

 <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
 {/* Order Summary */}
 <div className="bg-gray-50 rounded-xl p-4">
 <h3 className="font-semibold text-gray-800 mb-2">Order Summary</h3>
 <div className="flex justify-between text-sm mb-1">
 <span className="text-gray-600">Order ID</span>
 <span className="font-medium">#{pendingOrder.id}</span>
 </div>
 
 {/* Item Details */}
 <div className="my-3 space-y-2 border-t border-b border-gray-200 py-3">
 {pendingOrder.items?.map((item, idx) => (
 <div key={idx} className="flex justify-between text-sm">
 <span className="text-gray-700">{item.qty || item.quantity}x {item.name}</span>
 <span className="font-medium text-gray-800">{fmt((item.price || 0) * (item.qty || item.quantity || 1))}</span>
 </div>
 ))}
 </div>
 
 {/* Subtotal, Tax, Discount */}
 {(() => {
 const t = enrichOrderWithTotals(pendingOrder);
 return (
 <div className="space-y-1 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-600">Subtotal</span>
 <span className="font-medium">{fmt(t.subtotal)}</span>
 </div>
 {t.discountPercent > 0 && (
 <div className="flex justify-between">
 <span className="text-gray-600">Discount ({t.discountPercent}%)</span>
 <span className="font-medium text-green-600">-{fmt(t.discountAmount)}</span>
 </div>
 )}
 <div className="flex justify-between">
 <span className="text-gray-600">Service charge ({t.serviceChargePercent}%)</span>
 <span className="font-medium">+{fmt(t.serviceCharge)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-600">GST ({t.taxPercent}%)</span>
 <span className="font-medium text-gray-800">+{fmt(t.taxAmount)}</span>
 </div>
 </div>
 );
 })()}
 
 <div className="flex justify-between items-center pt-3 border-t border-gray-200 mt-3">
 <span className="text-lg font-bold text-gray-800">Total</span>
 <span className="text-2xl font-bold text-green-600">{fmt(enrichOrderWithTotals(pendingOrder).total)}</span>
 </div>
 </div>

 {/* Payment Method */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
 <div className="grid grid-cols-2 gap-2">
 <button
 onClick={() => setPaymentMethod('cash')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
 paymentMethod === 'cash' 
 ? 'border-green-500 bg-green-50 text-green-700' 
 : 'border-gray-200 hover:border-gray-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 Cash
 </button>
 <button
 onClick={() => setPaymentMethod('card')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
 paymentMethod === 'card' 
 ? 'border-green-500 bg-green-50 text-green-700' 
 : 'border-gray-200 hover:border-gray-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
 </svg>
 Card
 </button>
 <button
 onClick={() => setPaymentMethod('mbob')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
 paymentMethod === 'mbob'
 ? 'border-green-500 bg-green-50 text-green-700' 
 : 'border-gray-200 hover:border-gray-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
 </svg>
 Bank (mBOB)
 </button>
 <button
 onClick={() => setPaymentMethod('mpay')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
 paymentMethod === 'mpay'
 ? 'border-green-500 bg-green-50 text-green-700' 
 : 'border-gray-200 hover:border-gray-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
 </svg>
 MPay
 </button>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex gap-3 pt-4">
 <button
 onClick={() => {
 setShowPaymentModal(false);
 setPendingOrder(null);
 }}
 className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handlePaymentComplete}
 className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
 >
 Complete Payment
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </>
 );
};

export default OrderEntryModal;
