import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
 Download, Printer, Calendar, TrendingUp, Receipt, Filter,
 ChevronDown, RefreshCw, CheckCircle, AlertCircle, Percent,
 Layers, ArrowUpRight, Search, X, Users, DivideSquare,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import useCurrency from '../hooks/useCurrency';
import { SERVICE_CHARGE_PERCENT, loadRestaurantInfo } from '../utils/receiptPrint';

/* ── helpers ─────────────────────────────────────────────────── */
const isOrderPaid = (o) => {
 const s = String(o?.status || '').toLowerCase();
 const b = String(o?.bill_status || '').toLowerCase();
 const p = String(o?.payment_status || '').toLowerCase();
 return s === 'completed' || s === 'paid' || b === 'paid' || p === 'paid' || !!o?.paid_at;
};
const getOrderDate = (o) => {
 const raw = o?.paid_at || o?.delivered_at || o?.updated_at || o?.timestamp || o?.createdAt || o?.created_at;
 const d = raw ? new Date(raw) : new Date();
 return isNaN(d.getTime()) ? new Date() : d;
};
const MONTH_NAMES = [
 'January','February','March','April','May','June',
 'July','August','September','October','November','December',
];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const monthLabel = (key) => {
 if (!key) return '-';
 const [y, m] = key.split('-');
 return `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`;
};
const TEAL = '#1a5c3e';

/**
 * Compute service charge & GST from a paid order's total.
 * total = subtotal * (1 + SC%) * (1 + GST%)
 */
const calcServiceCharge = (order, taxPercent) => {
 if (!order) return { subtotal: 0, serviceCharge: 0, gst: 0, total: 0 };
 const paidTotal = Number(order.total) || 0;
 const tPct = Number(taxPercent) || 0;
 const scPct = SERVICE_CHARGE_PERCENT; // 10
 // BUGFIX: prefer the SC/tax snapshot stored on the order at sale time,
 // so later tax-rate changes can't rewrite historical service-charge
 // rows. Older orders (null columns) keep the back-calc below.
 if (
 paidTotal > 0 &&
 order.service_charge != null && order.subtotal != null &&
 order.tax_percent != null
 ) {
 return {
 subtotal: Math.round(Number(order.subtotal) * 100) / 100,
 serviceCharge: Math.round(Number(order.service_charge) * 100) / 100,
 gst: Math.round((Number(order.tax_amount) || 0) * 100) / 100,
 total: Math.round(paidTotal * 100) / 100,
 };
 }
 if (paidTotal > 0 && scPct > 0) {
 const scFactor = 1 + scPct / 100;
 const gstFactor = 1 + tPct / 100;
 const subtotal = paidTotal / (scFactor * gstFactor);
 const sc = subtotal * (scPct / 100);
 const afterSC = subtotal + sc;
 const gst = afterSC * (tPct / 100);
 return {
 subtotal: Math.round(subtotal * 100) / 100,
 serviceCharge: Math.round(sc * 100) / 100,
 gst: Math.round(gst * 100) / 100,
 total: Math.round(paidTotal* 100) / 100,
 };
 }
 const rawItems = Array.isArray(order.items)
 ? order.items
 : typeof order.items === 'string'
 ? (() => { try { return JSON.parse(order.items); } catch { return []; } })()
 : [];
 const subtotal = rawItems.reduce(
 (s, it) => s + (Number(it?.price) || 0) * (it?.quantity || it?.qty || 1), 0
 );
 const sc = subtotal * (scPct / 100);
 const afterSC = subtotal + sc;
 const gst = afterSC * (tPct / 100);
 const total = afterSC + gst;
 return {
 subtotal: Math.round(subtotal * 100) / 100,
 serviceCharge: Math.round(sc * 100) / 100,
 gst: Math.round(gst * 100) / 100,
 total: Math.round(total * 100) / 100,
 };
};

/* ── StatCard ────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, sub, color, badge }) => (
 <div className="rounded-2xl p-4 sm:p-5 flex items-start gap-3 bg-white border border-gray-200/80 shadow-sm hover:shadow-md transition">
 <div
 className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
 style={{ background: color + '15', border: `1px solid ${color}30` }}
 >
 <Icon className="w-5 h-5" style={{ color }} />
 </div>  <div className="min-w-0 flex-1">
  <div className="flex items-start justify-between gap-1">
  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-gray-400 leading-snug">{label}</p>
  {badge && (
  <span
  className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
  style={{ background: color + '15', color }}
  >{badge}</span>
  )}
  </div>
  <p className="text-base sm:text-xl font-extrabold text-gray-800 mt-0.5 leading-tight break-words">{value}</p>
  {sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>}
  </div>
 </div>
);

/* ── Main Component ──────────────────────────────────────────── */
/* Home delivery orders are their own type — DELIVERY rows used to be
   shown with just the customer name (table_name), indistinguishable from
   a dine-in table. */
const orderTypeLabel = (o) => {
 const t = String(o.type || '').toUpperCase();
 if (t === 'DELIVERY') return 'Delivery';
 if (t === 'TAKEAWAY') return 'Takeaway';
 return 'Dine-In';
};

/* "Table / Type" cell for exports: takeaway and delivery rows carry their
   type (delivery also keeps the customer label); dine-in shows the table. */
const exportTypeCell = (o) => {
 const t = String(o.type || '').toUpperCase();
 if (t === 'TAKEAWAY') return 'Takeaway';
 if (t === 'DELIVERY') return o.table_name ? `Delivery · ${o.table_name}` : 'Delivery';
 return o.table_name || '-';
};

const ServiceChargeLedger = ({ locationSettings }) => {
 const { format: fmt, symbol: currSymbol } = useCurrency(locationSettings);
 const [orders, setOrders] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [taxPercent, setTaxPercent] = useState(5);
 const [selectedYear, setSelectedYear] = useState('all');
 const [selectedMonth, setSelectedMonth] = useState('all');
 const [orderType, setOrderType] = useState('all');
 const [searchQuery, setSearchQuery] = useState('');
 // Waiter distribution
 const [distribution, setDistribution] = useState({
 waiters: [],
 waiterCount: 0,
 totalOrders: 0,
 totalServiceCharge: 0,
 sharePerWaiter: 0,
 period: 'all-time',
 });
 const [distLoading, setDistLoading] = useState(true);

 const loadSettings = useCallback(() => {
 try {
 const raw = localStorage.getItem('globalTaxDiscount');
 if (raw) {
 const p = JSON.parse(raw);
 if (p.taxPercent != null) setTaxPercent(Number(p.taxPercent) || 5);
 }
 } catch (_) {}
 authFetch('/api/settings')
 .then((r) => r.json())
 .then((d) => {
 if (d?.taxPercent != null) {
 setTaxPercent(Number(d.taxPercent) || 5);
 localStorage.setItem('globalTaxDiscount', JSON.stringify(d));
 }
 })
 .catch(() => {});
 }, []);

 const fetchOrders = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await authFetch('/api/orders');
 const data = await res.json();
 setOrders((Array.isArray(data) ? data : []).filter(isOrderPaid));
 } catch {
 setError('Failed to load orders. Please try again.');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => { loadSettings(); fetchOrders(); }, [loadSettings, fetchOrders]);

 // Fetch waiter distribution whenever year/month filter changes
 const fetchDistribution = useCallback(async () => {
 setDistLoading(true);
 try {
 const qs = [
 selectedYear !== 'all' ? `year=${selectedYear}` : '',
 selectedMonth !== 'all' ? `month=${selectedMonth}` : '',
 ].filter(Boolean).join('&');
 const res = await authFetch(`/api/service-charge/distribution${qs ? '?' + qs : ''}`);
 const data = await res.json();
 // Guard: ensure the response has the expected shape
 if (data && typeof data === 'object' && !data.message) {
 setDistribution({
 ...data,
 waiters: Array.isArray(data.waiters) ? data.waiters : [],
 waiterCount: Number(data.waiterCount) || 0,
 totalOrders: Number(data.totalOrders) || 0,
 totalServiceCharge: Number(data.totalServiceCharge) || 0,
 sharePerWaiter: Number(data.sharePerWaiter) || 0,
 period: data.period || 'all-time',
 });
 } else {
 // API returned an error message or unexpected shape — show empty state
 setDistribution({ waiters: [], waiterCount: 0, totalOrders: 0, totalServiceCharge: 0, sharePerWaiter: 0, period: 'all-time' });
 }
 } catch {
 setDistribution({ waiters: [], waiterCount: 0, totalOrders: 0, totalServiceCharge: 0, sharePerWaiter: 0, period: 'all-time' });
 } finally {
 setDistLoading(false);
 }
 }, [selectedYear, selectedMonth]);

 useEffect(() => { fetchDistribution(); }, [fetchDistribution]);


 const enriched = useMemo(
 () => (Array.isArray(orders) ? orders : []).map((o) => ({ ...o, _sc: calcServiceCharge(o, taxPercent) })),
 [orders, taxPercent]
 );

 const availableYears = useMemo(() => {
 const s = new Set((enriched || []).map((o) => getOrderDate(o).getFullYear()).filter((y) => !isNaN(y)));
 return ['all', ...Array.from(s).sort((a, b) => b - a)];
 }, [enriched]);

 const filtered = useMemo(() => (enriched || []).filter((o) => {
 const d = getOrderDate(o);
 if (selectedYear !== 'all' && d.getFullYear() !== Number(selectedYear)) return false;
 if (selectedMonth !== 'all' && String(d.getMonth()+1).padStart(2,'0') !== selectedMonth) return false;
 if (orderType !== 'all') {
 const t = String(o.type || '').toUpperCase();
 if (orderType === 'dine-in' && (t === 'TAKEAWAY' || t === 'DELIVERY')) return false;
 if (orderType === 'takeaway' && t !== 'TAKEAWAY') return false;
 if (orderType === 'delivery' && t !== 'DELIVERY') return false;
 }
 if (searchQuery.trim()) {
 const q = searchQuery.toLowerCase();
 const rawItems = Array.isArray(o?.items)
 ? o.items
 : typeof o?.items === 'string'
 ? (() => { try { return JSON.parse(o.items); } catch { return []; } })()
 : [];
 const items = rawItems.map((it) => it?.name || '').join(' ').toLowerCase();
 if (!String(o?.id || '').includes(q) && !items.includes(q) && !(o?.table_name||'').toLowerCase().includes(q))
 return false;
 }
 return true;
 }), [enriched, selectedYear, selectedMonth, orderType, searchQuery]);

 const totals = useMemo(() => ({
 count: filtered.length,
 subtotal: Math.round(filtered.reduce((s,o)=>s+o._sc.subtotal, 0)*100)/100,
 serviceCharge: Math.round(filtered.reduce((s,o)=>s+o._sc.serviceCharge, 0)*100)/100,
 grand: Math.round(filtered.reduce((s,o)=>s+o._sc.total, 0)*100)/100,
 }), [filtered]);

 const monthlyData = useMemo(() => {
 const map = {};
 filtered.forEach((o) => {
 const k = monthKey(getOrderDate(o));
 if (!map[k]) map[k] = { key: k, count: 0, serviceCharge: 0, subtotal: 0, grand: 0 };
 map[k].count++;
 map[k].subtotal += o._sc.subtotal;
 map[k].serviceCharge += o._sc.serviceCharge;
 map[k].grand += o._sc.total;
 });
 return Object.values(map)
 .sort((a,b) => b.key.localeCompare(a.key))
 .map((m) => ({
 ...m,
 subtotal: Math.round(m.subtotal * 100) / 100,
 serviceCharge: Math.round(m.serviceCharge * 100) / 100,
 grand: Math.round(m.grand * 100) / 100,
 }));
 }, [filtered]);

 /* ── CSV export ─────────────────────────────────────────────── */
 const handleCSVExport = () => {
 const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
 const headers = ['Date','Bill No.','Table / Type','Subtotal','Service Charge (10%)','GST','Grand Total'];
 const rows = filtered.map((o) => {
 const d = getOrderDate(o);
 return [
 d.toLocaleDateString('en-GB'), o.id,
 exportTypeCell(o),
 o._sc.subtotal.toFixed(2), o._sc.serviceCharge.toFixed(2),
 o._sc.gst.toFixed(2), o._sc.total.toFixed(2),
 ];
 });
 const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
 const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `service-charge-ledger-${new Date().toISOString().slice(0,10)}.csv`;
 document.body.appendChild(a); a.click(); a.remove();
 URL.revokeObjectURL(url);
 };

 /* ── Print ──────────────────────────────────────────────────── */
 const handlePrint = () => {
 const info = loadRestaurantInfo();
 const today = new Date().toLocaleDateString('en-GB');
 const period =
 selectedMonth !== 'all'
 ? monthLabel(`${selectedYear !== 'all' ? selectedYear : new Date().getFullYear()}-${selectedMonth}`)
 : selectedYear !== 'all' ? `Year ${selectedYear}` : 'All Time';
 const rowsHtml = filtered.map((o) => {
 const d = getOrderDate(o);
 return `<tr>
 <td>${d.toLocaleDateString('en-GB')}</td>
 <td>#${o.id}</td>
 <td>${exportTypeCell(o)}</td>
 <td style="text-align:right">${currSymbol} ${o._sc.subtotal.toFixed(2)}</td>
 <td style="text-align:right;color:${TEAL};font-weight:bold">${currSymbol} ${o._sc.serviceCharge.toFixed(2)}</td>
 <td style="text-align:right">${currSymbol} ${o._sc.gst.toFixed(2)}</td>
 <td style="text-align:right;font-weight:bold">${currSymbol} ${o._sc.total.toFixed(2)}</td>
 </tr>`;
 }).join('');
 const html = `<!DOCTYPE html><html><head><title>Service Charge Ledger</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px}
h1{font-size:18px;margin:0}h2{font-size:14px;margin:4px 0 12px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{background:${TEAL};color:#fff;padding:6px 8px;text-align:left;font-size:11px}
td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
tfoot td{font-weight:bold;border-top:2px solid #000;background:#f0fdf4}
@media print{@page{size:A4 landscape;margin:15mm}}
</style></head><body>
<h1>${info.name}</h1>
<h2>Service Charge Ledger — ${period}</h2>
<p>Printed: ${today} | Total Orders: ${totals.count}</p>
<table>
<thead><tr>
 <th>Date</th><th>Bill #</th><th>Table/Type</th>
 <th style="text-align:right">Subtotal</th>
 <th style="text-align:right">Service Charge (10%)</th>
 <th style="text-align:right">GST</th>
 <th style="text-align:right">Grand Total</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
<tfoot><tr>
 <td colspan="3">TOTAL (${totals.count} orders)</td>
 <td style="text-align:right">${currSymbol} ${totals.subtotal.toFixed(2)}</td>
 <td style="text-align:right;color:${TEAL}">${currSymbol} ${totals.serviceCharge.toFixed(2)}</td>
 <td style="text-align:right">—</td>
 <td style="text-align:right">${currSymbol} ${totals.grand.toFixed(2)}</td>
</tr></tfoot>
</table>
<script>window.onload = () => window.print();</script>
</body></html>`;
 const w = window.open('', '_blank', 'width=900,height=650');
 if (!w) return;
 w.document.write(html);
 w.document.close();
 };

 /* ── Render ─────────────────────────────────────────────────── */
 return (
 <div className="px-4 sm:px-6 lg:px-8 py-6 min-h-screen">

 {/* ── Header ─────────────────────────────────────────────── */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <div
 className="w-9 h-9 rounded-xl flex items-center justify-center"
 style={{ background: TEAL + '15', border: `1px solid ${TEAL}30` }}
 >
 <Percent className="w-5 h-5" style={{ color: TEAL }} />
 </div>
 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Service Charge Ledger</h1>
 </div>
 <p className="text-sm text-gray-500 ml-11">
 10% service charge collected — tracked separately from GST
 </p>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 <button
 onClick={fetchOrders}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium shadow-sm transition"
 >
 <RefreshCw className="w-4 h-4" /> Refresh
 </button>
 <button
 onClick={handleCSVExport}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium shadow-sm transition"
 >
 <Download className="w-4 h-4" /> CSV
 </button>
 <button
 onClick={handlePrint}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-white text-sm font-medium shadow-sm transition hover:opacity-90"
 style={{ background: TEAL }}
 >
 <Printer className="w-4 h-4" /> Print
 </button>
 </div>
 </div>

 {error && (
 <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
 <AlertCircle className="w-4 h-4 shrink-0" />{error}
 </div>
 )}

 {/* ── Stat Cards ─────────────────────────────────────────── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
 <StatCard icon={Receipt} label="Paid Orders" value={loading ? '...' : totals.count} sub="in selected period" color="#6366f1" />
 <StatCard icon={Layers} label="Subtotal" value={loading ? '...' : fmt(totals.subtotal)} sub="before charges" color="#f59e0b" />
 <StatCard icon={Percent} label={`Service Charge (${SERVICE_CHARGE_PERCENT}%)`} value={loading ? '...' : fmt(totals.serviceCharge)} sub="collected" color={TEAL} badge={`${SERVICE_CHARGE_PERCENT}%`} />
 <StatCard icon={TrendingUp} label="Grand Total Collected" value={loading ? '...' : fmt(totals.grand)} sub="incl. service charge + GST" color="#10b981" />
 </div>

 {/* ── Filters ────────────────────────────────────────────── */}
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
 <div className="flex items-center gap-2 flex-wrap">
 <Filter className="w-4 h-4 text-gray-400 shrink-0" />

 <div className="relative">
 <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
 className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white cursor-pointer">
 {availableYears.map((y) => <option key={y} value={y}>{y === 'all' ? 'All Years' : y}</option>)}
 </select>
 <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
 </div>

 <div className="relative">
 <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
 className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white cursor-pointer">
 <option value="all">All Months</option>
 {MONTH_NAMES.map((m, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
 </select>
 <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
 </div>

 <div className="relative">
 <select value={orderType} onChange={(e) => setOrderType(e.target.value)}
 className="appearance-none pl-3 pr-7 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white cursor-pointer">
 <option value="all">All Types</option>
 <option value="dine-in">Dine-In</option>
 <option value="takeaway">Takeaway</option>
 <option value="delivery">Delivery</option>
 </select>
 <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
 </div>

 <div className="relative flex-1 min-w-[160px]">
 <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
 <input
 type="text" placeholder="Search Bill # or item..."
 value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-300 bg-white"
 />
 {searchQuery && (
 <button onClick={() => setSearchQuery('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>
 </div>

 {/* ── Main grid ──────────────────────────────────────────── */}
 <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

 {/* Monthly breakdown */}
 <div className="xl:col-span-1">
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
 <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
 <Calendar className="w-4 h-4 text-gray-400" /> Monthly Breakdown
 </h2>
 {loading ? (
 <div className="space-y-2">
 {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
 </div>
 ) : monthlyData.length === 0 ? (
 <p className="text-sm text-gray-400 text-center py-8">No data for selected period</p>
 ) : (
 <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
 {monthlyData.map((m) => (
 <div key={m.key}
 className="rounded-xl p-3 border border-gray-100 hover:border-gray-200 transition bg-gray-50">
 <div className="flex items-center justify-between mb-1">
 <span className="text-sm font-semibold text-gray-700">{monthLabel(m.key)}</span>
 <span className="text-[11px] text-gray-400">{m.count} orders</span>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[10px] text-gray-400">Service Charge</p>
 <p className="text-base font-bold" style={{ color: TEAL }}>{fmt(m.serviceCharge)}</p>
 </div>
 <div className="text-right">
 <p className="text-[10px] text-gray-400">Grand Total</p>
 <p className="text-sm font-semibold text-gray-700">{fmt(m.grand)}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {/* Transactions table */}
 <div className="xl:col-span-2">
 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
 <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
 <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
 <ArrowUpRight className="w-4 h-4 text-gray-400" /> Transactions
 </h2>
 <span className="text-xs text-gray-400">{filtered.length} records</span>
 </div>

 {loading ? (
 <div className="p-5 space-y-3">
 {[1,2,3,4,5].map((i) => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}
 </div>
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center px-4">
 <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
 <Receipt className="w-6 h-6" />
 </div>
 <p className="text-sm text-gray-400">No paid orders found for this period.</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-gray-50 border-b border-gray-100">
 <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
 <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Bill #</th>
 <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Table / Type</th>
 <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Subtotal</th>
 <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: TEAL }}>Svc Charge (10%)</th>
 <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Grand Total</th>
 <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {filtered.map((o) => {
 const d = getOrderDate(o);
 const isTW = String(o.type || '').toUpperCase() === 'TAKEAWAY';
 const isDL = String(o.type || '').toUpperCase() === 'DELIVERY';
 return (
 <tr key={o.id} className="hover:bg-gray-50 transition">
 <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.toLocaleDateString('en-GB')}</td>
 <td className="px-4 py-3 font-semibold text-gray-800">#{o.id}</td>
 <td className="px-4 py-3 text-gray-600">
 {isTW || isDL ? (
 <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
 isDL ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'
 }`}>
 {orderTypeLabel(o)}
 </span>
 ) : (o.table_name || '-')}
 {isDL && o.table_name && (
 <span className="block text-xs text-gray-500 mt-0.5 truncate">{o.table_name}</span>
 )}
 </td>
 <td className="px-4 py-3 text-right text-gray-700">{fmt(o._sc.subtotal)}</td>
 <td className="px-4 py-3 text-right font-bold" style={{ color: TEAL }}>{fmt(o._sc.serviceCharge)}</td>
 <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(o._sc.total)}</td>
 <td className="px-4 py-3 text-center">
 <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
 <CheckCircle className="w-3 h-3" /> Paid
 </span>
 </td>
 </tr>
 );
 })}
 </tbody>
 {filtered.length > 0 && (
 <tfoot>
 <tr className="bg-gray-50 border-t-2 border-gray-200">
 <td colSpan={3} className="px-4 py-3 font-bold text-gray-700 text-sm">
 TOTAL ({filtered.length} orders)
 </td>
 <td className="px-4 py-3 text-right font-bold text-gray-700">{fmt(totals.subtotal)}</td>
 <td className="px-4 py-3 text-right font-bold text-lg" style={{ color: TEAL }}>
 {fmt(totals.serviceCharge)}
 </td>
 <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(totals.grand)}</td>
 <td />
 </tr>
 </tfoot>
 )}
 </table>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* ── Waiter Distribution Panel ───────────────────────────── */}
 <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
 <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: TEAL + '15' }}>
 <Users className="w-4 h-4" style={{ color: TEAL }} />
 </div>
 <div>
 <h2 className="text-base font-bold text-gray-800">Waiter Service Charge Distribution</h2>
 <p className="text-[11px] text-gray-400">Total pool divided equally among all active waiters</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {distribution && (
 <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: TEAL + '12', color: TEAL }}>
 {distribution.waiterCount} waiter{distribution.waiterCount !== 1 ? 's' : ''}
 </span>
 )}
 <button
 onClick={fetchDistribution}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-medium shadow-sm transition"
 >
 <RefreshCw className="w-3 h-3" /> Refresh
 </button>
 </div>
 </div>

 {distLoading ? (
 <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
 {[1,2,3,4].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
 </div>
 ) : !distribution || (distribution.waiterCount === 0 && (!distribution.waiters || distribution.waiters.length === 0)) ? (
 <div className="flex flex-col items-center justify-center py-12 text-center px-4">
 <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
 <Users className="w-6 h-6" />
 </div>
 <p className="text-sm font-semibold text-gray-500 mb-1">No active waiters found</p>
 <p className="text-xs text-gray-400">Add waiter accounts in User Management to enable distribution.</p>
 </div>
 ) : (
 <div className="p-5">
 {/* Summary bar */}
 <div className="flex flex-wrap items-center gap-4 mb-5 p-4 rounded-xl" style={{ background: TEAL + '08', border: `1px solid ${TEAL}20` }}>
 <div className="flex items-center gap-2">
 <DivideSquare className="w-4 h-4" style={{ color: TEAL }} />
 <span className="text-sm font-semibold" style={{ color: TEAL }}>
 {fmt(distribution.totalServiceCharge)} ÷ {distribution.waiterCount} waiters
 </span>
 </div>
 <span className="text-gray-300">•</span>
 <span className="text-sm font-bold text-gray-800">
 Each waiter gets: <span style={{ color: TEAL }}>{fmt(distribution.sharePerWaiter)}</span>
 </span>
 <span className="text-gray-300">•</span>
 <span className="text-xs text-gray-500">
 from {distribution.totalOrders} paid order{distribution.totalOrders !== 1 ? 's' : ''} 
 {' '}({distribution.period !== 'all-time' ? `in ${distribution.period}` : 'all time'})
 </span>
 </div>

 {/* Waiter cards */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
 {(distribution.waiters || []).map((w, i) => (
 <div
 key={w.id}
 className="rounded-xl p-4 border transition hover:shadow-md"
 style={{ borderColor: TEAL + '25', background: `linear-gradient(135deg, ${TEAL}08, ${TEAL}04)` }}
 >
 {/* Avatar */}
 <div
 className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base mb-3"
 style={{ background: `hsl(${(i * 47 + 158) % 360}, 55%, 42%)` }}
 >
 {(w.name || w.username || '?')[0].toUpperCase()}
 </div>
 <p className="text-sm font-bold text-gray-800 truncate mb-0.5">{w.name || w.username}</p>
 <p className="text-[10px] text-gray-400 truncate mb-2">{w.email || 'Waiter'}</p>
 <div className="flex items-center justify-between">
 <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Share</span>
 <span className="text-sm font-extrabold" style={{ color: TEAL }}>{fmt(w.share)}</span>
 </div>
 </div>
 ))}
 </div>

 <p className="mt-4 text-[11px] text-gray-400 text-center">
 💡 This share is automatically added to each waiter's <strong>tips_shared</strong> when payroll is generated for this period.
 </p>
 </div>
 )}
 </div>
 </div>
 );
};

export default ServiceChargeLedger;
