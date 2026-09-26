import React, { useState, useEffect, useRef } from 'react';
import { getAPI_URL, getSocketUrl } from '../utils/api';
import { getLocationSettingsForCountry } from '../utils/currency';
import useCurrency from '../hooks/useCurrency';
import { io } from 'socket.io-client';
import {
  playOrderReadyBell,
  primeAudio,
  getSoundSettings,
  setSoundEnabled,
} from '../utils/notificationSound';

const CustomerOrderTracker = ({ orderId, tableId, locationSettings: locationSettingsProp }) => {
  const locationSettings =
    locationSettingsProp ||
    getLocationSettingsForCountry(localStorage.getItem('posCountry') || 'Bhutan');
  const { format: fmt } = useCurrency(locationSettings);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundOn, setSoundOn] = useState(() => getSoundSettings().enabled);
  const [readyBanner, setReadyBanner] = useState(false);

  // Track the last known status so we ring the bell exactly once on the
  // pending/preparing → ready transition (not on every poll while
  // status is still 'ready').
  const lastStatusRef = useRef(null);

  // Customers tap "Place order" before reaching this screen, which is
  // the user gesture that unlocks audio on iOS/Android browsers. Prime
  // here so the first server-pushed "ready" event isn't silently
  // dropped by the autoplay policy.
  useEffect(() => {
    primeAudio();
  }, []);

  useEffect(() => {
    fetchOrderStatus();
    const interval = setInterval(fetchOrderStatus, 2000); // Refresh every 2 seconds

    // Also subscribe to socket so customers get the bell the instant
    // the kitchen hits "Mark Ready" — without waiting up to 2 s for the
    // next poll.
    let socket = null;
    try {
      socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socket.on('order_status_updated', (payload) => {
        if (!payload) return;
        const matchedId =
          Number(payload.orderId ?? payload.id) === Number(orderId);
        // Backend emits the new status under different keys depending
        // on which endpoint fired the event — `status`, `newStatus` or
        // (for the dine-in flow) inside `payload.order.status`.
        const newStatus =
          payload.status ??
          payload.newStatus ??
          payload.order?.status ??
          null;
        if (matchedId && newStatus === 'ready') {
          handleOrderReady();
        }
      });
    } catch {
      /* socket unavailable — polling will still catch the change */
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        try {
          socket.disconnect();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line
  }, [orderId]);

  const handleOrderReady = () => {
    playOrderReadyBell();
    setReadyBanner(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([180, 80, 180, 80, 240]);
      } catch {
        /* noop */
      }
    }
    setTimeout(() => setReadyBanner(false), 8000);
  };

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch(`${getAPI_URL()}/api/orders?table_name=${tableId}`);
      const orders = await response.json();
      const currentOrder = orders.find(o => o.id === orderId);
      if (currentOrder) {
        // Detect pending/preparing → ready transition via polling too.
        const prev = lastStatusRef.current;
        if (prev && prev !== 'ready' && currentOrder.status === 'ready') {
          handleOrderReady();
        }
        lastStatusRef.current = currentOrder.status;
        setOrder(currentOrder);
      }
    } catch (error) {
      console.error('Error fetching order status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading order status...</div>;
  }

  if (!order) {
    return <div className="text-center py-8 text-gray-600">Order not found</div>;
  }

  const statusConfig = {
    pending: { color: 'bg-orange-50', textColor: 'text-orange-800', icon: '⏳', label: 'Order Received', nextStep: 'Awaiting admin approval' },
    preparing: { color: 'bg-emerald-50', textColor: 'text-emerald-800', icon: '✅', label: 'Approved', nextStep: 'Your order is approved and with the waiter' },
    ready: { color: 'bg-green-100', textColor: 'text-green-800', icon: '✅', label: 'Ready to Serve', nextStep: 'Your order is ready! A waiter is coming to deliver it.' },
    delivered: { color: 'bg-purple-100', textColor: 'text-purple-800', icon: '🚚', label: 'On the Way', nextStep: 'Your order is being delivered to your table!' },
    completed: { color: 'bg-purple-100', textColor: 'text-purple-800', icon: '🎉', label: 'Completed', nextStep: 'Thank you for your order!' }
  };

  const currentStatus = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Ready banner — shows for 8s after the kitchen marks the order ready */}
      {readyBanner && (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white p-4 shadow-lg flex items-center gap-3 animate-pulse">
          <div className="text-3xl">🔔</div>
          <div className="flex-1">
            <p className="font-extrabold text-lg leading-tight">Your order is ready!</p>
            <p className="text-sm opacity-95">A waiter is on the way to serve your food.</p>
          </div>
          <button
            onClick={() => setReadyBanner(false)}
            className="ml-2 text-white/80 hover:text-white text-xl leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Sound toggle — tiny pill above the header so customers can mute */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
            if (next) {
              primeAudio();
              playOrderReadyBell();
            }
          }}
          className={`text-[11px] font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
            soundOn
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}
        >
          {soundOn ? '🔔 Bell on' : '🔕 Bell off'}
        </button>
      </div>

      {/* Order Header */}
      <div className={`${currentStatus.color} ${currentStatus.textColor} rounded-lg p-6 mb-6 shadow-lg`}>
        <div className="text-center">
          <div className="text-5xl mb-2">{currentStatus.icon}</div>
          <h3 className="text-2xl font-bold mb-1">{currentStatus.label}</h3>
          <p className="text-sm opacity-90">Order #{order.id} • Table {order.table_name}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
          <span>Received</span>
          <span>Approved / Waiter</span>
          <span>Delivered</span>
        </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-orange-400 h-2 rounded-full transition-all duration-300"
            style={{
              width: order.status === 'pending' ? '25%' : 
                     (order.status === 'ready' || order.status === 'preparing') ? '70%' : 
                     order.status === 'delivered' ? '95%' : '100%'
            }}
          ></div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md">
        <h4 className="font-bold text-gray-800 mb-3 text-lg">Your Order</h4>
        <div className="space-y-2">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-center border-b pb-2 last:border-b-0">
              <span className="text-gray-700">
                <span className="font-semibold">{item.qty || item.quantity}x</span> {item.name}
              </span>
              <span className="text-gray-600 font-semibold">{fmt(item.price * (item.qty || item.quantity))}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 mt-3 flex justify-between items-center font-bold text-lg">
          <span>Total:</span>
          <span className="text-orange-600">{fmt(order.total)}</span>
        </div>
      </div>

      {/* Status Message */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 text-center border border-orange-200">
        <p className="text-gray-700 font-semibold mb-2">{currentStatus.nextStep}</p>
        <p className="text-sm text-gray-600">
          {order.status === 'pending' && '⏳ Your order has been received and is awaiting admin approval.'}
          {(order.status === 'ready' || order.status === 'preparing') && '✅ Your order is approved! A waiter is coming to deliver it.'}
          {order.status === 'delivered' && '🚚 Your order is on the way to your table!'}
          {order.status === 'completed' && '🎉 We hope you enjoyed your meal. Thank you!'}
        </p>
      </div>

      {/* Estimated Time */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <p>Order placed at: {new Date(order.timestamp).toLocaleTimeString()}</p>
      </div>

      {/* Auto-refresh toggle */}
      <div className="mt-4 flex items-center justify-center">
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-xs text-orange-600 hover:text-orange-800 underline"
        >
          {autoRefresh ? '🔄 Auto-refreshing' : '⏸ Auto-refresh off'}
        </button>
      </div>
    </div>
  );
};

export default CustomerOrderTracker;
