import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Clock,
  Flame,
  Bell,
  CheckCircle2,
  XCircle,
  Filter,
  Download,
  ChevronRight,
  Printer,
  FileText,
  Utensils,
  ShoppingBag,
  QrCode,
  CreditCard,
  Banknote,
  X as XIcon,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { authFetch, getSocketUrl } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import DatePickerButton, { getTodayLocalDate } from './DatePickerButton';
import SourceBadge from './SourceBadge';
import {
  loadRestaurantInfo,
  loadTaxDiscountSettings,
  buildKitchenSlipHtml,
  buildCustomerReceiptHtml,
  calculateTotals as calcReceiptTotals,
  RECEIPT_STYLES,
  openReceiptForPrint,
  isOrderPaid,
} from '../utils/receiptPrint';

/* =================================================================
   Constants
   ================================================================= */

const STATUS_TABS = [
  { id: 'all', label: 'All Orders', icon: Inbox, color: 'orange' },
  { id: 'payment_review', label: 'Payment Review', icon: CreditCard, color: 'amber' },
  { id: 'pending', label: 'Pending', icon: Clock, color: 'amber' },
  { id: 'preparing', label: 'Preparing', icon: Flame, color: 'orange' },
  { id: 'ready', label: 'Ready', icon: Bell, color: 'emerald' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, color: 'blue' },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'rose' },
];

const STATUS_COLORS = {
  awaiting_payment: { bg: 'bg-orange-50', text: 'text-orange-600' },
  verification_pending: { bg: 'bg-amber-50', text: 'text-amber-600' },
  cash_pending: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-600' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-600' },
  preparing: { bg: 'bg-orange-50', text: 'text-orange-600' },
  ready: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  completed: { bg: 'bg-blue-50', text: 'text-blue-600' },
  delivered: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  cancelled: { bg: 'bg-rose-50', text: 'text-rose-600' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
};

const TYPE_ICON = { DINE_IN: Utensils, TAKEAWAY: ShoppingBag, QR_CODE: QrCode };
const TYPE_LABEL = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', QR_CODE: 'QR Order' };

const TYPE_FILTER_OPTIONS = [
  { id: 'all', label: 'All Types' },
  { id: 'DINE_IN', label: 'Dine-In' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'QR_CODE', label: 'QR Order' },
];

/* =================================================================
   Helpers
   ================================================================= */

const formatId = (n) => `#ORD-${n}`;
const orderTime = (o) => new Date(o.timestamp || o.created_at || Date.now());
const minsAgo = (t) =>
  Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
const StatusPill = ({ status, dot = true }) => {
  const key = (status || '').toLowerCase();
  const c = STATUS_COLORS[key] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  let label = (status || 'pending').charAt(0).toUpperCase() + (status || 'pending').slice(1);
  if (key === 'cash_pending') label = 'Cash Pending';
  else if (key === 'verification_pending') label = 'Review Payment';
  else if (key === 'awaiting_payment') label = 'Awaiting Payment';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
};

/* =================================================================
   OrdersPage
   ================================================================= */

const OrdersPage = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);
  const [allDates, setAllDates] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [, setTick] = useState(0);
  const socketRef = useRef(null);
  const typeMenuRef = useRef(null);

  /* ---------------- loader ---------------- */
  // Use a wide date window so timezone differences between the
  // browser and a UTC-hosted backend don't accidentally drop today's
  // orders. We then filter client-side using the user-selected date.
  const load = useCallback(async () => {
    try {
      let url = '/api/orders';
      if (!allDates && selectedDate) {
        // Pull a 2-day window starting from the day before to absorb
        // any TZ skew, then we filter client-side to the exact day.
        const d = new Date(selectedDate + 'T00:00:00');
        const prev = new Date(d);
        prev.setDate(d.getDate() - 1);
        const next = new Date(d);
        next.setDate(d.getDate() + 1);
        const ymd = (x) =>
          `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(
            x.getDate()
          ).padStart(2, '0')}`;
        url = `/api/orders?startDate=${ymd(prev)}&endDate=${ymd(next)}`;
      }
      const res = await authFetch(url);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
      setLastUpdated(new Date());
      setSelectedId((prev) => {
        if (prev && list.some((o) => o.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      // keep previous list on error
    } finally {
      setLoading(false);
    }
  }, [selectedDate, allDates]);

  /* ---------------- real-time wiring ---------------- */
  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) {
      navigate('/login');
      return undefined;
    }
    load();

    let socket = null;
    try {
      socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], auth: { token: localStorage.getItem('token') } });
      socketRef.current = socket;
      const refresh = () => load();
      socket.on('connect', () => setLiveConnected(true));
      socket.on('disconnect', () => setLiveConnected(false));
      socket.on('connect_error', () => setLiveConnected(false));
      socket.on('order_created', refresh);
      socket.on('order_status_updated', refresh);
      socket.on('order_deleted', refresh);
    } catch (e) {
      // socket failure is non-fatal — polling still works
    }

    const poll = setInterval(load, 6000);
    const tick = setInterval(() => setTick((v) => v + 1), 30000);
    return () => {
      if (socket) {
        try {
          socket.off('order_created');
          socket.off('order_status_updated');
          socket.off('order_deleted');
          socket.disconnect();
        } catch (e) {
          /* noop */
        }
      }
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load, navigate]);

  /* close type menu on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) {
        setShowTypeMenu(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  /* ---------------- filtering ---------------- */
  const visibleOrders = useMemo(() => {
    let list = orders;
    // Client-side date filter (timezone-safe). The backend filter
    // may be off by one day on UTC servers, so we re-check here.
    if (!allDates && selectedDate) {
      list = list.filter((o) => {
        const ts = o.timestamp || o.created_at;
        if (!ts) return true;
        const dt = new Date(ts);
        if (Number.isNaN(dt.getTime())) return true;
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}` === selectedDate;
      });
    }
    if (typeFilter !== 'all') {
      list = list.filter((o) => (o.type || 'DINE_IN').toUpperCase() === typeFilter);
    }
    return list;
  }, [orders, typeFilter, allDates, selectedDate]);

  const counts = useMemo(() => {
    const c = {
      all: visibleOrders.length,
      payment_review: 0,
      pending: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    };
    visibleOrders.forEach((o) => {
      if (['awaiting_payment', 'verification_pending', 'rejected'].includes(o.payment_status)) c.payment_review += 1;
      const s = (o.status || '').toLowerCase();
      const key = s === 'delivered' ? 'completed' : s;
      if (c[key] !== undefined) c[key] += 1;
    });
    return c;
  }, [visibleOrders]);

  const filteredOrders = useMemo(() => {
    if (activeStatus === 'all') return visibleOrders;
    if (activeStatus === 'payment_review') return visibleOrders.filter((o) => ['awaiting_payment', 'verification_pending', 'rejected'].includes(o.payment_status));
    return visibleOrders.filter((o) => {
      const s = (o.status || '').toLowerCase();
      if (activeStatus === 'completed') return s === 'completed' || s === 'delivered';
      return s === activeStatus;
    });
  }, [visibleOrders, activeStatus]);

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) || filteredOrders[0] || null,
    [orders, selectedId, filteredOrders]
  );

  /* ---------------- helpers ---------------- */
  const exportCSV = () => {
    const headers = ['Order', 'Date', 'Table', 'Type', 'Status', 'Total'];
    const rows = filteredOrders.map((o) => [
      formatId(o.id),
      orderTime(o).toLocaleString(),
      o.table_name || '',
      TYPE_LABEL[o.type] || o.type || '',
      o.status || '',
      Number(o.total) || 0,
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Single source of truth for totals — uses the same calculator as
  // the printed receipt so the on-screen numbers and the bill always
  // agree, and they honour whatever taxes/discount have been saved
  // in Settings → Billing & Taxation.
  const computeTotals = (o) =>
    calcReceiptTotals(o, loadTaxDiscountSettings());

  const activeTypeLabel =
    TYPE_FILTER_OPTIONS.find((t) => t.id === typeFilter)?.label || 'All Types';

  /* ---------------- render ---------------- */
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                liveConnected
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
              title={
                liveConnected
                  ? 'Live socket connected'
                  : 'Auto-refresh every 6s'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  liveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {liveConnected ? 'Live' : 'Auto'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all customer orders in real-time
            {lastUpdated && (
              <span className="text-gray-400">
                {' '}
                • Updated{' '}
                {lastUpdated.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative" ref={typeMenuRef}>
            <button
              onClick={() => setShowTypeMenu((v) => !v)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition ${
                typeFilter !== 'all'
                  ? 'border-orange-200 text-orange-600 bg-orange-50'
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {activeTypeLabel}
            </button>
            {showTypeMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30">
                {TYPE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setTypeFilter(opt.id);
                      setShowTypeMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50/60 ${
                      typeFilter === opt.id
                        ? 'text-orange-600 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DatePickerButton
            value={selectedDate}
            onChange={(d) => {
              setAllDates(false);
              setSelectedDate(d);
            }}
            allDates={allDates}
            onAllDates={setAllDates}
            showAllDatesOption
          />
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {STATUS_TABS.map((t) => {
          const active = activeStatus === t.id;
          const count = counts[t.id] ?? 0;
          const Icon = t.icon;
          const colorMap = {
            orange: 'bg-orange-50 text-orange-600 border-orange-200',
            amber: 'bg-amber-50 text-amber-600 border-amber-200',
            emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            rose: 'bg-rose-50 text-rose-600 border-rose-200',
          };
          return (
            <button
              key={t.id}
              onClick={() => setActiveStatus(t.id)}
              className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition ${
                active
                  ? `${colorMap[t.color]} shadow-sm`
                  : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${active ? '' : 'text-gray-400'}`} />
                <span className="text-sm font-semibold">{t.label}</span>
              </div>
              <span
                className={`text-xs font-bold min-w-[22px] h-5 px-1.5 rounded-full flex items-center justify-center ${
                  active ? 'bg-white/70 text-current' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Orders list */}
        <div className="lg:col-span-7 space-y-3">
          {filteredOrders.map((o) => {
            const typeKey = (o.type || 'DINE_IN').toUpperCase();
            const TypeIcon = TYPE_ICON[typeKey] || Utensils;
            const items = Array.isArray(o.items) ? o.items : [];
            const itemCount = items.length;
            const mins = minsAgo(orderTime(o));
            const time = orderTime(o);
            const isSelected = selected?.id === o.id;
            const statusLower = (o.status || '').toLowerCase();
            const paid =
              o.payment_status === 'paid' ||
              statusLower === 'completed' ||
              o.bill_status === 'paid';
            return (
              <button
                key={o.id}
                onClick={() => setSelectedId(o.id)}
                className={`w-full text-left bg-white rounded-2xl border p-4 transition ${
                  isSelected
                    ? 'border-orange-300 ring-2 ring-orange-100'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-gray-900">
                    {formatId(o.id)}{' '}
                    <span className="font-normal text-gray-400">
                      •{' '}
                      {time.toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                      })}{' '}
                      •{' '}
                      {time.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </span>
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <TypeIcon className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold">
                        {o.table_name || o.customer_name || TYPE_LABEL[typeKey] || 'Counter'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {TYPE_LABEL[typeKey] || 'Dine-In'} • {itemCount} item
                      {itemCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {mins} min ago
                    </span>
                    <p className="text-sm font-bold text-gray-900">{fmt(o.total)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    {items.slice(0, 3).map((it, idx) => (
                      <span
                        key={idx}
                        className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center -ml-1 first:ml-0 ring-2 ring-white"
                        title={it.name}
                      >
                        {(it.name || '?').charAt(0).toUpperCase()}
                      </span>
                    ))}
                    <span className="text-xs text-gray-500 ml-1">
                      {itemCount} Item{itemCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={o.status || 'pending'} />
                    <span
                      className={`text-[10px] font-semibold ${
                        paid ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
              {loading ? 'Loading orders...' : 'No orders match your filters'}
            </div>
          )}
        </div>

        {/* Right detail panel */}
        <div className="lg:col-span-5">
          {selected ? (
            <OrderDetailPanel
              order={selected}
              fmt={fmt}
              totals={computeTotals(selected)}
              onPaymentReviewed={load}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
              Select an order to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* =================================================================
   Order Detail Panel
   ================================================================= */

const buildTimeline = (order) => {
  const created = orderTime(order);
  const status = (order.status || 'pending').toLowerCase();
  const isReady = ['ready', 'delivered', 'completed'].includes(status);
  const isCompleted = ['delivered', 'completed'].includes(status);

  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
  const readyAt = order.ready_at ? new Date(order.ready_at) : order.updated_at ? new Date(order.updated_at) : null;

  return [
    {
      key: 'pending',
      label: 'Order Received',
      reached: true,
      time: created,
    },
    {
      key: 'ready',
      label: 'Approved & Sent to Waiter',
      reached: isReady,
      time: isReady ? readyAt : null,
    },
    {
      key: 'completed',
      label: 'Delivered / Served by Waiter',
      reached: isCompleted,
      time: isCompleted ? (deliveredAt || readyAt) : null,
    },
  ];
};

const OrderDetailPanel = ({ order, fmt, totals, onPaymentReviewed }) => {
  const created = orderTime(order);
  const status = (order.status || 'pending').toLowerCase();
  const paid =
    order.payment_status === 'paid' || ['completed'].includes(status) || order.bill_status === 'paid';
  const items = Array.isArray(order.items) ? order.items : [];
  const typeKey = (order.type || 'DINE_IN').toUpperCase();
  const timeline = buildTimeline(order);
  const [showPreview, setShowPreview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewError, setReviewError] = useState('');

  // Safely parse JSON from a fetch response; falls back to text on non-JSON.
  const safeJson = async (res) => {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    const text = await res.text();
    // If server returned HTML (e.g. 502/503 error page), surface a readable message.
    return { message: text.replace(/<[^>]*>/g, '').trim().slice(0, 200) || 'Server error' };
  };

  const reviewPayment = async (decision) => {
    if (decision === 'reject' && !rejectionReason.trim()) {
      setReviewError('Enter a reason before rejecting this payment.'); return;
    }
    setReviewing(true); setReviewError('');
    try {
      const res = await authFetch(`/api/orders/${order.id}/payment-verification`, {
        method: 'PUT', body: JSON.stringify({ decision, rejectionReason }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Could not update payment');
      onPaymentReviewed?.();
    } catch (e) { setReviewError(e.message || 'Could not update payment'); }
    finally { setReviewing(false); }
  };

  const approveOrderDirectly = async () => {
    setReviewing(true);
    setReviewError('');
    try {
      const res = await authFetch(`/api/orders/${order.id}/approve`, {
        method: 'PUT',
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Could not approve order');
      onPaymentReviewed?.();
    } catch (e) {
      setReviewError(e.message || 'Could not approve order');
    } finally {
      setReviewing(false);
    }
  };

  const handleCollectCash = async () => {
    setReviewing(true);
    setReviewError('');
    try {
      const res = await authFetch(`/api/orders/${order.id}/collect-cash`, {
        method: 'PUT',
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Could not record cash payment');
      onPaymentReviewed?.();
    } catch (e) {
      setReviewError(e.message || 'Could not record cash payment');
    } finally {
      setReviewing(false);
    }
  };

  // Build the printable receipt HTML for the current order. Used by
  // both the "Print Bill" and "View Bill" actions so dine-in and
  // takeaway bills always look identical to the thermal printout.
  // The tax/discount values come from the user's saved settings, so
  // whatever is configured under Settings → Billing & Taxation drives
  // the bill (CGST + SGST split = taxPercent / 2 each).
  const buildPrintableHtml = async () => {
    const info = loadRestaurantInfo();
    const taxDiscount = loadTaxDiscountSettings();
    const receiptTotals = calcReceiptTotals(order, taxDiscount);
    const orderPaid = isOrderPaid(order);
    const paymentLabel = orderPaid
      ? order.payment_method
        ? String(order.payment_method).toUpperCase()
        : 'Cash'
      : 'Pending';
    const customerHtml = buildCustomerReceiptHtml(order, receiptTotals, info, {
      qrCodeDataUrl: '',
      paymentLabel,
    });
    const kitchenHtml =
      typeKey === 'TAKEAWAY' ? buildKitchenSlipHtml(order, info) : '';
    return { html: `${kitchenHtml}${customerHtml}`, totals: receiptTotals };
  };

  const handlePrint = async () => {
    const { html } = await buildPrintableHtml();
    openReceiptForPrint(html, `Bill #${order.id}`);
  };

  const handleView = () => setShowPreview(true);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold text-gray-900">{formatId(order.id)}</p>
            <SourceBadge source={order.source} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {created.toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })}{' '}
            •{' '}
            {created.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={status} />
          <span
            className={`text-[10px] font-semibold ${
              paid ? 'text-emerald-600' : 'text-rose-500'
            }`}
          >
            {paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Table / Customer
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.table_name || order.customer_name || 'Counter'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Order Type
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {TYPE_LABEL[typeKey] || 'Dine-In'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Token
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.token || `${formatId(order.id)}`}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Payment
          </p>
          <p className="text-sm font-semibold text-gray-800">
            {order.payment_method === 'cash'
              ? 'Cash'
              : order.payment_method
              ? String(order.payment_method).toUpperCase()
              : paid ? 'Cash' : 'Pending'}
          </p>
        </div>
      </div>

      {order.payment_status === 'verification_pending' && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-amber-900">Payment verification required</p>
          <p className="mt-1 text-sm text-amber-800">Review the screenshot and confirm the payment amount matches this order.</p>
          {order.payment_proof_image && (
            <a href={order.payment_proof_image} target="_blank" rel="noreferrer" className="mt-3 block">
              <img src={order.payment_proof_image} alt="Customer payment proof" className="max-h-56 w-full rounded-xl border border-amber-200 object-contain bg-white" />
              <span className="mt-1 block text-xs font-semibold text-orange-600">Open full-size screenshot</span>
            </a>
          )}
          <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason if rejecting (required only for reject)" className="mt-3 min-h-20 w-full rounded-xl border border-amber-200 bg-white p-2.5 text-sm" />
          {reviewError && <p className="mt-2 text-sm text-rose-600">{reviewError}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={reviewing} onClick={() => reviewPayment('reject')} className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-600 disabled:opacity-50">Deny payment</button>
            <button disabled={reviewing} onClick={() => reviewPayment('approve')} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{reviewing ? 'Saving…' : 'Approve & send to waiter'}</button>
          </div>
        </div>
      )}

      {/* Cash payment notice & action */}
      {order.payment_method === 'cash' && order.payment_status === 'cash_pending' && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">💵</span>
            <p className="font-bold text-emerald-900">Cash Payment — Collect from Customer</p>
          </div>
          <p className="text-sm text-emerald-800">
            This order is being prepared. The customer will pay <b>{fmt(order.total)}</b> in cash. Please collect payment when food is served.
          </p>
          {reviewError && <p className="mt-2 text-sm text-rose-600">{reviewError}</p>}
          <button
            disabled={reviewing}
            onClick={handleCollectCash}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 text-sm transition shadow-sm disabled:opacity-50"
          >
            <Banknote className="w-4 h-4" />
            {reviewing ? 'Recording…' : `Confirm Cash Collected (${fmt(order.total)})`}
          </button>
        </div>
      )}

      {order.payment_method === 'cash' && order.payment_status === 'paid' && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold text-emerald-900 text-sm">Cash Payment Collected ({fmt(order.total)})</p>
            <p className="text-xs text-emerald-700">Cash payment has been received and verified.</p>
          </div>
        </div>
      )}

      {/* Pending Order Approval for Admin.
           - Shown only for non-cash, non-QR-payment-pending orders.
           - Cash orders (cash_pending) go directly to the kitchen and need no approval.
           - QR payment orders (verification_pending) use the payment review panel above. */}
      {status === 'pending'
        && order.payment_status !== 'verification_pending'
        && order.payment_status !== 'cash_pending'
        && order.payment_method !== 'cash' && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-bold text-emerald-900">Order Awaiting Approval</p>
          <p className="mt-1 text-sm text-emerald-800">
            Approve this order to dispatch it directly to the waiter for serving.
          </p>
          {reviewError && <p className="mt-2 text-sm text-rose-600">{reviewError}</p>}
          <button
            disabled={reviewing}
            onClick={approveOrderDirectly}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            {reviewing ? 'Approving…' : 'Approve & Send to Waiter'}
          </button>
        </div>
      )}

      {status === 'ready' && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>✓ Order approved — currently with the waiter to serve.</span>
        </div>
      )}

      {order.payment_status === 'rejected' && (
        <div className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Payment rejected: {order.payment_rejection_reason || 'Please submit payment proof again.'}</div>
      )}

      {/* Timeline */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Order Timeline
        </p>
        <ul className="space-y-2">
          {timeline.map((stage) => (
            <li key={stage.key} className="flex items-center gap-3 text-sm">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stage.reached ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              />
              <span
                className={`flex-1 ${
                  stage.reached ? 'text-gray-800 font-medium' : 'text-gray-400'
                }`}
              >
                {stage.label}
              </span>
              <span
                className={`text-xs ${
                  stage.reached ? 'text-gray-500' : 'text-gray-300'
                }`}
              >
                {stage.reached && stage.time
                  ? stage.time.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '--'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Items */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Order Items
        </p>
        <ul className="space-y-2">
          {items.map((it, idx) => {
            const qty = it.quantity || it.qty || 1;
            return (
              <li
                key={idx}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-orange-500 font-bold mt-0.5">{qty}x</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium truncate">{it.name}</p>
                    {it.note && (
                      <p className="text-[11px] text-gray-400 truncate">{it.note}</p>
                    )}
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {fmt((Number(it.price) || 0) * qty)}
                </p>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-sm text-gray-400 text-center py-2">No items</li>
          )}
        </ul>
      </div>

      {/* Totals */}
      <div className="mt-5 pt-4 border-t border-gray-100 space-y-1.5 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span>{fmt(totals.subtotal)}</span>
        </div>
        {totals.discountPercent > 0 && (
          <>
            <div className="flex justify-between text-gray-600">
              <span>
                Discount (
                {totals.discountType === 'percent'
                  ? `${totals.discountPercent}%`
                  : `${Number(totals.discountPercent).toFixed(2)}`}
                )
              </span>
              <span className="text-rose-500">
                -{fmt(totals.discountAmount)}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>After Discount</span>
              <span>{fmt(totals.afterDiscount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-gray-600">
          <span>GST ({Number(totals.taxPercent).toFixed(2)}%)</span>
          <span>{fmt(totals.tax)}</span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-100">
          <span className="font-bold text-gray-900">Total Amount</span>
          <span className="font-extrabold text-orange-500">
            {fmt(totals.total)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
        >
          <Printer className="w-4 h-4" /> Print Bill
        </button>
        <button
          onClick={handleView}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
        >
          <FileText className="w-4 h-4" /> View Bill
        </button>
      </div>

      {showPreview && (
        <BillPreviewModal
          order={order}
          buildPrintableHtml={buildPrintableHtml}
          onClose={() => setShowPreview(false)}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
};

/* =================================================================
   Bill Preview Modal
   Shows the thermal-style 80mm receipt inside an iframe so the
   styles are isolated. Works for both Dine-In and Takeaway: takeaway
   orders include the kitchen token slip first, then the customer
   bill below — exactly matching the printed output.
   ================================================================= */

const BillPreviewModal = ({ order, buildPrintableHtml, onClose, onPrint }) => {
  const [html, setHtml] = useState('');
  const isTakeaway = String(order.type).toUpperCase() === 'TAKEAWAY';

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(buildPrintableHtml())
      .then((result) => {
        if (!cancelled && result && typeof result.html === 'string') {
          setHtml(result.html);
        }
      })
      .catch(() => {
        /* keep empty html — preview shows blank */
      });
    return () => {
      cancelled = true;
    };
  }, [buildPrintableHtml]);

  const fullDoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${RECEIPT_STYLES}
  body { padding: 8px 0; }
</style></head><body>${html}</body></html>`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">
              Bill Preview · {formatId(order.id)}
            </p>
            <p className="text-xs text-gray-500">
              {isTakeaway
                ? 'Takeaway · Kitchen token + customer bill'
                : 'Dine-In · Customer bill'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt body (rendered in an iframe to isolate the
            thermal styles from the surrounding app). */}
        <div className="flex-1 overflow-auto bg-gray-100 px-3 py-4 flex justify-center">
          <iframe
            title={`Bill ${order.id}`}
            srcDoc={fullDoc}
            className="bg-white rounded-md shadow-md border border-gray-200"
            style={{ width: '320px', height: '70vh' }}
          />
        </div>

        {/* Footer actions */}
        <div className="grid grid-cols-2 gap-2 p-3 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={onPrint}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-sm hover:shadow-md"
          >
            <Printer className="w-4 h-4" /> Print Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
