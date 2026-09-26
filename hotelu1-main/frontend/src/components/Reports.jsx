import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authFetch, getSocketUrl } from '../utils/api';
import { io } from 'socket.io-client';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users as UsersIcon,
  Wallet,
  Download,
  Calendar,
  Filter,
  Utensils,
  Timer,
  Zap,
  Award,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const QUICK_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

const formatYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDMY = (iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

const formatHourLabel = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

const shortAmount = (v) => {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return `Nu. ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Nu. ${(n / 1000).toFixed(0)}K`;
  return `Nu. ${n.toFixed(0)}`;
};

const computeDelta = (curr, prev) => {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) {
    if (c === 0) return 0;
    return 100;
  }
  return ((c - p) / Math.abs(p)) * 100;
};

const computePrevRange = (start, end) => {
  if (!start || !end) return [null, null];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diffDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
  const prevEnd = new Date(s);
  prevEnd.setDate(s.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - (diffDays - 1));
  return [formatYMD(prevStart), formatYMD(prevEnd)];
};

const getOrderItemsArray = (order) => {
  if (!order) return [];
  const items = order.items;
  if (Array.isArray(items)) return items;
  if (items && Array.isArray(items.dataValues)) return items.dataValues;
  return [];
};

const getItemField = (item, field) => {
  if (!item) return undefined;
  if (item[field] !== undefined) return item[field];
  if (item.dataValues && item.dataValues[field] !== undefined)
    return item.dataValues[field];
  return undefined;
};

const getItemName = (item) =>
  getItemField(item, 'name') ?? getItemField(item, 'itemName') ?? getItemField(item, 'title');

const getItemQuantity = (item) => {
  const q = getItemField(item, 'quantity') ?? getItemField(item, 'qty');
  const n = Number(q);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

const getItemPrice = (item) => {
  const p = getItemField(item, 'price') ?? getItemField(item, 'unitPrice');
  const n = Number(p);
  return Number.isFinite(n) ? n : undefined;
};

const reportableFilter = (o) =>
  o && (o.status === 'completed' || o.bill_status === 'paid' || o.payment_status === 'paid');

/* ------------------------------------------------------------------ */
/*  Custom date input (styled like image 3, native picker inside)      */
/* ------------------------------------------------------------------ */

const DateInput = ({ label, value, onChange, max }) => {
  const inputRef = useRef(null);
  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch (_) {
        /* fallthrough to focus */
      }
    }
    el.focus();
    el.click();
  };
  return (
    <div>
      <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-500" />
        {label}
      </label>
      <button
        type="button"
        onClick={openPicker}
        className="relative w-full bg-orange-50/40 hover:bg-orange-50/70 border border-orange-200/60 rounded-2xl px-4 py-3 flex items-center justify-between text-left transition focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        <span className="text-sm font-semibold text-gray-800 tracking-wide">
          {formatDMY(value) || 'Select date'}
        </span>
        <Calendar className="w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          max={max}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={label}
        />
      </button>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Reports = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);

  const todayIso = useMemo(() => formatYMD(new Date()), []);

  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [activeRange, setActiveRange] = useState('today');
  const [showFilters, setShowFilters] = useState(false);

  const [ordersData, setOrdersData] = useState([]);
  const [prevOrdersData, setPrevOrdersData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateError, setDateError] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  /* --------------------------- validation --------------------------- */

  const validateDateRange = useCallback((start, end) => {
    if (!start || !end) {
      setDateError('Please select both start and end dates');
      return false;
    }
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T23:59:59');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (startDateObj > todayStart) {
      setDateError("Start date cannot be greater than today's date");
      return false;
    }
    if (endDateObj > todayEnd) {
      setDateError("End date cannot be greater than today's date");
      return false;
    }
    if (startDateObj > endDateObj) {
      setDateError('End date cannot be earlier than start date');
      return false;
    }
    setDateError('');
    return true;
  }, []);

  /* --------------------------- fetch --------------------------- */

  const fetchOrdersForRange = useCallback(async (start, end) => {
    const res = await authFetch(`/api/orders?startDate=${start}&endDate=${end}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, []);

  const fetchAll = useCallback(async () => {
    if (!validateDateRange(startDate, endDate)) return;
    setIsLoading(true);
    try {
      const orders = await fetchOrdersForRange(startDate, endDate);
      setOrdersData(orders);
      const [pStart, pEnd] = computePrevRange(startDate, endDate);
      if (pStart && pEnd) {
        const prev = await fetchOrdersForRange(pStart, pEnd);
        setPrevOrdersData(prev);
      } else {
        setPrevOrdersData([]);
      }
    } catch (err) {
      console.error('Failed to fetch report data:', err);
      setOrdersData([]);
      setPrevOrdersData([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, fetchOrdersForRange, validateDateRange]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* --------------- real-time updates (live kitchen performance) --------------- */
  // When the user is viewing a range that includes "today", wire a socket
  // to refetch the data whenever an order moves through the kitchen flow,
  // and back it up with a 15s polling interval. For purely historical
  // ranges (end date < today) we skip this — historical data doesn't change.
  const includesToday = useMemo(() => {
    return endDate >= todayIso;
  }, [endDate, todayIso]);

  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    if (!includesToday) {
      setLiveConnected(false);
      return undefined;
    }

    let socket;
    try {
      socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], auth: { token: localStorage.getItem('token') } });
      socket.on('connect', () => setLiveConnected(true));
      socket.on('disconnect', () => setLiveConnected(false));
      const refresh = () => fetchAll();
      socket.on('order_created', refresh);
      socket.on('order_status_updated', refresh);
      socket.on('order_deleted', refresh);
    } catch (e) {
      console.warn('Reports socket connection failed:', e?.message || e);
    }

    const pollId = setInterval(fetchAll, 15000);

    return () => {
      try {
        if (socket) {
          socket.off('order_created');
          socket.off('order_status_updated');
          socket.off('order_deleted');
          socket.disconnect();
        }
      } catch {
        /* ignore */
      }
      clearInterval(pollId);
    };
  }, [includesToday, fetchAll]);

  /* --------------------------- quick ranges --------------------------- */

  const setQuickDateRange = (range) => {
    const today = new Date();
    let start = new Date(today);
    if (range === 'today') {
      start = new Date(today);
    } else if (range === 'week') {
      start.setDate(today.getDate() - 6);
    } else if (range === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (range === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
    }
    setStartDate(formatYMD(start));
    setEndDate(formatYMD(today));
    setActiveRange(range);
  };

  /* --------------------------- aggregates --------------------------- */

  const currStats = useMemo(() => buildStats(ordersData), [ordersData]);
  const prevStats = useMemo(() => buildStats(prevOrdersData), [prevOrdersData]);

  const isSingleDay = startDate === endDate;

  const revenueTrend = useMemo(() => {
    if (isSingleDay) {
      // 24 hourly buckets but rendered as friendly day-of-week look in the
      // screenshot — when single day we keep hourly intervals to look natural.
      return buildHourlySeries(ordersData);
    }
    return buildDailySeries(ordersData, startDate, endDate);
  }, [ordersData, startDate, endDate, isSingleDay]);

  const peakHours = useMemo(() => buildHourlySeries(ordersData), [ordersData]);

  const orderDistribution = useMemo(() => {
    return [
      { name: 'Dine-In', value: currStats.byType.DINE_IN, color: '#F97316' },
      { name: 'Takeaway', value: currStats.byType.TAKEAWAY, color: '#10B981' },
      { name: 'QR Order', value: currStats.byType.QR_CODE, color: '#3B82F6' },
    ].filter((d) => d.value > 0);
  }, [currStats]);

  const topItems = useMemo(() => {
    return currStats.itemMap
      .map((it) => ({ name: it.name, orders: it.qty, revenue: it.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [currStats]);

  const maxTopRevenue = topItems.length > 0 ? topItems[0].revenue : 1;

  /* --------------------------- kitchen staff performance --------------------------- */

  const kitchenStats = useMemo(() => buildKitchenStats(ordersData), [ordersData]);

  /* --------------------------- export --------------------------- */

  const handleExport = () => {
    const workbook = XLSX.utils.book_new();
    const summary = [
      { Metric: 'Start Date', Value: startDate },
      { Metric: 'End Date', Value: endDate },
      { Metric: 'Total Revenue', Value: currStats.totalSales },
      { Metric: 'Total Orders', Value: currStats.totalOrders },
      { Metric: 'Total Customers', Value: currStats.totalCustomers },
      { Metric: 'Avg Order Value', Value: currStats.avgOrderValue },
      { Metric: 'Items Sold', Value: currStats.totalItems },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Summary');

    const orderRows = (ordersData || []).map((o) => ({
      OrderId: o.id,
      Table: o.table_name,
      Type: o.type,
      Status: o.status,
      Total: o.total,
      Timestamp: o.timestamp || o.created_at,
      PaymentMethod: o.payment_method,
      ItemCount: getOrderItemsArray(o).reduce((s, it) => s + getItemQuantity(it), 0),
      ItemsSummary: getOrderItemsArray(o)
        .map((it) => `${getItemName(it) || ''} x${getItemQuantity(it)}`)
        .filter(Boolean)
        .join(', '),
    }));
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(orderRows),
      'Orders'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(topItems),
      'TopItems'
    );

    if (kitchenStats.staffList.length > 0) {
      const kitchenRows = kitchenStats.staffList.map((c) => ({
        KitchenStaff: c.name,
        OrdersPrepared: c.ordersPrepared,
        AvgPrepTimeMinutes: Number(c.avgPrepMin.toFixed(2)),
        FastestMinutes: c.fastestMin != null ? Number(c.fastestMin.toFixed(2)) : '',
        SlowestMinutes: c.slowestMin != null ? Number(c.slowestMin.toFixed(2)) : '',
        TotalRevenueHandled: Number(c.totalRevenue.toFixed(2)),
        ItemsCooked: c.itemsCooked,
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(kitchenRows),
        'KitchenPerformance'
      );
    }

    XLSX.writeFile(workbook, `reports_${startDate}_to_${endDate}.xlsx`);
  };

  /* --------------------------- KPI deltas --------------------------- */

  const kpis = useMemo(() => {
    return [
      {
        id: 'revenue',
        label: 'TOTAL REVENUE',
        value: fmt(currStats.totalSales),
        delta: computeDelta(currStats.totalSales, prevStats.totalSales),
        color: 'text-orange-500',
        Icon: DollarSign,
      },
      {
        id: 'orders',
        label: 'TOTAL ORDERS',
        value: (currStats.totalOrders || 0).toLocaleString('en-IN'),
        delta: computeDelta(currStats.totalOrders, prevStats.totalOrders),
        color: 'text-blue-500',
        Icon: ShoppingCart,
      },
      {
        id: 'customers',
        label: 'TOTAL CUSTOMERS',
        value: (currStats.totalCustomers || 0).toLocaleString('en-IN'),
        delta: computeDelta(currStats.totalCustomers, prevStats.totalCustomers),
        color: 'text-emerald-500',
        Icon: UsersIcon,
      },
      {
        id: 'aov',
        label: 'AVG ORDER VALUE',
        value: fmt(currStats.avgOrderValue),
        delta: computeDelta(currStats.avgOrderValue, prevStats.avgOrderValue),
        color: 'text-orange-500',
        Icon: Wallet,
      },
    ];
  }, [currStats, prevStats, fmt]);

  /* --------------------------- render --------------------------- */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Reports &amp; Analytics
            </h1>
            {includesToday && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  liveConnected
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
                title={
                  liveConnected
                    ? 'Receiving live updates from kitchen'
                    : 'Auto-refreshing every 15 seconds'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    liveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {liveConnected ? 'Live' : 'Auto'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Comprehensive business intelligence</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-white border border-gray-200 shadow-sm rounded-full p-1 flex items-center gap-1">
            {QUICK_RANGES.map((q) => {
              const active = activeRange === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setQuickDateRange(q.id)}
                  className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                    active
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/50'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition ${
              showFilters
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800 hover:border-gray-300'
            }`}
            title="Show filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 flex items-center justify-center transition shadow-sm"
            title="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Report Filters panel — styled per image 3 */}
      {showFilters && (
        <div className="bg-[#FFFAF3] border border-orange-100 rounded-2xl shadow-sm p-5 mb-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-orange-500" />
            <h3 className="text-base font-bold text-gray-900">Report Filters</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateInput
              label="Start Date"
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                setActiveRange('');
              }}
              max={todayIso}
            />
            <DateInput
              label="End Date"
              value={endDate}
              onChange={(v) => {
                setEndDate(v);
                setActiveRange('');
              }}
              max={todayIso}
            />
          </div>
          {dateError && (
            <p className="mt-3 text-xs font-semibold text-rose-500">{dateError}</p>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k, idx) => (
          <KpiCard
            key={k.id}
            label={k.label}
            value={isLoading ? '—' : k.value}
            delta={k.delta}
            color={k.color}
            Icon={k.Icon}
            delay={idx * 60}
            isLoaded={isLoaded}
          />
        ))}
      </div>

      {/* Revenue Trend + Peak Sales Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <ChartCard title="Revenue Trend">
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
            <LineChart
              data={revenueTrend}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => shortAmount(v)}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
                formatter={(value) => [fmt(value), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="none"
                fill="url(#revGradient)"
              />
              <Line
                type="monotone"
                dataKey="sales"
                stroke="#F97316"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Peak Sales Hours">
          <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={260}>
            <BarChart
              data={peakHours}
              margin={{ top: 10, right: 14, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => shortAmount(v)}
              />
              <RechartsTooltip
                cursor={{ fill: '#FFF7ED' }}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #E5E7EB',
                  fontSize: 12,
                }}
                formatter={(value) => [fmt(value), 'Sales']}
              />
              <Bar dataKey="sales" fill="#F97316" radius={[6, 6, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Order Distribution + Top Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Order Distribution">
          {orderDistribution.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              No order data available
            </div>
          ) : (
            <>
              <div className="h-[200px] min-w-0" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={orderDistribution}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {orderDistribution.map((d, idx) => (
                        <Cell key={idx} fill={d.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center justify-center flex-wrap gap-4 text-xs">
                {orderDistribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: d.color }}
                    />
                    <span className="text-gray-600 font-medium">
                      {d.name}: <span className="text-gray-900 font-bold">{d.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard title="Top Selling Items">
          {topItems.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
              No sales data for selected period
            </div>
          ) : (
            <div className="space-y-4">
              {topItems.map((it, idx) => {
                const pct = (it.revenue / maxTopRevenue) * 100;
                return (
                  <div
                    key={`${it.name}-${idx}`}
                    className="flex items-start gap-3"
                    style={{
                      animation: isLoaded
                        ? `slideUpFade .35s ease-out ${idx * 50}ms both`
                        : 'none',
                    }}
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {it.name}
                        </p>
                        <p className="text-sm font-bold text-gray-900 shrink-0">
                          {fmt(it.revenue)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{it.orders} orders</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Kitchen Staff Performance */}
      <div className="mt-4">
        <KitchenPerformanceSection
          stats={kitchenStats}
          fmt={fmt}
          isLoaded={isLoaded}
          live={liveConnected && includesToday}
        />
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn .25s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Aggregation                                                        */
/* ------------------------------------------------------------------ */

function buildStats(orders) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  const totalOrders = safe.length;
  const totalSales = safe.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

  const itemMapObj = {};
  let totalItems = 0;
  const byType = { DINE_IN: 0, TAKEAWAY: 0, QR_CODE: 0 };
  const uniqueCustomers = new Set();

  safe.forEach((o) => {
    const t = String(o.type || '').toUpperCase();
    if (byType[t] !== undefined) byType[t] += 1;

    const custKey =
      o.customer_id ||
      o.customerId ||
      o.customer_phone ||
      o.customer_email ||
      `${o.table_name || 'NA'}_${o.id}`;
    uniqueCustomers.add(custKey);

    getOrderItemsArray(o).forEach((item) => {
      const name = getItemName(item) || 'Item';
      const qty = getItemQuantity(item);
      const price = getItemPrice(item);
      const lineRevenue = typeof price === 'number' ? price * qty : 0;
      totalItems += qty;
      if (!itemMapObj[name]) itemMapObj[name] = { name, qty: 0, revenue: 0 };
      itemMapObj[name].qty += qty;
      itemMapObj[name].revenue += lineRevenue;
    });
  });

  return {
    totalOrders,
    totalSales,
    avgOrderValue,
    totalItems,
    totalCustomers: uniqueCustomers.size,
    byType,
    itemMap: Object.values(itemMapObj),
  };
}

function buildHourlySeries(orders) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  const buckets = Array(24).fill(0);
  safe.forEach((o) => {
    const ts = o.timestamp || o.created_at;
    if (!ts) return;
    const hour = new Date(ts).getHours();
    if (Number.isFinite(hour)) buckets[hour] += Number(o.total) || 0;
  });
  // Show waking hours 9am-11pm as primary x-axis range like in screenshot.
  const range = [];
  for (let h = 9; h <= 23; h += 1) {
    range.push({ period: formatHourLabel(h), sales: buckets[h] });
  }
  return range;
}

function buildDailySeries(orders, start, end) {
  const safe = Array.isArray(orders) ? orders.filter(reportableFilter) : [];
  if (!start || !end) return [];
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const result = [];
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const map = {};
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const iso = formatYMD(d);
    map[iso] = 0;
  }
  safe.forEach((o) => {
    const ts = o.timestamp || o.created_at;
    if (!ts) return;
    const iso = formatYMD(new Date(ts));
    if (map[iso] !== undefined) map[iso] += Number(o.total) || 0;
  });
  Object.entries(map).forEach(([iso, total]) => {
    const d = new Date(iso + 'T00:00:00');
    const label = dayShort[d.getDay()];
    result.push({ period: label, sales: total, iso });
  });
  return result;
}

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const KpiCard = ({ label, value, delta, color, Icon, delay, isLoaded }) => {
  const positive = delta >= 0;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      style={{ animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold tracking-wider text-gray-400">{label}</p>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg bg-gray-50 ${color} flex items-center justify-center`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <p className={`text-2xl sm:text-3xl font-bold ${color} leading-none`}>{value}</p>
      <div
        className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
          positive ? 'text-emerald-500' : 'text-rose-500'
        }`}
      >
        {positive ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        )}
        {positive ? '+' : ''}
        {(delta || 0).toFixed(1)}%
      </div>
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="bg-white dark:bg-[#111C35] rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 min-w-0 overflow-hidden">
    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Kitchen performance — aggregation                                  */
/* ------------------------------------------------------------------ */

/**
 * Group orders by the kitchen staff member who prepared them and compute the metrics
 * surfaced on the Reports page:
 *   - ordersPrepared (those with both preparing_at and ready_at)
 *   - inProgress     (preparing_at but no ready_at yet)
 *   - avgPrepMin     (mean of ready_at - preparing_at)
 *   - fastestMin / slowestMin
 *   - totalRevenue handled
 *   - itemsCooked
 *
 * The fields `staff_id`/`chef_id`, `staff_name`/`chef_name`, `preparing_at`, `ready_at` are
 * stamped server-side when the kitchen flips an order to "preparing"
 * (and then to "ready"). Legacy orders that pre-date this tracking
 * are still surfaced under "Kitchen Staff" so they don't disappear
 * from the report — they just won't have prep-time durations.
 */
function buildKitchenStats(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const byStaff = new Map();

  const cookedStatuses = new Set([
    'preparing',
    'ready',
    'delivered',
    'completed',
  ]);

  list.forEach((o) => {
    const status = String(o.status || '').toLowerCase();
    const wentThroughKitchen = cookedStatuses.has(status) || o.preparing_at || o.ready_at;
    if (!wentThroughKitchen) return;

    const staffId = o.staff_id || o.chef_id || o.chefId || null;
    const rawName = (o.staff_name || o.chef_name || o.chefName || '').trim();
    // Bucket orders that never got attributed (legacy data, or rare
    // edge-cases where the JWT lacked an id/name) under a generic
    // "Kitchen Staff" group so they remain visible in the report.
    const staffName = rawName || (staffId ? `Cook #${staffId}` : 'Kitchen Staff');

    const key = staffId ? `id:${staffId}` : `name:${staffName.toLowerCase()}`;
    if (!byStaff.has(key)) {
      byStaff.set(key, {
        id: staffId,
        name: staffName,
        attributed: Boolean(rawName || staffId),
        ordersPrepared: 0,
        inProgress: 0,
        totalRevenue: 0,
        itemsCooked: 0,
        prepDurationsMin: [],
        estimatedDurationsMin: [], // best-effort fallback when proper
        // preparing_at / ready_at are missing
      });
    }
    const c = byStaff.get(key);

    const prep = o.preparing_at ? new Date(o.preparing_at) : null;
    const ready = o.ready_at ? new Date(o.ready_at) : null;

    if (prep && ready && ready.getTime() > prep.getTime()) {
      const mins = (ready.getTime() - prep.getTime()) / 60000;
      // Drop anything > 12h as a data-entry mistake.
      if (mins >= 0 && mins < 720) {
        c.prepDurationsMin.push(mins);
      }
    } else if (prep && !ready && status === 'preparing') {
      c.inProgress += 1;
    } else {
      // Fallback when accurate prep-time data is missing (legacy orders
      // or orders that skipped the KDS preparing→ready flow): estimate
      // using `delivered_at − timestamp`. This is the full order
      // lifecycle, so it's an upper bound, but it's still useful as a
      // signal until staff start using the KDS properly.
      const created = o.timestamp ? new Date(o.timestamp) : null;
      const delivered = o.delivered_at ? new Date(o.delivered_at) : null;
      if (created && delivered && delivered.getTime() > created.getTime()) {
        const mins = (delivered.getTime() - created.getTime()) / 60000;
        if (mins >= 0 && mins < 720) {
          c.estimatedDurationsMin.push(mins);
        }
      }
    }

    // Every kitchen-touched order counts toward `ordersPrepared` even
    // if the duration is unknown — otherwise a legacy order with no
    // timestamps disappears from the leaderboard entirely.
    if (status !== 'preparing') {
      c.ordersPrepared += 1;
    }

    c.totalRevenue += Number(o.total) || 0;
    c.itemsCooked += getOrderItemsArray(o).reduce(
      (s, it) => s + getItemQuantity(it),
      0
    );
  });

  const staffList = Array.from(byStaff.values()).map((c) => {
    // Prefer accurate preparing_at→ready_at durations; only fall back
    // to delivered_at−timestamp estimates when none are available.
    const accurate = c.prepDurationsMin;
    const estimated = c.estimatedDurationsMin;
    const durations = accurate.length > 0 ? accurate : estimated;
    const isEstimated = accurate.length === 0 && estimated.length > 0;
    const sum = durations.reduce((s, n) => s + n, 0);
    const avg = durations.length > 0 ? sum / durations.length : 0;
    return {
      id: c.id,
      name: c.name,
      attributed: c.attributed,
      ordersPrepared: c.ordersPrepared,
      ordersTimed: durations.length,
      inProgress: c.inProgress,
      avgPrepMin: avg,
      fastestMin: durations.length > 0 ? Math.min(...durations) : null,
      slowestMin: durations.length > 0 ? Math.max(...durations) : null,
      totalRevenue: c.totalRevenue,
      itemsCooked: c.itemsCooked,
      estimated: isEstimated,
    };
  });

  // Sort: most productive first (most orders → fastest avg).
  staffList.sort((a, b) => {
    if (b.ordersPrepared !== a.ordersPrepared) {
      return b.ordersPrepared - a.ordersPrepared;
    }
    return a.avgPrepMin - b.avgPrepMin;
  });

  const totalOrders = staffList.reduce((s, c) => s + c.ordersPrepared, 0);

  // Overall avg is weighted by number of timed orders so it isn't
  // skewed by staff with zero recorded durations.
  let totalTimedOrders = 0;
  let totalTimedSum = 0;
  staffList.forEach((c) => {
    totalTimedOrders += c.ordersTimed;
    totalTimedSum += c.avgPrepMin * c.ordersTimed;
  });
  const overallAvgMin =
    totalTimedOrders > 0 ? totalTimedSum / totalTimedOrders : 0;

  const timedStaff = staffList.filter((c) => c.ordersTimed > 0);
  const fastestStaff =
    timedStaff.slice().sort((a, b) => a.avgPrepMin - b.avgPrepMin)[0] || null;
  const mostProductive = staffList[0] || null;

  return {
    staffList,
    totalOrders,
    overallAvgMin,
    fastestStaff,
    mostProductive,
  };
}

const formatPrepTime = (mins) => {
  if (mins == null || !Number.isFinite(mins) || mins <= 0) return '—';
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  if (mins < 60) return `${mins.toFixed(1)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins - h * 60);
  return `${h}h ${m}m`;
};

/* ------------------------------------------------------------------ */
/*  Kitchen Staff performance — UI                                      */
/* ------------------------------------------------------------------ */

const KitchenPerformanceSection = ({ stats, fmt, isLoaded, live }) => {
  const { staffList, totalOrders, overallAvgMin, fastestStaff, mostProductive } = stats;

  if (staffList.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">Kitchen Staff Performance</h3>
              <p className="text-xs text-gray-500">
                Prep-time analytics per kitchen staff member
              </p>
            </div>
          </div>
        </div>
        <div className="h-32 flex flex-col items-center justify-center text-center text-sm text-gray-400">
          <Timer className="w-6 h-6 mb-2 text-gray-300" />
          No kitchen staff activity in this period yet.
          <span className="text-[11px] text-gray-400 mt-1 max-w-md">
            Stats appear as soon as kitchen staff move orders to
            <span className="font-semibold"> preparing</span> and then{' '}
            <span className="font-semibold">ready</span> on the Kitchen
            Display. Existing completed orders show up under{' '}
            <span className="font-semibold">Kitchen Staff</span> without a
            prep-time.
          </span>
        </div>
      </div>
    );
  }

  const maxAvg = Math.max(...staffList.map((c) => c.avgPrepMin || 0), 1);
  const maxOrders = Math.max(...staffList.map((c) => c.ordersPrepared || 0), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
            <Utensils className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Kitchen Staff Performance
              {live && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">
              How long each cook took per order — lower is better
            </p>
          </div>
        </div>

        {/* Roll-up KPIs */}
        <div className="flex items-center gap-2 flex-wrap">
          <MiniStat
            Icon={Timer}
            label="Avg prep time"
            value={formatPrepTime(overallAvgMin)}
            tint="text-blue-500 bg-blue-50"
          />
          <MiniStat
            Icon={Utensils}
            label="Orders cooked"
            value={totalOrders.toString()}
            tint="text-orange-500 bg-orange-50"
          />
          {fastestStaff && (
            <MiniStat
              Icon={Zap}
              label="Fastest staff"
              value={`${fastestStaff.name.split(' ')[0]} · ${formatPrepTime(
                fastestStaff.avgPrepMin
              )}`}
              tint="text-emerald-500 bg-emerald-50"
            />
          )}
          {mostProductive && (
            <MiniStat
              Icon={Award}
              label="Most productive"
              value={`${mostProductive.name.split(' ')[0]} · ${mostProductive.ordersPrepared}`}
              tint="text-amber-500 bg-amber-50"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Leaderboard */}
        <div className="space-y-3">
          {staffList.map((c, idx) => {
            const ordersPct = (c.ordersPrepared / maxOrders) * 100;
            const isFastest =
              fastestStaff &&
              c.name === fastestStaff.name &&
              c.ordersTimed > 0;
            const hasTiming = c.ordersTimed > 0;
            return (
              <div
                key={c.name + idx}
                className="border border-gray-100 rounded-xl p-3 hover:border-orange-200 transition"
                style={{
                  animation: isLoaded
                    ? `slideUpFade .35s ease-out ${idx * 40}ms both`
                    : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                        {c.name}
                        {isFastest && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold tracking-wider uppercase">
                            <Zap className="w-2.5 h-2.5" />
                            Fastest
                          </span>
                        )}
                        {!c.attributed && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[9px] font-bold tracking-wider uppercase"
                            title="Legacy orders from before kitchen tracking was enabled"
                          >
                            Legacy
                          </span>
                        )}
                      </p>
                      <p
                        className="text-xs font-bold text-gray-900 shrink-0"
                        title={
                          c.estimated
                            ? 'Estimated from total order time (created → delivered) because this order didn\'t go through the Kitchen Display preparing → ready flow.'
                            : ''
                        }
                      >
                        {hasTiming
                          ? (c.estimated ? '≈ ' : '') + formatPrepTime(c.avgPrepMin)
                          : '—'}
                      </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(6, ordersPct))}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 flex-wrap gap-1">
                      <span>
                        <span className="font-semibold text-gray-700">
                          {c.ordersPrepared}
                        </span>{' '}
                        orders ·{' '}
                        <span className="font-semibold text-gray-700">
                          {c.itemsCooked}
                        </span>{' '}
                        items
                      </span>
                      <span>
                        {hasTiming
                          ? `${c.estimated ? 'Est.' : 'Fast'} ${formatPrepTime(c.fastestMin)} · ${c.estimated ? 'Est.' : 'Slow'} ${formatPrepTime(c.slowestMin)}`
                          : 'No prep-time recorded'}
                      </span>
                    </div>
                    {c.estimated && (
                      <p className="mt-1 text-[10px] text-gray-400 italic">
                        Estimated from full order time — for precise data,
                        use the Kitchen Display to mark orders Preparing →
                        Ready.
                      </p>
                    )}
                  </div>
                </div>
                {c.inProgress > 0 && (
                  <p className="mt-2 text-[10px] font-semibold tracking-wider uppercase text-blue-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {c.inProgress} order{c.inProgress > 1 ? 's' : ''} in progress
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Avg prep-time chart */}
        <div className="border border-gray-100 rounded-xl p-3">
          <p className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-2">
            Average prep time by kitchen staff (lower is better)
          </p>
          {(() => {
            const timed = staffList.filter((c) => c.ordersTimed > 0);
            if (timed.length === 0) {
              return (
                <div className="h-[220px] flex flex-col items-center justify-center text-center text-sm text-gray-400 px-4">
                  <Timer className="w-6 h-6 mb-2 text-gray-300" />
                  No prep-time data yet for this period.
                  <span className="text-[11px] text-gray-400 mt-1">
                    The chart fills in as kitchen staff move orders from{' '}
                    <span className="font-semibold">preparing</span> →{' '}
                    <span className="font-semibold">ready</span> on the
                    Kitchen Display.
                  </span>
                </div>
              );
            }
            return (
              <div className="min-w-0 w-full">
                <ResponsiveContainer width="100%" height={Math.max(220, timed.length * 44)} minWidth={0} minHeight={220}>
                <BarChart
                  data={timed.map((c) => ({
                    name: c.name,
                    avg: Number(c.avgPrepMin.toFixed(2)),
                    orders: c.ordersPrepared,
                    revenue: c.totalRevenue,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 16, left: 4, bottom: 5 }}
                >
                  <CartesianGrid stroke="#F1F5F9" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toFixed(0)}m`}
                    domain={[0, Math.ceil(maxAvg * 1.15)]}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <RechartsTooltip
                    cursor={{ fill: '#FFF7ED' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E5E7EB',
                      fontSize: 12,
                    }}
                    formatter={(value, key) => {
                      if (key === 'avg') return [`${value} min`, 'Avg prep'];
                      return [value, key];
                    }}
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload;
                      if (!row) return label;
                      return `${label} · ${row.orders} orders · ${fmt(row.revenue)}`;
                    }}
                  />
                  <Bar dataKey="avg" fill="#F97316" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ Icon, label, value, tint }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100">
    <span className={`w-6 h-6 rounded-md flex items-center justify-center ${tint}`}>
      <Icon className="w-3.5 h-3.5" />
    </span>
    <span className="text-[11px] text-gray-500 font-semibold">{label}</span>
    <span className="text-xs text-gray-900 font-bold">{value}</span>
  </div>
);

export default Reports;
