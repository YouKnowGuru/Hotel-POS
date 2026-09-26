import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAPI_URL, getSocketUrl, authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import { Bell, CheckCircle2, Clock, Utensils, Banknote } from 'lucide-react';

const WaiterDeliveryPanel = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [readyOrders, setReadyOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [delivering, setDelivering] = useState({});
  const [newAlert, setNewAlert] = useState(null);
  const prevIdsRef = useRef(new Set());
  const socketRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchReadyOrders = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders');
      const data = res.ok ? await res.json() : [];
      const ready = Array.isArray(data)
        ? data.filter(
            (o) =>
              String(o.status || '').toLowerCase() === 'ready' &&
              String(o.type || '').toUpperCase() !== 'TAKEAWAY'
          )
        : [];

      // Detect newly ready orders and show an alert
      const newIds = new Set(ready.map((o) => o.id));
      const brandNew = ready.filter((o) => !prevIdsRef.current.has(o.id));
      if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
        setNewAlert(brandNew[0]);
        setTimeout(() => setNewAlert(null), 6000);
      }
      prevIdsRef.current = newIds;
      setReadyOrders(ready);
    } catch {
      // keep previous list
    }
  }, []);

  useEffect(() => {
    fetchReadyOrders();
    const poll = setInterval(fetchReadyOrders, 5000);

    try {
      const socket = io(getSocketUrl(), {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;
      socket.on('order_status_updated', fetchReadyOrders);
      socket.on('order_created', fetchReadyOrders);
      socket.on('new_order', fetchReadyOrders);
    } catch {
      /* non-fatal */
    }

    return () => {
      clearInterval(poll);
      if (socketRef.current) {
        socketRef.current.off('order_status_updated', fetchReadyOrders);
        socketRef.current.off('order_created', fetchReadyOrders);
        socketRef.current.off('new_order', fetchReadyOrders);
        socketRef.current.disconnect();
      }
    };
  }, [fetchReadyOrders]);

  const handleConfirmDelivery = async (orderId, collectCash = false) => {
    setDelivering((p) => ({ ...p, [orderId]: true }));
    try {
      const res = await authFetch(`/api/orders/${orderId}/confirm-delivery`, {
        method: 'PUT',
        body: JSON.stringify({
          tax_rate: locationSettings?.taxRate || 0.05,
          collect_cash: collectCash,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setReadyOrders((p) => p.filter((o) => o.id !== orderId));
      showToast(
        collectCash
          ? `Order #${orderId} delivered & cash collected ✓`
          : `Order #${orderId} marked as served ✓`
      );
    } catch {
      showToast('Could not confirm delivery. Try again.', 'error');
    } finally {
      setDelivering((p) => ({ ...p, [orderId]: false }));
    }
  };

  const minsAgo = (ts) =>
    Math.max(0, Math.round((Date.now() - new Date(ts || Date.now()).getTime()) / 60000));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Utensils className="w-7 h-7 text-orange-500" />
            Waiter Panel
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {readyOrders.length === 0
              ? 'No orders ready — waiting for approved orders…'
              : `${readyOrders.length} order${readyOrders.length > 1 ? 's' : ''} ready to serve`}
          </p>
        </div>

        {/* Live badge */}
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Toast notification */}
      {notification && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
            notification.type === 'error'
              ? 'bg-rose-500 text-white'
              : 'bg-emerald-500 text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notification.msg}
        </div>
      )}

      {/* NEW ORDER ALERT BANNER */}
      {newAlert && (
        <div className="mb-5 rounded-2xl border-2 border-orange-400 bg-orange-50 p-4 flex items-center gap-4 animate-pulse-soft shadow-md shadow-orange-100">
          <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-orange-700 text-sm">
              🔔 Order #{newAlert.id} — Table {newAlert.table_name} is READY!
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              Order approved by admin. Please serve the food now.
            </p>
          </div>
          <button
            onClick={() => handleConfirmDelivery(newAlert.id)}
            className="shrink-0 px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition"
          >
            Served ✓
          </button>
        </div>
      )}

      {/* Orders grid */}
      {readyOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-50 text-orange-400 flex items-center justify-center mx-auto mb-4">
            <Utensils className="w-8 h-8" />
          </div>
          <p className="text-gray-700 font-semibold">No orders ready yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Orders will appear here as soon as admin approves them
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyOrders.map((order) => {
            const mins = minsAgo(order.updated_at || order.timestamp);
            const isDelivering = delivering[order.id];
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex flex-col ring-1 ring-emerald-100"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold">Order #{order.id}</p>
                    <p className="text-lg font-bold text-gray-900">
                      Table {order.table_name || 'Counter'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    READY
                  </span>
                </div>

                {/* Time */}
                <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Ready {mins} min ago
                </p>

                {/* Items */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 flex-1">
                  <ul className="space-y-1.5">
                    {(order.items || []).map((item, idx) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold text-orange-500 mr-1">
                            {item.quantity || item.qty || 1}x
                          </span>
                          {item.name}
                        </span>
                        <span className="text-gray-500 text-xs">{fmt(item.price)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-sm font-bold text-gray-900">
                    <span>Total</span>
                    <span>{fmt(order.total)}</span>
                  </div>
                </div>

                {/* Cash payment notice for waiter if cash pending */}
                {order.payment_method === 'cash' && order.payment_status === 'cash_pending' && (
                  <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-800 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-amber-600" /> Collect Cash:
                    </span>
                    <span className="font-bold text-amber-900 text-sm">{fmt(order.total)}</span>
                  </div>
                )}

                {/* Actions */}
                {order.payment_method === 'cash' && order.payment_status === 'cash_pending' ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleConfirmDelivery(order.id, true)}
                      disabled={isDelivering}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 transition disabled:opacity-60"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      {isDelivering ? 'Saving…' : `Collect ${fmt(order.total)} & Mark Served`}
                    </button>
                    <button
                      onClick={() => handleConfirmDelivery(order.id, false)}
                      disabled={isDelivering}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
                      Mark Served Only (Customer Pays Later)
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConfirmDelivery(order.id, false)}
                    disabled={isDelivering}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isDelivering ? 'Marking served…' : 'Mark as Served'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: .95; }
        }
        .animate-pulse-soft { animation: pulseSoft 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default WaiterDeliveryPanel;


