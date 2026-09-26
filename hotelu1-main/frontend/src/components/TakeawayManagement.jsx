import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import { enrichOrderWithTotals } from '../utils/orderTotals';
import Notification from './Notification';
import OrderEntryModal from './OrderEntryModal';
import useCurrency from '../hooks/useCurrency';
import SourceBadge from './SourceBadge';
import {
  Plus,
  ShoppingBag,
  Clock,
  Utensils,
  PackageCheck,
  AlertTriangle,
  Trash2,
  Hash,
  Printer,
  CheckCircle2,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Status meta                                                        */
/* ------------------------------------------------------------------ */

const STATUS_META = {
  pending: {
    label: 'Pending',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
    Icon: Clock,
    accent: 'text-amber-600',
    soft: 'bg-amber-50',
  },
  preparing: {
    label: 'Preparing',
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    Icon: Utensils,
    accent: 'text-blue-600',
    soft: 'bg-blue-50',
  },
  ready: {
    label: 'Ready for pickup',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    Icon: PackageCheck,
    accent: 'text-emerald-600',
    soft: 'bg-emerald-50',
  },
  NOT_AVAILABLE: {
    label: 'Not available',
    pill: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    Icon: AlertTriangle,
    accent: 'text-rose-600',
    soft: 'bg-rose-50',
  },
};

const STATUS_TABS = [
  { id: 'all', label: 'All', accent: 'text-gray-700' },
  { id: 'pending', label: 'Pending', accent: 'text-amber-600' },
  { id: 'preparing', label: 'Preparing', accent: 'text-blue-600' },
  { id: 'ready', label: 'Ready', accent: 'text-emerald-600' },
];

const statusKey = (s) => (s in STATUS_META ? s : 'pending');

const TakeawayManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const navigate = useNavigate();

  // Thermal print styles for 80mm billing printer
  const thermalPrintStyles = `
        @media print {
            @page { size: 80mm auto; margin: 0; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { margin: 0 !important; padding: 0 !important; background: white !important; }
            body > * { display: none !important; }
            .thermal-print-only { 
                display: block !important; position: static !important;
                left: auto !important; top: auto !important;
                width: 80mm !important; max-width: 80mm !important;
                margin: 0 auto !important; padding: 10px !important;
                font-family: 'Courier New', 'Consolas', monospace !important;
                font-size: 12px !important; line-height: 1.4 !important;
                color: black !important; background: white !important;
                visibility: visible !important;
            }
            .thermal-print-only * { visibility: visible !important; display: block !important; }
            .thermal-header { text-align: center !important; margin-bottom: 10px !important; }
            .thermal-title { font-weight: bold !important; font-size: 14px !important; }
            .thermal-token-box { border: 2px dashed black !important; padding: 15px !important; margin: 15px 0 !important; text-align: center !important; }
            .thermal-token-number { font-size: 28px !important; font-weight: bold !important; margin: 10px 0 !important; }
            .thermal-line { border-top: 1px dashed black !important; margin: 8px 0 !important; width: 100% !important; }
            .thermal-bold { font-weight: bold !important; }
            .thermal-item-row { display: flex !important; justify-content: space-between !important; margin: 5px 0 !important; }
            .thermal-total { font-size: 14px !important; font-weight: bold !important; text-align: center !important; margin-top: 10px !important; }
            .thermal-footer { text-align: center !important; margin-top: 15px !important; font-size: 11px !important; }
        }
        .thermal-print-only { display: none; }
    `;

  // --- AUTH GATE (preserved) ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  // --- STATE (preserved) ---
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // --- new local UI state (visual only) ---
  const [activeFilter, setActiveFilter] = useState('all');

  // --- POLLING (preserved 2s interval) ---
  useEffect(() => {
    fetchActiveOrders();
    const orderInterval = setInterval(fetchActiveOrders, 2000);
    return () => clearInterval(orderInterval);
    // eslint-disable-next-line
  }, []);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  // --- FETCH (preserved logic) ---
  const fetchActiveOrders = () => {
    authFetch('/api/orders?type=TAKEAWAY')
      .then((res) => {
        if (!res.ok) {
          console.error('Server error:', res.status, res.statusText);
          setActiveOrders([]);
          return Promise.reject(new Error(`HTTP ${res.status}: ${res.statusText}`));
        }
        return res.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error('Orders response is not an array:', data);
          setActiveOrders([]);
          return;
        }
        setActiveOrders(
          data.filter((o) => o.status !== 'completed' && o.status !== 'delivered')
        );
      })
      .catch((err) => {
        console.error('Failed to fetch TAKEAWAY orders:', err);
        setActiveOrders([]);
      });
  };

  // --- HANDLERS (preserved logic) ---
  const handleQuickOrder = () => setShowOrderModal(true);

  const handleOrderPlaced = (orderData) => {
    setActiveOrders((prev) => [...prev, orderData]);
    if (orderData.token) {
      setConfirmedOrder(orderData);
      setShowReceipt(true);
    } else {
      setNotification({ message: 'Takeaway order placed!', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }
    setShowOrderModal(false);
  };

  const handleAddMoreItems = async (order) => {
    if (order.status === 'NOT_AVAILABLE') {
      try {
        const deleteResponse = await authFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete old order');
        }
        const newOrderPayload = {
          table_name: order.table_name,
          type: 'TAKEAWAY',
          status: 'PENDING',
          total: 0,
          items: [],
        };
        const createResponse = await authFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify(newOrderPayload),
        });
        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create new order');
        }
        const newOrder = await createResponse.json();
        setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
        setNotification({ message: `Order #${order.id} reset successfully`, type: 'success' });
        setEditingOrder(newOrder);
        setShowOrderModal(true);
      } catch (error) {
        console.error('Error resetting order:', error);
        setNotification({ message: `Error resetting order: ${error.message}`, type: 'error' });
      }
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    setEditingOrder(order);
    setShowOrderModal(true);
  };

  const handleRemoveItem = async (order, itemIndex) => {
    try {
      const updatedItems = order.items.filter((_, index) => index !== itemIndex);
      const newTotal = updatedItems.reduce(
        (sum, item) => sum + item.price * (item.quantity || item.qty || 1),
        0
      );
      if (updatedItems.length === 0) {
        const updateResponse = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({ items: [], total: 0 }),
        });
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to update order before deletion');
        }
        const deleteResponse = await authFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete empty order');
        }
        setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
        setNotification({ message: 'Order removed as all items were deleted!', type: 'success' });
      } else {
        const response = await authFetch(`/api/orders/${order.id}`, {
          method: 'PUT',
          body: JSON.stringify({ items: updatedItems, total: newTotal }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to remove item');
        }
        setActiveOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, items: updatedItems, total: newTotal } : o
          )
        );
        setNotification({ message: 'Item removed successfully!', type: 'success' });
      }
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Error removing item:', error);
      setNotification({ message: `Error: ${error.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteEmptyOrder = async (order) => {
    try {
      const deleteResponse = await authFetch(`/api/orders/${order.id}`, { method: 'DELETE' });
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete empty order');
      }
      setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
      setNotification({ message: `Order #${order.id} deleted successfully!`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Error deleting empty order:', error);
      setNotification({ message: `Error deleting order: ${error.message}`, type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleMarkCompleted = async (orderId) => {
    try {
      await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed' }),
      });
      setActiveOrders((prev) => prev.filter((order) => order.id !== orderId));
      setNotification({
        message: `Takeaway Order #${orderId} marked as completed!`,
        type: 'success',
      });
    } catch (error) {
      setNotification({ message: 'Error completing takeaway order.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  /* -------------- derived counts + filtered list -------------- */

  const counts = useMemo(() => {
    const c = { all: activeOrders.length, pending: 0, preparing: 0, ready: 0, NOT_AVAILABLE: 0 };
    activeOrders.forEach((o) => {
      const k = statusKey(o.status);
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return activeOrders;
    return activeOrders.filter((o) => statusKey(o.status) === activeFilter);
  }, [activeOrders, activeFilter]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: thermalPrintStyles }} />

      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </span>
            Takeaway Orders
          </h1>
          <p className="text-sm text-gray-500 mt-1 ml-11">
            Quick service orders &amp; live token tracking
          </p>
        </div>
        <button
          onClick={handleQuickOrder}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:shadow-orange-200 transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          Place New Order
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SummaryCard
          label="ACTIVE ORDERS"
          value={counts.all}
          Icon={ShoppingBag}
          color="text-orange-500"
          delay={0}
          isLoaded={isLoaded}
        />
        <SummaryCard
          label="PENDING"
          value={counts.pending}
          Icon={Clock}
          color="text-amber-500"
          delay={60}
          isLoaded={isLoaded}
        />
        <SummaryCard
          label="PREPARING"
          value={counts.preparing}
          Icon={Utensils}
          color="text-blue-500"
          delay={120}
          isLoaded={isLoaded}
        />
        <SummaryCard
          label="READY"
          value={counts.ready}
          Icon={PackageCheck}
          color="text-emerald-500"
          delay={180}
          isLoaded={isLoaded}
        />
      </div>

      {/* Status filter pills */}
      <div className="bg-white border border-gray-100 rounded-full shadow-sm p-1 flex items-center gap-1 mb-5 w-fit overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          const count = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-200/60'
                  : `${tab.accent} hover:bg-gray-50`
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-400 mx-auto mb-3 flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <p className="text-base font-semibold text-gray-900">No takeaway orders</p>
          <p className="text-sm text-gray-500 mt-1">
            New orders will appear here in real time.
          </p>
          <button
            onClick={handleQuickOrder}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Place First Order
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              fmt={fmt}
              index={index}
              isLoaded={isLoaded}
              onMarkCompleted={() => handleMarkCompleted(order.id)}
              onAddItems={() => handleAddMoreItems(order)}
              onDeleteEmpty={() => handleDeleteEmptyOrder(order)}
            />
          ))}
        </div>
      )}

      {/* Order entry modal — preserved untouched */}
      {showOrderModal && (
        <OrderEntryModal
          table={
            editingOrder
              ? { id: 'Takeaway', status: 'available', capacity: 0 }
              : { id: 'Takeaway', status: 'available', capacity: 0 }
          }
          onClose={() => {
            setShowOrderModal(false);
            setEditingOrder(null);
          }}
          onOrderPlaced={
            editingOrder
              ? (orderData) => {
                  setActiveOrders((prev) =>
                    prev.map((o) =>
                      o.id === editingOrder.id
                        ? { ...o, items: orderData.items, total: orderData.total }
                        : o
                    )
                  );
                  setNotification({
                    message: `Takeaway order #${editingOrder.id} updated!`,
                    type: 'success',
                  });
                  setEditingOrder(null);
                  setTimeout(() => setNotification(null), 3000);
                }
              : handleOrderPlaced
          }
          locationSettings={locationSettings}
          nextOrderId={nextOrderId}
          setNextOrderId={setNextOrderId}
          orderType="TAKEAWAY"
          initialOrder={editingOrder}
        />
      )}

      {/* Receipt modal — redesigned to match theme, all original logic preserved */}
      {showReceipt && confirmedOrder && (
        <ReceiptModal
          order={confirmedOrder}
          fmt={fmt}
          onClose={() => {
            setShowReceipt(false);
            setConfirmedOrder(null);
          }}
        />
      )}

      {/* Hidden Thermal Print Receipt — unchanged */}
      {showReceipt && confirmedOrder && (
        <div className="thermal-print-only">
          <div className="thermal-header">
            <div className="thermal-title">RESTAURANT POS</div>
            <div>Takeaway Order Receipt</div>
          </div>
          <div className="thermal-line">--------------------------------</div>
          <div>Order ID: #{confirmedOrder.id}</div>
          <div>Date: {new Date(confirmedOrder.timestamp).toLocaleDateString()}</div>
          <div>Time: {new Date(confirmedOrder.timestamp).toLocaleTimeString()}</div>
          <div>Status: Pending</div>
          <div className="thermal-line">--------------------------------</div>
          <div className="thermal-token-box">
            <div>YOUR ORDER TOKEN</div>
            <div className="thermal-token-number">{confirmedOrder.token}</div>
          </div>
          <div>Show this token to collect your order</div>
          <div className="thermal-line">--------------------------------</div>
          <div className="thermal-bold">Items:</div>
          {(confirmedOrder.items || []).map((item, idx) => (
            <div key={idx} className="thermal-item-row">
              <span>
                {item.qty || item.quantity}x {item.name}
              </span>
              <span>{fmt(item.price * (item.qty || item.quantity || 1))}</span>
            </div>
          ))}
          <div className="thermal-line">--------------------------------</div>
          <div className="thermal-total">TOTAL: {fmt(confirmedOrder.total)}</div>
          <div className="thermal-line">--------------------------------</div>
          <div className="thermal-footer">
            Thank you for your order!
            <br />
            Please show token {confirmedOrder.token} at counter
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scaleIn .25s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const SummaryCard = ({ label, value, Icon, color, delay, isLoaded }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
    style={{
      animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none',
    }}
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-bold tracking-wider text-gray-400">{label}</p>
      <div className={`w-7 h-7 rounded-lg bg-gray-50 ${color} flex items-center justify-center`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <p className={`text-2xl sm:text-3xl font-bold ${color} leading-none`}>{value}</p>
  </div>
);

const OrderCard = ({
  order,
  fmt,
  index,
  isLoaded,
  onMarkCompleted,
  onAddItems,
  onDeleteEmpty,
}) => {
  const meta = STATUS_META[statusKey(order.status)];
  const Icon = meta.Icon;
  const isEmpty = !order.items || order.items.length === 0;
  const totalSafe =
    typeof order.total === 'number' && !isNaN(order.total) ? order.total : 0;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col"
      style={{
        animation: isLoaded
          ? `slideUpFade .35s ease-out ${Math.min(index, 8) * 50}ms both`
          : 'none',
      }}
    >
      {/* Card header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-400">Order</p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900">#{order.id}</p>
            <SourceBadge source={order.source} />
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${meta.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </div>

      {/* Token badge */}
      {order.token && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <Hash className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
              Token
            </p>
            <p className="text-base font-bold text-amber-700 leading-none tracking-wider">
              {order.token}
            </p>
          </div>
        </div>
      )}

      {/* Customer label */}
      {order.table_name && (
        <div className="px-4 pt-2 pb-1">
          <p className="text-xs text-gray-400">Customer / Label</p>
          <p className="text-sm font-semibold text-gray-800">{order.table_name}</p>
        </div>
      )}

      {/* Items */}
      <div className="px-4 py-3 flex-1">
        <p className="text-xs font-semibold text-gray-400 mb-2">Items</p>
        {isEmpty ? (
          <p className="text-xs text-gray-400 italic">No items in this order yet</p>
        ) : (
          <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {order.items.map((item, idx) => {
              const qty = item.qty || item.quantity || 1;
              return (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-orange-50 text-orange-600 text-[11px] font-bold shrink-0">
                      {qty}×
                    </span>
                    <span className="text-gray-800 truncate">{item.name}</span>
                  </span>
                  <span className="text-xs font-semibold text-gray-700 shrink-0">
                    {fmt(item.price * qty)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Total + actions */}
      <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/60">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500">Total</span>
          <span className="text-lg font-bold text-gray-900">{fmt(totalSafe)}</span>
        </div>

        <div className="space-y-2">
          {order.status === 'ready' && (
            <button
              onClick={onMarkCompleted}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark as Delivered
            </button>
          )}
          {order.status === 'pending' && (
            <button
              disabled
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-600 text-sm font-semibold cursor-not-allowed"
            >
              <Clock className="w-4 h-4" />
              Waiting for kitchen
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              disabled
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-semibold cursor-not-allowed"
            >
              <Utensils className="w-4 h-4" />
              Being prepared
            </button>
          )}
          {order.status === 'NOT_AVAILABLE' && (
            <button
              onClick={onAddItems}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm font-semibold transition"
            >
              <AlertTriangle className="w-4 h-4" />
              Retry order
            </button>
          )}

          {/* Secondary actions row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onAddItems}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add items
            </button>
            {isEmpty && (
              <button
                onClick={onDeleteEmpty}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-semibold transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = ({ order, fmt, onClose }) => {
  const t = enrichOrderWithTotals(order);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[88vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-center text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold">Order Confirmed</h2>
          <p className="text-orange-100 text-xs mt-0.5">
            Your takeaway order has been placed
          </p>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Token */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              Order Token
            </p>
            <p className="text-4xl font-extrabold text-amber-700 tracking-widest my-1">
              {order.token}
            </p>
            <p className="text-[11px] text-amber-600">
              Show this token to collect your order
            </p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold">Order ID</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">#{order.id}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 font-semibold">Status</p>
              <p className="mt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Pending
                </span>
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 col-span-2">
              <p className="text-gray-400 font-semibold">Date &amp; Time</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {new Date(order.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2 tracking-wide uppercase">
              Items
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {(order.items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm"
                >
                  <span className="text-gray-700">
                    {item.qty || item.quantity}× {item.name}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {fmt(item.price * (item.qty || item.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-800">{fmt(t.subtotal)}</span>
            </div>
            {t.discountPercent > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Discount ({t.discountPercent}%)</span>
                <span className="font-semibold text-emerald-600">
                  -{fmt(t.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Tax ({t.taxPercent}%)</span>
              <span className="font-semibold text-gray-800">+{fmt(t.taxAmount)}</span>
            </div>
            <div className="flex justify-between items-center border-t-2 border-gray-100 pt-2 mt-1.5">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-xl font-extrabold text-orange-600">
                {fmt(t.total)}
              </span>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <strong>Important:</strong> Please show token{' '}
            <strong>{order.token}</strong> at the counter to collect your order.
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 p-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => {
              const printWindow = window.open('', '_blank', 'width=300,height=400');
              const subtotal =
                order.subtotal ||
                order.items?.reduce(
                  (sum, item) =>
                    sum + (item.price || 0) * (item.qty || item.quantity || 1),
                  0
                ) ||
                0;
              const discountPercent = order.discount || 0;
              const discountAmount =
                order.discountAmount || (subtotal * discountPercent) / 100;
              const afterDiscount = subtotal - discountAmount;
              const taxPercent = order.taxPercent || 5;
              const taxAmount =
                order.taxAmount || (afterDiscount * taxPercent) / 100;
              let breakdown = `<div class="item"><span>Subtotal</span><span>${fmt(
                subtotal
              )}</span></div>`;
              if (discountPercent > 0) {
                breakdown += `<div class="item"><span>Discount (${discountPercent}%)</span><span>-${fmt(
                  discountAmount
                )}</span></div>`;
              }
              breakdown += `<div class="item"><span>Tax (${taxPercent}%)</span><span>+${fmt(
                taxAmount
              )}</span></div>`;
              const receiptContent = `
                <html>
                <head>
                  <title>Takeaway Receipt #${order.id}</title>
                  <style>
                    @page { size: 80mm auto; margin: 0; }
                    body { font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; padding: 10px; width: 80mm; margin: 0 auto; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .token-box { border: 2px dashed #000; padding: 15px; margin: 15px 0; text-align: center; }
                    .token-number { font-size: 28px; font-weight: bold; }
                    .line { border-top: 1px dashed #000; margin: 8px 0; }
                    .item { display: flex; justify-content: space-between; }
                    .total { font-size: 14px; font-weight: bold; text-align: center; margin-top: 10px; }
                  </style>
                </head>
                <body>
                  <div class="center bold">RESTAURANT POS</div>
                  <div class="center">Takeaway Order Receipt</div>
                  <div class="line"></div>
                  <div>Order ID: #${order.id}</div>
                  <div>Date: ${new Date(order.timestamp).toLocaleDateString()}</div>
                  <div>Time: ${new Date(order.timestamp).toLocaleTimeString()}</div>
                  <div class="line"></div>
                  <div class="token-box">
                    <div>YOUR ORDER TOKEN</div>
                    <div class="token-number">${order.token}</div>
                  </div>
                  <div class="center">Show this token to collect your order</div>
                  <div class="line"></div>
                  <div class="bold">Items:</div>
                  ${(order.items || [])
                    .map(
                      (item) => `
                    <div class="item">
                      <span>${item.qty || item.quantity}x ${item.name}</span>
                      <span>${fmt(
                        item.price * (item.qty || item.quantity || 1)
                      )}</span>
                    </div>
                  `
                    )
                    .join('')}
                  <div class="line"></div>
                  ${breakdown}
                  <div class="line"></div>
                  <div class="total">TOTAL: ${fmt(order.total)}</div>
                  <div class="line"></div>
                  <div class="center">Thank you for your order!</div>
                  <div class="center">Please show token ${order.token} at counter</div>
                </body>
                </html>
              `;
              printWindow.document.write(receiptContent);
              printWindow.document.close();
              printWindow.focus();
              setTimeout(() => {
                printWindow.print();
                printWindow.close();
              }, 250);
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-semibold shadow-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakeawayManagement;
