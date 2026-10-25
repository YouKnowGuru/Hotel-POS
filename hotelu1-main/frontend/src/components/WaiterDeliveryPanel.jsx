import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAPI_URL, getSocketUrl, authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import {
  Bell, CheckCircle2, Clock, Utensils, Banknote,
  Truck, MapPin, Phone, User, Flame, Sparkles,
  ChevronDown, Package, Gift,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Kitchen-display (KDS) waiter board.
   Redesigned: dark "kitchen pass" theme, ember/accent palette,
   ticket-style order cards with live urgency timers, type filter
   tabs and a "served today" log. All data logic (ready-order
   polling, sockets, confirm-delivery / cash collection) is
   unchanged.
───────────────────────────────────────────────────────────── */

const minsAgo = (ts) =>
  Math.max(0, Math.round((Date.now() - new Date(ts || Date.now()).getTime()) / 60000));

const urgency = (mins) => {
  if (mins >= 15) return { key: 'hot',    label: 'OVERDUE', strip: '#F4502C', glow: 'rgba(244,80,44,0.35)' };
  if (mins >= 8)  return { key: 'warm',   label: 'WAITING', strip: '#F5A524', glow: 'rgba(245,165,36,0.30)' };
  return                 { key: 'fresh',  label: 'FRESH',   strip: '#33CBA7', glow: 'rgba(51,203,167,0.28)' };
};

const dayLabel = (d) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────────────────────────
   Ticket card — a kitchen ticket with tape strip + timer chip
───────────────────────────────────────────────────────────── */
const Ticket = ({ order, fmt, onServed, isDelivering }) => {
  const [expanded, setExpanded] = useState(false);
  const mins = minsAgo(order.updated_at || order.timestamp);
  const u = urgency(mins);
  const isDelivery = String(order.type || '').toUpperCase() === 'DELIVERY';
  const isCashPending =
    order.payment_method === 'cash' && order.payment_status === 'cash_pending';
  const items = order.items || [];

  return (
    <div
      className="wp-ticket"
      style={{
        background: '#161C2B',
        borderRadius: 18,
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: `0 10px 30px -18px ${u.glow}, 0 2px 10px rgba(0,0,0,0.35)`,
        overflow: 'hidden',
      }}
    >
      {/* urgency tape */}
      <div
        className="wp-tape"
        style={{
          height: 4,
          width: '100%',
          background: `linear-gradient(90deg, ${u.strip} 0%, ${u.strip} 46%, rgba(255,255,255,0.06) calc(46% + 10px))`,
        }}
      />
      {/* head row — tappable */}
      <div
        onClick={() => setExpanded((e) => !e)}
        role="button"
        aria-expanded={expanded}
        style={{
          padding: '13px 15px 11px',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em',
              color: u.strip === '#33CBA7' ? '#5EEAD4' : u.strip === '#F5A524' ? '#FCD34D' : '#FCA5A5',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isDelivery ? <Truck size={15} /> : <Utensils size={15} />}
            {isDelivery ? 'DL-' : 'TB-'}{String(order.id).padStart(3, '0')}
          </span>
          <span
            className={mins >= 8 ? 'wp-timer wp-timer-live' : 'wp-timer'}
            style={{
              fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999,
              color: '#fff', background: u.strip,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <Clock size={11} strokeWidth={3} />
            {mins}m · {u.label}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 9 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 16.5, fontWeight: 800, color: '#F1F5F9',
              lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isDelivery
                ? (order.customer_name || 'Home delivery')
                : `Table ${order.table_name || order.customer_name || 'Counter'}`}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#8A94A8', display: 'flex', gap: 5, alignItems: 'center' }}>
              <Gift size={11} />
              {items.length} item{items.length !== 1 ? 's' : ''}{isCashPending && ' · 💵 cash due'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <span style={{ fontSize: 16.5, fontWeight: 800, color: '#F1F5F9' }}>{fmt(order.total)}</span>
            <span
              style={{
                width: 28, height: 28, borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.06)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform .25s ease',
              }}
            >
              <ChevronDown size={15} color="#8A94A8" />
            </span>
          </div>
        </div>
      </div>

      {/* expandable body */}
      <div
        style={{
          maxHeight: expanded ? 650 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ padding: '0 15px 4px' }}>
          {isDelivery && (order.customer_phone || order.delivery_address) && (
            <div className="wp-box">
              <p className="wp-box-label"><MapPin size={11} /> Drop-off</p>
              {order.customer_phone && (
                <a
                  href={`tel:${String(order.customer_phone).replace(/\s+/g, '')}`}
                  className="wp-box-row"
                  style={{ textDecoration: 'none', color: '#7DD3FC', fontWeight: 700 }}
                >
                  <Phone size={13} /> {order.customer_phone}
                </a>
              )}
              {order.customer_name && (
                <p className="wp-box-row" style={{ margin: '4px 0' }}><User size={13} /> {order.customer_name}</p>
              )}
              <p className="wp-box-row" style={{ alignItems: 'flex-start', margin: '4px 0 0', lineHeight: 1.5 }}>
                <MapPin size={13} style={{ marginTop: 2, flexShrink: 0 }} />
                <span>{order.delivery_address}</span>
              </p>
            </div>
          )}

          <div className="wp-box wp-box-items">
            <p className="wp-box-label" style={{ color: '#94A3B8' }}>Ticket</p>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline',
                  padding: '5px 0',
                  borderBottom: idx < items.length - 1 ? '1px dashed rgba(255,255,255,0.08)' : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: '#E2E8F0' }}>
                  <b style={{ color: u.strip, marginRight: 6 }}>{item.quantity || item.qty || 1}×</b>
                  {item.name}
                  {item.note && (
                    <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', paddingLeft: 24, marginTop: 1 }}>
                      ↳ {item.note}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: '#8A94A8', whiteSpace: 'nowrap' }}>{fmt(item.price)}</span>
              </div>
            ))}
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.10)', marginTop: 7, paddingTop: 8,
                display: 'flex', justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9' }}>{fmt(order.total)}</span>
            </div>
          </div>

          {isCashPending && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(245,165,36,0.10)', border: '1px solid rgba(245,165,36,0.35)',
                borderRadius: 12, padding: '10px 13px', marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Banknote size={16} /> Collect cash at the door
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#FCD34D' }}>{fmt(order.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div style={{ padding: '6px 15px 15px' }}>
        {isCashPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => onServed(order.id, true)}
              disabled={isDelivering}
              className={isDelivering ? '' : 'wp-glow-btn'}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 13, border: 'none',
                cursor: isDelivering ? 'wait' : 'pointer',
                background: isDelivering
                  ? 'rgba(51,203,167,0.35)'
                  : 'linear-gradient(135deg, #0FA97F 0%, #2DD4A0 100%)',
                color: '#06251C', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Banknote size={18} />
              {isDelivering ? 'Saving…' : `Collect ${fmt(order.total)} & Complete`}
            </button>
            <button
              onClick={() => onServed(order.id, false)}
              disabled={isDelivering}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: 13,
                border: '1px solid rgba(255,255,255,0.12)', background: 'transparent',
                color: '#AEB8CC', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                cursor: isDelivering ? 'wait' : 'pointer',
              }}
            >
              <CheckCircle2 size={15} /> Mark delivered · pay later
            </button>
          </div>
        ) : (
          <button
            onClick={() => onServed(order.id, false)}
            disabled={isDelivering}
            className={isDelivering ? '' : 'wp-glow-btn'}
            style={{
              width: '100%', padding: '15px 16px', borderRadius: 13, border: 'none',
              cursor: isDelivering ? 'wait' : 'pointer',
              background: isDelivering
                ? 'rgba(51,203,167,0.35)'
                : 'linear-gradient(135deg, #0FA97F 0%, #2DD4A0 100%)',
              color: '#06251C', fontSize: 15, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}
          >
            <CheckCircle2 size={19} strokeWidth={2.5} />
            {isDelivering ? 'Marking…' : 'Mark Served'}
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

  const refreshAll = useCallback(() => {
    fetchReadyOrders();
    fetchServedToday();
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

  const initials = (user.name || 'W')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const dineInCount = readyOrders.filter((o) => String(o.type || '').toUpperCase() !== 'DELIVERY').length;
  const deliveryCount = readyOrders.length - dineInCount;
  const cashDue = readyOrders.filter((o) => o.payment_method === 'cash' && o.payment_status === 'cash_pending');
  const cashDueTotal = cashDue.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const filtered = filter === 'delivery'
    ? readyOrders.filter((o) => String(o.type || '').toUpperCase() === 'DELIVERY')
    : filter === 'dinein'
      ? readyOrders.filter((o) => String(o.type || '').toUpperCase() !== 'DELIVERY')
      : readyOrders;

  return (
    <div
      className="wp-root"
      style={{
        minHeight: '100dvh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap');
        .wp-root{
          background:
            radial-gradient(900px 420px at 85% -10%, rgba(245,165,36,0.10), transparent 60%),
            radial-gradient(700px 480px at -10% 30%, rgba(14,116,144,0.16), transparent 60%),
            linear-gradient(180deg, #0B1020 0%, #0E1526 55%, #0B1020 100%);
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes wpSlideDown { from{ transform:translateY(-16px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
        @keyframes wpIn { from{ transform:translateY(14px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
        @keyframes wpBounce { 0%,100%{ transform:translateY(0);} 30%{ transform:translateY(-5px);} 60%{ transform:translateY(-2px);} }
        .wp-in{ animation: wpIn .35s cubic-bezier(0.22,1,0.36,1) both; }
        .wp-tab{
          min-height:46px; padding:0 15px; border-radius:13px; cursor:pointer;
          display:inline-flex; align-items:center; gap:7px;
          font-size:13px; font-weight:800; letter-spacing:0.01em;
          background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.09);
          color:#AEB8CC; transition:all .18s ease;
        }
        .wp-tab:hover{ background:rgba(255,255,255,0.10); color:#F1F5F9; }
        .wp-tab.is-active{ background:linear-gradient(135deg,#F59E0B 0%,#F97316 100%); border-color:transparent; color:#1F1308; }
        .wp-tab-count{
          font-size:10.5px; font-weight:900; padding:2px 7px; border-radius:999px;
          background:rgba(0,0,0,0.14); min-width:18px; text-align:center;
        }
        .wp-tab:not(.is-active) .wp-tab-count{ background:rgba(255,255,255,0.09); color:#AEB8CC; }
        .wp-box{ background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.07); border-radius:13px; padding:11px 13px; margin:11px 0 12px; }
        .wp-box-label{ display:flex; align-items:center; gap:5px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#7DD3FC; margin:0 0 6px; }
        .wp-box-items{ margin-bottom:12px; }
        .wp-box-items .wp-box-label{ color:#94A3B8; }
        .wp-box-row{ display:flex; align-items:center; gap:7px; font-size:13.5px; color:#E2E8F0; }
        .wp-glow-btn{ box-shadow:0 8px 22px -8px rgba(45,212,160,0.65); transition:transform .15s ease, box-shadow .15s ease, filter .15s ease; }
        .wp-glow-btn:hover{ filter:brightness(1.06); }
        .wp-glow-btn:active{ transform:scale(0.985); }
        .wp-timer-live{ animation:blink 1.1s ease-in-out infinite; }
        .wp-ticket:hover .wp-tape{ background-size:100% 100% !important; }
        @media (min-width:1024px){ .wp-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; } }
        @media (prefers-reduced-motion: reduce){
          .wp-in,.wp-timer-live{ animation:none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(11,16,32,0.88)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '14px 16px 12px',
        }}
      >
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                color: '#1F1308', fontWeight: 900, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 21px -8px rgba(245,158,11,0.8)',
              }}
            >
              {initials || <Flame size={18} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17.5, fontWeight: 900, color: '#F1F5F9', lineHeight: 1.15 }}>
                {greeting}, {user.name || 'Waiter'} 🍽️
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8A94A8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: online ? '#2DD4A0' : '#F4502C',
                    animation: 'blink 1.4s ease-in-out infinite', display: 'inline-block',
                  }}
                />
                {online ? 'Live · auto-refresh 10s' : 'Offline — showing last update'}
                {readyOrders.length > 0
                  ? ` · ${readyOrders.length} on the pass`
                  : ''}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#F1F5F9', fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
              {dayLabel(new Date(now))}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8A94A8' }}>
              KDS · Service Line
            </p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px 12px 90px' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'sticky', top: 74, zIndex: 60 }}>
            <div
              style={{
                marginBottom: 12,
                padding: '13px 16px',
                borderRadius: 15,
                background: toast.type === 'error'
                  ? 'linear-gradient(135deg, #DC2626 0%, #F4502C 100%)'
                  : 'linear-gradient(135deg, #0FA97F 0%, #2DD4A0 100%)',
                color: toast.type === 'error' ? '#fff' : '#06251C',
                fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 14px 34px -14px rgba(0,0,0,0.6)',
                animation: 'wpSlideDown .3s ease both',
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              {toast.msg}
            </div>
          </div>
        )}

        {/* Metric strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9, marginBottom: 14 }}>
          {[
            { label: 'On pass', value: readyOrders.length, tint: '#FCD34D', icon: Bell },
            { label: 'Dine-in', value: dineInCount, tint: '#7DD3FC', icon: Utensils },
            { label: 'Delivery', value: deliveryCount, tint: '#A78BFA', icon: Truck },
            { label: 'Cash due', value: fmt(cashDueTotal), tint: '#FCA5A5', icon: Banknote, plain: true },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: 'rgba(255,255,255,0.045)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 15,
                padding: '11px 8px 9px',
                textAlign: 'center',
              }}
            >
              <p style={{
                margin: 0, fontWeight: 900, lineHeight: 1.05,
                fontSize: m.plain ? 12.5 : 21,
                color: m.tint,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {m.value}
              </p>
              <p style={{
                margin: '3px 0 0', fontSize: 10, fontWeight: 800, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: '#8A94A8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
                <m.icon size={10} /> {m.label}
              </p>
            </div>
          ))}
        </div>

        {/* New-order alert */}
        {newAlert && (
          <div style={{ marginBottom: 14, borderRadius: 18, animation: 'wpBounce .55s ease' }}>
            <div
              style={{
                borderRadius: 18, padding: '13px 15px',
                background: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
                color: '#1F1308', display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 18px 40px -16px rgba(245,158,11,0.75)',
              }}
            >
              <div
                style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: 'rgba(31,19,8,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Bell size={21} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>
                  New ready order #{newAlert.id}!
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
                  {newAlert.table_name
                    ? `Table ${newAlert.table_name}`
                    : (newAlert.customer_name || 'Home delivery')}
                </p>
              </div>
              {(() => {
                const isNewDelivery = String(newAlert.type || '').toUpperCase() === 'DELIVERY';
                return isNewDelivery ? null : (
                  <span style={{ fontSize: 11.5, fontWeight: 900, background: 'rgba(31,19,8,0.18)', borderRadius: 999, padding: '5px 11px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    See below
                  </span>
                );
              })()}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none' }}>
          {[
            { id: 'all',      label: 'All',      icon: Package,   count: readyOrders.length },
            { id: 'dinein',   label: 'Dine-In',  icon: Utensils,  count: dineInCount },
            { id: 'delivery', label: 'Delivery', icon: Truck,     count: deliveryCount },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`wp-tab${filter === t.id ? ' is-active' : ''}`}
            >
              <t.icon size={14} />
              {t.label}
              <span className="wp-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Served-today summary chip */}
        {servedToday.length > 0 && (
          <button
            type="button"
            onClick={() => setShowServed((v) => !v)}
            style={{
              width: '100%', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 15px', borderRadius: 14, cursor: 'pointer',
              background: 'rgba(45,212,160,0.07)',
              border: '1px solid rgba(45,212,160,0.22)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, fontWeight: 800, color: '#2DD4A0' }}>
              <CheckCircle2 size={16} />
              {servedToday.length} served today
            </span>
            <span
              style={{
                fontSize: 11, color: '#8A94A8', fontWeight: 700,
                transform: showServed ? 'rotate(180deg)' : 'none', transition: 'transform .25s',
              }}
            >
              {showServed ? 'hide ▲' : 'show ▼'}
            </span>
          </button>
        )}

        {/* Served-today log */}
        {showServed && servedToday.length > 0 && (
          <div style={{ marginBottom: 16, padding: '6px 10px', borderRadius: 15, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', animation: 'wpIn .3s ease both' }}>
            {servedToday.slice(0, 6).map((o) => {
              const isDelivery = String(o.type || '').toUpperCase() === 'DELIVERY';
              return (
                <div
                  key={o.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, padding: '8px 6px',
                    borderBottom: '1px dashed rgba(255,255,255,0.07)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {isDelivery ? <Truck size={13} color="#A78BFA" /> : <Utensils size={13} color="#7DD3FC" />}
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#C7D0E0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{o.id} · {isDelivery ? (o.customer_name || 'Delivery') : `Table ${o.table_name || '?'}`}
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: '#8A94A8', whiteSpace: 'nowrap' }}>
                    {fmt(o.total)} · {dayLabel(new Date(o.updated_at || o.timestamp))}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tickets */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center', padding: '58px 24px',
              background: 'rgba(255,255,255,0.035)', borderRadius: 22,
              border: '1px dashed rgba(255,255,255,0.12)', animation: 'wpIn .35s ease both',
            }}
          >
            <div
              style={{
                width: 74, height: 74, borderRadius: 23, margin: '0 auto 16px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(249,115,22,0.08))',
                border: '1px solid rgba(245,158,11,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Sparkles size={32} color="#FCD34D" />
            </div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#F1F5F9' }}>
              {readyOrders.length === 0 ? 'Pantry’s calm 🎉' : `No ${filter} orders on the pass`}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: '#8A94A8', lineHeight: 1.65, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
              {readyOrders.length === 0
                ? 'Every order has been served. New tickets appear on the pass the moment admin pushes them to you — no refresh needed.'
                : 'Switch tabs above to see the other order types.'}
            </p>
            <p style={{ margin: '18px 0 0', fontSize: 11, color: '#5E6A80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: online ? '#2DD4A0' : '#F4502C',
                  animation: 'blink 1.4s infinite', display: 'inline-block',
                }}
              />
              {online ? 'Connected to kitchen pass' : 'Offline — last synced snapshot'}
            </p>
          </div>
        ) : (
          <div className="wp-grid" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filtered.map((order) => (
              <div key={order.id} className="wp-in">
                <Ticket
                  order={order}
                  fmt={fmt}
                  now={now}
                  onServed={handleServed}
                  isDelivering={!!delivering[order.id]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── iOS home-bar safe area ── */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
};

export default WaiterDeliveryPanel;
