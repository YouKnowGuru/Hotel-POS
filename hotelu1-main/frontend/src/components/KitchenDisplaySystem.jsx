import React, { useState, useEffect, useRef } from 'react';
import Notification from './Notification';
import {
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Flame,
  ArrowRight,
  Check,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  playNewOrderBell,
  playTestBell,
  getSoundSettings,
  setSoundEnabled,
  primeAudio,
} from '../utils/notificationSound';
import { authFetch, getSocketUrl } from '../utils/api';
import { io } from 'socket.io-client';
import { getLocationSettingsForCountry } from '../utils/currency';
import useCurrency from '../hooks/useCurrency';
import {
  canRoleAccessModule,
  fetchPermissionsMatrixFromServer,
} from '../utils/permissions';
import SourceBadge from './SourceBadge';

/* ===============================================================
   Kitchen Display — visual redesign only
   All API calls, polling, permission rules preserved.
   =============================================================== */

const KitchenDisplaySystem = ({ locationSettings: locationSettingsProp }) => {
  const locationSettings =
    locationSettingsProp ||
    getLocationSettingsForCountry(localStorage.getItem('posCountry') || 'Bhutan');
  const { format: fmt } = useCurrency(locationSettings);

  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [socket, setSocket] = useState(null);
  const [soundOn, setSoundOn] = useState(() => getSoundSettings().enabled);
  const [pulseId, setPulseId] = useState(null);

  // Remember the IDs we've already seen so the polling loop only rings
  // for genuinely new orders (not for every refresh).
  const knownOrderIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  const announceNewOrder = (order) => {
    playNewOrderBell();
    const tableLabel = order?.table_name || order?.customer_name || 'Counter';
    setNotification({
      message: `New order #${order?.id ?? ''} — ${tableLabel}`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 3500);
    if (order?.id != null) {
      setPulseId(order.id);
      setTimeout(() => setPulseId((cur) => (cur === order.id ? null : cur)), 4500);
    }
  };

  /* ----------------------- Effects ----------------------- */
  useEffect(() => {
    fetchPermissions();
    fetchOrders();

    // Make sure we have the latest Module Permissions Matrix the admin
    // configured. Falls back silently to cached localStorage if offline.
    fetchPermissionsMatrixFromServer().catch(() => {});

    const newSocket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') } });
    setSocket(newSocket);

    // Socket-driven path:
    //   - If the server includes the order in the payload, ring + add
    //     `id:N` to the known set so the upcoming poll won't re-ring.
    //   - If the server didn't include a payload (the regular POS
    //     /api/orders endpoint emits the event name only), just kick
    //     off a refetch and let the polling diff ring the bell once.
    //     This guarantees exactly one ring per new order, no matter
    //     which code path created it.
    const handleNewOrder = (order) => {
      if (order && order.id != null) {
        const key = `id:${order.id}`;
        if (knownOrderIdsRef.current.has(key)) return;
        knownOrderIdsRef.current.add(key);
        announceNewOrder(order);
      }
      fetchOrders();
    };
    newSocket.on('new_order', handleNewOrder);
    newSocket.on('order_created', handleNewOrder);

    // Kitchen updates arrive instantly via socket events; this poll is the
    // fallback only. 5s keeps the DB load sane on free-tier hosting.
    const orderInterval = setInterval(fetchOrders, 7000);
    // Permissions change rarely; polling them every few seconds just burned
    // DB cycles on every KDS terminal. 60s is plenty responsive here, and
    // the page also refetches on window focus via the socket handlers.
    const permissionInterval = setInterval(fetchPermissions, 60000);

    return () => {
      clearInterval(orderInterval);
      clearInterval(permissionInterval);
      newSocket.off('new_order', handleNewOrder);
      newSocket.off('order_created', handleNewOrder);
      newSocket.disconnect();
    };
    // eslint-disable-next-line
  }, []);

  /* ----------------------- Data ----------------------- */
  const fetchPermissions = async () => {
    try {
      const response = await authFetch('/api/my-permissions');
      const data = await response.json();
      setPermissions(data.permissions || []);
      setUserRole(data.role || '');
    } catch (err) {
      console.error('Error loading permissions:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      // The KDS only renders pending/preparing/ready. Filtering server-side
      // keeps the poll payload bounded; the client-side filter below remains
      // as a safety net for payment-gated QR orders.
      const response = await authFetch('/api/orders?status=pending,preparing,ready&limit=200');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const kitchenOrders = data.filter(
        (o) =>
          // QR orders are intentionally hidden until payment is approved.
          !['awaiting_payment', 'verification_pending', 'rejected'].includes(o.payment_status) &&
          o.status !== 'completed' &&
          o.status !== 'NOT_AVAILABLE' &&
          o.status !== 'delivered' &&
          o.items &&
          o.items.length > 0
      );

      // Bell-on-poll: first load seeds the "known IDs" set without
      // ringing. Subsequent polls ring once for any unseen ID — used
      // as a fallback in case the socket missed the event.
      if (!initialLoadDoneRef.current) {
        kitchenOrders.forEach((o) =>
          knownOrderIdsRef.current.add(`id:${o.id}`)
        );
        initialLoadDoneRef.current = true;
      } else {
        kitchenOrders.forEach((o) => {
          const key = `id:${o.id}`;
          if (!knownOrderIdsRef.current.has(key)) {
            knownOrderIdsRef.current.add(key);
            announceNewOrder(o);
          }
        });
      }

      setOrders(kitchenOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      if (err.message && !err.message.includes('401')) {
        setNotification({
          message: 'Error loading orders. Backend may be unavailable.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 3000);
      }
    }
  };

  /**
   * Decide whether the current user can perform a kitchen action.
   *
   * Priority:
   *   1. `admin` always passes.
   *   2. Staff roles (manager / waiter / cashier) pass if the
   *      admin gave their role access to the `kitchen_display` module
   *      in the Module Permissions Matrix. This is the same source of
   *      truth that gates the sidebar and the route guards, so the
   *      buttons stay in sync with what the admin actually configured.
   *   3. Otherwise fall back to the legacy server-issued permission
   *      codes (`mark_order_preparing`, `mark_order_ready`,
   *      `confirm_order_delivery`) for backward compatibility with
   *      franchise / sub-franchise / custom roles.
   */
  const hasPermission = (perm) => {
    const role = String(userRole || '').toLowerCase();
    if (role === 'admin') return true;

    // Quick hack for module-based access if backend permissions aren't fully synced
    if (canRoleAccessModule(role, 'kitchen_display')) {
      if (role === 'waiter') {
        if (perm === 'confirm_order_delivery') return true;
      } else if (role === 'manager') {
        if (perm === 'mark_order_preparing' || perm === 'mark_order_ready' || perm === 'confirm_order_delivery') return true;
      } else {
        // Any other role with kitchen_display access can mark preparing/ready
        if (perm === 'mark_order_preparing' || perm === 'mark_order_ready') return true;
      }
    }

    return permissions.includes('*') || permissions.includes(perm);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    if (newStatus === 'preparing' && !hasPermission('mark_order_preparing')) {
      setNotification({ message: 'No permission to mark as preparing', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (newStatus === 'ready' && !hasPermission('mark_order_ready')) {
      setNotification({ message: 'No permission to mark as ready', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (newStatus === 'completed' && !hasPermission('confirm_order_delivery')) {
      setNotification({ message: 'No permission to confirm delivery', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      let response;
      if (newStatus === 'NOT_AVAILABLE') {
        response = await authFetch(`/api/orders/${orderId}/not-available`, {
          method: 'PUT',
          body: JSON.stringify({}),
        });
      } else if (newStatus === 'completed') {
        response = await authFetch(`/api/orders/${orderId}/confirm-delivery`, {
          method: 'PUT',
          body: JSON.stringify({ tax_rate: 0.05 }),
        });
        newStatus = 'delivered';
        if (socket) socket.emit('order_status_updated', { orderId, newStatus: 'delivered' });
      } else {
        response = await authFetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        });
        if (socket && newStatus !== 'delivered') {
          socket.emit('order_status_updated', { orderId, newStatus });
        }
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to update');
      }

      if (newStatus === 'NOT_AVAILABLE' || newStatus === 'delivered') {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      }

      setNotification({
        message:
          newStatus === 'delivered'
            ? `Order #${orderId} served — bill generated`
            : `Order #${orderId} → ${newStatus.toUpperCase()}`,
        type: 'success',
      });
    } catch (err) {
      console.error('Update status error:', err);
      setNotification({ message: err.message || 'Could not update order', type: 'error' });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRemoveItem = async (orderId, itemIndex, itemName) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
      const newTotal = updatedItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (item.qty || item.quantity || 1),
        0
      );
      const response = await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ items: updatedItems, total: newTotal }),
      });
      if (!response.ok) throw new Error('Failed');
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, items: updatedItems, total: newTotal } : o))
      );
      setNotification({ message: `${itemName} removed`, type: 'success' });
      setTimeout(() => setNotification(null), 2500);
    } catch (err) {
      setNotification({ message: 'Error removing item', type: 'error' });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  /* ----------------------- Derived ----------------------- */
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const activeCount = orders.length;

  /* ----------------------- Urgency ----------------------- */
  const getUrgency = (order) => {
    const minutes = Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000);
    if (minutes >= 15) return { label: 'URGENT', cls: 'bg-rose-50 text-rose-600' };
    if (minutes >= 8) return { label: 'HIGH', cls: 'bg-orange-50 text-orange-600' };
    return { label: 'NORMAL', cls: 'bg-blue-50 text-blue-600' };
  };

  /* ----------------------- Card ----------------------- */
  const OrderCard = ({ order, onStatusChange }) => {
    const urgency = getUrgency(order);
    const minutes = Math.floor((Date.now() - new Date(order.timestamp).getTime()) / 60000);
    const seconds = Math.floor(((Date.now() - new Date(order.timestamp).getTime()) % 60000) / 1000);
    const timer = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const isPulsing = pulseId != null && Number(pulseId) === Number(order.id);
    return (
      <div
        className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${
          isPulsing
            ? 'border-orange-300 ring-2 ring-orange-200 shadow-orange-100 shadow-lg animate-pulse'
            : 'border-gray-100'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">
              #{order.id}{' '}
              <span className="ml-1 text-[11px] font-bold text-gray-400 uppercase">
                {order.table_name || 'Counter'}
              </span>
            </p>
            {order.source && <SourceBadge source={order.source} className="mt-1" />}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${urgency.cls}`}>
            {urgency.label}
          </span>
        </div>

        <ul className="space-y-2 mb-3">
          {(order.items || []).map((item, idx) => {
            const removable = order.status === 'pending';
            return (
              <li key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {item.qty || item.quantity || 1}x
                  </span>
                  <span className="truncate text-gray-700">{item.name}</span>
                </div>
                {removable ? (
                  <button
                    onClick={() => handleRemoveItem(order.id, idx, item.name)}
                    className="w-6 h-6 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100"
                    title="Mark not available / remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-orange-500 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {timer}
          </span>

          {order.status === 'pending' && hasPermission('mark_order_preparing') && (
            <button
              onClick={() => onStatusChange(order.id, 'preparing')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-sm"
            >
              Start <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {order.status === 'preparing' && hasPermission('mark_order_ready') && (
            <button
              onClick={() => onStatusChange(order.id, 'ready')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm"
            >
              Ready <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {order.status === 'ready' && hasPermission('confirm_order_delivery') && (
            <button
              onClick={() => onStatusChange(order.id, 'completed')}
              className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold shadow-sm"
            >
              Served <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  /* ----------------------- Column ----------------------- */
  const Column = ({ title, icon: Icon, accent, orders: list, emptyText }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accent.text}`} />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${accent.text}`}>{title}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accent.bg} ${accent.text}`}>
          {list.length}
        </span>
      </div>

      <div className={`h-px ${accent.divider} mb-4`} />

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
              <Icon className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400">{emptyText}</p>
          </div>
        ) : (
          list.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChange={handleUpdateOrderStatus} />
          ))
        )}
      </div>
    </div>
  );

  /* ----------------------- Render ----------------------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Kitchen Operations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time order management and fulfillment KDS board
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              primeAudio();
              playTestBell();
            }}
            title="Play a test alarm so you can verify your speakers/volume"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border bg-orange-500 hover:bg-orange-600 text-white border-orange-600 text-sm font-bold shadow-sm transition"
          >
            <Bell className="w-4 h-4" />
            Test bell
          </button>
          <button
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
              if (next) {
                primeAudio();
                playNewOrderBell();
              }
            }}
            title={
              soundOn
                ? 'Bell sound is ON — tap to mute'
                : 'Bell sound is OFF — tap to enable'
            }
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition ${
              soundOn
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {soundOn ? 'Sound on' : 'Sound off'}
          </button>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-semibold">{activeCount} ACTIVE ORDERS</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Column
          title="Pending"
          icon={AlertCircle}
          accent={{ text: 'text-amber-500', bg: 'bg-amber-50', divider: 'bg-amber-100' }}
          orders={pendingOrders}
          emptyText="No orders in this phase"
        />
        <Column
          title="Preparing"
          icon={Flame}
          accent={{ text: 'text-orange-500', bg: 'bg-orange-50', divider: 'bg-orange-100' }}
          orders={preparingOrders}
          emptyText="No orders in this phase"
        />
        <Column
          title="Ready"
          icon={CheckCircle2}
          accent={{ text: 'text-emerald-500', bg: 'bg-emerald-50', divider: 'bg-emerald-100' }}
          orders={readyOrders}
          emptyText="No orders in this phase"
        />
      </div>
    </div>
  );
};

export default KitchenDisplaySystem;
