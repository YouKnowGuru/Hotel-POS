import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAPI_URL, getSocketUrl, authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import {
  Bell, CheckCircle2, Clock, Utensils, Banknote,
  Truck, MapPin, Phone, User, ChefHat, Sparkles,
  ArrowRight, Package, AlertCircle, Wifi, WifiOff,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Tiny helpers
───────────────────────────────────────────────────────────── */
const minsAgo = (ts) =>
  Math.max(0, Math.round((Date.now() - new Date(ts || Date.now()).getTime()) / 60000));

const urgencyColor = (mins) => {
  if (mins >= 15) return { ring: '#EF4444', bg: '#FEF2F2', text: '#DC2626', label: 'URGENT' };
  if (mins >= 8)  return { ring: '#F59E0B', bg: '#FFFBEB', text: '#D97706', label: 'WAITING' };
  return              { ring: '#10B981', bg: '#ECFDF5', text: '#059669', label: 'READY' };
};

/* ─────────────────────────────────────────────────────────────
   Order card — full-width, large-tap-target, mobile-first
───────────────────────────────────────────────────────────── */
const OrderCard = ({ order, fmt, onServed, isDelivering }) => {
  const [expanded, setExpanded] = useState(false);
  const mins = minsAgo(order.updated_at || order.timestamp);
  const urgency = urgencyColor(mins);
  const isDelivery = String(order.type || '').toUpperCase() === 'DELIVERY';
  const isCashPending =
    order.payment_method === 'cash' && order.payment_status === 'cash_pending';
  const items = order.items || [];

  return (
    <div
      className="waiter-card"
      style={{
        borderLeft: `4px solid ${urgency.ring}`,
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: `0 2px 16px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)`,
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* ── Card top ── */}
      <div
        className="waiter-card-header"
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: '14px 16px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Row 1: order id + urgency badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em' }}>
            ORDER #{order.id}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '3px 10px',
              borderRadius: 999,
              background: urgency.bg,
              color: urgency.text,
              border: `1px solid ${urgency.ring}40`,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: urgency.ring,
                animation: 'blink 1.4s ease-in-out infinite',
              }}
            />
            {urgency.label}
          </span>
        </div>

        {/* Row 2: table/name + type icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 42, height: 42, borderRadius: 14,
              background: isDelivery ? '#EEF2FF' : '#F0FDF4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDelivery
              ? <Truck size={20} color="#6366F1" />
              : <Utensils size={20} color="#16A34A" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isDelivery
                ? (order.customer_name || 'Home Delivery')
                : `Table ${order.table_name || order.customer_name || 'Counter'}`}
            </p>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <Clock size={11} />
              {mins === 0 ? 'Just now' : `${mins} min ago`}
              &nbsp;·&nbsp;
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Total + expand caret */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: 0 }}>{fmt(order.total)}</p>
            <p style={{
              fontSize: 11, color: '#94A3B8', margin: 0, marginTop: 1,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>
              ▼
            </p>
          </div>
        </div>
      </div>

      {/* ── Expandable details ── */}
      <div
        style={{
          maxHeight: expanded ? 600 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{ padding: '0 16px 4px', borderTop: '1px solid #F1F5F9' }}>
          {/* Delivery address block */}
          {isDelivery && (order.customer_phone || order.delivery_address) && (
            <div
              style={{
                marginTop: 12,
                background: '#EEF2FF',
                borderRadius: 14,
                padding: '12px 14px',
                marginBottom: 4,
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6366F1', marginBottom: 8 }}>
                📍 Delivery Info
              </p>
              {order.customer_name && (
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <User size={13} color="#6366F1" /> {order.customer_name}
                </p>
              )}
              {order.customer_phone && (
                <a
                  href={`tel:${String(order.customer_phone).replace(/\s+/g, '')}`}
                  style={{ fontSize: 14, fontWeight: 700, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, textDecoration: 'none' }}
                >
                  <Phone size={14} color="#4F46E5" /> {order.customer_phone}
                </a>
              )}
              {order.delivery_address && (
                <p style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'flex-start', gap: 7, margin: 0 }}>
                  <MapPin size={13} color="#6366F1" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{order.delivery_address}</span>
                </p>
              )}
            </div>
          )}

          {/* Items list */}
          <div style={{ marginTop: 12, background: '#F8FAFC', borderRadius: 14, padding: '10px 12px', marginBottom: 12 }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: 8 }}>
              Items
            </p>
            {items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: idx < items.length - 1 ? 6 : 0,
                  marginBottom: idx < items.length - 1 ? 6 : 0,
                  borderBottom: idx < items.length - 1 ? '1px solid #E2E8F0' : 'none',
                }}
              >
                <span style={{ fontSize: 13, color: '#1E293B', fontWeight: 500 }}>
                  <span style={{ fontWeight: 800, color: '#6366F1', marginRight: 5 }}>
                    {item.quantity || item.qty || 1}×
                  </span>
                  {item.name}
                  {item.note && <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.note}</span>}
                </span>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {fmt(item.price)}
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #CBD5E1', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Total</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{fmt(order.total)}</span>
            </div>
          </div>

          {/* Cash notice */}
          {isCashPending && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#FFFBEB', borderRadius: 12, padding: '10px 14px',
                border: '1px solid #FDE68A', marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Banknote size={16} color="#D97706" /> Collect Cash
              </span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#78350F' }}>{fmt(order.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Action buttons — always visible, full width ── */}
      <div style={{ padding: '12px 16px 16px' }}>
        {isCashPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => onServed(order.id, true)}
              disabled={isDelivering}
              style={{
                width: '100%', padding: '14px 16px',
                borderRadius: 14, border: 'none', cursor: isDelivering ? 'not-allowed' : 'pointer',
                background: isDelivering ? '#6EE7B7' : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                color: '#fff', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: isDelivering ? 'none' : '0 4px 14px rgba(16,185,129,0.4)',
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Banknote size={18} />
              {isDelivering ? 'Saving…' : `Collect ${fmt(order.total)} & Mark Served`}
            </button>
            <button
              onClick={() => onServed(order.id, false)}
              disabled={isDelivering}
              style={{
                width: '100%', padding: '11px 16px',
                borderRadius: 14, border: '1.5px solid #E2E8F0', cursor: isDelivering ? 'not-allowed' : 'pointer',
                background: '#F8FAFC', color: '#475569',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'all 0.15s ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <CheckCircle2 size={15} />
              Mark Served (Pay Later)
            </button>
          </div>
        ) : (
          <button
            onClick={() => onServed(order.id, false)}
            disabled={isDelivering}
            style={{
              width: '100%', padding: '15px 16px',
              borderRadius: 14, border: 'none', cursor: isDelivering ? 'not-allowed' : 'pointer',
              background: isDelivering
                ? '#6EE7B7'
                : 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
              color: '#fff', fontSize: 15, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: isDelivering ? 'none' : '0 4px 18px rgba(34,197,94,0.45)',
              transition: 'all 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
              letterSpacing: '0.01em',
            }}
          >
            <CheckCircle2 size={20} />
            {isDelivering ? 'Marking served…' : 'Mark as Served ✓'}
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
  const [toast, setToast]             = useState(null);
  const [delivering, setDelivering]   = useState({});
  const [newAlert, setNewAlert]       = useState(null);
  const [online, setOnline]           = useState(navigator.onLine);
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

  useEffect(() => {
    fetchReadyOrders();
    const poll = setInterval(fetchReadyOrders, 10000);
    try {
      const socket = io(getSocketUrl(), {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;
      socket.on('order_status_updated', fetchReadyOrders);
      socket.on('order_created', fetchReadyOrders);
      socket.on('new_order', fetchReadyOrders);
    } catch { /* non-fatal */ }
    return () => {
      clearInterval(poll);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [fetchReadyOrders]);

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
    } catch {
      showToast('Could not confirm. Please try again.', 'error');
    } finally {
      setDelivering((p) => ({ ...p, [orderId]: false }));
    }
  };

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 12px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        @keyframes alertBounce {
          0%, 100% { transform: translateY(0); }
          25%      { transform: translateY(-4px); }
          75%      { transform: translateY(-2px); }
        }
        .waiter-card:active { transform: scale(0.985); box-shadow: 0 1px 8px rgba(0,0,0,0.1) !important; }
        .waiter-card-header:active { background: #F8FAFC; }
      `}</style>

      {/* ── Sticky Header ── */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(15,23,42,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '14px 16px 12px',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left: title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.5)',
                  animation: 'pulse-ring 2.5s ease-out infinite',
                }}
              >
                <ChefHat size={20} color="#fff" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>
                  Waiter Panel
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {user.name || 'Staff'} · {readyOrders.length > 0
                    ? `${readyOrders.length} order${readyOrders.length > 1 ? 's' : ''} waiting`
                    : 'All clear'}
                </p>
              </div>
            </div>

            {/* Right: online + live badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!online && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px',
                  borderRadius: 999, background: '#FEF2F2', color: '#DC2626',
                  border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <WifiOff size={10} /> Offline
                </span>
              )}
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 12px',
                  borderRadius: 999, background: 'rgba(16,185,129,0.15)',
                  color: '#34D399', border: '1px solid rgba(52,211,153,0.25)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span
                  style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#10B981',
                    animation: 'blink 1.4s ease-in-out infinite',
                  }}
                />
                LIVE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 12px 100px' }}>

        {/* Toast */}
        {toast && (
          <div
            style={{
              marginBottom: 12,
              padding: '14px 16px',
              borderRadius: 16,
              background: toast.type === 'error'
                ? 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)'
                : 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#fff',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: toast.type === 'error'
                ? '0 4px 20px rgba(220,38,38,0.4)'
                : '0 4px 20px rgba(16,185,129,0.4)',
              animation: 'slideDown 0.3s ease',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            {toast.msg}
          </div>
        )}

        {/* New order alert banner */}
        {newAlert && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 32px rgba(79,70,229,0.5)',
              animation: 'alertBounce 0.6s ease',
            }}
          >
            <div
              style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bell size={22} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
                🔔 Order #{newAlert.id} is READY!
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
                {newAlert.table_name
                  ? `Table ${newAlert.table_name}`
                  : (newAlert.customer_name || 'Home Delivery')}
                {' '}— tap the card below to serve
              </p>
            </div>
            <button
              onClick={() => handleServed(newAlert.id)}
              style={{
                flexShrink: 0, padding: '10px 14px',
                borderRadius: 12, border: 'none', cursor: 'pointer',
                background: '#fff', color: '#4F46E5',
                fontSize: 12, fontWeight: 800,
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              Serve ✓
            </button>
          </div>
        )}

        {/* Count strip */}
        {readyOrders.length > 0 && (
          <div
            style={{
              display: 'flex', gap: 8, marginBottom: 14,
              overflowX: 'auto', paddingBottom: 4,
              scrollbarWidth: 'none',
            }}
          >
            {[
              { label: 'Total', value: readyOrders.length, color: '#6366F1', bg: '#EEF2FF' },
              { label: 'Dine-In', value: readyOrders.filter(o => String(o.type||'').toUpperCase() !== 'DELIVERY').length, color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Delivery', value: readyOrders.filter(o => String(o.type||'').toUpperCase() === 'DELIVERY').length, color: '#D97706', bg: '#FFFBEB' },
              { label: 'Cash Due', value: readyOrders.filter(o => o.payment_method === 'cash' && o.payment_status === 'cash_pending').length, color: '#DC2626', bg: '#FEF2F2' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  flexShrink: 0, padding: '8px 14px',
                  borderRadius: 12, background: s.bg,
                  border: `1px solid ${s.color}25`,
                  textAlign: 'center',
                  minWidth: 72,
                }}
              >
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.7, marginTop: 2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Orders list */}
        {readyOrders.length === 0 ? (
          <div
            style={{
              textAlign: 'center', padding: '64px 24px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              animation: 'slideUp 0.4s ease',
            }}
          >
            <div
              style={{
                width: 72, height: 72, borderRadius: 22,
                background: 'rgba(99,102,241,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Sparkles size={32} color="#818CF8" />
            </div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#E2E8F0', marginBottom: 8 }}>
              All clear! 🎉
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#64748B', lineHeight: 1.6 }}>
              No orders ready right now.{'\n'}
              Orders will pop up the moment admin approves them.
            </p>
            <p style={{ margin: '16px 0 0', fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <span
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', animation: 'blink 1.4s infinite', display: 'inline-block' }}
              />
              Live — auto-refreshes every 10s
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {readyOrders.map((order) => (
              <div key={order.id} style={{ animation: 'slideUp 0.3s ease' }}>
                <OrderCard
                  order={order}
                  fmt={fmt}
                  onServed={handleServed}
                  isDelivering={!!delivering[order.id]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom safe-area spacer for iOS home bar ── */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  );
};

export default WaiterDeliveryPanel;
