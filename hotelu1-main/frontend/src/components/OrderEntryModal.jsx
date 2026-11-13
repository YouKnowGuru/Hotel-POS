import React, { useState, useEffect, useRef } from 'react';
import { authFetch, getAPI_URL } from '../utils/api';
import { enrichOrderWithTotals, fetchAndCacheGlobalSettings, calculateOrderTotals, getGlobalTaxDiscount } from '../utils/orderTotals';
import Notification from './Notification';
import MenuImage from './MenuImage';
import useCurrency from '../hooks/useCurrency';
import { Users } from 'lucide-react';

const OrderEntryModal = ({ table, onClose, onOrderPlaced, locationSettings, nextOrderId, setNextOrderId, orderType, initialOrder }) => {
 const { format: fmt } = useCurrency(locationSettings);
 const [menu, setMenu] = useState([]);
 const [cart, setCart] = useState({});
 const [notification, setNotification] = useState(null);
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [searchTerm, setSearchTerm] = useState('');
 const [categories, setCategories] = useState(['All']);
 // BUGFIX (takeaway): this modal used to open its OWN "Order Confirmed"
 // card while the parent page opened a SECOND identical card, and it also
 // auto-opened a print window (window.print()) which froze the whole
 // screen. There is now exactly ONE receipt, owned by the parent page.
 const [paymentBusy, setPaymentBusy] = useState(false);
 const paymentInFlight = useRef(false);
 const [showMobileCart, setShowMobileCart] = useState(false);
 const [paymentMethod, setPaymentMethod] = useState('cash');
 const [isSubmitting, setIsSubmitting] = useState(false);
 // Shared tax/discount settings (fetched once) so totals always match
 // what the backend charges — Service charge + GST.
 // BUGFIX: initialise from localStorage cache instead of null so the
 // "GST (0%)" display never appears while the async fetch is in-flight.
 const [taxSettings, setTaxSettings] = useState(() => getGlobalTaxDiscount());

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
 const availableMenu = data.filter(item => item.isAvailable !== false);
 
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

// Printing is now strictly user-initiated from the single receipt card on
// the parent page. Auto-opening a print window here used to steal focus and
// leave the app behind a frozen print dialog right after payment.

 // Handle payment completion for takeaway orders.
 // BUGFIX (duplicate cards + frozen screen): this used to
 //   1. open its own "Order Confirmed / token" card,
 //   2. call onOrderPlaced(), which made the parent open a SECOND one,
 //   3. auto-open a print window whose window.print() froze the UI,
 //   4. and show a "confirmed" card even when the payment FAILED.
 // Now there is exactly ONE receipt (owned by the parent), printing is
 // manual, and a failed payment leaves the payment card open for a retry.
 const handlePaymentComplete = async () => {
 if (!pendingOrder || paymentInFlight.current) return;
 paymentInFlight.current = true;
 setPaymentBusy(true);
 try {
 // /complete-payment sets status completed, payment paid and closes the
 // bill in one go. An old /api/orders/:id/status call 404'd silently
 // while a receipt claiming "PAID" was printed.
 const response = await authFetch(`/api/orders/${pendingOrder.id}/complete-payment`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ payment_method: paymentMethod }),
 });

 if (!response.ok) {
 const errData = await response.json().catch(() => ({}));
 setNotification({ message: errData.message || 'Payment could not be completed — please try again', type: 'error' });
 setTimeout(() => setNotification(null), 5000);
 return; // keep the payment card open so the cashier can retry
 }

 const data = await response.json().catch(() => ({}));
 const finalOrder = { ...pendingOrder, ...(data?.order || {}), paymentMethod };
 finalOrder.status = 'completed';
 finalOrder.payment_status = 'paid';

 setShowPaymentModal(false);
 setPendingOrder(null);
 // The parent shows the single token receipt and refreshes its board.
 onOrderPlaced(finalOrder);
 onClose();
 } catch (error) {
 console.error('Payment error:', error);
 // No fake confirmation on failure — the order is still unpaid.
 setNotification({ message: 'Payment could not be completed — please try again', type: 'error' });
 setTimeout(() => setNotification(null), 5000);
 } finally {
 paymentInFlight.current = false;
 setPaymentBusy(false);
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
 table_name: table && table.id ? table.id : (orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'DELIVERY' ? 'Delivery' : 'Unknown'),
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
 if (orderType !== 'TAKEAWAY' && orderType !== 'DELIVERY') {
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
 'Other': '🍽️',
 // Tomza-specific categories
 'Refreshing Drinks': '🥤',
 'Local Village Spirits': '🍶',
 'Bhutanese Bar Selection': '🍺',
 'Tomza': '🍜',
 'Snacks': '🍟',
 'Hot Beverages': '☕',
 'Noodles': '🍜',
 'Noodle': '🍜',
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
 {/* BUGFIX (mobile blank menu): this card used max-h-[95vh]. With only a
     max-height the card's height is "indefinite", so on mobile (column
     layout) the nested flex chain — panel flex-1 (flex-basis 0%) and the
     h-full menu list — could not resolve its sizes and the Menu Items
     panel collapsed to 0px, leaving the popup blank below the header.
     A definite h-[95vh] makes every nested flex/percent height resolvable. */}
 <div className="bg-white dark:bg-[#141C2E] rounded-2xl shadow-2xl w-full max-w-6xl h-[90dvh] sm:h-[95vh] overflow-hidden overflow-x-hidden flex flex-col dark:bg-[#141C2E] dark:border dark:border-slate-700/60">
 {/* Modal Header - Orange Theme */}
 <div className="flex justify-between items-center px-3 py-2 sm:p-6 border-b border-indigo-100 bg-indigo-600 flex-shrink-0">
 <h3 className="text-xs sm:text-2xl font-bold text-white truncate pr-2">
 New {orderType === 'TAKEAWAY' ? 'Takeaway' : orderType === 'DELIVERY' ? 'Delivery' : 'Dine-In'} Order{table && table.id === 'Takeaway' ? '' : table && table.id ? ` — Table ${table.id}` : ''}
 </h3>
 <button 
 onClick={onClose} 
 className="text-white/80 hover:text-white bg-white/30 hover:bg-white/30 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
 >
 <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
 </svg>
 </button>
 </div>
 {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
 <div className="p-1.5 sm:p-6 flex-grow overflow-hidden flex flex-col overflow-x-hidden">
 <div className="flex flex-col lg:flex-row gap-3 sm:gap-6 flex-grow min-h-0">
 {/* Menu Items Panel - Full width on mobile, 3/4 on desktop */}
 <div className="flex-1 lg:flex-[3] min-w-0 bg-indigo-50 p-2 sm:p-6 rounded-xl border border-indigo-100 overflow-hidden flex flex-col min-h-0 lg:max-h-none dark:bg-[#1A2336] dark:border-slate-700/60">
 {/* Compact header on mobile: title + search in one row */}
 <div className="flex flex-row items-center justify-between mb-1.5 sm:mb-4 flex-shrink-0 gap-2">
 <h4 className="font-bold text-gray-800 dark:text-white flex items-center text-xs sm:text-2xl shrink-0">
 <span className="mr-1 text-xs sm:text-2xl">🍽️</span>
 <span className="hidden sm:inline">Menu Items</span>
 <span className="sm:hidden">Menu</span>
 </h4>
 <div className="flex items-center space-x-2 min-w-0 flex-1 justify-end">
 <div className="relative w-full max-w-[180px] sm:max-w-none sm:w-56">
 <input
 type="text"
 placeholder="Search..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-3 sm:pl-4 pr-7 sm:pr-10 py-1 sm:py-2.5 border-2 border-indigo-100 dark:border-slate-600 rounded-lg sm:rounded-xl bg-white dark:bg-[#0B1220] text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full text-xs sm:text-sm font-medium transition-all duration-200 shadow-sm dark:shadow-none dark:bg-[#0B1220] dark:border-slate-600 dark:text-slate-200 dark:focus:border-indigo-500"
 />
 {searchTerm && (
 <button
 onClick={() => setSearchTerm('')}
 className="absolute right-1.5 sm:right-3 top-1.5 sm:top-2.5 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors text-xs sm:text-sm"
 >
 ✕
 </button>
 )}
 </div>
 </div>
 </div>
 
 {/* Category Tabs — compact horizontal scroll (food-app style) */}
 <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-4 flex-shrink-0 overflow-x-auto scrollbar-none pb-0.5" style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
 {categories.map(category => (
 <button
 key={category}
 onClick={() => setSelectedCategory(category)}
 style={{ scrollSnapAlign: 'start', flexShrink: 0 }}
 className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition-all duration-200 text-[11px] sm:text-sm whitespace-nowrap ${
 selectedCategory === category
 ? 'bg-gradient-to-r from-indigo-600 to-red-400 text-white shadow-lg transform scale-105'
 : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-400 hover:shadow-md dark:bg-[#1A2336] dark:text-slate-300 dark:border-slate-600 dark:hover:border-indigo-500'
 }`}
 >
 <span className="mr-0.5 sm:mr-1 text-[11px] sm:text-sm">{getCategoryIcon(category)}</span>
 <span className="text-[11px] sm:text-sm">{category}</span>
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
 <p className="text-gray-500 dark:text-slate-400 text-sm sm:text-lg mb-1 sm:mb-2">No items found for "{searchTerm}"</p>
 <p className="text-xs sm:text-sm text-gray-400 dark:text-slate-500 mb-2 sm:mb-4">Try different keywords or browse categories</p>
 </>
 ) : (
 <>
 <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
 <span className="text-3xl">🍽️</span>
 </div>
 <p className="text-gray-600 dark:text-slate-400 font-medium mb-1">No menu items available</p>
 <p className="text-xs text-gray-400 dark:text-slate-500">Try selecting a different category</p>
 </>
 )}
 </div>
 </div>
 ) : (
 <div className="h-full overflow-y-auto overflow-x-hidden pr-1 sm:pr-2">
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5 sm:gap-4">
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
 <div key={item.id} className="bg-white dark:bg-[#1A2336] rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-102 overflow-hidden group border border-indigo-100 dark:bg-[#141C2E] dark:border-slate-700/60">
 {/* Food Image - Circular like MenuManagement */}
 <div className="w-full h-14 sm:h-28 bg-indigo-50 flex items-center justify-center border-b border-indigo-200 dark:bg-[#0B1220] dark:border-slate-700/60">
 <div className="w-10 h-10 sm:w-20 sm:h-20 rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center dark:bg-[#1A2336]">
 <MenuImage src={item.image} alt={item.name} ratio="1 / 1"
 emoji={getCategoryIcon(displayCategory)} className="mi-round"
 style={{ width: '100%', height: '100%' }} />
 </div>
 </div>
 <div className="p-1.5 sm:p-3">
 {/* Available Badge */}
 <div className="mb-1 sm:mb-2">
 <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-semibold inline-flex items-center">
 <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full mr-1"></span>
 Available
 </span>
 </div>
 {/* Item Name */}
 <h5 className="font-bold text-gray-800 dark:text-slate-200 text-[11px] sm:text-sm mb-0.5 sm:mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight line-clamp-1">
 {highlightText(item.name, searchTerm)}
 </h5>
 {/* Category */}
 <p className="text-[9px] sm:text-xs text-gray-500 dark:text-slate-500 mb-1 sm:mb-2">
 {displayCategory}
 </p>
 {/* Price and Add Button */}
 <div className="flex items-center justify-between">
 <p className="text-xs sm:text-base font-bold text-indigo-600 dark:text-indigo-400">
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
 <div className="hidden md:flex flex-1 md:max-w-[280px] bg-white dark:bg-[#141C2E] flex-col rounded-xl border border-indigo-100 shadow-sm dark:bg-[#141C2E] dark:border-slate-700/60">
 <div className="p-3 sm:p-4 bg-indigo-50/50 dark:bg-[#0B1220] border-b border-indigo-100 dark:border-slate-700/60 flex-shrink-0">
 <h4 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white flex items-center">
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
 <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
 <svg className="w-8 h-8 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 </div>
 <p className="text-gray-600 dark:text-slate-400 font-medium mb-1">Add items to order</p>
 <p className="text-xs text-gray-400 dark:text-slate-500">Select delicious items from the menu</p>
 </div>
 </div>
 ) : (
 <div className="h-full flex flex-col">
 <div className="space-y-1.5 sm:space-y-2 flex-grow overflow-y-auto pr-1 sm:pr-2">
 {Object.values(cart).map(item => (
 <div key={item.id} className="bg-white dark:bg-[#1A2336] rounded-xl p-2 sm:p-3 shadow-sm border border-indigo-200 dark:border-indigo-800/50 hover:shadow-md transition-shadow dark:bg-[#1A2336] dark:border-slate-600">
 <div className="flex items-center justify-between">
 <div className="flex-1 min-w-0">
 <h6 className="font-bold text-gray-800 dark:text-slate-200 text-xs sm:text-sm break-words leading-tight">{item.name}</h6>
 <p className="text-xs text-gray-500 dark:text-slate-400">
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
 <span className="font-bold text-gray-900 dark:text-white w-6 sm:w-7 text-center text-sm sm:text-base bg-indigo-50 dark:bg-indigo-900/30 rounded-lg dark:text-gray-100 dark:bg-indigo-500/15">{item.qty}</span>
 <button
 onClick={() => updateCartQty(item.id, 1)}
 className="bg-green-500 hover:bg-green-600 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-sm sm:text-base font-bold transition-colors shadow-sm"
 >
 +
 </button>
 </div>
 </div>
<div className="mt-1 pt-1 border-t border-indigo-100 dark:border-slate-700/60">
<p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
 Item Total: {fmt(item.price * item.qty)}
 </p>
 </div>
 </div>
 ))}
 </div>
<div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t-2 border-gray-300 dark:border-slate-600 flex-shrink-0">
<div className="space-y-1 text-xs sm:text-sm mb-2 sm:mb-3">
<div className="flex justify-between text-gray-500 dark:text-slate-400">
<span>Subtotal</span><span className="font-semibold tabular-nums">{fmt(takeTotals.subtotal)}</span>
</div>
<div className="flex justify-between text-gray-500 dark:text-slate-400">
<span>Service charge ({takeTotals.serviceChargePercent}%)</span><span className="font-semibold tabular-nums">+{fmt(takeTotals.serviceCharge)}</span>
</div>
<div className="flex justify-between text-gray-500 dark:text-slate-400">
<span>GST ({takeTotals.taxPercent}%)</span><span className="font-semibold tabular-nums">+{fmt(takeTotals.taxAmount)}</span>
</div>
 {takeTotals.discountPercent > 0 && (
 <div className="flex justify-between text-green-600">
 <span>Discount ({takeTotals.discountPercent}%)</span><span className="font-semibold tabular-nums">-{fmt(takeTotals.discountAmount)}</span>
 </div>
 )}
 <div className="flex justify-between items-center pt-1">
 <span className="text-sm sm:text-base font-bold text-gray-800 dark:text-white">Total:</span>
 <span className="text-lg sm:text-xl font-bold text-green-600">{fmt(totalAmount)}</span>
 </div>
 </div>
<div className="bg-gradient-to-r from-indigo-600 to-red-100 dark:from-indigo-900/50 dark:to-rose-900/30 p-1.5 sm:p-2 rounded-lg">
<p className="text-xs text-gray-600 dark:text-slate-300 text-center">
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
<div className="hidden md:flex p-3 sm:p-4 border-t border-indigo-100 dark:border-slate-700/60 bg-indigo-50/50 dark:bg-[#0B1220] flex-col sm:flex-row justify-between items-center flex-shrink-0 gap-3 sm:gap-0">
<div className="text-left text-center sm:text-left">
<p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 font-medium">Order Summary</p>
<p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
{fmt(totalAmount)} <span className="text-gray-500 dark:text-slate-500 text-sm">• {Object.keys(cart).length} items</span>
 </p>
 </div>
 <div className="flex space-x-2 sm:space-x-3">
 <button
 onClick={clearCart}
 disabled={Object.keys(cart).length === 0}
 className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 flex items-center ${
 Object.keys(cart).length === 0
? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
: 'bg-white text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm dark:bg-[#1A2336] dark:text-rose-400 dark:border-rose-800/60 dark:hover:bg-rose-950/40'
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
? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
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
 <div className="relative bg-white dark:bg-[#141C2E] w-full rounded-t-3xl shadow-2xl max-h-[88dvh] overflow-hidden flex flex-col pointer-events-auto dark:bg-[#141C2E]">
 {/* Fixed Header */}
 <div className="p-4 border-b border-gray-100 dark:border-slate-700/60 flex items-center justify-between flex-shrink-0">
 <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
 <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 Your Cart ({Object.keys(cart).length})
 </h3>
 <div className="flex items-center gap-2">
 {Object.keys(cart).length > 0 && (
 <button
 onClick={() => { clearCart(); setShowMobileCart(false); }}
 className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full transition-colors"
 title="Clear Cart"
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 <button
 onClick={() => setShowMobileCart(false)}
 className="p-2 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-[#1A2336]"
 >
 <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>

 {/* Scrollable Content Area */}
 <div className="flex-1 overflow-y-auto p-4">
 {Object.keys(cart).length === 0 ? (
 <div className="text-center py-12">
 <svg className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
<p className="text-gray-600 dark:text-slate-400 text-lg font-medium">Your cart is empty</p>
<p className="text-gray-400 dark:text-slate-500 text-sm mt-2">Add items to get started!</p>
 </div>
 ) : (
 <>
 {/* Cart Items */}
 <div className="space-y-2 mb-4">
 {Object.values(cart).map(item => (
<div key={item.id} className="flex items-center justify-between bg-indigo-50 dark:bg-[#1A2336] p-2.5 sm:p-3 rounded-xl gap-2">
<div className="flex-1 min-w-0">
<p className="font-semibold text-gray-800 dark:text-slate-200 text-sm break-words leading-tight">{item.name}</p>
<p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium whitespace-nowrap">{fmt(item.price)} each</p>
 </div>
 <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
 <button
 onClick={() => updateCartQty(item.id, -1)}
className="w-8 h-8 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center font-bold transition-colors"
>
−
</button>
<span className="w-7 text-center font-bold text-base dark:text-white">{item.qty}</span>
<button
onClick={() => updateCartQty(item.id, 1)}
className="w-8 h-8 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center font-bold transition-colors"
 >
 +
 </button>
 </div>
 </div>
 ))}
 </div>

 {/* Guests seated at this table (dine-in only) */}
 {orderType !== 'TAKEAWAY' && orderType !== 'DELIVERY' && (
 <div className="flex items-center justify-between bg-blue-50/70 rounded-xl px-3 py-2.5 mb-3 dark:bg-blue-950/40">
 <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-slate-300">
 <Users className="w-4 h-4 text-blue-500" />
 Guests
 </span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setGuests(g => Math.max(1, Number(g) - 1))}
 className="w-8 h-8 rounded-full bg-white dark:bg-[#1A2336] border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-lg leading-none hover:bg-blue-100 transition-colors disabled:opacity-40 dark:bg-[#1A2336] dark:border-blue-800/60 dark:text-blue-400"
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
 className="w-14 text-center font-bold text-gray-800 dark:text-slate-200 bg-white dark:bg-[#1A2336] border border-blue-200 dark:border-blue-800 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-[#1A2336] dark:border-blue-800/60 dark:text-slate-100"
 />
 <button
 type="button"
 onClick={() => setGuests(g => Math.min(50, Number(g) + 1))}
 className="w-8 h-8 rounded-full bg-white dark:bg-[#1A2336] border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-bold text-lg leading-none hover:bg-blue-100 transition-colors disabled:opacity-40 dark:bg-[#1A2336] dark:border-blue-800/60 dark:text-blue-400"
 disabled={Number(guests) >= 50}
 aria-label="More guests"
 >
 +
 </button>
 </div>
 </div>
 )}
 </>
 )}
 </div>

 {/* Fixed Footer with totals + Place Order */}
 {Object.keys(cart).length > 0 && (
 <div className="border-t border-gray-100 dark:border-slate-700/60 p-4 flex-shrink-0 bg-white dark:bg-[#141C2E]">
 {/* Mini breakdown */}
 <div className="space-y-1 mb-3 text-xs">
 <div className="flex justify-between text-gray-500 dark:text-slate-400">
 <span>Subtotal</span>
 <span className="font-semibold tabular-nums">{fmt(takeTotals.subtotal)}</span>
 </div>
 <div className="flex justify-between text-gray-500 dark:text-slate-400">
 <span>Service charge ({takeTotals.serviceChargePercent}%)</span>
 <span className="font-semibold tabular-nums">+{fmt(takeTotals.serviceCharge)}</span>
 </div>
 <div className="flex justify-between text-gray-500 dark:text-slate-400">
 <span>GST ({takeTotals.taxPercent}%)</span>
 <span className="font-semibold tabular-nums">+{fmt(takeTotals.taxAmount)}</span>
 </div>
 {takeTotals.discountPercent > 0 && (
 <div className="flex justify-between text-green-600">
 <span>Discount ({takeTotals.discountPercent}%)</span>
 <span className="font-semibold tabular-nums">-{fmt(takeTotals.discountAmount)}</span>
 </div>
 )}
 </div>
 <div className="flex justify-between items-center mb-3">
 <span className="text-base font-bold text-gray-800 dark:text-white">Total</span>
 <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(totalAmount)}</span>
 </div>

 {/* Place Order Button */}
 <button
 onClick={handlePlaceOrder}
 disabled={isSubmitting}
 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
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
 )}
 </div>
 </div>
 )}

 {/* Payment Modal for Takeaway Orders - z-[100] to stay above Notification toasts */}
 {showPaymentModal && pendingOrder && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
 <div className="bg-white dark:bg-[#141C2E] rounded-2xl shadow-2xl max-w-md w-full max-h-[90dvh] overflow-hidden flex flex-col dark:bg-[#141C2E] dark:border dark:border-slate-700/60">
 {/* Header */}
 <div className="bg-gradient-to-r from-green-500 to-green-600 p-3 sm:p-4 text-center flex-shrink-0">
 <h2 className="text-lg sm:text-xl font-bold text-white">Payment</h2>
 <p className="text-green-100 text-xs sm:text-sm">Complete your takeaway order payment</p>
 </div>

 <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
 {/* Order Summary */}
<div className="bg-gray-50 dark:bg-[#1A2336] rounded-xl p-4 dark:bg-[#1A2336]">
<h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">Order Summary</h3>
<div className="flex justify-between text-sm mb-1">
<span className="text-gray-600 dark:text-slate-400">Order ID</span>
<span className="font-medium dark:text-slate-200">#{pendingOrder.id}</span>
 </div>
 
 {/* Item Details */}
<div className="my-3 space-y-2 border-t border-b border-gray-200 dark:border-slate-700 py-3">
{pendingOrder.items?.map((item, idx) => (
<div key={idx} className="flex justify-between text-sm">
<span className="text-gray-700 dark:text-slate-300">{item.qty || item.quantity}x {item.name}</span>
<span className="font-medium text-gray-800 dark:text-slate-200">{fmt((item.price || 0) * (item.qty || item.quantity || 1))}</span>
 </div>
 ))}
 </div>
 
 {/* Subtotal, Tax, Discount */}
 {(() => {
 const t = enrichOrderWithTotals(pendingOrder);
 return (
<div className="space-y-1 text-sm">
<div className="flex justify-between">
<span className="text-gray-600 dark:text-slate-400">Subtotal</span>
<span className="font-medium dark:text-slate-200">{fmt(t.subtotal)}</span>
</div>
{t.discountPercent > 0 && (
<div className="flex justify-between">
<span className="text-gray-600 dark:text-slate-400">Discount ({t.discountPercent}%)</span>
<span className="font-medium text-green-600 dark:text-green-400">-{fmt(t.discountAmount)}</span>
</div>
)}
<div className="flex justify-between">
<span className="text-gray-600 dark:text-slate-400">Service charge ({t.serviceChargePercent}%)</span>
<span className="font-medium dark:text-slate-200">+{fmt(t.serviceCharge)}</span>
</div>
<div className="flex justify-between">
<span className="text-gray-600 dark:text-slate-400">GST ({t.taxPercent}%)</span>
<span className="font-medium text-gray-800 dark:text-slate-200">+{fmt(t.taxAmount)}</span>
</div>
 </div>
 );
 })()}
 
<div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-slate-700 mt-3">
<span className="text-lg font-bold text-gray-800 dark:text-white">Total</span>
<span className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt(enrichOrderWithTotals(pendingOrder).total)}</span>
 </div>
 </div>

 {/* Payment Method */}
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Payment Method</label>
 <div className="grid grid-cols-2 gap-2">
 <button
 onClick={() => setPaymentMethod('cash')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold ${
 paymentMethod === 'cash' 
? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600'
: 'border-gray-200 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
 </svg>
 Cash
 </button>
 <button
 onClick={() => setPaymentMethod('card')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold ${
 paymentMethod === 'card' 
? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600'
: 'border-gray-200 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
 </svg>
 Card
 </button>
 <button
 onClick={() => setPaymentMethod('mbob')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold ${
 paymentMethod === 'mbob'
? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600'
: 'border-gray-200 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300'
 }`}
 >
 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
 </svg>
 Bank (mBOB)
 </button>
 <button
 onClick={() => setPaymentMethod('mpay')}
 className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 min-h-[44px] text-sm font-semibold ${
 paymentMethod === 'mpay'
? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600'
: 'border-gray-200 hover:border-gray-300 dark:border-slate-600 dark:hover:border-slate-500 dark:text-slate-300'
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
 <div className="flex gap-3 pt-4 flex-shrink-0">
 <button
 onClick={() => {
 if (paymentBusy) return;
 setShowPaymentModal(false);
 setPendingOrder(null);
 }}
 disabled={paymentBusy}
 className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60 dark:bg-[#141C2E] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-[#1A2336] min-h-[44px]"
 >
 Cancel
 </button>
 <button
 onClick={handlePaymentComplete}
 disabled={paymentBusy}
 className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold text-sm hover:from-green-600 hover:to-green-700 transition-all shadow-lg min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {paymentBusy ? 'Completing…' : 'Complete Payment'}
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
