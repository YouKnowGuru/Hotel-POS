import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl, authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import Notification from './Notification';
import {
  Bell, CheckCircle2, Clock, Utensils, Banknote,
  Truck, MapPin, Phone, User,
  ChevronDown, Package, RotateCw, Sparkles,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Waiter delivery panel — visual language matches the rest of
   the admin/waiter pages (TakeawayManagement, DineIn, Orders):
   light background, white rounded-2xl cards, indigo accents,
   emerald action buttons and the shared Notification toast.
   All data logic (ready-order polling, sockets, confirm-delivery
   / cash collection) is unchanged.
───────────────────────────────────────────────────────────── */

const minsAgo = (ts) =>
  Math.max(0, Math.round((Date.now() - new Date(ts || Date.now()).getTime()) / 60000));

/* Urgency tiers — same thresholds as before, expressed in the light
   design system's pill palette (emerald / amber / red). */
const URGENCY = {
  fresh: {
    label: 'READY',
    pill: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
  warm: {
    label: 'WAITING',
    pill: 'bg-amber-50 border-amber-100 text-amber-600',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
  },
  hot: {
    label: 'OVERDUE',
    pill: 'bg-red-50 border-red-100 text-red-600',
    dot: 'bg-red-500',
    text: 'text-red-600',
  },
};

const urgencyOf = (mins) => (mins >= 15 ? URGENCY.hot : mins >= 8 ? URGENCY.warm : URGENCY.fresh);

const dayLabel = (d) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────────────────────────
   Ticket card — same card anatomy as TakeawayManagement's
   OrderCard: header with status pill, items list, gray footer
   with the action buttons.
───────────────────────────────────────────────────────────── */
const Ticket = ({ order, fmt, index, isLoaded, onServed, isDelivering }) => {
  const [expanded, setExpanded] = useState(false);
  const mins = minsAgo(order.updated_at || order.timestamp);
  const u = urgencyOf(mins);
  const isDelivery = String(order.type || '').toUpperCase() === 'DELIVERY';
  const isCashPending =
    order.payment_method === 'cash' && order.payment_status === 'cash_pending';
  const items = order.items || [];

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col ${mins >= 15 ? 'ring-1 ring-red-100' : ''}`}
      style={{
        animation: isLoaded
          ? `slideUpFade .35s ease-out ${Math.min(index, 8) * 50}ms both`
          : 'none',
      }}
    >
      {/* Urgency timing strip */}
      <div
        className="h-1 w-full"
        style={{
          background:
            mins >= 15
              ? 'linear-gradient(90deg, #ef4444, #f87171)'
              : mins >= 8
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #10b981, #34d399)',
        }}
      />

      {/* Card header — tappable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-b border-gray-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${u.pill}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`} />
              {isDelivery ? (
                <Truck className="w-3 h-3" />
              ) : (
                <Utensils className="w-3 h-3" />
              )}
              {isDelivery ? 'Delivery' : 'Dine-in'} #{order.id}
            </span>
          </div>
          <p className="text-base font-bold text-gray-900 mt-1 truncate">
            {isDelivery
              ? (order.customer_name || 'Home delivery')
              : `Table ${order.table_name || order.customer_name || 'Counter'}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock className={`w-3 h-3 ${mins >= 8 ? u.text : 'text-gray-400'}`} />
              <span className={mins >= 8 ? `font-semibold ${u.text}` : ''}>
                Waiting {mins}m
              </span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="whitespace-nowrap">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
            {isCashPending && (
              <>
                <span className="text-gray-300">·</span>
                <span className="whitespace-nowrap text-amber-600 font-semibold">💵 cash due</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400">Total</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">
              {fmt(order.total)}
            </p>
          </div>
          <span
            className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform .25s ease',
            }}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
      </button>

      {/* Collapsed-only item preview — keeps short cards from looking empty */}
      {!expanded && (
        <div className="px-4 pt-2 pb-1 flex-1">
          <div className="flex items-center flex-wrap gap-1.5">
            {items.slice(0, 3).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 text-xs text-gray-600"
              >
                <b className="text-indigo-600">{item.quantity || item.qty || 1}×</b>
                <span className="max-w-[140px] truncate">{item.name}</span>
              </span>
            ))}
            {items.length > 3 && (
              <span className="text-xs text-gray-400 font-medium">+{items.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {/* Expandable body */}
      <div
        style={{
          maxHeight: expanded ? 720 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="px-4 py-3">
          {isDelivery && (order.customer_phone || order.delivery_address) && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                Delivery details
              </p>
              {order.customer_phone && (
                <a
                  href={`tel:${String(order.customer_phone).replace(/\s+/g, '')}`}
                  className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {order.customer_phone}
                </a>
              )}
              {order.customer_name && (
                <p className="flex items-center gap-2 text-sm text-gray-700 mt-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {order.customer_name}
                </p>
              )}
              {order.delivery_address && (
                <p className="flex items-start gap-2 text-sm text-gray-700 mt-1 leading-relaxed">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                  <span>{order.delivery_address}</span>
                </p>
              )}
            </div>
          )}

          <p className="text-xs font-semibold text-gray-400 mb-2">Items</p>
          <ul className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start justify-between gap-2 text-sm">
                <span className="flex items-start gap-2 min-w-0 flex-1">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-bold shrink-0">
                    {item.quantity || item.qty || 1}×
                  </span>
                  <span className="min-w-0">
                    <span className="text-gray-800 font-medium truncate block">
                      {item.name}
                    </span>
                    {item.note && (
                      <span className="block mt-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-2 py-0.5 w-fit">
                        ↳ {item.note}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-xs font-semibold text-gray-700 shrink-0 mt-0.5">
                  {fmt(item.price)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Total</span>
            <span className="text-base font-bold text-gray-900">{fmt(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer actions — same gray footer + emerald CTA as TakeawayManagement */}
      <div className="px-4 py-3 border-t border-gray-50 bg-gray-50 space-y-2 mt-auto">
        {isCashPending && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-1">
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Banknote className="w-4 h-4" />
              Collect cash at the door
            </span>
            <span className="text-sm font-bold text-amber-700">
              {fmt(order.total)}
            </span>
          </div>
        )}
        {isCashPending ? (
          <>
            <button
              onClick={() => onServed(order.id, true)}
              disabled={isDelivering}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition"
            >
              <Banknote className="w-4 h-4" />
              {isDelivering ? 'Saving…' : `Collect ${fmt(order.total)} & Complete`}
            </button>
            <button
              onClick={() => onServed(order.id, false)}
              disabled={isDelivering}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-60 text-sm font-semibold transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark delivered · pay later
            </button>
          </>
        ) : (
          <button
            onClick={() => onServed(order.id, false)}
            disabled={isDelivering}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold shadow-sm transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isDelivering ? 'Marking…' : 'Mark as Served'}
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main panel
───────────────────────────────────────────────────────────── */
const WaiterDeliveryPanel = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const [readyOrders, setReadyOrders] = useState([]);
  const [servedToday, setServedToday] = useState([]);
  const [showServed, setShowServed]   = useState(false);
  const [filter, setFilter]           = useState('all'); // all | dinein | delivery
  const [toast, setToast]             = useState(null);
  const [delivering, setDelivering]   = useState({});
  const [newAlert, setNewAlert]       = useState(null);
  const [online, setOnline]           = useState(navigator.onLine);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastSync, setLastSync]       = useState(null);
  const [now, setNow]                 = useState(Date.now()); // re-render timers
  const prevIdsRef  = useRef(new Set());
  const socketRef   = useRef(null);
  const toastTimer  = useRef(null);

  /* online/offline listener */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* keep the minute timers ticking */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchReadyOrders = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders?status=ready&limit=200');
      const data = res.ok ? await res.json() : [];
      const ready = Array.isArray(data)
        ? data.filter(
            (o) =>
              String(o.status || '').toLowerCase() === 'ready' &&
              String(o.type || '').toUpperCase() !== 'TAKEAWAY'
          )
        : [];
      const newIds = new Set(ready.map((o) => o.id));
      const brandNew = ready.filter((o) => !prevIdsRef.current.has(o.id));
      if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
        setNewAlert(brandNew[0]);
        setTimeout(() => setNewAlert(null), 6000);
      }
      prevIdsRef.current = newIds;
      setReadyOrders(ready);
    } catch {
      /* keep previous list */
    }
  }, []);

  /* Served-today log: completed/delivered dine-in + delivery orders */
  const fetchServedToday = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders?limit=200');
      const data = res.ok ? await res.json() : [];
      if (!Array.isArray(data)) return;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const done = data
        .filter((o) => {
          const s = String(o.status || '').toLowerCase();
          return (s === 'completed' || s === 'delivered') &&
            String(o.type || '').toUpperCase() !== 'TAKEAWAY';
        })
        .filter((o) => {
          const ts = new Date(o.updated_at || o.timestamp || Date.now());
          return ts >= startOfDay;
        })
        .sort((a, b) =>
          new Date(b.updated_at || b.timestamp) - new Date(a.updated_at || a.timestamp));
      setServedToday(done);
    } catch {
      /* non-fatal */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchReadyOrders(), fetchServedToday()]);
    setLastSync(Date.now());
    setRefreshing(false);
  }, [fetchReadyOrders, fetchServedToday]);

  useEffect(() => {
    refreshAll();
    const poll = setInterval(refreshAll, 10000);
    try {
      const socket = io(getSocketUrl(), {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;
      socket.on('order_status_updated', refreshAll);
      socket.on('order_created', refreshAll);
      socket.on('new_order', refreshAll);
    } catch { /* non-fatal */ }
    return () => {
      clearInterval(poll);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [refreshAll]);

  const handleServed = async (orderId, collectCash = false) => {
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
          ? `Order #${orderId} — cash collected & served ✓`
          : `Order #${orderId} marked as served ✓`
      );
      fetchServedToday();
    } catch {
      showToast('Could not confirm. Please try again.', 'error');
    } finally {
      setDelivering((p) => ({ ...p, [orderId]: false }));
    }
  };

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const dineInCount = readyOrders.filter((o) => String(o.type || '').toUpperCase() !== 'DELIVERY').length;
  const deliveryCount = readyOrders.length - dineInCount;
  const cashDue = readyOrders.filter((o) => o.payment_method === 'cash' && o.payment_status === 'cash_pending');
  const cashDueTotal = cashDue.reduce((s, o) => s + (Number(o.total) || 0), 0);

  /* Most-urgent first: the ticket that has waited longest leads the list. */
  const filtered = (filter === 'delivery'
    ? readyOrders.filter((o) => String(o.type || '').toUpperCase() === 'DELIVERY')
    : filter === 'dinein'
      ? readyOrders.filter((o) => String(o.type || '').toUpperCase() !== 'DELIVERY')
      : readyOrders
  ).slice().sort((a, b) =>
    minsAgo(b.updated_at || b.timestamp) - minsAgo(a.updated_at || a.timestamp));

  return (
    <div className="p-4 sm:p-6">
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes alertBounce {
          0%,100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
          60% { transform: translateY(-2px); }
        }
        @keyframes spinOnce { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-alert-bounce { animation: alertBounce .55s ease; }
        .animate-spin-once { animation: spinOnce .8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-alert-bounce, .animate-spin-once { animation: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header — same pattern as TakeawayManagement */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </span>
              Delivery Panel
            </h1>
            <p className="text-sm text-gray-500 mt-1 ml-11">
              {greeting}, {user.name || 'Waiter'} — orders ready to serve, live from the kitchen
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              title={
                lastSync
                  ? `Last updated ${dayLabel(new Date(lastSync))}`
                  : 'Waiting for first sync…'
              }
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${
                online ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              {online ? 'Live · auto 10s' : 'Offline'}
            </span>
            <button
              onClick={refreshAll}
              title="Refresh now"
              className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition"
            >
              <RotateCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin-once' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <SummaryCard
            label="ON THE PASS"
            value={readyOrders.length}
            Icon={Bell}
            color="text-amber-500"
            delay={0}
          />
          <SummaryCard
            label="DINE-IN"
            value={dineInCount}
            Icon={Utensils}
            color="text-blue-500"
            delay={60}
          />
          <SummaryCard
            label="DELIVERY"
            value={deliveryCount}
            Icon={Truck}
            color="text-violet-500"
            delay={120}
          />
          <SummaryCard
            label="CASH DUE"
            value={fmt(cashDueTotal)}
            Icon={Banknote}
            color={cashDueTotal > 0 ? 'text-red-500' : 'text-gray-400'}
            delay={180}
            small
          />
        </div>

        {/* New-ready-order alert */}
        {newAlert && (
          <div
            className="mb-5 bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 animate-alert-bounce"
            style={{ animation: 'slideUpFade .3s ease both, alertBounce .55s ease .3s' }}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">
                New order ready — #{newAlert.id}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {String(newAlert.type || '').toUpperCase() === 'DELIVERY'
                  ? (newAlert.customer_name || 'Home delivery')
                  : `Table ${newAlert.table_name || 'Counter'}`}{' '}
                · see it in the list below
              </p>
            </div>
          </div>
        )}

        {/* Status filter pills — same as TakeawayManagement */}
        <div className="bg-white border border-gray-100 rounded-full shadow-sm p-1 flex items-center gap-1 mb-5 w-fit max-w-full overflow-x-auto">
          {[
            { id: 'all',      label: 'All',      Icon: Package,  count: readyOrders.length, accent: 'text-indigo-600' },
            { id: 'dinein',   label: 'Dine-In',  Icon: Utensils, count: dineInCount,        accent: 'text-blue-600' },
            { id: 'delivery', label: 'Delivery', Icon: Truck,    count: deliveryCount,      accent: 'text-violet-600' },
          ].map((t) => {
            const isActive = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/60'
                    : `${t.accent} hover:bg-gray-50`
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                {t.label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Served-today summary chip */}
        {servedToday.length > 0 && (
          <button
            type="button"
            onClick={() => setShowServed((v) => !v)}
            className="w-full mb-5 bg-white border border-gray-100 rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              {servedToday.length} served today
            </span>
            <span
              className="text-gray-400"
              style={{
                transform: showServed ? 'rotate(180deg)' : 'none',
                transition: 'transform .25s',
              }}
            >
              <ChevronDown className="w-4 h-4" />
            </span>
          </button>
        )}

        {/* Served-today log */}
        {showServed && servedToday.length > 0 && (
          <div
            className="mb-6 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
            style={{ animation: 'slideUpFade .25s ease-out both' }}
          >
            {servedToday.slice(0, 6).map((o, i) => {
              const isDelivery = String(o.type || '').toUpperCase() === 'DELIVERY';
              return (
                <div
                  key={o.id}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                    i < Math.min(6, servedToday.length) - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isDelivery
                          ? 'bg-violet-50 text-violet-500'
                          : 'bg-blue-50 text-blue-500'
                      }`}
                    >
                      {isDelivery ? <Truck className="w-3 h-3" /> : <Utensils className="w-3 h-3" />}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate">
                      #{o.id} ·{' '}
                      {isDelivery
                        ? (o.customer_name || 'Delivery')
                        : `Table ${o.table_name || '?'}`}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {fmt(o.total)} · {dayLabel(new Date(o.updated_at || o.timestamp))}
                  </span>
                </div>
              );
            })}
            {servedToday.length > 6 && (
              <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                + {servedToday.length - 6} more today
              </p>
            )}
          </div>
        )}

        {/* Tickets */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-400 mx-auto mb-3 flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <p className="text-base font-semibold text-gray-900">
              {readyOrders.length === 0
                ? 'All caught up 🎉'
                : filter === 'dinein'
                  ? 'No dine-in orders on the pass'
                  : 'No delivery orders on the pass'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {readyOrders.length === 0
                ? 'Every order has been served. New ready orders appear here in real time — no refresh needed.'
                : 'Switch tabs above to see the other order types.'}
            </p>
            <p
              className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                online ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              {online ? 'Connected to the kitchen' : 'Offline — showing last synced orders'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((order, index) => (
              <Ticket
                key={order.id}
                order={order}
                fmt={fmt}
                index={index}
                isLoaded
                now={now}
                onServed={handleServed}
                isDelivering={!!delivering[order.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shared toast — same as all other pages */}
      {toast && (
        <Notification
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, Icon, color, delay, small }) => (
  <div
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
    style={{
      animation: `slideUpFade .35s ease-out ${delay}ms both`,
    }}
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] font-bold tracking-wider text-gray-400">{label}</p>
      <div className={`w-7 h-7 rounded-lg bg-gray-50 ${color} flex items-center justify-center`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
    <p
      className={`${small ? 'text-lg sm:text-2xl' : 'text-2xl sm:text-3xl'} font-bold ${color} leading-none truncate`}
    >
      {value}
    </p>
  </div>
);

export default WaiterDeliveryPanel;
