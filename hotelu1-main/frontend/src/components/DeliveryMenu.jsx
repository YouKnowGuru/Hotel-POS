/**
 * DeliveryMenu — public home-delivery ordering page (route: /order)
 *
 * Flow (mirrors the QR SimpleMenu experience, adapted for home delivery):
 *  1. Live menu (auto-fetched from the admin system) → cart
 *  2. Checkout: delivery details (name, phone, email, address) + totals
 *     with the 10% service charge and GST spelled out
 *  3. Payment choice: Cash on delivery ·  Pay online via the restaurant QR
 *     → QR customers upload a payment screenshot that an admin reviews
 *       before the kitchen starts and a staff member delivers
 *  4. Wireless placed screen: live order + payment status tracking with
 *     "Pay now" retry if a payment was rejected or abandoned
 *
 * Everything posts to POST /api/orders with type=DELIVERY; totals are
 * recomputed server-side, so what the customer sees always matches the bill.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, X, Plus, Minus, Flame, Search, Truck, ChevronLeft, User,
  MapPin, AlertCircle, Loader2, Phone, Clock, CreditCard, ArrowRight,
  MessageSquare, Banknote, Sparkles, Mail, QrCode, ShieldCheck, CheckCircle,
  Ban, Hourglass, PackageCheck,
} from 'lucide-react';
import PublicShell from './PublicShell';
import { getAPI_URL } from '../utils/api';
import { calculateOrderTotals, fetchAndCacheGlobalSettings } from '../utils/orderTotals';
import { SERVICE_CHARGE_PERCENT } from '../utils/receiptPrint';

const CURRENCY = 'Nu. ';

/* Orders this device placed (device-scoped session, like the QR menu). */
const ORDERS_KEY = 'dmDeliveryOrders';

const getStoredOrderIds = () => {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return new Set(raw ? JSON.parse(raw).map(Number) : []);
  } catch { return new Set(); }
};
const addStoredOrderId = (id) => {
  const ids = getStoredOrderIds();
  ids.add(Number(id));
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify([...ids])); } catch { /* quota */ }
};

/* ── Gradient fallbacks per category ── */
const grad = (cat = '') => {
  const c = cat.toLowerCase();
  if (/chicken|meat|mutton|beef|pork/.test(c)) return ['#ef4444', '#f97316'];
  if (/rice|fried|noodle/.test(c))             return ['#f59e0b', '#d97706'];
  if (/veg|salad|paneer/.test(c))              return ['#22c55e', '#16a34a'];
  if (/drink|juice|beverage|tea|coffee/.test(c)) return ['#3b82f6', '#6366f1'];
  return ['#8b5cf6', '#6366f1'];
};

/* ── Field validation (runs on blur, and on submit for every field). The
      thresholds mirror the server-side DELIVERY validation exactly so the
      customer never gets rejected by the API for a reason we already knew. */
const validateField = (key, value) => {
  const v = String(value || '').trim();
  if (key === 'name')    return v.length >= 2 ? '' : 'Please tell us your full name.';
  if (key === 'email')   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'We need a valid email for order updates.';
  if (key === 'address') return v.length >= 10 ? '' : 'We need a full delivery address (at least 10 characters).';
  if (key === 'phone') {
    if (!v) return 'We need a phone number to deliver to you.';
    if (v.replace(/\D/g, '').length < 7) return 'That number looks too short — please check it.';
  }
  return '';
};

/* ── Field wrapper: label row + icon control + hint/error (never placeholder-only) ── */
const Field = ({ id, label, icon, required, optional, multiline, error, hint, footer, children }) => (
  <div className="df-group">
    <div className="df-labelrow">
      <label htmlFor={id} className="df-label">{label}</label>
      {(required || optional) && (
        <span className={`df-badge ${required ? 'is-req' : ''}`}>{required ? 'Required' : 'Optional'}</span>
      )}
    </div>
    <div className={`df-control ${multiline ? 'is-top' : ''} ${error ? 'has-error' : ''}`}>
      {icon && <span className="df-icon" aria-hidden="true">{icon}</span>}
      {children}
    </div>
    {error
      ? <p id={`${id}-err`} className="df-error"><AlertCircle size={13} aria-hidden="true" /> {error}</p>
      : hint ? <p id={`${id}-hint`} className="df-hint">{hint}</p> : null}
    {footer}
  </div>
);

/* ================================================================== */
const DeliveryMenu = () => {
  const [dishes,    setDishes]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [cart,      setCart]      = useState([]);
  const [cartOpen,  setCartOpen]  = useState(false);
  const errRef = useRef(null);
  /* Animation state */
  const [addedId,    setAddedId]    = useState(null);   // card that just got added
  const [cartPulse,  setCartPulse]  = useState(false);  // ring glow on cart bar
  const [flyParticles, setFlyParticles] = useState([]); // [{id,x,y}] flying dots
  const cardRefs  = useRef({});   // itemId → DOM element refs
  const cartBarRef = useRef(null);

  /* Tax / discount / service-charge settings, matched to the server */
  const [settings,  setSettings]  = useState({ taxPercent: 5, discountPercent: 0 });
  useEffect(() => { fetchAndCacheGlobalSettings().then(setSettings); }, []);

  /* Order flow states */
  const [step,       setStep]       = useState('menu');   // 'menu' | 'checkout' | 'placed'
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [address,    setAddress]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [orderErr,   setOrderErr]   = useState('');
  const [orders,     setOrders]     = useState([]);        // this device's delivery orders

  /* Payment choice + QR modal */
  const [payMethod,       setPayMethod]       = useState('cash'); // 'cash' | 'qr'
  const [paymentOrder,    setPaymentOrder]    = useState(null);
  const [paymentQr,       setPaymentQr]       = useState('');
  const [proofImage,      setProofImage]      = useState('');
  const [paymentError,    setPaymentError]    = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);

  /* Delivery-details form state */
  const [errs,      setErrs]      = useState({});
  const [touched,   setTouched]   = useState({});
  const [notesOpen, setNotesOpen] = useState(false);
  const lastSig = useRef('');

  /* Fetch menu */
  useEffect(() => {
    const API = getAPI_URL();
    fetch(`${API}/api/menu`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        setDishes((Array.isArray(data) ? data : []).filter(i => i.isAvailable !== false));
        setLoading(false);
      })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, []);

  /* Categories */
  const categories = useMemo(() => {
    const cats = [...new Set(dishes.map(d => d.category).filter(Boolean))].sort();
    return ['All', ...cats];
  }, [dishes]);

  /* Filtered list */
  const visible = useMemo(() => {
    let list = activeCat === 'All' ? dishes : dishes.filter(d => d.category === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q));
    }
    return list;
  }, [dishes, activeCat, search]);

  /* Cart helpers */
  const cartQty = useCallback((id) => cart.find(i => i.id === id)?.qty || 0, [cart]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0);
  const totals = calculateOrderTotals(subtotal, settings);

  const addToCart = (dish, e) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === dish.id);
      return existing
        ? prev.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { ...dish, qty: 1 }];
    });
    /* ── micro-animations ── */
    // 1. card bounce
    setAddedId(dish.id);
    setTimeout(() => setAddedId(null), 520);
    // 2. cart bar glow pulse
    setCartPulse(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setCartPulse(true)));
    setTimeout(() => setCartPulse(false), 700);
    // 3. fly particle from card → cart bar
    if (e) {
      const card = cardRefs.current[dish.id];
      const bar  = cartBarRef.current;
      if (card && bar) {
        const cr = card.getBoundingClientRect();
        const br = bar.getBoundingClientRect();
        const startX = cr.left + cr.width / 2;
        const startY = cr.top  + cr.height / 2;
        const endX   = br.left + br.width / 2;
        const endY   = br.top  + br.height / 2;
        const pid = Date.now() + Math.random();
        setFlyParticles(p => [...p, { id: pid, startX, startY, endX, endY }]);
        setTimeout(() => setFlyParticles(p => p.filter(x => x.id !== pid)), 700);
      }
    }
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.qty <= 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  };

  const clearItem = (id) => setCart(prev => prev.filter(i => i.id !== id));

  /* Cart drawer: Escape + body scroll lock */
  useEffect(() => {
    if (!cartOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setCartOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [cartOpen]);

  /* Field helpers */
  const touchField = (key, value) => {
    setTouched(t => ({ ...t, [key]: true }));
    setErrs(er => ({ ...er, [key]: validateField(key, value) }));
  };
  const editField = (key, value, setter) => {
    setter(value);
    if (touched[key]) setErrs(er => ({ ...er, [key]: validateField(key, value) }));
  };

  /* ── Place order (server recomputes every money value) ── */
  const placeOrder = async (e) => {
    e.preventDefault();

    const found = {
      name:    validateField('name', name),
      phone:   validateField('phone', phone),
      email:   validateField('email', email),
      address: validateField('address', address),
    };
    setTouched({ name: true, phone: true, email: true, address: true });
    setErrs(found);
    const firstKey = ['name', 'phone', 'email', 'address'].find(k => found[k]);
    if (firstKey) {
      setOrderErr('Please check the highlighted fields — we need your contact and delivery details.');
      setTimeout(() => document.getElementById(`dm-${firstKey}`)?.focus(), 0);
      return;
    }
    if (cart.length === 0) { setOrderErr('Your cart is empty.'); return; }

    setSubmitting(true);
    setOrderErr('');
    const API = getAPI_URL();

    try {
      // table_name is what staff panels display for this order, so the
      // customer's name is the most useful label for home delivery.
      const tableCode = name.trim().slice(0, 80);
      // Special instructions ride along with the address (the server has no
      // separate notes column) so the staff member sees them at a glance.
      const addressBlock = notes.trim()
        ? `${address.trim()} — Note: ${notes.trim().slice(0, 200)}`
        : address.trim();
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: tableCode,
          type: 'DELIVERY',
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim(),
          delivery_address: addressBlock,
          items: cart.map(i => ({ menuItemId: i.id, name: i.name, quantity: i.qty, price: i.price })),
          payment_first: true,
          payment_method: payMethod === 'cash' ? 'cash' : 'qr',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.id) {
        throw new Error(data?.message || 'Could not place the order. Please try again.');
      }
      addStoredOrderId(data.id);
      setCart([]);
      setStep('placed');
      // Cash COD orders go straight to admin approval → kitchen → delivery.
      // QR orders need the customer to pay now: open the payment dialog.
      if (payMethod === 'qr') {
        setProofImage('');
        setPaymentQr('');
        setPaymentOrder(data);
      }
    } catch (err) {
      setOrderErr(err.message || 'Network problem — could not place the order. Please try again.');
      setTimeout(() => errRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Payment QR modal data ── */
  useEffect(() => {
    if (!paymentOrder) return;
    setPaymentQr('');
    setPaymentError('');
    fetch(`${getAPI_URL()}/api/settings?key=payment_qr_image`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        const val = data?.value;
        if (val && (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(val) || /^(https?:\/\/|\/)/i.test(val))) {
          setPaymentQr(val);
        } else {
          setPaymentError('Payment QR is not configured. Please ask the restaurant for assistance.');
        }
      })
      .catch(() => setPaymentError('Could not load the restaurant payment QR.'));
  }, [paymentOrder]);

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
      setPaymentError('Upload your payment screenshot before submitting.');
      return;
    }
    setSubmittingProof(true); setPaymentError('');
    try {
      const res = await fetch(`${getAPI_URL()}/api/orders/${paymentOrder.id}/payment-proof`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccessToken: paymentOrder.paymentAccessToken, proofImage }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Could not submit payment proof');
      setPaymentOrder(null);
      // Mark locally so the tracker stops asking for payment until a fresh
      // poll confirms the admin's decision.
      setOrders(p => p.map(o => o.id === paymentOrder.id
        ? { ...o, payment_status: 'verification_pending' }
        : o));
    } catch (err) {
      setPaymentError(err.message || 'Could not submit payment proof');
    } finally {
      setSubmittingProof(false);
    }
  };

  /* Re-open the payment dialog after a refresh or a rejection: the server
     restores the one-time token only while payment is still due (same
     flow the QR table menu uses). */
  const openPayment = async (order) => {
    setPaymentError('');
    setProofImage('');
    try {
      let token = paymentOrder?.id === order.id ? paymentOrder.paymentAccessToken : null;
      if (!token) {
        if (order.payment_access_token) {
          token = order.payment_access_token;
        } else {
          const response = await fetch(`${getAPI_URL()}/api/orders/${order.id}/payment-session?tableId=${encodeURIComponent(order.table_name || '')}`);
          const session = await response.json();
          if (!response.ok || !session.paymentAccessToken) {
            throw new Error(session.message || 'Payment session is unavailable. Refresh and try again.');
          }
          token = session.paymentAccessToken;
        }
      }
      setPaymentOrder({ ...order, paymentAccessToken: token });
    } catch (err) {
      setPaymentError(err.message || 'Could not open payment. Please refresh and try again.');
    }
  };

  /* ── Live status polling for placed orders (4s) ── */
  useEffect(() => {
    if (step !== 'placed') return undefined;
    let alive = true;
    const poll = async () => {
      if (document.hidden || !alive) return;
      try {
        const ids = getStoredOrderIds();
        if (ids.size === 0) return;
        // SECURITY: send our own order ids so the server only returns THOSE
        // rows. The old unfiltered ?type=DELIVERY call made the server send
        // every customer's order (names/phones/addresses) to the browser,
        // which then threw all but ours away — and the backend now rejects
        // anonymous list calls without a narrowing filter.
        const res = await fetch(
          `${getAPI_URL()}/api/orders?type=DELIVERY&ids=${encodeURIComponent(
            [...ids].slice(0, 50).join(',')
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data) || !alive) return;
        const mine = data
          .filter(o => ids.has(Number(o.id)))
          .sort((a, b) => Number(b.id) - Number(a.id));
        // Only re-render when guest-visible state actually changed.
        const sig = mine.map(o => [
          o.id, o.status, o.payment_status || '',
          (o.items || []).length, Number(o.total) || 0,
        ].join(':')).join('|');
        if (sig !== lastSig.current) {
          lastSig.current = sig;
          setOrders(mine);
        }
      } catch { /* keep previous state */ }
    };
    poll();
    const id = setInterval(poll, 4000);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [step]);

  /* Reset back to the menu for a fresh order */
  const startNewOrder = () => {
    setStep('menu'); setName(''); setPhone(''); setEmail(''); setAddress(''); setNotes('');
    setErrs({}); setTouched({}); setNotesOpen(false); setOrderErr(''); setPayMethod('cash');
    setPaymentOrder(null); setProofImage(''); setPaymentError('');
    // BUGFIX: stale orders/signature previously leaked into the next order's
    // placed screen (old cards resurfaced next to the new one).
    setOrders([]);
    lastSig.current = '';
  };

  /* ══════════════════ PLACED SCREEN ══════════════════ */
  if (step === 'placed') {
    return (
      <PublicShell active="order">
        <div className="pw-container px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="max-w-2xl mx-auto">

            {/* Success header */}
            <div className="text-center pw-reveal">
              <span className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(52,211,153,0.12)', border: '2px solid #34D399', boxShadow: '0 0 60px -14px rgba(52,211,153,0.7)' }}>
                <ShieldCheck size={38} color="#34D399" aria-hidden="true" />
              </span>
              <h1 className="pw-ink font-extrabold mb-2"
                  style={{ fontSize: 'clamp(28px,4vw,40px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                Thanks — your order is in!
              </h1>
              <p className="pw-sub text-[15px]">
                Track everything below. We&apos;ll also email you at every milestone.
              </p>
            </div>

            {/* Live order + payment tracking */}
            <div className="mt-8 space-y-4">
              {orders.length === 0 && (
                <div className="pw-card p-6 text-center pw-reveal" role="status">
                  <Loader2 size={22} className="mx-auto mb-3 animate-spin" style={{ color: '#C2410C' }} aria-hidden="true" />
                  <p className="pw-ink font-semibold text-[15px]">Loading your order status…</p>
                  <p className="pw-muted text-[13px] mt-1">This usually takes just a moment.</p>
                </div>
              )}

              {(() => {
                // Finished = delivered/completed AND no payment still being
                // resolved. Active orders render first so a long history
                // of past deliveries can never bury the live one.
                const isFinished = (o) =>
                  ['delivered', 'completed'].includes((o.status || '').toLowerCase()) &&
                  !['awaiting_payment', 'rejected'].includes(o.payment_status || '');
                const activeOrders = orders.filter(o => !isFinished(o));
                const pastOrders   = orders.filter(isFinished);
                const offset = activeOrders.length;
                return [
                  ...activeOrders.map((o, oi) => ({ o, oi, firstPast: false })),
                  ...pastOrders.map((o, oi) => ({ o, oi: oi + offset, firstPast: true })),
                ];
              })().map(({ o, oi, firstPast }) => {
                const ps = o.payment_status || '';
                const st = (o.status || '').toLowerCase();
                const isQr = o.payment_method === 'qr';
                const isPaid = ps === 'paid' || o.bill?.bill_status === 'paid';

                /* Payment chip */
                const payCfg =
                  ps === 'awaiting_payment'      ? { label: 'Payment required',     Icon: QrCode,      c: '#C2410C' } :
                  ps === 'verification_pending'  ? { label: 'Payment under review', Icon: Hourglass,   c: '#B45309' } :
                  ps === 'rejected'              ? { label: 'Payment rejected — try again', Icon: Ban, c: '#DC2626' } :
                  ps === 'cash_pending_admin'    ? { label: 'Cash collected — admin sign-off', Icon: Banknote, c: '#059669' } :
                  isPaid || o.payment_method === 'qr_payment'
                                                 ? { label: 'Payment approved ✓',   Icon: CheckCircle, c: '#059669' } :
                  ps === 'cash_pending'          ? { label: 'Cash on delivery',     Icon: Banknote,    c: '#059669' } :
                                                   { label: o.payment_method === 'cash' ? 'Cash on delivery' : '—', Icon: Banknote, c: '#7A6553' };

                /* Order stage chip + progress */
                const stageCfg =
                  st === 'delivered'           ? { label: 'Delivered — enjoy!',        Icon: PackageCheck, c: '#2563EB', pct: 95 } :
                  st === 'completed'           ? { label: 'Completed',                 Icon: PackageCheck, c: '#059669', pct: 100 } :
                  st === 'ready'               ? { label: 'Approved — out for delivery', Icon: Truck, c: '#047857', pct: 75 } :
                  st === 'preparing'           ? { label: 'In the kitchen',            Icon: Flame,        c: '#7C3AED', pct: 45 } :
                                                 { label: 'Awaiting admin approval',   Icon: Clock,        c: '#D97706', pct: 22 };

                const needsPayment = ['awaiting_payment', 'rejected'].includes(ps);
                const PayIcon = payCfg.Icon;
                const StageIcon = stageCfg.Icon;

                return (
                  <React.Fragment key={o.id}>
                    {firstPast && (
                      <div className="flex items-center gap-3 pt-4" aria-hidden="false">
                        <span className="h-px flex-1" style={{ background: 'var(--pw-line)' }} />
                        <span className="pw-muted text-[11px] font-extrabold uppercase tracking-[0.16em]">
                          Past orders
                        </span>
                        <span className="h-px flex-1" style={{ background: 'var(--pw-line)' }} />
                      </div>
                    )}
                  <div className="pw-card overflow-hidden pw-reveal dm-trk"
                       style={ firstPast
                         ? { animationDelay: `${oi * 90}ms`, opacity: 0.75 }
                         : { animationDelay: `${oi * 90}ms` }}>
                    {/* Card head */}
                    <div className="dm-trk-head">
                      <span className="dm-trk-icon" aria-hidden="true"><Truck size={18} /></span>
                      <div className="min-w-0">
                        <p className="pw-ink font-extrabold text-[16px] leading-tight">Order #{o.id}</p>
                        <p className="pw-muted text-[12.5px]">
                          {(o.items || []).length} {o.items?.length === 1 ? 'item' : 'items'} · Total{' '}
                          <strong style={{ color: '#C2410C' }}>{CURRENCY}{Number(o.total).toFixed(2)}</strong>
                          {' '}(incl. {SERVICE_CHARGE_PERCENT}% service charge + GST)
                        </p>
                      </div>
                      <span className="dm-trk-badge" title={payCfg.label}>
                        <PayIcon size={13} aria-hidden="true" /> {payCfg.label}
                      </span>
                    </div>

                    {/* Stage progress */}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: 'rgba(245,158,11,0.12)', color: stageCfg.c }} aria-hidden="true">
                          <StageIcon size={17} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="pw-ink font-bold text-[14.5px] leading-tight">{stageCfg.label}</p>
                          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(63,32,4,0.08)' }}>
                            <div className="h-full rounded-full dm-trk-bar"
                                 style={{ width: `${stageCfg.pct}%`, background: `linear-gradient(90deg,${stageCfg.c}88,${stageCfg.c})` }} />
                          </div>
                        </div>
                      </div>

                      {/* Explanations per state */}
                      {ps === 'awaiting_payment' && isQr && (
                        <p className="pay-note" style={{ color: '#B91C1C', borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.09)' }}>
                          This order is waiting for your payment. Once an admin approves your payment, the kitchen starts and a staff member delivers your food.
                        </p>
                      )}
                      {ps === 'verification_pending' && (
                        <p className="pay-note" style={{ color: '#92400E', borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.1)' }}>
                          Your payment screenshot has been sent to the admin for approval. Cooking starts right after the approval.
                        </p>
                      )}
                      {ps === 'rejected' && (
                        <p className="pay-note" style={{ color: '#B91C1C', borderColor: 'rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.1)' }}>
                          {o.payment_rejection_reason ||
                            (isQr ? 'Your payment could not be verified. Please pay again or contact the restaurant.' : 'Your payment is pending review.')}
                        </p>
                      )}
                      {isPaid && !['delivered', 'completed'].includes(st) && (
                        <p className="pay-note" style={{ color: '#047857', borderColor: 'rgba(52,211,153,0.35)', background: 'rgba(52,211,153,0.1)' }}>
                          Payment approved — your order is heading out with our delivery staff. Keep your phone nearby.
                        </p>
                      )}
                      {ps === 'cash_pending' && st !== 'delivered' && (
                        <p className="pay-note" style={{ color: '#047857', borderColor: 'rgba(52,211,153,0.3)', background: 'rgba(16,185,129,0.1)' }}>
                          Pay <strong>{CURRENCY}{Number(o.total).toFixed(2)}</strong> in cash when your order arrives at your door.
                        </p>
                      )}
                      {st === 'delivered' && (
                        <p className="pay-note" style={{ color: '#1D4ED8', borderColor: 'rgba(96,165,250,0.35)', background: 'rgba(96,165,250,0.1)' }}>
                          Your food has been delivered. Bon appétit — thanks for ordering with us!
                        </p>
                      )}

                      {/* Pay / retry action */}
                      {needsPayment && (
                        <button type="button" className="pw-btn-primary w-full mt-4" onClick={() => openPayment(o)}>
                          {ps === 'rejected' ? <><Ban size={17} aria-hidden="true" /> Submit corrected payment</> : <><QrCode size={17} aria-hidden="true" /> Pay now — {CURRENCY}{Number(o.total).toFixed(2)}</>}
                        </button>
                      )}

                      {/* Item recap */}
                      <ul className="mt-4 space-y-1.5 text-[12.5px]">
                        {(o.items || []).map((it, ii) => (
                          <li key={ii} className="flex justify-between gap-3 pw-muted">
                            <span className="truncate min-w-0 flex-1"><span className="font-bold pw-ink">{it.quantity || it.qty}×</span> {it.name}</span>
                            <span className="tabular-nums shrink-0">{CURRENCY}{Number(it.price).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-7 flex flex-col sm:flex-row gap-3 pw-reveal">
              <button type="button" onClick={startNewOrder} className="pw-btn-primary w-full sm:w-auto">
                Order again
              </button>
              <Link to="/" className="pw-btn-ghost-lg w-full sm:w-auto justify-center">Back to home</Link>
            </div>

            <div className="mt-8 grid sm:grid-cols-3 gap-3 text-center">
              {[
                { icon: <Clock size={15} />,      text: 'Live status updates' },
                { icon: <Phone size={15} />,      text: 'Rider may call you' },
                { icon: <CreditCard size={15} />, text: 'All taxes + service included' },
              ].map(({ icon, text }) => (
                <div key={text} className="pw-chip justify-center">
                  <span style={{ color: '#C2410C' }} aria-hidden="true">{icon}</span> {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QR payment dialog */}
        {paymentOrder && <PaymentModal
          paymentOrder={paymentOrder} paymentQr={paymentQr} proofImage={proofImage}
          paymentError={paymentError} submittingProof={submittingProof}
          close={() => setPaymentOrder(null)}
          selectProof={selectProof} submit={submitPaymentProof}
        />}

        <style>{placedCSS}</style>
      </PublicShell>
    );
  }

  /* ══════════════════ CHECKOUT SCREEN ══════════════════ */
  if (step === 'checkout') {
    return (
      <PublicShell active="order">
        <div className="pw-container px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="max-w-2xl mx-auto">

            <button type="button" onClick={() => setStep('menu')} className="dm-back">
              <ChevronLeft size={16} aria-hidden="true" /> Back to menu
            </button>

            <div className="mt-6 mb-7">
              <h1 className="pw-ink font-extrabold"
                  style={{ fontSize: 'clamp(26px,3.6vw,36px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
                Confirm your order
              </h1>
              <p className="pw-muted text-[14.5px] mt-1.5">Check your items, tell us where to deliver, and choose how you pay.</p>
            </div>

            {/* Order summary */}
            <section className="pw-card p-5 sm:p-6 mb-5" aria-labelledby="dm-summary-h">
              <h2 id="dm-summary-h" className="pw-ink font-bold mb-4 flex items-center gap-2">
                <ShoppingCart size={17} style={{ color: '#C2410C' }} aria-hidden="true" /> Order summary
                <span className="pw-chip ml-auto">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span>
              </h2>
              <ul className="space-y-2.5">
                {cart.map(item => (
                  <li key={item.id} className="flex justify-between items-center gap-3 py-2 border-b pw-line last:border-0">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="pw-ink text-sm font-semibold truncate">{item.name}</span>
                      <span className="shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-md"
                            style={{ background: 'rgba(234,88,12,0.12)', color: '#C2410C' }}>× {item.qty}</span>
                    </span>
                    <span className="text-sm font-bold shrink-0" style={{ color: '#C2410C' }}>
                      {CURRENCY}{(item.price * item.qty).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between pw-muted"><dt>Subtotal</dt><dd className="tabular-nums">{CURRENCY}{totals.subtotal.toFixed(2)}</dd></div>
                <div className="flex justify-between pw-muted"><dt>Discount{totals.discountPercent > 0 ? ` (${totals.discountPercent}%)` : ''}</dt><dd className="tabular-nums">{CURRENCY}{totals.discountAmount.toFixed(2)}</dd></div>
                <div className="flex justify-between" style={{ color: '#047857' }}>
                  <dt className="font-bold">Service charge ({SERVICE_CHARGE_PERCENT}%)</dt>
                  <dd className="tabular-nums font-bold">+{CURRENCY}{totals.serviceCharge.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between pw-muted"><dt>GST ({totals.taxPercent}%){totals.taxPercent > 0 ? '' : ' — included'}</dt><dd className="tabular-nums">{CURRENCY}{totals.taxAmount.toFixed(2)}</dd></div>
                <div className="flex justify-between pw-ink font-extrabold text-base pt-3 mt-1 pw-rule-t">
                  <dt>Total</dt><dd style={{ color: '#C2410C' }} className="tabular-nums">{CURRENCY}{totals.total.toFixed(2)}</dd>
                </div>
              </dl>
              <p className="pw-muted text-[11.5px] mt-2 text-right">
                All prices include the {SERVICE_CHARGE_PERCENT}% service charge and GST — nothing extra at your door.
              </p>
            </section>

            {/* Delivery details + payment choice */}
            <form onSubmit={placeOrder} noValidate className="pw-card overflow-hidden">
              <div className="df-head">
                <span className="df-head-icon" aria-hidden="true"><MapPin size={20} /></span>
                <div className="min-w-0">
                  <h2 className="pw-ink font-extrabold text-[17px] leading-tight">Delivery details</h2>
                  <p className="pw-muted text-[13px] mt-0.5">Where should we bring your food?</p>
                </div>
                <span className="df-head-chip">~20 min</span>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {orderErr && (
                  <div ref={errRef} tabIndex={-1} role="alert" className="df-alert">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{orderErr}</span>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field id="dm-name" label="Your name" required icon={<User size={17} />}
                         error={touched.name ? errs.name : ''}
                         hint="So the rider knows who to look for">
                    <input id="dm-name" type="text" value={name}
                           onChange={e => editField('name', e.target.value, setName)}
                           onBlur={() => touchField('name', name)}
                           autoComplete="name" placeholder="e.g. Karma Wangchuk"
                           className="df-input" aria-required="true"
                           aria-invalid={!!(touched.name && errs.name)}
                           aria-describedby={touched.name && errs.name ? 'dm-name-err' : 'dm-name-hint'} />
                  </Field>

                  <Field id="dm-phone" label="Phone number" required icon={<Phone size={17} />}
                         error={touched.phone ? errs.phone : ''}
                         hint="For delivery updates — we'll only call about this order">
                    <input id="dm-phone" type="tel" inputMode="tel" value={phone}
                           onChange={e => editField('phone', e.target.value, setPhone)}
                           onBlur={() => touchField('phone', phone)}
                           autoComplete="tel" placeholder="+975 17 …"
                           className="df-input" aria-required="true"
                           aria-invalid={!!(touched.phone && errs.phone)}
                           aria-describedby={touched.phone && errs.phone ? 'dm-phone-err' : 'dm-phone-hint'} />
                  </Field>
                </div>

                <Field id="dm-email" label="Email" required icon={<Mail size={17} />}
                       error={touched.email ? errs.email : ''}
                       hint="Order + payment confirmations land here automatically">
                  <input id="dm-email" type="email" inputMode="email" value={email}
                         onChange={e => editField('email', e.target.value, setEmail)}
                         onBlur={() => touchField('email', email)}
                         autoComplete="email" placeholder="you@example.com"
                         className="df-input" aria-required="true"
                         aria-invalid={!!(touched.email && errs.email)}
                         aria-describedby={touched.email && errs.email ? 'dm-email-err' : 'dm-email-hint'} />
                </Field>

                <Field id="dm-address" label="Delivery address" required icon={<MapPin size={17} />}
                       error={touched.address ? errs.address : ''}
                       hint="Street, landmark and locality — the clearer, the faster">
                  <input id="dm-address" type="text" value={address}
                         onChange={e => editField('address', e.target.value, setAddress)}
                         onBlur={() => touchField('address', address)}
                         autoComplete="street-address"
                         placeholder="e.g. Norzin Rd, near the clock tower, Thimphu"
                         className="df-input" aria-required="true"
                         aria-invalid={!!(touched.address && errs.address)}
                         aria-describedby={touched.address && errs.address ? 'dm-address-err' : 'dm-address-hint'} />
                </Field>

                {/* Special instructions — progressive disclosure */}
                {!notesOpen ? (
                  <button type="button" className="df-note-btn" onClick={() => setNotesOpen(true)}>
                    <Sparkles size={15} aria-hidden="true" />
                    Add special instructions
                    <span className="df-note-plus" aria-hidden="true">+</span>
                  </button>
                ) : (
                  <Field id="dm-notes" label="Special instructions" optional multiline
                         icon={<MessageSquare size={17} />}
                         footer={(
                           <div className="df-footrow">
                             <span className="df-hint">Allergies, spice level, gate code…</span>
                             <span className="df-count tabular-nums">{notes.length}/200</span>
                           </div>
                         )}>
                    <textarea id="dm-notes" value={notes} rows={3} maxLength={200}
                              onChange={e => setNotes(e.target.value)}
                              placeholder="Allergies, no spice, gate code…"
                              className="df-input df-textarea" />
                  </Field>
                )}

                {/* ── Payment method choice ── */}
                <fieldset className="dm-payset">
                  <legend className="dm-paylegend">How would you like to pay?</legend>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: 'cash', label: 'Cash on delivery', Icon: Banknote,
                        desc: 'Pay our staff member in cash at your door. Admin approves the order and cash is signed off on delivery.',
                        active: payMethod === 'cash',
                        color: '52,211,153',
                      },
                      {
                        id: 'qr', label: 'Pay online (QR)', Icon: QrCode,
                        desc: 'Scan our QR, upload the payment screenshot, and an admin reviews it before the kitchen starts.',
                        active: payMethod === 'qr',
                        color: '245,158,11',
                      },
                    ].map(({ id, label, Icon, desc, active, color }) => (
                      <button key={id} type="button"
                              onClick={() => setPayMethod(id)}
                              aria-pressed={active}
                              className="dm-payopt"
                              style={active
                                ? { borderColor: `rgb(${color})`, background: `rgba(${color},0.09)`, boxShadow: `0 10px 26px -16px rgba(${color},0.85)` }
                                : undefined}>
                        <span className="flex items-center gap-2.5 w-full">
                          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: `rgba(${color},0.13)`, color: `rgb(${color})` }} aria-hidden="true">
                            <Icon size={17} />
                          </span>
                          <span className="pw-ink font-bold text-[14px] text-left leading-tight">{label}</span>
                          <span className="dm-paycheck ml-auto"
                                style={active
                                  ? { background: `rgb(${color})`, color: '#08120B', opacity: 1 } : undefined}
                                aria-hidden="true"><CheckCircle size={14} /></span>
                        </span>
                        <span className="dm-paydesc">{desc}</span>
                      </button>
                    ))}
                  </div>
                  {payMethod === 'qr' && (
                    <p className="dm-payhint" style={{ color: '#92400E' }}>
                      <ShieldCheck size={13} aria-hidden="true" />
                      Your food is prepared only after an admin approves your payment screenshot.
                    </p>
                  )}
                  {payMethod === 'cash' && (
                    <p className="dm-payhint" style={{ color: '#047857' }}>
                      <Truck size={13} aria-hidden="true" />
                      An admin approves your order, the kitchen starts, and you pay in cash at your door.
                    </p>
                  )}
                </fieldset>
              </div>

              {/* Sticky submit */}
              <div className="df-submit">
                <button type="submit" disabled={!!submitting || cart.length === 0}
                        className="pw-btn-primary w-full disabled:opacity-60">
                  {submitting
                    ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Placing order…</>
                    : payMethod === 'cash'
                      ? <><Banknote size={18} aria-hidden="true" /> Place order — pay {CURRENCY}{totals.total.toFixed(2)} on delivery</>
                      : <><QrCode size={18} aria-hidden="true" /> Place order — pay {CURRENCY}{totals.total.toFixed(2)} by QR</>}
                </button>
                <p className="df-fineprint">
                  By placing this order you agree to our{' '}
                  <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* BUGFIX: the delivery-details form needs its styles on THIS screen
            — the menu screen's <style> only renders there. */}
        <style>{checkoutCSS}</style>
      </PublicShell>
    );
  }

  /* ══════════════════ MAIN MENU SCREEN ══════════════════ */
  return (
    <PublicShell active="order">

      {/* Page header */}
      <section className="relative overflow-hidden" style={{ background: 'var(--pw-bg)' }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(560px 320px at 10% 0%,rgba(245,158,11,0.18),transparent 70%),' +
            'radial-gradient(520px 300px at 92% 10%,rgba(234,88,12,0.16),transparent 70%)',
        }} />
        <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-a"
              style={{ width: 320, height: 320, top: '-8%', left: '-3%', background: 'rgba(245,158,11,0.15)' }} />
        <span aria-hidden="true" className="pw-fx-orb pw-fx-orb-b"
              style={{ width: 260, height: 260, bottom: '-12%', right: '-2%', background: 'rgba(234,88,12,0.14)' }} />
        <div className="pw-container relative px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 sm:pb-10">
          <p className="pw-eyebrow mb-4">
            <Truck size={13} aria-hidden="true" /> Delivery across Thimphu
          </p>
          <h1 className="pw-ink font-extrabold leading-[1.06]"
              style={{ fontSize: 'clamp(30px,4.6vw,50px)', fontFamily: "'Playfair Display',Georgia,serif" }}>
            Order{' '}
            <span className="pw-fx-shimmer" style={{
              background: 'linear-gradient(90deg,#F59E0B,#FB923C 40%,#FDE68A 55%,#EA580C)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              online
            </span>
          </h1>
          <p className="pw-sub mt-3 max-w-xl text-[15.5px]">
            Fresh from the kitchen to your door in about 20 minutes. Search, tap, and we&apos;ll handle the rest.
          </p>

          <ul className="flex flex-wrap gap-2.5 mt-6">
            {[
              { icon: <Clock size={13} />,      text: '~20 min delivery' },
              { icon: <Truck size={13} />,      text: 'Free delivery on 3+ packs' },
              { icon: <CreditCard size={13} />, text: 'Cash on delivery or QR' },
            ].map(({ icon, text }) => (
              <li key={text} className="pw-chip">
                <span style={{ color: '#C2410C', display: 'inline-flex' }} aria-hidden="true">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sticky search + categories */}
      <div className="dm-filters">
        <div className="pw-container px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative lg:w-80 shrink-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pw-muted pointer-events-none" aria-hidden="true" />
              <label htmlFor="dm-search" className="sr-only">Search dishes</label>
              <input id="dm-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
                     placeholder="Search dishes…" className="dm-input dm-search" />
            </div>

            {/* BUGFIX: previously role="tab"/"tablist" with no tabpanel — broken
                semantics for assistive tech. Plain filter buttons + aria-pressed. */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-hide" aria-label="Menu categories">
              {categories.map(cat => {
                const on = activeCat === cat;
                return (
                  <button key={cat} type="button" aria-pressed={on}
                          onClick={() => setActiveCat(cat)}
                          className="dm-cat"
                          style={on
                            ? { background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)', borderColor: 'transparent', boxShadow: '0 8px 20px -10px rgba(245,158,11,0.9)' }
                            : undefined}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="pw-container px-4 sm:px-6 lg:px-8 pt-6 pb-36 sm:pb-40">

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5" aria-hidden="true">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse dm-skel" style={{ height: 260 }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="flex items-center gap-2 p-4 rounded-xl text-sm max-w-md"
               style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#B91C1C' }}>
            <AlertCircle size={16} aria-hidden="true" /> Could not load the menu. Please try again later.
          </div>
        )}

        {/* Dishes grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
            {visible.map((item, i) => {
              const qty = cartQty(item.id);
              return (
                <article key={item.id}
                         ref={el => { cardRefs.current[item.id] = el; }}
                         className={`pw-card pw-fx-tilt pw-fx-sheen overflow-hidden flex flex-col dm-in${addedId === item.id ? ' dm-card-pop' : ''}`}
                         style={{ animationDelay: `${Math.min(i, 11) * 40}ms` }}>
                  {/* Image */}
                  <div className="relative overflow-hidden" style={{ height: 'clamp(112px,16vw,170px)' }}>
                    {item.image
                      ? <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"
                             style={{ background: `linear-gradient(135deg,${grad(item.category)[0]}18,${grad(item.category)[1]}0d)` }}>
                          <Flame size={30} style={{ color: grad(item.category)[0], opacity: 0.5 }} />
                        </div>
                    }
                    {item.category && (
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(4,5,10,0.75)', color: '#FBBF24', backdropFilter: 'blur(4px)' }}>
                        {item.category}
                      </span>
                    )}
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center text-[12px] font-black"
                            style={{ background: 'var(--pw-grad)', color: 'var(--pw-ink-on-accent)' }}>
                        {qty}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 sm:p-4 flex flex-col flex-1 min-w-0">
                    <p className="pw-ink font-semibold leading-snug mb-1 text-[13.5px] sm:text-[14.5px] line-clamp-2">{item.name}</p>
                    {item.description && <p className="pw-muted text-[12px] line-clamp-2 mb-3">{item.description}</p>}
                    <div className="mt-auto">                       <p className="font-black text-[15px] sm:text-[16px] tabular-nums" style={{ color: '#C2410C' }}>
                        {CURRENCY}{Number(item.price).toFixed(2)}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        {qty === 0 ? (
                          <button type="button" onClick={(e) => addToCart(item, e)} className={`dm-add${addedId === item.id ? ' dm-add-pop' : ''}`}>
                            <Plus size={15} aria-hidden="true" /> Add
                          </button>
                        ) : (
                          <div className="dm-stepper">
                            <button type="button" onClick={() => removeFromCart(item.id)}
                                    aria-label={`Remove one ${item.name}`}>
                              <Minus size={15} />
                            </button>
                            <span className={`tabular-nums${addedId === item.id ? ' dm-qty-bounce' : ''}`}>{qty}</span>
                            <button type="button" onClick={(e) => addToCart(item, e)}
                                    aria-label={`Add one ${item.name}`}>
                              <Plus size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {visible.length === 0 && (
              <div className="col-span-full text-center py-16 pw-card px-6">
                <Flame size={36} className="mx-auto mb-3" style={{ color: '#F59E0B', opacity: 0.45 }} />
                <p className="pw-ink font-semibold mb-1">No dishes found</p>
                <p className="pw-muted text-sm">Try a different category or clear your search.</p>
                <button type="button" onClick={() => { setSearch(''); setActiveCat('All'); }}
                        className="pw-btn-ghost-lg mt-5 mx-auto">
                  Reset filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating overlays — portalled to <body>. BUGFIX: the shell's
          page-in animation and reveal transitions temporarily transform
          <main>, which turned `position:fixed` into "position: absolute
          against <main>" — the cart bar rendered deep down near the
          footer instead of pinned to the viewport. A portal sidesteps
          every ancestor transform.

          The children are wrapped in a `pw-root` div because the Ember
          design tokens (--pw-grad, --pw-ink, …) are defined on .pw-root in
          the shell — without that wrapper the portalled cart bar inherited
          NOTHING and rendered fully transparent (FIX: ghost cart). */}
      {createPortal(<div className="pw-root">
      {/* ── Flying particles ── */}
      {flyParticles.map(p => (
        <span key={p.id} className="dm-fly-dot" aria-hidden="true"
              style={{
                '--fx': `${p.endX - p.startX}px`,
                '--fy': `${p.endY - p.startY}px`,
                left: p.startX,
                top:  p.startY,
              }} />
      ))}

      {/* ── Floating cart bar ── */}
      {cartCount > 0 && !cartOpen && (
        <div className={`dm-cartbar${cartPulse ? ' dm-cartbar-pulse' : ''}`} ref={cartBarRef}>
          <button type="button" onClick={() => setCartOpen(true)} className="dm-cartbar-btn">
            <span className="flex items-center gap-3 min-w-0">
              <span className="relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.18)' }}>
                <ShoppingCart size={17} aria-hidden="true" />
                <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10.5px] font-black${cartPulse ? ' dm-badge-bounce' : ''}`}
                      style={{ background: '#064E3B', color: '#ECFDF5' }}>{cartCount}</span>
              </span>
              <span className="text-left min-w-0">
                <span className="block text-[11.5px] font-bold uppercase tracking-wider opacity-75 leading-none">View cart</span>
                <span className="block text-[15px] font-black leading-tight tabular-nums">{CURRENCY}{totals.total.toFixed(2)}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold whitespace-nowrap">
              Checkout <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}

      {/* ── Cart drawer (redesigned: rich bottom sheet on phones, side panel on desktop) ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-stretch justify-end sm:justify-end" role="dialog" aria-modal="true" aria-label="Your cart">
          <div className="flex-1 dm-backdrop" onClick={() => setCartOpen(false)} />
          <div className="dm-panel">
            <div className="dm-sheet-handle sm:hidden" aria-hidden="true"><span /></div>

            {/* Header */}
            <div className="dm-cart-head">
              <span className="dm-cart-head-icon" aria-hidden="true"><ShoppingCart size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[16.5px] font-extrabold text-white leading-tight">Your cart</h2>
                <p className="text-[12px] font-bold text-amber-200 mt-0.5 tabular-nums">
                  {cartCount} {cartCount === 1 ? 'item' : 'items'} · {CURRENCY}{totals.total.toFixed(2)}
                </p>
              </div>
              {cart.length > 0 && (
                <button type="button" onClick={() => setCart([])} className="dm-head-ghost">
                  Clear
                </button>
              )}
              <button type="button" onClick={() => setCartOpen(false)} className="dm-head-close" aria-label="Close cart">
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
              {cart.length === 0 && (
                <div className="dm-cart-empty">
                  <div className="dm-cart-empty-icon" aria-hidden="true"><ShoppingCart size={26} /></div>
                  <p className="pw-ink font-extrabold text-[15.5px] mb-1">Your cart is empty</p>
                  <p className="pw-muted text-[13px] leading-relaxed">
                    Nothing here yet. Add some delicious items from the menu.
                  </p>
                  <button type="button" onClick={() => setCartOpen(false)} className="pw-btn-ghost-lg mt-4 mx-auto">
                    Browse menu
                  </button>
                </div>
              )}
              {cart.map(item => (
                <div key={item.id} className="dm-cart-item">
                  <span className="dm-cart-accent" aria-hidden="true"
                        style={{ background: `linear-gradient(180deg, ${grad(item.category)[0]}, ${grad(item.category)[1]})` }} />
                  {item.image
                    ? <img src={item.image} alt="" className="dm-cart-thumb" />
                    : <div className="dm-cart-thumb dm-cart-thumb-empty"
                           style={{ background: `linear-gradient(135deg,${grad(item.category)[0]}20,${grad(item.category)[1]}12)` }}>
                        <Flame size={17} style={{ color: grad(item.category)[0], opacity: 0.6 }} />
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="pw-ink text-[14px] font-bold line-clamp-1 leading-tight">{item.name}</p>
                    <p className="text-[12.5px] font-extrabold tabular-nums mt-0.5" style={{ color: '#C2410C' }}>
                      {CURRENCY}{Number(item.price).toFixed(2)}
                      {item.qty > 1 && <span className="pw-muted font-semibold"> · {CURRENCY}{(Number(item.price) * item.qty).toFixed(2)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => removeFromCart(item.id)}
                            className="dm-mini" aria-label={`Remove one ${item.name}`}>
                      <Minus size={13} />
                    </button>
                    <span className={`pw-ink text-sm font-extrabold w-5 text-center tabular-nums${addedId === item.id ? ' dm-qty-bounce' : ''}`}>{item.qty}</span>
                    <button type="button" onClick={() => addToCart(item)}
                            className="dm-mini is-plus" aria-label={`Add one ${item.name}`}>
                      <Plus size={13} />
                    </button>
                    <button type="button" onClick={() => clearItem(item.id)}
                            className="dm-mini is-x" aria-label={`Remove ${item.name} from cart`}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + Checkout */}
            {cart.length > 0 && (
              <div className="dm-cart-foot">
                <dl className="space-y-1.5 text-[13.5px] mb-3">
                  <div className="flex justify-between pw-muted"><dt>Subtotal</dt><dd className="tabular-nums font-semibold">{CURRENCY}{totals.subtotal.toFixed(2)}</dd></div>
                  <div className="flex justify-between" style={{ color: '#047857' }}>
                    <dt>Service charge ({SERVICE_CHARGE_PERCENT}%)</dt><dd className="tabular-nums font-semibold">+{CURRENCY}{totals.serviceCharge.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between pw-muted"><dt>GST ({totals.taxPercent}%)</dt><dd className="tabular-nums font-semibold">{CURRENCY}{totals.taxAmount.toFixed(2)}</dd></div>
                  <div className="dm-cart-total">
                    <dt>Total</dt><dd className="tabular-nums">{CURRENCY}{totals.total.toFixed(2)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={() => { setCartOpen(false); setStep('checkout'); }} className="pw-btn-primary w-full">
                  <Truck size={18} aria-hidden="true" /> Proceed to checkout
                </button>
                <p className="pw-muted text-center text-[11.5px] mt-2.5 leading-relaxed">
                  Delivery details, payment method &amp; order tracking at the next step.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      </div>, document.body)}
      {/* (QR payment dialog is rendered on the placed screen when needed) */}

      {/* ── Page styles ── */}
      <style>{`
        .dm-in{opacity:0;animation:dmIn .4s cubic-bezier(0.22,1,0.36,1) both;transform:translateY(14px);}
        @keyframes dmIn{to{opacity:1;transform:none}}

        .dm-skel{
          background:linear-gradient(90deg,rgba(63,32,4,0.04) 25%,rgba(63,32,4,0.09) 37%,rgba(63,32,4,0.04) 63%);
          background-size:400% 100%;animation:dmShimmer 1.4s ease infinite;
          border:1px solid var(--pw-line);
        }
        @keyframes dmShimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}

        /* Sticky filter bar — sits directly under the sticky header */
        .dm-filters{
          position:sticky;top:64px;z-index:50;
          background:rgba(255,248,241,0.92);
          backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
          border-bottom:1px solid var(--pw-line);
        }
        @media (min-width:1024px){ .dm-filters{ top:72px; } }

        .pw-root .dm-input{
          width:100%;min-height:46px;padding:11px 14px 11px 42px;
          border-radius:14px;font-size:14.5px;color:var(--pw-ink);
          background:#FFFDFB;border:1px solid rgba(63,32,4,0.18);
          transition:border-color .2s var(--pw-ease),box-shadow .2s var(--pw-ease);
          appearance:none;-webkit-appearance:none;
        }
        .pw-root .dm-input:not(.dm-search){ padding-left:14px; }
        .pw-root .dm-input:focus{
          outline:none;border-color:#F59E0B !important;
          box-shadow:0 0 0 3px rgba(245,158,11,0.25);
        }
        .pw-root .dm-input::placeholder{ color:#A3846A !important; }
        .pw-root .dm-textarea{ min-height:96px;resize:vertical;line-height:1.6; }
        .dm-search{ padding-left:40px !important; }
        .dm-search::-webkit-search-cancel-button{ -webkit-appearance:none; }

        /* ── Delivery details form ── */
        .df-head{
          display:flex;align-items:center;gap:13px;
          padding:18px 20px;border-bottom:1px solid var(--pw-line);
          background:linear-gradient(135deg,rgba(245,158,11,0.16),rgba(234,88,12,0.07));
        }
        .df-head-icon{
          width:44px;height:44px;border-radius:14px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:var(--pw-grad);color:var(--pw-ink-on-accent);
          box-shadow:0 10px 24px -12px rgba(245,158,11,1);
        }
        .df-head-chip{
          margin-left:auto;flex-shrink:0;
          font-size:11.5px;font-weight:800;letter-spacing:0.04em;
          padding:6px 11px;border-radius:999px;white-space:nowrap;
          background:rgba(63,32,4,0.05);border:1px solid rgba(245,158,11,0.45);color:#C2410C;
        }
        .df-labelrow{ display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px; }
        .df-label{ font-size:13.5px;font-weight:700;color:var(--pw-ink); }
        .df-badge{
          font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
          padding:3px 8px;border-radius:6px;
          background:rgba(255,255,255,0.06);border:1px solid var(--pw-line);color:#7A6553;
        }
        .df-badge.is-req{ background:rgba(245,158,11,0.14);border-color:rgba(245,158,11,0.35);color:#C2410C; }
        .df-control{ position:relative; }
        .df-icon{
          position:absolute;left:15px;top:50%;transform:translateY(-50%);
          display:flex;color:#7A6553;pointer-events:none;z-index:1;
          transition:color .2s var(--pw-ease);
        }
        .df-control.is-top .df-icon{ top:17px;transform:none; }
        .df-control:focus-within .df-icon{ color:#C2410C; }
        .pw-root .df-input{
          width:100%;min-height:52px;padding:14px 15px 14px 44px;
          border-radius:14px;font-size:15px;line-height:1.5;color:var(--pw-ink);
          background:#FFFDFB;border:1.5px solid rgba(63,32,4,0.18);
          transition:border-color .2s var(--pw-ease),box-shadow .2s var(--pw-ease);
          appearance:none;-webkit-appearance:none;
        }
        .pw-root .df-input::placeholder{ color:#A3846A !important;opacity:1; }
        .pw-root .df-input:focus{
          outline:none;border-color:#F59E0B !important;
          box-shadow:0 0 0 3px rgba(245,158,11,0.24);
        }
        .pw-root .df-textarea{ min-height:96px;resize:vertical;line-height:1.65; }
        .df-control.has-error .df-input{ border-color:#F87171 !important; }
        .df-control.has-error .df-input:focus{ box-shadow:0 0 0 3px rgba(248,113,113,0.22); }
        .df-control.has-error .df-icon{ color:#F87171; }
        .df-error{ display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#B91C1C;margin-top:8px; }
        .df-footrow{ display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px; }
        .df-footrow .df-hint{ margin-top:0; }
        .df-count{ font-size:12px;font-weight:700;color:#7A6553; }
        .df-note-btn{
          width:100%;display:flex;align-items:center;gap:9px;cursor:pointer;
          min-height:48px;padding:12px 16px;border-radius:14px;
          background:rgba(63,32,4,0.04);border:1.5px dashed var(--pw-line);
          color:#5C4B3A;font-size:14px;font-weight:700;text-align:left;
          transition:all .2s var(--pw-ease);
        }
        .df-note-btn:hover{ border-color:rgba(245,158,11,0.5);color:var(--pw-ink);background:rgba(245,158,11,0.08); }
        .df-note-btn svg:first-child{ color:#C2410C; }
        .df-note-plus{ margin-left:auto;font-size:18px;font-weight:600;line-height:1; }
        .df-alert{
          display:flex;gap:9px;padding:14px 15px;border-radius:14px;font-size:14px;
          background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);color:#B91C1C;
        }

        /* Payment method chooser */
        .dm-payset{ border:0;padding:0;margin:26px 0 0; }
        .dm-paylegend{
          font-size:13px;font-weight:800;letter-spacing:0.02em;
          color:var(--pw-ink);margin-bottom:10px;padding:0;
        }
        .dm-payopt{
          display:flex;flex-direction:column;gap:8px;cursor:pointer;text-align:left;
          padding:14px;border-radius:16px;min-height:64px;
          background:rgba(63,32,4,0.04);border:1.5px solid var(--pw-line);color:var(--pw-ink);
          transition:transform .2s var(--pw-ease),background .2s var(--pw-ease),border-color .2s var(--pw-ease);
        }
        .dm-payopt:hover{ background:rgba(255,255,255,0.07);transform:translateY(-1px); }
        .dm-paycheck{
          opacity:0.25;transition:opacity .2s var(--pw-ease),background .2s var(--pw-ease);
          display:inline-flex;border-radius:999px;padding:1px;
        }
        .dm-paydesc{ font-size:12px;line-height:1.55;color:#7A6553;padding-left:46px; }
        .dm-payhint{
          display:flex;align-items:flex-start;gap:7px;
          margin-top:12px;padding:10px 13px;border-radius:12px;
          font-size:12.5px;font-weight:600;line-height:1.55;
          background:rgba(63,32,4,0.04);border:1px solid var(--pw-line);
        }
        .dm-payhint svg{ flex-shrink:0;margin-top:1px; }

        .df-submit{
          position:sticky;bottom:0;z-index:2;
          padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));
          background:rgba(255,251,246,0.97);
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
          border-top:1px solid var(--pw-line);
        }
        .df-fineprint{ margin-top:10px;text-align:center;font-size:11.5px;line-height:1.6;color:#7A6553; }
        .df-fineprint a{ color:#C2410C;font-weight:600;text-decoration:underline;text-underline-offset:2px; }
        .df-fineprint a:hover{ color:#FDE68A; }

        .dm-back{
          display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 4px;
          font-size:14px;font-weight:700;color:#5C4B3A;background:none;border:0;cursor:pointer;
          transition:color .2s var(--pw-ease),transform .2s var(--pw-ease);
        }
        .dm-back:hover{ color:var(--pw-ink);transform:translateX(-3px); }

        .dm-cat{
          flex-shrink:0;min-height:40px;padding:0 16px;border-radius:999px;
          font-size:13.5px;font-weight:700;cursor:pointer;
          background:rgba(63,32,4,0.05);border:1px solid var(--pw-line);color:#5C4B3A;
          transition:all .2s var(--pw-ease);
        }
        .dm-cat:hover{ background:rgba(63,32,4,0.1);color:var(--pw-ink); }

        .dm-add{
          flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;
          min-height:44px;border-radius:13px;cursor:pointer;
          background:var(--pw-grad);color:var(--pw-ink-on-accent);
          font-size:13.5px;font-weight:800;border:0;
          transition:transform .18s var(--pw-ease),filter .18s var(--pw-ease);
        }
        .dm-add:hover{ filter:brightness(1.07);transform:translateY(-1px); }
        .dm-add:active{ transform:scale(0.97); }

        .dm-stepper{
          flex:1;display:flex;align-items:center;
          background:rgba(63,32,4,0.05);border:1px solid var(--pw-line);border-radius:13px;
          overflow:hidden;
        }
        .dm-stepper button{
          width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
          background:transparent;border:0;color:var(--pw-ink);cursor:pointer;transition:background .18s var(--pw-ease);
        }
        .dm-stepper button:hover{ background:rgba(63,32,4,0.1); }
        .dm-stepper button:active{ background:rgba(245,158,11,0.3); }
        .dm-stepper span{ flex:1;text-align:center;font-weight:800;font-size:14.5px;color:var(--pw-ink); }

        .dm-mini{
          width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;
          background:rgba(63,32,4,0.08);border:1px solid var(--pw-line);color:#5C4B3A;cursor:pointer;
          transition:all .18s var(--pw-ease);
        }
        .dm-mini:hover{ background:rgba(255,255,255,0.15);color:var(--pw-ink); }
        .dm-mini.is-plus{ background:var(--pw-grad);color:var(--pw-ink-on-accent);border-color:transparent; }
        .dm-mini.is-plus:hover{ filter:brightness(1.08); }

        /* Floating cart bar — emerald green so it pops against the warm page */
        .dm-cartbar{
          position:fixed;
          left:12px;right:12px;
          bottom:calc(20px + env(safe-area-inset-bottom, 0px));
          z-index:200;
          max-width:34rem;margin-inline:auto;
          animation:dmBarIn .4s cubic-bezier(0.22,1,0.36,1) both;
          pointer-events:auto;
        }
        @media (min-width:640px){
          .dm-cartbar{ left:50%;right:auto;transform:translateX(-50%);width:calc(100% - 40px); }
        }
        @keyframes dmBarIn{
          from{opacity:0;transform:translateY(36px) scale(0.94)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @media (min-width:640px){
          @keyframes dmBarIn{
            from{opacity:0;transform:translate(-50%,36px) scale(0.94)}
            to{opacity:1;transform:translate(-50%,0) scale(1)}
          }
        }
        /* Glow ring pulse when item added */
        .dm-cartbar-pulse::before{
          content:'';position:absolute;inset:-4px;border-radius:24px;
          border:2px solid rgba(16,185,129,0.9);
          animation:dmRingPulse .6s cubic-bezier(0.22,1,0.36,1) both;
          pointer-events:none;
        }
        @keyframes dmRingPulse{
          0%{opacity:1;transform:scale(1)}
          100%{opacity:0;transform:scale(1.08)}
        }
        .dm-cartbar-btn{
          width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
          min-height:64px;padding:10px 18px;border:0;cursor:pointer;border-radius:20px;
          background:linear-gradient(135deg,#10B981 0%,#059669 100%);color:#FFFFFF;
          box-shadow:0 22px 46px -18px rgba(16,185,129,0.95);
          transition:transform .2s var(--pw-ease),filter .2s var(--pw-ease);
          position:relative;
        }
        .dm-cartbar-btn:hover{ transform:translateY(-2px);filter:brightness(1.05); }
        .dm-cartbar-btn:active{ transform:translateY(0) scale(0.99); }

        /* Badge bounce when count changes */
        .dm-badge-bounce{
          animation:dmBadgePop .45s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes dmBadgePop{
          0%{transform:scale(1)}
          40%{transform:scale(1.55)}
          70%{transform:scale(0.9)}
          100%{transform:scale(1)}
        }

        /* Card pop when item added */
        .dm-card-pop{
          animation:dmCardPop .42s cubic-bezier(0.34,1.56,0.64,1) both !important;
        }
        @keyframes dmCardPop{
          0%{transform:scale(1)}
          45%{transform:scale(1.04)}
          100%{transform:scale(1)}
        }

        /* Add button pop */
        .dm-add-pop{
          animation:dmAddPop .38s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes dmAddPop{
          0%{transform:scale(1)}
          45%{transform:scale(1.18)}
          100%{transform:scale(1)}
        }

        /* Qty bounce in stepper */
        .dm-qty-bounce{
          display:inline-block;
          animation:dmQtyBounce .45s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes dmQtyBounce{
          0%{transform:scale(1)translateY(0)}
          40%{transform:scale(1.6)translateY(-4px)}
          100%{transform:scale(1)translateY(0)}
        }

        /* Flying dot particle */
        .dm-fly-dot{
          position:fixed;z-index:9999;pointer-events:none;
          width:10px;height:10px;border-radius:50%;
          background:var(--pw-grad);
          transform:translate(-50%,-50%);
          box-shadow:0 0 8px 2px rgba(245,158,11,0.7);
          animation:dmFlyToCart .65s cubic-bezier(0.5,0,0.8,1) both;
        }
        @keyframes dmFlyToCart{
          0%{opacity:1;transform:translate(-50%,-50%) scale(1)}
          60%{opacity:1}
          100%{opacity:0;transform:translate(calc(-50% + var(--fx)),calc(-50% + var(--fy))) scale(0.3)}
        }

        /* Cart drawer — rich bottom sheet on phones, side panel on desktop */
        .dm-backdrop{ background:rgba(38,21,7,0.55);backdrop-filter:blur(8px);animation:dmFade .25s var(--pw-ease) both; }
        .dm-panel{
          width:100%;max-width:26rem;height:100%;display:flex;flex-direction:column;
          background:#FFF8F1;border-left:1px solid var(--pw-line);
          box-shadow:-30px 0 60px -30px rgba(63,32,4,0.35);
          animation:dmSlide .35s cubic-bezier(0.22,1,0.36,1) both;
        }
        @media (max-width:639px){
          .dm-panel{
            max-width:100%;height:auto;max-height:92dvh;
            border-radius:28px 28px 0 0;border-left:0;border-top:1px solid var(--pw-line);
            animation:dmSheetUp .38s cubic-bezier(0.22,1,0.36,1) both;
          }
          @keyframes dmSheetUp{from{transform:translateY(100%)}to{transform:none}}
        }
        @keyframes dmFade{from{opacity:0}to{opacity:1}}
        @keyframes dmSlide{from{transform:translateX(100%)}to{transform:none}}
        .dm-sheet-handle{
          display:flex;justify-content:center;padding:10px 0 2px;
        }
        .dm-sheet-handle span{ width:44px;height:5px;border-radius:999px;background:rgba(63,32,4,0.18); }
        .dm-cart-head{
          display:flex;align-items:center;gap:11px;
          margin:4px 14px 12px;padding:13px 15px;border-radius:18px;
          background:linear-gradient(135deg,#1F1308 0%,#3F230C 100%);
          box-shadow:0 14px 30px -16px rgba(63,32,4,0.55);
        }
        .dm-cart-head-icon{
          width:40px;height:40px;border-radius:13px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:var(--pw-grad);color:#1F1308;
          box-shadow:0 8px 18px -8px rgba(245,158,11,0.9);
        }
        .dm-head-ghost{
          flex-shrink:0;padding:7px 12px;border-radius:10px;cursor:pointer;
          border:1px solid rgba(252,211,77,0.28);background:rgba(252,211,77,0.1);
          color:#FDE68A;font-size:12px;font-weight:800;
          transition:background .2s var(--pw-ease,color .2s var(--pw-ease));
        }
        .dm-head-ghost:hover{ background:rgba(239,68,68,0.25);color:#FCA5A5; }
        .dm-head-close{
          flex-shrink:0;width:34px;height:34px;border-radius:10px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;border:0;
          background:rgba(255,255,255,0.09);color:#FDE68A;
          transition:background .2s var(--pw-ease);
        }
        .dm-head-close:hover{ background:rgba(255,255,255,0.2); }
        .dm-cart-empty{
          text-align:center;padding:40px 20px 48px;
        }
        .dm-cart-empty-icon{
          width:64px;height:64px;border-radius:20px;margin:0 auto 14px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(234,88,12,0.1);color:#C2410C;
          border:1px dashed rgba(234,88,12,0.35);
        }
        /* Cart item rows */
        .dm-cart-item{
          position:relative;display:flex;align-items:center;gap:11px;
          padding:12px 12px 12px 0;border-radius:16px;
          background:rgba(63,32,4,0.05);border:1px solid var(--pw-line);
        }
        .dm-cart-item:hover{ border-color:rgba(245,158,11,0.4); }
        .dm-cart-item:hover{ border-color:rgba(245,158,11,0.45); }
        .dm-cart-accent{
          width:5px;align-self:stretch;border-radius:999px;flex-shrink:0;margin-left:12px;
        }
        .dm-cart-thumb{
          width:46px;height:46px;border-radius:12px;object-fit:cover;flex-shrink:0;
        }
        .dm-cart-thumb-empty{
          display:flex;align-items:center;justify-content:center;
        }
        .dm-mini.is-x{
          width:30px;height:30px;background:transparent;border-color:transparent;color:#A3846A;
        }
        .dm-mini.is-x:hover{ color:#DC2626;background:rgba(239,68,68,0.08); }
        .dm-cart-foot{
          padding:15px 18px calc(15px + env(safe-area-inset-bottom,0px));
          background:rgba(255,251,246,0.96);
          border-top:1px solid var(--pw-line);
          box-shadow:0 -14px 30px -20px rgba(63,32,4,0.3);
        }
        .dm-cart-total{
          display:flex;justify-content:space-between;align-items:baseline;
          font-weight:900;font-size:16.5px;color:var(--pw-ink);
          padding-top:9px;margin-top:5px;
          border-top:1px dashed rgba(63,32,4,0.22);
        }
        .dm-cart-total dd{ color:#C2410C; }

        @media (prefers-reduced-motion:reduce){
          .dm-in,.dm-cartbar,.dm-panel,.dm-backdrop{animation:none !important;opacity:1 !important;transform:none !important;}
          .dm-skel{animation:none !important;}
          .dm-card-pop,.dm-add-pop,.dm-badge-bounce,.dm-qty-bounce,.dm-fly-dot,.dm-cartbar-pulse::before{animation:none !important;}
        }
      `}</style>
    </PublicShell>
  );
};

/* ── QR payment dialog shared with the placed screen ── */
const PaymentModal = ({ paymentOrder, paymentQr, proofImage, paymentError, submittingProof, close, selectProof, submit }) => (
  <div
    className="fixed inset-0 z-[500] overflow-y-auto overscroll-contain p-3 sm:p-6 flex items-center justify-center dm-pm"
    onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    role="dialog" aria-modal="true" aria-label="Complete your payment">
    <div className="w-full max-w-md my-auto pw-card" style={{ background: '#FFF8F1', boxShadow: '0 40px 90px -30px rgba(63,32,4,0.35)' }}>
      <div className="dm-pm-head">
        <span className="dm-pm-icon" aria-hidden="true"><QrCode size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="pw-ink font-extrabold text-[17px] leading-tight">Pay before we prepare your order</h2>
          <p className="pw-muted text-[12.5px] mt-0.5">
            Order #{paymentOrder.id} · Total <strong style={{ color: '#C2410C' }}>{CURRENCY}{Number(paymentOrder.total).toFixed(2)}</strong>
          </p>
        </div>
        <button onClick={close} className="pw-icon-btn" aria-label="Close payment dialog">
          <X size={18} />
        </button>
      </div>

      <div className="p-5 sm:p-6 space-y-4">          <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(63,32,4,0.04)', border: '1px solid var(--pw-line)' }}>
          {paymentQr ? (
            <img src={paymentQr} alt="Payment QR code"
                 className="w-48 h-48 sm:w-56 sm:h-56 max-w-full mx-auto bg-white p-2 rounded-xl object-contain" />
          ) : (
            <div className="py-12 flex flex-col items-center justify-center">
              <Loader2 size={26} className="animate-spin mb-3" style={{ color: '#C2410C' }} aria-hidden="true" />
              <p className="pw-muted text-sm">Loading payment QR…</p>
            </div>
          )}
          <p className="pw-muted text-[12px] mt-3 leading-relaxed">
            Scan with your payment app, pay the exact amount, then upload the confirmation screenshot.
          </p>
        </div>

        <div>
          <label htmlFor="dm-proof" className="df-label" style={{ display: 'block', marginBottom: 8 }}>
            Payment screenshot <span className="df-badge is-req" style={{ marginLeft: 6 }}>Required</span>
          </label>
          <input id="dm-proof" type="file" accept="image/png,image/jpeg,image/webp"
                 onChange={(e) => selectProof(e.target.files?.[0])}
                 className="dm-file" aria-describedby="dm-proof-help" />
          <p id="dm-proof-help" className="pw-muted text-[11.5px] mt-1.5">PNG, JPG or WebP — up to 3 MB.</p>
        </div>

        {proofImage && (
          <p className="flex items-center gap-2 text-[13px] font-bold" style={{ color: '#047857' }}>
            <CheckCircle size={14} aria-hidden="true" /> Screenshot attached
          </p>
        )}
        {paymentError && (
          <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold dm-err">
            <AlertCircle size={14} aria-hidden="true" /> {paymentError}
          </p>
        )}

        <button onClick={submit} disabled={submittingProof} className="pw-btn-primary w-full">
          {submittingProof
            ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Submitting proof…</>
            : <><ShieldCheck size={17} aria-hidden="true" /> Submit payment for review</>}
        </button>
        <p className="pw-muted text-center text-[12px] leading-relaxed">
          Your order is sent to the kitchen &amp; delivery staff only after an admin approves your payment.
        </p>
      </div>
    </div>
  </div>
);

/* BUGFIX: the checkout screen returns early, before the menu screen's
   <style> block ever renders — so its delivery-details form rendered with
   zero CSS. These rules now ship with the checkout screen itself. */
const checkoutCSS = `
  .pw-root .df-group{ display:block; }
  .pw-root .df-labelrow{ display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px; }
  .pw-root .df-label{ font-size:13.5px;font-weight:700;color:var(--pw-ink); }
  .pw-root .df-hint{ font-size:12.5px;color:#7A6553;margin-top:6px; }
  .pw-root .df-badge{
    font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
    padding:3px 8px;border-radius:6px;display:inline-block;
    background:rgba(255,255,255,0.06);border:1px solid var(--pw-line);color:#7A6553;
  }
  .pw-root .df-badge.is-req{ background:rgba(245,158,11,0.14);border-color:rgba(245,158,11,0.35);color:#C2410C; }
  .pw-root .df-control{ position:relative; }
  .pw-root .df-icon{
    position:absolute;left:15px;top:50%;transform:translateY(-50%);
    display:flex;color:#7A6553;pointer-events:none;z-index:1;
    transition:color .2s var(--pw-ease);
  }
  .pw-root .df-control.is-top .df-icon{ top:17px;transform:none; }
  .pw-root .df-control:focus-within .df-icon{ color:#C2410C; }
  .pw-root .df-input{
    width:100%;min-height:52px;padding:14px 15px 14px 44px;
    border-radius:14px;font-size:15px;line-height:1.5;color:var(--pw-ink);
    background:#FFFDFB;border:1.5px solid rgba(63,32,4,0.18);
    transition:border-color .2s var(--pw-ease),box-shadow .2s var(--pw-ease);
    appearance:none;-webkit-appearance:none;
  }
  .pw-root .df-input::placeholder{ color:#A3846A !important;opacity:1; }
  .pw-root .df-input:focus{
    outline:none;border-color:#F59E0B !important;
    box-shadow:0 0 0 3px rgba(245,158,11,0.24);
  }
  .pw-root .df-textarea{ min-height:96px;resize:vertical;line-height:1.65; }
  .pw-root .df-control.has-error .df-input{ border-color:#F87171 !important; }
  .pw-root .df-control.has-error .df-input:focus{ box-shadow:0 0 0 3px rgba(248,113,113,0.22); }
  .pw-root .df-control.has-error .df-icon{ color:#F87171; }
  .pw-root .df-error{ display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#B91C1C;margin-top:8px; }
  .pw-root .df-footrow{ display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px; }
  .pw-root .df-footrow .df-hint{ margin-top:0; }
  .pw-root .df-count{ font-size:12px;font-weight:700;color:#7A6553; }
  .pw-root .df-note-btn{
    width:100%;display:flex;align-items:center;gap:9px;cursor:pointer;
    min-height:48px;padding:12px 16px;border-radius:14px;
    background:rgba(63,32,4,0.04);border:1.5px dashed var(--pw-line);
    color:#5C4B3A;font-size:14px;font-weight:700;text-align:left;
    transition:all .2s var(--pw-ease);
  }
  .pw-root .df-note-btn:hover{ border-color:rgba(245,158,11,0.5);color:var(--pw-ink);background:rgba(245,158,11,0.08); }
  .pw-root .df-note-btn svg:first-child{ color:#C2410C; }
  .pw-root .df-note-plus{ margin-left:auto;font-size:18px;font-weight:600;line-height:1; }
  .pw-root .df-alert{
    display:flex;gap:9px;padding:14px 15px;border-radius:14px;font-size:14px;
    background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);color:#B91C1C;
  }
  .pw-root .df-head{
    display:flex;align-items:center;gap:13px;
    padding:18px 20px;border-bottom:1px solid var(--pw-line);
    background:linear-gradient(135deg,rgba(245,158,11,0.16),rgba(234,88,12,0.07));
  }
  .pw-root .df-head-icon{
    width:44px;height:44px;border-radius:14px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    background:var(--pw-grad);color:var(--pw-ink-on-accent);
    box-shadow:0 10px 24px -12px rgba(245,158,11,1);
  }
  .pw-root .df-head-chip{
    margin-left:auto;flex-shrink:0;
    font-size:11.5px;font-weight:800;letter-spacing:0.04em;
    padding:6px 11px;border-radius:999px;white-space:nowrap;
    background:rgba(63,32,4,0.05);border:1px solid rgba(245,158,11,0.45);color:#C2410C;
  }
  .pw-root .dm-back{
    display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 4px;
    font-size:14px;font-weight:700;color:#5C4B3A;background:none;border:0;cursor:pointer;
    transition:color .2s var(--pw-ease),transform .2s var(--pw-ease);
  }
  .pw-root .dm-back:hover{ color:var(--pw-ink);transform:translateX(-3px); }
  .pw-root .df-submit{
    position:sticky;bottom:0;z-index:2;
    padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));
    background:rgba(255,251,246,0.97);
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    border-top:1px solid var(--pw-line);
  }
  .pw-root .df-fineprint{ margin-top:10px;text-align:center;font-size:11.5px;line-height:1.6;color:#5C4B3A; }
  .pw-root .df-fineprint a{ color:#C2410C;font-weight:600;text-decoration:underline;text-underline-offset:2px; }
  .pw-root .df-fineprint a:hover{ color:#F97316; }
  /* Payment method chooser */
  .pw-root .dm-payset{ border:0;padding:0;margin:26px 0 0; }
  .pw-root .dm-paylegend{
    font-size:13px;font-weight:800;letter-spacing:0.02em;
    color:var(--pw-ink);margin-bottom:10px;padding:0;
  }
  .pw-root .dm-payopt{
    display:flex;flex-direction:column;gap:8px;cursor:pointer;text-align:left;
    padding:14px;border-radius:16px;min-height:64px;
    background:rgba(63,32,4,0.04);border:1.5px solid var(--pw-line);color:var(--pw-ink);
    transition:transform .2s var(--pw-ease),background .2s var(--pw-ease),border-color .2s var(--pw-ease);
  }
  .pw-root .dm-payopt:hover{ background:rgba(255,255,255,0.07);transform:translateY(-1px); }
  .pw-root .dm-paycheck{
    opacity:0.25;transition:opacity .2s var(--pw-ease),background .2s var(--pw-ease);
    display:inline-flex;border-radius:999px;padding:1px;
  }
  .pw-root .dm-paydesc{ font-size:12px;line-height:1.55;color:#7A6553;padding-left:46px; }
  .pw-root .dm-payhint{
    display:flex;align-items:flex-start;gap:7px;
    margin-top:12px;padding:10px 13px;border-radius:12px;
    font-size:12.5px;font-weight:600;line-height:1.55;
    background:rgba(63,32,4,0.04);border:1px solid var(--pw-line);
  }
  .pw-root .dm-payhint svg{ flex-shrink:0;margin-top:1px; }
`;

const placedCSS = `
  .dm-trk{opacity:0;animation:dmTrkIn .45s cubic-bezier(0.22,1,0.36,1) both;}
  @keyframes dmTrkIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .dm-trk-head{
    display:flex;align-items:center;gap:12px;
    padding:16px 20px;border-bottom:1px solid var(--pw-line);
    background:linear-gradient(135deg,rgba(52,211,153,0.12),rgba(16,185,129,0.05));
  }
  .dm-trk-icon{
    width:40px;height:40px;border-radius:13px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    background:var(--pw-grad);color:var(--pw-ink-on-accent);
    box-shadow:0 10px 22px -12px rgba(245,158,11,1);
  }
  .dm-trk-badge{
    margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;
    font-size:11px;font-weight:800;letter-spacing:0.02em;
    padding:6px 11px;border-radius:999px;
    max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    background:rgba(63,32,4,0.05);border:1px solid var(--pw-line);color:#5C4B3A;
  }
  .dm-trk-bar{transition:width .6s var(--pw-ease);animation:dmPulseBar 2.4s ease infinite;}
  @keyframes dmPulseBar{0%,100%{opacity:1}50%{opacity:.75}}
  .pay-note{
    margin-top:14px;padding:11px 14px;border-radius:12px;
    font-size:12.5px;font-weight:600;line-height:1.6;
    border:1px solid;background:rgba(255,255,255,0.02);
  }
  .dm-pm{animation:dmBgd .25s var(--pw-ease) both;}
  @keyframes dmBgd{from{opacity:0}to{opacity:1}}
  .dm-pm-head{
    display:flex;align-items:center;gap:12px;
    padding:16px 18px;border-bottom:1px solid var(--pw-line);
    background:linear-gradient(135deg,rgba(245,158,11,0.14),rgba(234,88,12,0.06));
  }
  .dm-pm-icon{
    width:42px;height:42px;border-radius:13px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    background:var(--pw-grad);color:var(--pw-ink-on-accent);
  }
  .dm-file{ width:100%;font-size:13px;color:#5C4B3A; }
  .dm-file::file-selector-button{
    margin-right:12px;padding:10px 16px;border-radius:12px;border:0;cursor:pointer;
    background:rgba(245,158,11,0.14);color:#C2410C;font-weight:800;font-size:13px;
  }
  .dm-err{ background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);color:#B91C1C; }
  @media (prefers-reduced-motion:reduce){
    .dm-trk,.dm-pm{animation:none !important;opacity:1 !important;transform:none !important;}
    .dm-trk-bar{animation:none !important;}
  }
`;

export default DeliveryMenu;
