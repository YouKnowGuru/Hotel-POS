import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  DollarSign,
  Package,
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Wallet,
  Repeat,
  TrendingUp as TrendingUpAlt,
  Crown,
  Utensils,
  ShoppingBag,
  QrCode,
  Building2,
  Sparkles,
  Activity,
  Flame,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { io } from 'socket.io-client';
import { authFetch, getSocketUrl } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import { getBranchLabel, isAdminUser } from '../utils/branchScope';
import DatePickerButton, {
  getTodayLocalDate,
  addDaysToIso,
  parseIsoDate,
} from './DatePickerButton';

/* =================================================================
   Liquid Glass — Design Tokens
   ================================================================= */

const NAVY = '#4F46E5';
const NAVY_DEEP = '#312E81';
const GOLD = '#D4A017';
const GOLD_LIGHT = '#F0C050';
const GOLD_DARK = '#A16207';

const glassCard = {
  background: 'var(--card-bg)',
  borderRadius: 16,
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-sm)',
};

const glassCardHover = {
  boxShadow: 'var(--shadow-lg)',
  transform: 'translateY(-3px)',
};

const PIE_COLORS = [NAVY, GOLD, '#3B82F6'];

/* =================================================================
   Helpers
   ================================================================= */

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfMonth = (d) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayKey = (d) => d.toISOString().slice(0, 10);

const itemsCount = (o) =>
  Array.isArray(o.items)
    ? o.items.reduce((a, b) => a + (Number(b.quantity || b.qty) || 0), 0)
    : 0;

const orderTime = (o) => new Date(o.timestamp || o.created_at || Date.now());

const calcDelta = (current, previous) => {
  if (previous === 0 && current === 0) return { value: '0%', trend: 'up', positive: true };
  if (previous === 0) return { value: '+100%', trend: 'up', positive: true };
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  return {
    value: `${positive ? '+' : ''}${pct.toFixed(1)}%`,
    trend: positive ? 'up' : 'down',
    positive,
  };
};

const formatHourLabel = (h) => {
  const hh = h % 24;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const dh = hh % 12 === 0 ? 12 : hh % 12;
  return `${dh} ${ampm}`;
};

/* =================================================================
   Liquid Glass — Reusable Components
   ================================================================= */

const GlassTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        ...glassCard,
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}
    >
      <p style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
          {fmt ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  accentFrom,
  accentTo,
  label,
  value,
  delta,
  sparkColor,
  sparkData,
  gradientId,
  index = 0,
}) => {
  const [hovered, setHovered] = useState(false);
  const positive = delta?.positive ?? true;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      style={{
        ...glassCard,
        padding: '14px 14px 8px 14px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        ...(hovered ? glassCardHover : {}),
        animationDelay: `${index * 80}ms`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentFrom,
          borderRadius: '16px 16px 0 0',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: accentFrom,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', margin: 0, fontFamily: "Inter, system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {label}
      </p>
      <p style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0', overflowWrap: 'break-word', lineHeight: 1.15, fontFamily: "Inter, system-ui, sans-serif" }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginTop: 6, fontSize: 11 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            fontWeight: 600,
            color: positive ? '#059669' : '#E11D48',
            background: positive ? 'rgba(5,150,105,0.08)' : 'rgba(225,29,72,0.08)',
            padding: '2px 6px',
            borderRadius: 9999,
            fontSize: 10,
          }}
        >
          <TrendIcon style={{ width: 11, height: 11 }} />
          {delta?.value || '0%'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontFamily: "Inter, system-ui, sans-serif", fontSize: 10 }}>
          vs yesterday
        </span>
      </div>
      <div style={{ marginLeft: -10, marginRight: -10, marginBottom: -4, marginTop: 6, height: 40, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={40} minWidth={0}>
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const GlassSection = ({ icon: Icon, title, right, children, className = '' }) => (
  <div className={className} style={{ ...glassCard, padding: 16, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {Icon && (
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: NAVY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon style={{ width: 15, height: 15, color: '#fff' }} />
          </div>
        )}
        <h3 style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </h3>
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
    {children}
  </div>
);

const GlassPill = ({ children }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 600,
      fontFamily: "Inter, system-ui, sans-serif",
      padding: '4px 12px',
      borderRadius: 9999,
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    }}
  >
    {children}
  </span>
);

const StatusPill = ({ status }) => {
  const s = (status || '').toLowerCase();
  const map = {
    preparing: { bg: `rgba(212,160,23,0.10)`, color: GOLD_DARK, dot: GOLD },
    ready: { bg: 'rgba(5,150,105,0.10)', color: '#059669', dot: '#059669' },
    pending: { bg: `rgba(212,160,23,0.10)`, color: GOLD_DARK, dot: GOLD },
    completed: { bg: 'var(--card-bg)', color: 'var(--text-primary)', dot: NAVY },
    delivered: { bg: 'rgba(5,150,105,0.10)', color: '#059669', dot: '#059669' },
  };
  const style = map[s] || { bg: 'rgba(100,116,139,0.08)', color: 'var(--text-secondary)', dot: 'var(--text-muted)' };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: '3px 10px',
        borderRadius: 9999,
        background: style.bg,
        color: style.color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.dot }} />
      {(status || 'Pending').charAt(0).toUpperCase() + (status || 'Pending').slice(1)}
    </span>
  );
};

const TYPE_ICON = { DINE_IN: Utensils, TAKEAWAY: ShoppingBag, QR_CODE: QrCode };
const TYPE_LABEL = { DINE_IN: 'Dine-In', TAKEAWAY: 'Takeaway', QR_CODE: 'QR Order' };

/* =================================================================
   Dashboard
   ================================================================= */

const Dashboard = ({ locationSettings }) => {
  const navigate = useNavigate();
  const { format: fmt } = useCurrency(locationSettings);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState(getTodayLocalDate);    const socketRef = useRef(null);
    const refreshTimer = useRef(null);
  const todayLocalDate = getTodayLocalDate();
  const isViewingToday = selectedDate === todayLocalDate;
  // eslint-disable-next-line
  const now = useMemo(() => parseIsoDate(selectedDate), [selectedDate, tick]);
  const viewDate = now;

  /* ---------------- data loader ---------------- */
  const loadData = useCallback(async () => {
    try {
      const rangeStart = addDaysToIso(selectedDate, -29);
      const res = await authFetch(
        `/api/orders?startDate=${rangeStart}&endDate=${selectedDate}`
      );
      const data = res.ok ? await res.json() : [];
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setOrders((prev) => prev);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  /* ---------------- auth + reload ---------------- */
  useEffect(() => {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    if (!u || !t) {
      navigate('/login');
      return undefined;
    }
    setLoading(true);
    loadData();
    return undefined;
  }, [loadData, navigate]);

  /* ---------------- real-time wiring (today only) ---------------- */
  useEffect(() => {
    if (!isViewingToday) return undefined;

    const socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') } });
    socketRef.current = socket;
    // PERF: a burst of order events (kitchen pushing preparing→ready for
    // several tickets at once) used to fire one full 30-day refetch per
    // event, serially hammering the orders query. Coalesce trailing
    // events into a single reload ~800ms after the last one.
    const refresh = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(loadData, 800);
    };
    socket.on('order_created', refresh);
    socket.on('order_status_updated', refresh);
    socket.on('order_deleted', refresh);

    const pollInterval = setInterval(loadData, 30000);
    const tickInterval = setInterval(() => setTick((v) => v + 1), 30000);

    return () => {
      socket.off('order_created', refresh);
      socket.off('order_status_updated', refresh);
      socket.off('order_deleted', refresh);
      socket.disconnect();
      clearInterval(pollInterval);
      clearInterval(tickInterval);
      clearTimeout(refreshTimer.current);
    };
  }, [loadData, isViewingToday]);

  /* ---------------- partition ---------------- */
  const completed = orders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );
  const liveOrders = orders.filter(
    (o) => !['completed', 'cancelled', 'delivered'].includes((o.status || '').toLowerCase())
  );

  /* ---------------- selected day / previous day partitions ---------------- */
  const yesterdayDate = new Date(viewDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const dayOrders = orders.filter((o) => sameDay(orderTime(o), viewDate));
  const prevDayOrders = orders.filter((o) => sameDay(orderTime(o), yesterdayDate));

  const dayCompleted = dayOrders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );
  const prevDayCompleted = prevDayOrders.filter((o) =>
    ['completed', 'delivered'].includes((o.status || '').toLowerCase())
  );

  /* ---------------- aggregate metrics ---------------- */
  const totalOrders = dayOrders.length;
  const totalSales = dayCompleted.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalItems = dayCompleted.reduce((s, o) => s + itemsCount(o), 0);
  const customers = new Set(
    dayCompleted.map((o) => o.customer_name || o.table_name || `order-${o.id}`)
  ).size;

  /* ---------------- yesterday for deltas ---------------- */
  const yOrders = prevDayOrders.length;
  const ySales = prevDayCompleted.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const yItems = prevDayCompleted.reduce((s, o) => s + itemsCount(o), 0);
  const yCustomers = new Set(
    prevDayCompleted.map((o) => o.customer_name || o.table_name || `order-${o.id}`)
  ).size;

  const ordersDelta = calcDelta(totalOrders, yOrders);
  const salesDelta = calcDelta(totalSales, ySales);
  const itemsDelta = calcDelta(totalItems, yItems);
  const custDelta = calcDelta(customers, yCustomers);

  /* ---------------- last 7 days for sales chart ---------------- */
  const last7 = useMemo(() => {
    const buckets = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(viewDate);
      d.setDate(d.getDate() - i);
      buckets[dayKey(d)] = {
        period: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: 0,
      };
    }
    completed.forEach((o) => {
      const k = dayKey(orderTime(o));
      if (buckets[k]) buckets[k].sales += Number(o.total) || 0;
    });
    return Object.values(buckets);
    // eslint-disable-next-line
  }, [completed, selectedDate, tick]);

  const thisWeekSales = useMemo(() => {
    const cutoff = new Date(viewDate);
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return completed
      .filter((o) => orderTime(o) >= cutoff && orderTime(o) <= viewDate)
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    // eslint-disable-next-line
  }, [completed, selectedDate, tick]);
  const lastWeekSales = useMemo(() => {
    const start = new Date(viewDate);
    start.setDate(start.getDate() - 13);
    start.setHours(0, 0, 0, 0);
    const end = new Date(viewDate);
    end.setDate(end.getDate() - 7);
    end.setHours(23, 59, 59, 999);
    return completed
      .filter((o) => orderTime(o) >= start && orderTime(o) <= end)
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    // eslint-disable-next-line
  }, [completed, tick]);
  const weekDelta = calcDelta(thisWeekSales, lastWeekSales);

  /* ---------------- orders by type ---------------- */
  const byTypeRaw = dayOrders.reduce((acc, o) => {
    const k = (o.type || 'DINE_IN').toUpperCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const orderTypeData = [
    { name: 'Dine-In', value: byTypeRaw.DINE_IN || 0, color: NAVY },
    { name: 'Takeaway', value: byTypeRaw.TAKEAWAY || 0, color: GOLD },
    { name: 'QR Order', value: byTypeRaw.QR_CODE || 0, color: '#3B82F6' },
  ];
  const totalTypeCount = orderTypeData.reduce((s, t) => s + t.value, 0);

  /* ---------------- top selling items ---------------- */
  const itemSalesMap = {};
  const weekCutoff = new Date(viewDate);
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  weekCutoff.setHours(0, 0, 0, 0);
  completed
    .filter((o) => orderTime(o) >= weekCutoff && orderTime(o) <= viewDate)
    .forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = it.name;
        if (!key) return;
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, revenue: 0, orders: 0 };
        const qty = Number(it.quantity || it.qty) || 1;
        itemSalesMap[key].revenue += (Number(it.price) || 0) * qty;
        itemSalesMap[key].orders += qty;
      });
    });
  const topItems = Object.values(itemSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxItemRevenue = Math.max(1, ...topItems.map((i) => i.revenue));

  /* ---------------- recent transactions ---------------- */
  const recentTx = [...dayCompleted]
    .sort((a, b) => orderTime(b).getTime() - orderTime(a).getTime())
    .slice(0, 5);

  /* ---------------- peak hours ---------------- */
  const peakHours = useMemo(() => {
    const buckets = {};
    for (let h = 9; h <= 23; h += 1) buckets[h] = 0;
    dayCompleted.forEach((o) => {
      const h = orderTime(o).getHours();
      if (buckets[h] !== undefined) buckets[h] += Number(o.total) || 0;
    });
    return Object.keys(buckets).map((h) => ({
      period: formatHourLabel(Number(h)),
      sales: Math.round(buckets[h]),
    }));
    // eslint-disable-next-line
  }, [dayCompleted, tick]);
  const peakMax = peakHours.reduce(
    (m, p) => (p.sales > m.sales ? p : m),
    { period: '', sales: 0 }
  );

  /* ---------------- sparklines ---------------- */
  const buildSpark = useCallback(
    (extract) => {
      const buckets = {};
      for (let i = 13; i >= 0; i -= 1) {
        const d = new Date(viewDate);
        d.setDate(d.getDate() - i);
        buckets[dayKey(d)] = { i: 13 - i, v: 0 };
      }
      completed.forEach((o) => {
        const k = dayKey(orderTime(o));
        if (buckets[k]) buckets[k].v += extract(o);
      });
      return Object.values(buckets);
    },
    // eslint-disable-next-line
    [completed, tick]
  );

  const salesSpark = buildSpark((o) => Number(o.total) || 0);
  const ordersSpark = buildSpark(() => 1);
  const itemsSpark = buildSpark((o) => itemsCount(o));
  const custSpark = buildSpark(() => 1);

  /* ---------------- bottom KPI strip ---------------- */
  const avgOrder = dayCompleted.length ? totalSales / dayCompleted.length : 0;

  const activeTables = new Set(
    (isViewingToday ? liveOrders : [])
      .filter((o) => (o.type || 'DINE_IN').toUpperCase() === 'DINE_IN')
      .map((o) => o.table_name)
      .filter(Boolean)
  );

  const customerCountMap = {};
  completed.forEach((o) => {
    const key = o.customer_name || o.table_name;
    if (!key) return;
    customerCountMap[key] = (customerCountMap[key] || 0) + 1;
  });
  const daysCustomers = new Set(
    dayCompleted.map((o) => o.customer_name || o.table_name).filter(Boolean)
  );
  let repeatCount = 0;
  daysCustomers.forEach((c) => {
    if (customerCountMap[c] >= 2) repeatCount += 1;
  });
  const repeatPct = daysCustomers.size
    ? Math.round((repeatCount / daysCustomers.size) * 100)
    : 0;

  const thisMonthStart = startOfMonth(viewDate);
  const lastMonthStart = new Date(thisMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setMilliseconds(-1);
  const thisMonthSales = completed
    .filter((o) => orderTime(o) >= thisMonthStart)
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const lastMonthSales = completed
    .filter((o) => orderTime(o) >= lastMonthStart && orderTime(o) <= lastMonthEnd)
    .reduce((s, o) => s + (Number(o.total) || 0), 0);
  const monthDelta = calcDelta(thisMonthSales, lastMonthSales);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'short' });

  /* ----------------- render ----------------- */
  return (
    <div className="px-3 sm:px-5 lg:px-8 py-4 sm:py-6 max-w-[1600px] mx-auto">
      {/* ===== Page header ===== */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col xs:flex-row xs:items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 'clamp(18px, 5vw, 24px)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Dashboard
              </h1>
              {currentUser && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: 'var(--card-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "Inter, system-ui, sans-serif",
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Building2 style={{ width: 12, height: 12, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getBranchLabel(currentUser)}</span>
                </span>
              )}
            </div>
            <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
              {isAdminUser(currentUser)
                ? isViewingToday
                  ? 'Full overview — all restaurants and branches.'
                  : `All locations · ${viewDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`
                : isViewingToday
                  ? `Monitoring ${getBranchLabel(currentUser)} only.`
                  : `${getBranchLabel(currentUser)} · ${viewDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePickerButton value={selectedDate} onChange={setSelectedDate} />
          <button
            onClick={() => navigate('/dinein')}
            className="btn-primary flex items-center gap-2"
            style={{ background: 'var(--accent)', fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}
          >
            <Plus style={{ width: 15, height: 15 }} /> New Order
          </button>
        </div>
      </div>

      {/* ===== KPI row ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <KpiCard
          icon={ShoppingCart}
          accentFrom={NAVY}
          accentTo="#6366F1"
          label="Total Orders"
          value={totalOrders}
          delta={ordersDelta}
          sparkColor={NAVY}
          sparkData={ordersSpark}
          gradientId="spark-orders"
          index={0}
        />
        <KpiCard
          icon={DollarSign}
          accentFrom={GOLD_DARK}
          accentTo={GOLD}
          label="Total Sales"
          value={fmt(totalSales)}
          delta={salesDelta}
          sparkColor={GOLD}
          sparkData={salesSpark}
          gradientId="spark-sales"
          index={1}
        />
        <KpiCard
          icon={Package}
          accentFrom="#8B5CF6"
          accentTo="#A78BFA"
          label="Total Items"
          value={totalItems}
          delta={itemsDelta}
          sparkColor="#8B5CF6"
          sparkData={itemsSpark}
          gradientId="spark-items"
          index={2}
        />
        <KpiCard
          icon={Users}
          accentFrom="#059669"
          accentTo="#34D399"
          label="Total Customers"
          value={customers}
          delta={custDelta}
          sparkColor="#059669"
          sparkData={custSpark}
          gradientId="spark-customers"
          index={3}
        />
      </div>

      {/* ===== Row 2 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassSection
          className="md:col-span-2 lg:col-span-6"
          icon={Activity}
          title="Sales Overview"
          right={<GlassPill>This Week</GlassPill>}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {fmt(thisWeekSales)}
            </p>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                color: weekDelta.positive ? '#059669' : '#E11D48',
              }}
            >
              {weekDelta.positive ? (
                <ArrowUpRight style={{ width: 14, height: 14 }} />
              ) : (
                <ArrowDownRight style={{ width: 14, height: 14 }} />
              )}
              {weekDelta.value}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs last week</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, marginTop: 2 }}>Total revenue</p>
          <div style={{ height: 160, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0}>
              <AreaChart data={last7}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: "Inter, system-ui, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: "Inter, system-ui, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v)}
                />
                <Tooltip content={<GlassTooltip fmt={fmt} />} cursor={{ stroke: 'var(--border)', strokeWidth: 2 }} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={NAVY}
                  strokeWidth={2.5}
                  fill="url(#salesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassSection>

        <GlassSection className="lg:col-span-3 min-w-0" icon={ShoppingCart} title="Orders by Type">
          <div style={{ position: 'relative', height: 160, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0}>
              <PieChart>
                <Pie
                  data={
                    totalTypeCount === 0
                      ? [{ name: 'No data', value: 1, color: '#e5e7eb' }]
                      : orderTypeData
                  }
                  dataKey="value"
                  innerRadius={60}
                  outerRadius={85}
                  stroke="none"
                >
                  {(totalTypeCount === 0
                    ? [{ name: 'No data', value: 1, color: '#e5e7eb' }]
                    : orderTypeData
                  ).map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                {totalTypeCount > 0 && <Tooltip />}
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <p style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                {totalTypeCount}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Total</p>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
            {orderTypeData.map((t) => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color }} />
                {t.name} <span style={{ color: 'var(--text-muted)' }}>({t.value})</span>
              </div>
            ))}
          </div>
        </GlassSection>

        <GlassSection
          className="lg:col-span-3"
          icon={Clock}
          title="Live Orders"
          right={
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: GOLD_DARK,
                background: `rgba(212,160,23,0.10)`,
                padding: '3px 10px',
                borderRadius: 9999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: GOLD,
                  boxShadow: `0 0 8px ${GOLD}`,
                  animation: 'pulse 2s infinite',
                }}
              />
              {liveOrders.length} Active
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liveOrders.slice(0, 4).map((o, idx) => {
              const status = (o.status || 'preparing').toLowerCase();
              const minutes = Math.max(
                1,
                Math.round((Date.now() - orderTime(o).getTime()) / 60000)
              );
              const typeKey = (o.type || 'DINE_IN').toUpperCase();
              const TypeIcon = TYPE_ICON[typeKey] || Utensils;
              const typeLabel = TYPE_LABEL[typeKey] || 'Dine-In';
              const itemCt = Array.isArray(o.items) ? o.items.length : 0;
              const displayLabel = o.table_name
                ? typeKey === 'TAKEAWAY'
                  ? `Takeaway ${o.table_name}`
                  : o.table_name
                : typeLabel;
              return (
                <div
                  key={o.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `rgba(212,160,23,0.3)`;
                    e.currentTarget.style.background = 'var(--card-bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: NAVY,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TypeIcon style={{ width: 16, height: 16, color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayLabel}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      {typeLabel} • {itemCt} items
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <StatusPill status={status} />
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, margin: '4px 0 0 0' }}>
                      <Clock style={{ width: 12, height: 12 }} /> {minutes} min
                    </p>
                  </div>
                </div>
              );
            })}
            {!isViewingToday && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16, margin: 0 }}>
                Live orders are only shown for today.
              </p>
            )}
            {isViewingToday && liveOrders.length === 0 && !loading && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16, margin: 0 }}>No live orders</p>
            )}
            {isViewingToday && liveOrders.length === 0 && loading && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16, margin: 0 }}>Loading…</p>
            )}
          </div>
        </GlassSection>
      </div>

      {/* ===== Row 3 ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <GlassSection
          className="lg:col-span-4"
          icon={Flame}
          title="Top Selling Items"
          right={<GlassPill>This Week</GlassPill>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topItems.map((it, idx) => (
              <div key={it.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: idx === 0 ? 8 : '50%',
                    background: idx === 0
                      ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`
                      : 'var(--card-bg)',
                    color: idx === 0 ? '#fff' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: idx === 0 ? `0 2px 8px rgba(212,160,23,0.3)` : 'none',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                    </p>
                    <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, flexShrink: 0, marginLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fmt(it.revenue)}
                    </p>
                  </div>
                  <div style={{ marginTop: 4, height: 6, borderRadius: 9999, background: 'var(--card-bg)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 9999,
                        background: idx === 0
                          ? GOLD
                          : NAVY,
                        width: `${Math.max(8, (it.revenue / maxItemRevenue) * 100)}%`,
                        transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, margin: '2px 0 0 0' }}>{it.orders} sold</p>
                </div>
              </div>
            ))}
            {topItems.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16, margin: 0 }}>No data yet</p>
            )}
          </div>
        </GlassSection>

        <GlassSection
          className="lg:col-span-4"
          icon={TrendingUpAlt}
          title="Peak Sales Hours"
          right={
            <GlassPill>
              {isViewingToday
                ? 'Today'
                : viewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </GlassPill>
          }
        >
          <div style={{ height: 160, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0}>
              <BarChart data={peakHours} barCategoryGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: "Inter, system-ui, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: "Inter, system-ui, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v).replace(/\.00$/, '')}
                />
                <Tooltip content={<GlassTooltip fmt={fmt} />} cursor={{ fill: 'rgba(212,160,23,0.06)' }} />
                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                  {peakHours.map((p, idx) => (
                    <Cell
                      key={idx}
                      fill={p.period === peakMax.period && peakMax.sales > 0 ? GOLD : 'var(--border)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassSection>

        <GlassSection className="md:col-span-2 lg:col-span-4" icon={DollarSign} title="Recent Transactions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTx.map((o) => {
              const mins = Math.round((Date.now() - orderTime(o).getTime()) / 60000);
              const idStr = `#ORD-${String(o.id).padStart(5, '0')}`;
              return (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 8,
                    borderRadius: 12,
                    transition: 'background 0.2s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--card-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'rgba(5,150,105,0.08)',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <DollarSign style={{ width: 16, height: 16 }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idStr}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                        {o.table_name || 'Counter'} • {mins} mins ago
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                    <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                      {fmt(o.total)}
                    </p>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#059669',
                        background: 'rgba(5,150,105,0.08)',
                        padding: '2px 8px',
                        borderRadius: 9999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CheckCircle2 style={{ width: 12, height: 12 }} /> Paid
                    </span>
                  </div>
                </div>
              );
            })}
            {recentTx.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16, margin: 0 }}>No transactions yet</p>
            )}
          </div>
        </GlassSection>
      </div>

      {/* ===== Bottom KPI strip ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <BottomKpi
          icon={Wallet}
          accentFrom="#059669"
          accentTo="#34D399"
          label="AVG ORDER VALUE"
          value={fmt(avgOrder)}
        />
        <BottomKpi
          icon={Users}
          accentFrom={NAVY}
          accentTo="#3B82F6"
          label="ACTIVE TABLES"
          value={activeTables.size}
        />
        <BottomKpi
          icon={Repeat}
          accentFrom="#8B5CF6"
          accentTo="#A78BFA"
          label="REPEAT CUSTOMERS"
          value={`${repeatPct}%`}
        />
        <BottomKpi
          icon={TrendingUpAlt}
          accentFrom={monthDelta.positive ? NAVY : '#E11D48'}
          accentTo={monthDelta.positive ? '#3B82F6' : '#FB7185'}
          label="GROWTH THIS MONTH"
          value={`${monthDelta.positive ? '↑' : '↓'} ${monthDelta.value.replace('+', '')}`}
        />
        {/* Revenue card — navy gradient with gold glow */}
        <div
          className="col-span-2 sm:col-span-3 lg:col-span-1"
          style={{
            borderRadius: 16,
            padding: '12px 14px',
            background: NAVY,
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(212,160,23,0.3), transparent 70%)`,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Crown style={{ width: 18, height: 18, color: GOLD_LIGHT }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.8, opacity: 0.85, margin: 0, fontFamily: "Inter, system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Sparkles style={{ width: 11, height: 11, display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                Total Revenue ({monthLabel})
              </p>
              <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 'clamp(13px, 3vw, 18px)', fontWeight: 700, margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fmt(thisMonthSales)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BottomKpi = ({ icon: Icon, accentFrom, accentTo, label, value }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...glassCard,
        padding: '12px 14px',
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        ...(hovered ? { transform: 'translateY(-2px)', boxShadow: glassCardHover.boxShadow } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: accentFrom,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            transform: hovered ? 'scale(1.08)' : 'scale(1)',
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: 18, height: 18, color: '#fff' }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600, margin: 0, fontFamily: "Inter, system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </p>
          <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 'clamp(13px, 3vw, 18px)', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
