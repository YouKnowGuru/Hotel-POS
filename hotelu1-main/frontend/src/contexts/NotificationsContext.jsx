import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { io } from 'socket.io-client';
import { authFetch, getSocketUrl } from '../utils/api';

const NotificationsContext = createContext(null);

const READ_KEY = 'notifications_read_ids_v1';
const DISMISSED_KEY = 'notifications_dismissed_ids_v1';

const loadSet = (key) => {
  try {
    const s = localStorage.getItem(key);
    if (!s) return new Set();
    const parsed = JSON.parse(s);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveSet = (key, set) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore quota errors
  }
};

const fmtAgo = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
};

const todayDateStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const buildOrderNotifications = (orders) => {
  const out = [];
  (orders || []).forEach((o) => {
    if (!o || !o.id) return;
    const status = String(o.status || '').toLowerCase();
    const ts =
      o.timestamp || o.created_at || o.updated_at || new Date().toISOString();
    const baseId = `order-${o.id}`;
    const tableLabel =
      o.table_name ||
      (String(o.type).toUpperCase() === 'TAKEAWAY' ? 'Takeaway' : 'Order');
    const total = Number(o.total) || 0;

    if (status === 'pending') {
      out.push({
        id: `${baseId}-new`,
        category: 'order',
        type: 'new-order',
        severity: 'success',
        title:
          String(o.type).toUpperCase() === 'TAKEAWAY'
            ? 'New Takeaway Order'
            : 'New Table Order Placed',
        message: `Order #${o.id} has been placed for ${tableLabel}. Total: Nu. ${total.toFixed(2)}.`,
        timestamp: ts,
      });
    }

    if (status === 'preparing') {
      const orderTimeMs = new Date(ts).getTime();
      if (Number.isFinite(orderTimeMs)) {
        const delayMin = Math.floor((Date.now() - orderTimeMs) / 60000);
        if (delayMin >= 45) {
          out.push({
            id: `${baseId}-delay`,
            category: 'order',
            type: 'kitchen-delay',
            severity: 'warning',
            title: 'Kitchen Delay Warning',
            message: `${tableLabel} order (#${o.id}) has been in 'Preparing' state for over ${delayMin} minutes.`,
            timestamp: ts,
          });
        }
      }
    }

    if (status === 'ready') {
      out.push({
        id: `${baseId}-ready`,
        category: 'order',
        type: 'order-ready',
        severity: 'info',
        title: 'Order Ready for Pickup',
        message: `Order #${o.id} for ${tableLabel} is ready to be served.`,
        timestamp: ts,
      });
    }
  });
  return out;
};

const buildInventoryNotifications = (items) => {
  return (items || [])
    .filter((i) => {
      const cur = Number(i.current_stock);
      const min = Number(i.min_stock);
      return Number.isFinite(cur) && Number.isFinite(min) && cur <= min;
    })
    .map((i) => {
      const cur = Number(i.current_stock);
      const out = cur === 0;
      return {
        id: `inventory-${i.id}-low`,
        category: 'inventory',
        type: out ? 'out-of-stock' : 'low-stock',
        severity: out ? 'critical' : 'warning',
        title: out ? 'Out of Stock Alert' : 'Critical Low Stock Alert',
        message: `${i.material_name} is below minimum stock level. Current: ${i.current_stock} ${i.unit || 'units'}, Min Required: ${i.min_stock} ${i.unit || 'units'}.`,
        timestamp: i.updated_at || i.updatedAt || new Date().toISOString(),
      };
    });
};

const SYSTEM_NOTIFICATIONS = [
  {
    id: 'system-update-2026-05',
    category: 'system',
    type: 'system-update',
    severity: 'info',
    title: 'System Update Complete',
    message:
      'POS dashboard has been updated with new analytics, settings, and notification modules.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'security-login-admin',
    category: 'security',
    type: 'admin-login',
    severity: 'info',
    title: 'New Administrator Login',
    message: 'An administrator account has signed in to the dashboard.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

export const NotificationsProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [readIds, setReadIds] = useState(() => loadSet(READ_KEY));
  const [dismissedIds, setDismissedIds] = useState(() => loadSet(DISMISSED_KEY));
  // tick state used to refresh relative-time labels every 30s
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const date = todayDateStr();
      const res = await authFetch(`/api/orders?startDate=${date}&endDate=${date}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      // ignore network errors silently — notifications fall back to last data
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    try {
      const res = await authFetch('/api/inventory');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setInventory(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Only fetch when there's a token (logged in)
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    fetchOrders();
    fetchInventory();

    const orderInt = setInterval(fetchOrders, 10000);
    const invInt = setInterval(fetchInventory, 30000);

    let socket = null;
    try {
      socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], auth: { token: localStorage.getItem('token') } });
      socket.on('order_created', fetchOrders);
      socket.on('order_status_updated', fetchOrders);
      socket.on('order_deleted', fetchOrders);
      socket.on('inventory_updated', fetchInventory);
    } catch {
      // socket failure is non-fatal — polling still works
    }

    return () => {
      clearInterval(orderInt);
      clearInterval(invInt);
      if (socket) {
        try {
          socket.disconnect();
        } catch {
          /* noop */
        }
      }
    };
  }, [fetchOrders, fetchInventory]);

  const notifications = useMemo(() => {
    void tick; // ensures time labels recompute
    const orderNs = buildOrderNotifications(orders);
    const invNs = buildInventoryNotifications(inventory);
    const merged = [...orderNs, ...invNs, ...SYSTEM_NOTIFICATIONS];
    return merged
      .filter((n) => !dismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        unread: !readIds.has(n.id),
        timeAgo: fmtAgo(n.timestamp),
      }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [orders, inventory, readIds, dismissedIds, tick]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const counts = useMemo(() => {
    const acc = {
      all: notifications.length,
      order: 0,
      inventory: 0,
      system: 0,
      security: 0,
    };
    notifications.forEach((n) => {
      if (acc[n.category] !== undefined) acc[n.category] += 1;
    });
    return acc;
  }, [notifications]);

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(READ_KEY, next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveSet(READ_KEY, next);
      return next;
    });
  }, [notifications]);

  const dismiss = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(DISMISSED_KEY, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveSet(DISMISSED_KEY, next);
      return next;
    });
  }, [notifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      counts,
      markAsRead,
      markAllAsRead,
      dismiss,
      clearAll,
    }),
    [notifications, unreadCount, counts, markAsRead, markAllAsRead, dismiss, clearAll]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      notifications: [],
      unreadCount: 0,
      counts: { all: 0, order: 0, inventory: 0, system: 0, security: 0 },
      markAsRead: () => {},
      markAllAsRead: () => {},
      dismiss: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
};

export default NotificationsContext;
