import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ShoppingBag, Plus, Minus, X, CheckCircle2,
  Search, Zap, ArrowRight, Sparkles, Timer, Utensils,
  Soup, Pizza, Coffee, Cookie, IceCream,
  Trash2, ChevronRight, Star, Flame, Receipt, Clock,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import { calculateOrderTotals, fetchAndCacheGlobalSettings } from '../utils/orderTotals';
import { formatTableName, tableIdMatches, isActiveTableOrder } from '../utils/tableOrderUtils';
import useCurrency from '../hooks/useCurrency';

const CAT_ICONS = {
  All: Sparkles, Starters: Soup, Biryani: Flame, 'Main Course': Utensils,
  Chinese: Pizza, Breads: Cookie, Desserts: IceCream, Beverages: Coffee,
};

const CAT = {
  Starters:      { g1: '#10b981', g2: '#34d399', emoji: '🥗' },
  Biryani:       { g1: '#f59e0b', g2: '#fbbf24', emoji: '🍚' },
  'Main Course': { g1: '#8b5cf6', g2: '#a78bfa', emoji: '🍛' },
  Chinese:       { g1: '#f43f5e', g2: '#fb7185', emoji: '🥟' },
  Breads:        { g1: '#eab308', g2: '#facc15', emoji: '🍞' },
  Desserts:      { g1: '#ec4899', g2: '#f472b6', emoji: '🍰' },
  Beverages:     { g1: '#0ea5e9', g2: '#38bdf8', emoji: '🥤' },
};
const DEF = { g1: '#f97316', g2: '#fb923c', emoji: '🍽️' };
const catOf = (c) => CAT[c] || DEF;

const STATUS = {
  pending:   { label: 'Order Received', Icon: Timer,      c: '#f59e0b', bg: 'rgba(245,158,11,0.08)', pct: 20 },
  preparing: { label: 'Cooking',       Icon: Flame,     c: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', pct: 45 },
  ready:     { label: 'Ready to Serve', Icon: Sparkles,  c: '#22c55e', bg: 'rgba(34,197,94,0.08)',  pct: 70 },
  delivered: { label: 'Served',         Icon: CheckCircle2, c: '#3b82f6', bg: 'rgba(59,130,246,0.08)', pct: 85 },
  completed: { label: 'Paid',           Icon: CheckCircle2, c: '#22c55e', bg: 'rgba(34,197,94,0.08)',  pct: 100 },
};

// ---------------------------------------------------------------------------
// Per-device session helpers
// Each customer device gets a unique session key stored in localStorage.
// Only order IDs that THIS device placed are tracked, so multiple phones
// scanning the same table QR never see each other's order history.
// ---------------------------------------------------------------------------
function getSessionKey(tableId) {
  return `qrSession:${formatTableName(tableId || '1')}`;
}
function getSessionOrdersKey(tableId) {
  return `qrOrders:${formatTableName(tableId || '1')}`;
}
/** Returns or creates a stable session token for this device+table combo. */
function ensureSession(tableId) {
  const key = getSessionKey(tableId);
  let token = localStorage.getItem(key);
  if (!token) {
    token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
}
/** Get the Set of order IDs this device has placed. */
function getLocalOrderIds(tableId) {
  try {
    const raw = localStorage.getItem(getSessionOrdersKey(tableId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
/** Persist a new order ID for this device. */
function addLocalOrderId(tableId, orderId) {
  const ids = getLocalOrderIds(tableId);
  ids.add(Number(orderId));
  localStorage.setItem(getSessionOrdersKey(tableId), JSON.stringify([...ids]));
}

export default function SimpleMenu({ tableId, onOrderPlaced, locationSettings }) {
  const { format: fmt } = useCurrency(locationSettings);
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ taxPercent: 5, discountPercent: 0 });
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [boom, setBoom] = useState(false);
  const [ripple, setRipple] = useState(null);
  const [flyingItem, setFlyingItem] = useState(null);
  const [spotlightIdx, setSpotlightIdx] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [billRequestedId, setBillRequestedId] = useState(null);
  const [expandedBills, setExpandedBills] = useState({});
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paymentQr, setPaymentQr] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const searchRef = useRef(null);
  const cartBtnRef = useRef(null);

  // Ensure this device has a session token (runs once on mount).
  useEffect(() => { ensureSession(tableId); }, [tableId]);

  useEffect(() => { fetchAndCacheGlobalSettings().then(setSettings); }, []);

  useEffect(() => {
    if (!paymentOrder) return;
    setPaymentQr('');
    fetch(`${getAPI_URL()}/api/settings?key=payment_qr_image`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.value && /^data:image\/(png|jpe?g|webp);base64,/i.test(data.value)) setPaymentQr(data.value);
        else setPaymentError('Payment QR is not configured. Please ask restaurant staff for assistance.');
      })
      .catch(() => setPaymentError('Could not load the restaurant payment QR.'));
  }, [paymentOrder]);

  useEffect(() => {
    fetch(`${getAPI_URL()}/api/menu`).then(r => r.json()).then(data => {
      const av = (data || []).filter(i => i.isAvailable !== false);
      setItems(av);
      const c = [...new Set(av.map(i => i.category).filter(Boolean))];
      setCats(c); setCat(c[0] || ''); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const t = tableId || '1';
      const r = await fetch(`${getAPI_URL()}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(formatTableName(t))}`);
      const d = await r.json();
      if (Array.isArray(d)) {
        // Filter to only orders placed by THIS device so customers on the same
        // table QR don't see each other's order history.
        const localIds = getLocalOrderIds(t);
        const myOrders = localIds.size > 0
          ? d.filter(o => tableIdMatches(t, o.table_name) && isActiveTableOrder(o) && localIds.has(Number(o.id)))
          : []; // new device — show nothing until an order is placed
        setOrders(myOrders);
      }
    } catch (_) { }
  }, [tableId]);

  useEffect(() => { fetchOrders(); const id = setInterval(fetchOrders, 4000); return () => clearInterval(id); }, [fetchOrders]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const totals = calculateOrderTotals(subtotal, settings);

  const catCounts = useMemo(() => {
    const counts = { '': items.length };
    items.forEach(i => { if (i.category) counts[i.category] = (counts[i.category] || 0) + 1; });
    return counts;
  }, [items]);

  const addToCart = (item, e) => {
    if (e) {
      const r = e.currentTarget.getBoundingClientRect();
      setRipple({ id: item.id, x: e.clientX - r.left, y: e.clientY - r.top });
      setTimeout(() => setRipple(null), 600);

      const cartBtn = cartBtnRef.current;
      if (cartBtn) {
        const cr = cartBtn.getBoundingClientRect();
        setFlyingItem({
          id: item.id,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          tx: cr.left + cr.width / 2,
          ty: cr.top + cr.height / 2,
          emoji: catOf(item.category).emoji,
        });
        setTimeout(() => setFlyingItem(null), 700);
      }
    }
    setCart(p => {
      const ex = p.find(c => c.id === item.id);
      return ex ? p.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c) : [...p, { ...item, qty: 1 }];
    });
  };

  const updQty = (id, qty) => setCart(p => qty <= 0 ? p.filter(c => c.id !== id) : p.map(c => c.id === id ? { ...c, qty } : c));

  const removeItem = (id) => {
    setRemovingId(id);
    setTimeout(() => { setCart(p => p.filter(c => c.id !== id)); setRemovingId(null); }, 300);
  };

  const requestBill = async (orderId) => {
    try {
      setBillRequestedId(orderId);
      const res = await fetch(`${getAPI_URL()}/api/orders/${orderId}/request-bill`, { method: 'PUT' });
      const data = await res.json();
      setTimeout(() => { fetchOrders(); setBillRequestedId(null); setExpandedBills(p => ({ ...p, [orderId]: true })); }, 800);
    } catch (_) { setBillRequestedId(null); }
  };

  const toggleBill = (orderId) => setExpandedBills(p => ({ ...p, [orderId]: !p[orderId] }));

  const placeOrder = async () => {
    if (!cart.length || placing) return;
    setPlacing(true);
    try {
      const s = await fetchAndCacheGlobalSettings();
      const sub = cart.reduce((a, i) => a + i.price * i.qty, 0);
      const t = calculateOrderTotals(sub, s);
      const res = await fetch(`${getAPI_URL()}/api/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: formatTableName(tableId),
          items: cart.map(i => ({ menuItemId: i.id, name: i.name, quantity: i.qty, price: i.price })),
          subtotal: t.subtotal, discount: t.discountPercent, discountAmount: t.discountAmount,
          taxPercent: t.taxPercent, taxAmount: t.taxAmount, total: t.total, type: 'DINE_IN', payment_first: true,
        }),
      });
      const order = await res.json();
      if (order.id) {
        // Register this order ID with the current device's session so that
        // fetchOrders will include it for THIS device only.
        addLocalOrderId(tableId, order.id);
        localStorage.setItem(`paymentAccess:${order.id}`, order.paymentAccessToken || '');
        setCart([]); setCartOpen(false); setPaymentOrder(order); fetchOrders();
      }
    } catch (_) { }
    setPlacing(false);
  };

  const selectProof = (file) => {
    setPaymentError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setPaymentError('Please choose a PNG, JPG, or WebP screenshot smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProofImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submitPaymentProof = async () => {
    if (!proofImage || !paymentOrder || submittingProof) {
      setPaymentError('Upload your payment screenshot before submitting.'); return;
    }
    setSubmittingProof(true); setPaymentError('');
    try {
      const res = await fetch(`${getAPI_URL()}/api/orders/${paymentOrder.id}/payment-proof`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccessToken: paymentOrder.paymentAccessToken, proofImage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not submit payment proof');
      setPaymentOrder(null); setBoom(true); setTimeout(() => setBoom(false), 3500); fetchOrders();
      if (onOrderPlaced) onOrderPlaced({ ...paymentOrder, payment_status: 'verification_pending' });
    } catch (e) { setPaymentError(e.message || 'Could not submit payment proof'); }
    finally { setSubmittingProof(false); }
  };

  const openPayment = async (order) => {
    setPaymentError('');
    setProofImage('');
    try {
      let token = localStorage.getItem(`paymentAccess:${order.id}`);
      if (!token) {
        const response = await fetch(`${getAPI_URL()}/api/orders/${order.id}/payment-session?tableId=${encodeURIComponent(formatTableName(tableId))}`);
        const session = await response.json();
        if (!response.ok || !session.paymentAccessToken) throw new Error(session.message || 'Payment session is unavailable. Refresh the menu and try again.');
        token = session.paymentAccessToken;
        localStorage.setItem(`paymentAccess:${order.id}`, token);
      }
      setPaymentOrder({ ...order, paymentAccessToken: token });
    } catch (error) {
      setPaymentError(error.message || 'Could not open payment. Please refresh and try again.');
    }
  };

  const filtered = items.filter(i => (!cat || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const grouped = cat || q
    ? { '': filtered }
    : items.reduce((acc, i) => {
      const c = i.category || 'Other';
      if (i.isAvailable !== false) { acc[c] = acc[c] || []; acc[c].push(i); }
      return acc;
    }, {});

  const firstItems = Object.values(grouped).flat().slice(0, 3);
  useEffect(() => {
    if (firstItems.length < 2) return;
    const id = setInterval(() => setSpotlightIdx(p => (p + 1) % firstItems.length), 5000);
    return () => clearInterval(id);
  }, [firstItems.length]);

  if (loading) return (
    <div style={s.root}>
      <style>{CSS}</style>
      <div style={s.bgOrb1} /><div style={s.bgOrb2} /><div style={s.bgOrb3} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={s.skelHeader}>
          <div style={s.skelCircle} />
          <div><div style={{ ...s.skelLine, width: 100, height: 16 }} /><div style={{ ...s.skelLine, width: 60, height: 10, marginTop: 6 }} /></div>
        </div>
        <div style={{ ...s.skelLine, width: '85%', height: 44, borderRadius: 12, margin: '12px 16px' }} />
        <div style={s.skelCatRow}>{[1, 2, 3, 4, 5].map(i => <div key={i} style={{ ...s.skelPill, animationDelay: `${i * 80}ms` }} />)}</div>
        <div style={{ height: 180, borderRadius: 24, margin: '0 16px 16px', background: 'rgba(0,0,0,0.03)', overflow: 'hidden', position: 'relative' }}>
          <div style={s.skelShimmer} />
        </div>
        <div style={s.skelGrid}>{[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ ...s.skelCard, animationDelay: `${i * 100}ms` }}>
            <div style={{ ...s.skelCardImg }}><div style={s.skelShimmer} /></div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ ...s.skelLine, width: '70%', height: 12, marginBottom: 6 }} />
              <div style={{ ...s.skelLine, width: '90%', height: 10, marginBottom: 10 }} />
              <div style={{ ...s.skelLine, width: '40%', height: 14 }} />
            </div>
          </div>
        ))}</div>
      </div>
    </div>
  );

  return (
    <div style={s.root}>
      <style>{CSS}</style>
      <div style={s.bgOrb1} /><div style={s.bgOrb2} /><div style={s.bgOrb3} />

      {flyingItem && (
        <div style={{
          position: 'fixed', left: flyingItem.x - 14, top: flyingItem.y - 14,
          width: 28, height: 28, borderRadius: 14, zIndex: 300, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          animation: 'flyToCart 0.6s cubic-bezier(0.2,0.8,0.2,1) forwards',
          '--tx': `${flyingItem.tx - flyingItem.x}px`,
          '--ty': `${flyingItem.ty - flyingItem.y}px`,
        }}>
          {flyingItem.emoji}
        </div>
      )}

      {paymentOrder && (
        <div className="fixed inset-0 z-[500] bg-black/55 overflow-y-auto overscroll-contain p-3 sm:p-6 flex justify-center">
          <div className="w-full max-w-md self-start sm:self-center my-0 sm:my-4 bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🔒</div>
              <h2 className="text-xl font-extrabold text-gray-900">Pay before we prepare your order</h2>
              <p className="text-sm text-gray-500 mt-1">Order #{paymentOrder.id} · Total <b className="text-orange-600">{fmt(paymentOrder.total)}</b></p>
            </div>
            <div className="mt-4 sm:mt-5 rounded-2xl bg-orange-50 border border-orange-100 p-3 sm:p-4 text-center">
              {paymentQr ? <img src={paymentQr} alt="Payment QR code" className="w-48 h-48 sm:w-56 sm:h-56 max-w-full mx-auto bg-white p-2 rounded-xl" /> : <p className="py-16 text-sm text-gray-500">Loading payment QR…</p>}
              <p className="text-xs text-gray-600 mt-3">Scan with your payment app, pay the exact amount, then upload the confirmation screenshot.</p>
            </div>
            <label className="block text-sm font-semibold text-gray-700 mt-4">Payment screenshot</label>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => selectProof(e.target.files?.[0])}
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-2 file:font-semibold file:text-orange-700" />
            {proofImage && <p className="mt-2 text-xs font-medium text-emerald-600">✓ Screenshot attached</p>}
            {paymentError && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{paymentError}</p>}
            <button onClick={submitPaymentProof} disabled={submittingProof}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-sm font-bold text-white shadow hover:shadow-md disabled:opacity-60">
              {submittingProof ? 'Submitting proof…' : 'Submit payment for review'}
            </button>
            <p className="mt-3 text-center text-xs text-gray-500">Your order is sent to the waiter only after admin approval.</p>
          </div>
        </div>
      )}

      {boom && (
        <div style={s.toastWrap}>
          <div style={s.toast}>
            <div style={s.confettiWrap}>
              {['🎉', '✨', '🎊', '🌟', '💫'].map((e, i) => (
                <span key={i} style={{
                  position: 'absolute', fontSize: 16, animation: `confetti${i} 0.8s ease-out forwards`,
                  animationDelay: `${i * 0.06}s`,
                  top: '50%', left: '50%',
                }}>{e}</span>
              ))}
            </div>
            <div style={s.toastIcon}>✅</div>
            <div>
              <p style={s.toastTitle}>Payment proof submitted!</p>
              <p style={s.toastSub}>Waiting for admin review</p>
            </div>
          </div>
        </div>
      )}

      <header className="sm-header" style={s.header}>
        <div style={s.headerRow}>
          <div style={s.headerLeft}>
            <div style={s.brandIcon}>
              <Utensils size={20} color="#fff" />
            </div>
            <div>
              <h1 style={s.brandName}>Our Menu</h1>
            </div>
          </div>
          <button ref={cartBtnRef} aria-label={`Open cart, ${cartCount} items`} style={{ ...s.cartBtn, ...(cartCount ? s.cartBtnActive : {}) }} onClick={() => setCartOpen(true)}>
            <ShoppingBag size={18} />
            {cartCount > 0 && <span style={s.cartCount}>{cartCount}</span>}
          </button>
        </div>
        <div className={searchFocused ? 'sm-search-focus' : ''} style={{ ...s.searchWrap, ...(searchFocused ? s.searchWrapFocus : {}) }}>
          <Search size={15} color={searchFocused ? '#ff3cac' : '#94a3b8'} style={{ transition: 'color 0.2s', flexShrink: 0 }} />
          <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search for dishes..." style={s.searchInput} />
          {q && (
            <button onClick={() => setQ('')} style={s.clearBtn}><X size={13} /></button>
          )}
          {q && <span style={s.searchCount}>{filtered.length} found</span>}
        </div>
      </header>

      {orders.length > 0 && (
        <div className="sm-tracker" style={s.trackerSection}>
          <div style={s.trackerLabel}>
            <span style={s.trackerDot} /> Active Orders
          </div>
          {orders.map((o, oi) => {
            // QR payment approval is not the same as completing the food
            // order. Keep the kitchen status visible until food is served.
            const isPaid = o.status === 'completed' || o.bill?.bill_status === 'paid';
            const paymentApproved = o.payment_status === 'paid' || o.payment_method === 'qr_payment';
            const isDelivered = o.status === 'delivered';
            const billRequested = o.bill_requested;
            const showBillStatus = isDelivered || isPaid;
            const paymentWaiting = ['awaiting_payment', 'verification_pending', 'rejected'].includes(o.payment_status);
            const cfg = o.payment_status === 'awaiting_payment'
              ? { label: 'Payment Required', Icon: Receipt, c: '#f97316', bg: 'rgba(249,115,22,0.08)', pct: 5 }
              : o.payment_status === 'verification_pending'
                ? { label: 'Payment Under Review', Icon: Clock, c: '#f59e0b', bg: 'rgba(245,158,11,0.08)', pct: 12 }
                : o.payment_status === 'rejected'
                  ? { label: 'Payment Rejected', Icon: Receipt, c: '#ef4444', bg: 'rgba(239,68,68,0.08)', pct: 5 }
              : isPaid
              ? STATUS.completed
              : isDelivered && paymentApproved
                ? { label: 'Served', Icon: CheckCircle2, c: '#22c55e', bg: 'rgba(34,197,94,0.08)', pct: 100 }
              : isDelivered && billRequested
                ? { label: 'Bill Requested', Icon: Receipt, c: '#f59e0b', bg: 'rgba(245,158,11,0.08)', pct: 90 }
                : isDelivered
                  ? { label: 'Bill Pending', Icon: Clock, c: '#f97316', bg: 'rgba(249,115,22,0.08)', pct: 85 }
                  : STATUS[o.status] || STATUS.pending;
            const Icon = cfg.Icon;
            const progressPct = isPaid || (isDelivered && paymentApproved) ? 100 : isDelivered && billRequested ? 90 : isDelivered ? 85 : cfg.pct;
            return (
              <div key={o.id} className="sm-tracker-card" style={{ ...s.trackerCard, borderColor: `${cfg.c}22`, animationDelay: `${oi * 80}ms` }}>
                <div style={{ ...s.trackerIcon, background: cfg.bg, color: cfg.c }}><Icon size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={s.trackerOrder}>Order #{o.id}</p>
                    <span style={{ ...s.trackerBadge, background: cfg.bg, color: cfg.c }}>{(o.items || []).length} items</span>
                  </div>
                  <p style={{ ...s.trackerStatus, color: cfg.c }}>{cfg.label}</p>
                  <div style={s.progressBar}>
                    <div style={{ ...s.progressFill, width: `${progressPct}%`, background: cfg.c }} />
                  </div>
                  {isDelivered && !isPaid && !paymentApproved && (
                    <div style={s.billActions}>
                      {!billRequested ? (
                        <button className="sm-bill-btn" style={s.billReqBtn} onClick={() => requestBill(o.id)}>
                          {billRequestedId === o.id ? (
                            <div style={s.billBtnLoading}><div style={s.spinnerTiny} /> Sending...</div>
                          ) : (
                            <>
                              <span style={s.billBtnIcon}><Receipt size={16} /></span>
                              <span style={s.billBtnText}>
                                <span style={s.billBtnLabel}>Request Bill</span>
                                <span style={s.billBtnSub}>Tap to get your bill</span>
                              </span>
                              <span style={s.billBtnArrow}>→</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="sm-bill-reveal" style={s.billReveal}>
                          <button className="sm-bill-toggle" style={s.billReceiptHeader} onClick={() => toggleBill(o.id)}>
                            <div style={s.billReceiptIcon}>🧾</div>
                            <div style={s.billReceiptInfo}>
                              <p style={s.billReceiptTitle}>Your Bill</p>
                              <p style={s.billReceiptSub}>Order #{o.id} · {(o.items || []).length} items</p>
                            </div>
                            <div style={s.billToggleRight}>
                              {expandedBills[o.id] !== false && o.bill && (
                                <span style={s.billTotalMini}>{fmt(o.bill.total || o.total)}</span>
                              )}
                              <span className="sm-bill-chevron" style={{ ...s.billChevron, transform: expandedBills[o.id] === false ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                            </div>
                          </button>
                          {expandedBills[o.id] !== false && o.bill && (
                            <div className="sm-bill-body" style={s.billReceiptBody}>
                              {(o.items || []).map((it, ii) => (
                                <div key={ii} className="sm-bill-row" style={{ ...s.billItemRow, animationDelay: `${ii * 40}ms` }}>
                                  <span style={s.billItemQty}>{it.quantity}×</span>
                                  <span style={s.billItemName}>{it.name}</span>
                                  <span style={s.billItemDots} />
                                  <span style={s.billItemPrice}>{fmt(it.price * it.quantity)}</span>
                                </div>
                              ))}
                              <div style={s.billDivider} />
                              <div style={s.billTotalRow}>
                                <div>
                                  <p style={s.billTotalLabel}>Total Amount</p>
                                  <p style={s.billTotalHint}>Please pay at the counter</p>
                                </div>
                                <span style={s.billTotalValue}>{fmt(o.bill.total || o.total)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {isPaid && (
                    <div className="sm-paid-burst" style={s.paidBurst}>
                      <div style={s.paidCheckCircle}>
                        <CheckCircle2 size={20} color="#fff" />
                      </div>
                      <div style={s.paidInfo}>
                        <p style={s.paidTitle}>Payment Complete</p>
                        <p style={s.paidSub}>Thank you for dining with us!</p>
                      </div>
                    </div>
                  )}
                  {paymentApproved && !isPaid && !isDelivered && (
                    <div style={{ marginTop: 10, color: '#047857', fontSize: 12, fontWeight: 600 }}>
                      ✓ Payment approved — your order is sent to the waiter.
                    </div>
                  )}
                  {paymentWaiting && o.payment_status !== 'verification_pending' && (
                    <button className="sm-pay-btn" style={{ ...s.billReqBtn, marginTop: 10, justifyContent: 'center' }} onClick={() => openPayment(o)}>
                      {o.payment_status === 'rejected' ? 'Submit corrected payment proof' : 'Pay now'}
                    </button>
                  )}
                  {o.payment_status === 'verification_pending' && (
                    <p style={{ marginTop: 10, color: '#b45309', fontSize: 12, fontWeight: 600 }}>Your payment screenshot is awaiting admin review.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={`sm-cat-strip${cats.length > 4 ? ' overflowable' : ''}`} style={s.catStrip}>
        <div className="sm-cat-strip-inner" style={s.catStripInner}>
        <button className="sm-cat-pill" style={{ ...s.catPill, ...(!cat ? s.catPillOn : {}) }} onClick={() => setCat('')}>
          <Sparkles size={12} /> All <span style={s.catBadge}>{catCounts[''] || 0}</span>
        </button>
        {cats.map(c => {
          const { g1, g2 } = catOf(c);
          const on = cat === c;
          const CatIcon = CAT_ICONS[c] || Utensils;
          return (
            <button key={c} onClick={() => setCat(c)} className="sm-cat-pill"
              style={{
                ...s.catPill, ...(on ? {
                  background: `linear-gradient(135deg,${g1},${g2})`, color: '#fff',
                  border: '2px solid transparent', boxShadow: `0 6px 24px ${g1}44`,
                  transform: 'scale(1.05)',
                } : {}),
              }}>
              <CatIcon size={13} /> {c}
              <span style={{ ...s.catBadge, ...(on ? { background: 'rgba(255,255,255,0.3)' } : {}) }}>
                {catCounts[c] || 0}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      <div className="sm-content" style={s.content}>
        {Object.keys(grouped).length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyOrb} />
            <div style={s.emptyIcon}>🔍</div>
            <p style={s.emptyTitle}>No dishes found</p>
            <p style={s.emptyDesc}>Try a different search or browse another category</p>
            <button style={s.emptyBtn} onClick={() => { setQ(''); setCat(''); }}>
              <Sparkles size={13} /> View All Items
            </button>
          </div>
        ) : Object.entries(grouped).map(([sectionName, sectionItems], si) => {
          const sectionCat = sectionName ? catOf(sectionName) : null;
          return (
            <div key={sectionName || si} style={s.section}>
              {sectionName && (
                <div className="sm-section-head" style={s.sectionHead}>
                  <span style={{ ...s.sectionEmoji, background: `linear-gradient(135deg,${sectionCat.g1}15,${sectionCat.g2}08)` }}>{sectionCat.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <h2 style={s.sectionTitle}>{sectionName}</h2>
                    <p style={s.sectionCount}>{sectionItems.length} item{sectionItems.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div style={{ ...s.sectionLine, background: `linear-gradient(90deg,${sectionCat.g1}30,transparent)` }} />
                </div>
              )}

              {!q && !cat && sectionItems.length > 0 && (() => {
                const feat = sectionItems[spotlightIdx % sectionItems.length];
                if (!feat) return null;
                const { g1, g2, emoji } = catOf(feat.category);
                const inSpotCart = cart.find(c => c.id === feat.id);
                return (
                  <div style={s.spotlight}>
                    <div className="sm-spotlight" style={s.spotlightInner}>
                      {feat.image ? (
                        <img src={feat.image} alt={feat.name} style={s.spotlightImg} />
                      ) : (
                        <div style={{ ...s.spotlightPH, background: `linear-gradient(135deg,${g1}22,${g2}11)` }}>
                          <span style={{ fontSize: 64, opacity: 0.3 }}>{emoji}</span>
                        </div>
                      )}
                      <div style={s.spotlightOverlay} />
                      <div style={s.spotlightContent}>
                        <span style={{ ...s.spotlightBadge, background: `linear-gradient(135deg,${g1},${g2})` }}>
                          <Star size={10} fill="#fff" /> Featured
                        </span>
                        <h3 style={s.spotlightName}>{feat.name}</h3>
                        {feat.description && <p style={s.spotlightDesc}>{feat.description}</p>}
                        <div style={s.spotlightFoot}>
                          <span style={s.spotlightPrice}>{fmt(feat.price)}</span>
                          {inSpotCart ? (
                            <div style={s.qtyRow}>
                              <button style={s.qtyBtn} onClick={() => updQty(feat.id, inSpotCart.qty - 1)}><Minus size={14} /></button>
                              <span style={s.qtyNum}>{inSpotCart.qty}</span>
                              <button style={s.qtyBtn} onClick={() => updQty(feat.id, inSpotCart.qty + 1)}><Plus size={14} /></button>
                            </div>
                          ) : (
                            <button style={{ ...s.addLg, background: `linear-gradient(135deg,${g1},${g2})` }}
                              onClick={e => addToCart(feat, e)}>
                              <Plus size={16} /> Add
                              {ripple?.id === feat.id && <span style={{ ...s.ripple, left: ripple.x, top: ripple.y }} />}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={s.spotlightDots}>
                        {sectionItems.slice(0, 3).map((_, di) => (
                          <span key={di} style={{
                            ...s.spotDot,
                            background: di === (spotlightIdx % Math.min(sectionItems.length, 3)) ? '#fff' : 'rgba(255,255,255,0.3)',
                            width: di === (spotlightIdx % Math.min(sectionItems.length, 3)) ? 16 : 6,
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="sm-grid">
                {(sectionName === '' || q || cat ? sectionItems : sectionItems.slice(1)).map((item, idx) => {
                  const inCart = cart.find(c => c.id === item.id);
                  const { g1, g2, emoji } = catOf(item.category);
                  const isPopular = idx < 2;
                  return (
                    <div key={item.id} className="sm-card-hover" style={{ ...s.card, animationDelay: `${idx * 50}ms` }}>
                      <div className="sm-card-top" style={{ ...s.cardTop, background: `linear-gradient(135deg,${g1}14,${g2}08)` }}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="sm-card-img" style={s.cardImg} loading="lazy" />
                        ) : (
                          <span style={{ fontSize: 52, opacity: 0.32, transition: 'transform 0.3s', filter: 'saturate(1.3)' }} className="sm-card-emoji">{emoji}</span>
                        )}
                        {isPopular && (
                          <span style={s.popularBadge}><Flame size={8} /> Popular</span>
                        )}
                        <span style={{ ...s.cardCat, background: `linear-gradient(135deg,${g1},${g2})` }}>{item.category}</span>
                      </div>
                      <div style={s.cardBody}>
                        <h4 style={s.cardName}>{item.name}</h4>
                        {item.description && <p style={s.cardDesc}>{item.description}</p>}
                        <div style={s.cardFoot}>
                          {/* Row 1: price + add button (add-mode) OR just price (qty-mode) */}
                          <div style={s.cardFootRow}>
                            <span style={{ ...s.cardPrice, color: g1 }}>{fmt(item.price)}</span>
                            {!inCart && (
                              <button className="sm-add-btn" style={{ ...s.addBtn, background: `linear-gradient(135deg,${g1},${g2})` }} onClick={e => addToCart(item, e)}>
                                <Plus size={15} />
                                {ripple?.id === item.id && <span style={{ ...s.ripple, left: ripple.x, top: ripple.y }} />}
                              </button>
                            )}
                          </div>
                          {/* Row 2: qty controls (qty-mode only — always fits, no overflow) */}
                          {inCart && (
                            <div style={{ ...s.qtyRowSm, justifyContent: 'center', gap: 12 }}>
                              <button className="sm-qty-btn" style={{ ...s.qtyBtnSm, borderColor: `${g1}55`, color: g1 }} onClick={() => updQty(item.id, inCart.qty - 1)}><Minus size={12} /></button>
                              <span style={{ ...s.qtyNumSm, color: g1 }}>{inCart.qty}</span>
                              <button className="sm-qty-btn" style={{ ...s.qtyBtnSm, borderColor: `${g1}55`, color: g1, background: `${g1}12` }} onClick={() => updQty(item.id, inCart.qty + 1)}><Plus size={12} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {cartOpen && (
        <div style={s.overlay} onClick={() => setCartOpen(false)}>
          <div className="sm-drawer" style={s.drawer} onClick={e => e.stopPropagation()}>
            <div style={s.drawerHandle} />
            <div style={s.drawerHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={s.drawerIcon}><ShoppingBag size={18} color="#fff" /></div>
                <div>
                  <p style={s.drawerTitle}>Your Order</p>
                  <p style={s.drawerSub}>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</p>
                </div>
              </div>
              <button style={s.drawerClose} onClick={() => setCartOpen(false)}><X size={18} color="#64748b" /></button>
            </div>

            <div style={s.drawerScroll}>
              {!cart.length ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.2, animation: 'float 3s ease-in-out infinite' }}>🛒</div>
                  <p style={{ color: '#0f172a', fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>Cart is empty</p>
                  <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Browse the menu and tap + to add items</p>
                </div>
              ) : cart.map((item, i) => {
                const { g1, g2, emoji } = catOf(item.category);
                return (
                  <div key={item.id} style={{ ...s.cartItem, animationDelay: `${i * 40}ms`, opacity: removingId === item.id ? 0 : 1, transform: removingId === item.id ? 'translateX(100px)' : 'none', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
                    <div style={{ ...s.cartAccent, background: `linear-gradient(135deg,${g1},${g2})` }} />
                    <span style={{ fontSize: 20, width: 34, height: 34, borderRadius: 10, background: `${g1}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.cartItemName}>{item.name}</p>
                      <p style={s.cartItemPrice}>{fmt(item.price)} × {item.qty}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={s.qtyRowSm}>
                        <button style={{ ...s.qtyBtnSm, borderColor: 'rgba(0,0,0,0.06)', color: '#64748b' }} onClick={() => updQty(item.id, item.qty - 1)}><Minus size={12} /></button>
                        <span style={{ ...s.qtyNumSm, color: '#0f172a' }}>{item.qty}</span>
                        <button style={{ ...s.qtyBtnSm, borderColor: 'rgba(0,0,0,0.06)', color: '#64748b' }} onClick={() => updQty(item.id, item.qty + 1)}><Plus size={12} /></button>
                      </div>
                      <span style={s.cartItemTotal}>{fmt(item.price * item.qty)}</span>
                      <button style={s.cartRemoveBtn} onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {cart.length > 0 && (
              <div style={s.drawerFoot}>
                <div style={s.bill}>
                  <div style={s.billRow}><span style={s.billLabel}>Subtotal</span><span style={s.billVal}>{fmt(totals.subtotal)}</span></div>
                  {totals.taxPercent > 0 && <div style={s.billRow}><span style={s.billLabel}>Tax ({totals.taxPercent}%)</span><span style={s.billVal}>{fmt(totals.taxAmount)}</span></div>}
                  <div style={{ ...s.billRow, borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 12, marginTop: 6 }}>
                    <span style={s.billTotal}>Total</span>
                    <span style={s.billTotalVal}>{fmt(totals.total)}</span>
                  </div>
                </div>
                <p style={s.payNote}>Payment processed at the counter</p>
                <button className="sm-order-btn" style={{ ...s.orderBtn, ...(placing ? { opacity: 0.5, pointerEvents: 'none' } : {}) }} onClick={placeOrder} disabled={placing}>
                  {placing ? <><div style={s.spinner} /> Placing Order...</> : <><Zap size={17} /> Place Order <ArrowRight size={17} /></>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {cartCount > 0 && !cartOpen && (
        <div className="sm-float-bar" style={s.floatBar} onClick={() => setCartOpen(true)}>
          <div style={s.floatLeft}>
            <div style={s.floatCartIcon}><ShoppingBag size={16} color="#fff" /></div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={s.floatCount}>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
              <div style={s.floatThumbs}>
                {cart.slice(0, 4).map((ci, ti) => {
                  const ce = catOf(ci.category).emoji;
                  return <span key={ci.id} style={{ ...s.floatThumb, animationDelay: `${ti * 50}ms` }}>{ce}</span>;
                })}
                {cart.length > 4 && <span style={{ ...s.floatThumb, background: 'rgba(255,255,255,0.15)', fontSize: 9 }}>+{cart.length - 4}</span>}
              </div>
            </div>
          </div>
          <div style={s.floatRight}>
            <span style={s.floatTotal}>{fmt(totals.total)}</span>
            <div style={s.floatArrow}><ChevronRight size={18} color="#fff" /></div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0}
  ::-webkit-scrollbar{display:none}
  input::placeholder{color:rgba(100,116,139,0.5)}
  
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:none;opacity:1}}
  @keyframes ripple{to{transform:translate(-50%,-50%) scale(4);opacity:0}}
  @keyframes orbA{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-20px)}}
  @keyframes orbB{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,15px)}}
  @keyframes orbC{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(12px,8px) rotate(180deg)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes catBounce{0%{transform:scale(1)}40%{transform:scale(1.12)}100%{transform:scale(1.05)}}
  @keyframes toastIn{0%{transform:translateY(-24px) scale(0.9);opacity:0}100%{transform:none;opacity:1}}
  @keyframes toastOut{0%{transform:none;opacity:1}100%{transform:translateY(-24px) scale(0.9);opacity:0}}
  @keyframes flyToCart{
    0%{transform:scale(1);opacity:1}
    40%{transform:scale(1.3) translateY(-40px);opacity:1}
    100%{transform:scale(0.3) translate(var(--tx),var(--ty));opacity:0}
  }
  @keyframes confetti0{0%{transform:translate(0,0) scale(0)}50%{transform:translate(-30px,-40px) scale(1.2)}100%{transform:translate(-20px,-60px) scale(0.8);opacity:0}}
  @keyframes confetti1{0%{transform:translate(0,0) scale(0)}50%{transform:translate(25px,-35px) scale(1.1)}100%{transform:translate(15px,-55px) scale(0.7);opacity:0}}
  @keyframes confetti2{0%{transform:translate(0,0) scale(0)}50%{transform:translate(-15px,-45px) scale(1.3)}100%{transform:translate(-25px,-50px) scale(0.6);opacity:0}}
  @keyframes confetti3{0%{transform:translate(0,0) scale(0)}50%{transform:translate(20px,-30px) scale(1)}100%{transform:translate(30px,-50px) scale(0.9);opacity:0}}
  @keyframes confetti4{0%{transform:translate(0,0) scale(0)}50%{transform:translate(-5px,-50px) scale(1.4)}100%{transform:translate(10px,-65px) scale(0.5);opacity:0}}
  @keyframes scaleIn{from{transform:scale(0.8);opacity:0}to{transform:none;opacity:1}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,60,172,0)}50%{box-shadow:0 0 0 6px rgba(255,60,172,0.1)}}
  @keyframes billGlow{0%,100%{box-shadow:0 0 12px rgba(249,115,22,0.2)}50%{box-shadow:0 0 28px rgba(249,115,22,0.4)}}
  @keyframes billShine{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes billReveal{from{max-height:0;opacity:0;padding:0 14px}to{max-height:400px;opacity:1;padding:14px}}
  @keyframes bounceIn{0%{transform:scale(0);opacity:0}50%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
  @keyframes pulseRing{0%{transform:scale(0.9);opacity:1}100%{transform:scale(1.6);opacity:0}}
  @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes paidBurst{0%{transform:scale(0.5);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  @keyframes sparkle{0%,100%{opacity:0;transform:scale(0) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(180deg)}}

  .sm-header{padding:12px 16px 10px}
  @media(min-width:640px){.sm-header{padding:14px 24px 12px}}
  @media(min-width:1024px){.sm-header{max-width:1200px;margin:0 auto}}

  .sm-search-focus{animation:glowPulse 1.5s ease infinite}

  /* Chip rail: full-width sticky bar; chips centered with the content
     column (same 1200px max-width as the grid), horizontally scrollable
     with a fade affordance at the far edge when it overflows. */
  .sm-cat-strip{background:rgba(255,255,255,0.96)}
  .sm-cat-strip-inner{max-width:1200px;margin:0 auto;display:flex;gap:8px;padding:10px 16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  @media(min-width:640px){.sm-cat-strip-inner{padding:10px 24px}}
  .sm-cat-strip-inner::-webkit-scrollbar{display:none}
  .sm-cat-strip.overflowable .sm-cat-strip-inner{-webkit-mask-image:linear-gradient(90deg,#fff 0,#fff calc(100% - 28px),transparent 100%);mask-image:linear-gradient(90deg,#fff 0,#fff calc(100% - 28px),transparent 100%)}

  .sm-cat-pill:active{transform:scale(0.95)!important}
  .sm-cat-pill{transition:all 0.3s cubic-bezier(0.4,0,0.2,1)}

  .sm-tracker{margin:0 16px}
  @media(min-width:640px){.sm-tracker{margin:0 24px}}
  @media(min-width:1024px){.sm-tracker{max-width:1200px;margin:0 auto;padding:0 24px}}
  /* Pay-now CTA: compact centered pill on every screen size */
  .sm-pay-btn{display:block;width:fit-content;margin:10px auto 0;padding:10px 24px!important;border-radius:12px!important;font-size:13px!important}

  .sm-content{padding:0 16px 100px}
  @media(min-width:640px){.sm-content{padding:0 24px 100px}}
  @media(min-width:1024px){.sm-content{max-width:1200px;margin:0 auto;padding:0 24px 100px}}

  .sm-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  @media(min-width:400px){.sm-grid{gap:12px}}
  @media(min-width:480px){.sm-grid{grid-template-columns:repeat(2,1fr);gap:14px}}
  @media(min-width:640px){.sm-grid{grid-template-columns:repeat(3,1fr);gap:16px}}
  @media(min-width:1024px){.sm-grid{grid-template-columns:repeat(3,1fr);gap:18px}}
  @media(min-width:1280px){.sm-grid{grid-template-columns:repeat(4,1fr);gap:18px}}
  /* Bigger food imagery: taller image area on phones, more on desktop */
  .sm-card-top{height:132px}
  @media(min-width:480px){.sm-card-top{height:150px}}
  @media(min-width:1024px){.sm-card-top{height:170px}}

  .sm-card-hover{transition:transform 0.25s cubic-bezier(0.4,0,0.2,1),box-shadow 0.25s}
  .sm-card-hover:hover{transform:translateY(-3px);box-shadow:0 8px 28px rgba(0,0,0,0.07)}
  .sm-card-hover:hover .sm-card-img{transform:scale(1.06)}
  .sm-card-hover:hover .sm-card-emoji{transform:scale(1.15)}
  .sm-card-hover:active{transform:scale(0.97)!important}

  .sm-qty-btn:active{transform:scale(0.85)!important}
  .sm-qty-btn{transition:all 0.15s}
  .sm-add-btn:active{transform:scale(0.85)!important}
  .sm-add-btn{transition:transform 0.15s}

  .sm-bill-btn:hover{transform:translateY(-2px);box-shadow:0 10px 36px rgba(255,107,53,0.4)!important}
  .sm-bill-btn:hover .sm-bill-btn-arrow{transform:translateX(4px)}
  .sm-bill-btn:active{transform:scale(0.97)!important}

  .sm-bill-toggle{transition:background 0.15s}
  .sm-bill-toggle:hover{background:rgba(249,115,22,0.08)!important}
  .sm-bill-toggle:active{background:rgba(249,115,22,0.12)!important}

  .sm-bill-body{animation:billReveal 0.35s cubic-bezier(0.4,0,0.2,1) both;overflow:hidden}
  .sm-bill-chevron{display:inline-block}

  .sm-bill-row{transition:background 0.15s;border-radius:6px;padding:0 4px}
  .sm-bill-row:hover{background:rgba(249,115,22,0.04)}

  .sm-bill-reveal{transition:box-shadow 0.3s}
  .sm-bill-reveal:hover{box-shadow:0 6px 28px rgba(249,115,22,0.12)!important}

  .sm-paid-burst{transition:transform 0.2s}
  .sm-paid-burst:hover{transform:scale(1.01)}

  .sm-spotlight{height:220px;border-radius:24px}
  @media(min-width:640px){.sm-spotlight{height:260px;border-radius:28px}}

  .sm-drawer{animation:slideUp 0.4s cubic-bezier(0.4,0,0.2,1)}

  .sm-float-bar{transition:transform 0.2s}
  .sm-float-bar:active{transform:scale(0.97)}

  .sm-section-head{position:relative}
  .sm-section-head::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;border-radius:2px;opacity:0}

  .sm-tracker-card{transition:all 0.25s}

  @media(hover:none){
    .sm-card-hover:hover{transform:none;box-shadow:0 1px 8px rgba(0,0,0,0.03)}
    .sm-card-hover:hover .sm-card-img{transform:none}
    .sm-float-bar:active{transform:none}
  }
`;

const s = {
  root: { fontFamily: "'Inter',system-ui,-apple-system,sans-serif", background: 'linear-gradient(180deg,#fafafb 0%,#f5f5f7 100%)', minHeight: '100vh', color: '#1e293b', position: 'relative' },

  bgOrb1: { position: 'fixed', top: '10%', right: '-8%', width: '45vw', height: '45vw', maxWidth: 400, maxHeight: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,60,172,0.035),transparent 70%)', zIndex: 0, pointerEvents: 'none', animation: 'orbA 18s ease-in-out infinite' },
  bgOrb2: { position: 'fixed', bottom: '-8%', left: '5%', width: '40vw', height: '40vw', maxWidth: 350, maxHeight: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,75,160,0.025),transparent 70%)', zIndex: 0, pointerEvents: 'none', animation: 'orbB 14s ease-in-out infinite' },
  bgOrb3: { position: 'fixed', top: '50%', left: '30%', width: '30vw', height: '30vw', maxWidth: 250, maxHeight: 250, borderRadius: '50%', background: 'radial-gradient(circle,rgba(249,115,22,0.02),transparent 70%)', zIndex: 0, pointerEvents: 'none', animation: 'orbC 20s linear infinite' },

  skelHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 0', position: 'relative', zIndex: 1 },
  skelCircle: { width: 40, height: 40, borderRadius: 14, background: 'rgba(0,0,0,0.04)', flexShrink: 0 },
  skelLine: { height: 12, borderRadius: 8, background: 'linear-gradient(90deg,rgba(0,0,0,0.04) 25%,rgba(0,0,0,0.07) 50%,rgba(0,0,0,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },
  skelPill: { flexShrink: 0, width: 72, height: 34, borderRadius: 50, background: 'rgba(0,0,0,0.04)', animation: 'shimmer 1.5s infinite' },
  skelCatRow: { display: 'flex', gap: 8, padding: '12px 16px', overflow: 'hidden', position: 'relative', zIndex: 1 },
  skelCard: { borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.03)', animation: 'fadeUp 0.4s ease both' },
  skelCardImg: { height: 100, background: 'rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' },
  skelGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '0 16px', position: 'relative', zIndex: 1 },
  skelShimmer: { position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.6) 50%,transparent 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' },

  toastWrap: { position: 'fixed', top: 16, left: 0, right: 0, zIndex: 200, display: 'flex', justifyContent: 'center', pointerEvents: 'none' },
  toast: { display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#10b981,#059669)', borderRadius: 16, padding: '14px 22px', boxShadow: '0 12px 40px rgba(16,185,129,0.4)', color: '#fff', animation: 'toastIn 0.4s cubic-bezier(0.4,0,0.2,1) both', position: 'relative', overflow: 'visible' },
  toastIcon: { fontSize: 24 },
  toastTitle: { margin: 0, fontWeight: 800, fontSize: 14 },
  toastSub: { margin: '2px 0 0', fontSize: 11, opacity: 0.75 },
  confettiWrap: { position: 'absolute', inset: 0, pointerEvents: 'none' },

  header: { background: 'rgba(250,250,251,0.92)', backdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: { width: 40, height: 40, borderRadius: 14, background: 'linear-gradient(135deg,#ff3cac,#784ba0)', boxShadow: '0 4px 20px rgba(255,60,172,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  brandName: { margin: 0, fontWeight: 900, fontSize: 17, color: '#0f172a', letterSpacing: '-0.3px' },
  brandSub: { margin: '1px 0 0', fontSize: 11, color: '#64748b', fontWeight: 500 },
  cartBtn: { position: 'relative', width: 42, height: 42, borderRadius: 13, border: '1.5px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' },
  cartBtnActive: { background: 'rgba(255,60,172,0.08)', borderColor: 'rgba(255,60,172,0.2)', color: '#ff3cac', transform: 'scale(1.05)', animation: 'catBounce 0.4s ease' },
  cartCount: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, background: 'linear-gradient(135deg,#ff3cac,#784ba0)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(255,60,172,0.5)', padding: '0 5px' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.025)', border: '1.5px solid rgba(0,0,0,0.04)', borderRadius: 12, padding: '10px 12px', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)' },
  searchWrapFocus: { background: 'rgba(255,60,172,0.03)', borderColor: 'rgba(255,60,172,0.2)', boxShadow: '0 0 0 3px rgba(255,60,172,0.08)' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: '#1e293b', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', minWidth: 0 },
  searchCount: { fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 },
  clearBtn: { background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 8, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 },

  trackerSection: { position: 'relative', zIndex: 1, marginBottom: 8 },
  trackerLabel: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingLeft: 2 },
  trackerDot: { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)', animation: 'pulse 2s ease-in-out infinite' },
  trackerCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', border: '1.5px solid', marginBottom: 8, animation: 'fadeUp 0.35s ease both' },
  trackerIcon: { width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trackerOrder: { margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' },
  trackerStatus: { margin: '0 0 6px', fontSize: 11, fontWeight: 600 },
  trackerBadge: { padding: '3px 10px', borderRadius: 50, fontSize: 10, fontWeight: 700 },
  progressBar: { width: '100%', height: 3, borderRadius: 3, background: 'rgba(0,0,0,0.04)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' },
  billActions: { marginTop: 10 },
  billReqBtn: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 16px', borderRadius: 16, border: '2px solid transparent', background: 'linear-gradient(135deg,#ff6b35,#f7931e,#ffb347)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 24px rgba(255,107,53,0.35)', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden', textAlign: 'left' },
  billBtnIcon: { width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  billBtnText: { flex: 1, minWidth: 0 },
  billBtnLabel: { display: 'block', fontSize: 14, fontWeight: 800, lineHeight: 1.2 },
  billBtnSub: { display: 'block', fontSize: 10.5, opacity: 0.75, marginTop: 1 },
  billBtnArrow: { fontSize: 20, fontWeight: 300, opacity: 0.6, flexShrink: 0, transition: 'transform 0.2s' },
  billBtnLoading: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 },
  spinnerTiny: { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },

  billReveal: { background: '#fff', borderRadius: 18, border: '1.5px solid rgba(249,115,22,0.12)', overflow: 'hidden', animation: 'billReveal 0.5s cubic-bezier(0.4,0,0.2,1) both', boxShadow: '0 4px 20px rgba(249,115,22,0.08)' },
  billReceiptHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 10px', background: 'linear-gradient(135deg,rgba(249,115,22,0.06),rgba(245,158,11,0.04))', borderBottom: '1px dashed rgba(249,115,22,0.15)', cursor: 'pointer', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.15s' },
  billReceiptIcon: { fontSize: 28, animation: 'bounceIn 0.5s ease both', animationDelay: '0.2s', flexShrink: 0 },
  billReceiptInfo: { flex: 1, minWidth: 0 },
  billReceiptTitle: { margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' },
  billReceiptSub: { margin: '1px 0 0', fontSize: 11, color: '#94a3b8' },
  billToggleRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  billTotalMini: { fontSize: 14, fontWeight: 900, background: 'linear-gradient(135deg,#ff6b35,#f7931e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  billChevron: { fontSize: 18, color: '#94a3b8', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', lineHeight: 1 },
  billWaitBadge: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 50, background: 'rgba(249,115,22,0.08)', flexShrink: 0 },
  billWaitDot: { width: 7, height: 7, borderRadius: '50%', background: '#f97316', animation: 'pulse 1.5s ease-in-out infinite', position: 'relative' },
  billWaitText: { fontSize: 9.5, fontWeight: 700, color: '#f97316', whiteSpace: 'nowrap' },

  billReceiptBody: { padding: '12px 14px 14px', animation: 'countUp 0.4s ease both', animationDelay: '0.3s' },
  billItemRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', animation: 'fadeUp 0.3s ease both' },
  billItemQty: { fontSize: 11, fontWeight: 700, color: '#94a3b8', minWidth: 24, flexShrink: 0 },
  billItemName: { fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  billItemDots: { flex: 1, borderBottom: '1px dotted rgba(0,0,0,0.08)', minWidth: 20, marginBottom: 2 },
  billItemPrice: { fontSize: 12, fontWeight: 700, color: '#0f172a', flexShrink: 0 },
  billDivider: { height: 1, background: 'linear-gradient(90deg,transparent,rgba(0,0,0,0.06),transparent)', margin: '8px 0' },
  billTotalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', margin: '0 -14px -14px', background: 'linear-gradient(135deg,#ff6b35,#f7931e)', borderRadius: '0 0 16px 16px' },
  billTotalLabel: { margin: 0, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' },
  billTotalHint: { margin: '2px 0 0', fontSize: 9.5, color: 'rgba(255,255,255,0.55)' },
  billTotalValue: { fontSize: 22, fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.15)', animation: 'countUp 0.5s ease both', animationDelay: '0.5s' },

  paidBurst: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'linear-gradient(135deg,rgba(34,197,94,0.06),rgba(16,185,129,0.04))', border: '1px solid rgba(34,197,94,0.12)', animation: 'paidBurst 0.5s cubic-bezier(0.4,0,0.2,1) both' },
  paidCheckCircle: { width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', animation: 'bounceIn 0.5s ease both', animationDelay: '0.15s' },
  paidInfo: { flex: 1 },
  paidTitle: { margin: 0, fontSize: 13, fontWeight: 800, color: '#15803d' },
  paidSub: { margin: '1px 0 0', fontSize: 10.5, color: '#86efac' },

  catStrip: { position: 'sticky', top: 57, zIndex: 30, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px) saturate(180%)', borderBottom: '1px solid rgba(0,0,0,0.05)' },
  catStripInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' },
  catPill: { flexShrink: 0, padding: '8px 14px', borderRadius: 50, border: '1.5px solid rgba(0,0,0,0.06)', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 4px rgba(15,23,42,0.04)' },
  catPillOn: { background: 'linear-gradient(135deg,#ff3cac,#784ba0)', color: '#fff', border: '2px solid transparent', boxShadow: '0 6px 24px rgba(255,60,172,0.35)', transform: 'scale(1.05)' },
  catBadge: { fontSize: 9, fontWeight: 800, background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '1px 6px', marginLeft: 2 },

  content: { position: 'relative', zIndex: 1 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', animation: 'fadeUp 0.5s ease both', position: 'relative' },
  emptyOrb: { position: 'absolute', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(255,60,172,0.06),transparent 70%)', animation: 'float 4s ease-in-out infinite', pointerEvents: 'none' },
  emptyIcon: { fontSize: 52, marginBottom: 14, animation: 'float 3s ease-in-out infinite', position: 'relative', zIndex: 1 },
  emptyTitle: { color: '#0f172a', fontSize: 17, fontWeight: 800, margin: 0 },
  emptyDesc: { color: '#94a3b8', fontSize: 13, marginTop: 6, margin: '6px 0 0' },
  emptyBtn: { marginTop: 16, padding: '10px 20px', borderRadius: 50, border: 'none', background: 'linear-gradient(135deg,#ff3cac,#784ba0)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 6px 24px rgba(255,60,172,0.3)' },

  section: { marginBottom: 24 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionEmoji: { fontSize: 24, width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' },
  sectionCount: { margin: '1px 0 0', fontSize: 11, color: '#94a3b8', fontWeight: 500 },
  sectionLine: { height: 2, borderRadius: 2, width: 40, flexShrink: 0 },

  spotlight: { marginBottom: 16, animation: 'fadeUp 0.5s ease both' },
  spotlightInner: { position: 'relative', borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', background: '#fff' },
  spotlightImg: { width: '100%', height: '100%', objectFit: 'cover' },
  spotlightPH: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spotlightOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(15,23,42,0.85) 0%,rgba(15,23,42,0.08) 55%,transparent 100%)' },
  spotlightContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 18px' },
  spotlightBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 50, fontSize: 10, fontWeight: 700, color: '#fff', marginBottom: 8 },
  spotlightName: { margin: '0 0 2px', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' },
  spotlightDesc: { margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 },
  spotlightFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  spotlightPrice: { fontSize: 22, fontWeight: 900, background: 'linear-gradient(135deg,#ff3cac,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  addLg: { display: 'flex', alignItems: 'center', gap: 5, padding: '10px 18px', borderRadius: 12, border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'transform 0.2s', flexShrink: 0 },
  spotlightDots: { position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, zIndex: 2 },
  spotDot: { height: 6, borderRadius: 3, transition: 'all 0.3s', flexShrink: 0 },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 },
  card: { background: '#fff', border: '1px solid rgba(15,23,42,0.05)', borderRadius: 20, overflow: 'hidden', animation: 'fadeUp 0.4s ease both', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' },
  cardTop: { height: 132, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)' },
  cardCat: { position: 'absolute', top: 8, left: 8, padding: '3px 9px', borderRadius: 50, fontSize: 9, fontWeight: 800, color: '#fff', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' },
  popularBadge: { position: 'absolute', top: 8, right: 8, padding: '3px 9px', borderRadius: 50, fontSize: 9, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', gap: 3, boxShadow: '0 2px 8px rgba(239,68,68,0.35)' },
  cardBody: { padding: '11px 13px 13px', minWidth: 0 },
  cardName: { margin: '0 0 3px', fontSize: 13.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.25, letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardDesc: { margin: '0 0 9px', fontSize: 11, color: '#64748b', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  // When in add-mode: price left, + button right (single row)
  // When in qty-mode: price on top, qty controls below — avoids any overflow
  cardFoot: { display: 'flex', flexDirection: 'column', gap: 6 },
  cardFootRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardPrice: { fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', whiteSpace: 'nowrap' },
  addBtn: { width: 34, height: 34, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.22)', touchAction: 'manipulation', flexShrink: 0 },

  qtyRow: { display: 'flex', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e293b', transition: 'all 0.15s' },
  qtyNum: { fontSize: 15, fontWeight: 800, color: '#0f172a', minWidth: 22, textAlign: 'center' },
  qtyRowSm: { display: 'flex', alignItems: 'center', gap: 4 },
  qtyBtnSm: { width: 28, height: 28, borderRadius: 8, border: '1.5px solid', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 },
  qtyNumSm: { fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: 'center' },

  ripple: { position: 'absolute', width: 70, height: 70, background: 'rgba(255,255,255,0.3)', borderRadius: '50%', transform: 'translate(-50%,-50%) scale(0)', animation: 'ripple 0.5s ease-out', pointerEvents: 'none' },

  floatBar: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'linear-gradient(135deg,#ff3cac,#784ba0)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 -4px 32px rgba(255,60,172,0.4)', borderRadius: '20px 20px 0 0', margin: '0 8px', animation: 'slideUp 0.35s cubic-bezier(0.4,0,0.2,1)' },
  floatLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  floatCartIcon: { width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  floatCount: { fontWeight: 700, fontSize: 13, color: '#fff', margin: 0, lineHeight: 1.2 },
  floatThumbs: { display: 'flex', gap: 2, marginTop: 2 },
  floatThumb: { width: 18, height: 18, borderRadius: 5, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, animation: 'scaleIn 0.3s ease both' },
  floatRight: { display: 'flex', alignItems: 'center', gap: 6 },
  floatTotal: { fontWeight: 900, fontSize: 17, color: '#fff' },
  floatArrow: { width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', zIndex: 60, display: 'flex', alignItems: 'flex-end' },
  drawer: { background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 48px rgba(0,0,0,0.1)' },
  drawerHandle: { width: 36, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.08)', margin: '12px auto 0' },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  drawerIcon: { width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#ff3cac,#784ba0)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  drawerTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' },
  drawerSub: { margin: '1px 0 0', fontSize: 11, color: '#94a3b8' },
  drawerClose: { background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  drawerScroll: { flex: 1, overflowY: 'auto', padding: '4px 20px' },

  cartItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.03)', position: 'relative', animation: 'fadeUp 0.3s ease both' },
  cartAccent: { position: 'absolute', left: -20, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, borderRadius: 3 },
  cartItemName: { margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' },
  cartItemPrice: { margin: '2px 0 0', fontSize: 11, color: '#94a3b8' },
  cartItemTotal: { fontSize: 13, fontWeight: 800, color: '#0f172a', minWidth: 52, textAlign: 'right' },
  cartRemoveBtn: { width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 },

  drawerFoot: { padding: '14px 20px 28px', borderTop: '1px solid rgba(0,0,0,0.04)' },
  bill: { background: 'rgba(0,0,0,0.02)', borderRadius: 14, padding: '12px 14px', marginBottom: 12 },
  billRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  billLabel: { fontSize: 12, color: '#64748b', fontWeight: 500 },
  billVal: { fontSize: 13, color: '#475569', fontWeight: 700 },
  billTotal: { color: '#0f172a', fontWeight: 800, fontSize: 15 },
  billTotalVal: { fontWeight: 900, fontSize: 22, background: 'linear-gradient(135deg,#ff3cac,#784ba0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  payNote: { margin: '0 0 10px', textAlign: 'center', fontSize: 11, color: '#94a3b8' },
  orderBtn: { width: '100%', padding: '15px 0', border: 'none', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: 'linear-gradient(135deg,#ff3cac,#784ba0)', color: '#fff', fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 28px rgba(255,60,172,0.35)', transition: 'all 0.2s' },
  spinner: { width: 17, height: 17, border: '2.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
};
