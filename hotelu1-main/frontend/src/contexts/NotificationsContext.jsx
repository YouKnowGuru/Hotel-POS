/* ------------------------------------------------------------------ */
/*  Staff notification centre                                          */
/*                                                                     */
/*  Why this was rewritten:                                             */
/*   - The old provider derived every alert in the browser from TODAY's  */
/*     /api/orders. A "New order" alert vanished as soon as the kitchen  */
/*     changed the status, and there was no history at all.              */
/*   - It read localStorage.token ONCE at mount with stable deps, so an  */
/*     SPA login never opened the socket — staff saw nothing until a      */
/*     hard reload ("login dead zone").                                  */
/*   - Nothing ever called playNewOrderBell(), and no socket event for    */
/*     inventory was ever emitted.                                       */
/*                                                                     */
/*  Now:                                                                */
/*   - The backend owns a persistent, deduplicated event feed            */
/*     (/api/notifications) with per-staff read/dismiss state.            */
/*   - ONE canonical order_placed event fires for EVERY creation path    */
/*     (including payment-first orders), and rings the bell instantly.    */
/*   - A fast 6s poll is a fallback so an order is still alerted if the  */
/*     socket drops; a localStorage ring marker guarantees one bell per   */
/*     order per device, never a duplicate burst.                        */
/*   - Low stock / kitchen delay stay *derived* live conditions (they    */
/*     must clear themselves when the underlying data changes).           */
/*   - System & security categories are fed by real staff socket events.  */
/* ------------------------------------------------------------------ */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Bell,
  X,
  ShoppingBag,
  CreditCard,
  Receipt,
  Package,
} from 'lucide-react';
import { authFetch, getSocketUrl } from '../utils/api';
import {
  playNewOrderBell,
  playWaiterBell,
  playTestBell,
  primeAudio,
  getSoundSettings,
  setSoundEnabled as persistSoundEnabled,
  setSoundVolume as persistSoundVolume,
} from '../utils/notificationSound';

const NotificationsContext = createContext(null);

const READ_KEY = 'notifications_read_ids_v2';
const DISMISSED_KEY = 'notifications_dismissed_ids_v2';
const EVENTS_KEY = 'notifications_local_events_v2';
const RANG_PREFIX = 'notifications_rang_v2:';
const DESKTOP_KEY = 'notifications_desktop_v1';
const PREFS_EVENT = 'notification-prefs-changed';

const POLL_FEED_MS = 6000;   // fast fallback for guaranteed delivery
const POLL_ORDER_MS = 15000; // derived kitchen-delay condition
const POLL_INV_MS = 30000;   // derived low-stock condition
const RECENT_WINDOW_MS = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Small storage helpers                                              */
/* ------------------------------------------------------------------ */

const loadSet = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveSet = (key, set) => {
  try {
    // Keep the marker sets bounded — they only exist for derived/local alerts.
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-800)));
  } catch {
    /* quota / private mode — UI still works for this session */
  }
};

const loadEvents = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && e.id && e.title && e.message)
      : [];
  } catch {
    return [];
  }
};

const saveEvents = (list) => {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
};

/**
 * One bell per order per device, across duplicated socket paths, a
 * reconnect replay, and the polling fallback. Old markers are pruned so
 * localStorage never grows without bound.
 */
const ringOnce = (key) => {
  const storageKey = `${RANG_PREFIX}${key}`;
  try {
    if (localStorage.getItem(storageKey)) return false;
    localStorage.setItem(storageKey, String(Date.now()));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(RANG_PREFIX)) continue;
      const at = Number(localStorage.getItem(k));
      if (!Number.isFinite(at) || at < cutoff) localStorage.removeItem(k);
    }
  } catch {
    /* storage disabled — allow the bell */
  }
  return true;
};

const isRecent = (iso) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= Date.now() + 60000 && Date.now() - t < RECENT_WINDOW_MS;
};

const notifyDesktop = (title, body, enabledRef) => {
  if (!enabledRef.current) return;
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;
    // A visible tab already gets the in-app toast + bell; desktop
    // notifications are for staff who switched to another tab/app.
    if (document.visibilityState === 'visible') return;
    const n = new window.Notification(title, {
      body,
      tag: 'pos-staff-alert',
      icon: '/favicon.ico',
    });
    setTimeout(() => {
      try { n.close(); } catch { /* noop */ }
    }, 10000);
  } catch {
    /* desktop notifications unsupported */
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

/* ------------------------------------------------------------------ */
/*  Derived (live-condition) alerts — these MUST clear themselves       */
/* ------------------------------------------------------------------ */

const buildOrderNotifications = (orders) => {
  const out = [];
  (orders || []).forEach((o) => {
    if (!o || !o.id) return;
    const status = String(o.status || '').toLowerCase();
    const ts = o.timestamp || o.created_at || o.updated_at || new Date().toISOString();
    const type = String(o.type || '').toUpperCase();
    const tableLabel =
      o.table_name ||
      (type === 'TAKEAWAY' ? 'Takeaway' : type === 'DELIVERY' ? 'Home delivery' : 'Table');

    // Only the delay warning stays derived. "New order" and "ready" are
    // point-in-time events that now live in the persistent server feed.
    if (status === 'preparing') {
      const started = new Date(ts).getTime();
      if (Number.isFinite(started)) {
        const delayMin = Math.floor((Date.now() - started) / 60000);
        if (delayMin >= 45) {
          out.push({
            id: `order-${o.id}-delay`,
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
  });
  return out;
};

const buildInventoryNotifications = (items) =>
  (items || [])
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

/* Human-readable staff activity for the System / Security filters. */
const ACTIVITY_EVENTS = {
  user_created: ['security', 'staff-account', 'Staff account created', (p) => `${p?.username || p?.name || 'A team member'} was added to the staff list.`],
  user_updated: ['security', 'staff-account', 'Staff account updated', (p) => `${p?.username || p?.name || 'A team member'} had their account changed.`],
  user_deleted: ['security', 'staff-account', 'Staff account removed', (p) => `Staff member #${p?.id ?? ''} was removed.`],
  subfranchise_created: ['system', 'branch-change', 'New branch added', (p) => `${p?.name || 'A branch'} was created.`],
  subfranchise_updated: ['system', 'branch-change', 'Branch updated', (p) => `${p?.name || 'A branch'} was updated.`],
  subfranchise_deleted: ['system', 'branch-change', 'Branch removed', (p) => `Branch #${p?.id ?? ''} was deleted.`],
  attendance_update: ['system', 'attendance', 'Attendance updated', (p) => `Attendance record ${p?.type || 'changed'}.`],
  payroll_update: ['system', 'payroll', 'Payroll updated', (p) => `Payroll ${p?.type || 'record'} was updated.`],
};

/* ------------------------------------------------------------------ */
/*  Toast stack (rendered by the provider on every page)                */
/* ------------------------------------------------------------------ */

let toastSeq = 0;

const TOAST_ICONS = {
  'new-order': ShoppingBag,
  'payment-review': CreditCard,
  'bill-request': Receipt,
  'order-ready': Package,
};

const TOAST_TONES = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  critical: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
};

const NotificationToasts = ({ toasts, onClose, onOpen }) => {
  if (!toasts.length) return null;
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[200] top-3 left-3 right-3 sm:left-auto sm:right-4 sm:w-[370px] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.type] || Bell;
        const tone = TOAST_TONES[t.severity] || TOAST_TONES.info;
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-[#16213A] dark:shadow-black/40"
            style={{ animation: 'nt-slide-in .25s cubic-bezier(.2,.8,.2,1) both' }}
          >
            <span className={`shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-tight text-slate-900 dark:text-slate-100 break-words">
                {t.title}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-slate-600 dark:text-slate-300 break-words">
                {t.message}
              </p>
              <button
                type="button"
                onClick={onOpen}
                className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
              >
                View alerts →
              </button>
            </div>
            <button
              type="button"
              onClick={() => onClose(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes nt-slide-in {
          from { opacity: 0; transform: translateY(-10px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export const NotificationsProvider = ({ user, children }) => {
  const navigate = useNavigate();
  const staffKey = user?.id ?? user?.username ?? null;

  const [serverNotifications, setServerNotifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [localEvents, setLocalEvents] = useState(() => loadEvents());
  const [readIds, setReadIds] = useState(() => loadSet(READ_KEY));
  const [dismissedIds, setDismissedIds] = useState(() => loadSet(DISMISSED_KEY));
  const [toasts, setToasts] = useState([]);
  const [tick, setTick] = useState(0);
  const [connection, setConnection] = useState('offline');
  const [lastOrderAt, setLastOrderAt] = useState(null);
  const [tokenTick, setTokenTick] = useState(0);

  const [soundEnabled, setSoundEnabledState] = useState(() => !!getSoundSettings().enabled);
  const [soundVolume, setSoundVolumeState] = useState(() => getSoundSettings().volume);
  const [desktopEnabled, setDesktopEnabledState] = useState(() => {
    try { return localStorage.getItem(DESKTOP_KEY) === '1'; } catch { return false; }
  });

  const desktopRef = useRef(desktopEnabled);
  useEffect(() => { desktopRef.current = desktopEnabled; }, [desktopEnabled]);

  const seenServerIdsRef = useRef(null); // null until the first feed load is primed

  /* Login/logout inside the SPA does NOT remount this provider. Re-run the
     connection effect when the user object changes, and also when another
     tab changes the token. This fixes the old "login dead zone". */
  useEffect(() => {
    const bump = () => setTokenTick((v) => v + 1);
    window.addEventListener('storage', bump);
    window.addEventListener('auth-changed', bump);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('auth-changed', bump);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  /* Keep sound preferences in sync across tabs / settings UI. */
  useEffect(() => {
    const sync = () => {
      const s = getSoundSettings();
      setSoundEnabledState(!!s.enabled);
      setSoundVolumeState(s.volume);
      try {
        setDesktopEnabledState(localStorage.getItem(DESKTOP_KEY) === '1');
      } catch { /* noop */ }
    };
    window.addEventListener('storage', sync);
    window.addEventListener(PREFS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(PREFS_EVENT, sync);
    };
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `toast-${Date.now()}-${++toastSeq}`;
    const item = { id, severity: 'info', at: Date.now(), ...toast };
    setToasts((prev) => [item, ...prev].slice(0, 3));
    const ttl = toast.type === 'new-order' ? 9000 : 6500;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  const recordActivity = useCallback((evt) => {
    setLocalEvents((prev) => {
      const next = [evt, ...prev.filter((e) => e.id !== evt.id)].slice(0, 40);
      saveEvents(next);
      return next;
    });
  }, []);

  /**
   * THE guaranteed "an order arrived" path: bell + toast + desktop alert,
   * all fired synchronously on the socket event (no polling wait).
   */
  const announceOrder = useCallback((payload = {}) => {
    const orderId = payload.orderId ?? payload.order_id ?? payload.id ?? null;
    if (!ringOnce(`order-${orderId || Date.now()}`)) return;
    const title = payload.title || 'New Order Placed';
    const message = payload.message ||
      (orderId ? `Order #${orderId} just arrived.` : 'A new order just arrived.');
    playNewOrderBell();
    notifyDesktop(title, message, desktopRef);
    pushToast({ type: 'new-order', severity: 'success', title, message });
    setLastOrderAt(Date.now());
  }, [pushToast]);

  const announceAlert = useCallback((evt) => {
    if (!ringOnce(`alert-${evt.id}`)) return;
    pushToast({
      type: evt.type,
      severity: evt.severity || 'warning',
      title: evt.title,
      message: evt.message,
    });
    notifyDesktop(evt.title, evt.message, desktopRef);
  }, [pushToast]);

  /* A guest tapped "Call waiter" on the QR menu. The bell must ring on the
     STAFF side (this provider runs in the admin app), not on the guest's
     phone. ringOnce dedupes by table/order so frantic tapping only chimes once. */
  const announceWaiter = useCallback((payload = {}) => {
    const key = `call-waiter-${payload.orderId || payload.tableLabel || 'guest'}`;
    if (!ringOnce(key)) return;
    const title = payload.title || 'Waiter called';
    const message = payload.message || 'A guest has called the waiter.';
    playWaiterBell();
    notifyDesktop(title, message, desktopRef);
    pushToast({ type: 'call-waiter', severity: 'warning', title, message });
  }, [pushToast]);

  const postAction = useCallback(async (action, body) => {
    if (!localStorage.getItem('token')) return;
    try {
      await authFetch(`/api/notifications/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch {
      /* state is applied optimistically; next poll reconverges */
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const date = todayDateStr();
      const res = await authFetch(`/api/orders?startDate=${date}&endDate=${date}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch {
      /* keep last known data */
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await authFetch('/api/inventory');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setInventory(data);
    } catch {
      /* keep last known data */
    }
  }, []);

  /**
   * Persistent feed. On the very first load we prime the seen-id set
   * WITHOUT ringing (no bell storm for history). Afterwards, a genuinely
   * new recent order still gets a bell even if the socket was down.
   */
  const fetchServerNotifications = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await authFetch('/api/notifications');
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows)) return;
      setServerNotifications(rows);

      const seen = seenServerIdsRef.current;
      const currentIds = new Set(rows.map((r) => String(r.id)));
      if (seen === null) {
        seenServerIdsRef.current = currentIds;
        return;
      }
      rows.forEach((r) => {
        const sid = String(r.id);
        if (seen.has(sid)) return;
        seen.add(sid);
        if (!isRecent(r.timestamp)) return;
        if (r.type === 'new-order') {
          announceOrder({
            orderId: r.orderId,
            title: r.title,
            message: r.message,
            severity: r.severity,
          });
        } else if (r.type === 'payment-review' || r.type === 'bill-request') {
          announceAlert({
            id: r.dedupeKey || sid,
            type: r.type,
            severity: r.severity,
            title: r.title,
            message: r.message,
          });
        } else if (r.type === 'call-waiter') {
          announceWaiter({
            orderId: r.orderId,
            tableLabel: r.tableLabel,
            title: r.title,
            message: r.message,
          });
        }
      });
      seenServerIdsRef.current = new Set(
        Array.from(seen).filter((id) => currentIds.has(id))
      );
    } catch {
      /* polling fallback will retry */
    }
  }, [announceOrder, announceAlert, announceWaiter]);

  /* -------------------------------------------------------------- */
  /*  Connection: instant socket + fast polling fallback             */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setConnection('offline');
      seenServerIdsRef.current = null;
      return undefined;
    }

    let alive = true;
    let socket = null;
    // NOTE: deliberately do NOT create an AudioContext on mount. Browsers
    // log an autoplay warning and the context stays suspended. The sound
    // module's global click/tap/keypress listeners unlock it on the first
    // real gesture, and any bell queued before then is replayed there.

    fetchServerNotifications();
    fetchOrders();
    fetchInventory();

    const feedInt = setInterval(fetchServerNotifications, POLL_FEED_MS);
    const orderInt = setInterval(fetchOrders, POLL_ORDER_MS);
    const invInt = setInterval(fetchInventory, POLL_INV_MS);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fetchServerNotifications();
      fetchOrders();
      fetchInventory();
    };
    document.addEventListener('visibilitychange', onVisible);

    const refreshAll = () => {
      if (!alive) return;
      fetchServerNotifications();
      fetchOrders();
    };

    try {
      socket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 400,
        reconnectionDelayMax: 2500,
        reconnectionAttempts: Infinity,
        timeout: 7000,
      });

      socket.on('connect', () => {
        if (!alive) return;
        setConnection('live');
        refreshAll();
        fetchInventory();
      });
      socket.on('disconnect', () => { if (alive) setConnection('polling'); });
      socket.on('connect_error', () => { if (alive) setConnection('polling'); });

      /* EVERY order creation path emits this. Bell is instant. */
      socket.on('order_placed', (payload) => {
        if (!alive) return;
        announceOrder(payload || {});
        refreshAll();
      });

      /* Legacy refresh signal (also emitted by approval endpoints). If it
         carries an order id, ringOnce still guarantees a single bell. */
      socket.on('order_created', (payload) => {
        if (!alive) return;
        if (payload && (payload.orderId || payload.order_id || payload.id)) {
          announceOrder(payload);
        }
        refreshAll();
      });

      socket.on('new_order', () => { if (alive) refreshAll(); });
      socket.on('order_status_updated', () => { if (alive) fetchOrders(); });
      socket.on('order_deleted', () => { if (alive) refreshAll(); });
      socket.on('inventory_updated', () => { if (alive) fetchInventory(); });
      socket.on('notification_created', () => { if (alive) fetchServerNotifications(); });
      socket.on('notification_changed', () => { if (alive) fetchServerNotifications(); });

      socket.on('payment_verification_submitted', (p) => {
        if (!alive) return;
        announceAlert({
          id: p?.eventKey || `payment-${p?.orderId || Date.now()}`,
          type: 'payment-review',
          severity: 'warning',
          title: p?.title || 'Payment proof submitted',
          message: p?.message || 'A customer uploaded a payment screenshot for verification.',
        });
        refreshAll();
      });

      socket.on('bill_requested', (p) => {
        if (!alive) return;
        announceAlert({
          // Match the server's dedupeKey so the socket toast and the
          // polling-fallback toast cannot both appear for one request.
          id: `bill-request-${p?.orderId || Date.now()}`,
          type: 'bill-request',
          severity: 'info',
          title: p?.title || 'Bill requested',
          message: p?.message || 'A table has asked for the bill.',
        });
        refreshAll();
      });

      socket.on('waiter_called', (p) => {
        if (!alive) return;
        announceWaiter(p || {});
        refreshAll();
      });

      /* System & security activity — recorded, not rung. Every one of
         these used to be an anonymous io.emit with a sensitive payload;
         the backend now sends them to authenticated staff sockets only. */
      Object.entries(ACTIVITY_EVENTS).forEach(([event, meta]) => {
        socket.on(event, (p) => {
          if (!alive) return;
          const [category, type, title, describe] = meta;
          recordActivity({
            id: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            category,
            type,
            severity: 'info',
            title,
            message: describe(p),
            timestamp: new Date().toISOString(),
          });
        });
      });
    } catch {
      setConnection('polling');
    }

    return () => {
      alive = false;
      clearInterval(feedInt);
      clearInterval(orderInt);
      clearInterval(invInt);
      document.removeEventListener('visibilitychange', onVisible);
      if (socket) {
        try { socket.disconnect(); } catch { /* noop */ }
      }
    };
  }, [
    staffKey,
    tokenTick,
    fetchServerNotifications,
    fetchOrders,
    fetchInventory,
    announceOrder,
    announceAlert,
    recordActivity,
  ]);

  /* -------------------------------------------------------------- */
  /*  Merged feed                                                    */
  /* -------------------------------------------------------------- */
  const notifications = useMemo(() => {
    void tick; // recompute relative-time labels
    const all = [
      ...serverNotifications.map((n) => ({ ...n, source: 'server' })),
      ...buildOrderNotifications(orders),
      ...buildInventoryNotifications(inventory),
      ...localEvents,
    ];
    return all
      .filter((n) => !n.dismissed && !dismissedIds.has(n.id))
      .map((n) => ({
        ...n,
        unread: n.unread === undefined
          ? !readIds.has(n.id)
          : !!n.unread && !readIds.has(n.id),
        timeAgo: fmtAgo(n.timestamp || n.created_at),
      }))
      .sort((a, b) =>
        new Date(b.timestamp || b.created_at || 0) -
        new Date(a.timestamp || a.created_at || 0)
      );
  }, [serverNotifications, orders, inventory, localEvents, readIds, dismissedIds, tick]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications]
  );

  const counts = useMemo(() => {
    const acc = { all: notifications.length, order: 0, inventory: 0, system: 0, security: 0 };
    notifications.forEach((n) => {
      if (acc[n.category] !== undefined) acc[n.category] += 1;
    });
    return acc;
  }, [notifications]);

  /* -------------------------------------------------------------- */
  /*  Read / dismiss — local optimistic + server shared state        */
  /* -------------------------------------------------------------- */
  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(READ_KEY, next);
      return next;
    });
    if (String(id).startsWith('srv-')) postAction('read', { id });
  }, [postAction]);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveSet(READ_KEY, next);
      return next;
    });
    postAction('read', { all: true });
  }, [notifications, postAction]);

  const dismiss = useCallback((id) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveSet(DISMISSED_KEY, next);
      return next;
    });
    if (String(id).startsWith('srv-')) postAction('dismiss', { id });
  }, [postAction]);

  const clearAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveSet(DISMISSED_KEY, next);
      return next;
    });
    postAction('dismiss', { all: true });
  }, [notifications, postAction]);

  /* -------------------------------------------------------------- */
  /*  Preferences                                                    */
  /* -------------------------------------------------------------- */
  const changeSoundEnabled = useCallback((enabled) => {
    const on = !!enabled;
    persistSoundEnabled(on);
    setSoundEnabledState(on);
    if (on) primeAudio();
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  const changeVolume = useCallback((volume) => {
    const v = Math.max(0, Math.min(1, Number(volume) || 0));
    persistSoundVolume(v);
    setSoundVolumeState(v);
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);

  const toggleDesktop = useCallback(async (enabled) => {
    if (!enabled) {
      try { localStorage.setItem(DESKTOP_KEY, '0'); } catch { /* noop */ }
      setDesktopEnabledState(false);
      window.dispatchEvent(new Event(PREFS_EVENT));
      return false;
    }
    try {
      if (!('Notification' in window)) return false;
      const result = await window.Notification.requestPermission();
      if (result !== 'granted') {
        setDesktopEnabledState(false);
        return false;
      }
      localStorage.setItem(DESKTOP_KEY, '1');
      setDesktopEnabledState(true);
      window.dispatchEvent(new Event(PREFS_EVENT));
      return true;
    } catch {
      setDesktopEnabledState(false);
      return false;
    }
  }, []);

  const testBell = useCallback(() => {
    primeAudio();
    playTestBell();
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      counts,
      markAsRead,
      markAllAsRead,
      dismiss,
      clearAll,
      // Sound / delivery controls
      soundEnabled,
      setSoundEnabled: changeSoundEnabled,
      soundVolume,
      setSoundVolume: changeVolume,
      desktopEnabled,
      setDesktopEnabled: toggleDesktop,
      testBell,
      connection,
      lastOrderAt,
    }),
    [
      notifications, unreadCount, counts, markAsRead, markAllAsRead,
      dismiss, clearAll, soundEnabled, changeSoundEnabled, soundVolume,
      changeVolume, desktopEnabled, toggleDesktop, testBell, connection,
      lastOrderAt,
    ]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationToasts
        toasts={toasts}
        onClose={closeToast}
        onOpen={() => {
          setToasts([]);
          navigate('/notifications');
        }}
      />
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
      soundEnabled: true,
      setSoundEnabled: () => {},
      soundVolume: 1,
      setSoundVolume: () => {},
      desktopEnabled: false,
      setDesktopEnabled: async () => false,
      testBell: () => {},
      connection: 'offline',
      lastOrderAt: null,
    };
  }
  return ctx;
};

export default NotificationsContext;
