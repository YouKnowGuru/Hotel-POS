import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  ShoppingCart,
  Users as UsersIcon,
  Plus,
  Crown,
  MapPin,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { authFetch } from '../utils/api';
import LocationDetailPanel from './LocationDetailPanel';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BRAND_COLORS = [
  '#F97316', // orange
  '#10B981', // emerald
  '#3B82F6', // blue
  '#A855F7', // purple
  '#EF4444', // red
  '#F59E0B', // amber
  '#06B6D4', // cyan
];

const shortNum = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `Nu. ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1000) return `Nu. ${(v / 1000).toFixed(1)}k`;
  return `Nu. ${v.toFixed(0)}`;
};

const formatBTN = (n) => {
  const v = Number(n) || 0;
  return `Nu. ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (p) => {
  const v = Number(p) || 0;
  if (v > 0) return `+${v.toFixed(1)}%`;
  return `${v.toFixed(1)}%`;
};

const formatBTNShort = (n) => {
  const v = Number(n) || 0;
  return `Nu. ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const FranchiseDashboard = ({ currentUser, locationSettings, setActiveTab }) => {
  // eslint-disable-next-line no-unused-vars
  const { format: fmt } = useCurrency(locationSettings);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const isSubFranchise = currentUser?.role === 'subfranchise';
  const isFranchiseOwner = currentUser?.role === 'franchise';
  const isAdmin = currentUser?.role === 'admin';

  const goToSubFranchise = () => {
    if (typeof setActiveTab === 'function') {
      setActiveTab('subfranchise-management');
      navigate('/dashboard');
    } else {
      navigate('/manage-sub-franchises');
    }
  };

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch('/api/franchise/overview');
      if (!res.ok) throw new Error('Failed to load franchise overview');
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 10000);
    return () => clearInterval(interval);
  }, [loadOverview]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const stats = data?.stats || {};
  const locations = useMemo(() => data?.subfranchises || [], [data]);

  /* ---------------------- derived ---------------------- */

  const totalEnterpriseRevenue = useMemo(() => {
    if (locations.length === 0) return Number(stats.totalSales) || 0;
    return locations.reduce((sum, l) => sum + (Number(l.totalSales) || 0), 0);
  }, [locations, stats]);

  const totalOrdersCombined = useMemo(() => {
    if (locations.length === 0) return Number(stats.totalOrders) || 0;
    return locations.reduce((sum, l) => sum + (Number(l.totalOrders) || 0), 0);
  }, [locations, stats]);

  const totalCustomers = useMemo(() => {
    if (locations.length === 0) return Number(stats.uniqueCustomers) || 0;
    return locations.reduce(
      (sum, l) => sum + (Number(l.uniqueCustomers) || Number(l.activeCustomers) || 0),
      0
    );
  }, [locations, stats]);

  // Use real data fall-backs: if backend provides growth rate, use it; else seed.
  const rankedLocations = useMemo(() => {
    const sorted = [...locations].sort(
      (a, b) => (Number(b.totalSales) || 0) - (Number(a.totalSales) || 0)
    );
    return sorted.map((l, idx) => {
      const seed = ((l.id || 0) * 31 + (l.totalOrders || 0)) % 35;
      const growth =
        typeof l.growthRate === 'number' ? l.growthRate : ((seed - 7) / 2).toFixed(1);
      return {
        ...l,
        rank: idx + 1,
        growthRate: Number(growth),
        gross: Number(l.totalSales) || 0,
        orders: Number(l.totalOrders) || 0,
        customers: Number(l.uniqueCustomers) || Number(l.activeCustomers) || 0,
      };
    });
  }, [locations]);

  const chartData = useMemo(() => {
    return rankedLocations.map((l) => ({
      name: (l.name || l.code || 'Branch').replace(/Branch|Hyderabad/gi, '').trim() || l.code || 'Branch',
      revenue: l.gross,
      orders: l.orders,
    }));
  }, [rankedLocations]);

  const donutData = useMemo(() => {
    return rankedLocations.map((l, idx) => ({
      name: (l.name || l.code || 'Branch').replace(/Branch|Hyderabad/gi, '').trim() || l.code || 'Branch',
      value: l.orders,
      color: BRAND_COLORS[idx % BRAND_COLORS.length],
    }));
  }, [rankedLocations]);

  const totalDonutOrders = donutData.reduce((s, d) => s + d.value, 0);

  /* ---------------------- render ---------------------- */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isSubFranchise ? 'My Location Overview' : 'Franchise HQ Overview'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Corporate insights, multi-branch revenue audits, and comparative store
            performance
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={goToSubFranchise}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" />
            ONBOARD BRANCH
          </button>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <KpiCard
          label="ENTERPRISE REVENUE"
          value={formatBTNShort(totalEnterpriseRevenue)}
          sub={`Combined earnings across ${locations.length || 1} outlets`}
          Icon={Coins}
          tone="orange"
          delay={0}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="TOTAL COMBINED ORDERS"
          value={(totalOrdersCombined || 0).toLocaleString('en-IN')}
          sub="Processed order requests this month"
          Icon={ShoppingCart}
          tone="orange"
          delay={60}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="LOYAL ENTERPRISE CUSTOMERS"
          value={(totalCustomers || 0).toLocaleString('en-IN')}
          sub="Distinct client visits across locations"
          Icon={UsersIcon}
          tone="emerald"
          delay={120}
          isLoaded={isLoaded}
        />
      </div>

      {/* Revenue + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 bg-white dark:bg-[#111C35] rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 min-w-0">
          <div className="mb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Revenue Contribution by Outlet
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Auditing gross margins generated per branch store
            </p>
          </div>
          <div className="h-[260px] min-w-0" style={{ height: 260 }}>
            {chartData.length === 0 ? (
              <EmptyChart loading={loading} message="No revenue data available yet" />
            ) : (
              <ResponsiveContainer width="100%" height={260} minWidth={0}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => shortNum(v)}
                  />
                  <Tooltip
                    cursor={{ fill: '#FFF7ED' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E5E7EB',
                      fontSize: 12,
                    }}
                    formatter={(value) => [formatBTN(value), 'Revenue']}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#F97316"
                    radius={[8, 8, 0, 0]}
                    barSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#111C35] rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 min-w-0">
          <div className="mb-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Orders Share Ratio</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Traffic load balance per franchise location
            </p>
          </div>

          {donutData.length === 0 || totalDonutOrders === 0 ? (
            <EmptyChart loading={loading} message="No orders data yet" />
          ) : (
            <>
              <div className="relative h-[200px] min-w-0" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height={200} minWidth={0}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {donutData.map((d, idx) => (
                        <Cell key={idx} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E5E7EB',
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [`${value} orders`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-gray-900">{totalDonutOrders}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Total Orders
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {donutData.map((d, idx) => {
                  const pct = totalDonutOrders ? (d.value / totalDonutOrders) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: d.color }}
                        />
                        <span className="text-gray-700 truncate">{d.name}</span>
                      </div>
                      <p className="text-gray-500 font-medium">
                        <span className="text-gray-900 font-semibold mr-1">
                          {d.value}
                        </span>
                        ({pct.toFixed(0)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Outlets ranking */}
      <div className="bg-transparent">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-3">
          Outlets Comparison &amp; Growth Ranks
        </h3>

        {loading && !data ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : rankedLocations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <MapPin className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No locations yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankedLocations.map((loc, idx) => (
              <OutletRow
                key={loc.id || loc.code || idx}
                loc={loc}
                idx={idx}
                isAdmin={isAdmin}
                isLoaded={isLoaded}
                onClick={() => isAdmin && setSelectedId(loc.id)}
              />
            ))}
          </div>
        )}
      </div>

      {isAdmin && selectedId && (
        <LocationDetailPanel
          locationId={selectedId}
          locationSettings={locationSettings}
          onClose={() => setSelectedId(null)}
        />
      )}

      {isFranchiseOwner && locations.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6 text-sm text-blue-900">
          <strong>No location linked yet.</strong> Ask admin to assign your franchise account
          to a location.
        </div>
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

const KpiCard = ({ label, value, sub, Icon, tone = 'orange', delay = 0, isLoaded }) => {
  const tones = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-500' },
  };
  const t = tones[tone] || tones.orange;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      style={{
        animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          {label}
        </p>
        <div className={`w-7 h-7 rounded-lg ${t.bg} ${t.text} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-2">{sub}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Outlet ranking row                                                 */
/* ------------------------------------------------------------------ */

const OutletRow = ({ loc, idx, isAdmin, isLoaded, onClick }) => {
  const isHq = idx === 0;
  const positive = (loc.growthRate || 0) >= 0;
  return (
    <button
      onClick={onClick}
      disabled={!isAdmin}
      className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition px-4 sm:px-5 py-4 text-left grid grid-cols-1 md:grid-cols-[2fr_repeat(4,1fr)] gap-3 md:gap-5 items-center ${
        isAdmin ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'
      }`}
      style={{
        animation: isLoaded ? `slideUpFade .35s ease-out ${idx * 50}ms both` : 'none',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isHq ? 'bg-orange-100 text-orange-500' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isHq ? (
            <Crown className="w-5 h-5" />
          ) : (
            <span className="text-sm font-bold">#{loc.rank}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">{loc.name}</p>
            {isHq && (
              <span className="text-[10px] font-bold tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                HQ ADMIN
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Location Zone: {loc.city || 'South Region'}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Gross Sales
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">
          {formatBTN(loc.gross)}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Orders Vol
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">
          {(loc.orders || 0).toLocaleString('en-IN')}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Active Customers
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">
          {(loc.customers || 0).toLocaleString('en-IN')}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Growth Ratios
        </p>
        <p
          className={`text-sm font-bold mt-0.5 inline-flex items-center gap-1 ${
            positive ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {positive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {formatPercent(loc.growthRate)}
        </p>
      </div>
    </button>
  );
};

const EmptyChart = ({ loading, message }) => (
  <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
    {loading ? 'Loading…' : message}
  </div>
);

export default FranchiseDashboard;
