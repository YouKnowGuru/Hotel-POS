import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  Receipt,
  Filter,
  ChevronDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  BadgePercent,
  Package,
  Layers,
  Scale,
  ShoppingBag,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  X,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import ExcelJS from 'exceljs';
import useCurrency from '../hooks/useCurrency';
import { loadRestaurantInfo } from '../utils/receiptPrint';

/* ─── helpers ────────────────────────────────────────────────────────── */

const isOrderPaid = (o) => {
  const s = String(o?.status || '').toLowerCase();
  const b = String(o?.bill_status || '').toLowerCase();
  return s === 'completed' || s === 'paid' || b === 'paid' || !!o?.paid_at;
};

const getOrderDate = (o) =>
  new Date(o.paid_at || o.delivered_at || o.updated_at || o.timestamp);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const monthKey  = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const monthLabel = (key) => {
  if (!key) return '-';
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`;
};

const guessCategory = (name = '') => {
  const n = String(name || '').toLowerCase();
  if (/rice|wheat|flour|atta|maida|grain/.test(n)) return 'Grains';
  if (/chicken|mutton|beef|lamb|fish|prawn|seafood|meat/.test(n)) return 'Meat';
  if (/milk|paneer|cheese|curd|yog|dairy|butter|ghee/.test(n)) return 'Dairy';
  if (/oil|ghee/.test(n)) return 'Oils';
  if (/onion|tomato|potato|veg|spinach|capsicum/.test(n)) return 'Vegetables';
  if (/salt|sugar|spice|masala|chili|pepper/.test(n)) return 'Spices';
  return 'Other';
};

/**
 * Use order.total (the actual paid grand total) as source of truth.
 * GST = total - subtotal, where subtotal = total / (1 + taxPct/100).
 */
const calcGST = (order, taxPercent) => {
  const paidTotal = Number(order.total) || 0;
  const tPct = Number(taxPercent) || 0;

  if (paidTotal > 0 && tPct > 0) {
    const subtotal = paidTotal / (1 + tPct / 100);
    const gst      = paidTotal - subtotal;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      gst:      Math.round(gst      * 100) / 100,
      total:    Math.round(paidTotal * 100) / 100,
    };
  }

  const subtotal = (order.items || []).reduce(
    (s, it) => s + (Number(it.price) || 0) * (it.quantity || it.qty || 1),
    0
  );
  const gst   = subtotal * (tPct / 100);
  const total = subtotal + gst;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst:      Math.round(gst      * 100) / 100,
    total:    Math.round(total    * 100) / 100,
  };
};

/** Build a compact comma-separated list of ordered items */
const getItemNames = (order) => {
  const items = order.items || [];
  if (items.length === 0) return '-';
  const grouped = {};
  items.forEach((it) => {
    const name = it.name || 'Item';
    const qty  = it.quantity || it.qty || 1;
    grouped[name] = (grouped[name] || 0) + qty;
  });
  return Object.entries(grouped)
    .map(([name, qty]) => (qty > 1 ? `${qty}× ${name}` : name))
    .join(', ');
};

/* ─── stat card ──────────────────────────────────────────────────────── */

const StatCard = ({ icon: Icon, label, value, sub, color, badge }) => (
  <div className="rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition hover:shadow-md bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 shadow-sm backdrop-blur-sm">
    <div
      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
      style={{ background: color + '15', border: `1px solid ${color}30` }}
    >
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-400 truncate">
          {label}
        </p>
        {badge && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: color + '15', color }}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-gray-800 dark:text-white mt-0.5 truncate">
        {value}
      </p>
      {sub && <p className="text-[11px] sm:text-xs text-gray-400 dark:text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

/* ─── main component ─────────────────────────────────────────────────── */

const GSTLedger = ({ locationSettings }) => {
  const { format: fmt, symbol: currSymbol } = useCurrency(locationSettings);

  const [orders,       setOrders]       = useState([]);
  const [inventory,    setInventory]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [invLoading,   setInvLoading]   = useState(false);
  const [error,        setError]        = useState(null);
  const [taxPercent,   setTaxPercent]   = useState(5);

  /* navigation tabs: 'overview' | 'output' | 'input' */
  const [activeTab,    setActiveTab]    = useState('overview');

  /* filters for orders */
  const [selectedYear,  setSelectedYear]  = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [orderType,     setOrderType]     = useState('all');

  /* filters for inventory */
  const [invSearch,        setInvSearch]        = useState('');
  const [invCategoryFilter, setInvCategoryFilter] = useState('all');
  const [invRateFilter,     setInvRateFilter]     = useState('all');

  /* ── load settings ─────────────────────────────────────────────── */
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

  /* ── fetch paid orders ─────────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await authFetch('/api/orders');
      const data = await res.json();
      const all  = Array.isArray(data) ? data : [];
      setOrders(all.filter(isOrderPaid));
    } catch (e) {
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── fetch inventory (GST Input) ───────────────────────────────── */
  const fetchInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const res  = await authFetch('/api/inventory');
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load inventory for GST Ledger:', e);
    } finally {
      setInvLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchInventory();
  }, [fetchOrders, fetchInventory]);

  useEffect(() => {
    loadSettings();
    refreshAll();
  }, [loadSettings, refreshAll]);

  /* ── derived orders data (GST Output) ─────────────────────────── */
  const enrichedOrders = useMemo(() =>
    orders.map((o) => {
      const date   = getOrderDate(o);
      const totals = calcGST(o, taxPercent);
      const items  = getItemNames(o);
      return { ...o, _date: date, _monthKey: monthKey(date), _items: items, ...totals };
    }),
    [orders, taxPercent]
  );

  const availableYears = useMemo(() => {
    return [...new Set(enrichedOrders.map((o) => o._date.getFullYear()))].sort((a,b) => b-a);
  }, [enrichedOrders]);

  const availableMonths = useMemo(() => {
    const set = new Set(
      enrichedOrders
        .filter((o) => selectedYear === 'all' || o._date.getFullYear() === Number(selectedYear))
        .map((o) => o._monthKey)
    );
    return [...set].sort().reverse();
  }, [enrichedOrders, selectedYear]);

  const filteredOrders = useMemo(() =>
    enrichedOrders.filter((o) => {
      if (selectedYear  !== 'all' && o._date.getFullYear() !== Number(selectedYear)) return false;
      if (selectedMonth !== 'all' && o._monthKey !== selectedMonth)                  return false;
      if (orderType !== 'all') {
        const t = String(o.type || '').toUpperCase();
        if (orderType === 'dine-in'  && t === 'TAKEAWAY') return false;
        if (orderType === 'takeaway' && t !== 'TAKEAWAY') return false;
      }
      return true;
    }),
    [enrichedOrders, selectedYear, selectedMonth, orderType]
  );

  /* monthly rollup for output GST */
  const monthSummaries = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      if (!map[o._monthKey]) map[o._monthKey] = { orders: 0, subtotal: 0, gst: 0, total: 0 };
      map[o._monthKey].orders   += 1;
      map[o._monthKey].subtotal += o.subtotal;
      map[o._monthKey].gst      += o.gst;
      map[o._monthKey].total    += o.total;
    });
    return Object.entries(map)
      .sort((a,b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({ key, label: monthLabel(key), ...v }));
  }, [filteredOrders]);

  const totalSalesSubtotal = filteredOrders.reduce((s, o) => s + o.subtotal, 0);
  const totalGSTOutput     = filteredOrders.reduce((s, o) => s + o.gst,      0);
  const totalSalesRevenue  = filteredOrders.reduce((s, o) => s + o.total,    0);

  /* ── derived inventory data (GST Input) ────────────────────────── */
  const enrichedInventory = useMemo(() =>
    inventory.map((item) => {
      const name = item.material_name || item.name || '';
      const stock = Number(item.current_stock ?? item.currentStock) || 0;
      const minStock = Number(item.min_stock ?? item.minStock) || 0;
      const purchasePrice = Number(item.purchase_price) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const gstRate = Number(item.gst_rate) || 0;
      const unit = item.unit || 'kg';
      const supplier = item.supplier || '-';
      const lastPurchaseDate = item.last_purchase_date || '-';
      const category = guessCategory(name);

      const purchaseCost = stock * purchasePrice;
      const gstInput = (purchaseCost * gstRate) / 100;
      const gstPerUnit = (purchasePrice * gstRate) / 100;

      return {
        ...item,
        _name: name,
        _stock: stock,
        _minStock: minStock,
        _purchasePrice: purchasePrice,
        _unitPrice: unitPrice,
        _gstRate: gstRate,
        _unit: unit,
        _supplier: supplier,
        _lastPurchaseDate: lastPurchaseDate,
        _category: category,
        _purchaseCost: Math.round(purchaseCost * 100) / 100,
        _gstInput: Math.round(gstInput * 100) / 100,
        _gstPerUnit: Math.round(gstPerUnit * 100) / 100,
      };
    }),
    [inventory]
  );

  const inventoryCategories = useMemo(() => {
    return [...new Set(enrichedInventory.map((i) => i._category))].sort();
  }, [enrichedInventory]);

  const inventoryGstRates = useMemo(() => {
    return [...new Set(enrichedInventory.map((i) => i._gstRate))].sort((a,b) => a-b);
  }, [enrichedInventory]);

  const filteredInventory = useMemo(() =>
    enrichedInventory.filter((item) => {
      if (invCategoryFilter !== 'all' && item._category !== invCategoryFilter) return false;
      if (invRateFilter !== 'all' && String(item._gstRate) !== String(invRateFilter)) return false;
      if (invSearch.trim()) {
        const q = invSearch.toLowerCase();
        return (
          item._name.toLowerCase().includes(q) ||
          item._supplier.toLowerCase().includes(q) ||
          item._category.toLowerCase().includes(q)
        );
      }
      return true;
    }),
    [enrichedInventory, invCategoryFilter, invRateFilter, invSearch]
  );

  const totalInventoryPurchaseCost = enrichedInventory.reduce((s, i) => s + i._purchaseCost, 0);
  const totalGSTInput = enrichedInventory.reduce((s, i) => s + i._gstInput, 0);
  const itemsWithGstInput = enrichedInventory.filter((i) => i._gstRate > 0).length;

  /* ── Rate-wise ITC summary ─────────────────────────────────────── */
  const rateWiseITC = useMemo(() => {
    const map = {};
    enrichedInventory.forEach((item) => {
      const r = item._gstRate;
      if (!map[r]) map[r] = { rate: r, count: 0, cost: 0, itc: 0 };
      map[r].count += 1;
      map[r].cost  += item._purchaseCost;
      map[r].itc   += item._gstInput;
    });
    return Object.values(map).sort((a,b) => a.rate - b.rate);
  }, [enrichedInventory]);

  /* ── Net GST Position ──────────────────────────────────────────── */
  const netGSTPayable = totalGSTOutput - totalGSTInput;
  const isNetPayable = netGSTPayable >= 0;
  const itcCoverageRatio =
    totalGSTOutput > 0 ? Math.min(100, Math.round((totalGSTInput / totalGSTOutput) * 100)) : 0;

  /* ── 1. Export Excel (.xlsx) ───────────────────────────────────── */
  const handleExportExcel = async () => {
    const info = loadRestaurantInfo();
    const cur = currSymbol || 'Nu.';
    const rangeLabel =
      selectedMonth !== 'all' ? monthLabel(selectedMonth) :
      selectedYear  !== 'all' ? String(selectedYear)      : 'All Time';
    const cleanPeriod = String(rangeLabel).replace(/[^a-zA-Z0-9_-]/g, '_');
    const nowStr = new Date().toLocaleString('en-IN');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = info.name || 'Restaurant POS';
    workbook.created = new Date();

    const NAVY_DARK   = 'FF0F2045';
    const NAVY_MID    = 'FF1E293B';
    const SLATE_BG    = 'FFF8FAFC';
    const WHITE       = 'FFFFFFFF';
    const BORDER_CLR  = 'FFE2E8F0';
    const GREEN_BG    = 'FFF0FDF4';
    const GREEN_TXT   = 'FF15803D';
    const VIOLET_BG   = 'FFF5F3FF';
    const VIOLET_TXT  = 'FF6D28D9';
    const AMBER_BG    = 'FFFFFBEB';

    const thinBorder = {
      top: { style: 'thin', color: { argb: BORDER_CLR } },
      left: { style: 'thin', color: { argb: BORDER_CLR } },
      bottom: { style: 'thin', color: { argb: BORDER_CLR } },
      right: { style: 'thin', color: { argb: BORDER_CLR } },
    };

    const doubleBottomBorder = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: BORDER_CLR } },
      bottom: { style: 'double', color: { argb: NAVY_DARK } },
      right: { style: 'thin', color: { argb: BORDER_CLR } },
    };

    // SHEET 1: GST Reconciliation & Net Position Summary
    const wsSummary = workbook.addWorksheet('GST Net Summary');
    wsSummary.mergeCells('A1:F1');
    const sumTitle = wsSummary.getCell('A1');
    sumTitle.value = `${(info.name || 'RESTAURANT POS').toUpperCase()} — GST RECONCILIATION & NET SETTLEMENT`;
    sumTitle.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: WHITE } };
    sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
    sumTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(1).height = 34;

    wsSummary.mergeCells('A2:F2');
    const sumMeta = wsSummary.getCell('A2');
    sumMeta.value = `Period: ${rangeLabel}   |   Sales Tax Rate: ${taxPercent}%   |   GSTIN/TPN: ${info.bstNo || 'N/A'}   |   Generated: ${nowStr}`;
    sumMeta.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FFCBD5E1' } };
    sumMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_MID } };
    sumMeta.alignment = { vertical: 'middle', horizontal: 'center' };
    wsSummary.getRow(2).height = 20;

    const sHeaders = ['Particulars', 'Amount / Value', 'Tax Rate', 'Tax Amount', 'Tax Nature', 'Accounting Treatment'];
    const sHRow = wsSummary.getRow(4);
    sHRow.values = sHeaders;
    sHRow.height = 26;
    sHRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const reconciliationRows = [
      ['A. GST Output (Sales)', totalSalesSubtotal, `${taxPercent}%`, totalGSTOutput, 'Output Tax Liability', 'Collected from customer orders'],
      ['B. GST Input (Purchases & Inventory)', totalInventoryPurchaseCost, 'Varies (0-18%)', totalGSTInput, 'Input Tax Credit (ITC)', 'Paid to suppliers on raw materials'],
      [
        isNetPayable ? 'C. Net GST Payable to Authority (A - B)' : 'C. Net ITC Credit Carried Forward (B - A)',
        Math.abs(totalSalesSubtotal - totalInventoryPurchaseCost),
        '-',
        Math.abs(netGSTPayable),
        isNetPayable ? 'Net Tax Payable (Liability)' : 'Net Tax Credit (Asset)',
        isNetPayable ? 'Pay to tax department' : 'Eligible for set-off in next period',
      ],
    ];

    reconciliationRows.forEach((r, idx) => {
      const row = wsSummary.getRow(idx + 5);
      row.values = [r[0], Number(r[1].toFixed(2)), r[2], Number(r[3].toFixed(2)), r[4], r[5]];
      row.height = 24;
      const isNet = idx === 2;
      row.eachCell((cell, colNum) => {
        cell.font = {
          name: 'Segoe UI',
          size: 9.5,
          bold: isNet || colNum === 1 || colNum === 4,
          color: isNet ? { argb: isNetPayable ? 'FFB91C1C' : GREEN_TXT } : { argb: 'FF1E293B' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isNet ? (isNetPayable ? AMBER_BG : GREEN_BG) : (idx % 2 === 0 ? WHITE : SLATE_BG) },
        };
        cell.border = isNet ? doubleBottomBorder : thinBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 2 || colNum === 4 ? 'right' : (colNum === 3 ? 'center' : 'left'),
        };
        if (colNum === 2 || colNum === 4) cell.numFmt = '#,##0.00';
      });
    });

    [36, 22, 16, 22, 22, 32].forEach((w, i) => {
      wsSummary.getColumn(i + 1).width = w;
    });

    // SHEET 2: GST Output
    const wsOrders = workbook.addWorksheet('GST Output (Sales)', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });
    wsOrders.mergeCells('A1:K1');
    const titleCell = wsOrders.getCell('A1');
    titleCell.value = `${(info.name || 'RESTAURANT POS').toUpperCase()} — GST OUTPUT (SALES LEDGER)`;
    titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: WHITE } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    wsOrders.getRow(1).height = 34;

    const orderHeaders = [
      'Order #', 'Date', 'Time', 'Order Type', 'Table / Token', 'Payment Method',
      'Items Ordered', `Taxable Subtotal (${cur})`, 'GST Rate', `GST Output (${cur})`, `Grand Total (${cur})`
    ];
    const oHRow = wsOrders.getRow(5);
    oHRow.values = orderHeaders;
    oHRow.height = 26;
    oHRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_DARK } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 8 && colNum !== 9 ? 'right' : 'center' };
    });

    let oRowIdx = 6;
    filteredOrders.forEach((o, idx) => {
      const row = wsOrders.getRow(oRowIdx);
      const isEven = idx % 2 === 0;
      const isTakeaway = String(o.type || '').toUpperCase() === 'TAKEAWAY';
      row.values = [
        `#${o.id}`,
        o._date.toLocaleDateString('en-IN'),
        o._date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        isTakeaway ? 'Takeaway' : 'Dine-In',
        o.table_name || o.token || '-',
        o.payment_method || '-',
        o._items,
        Number(o.subtotal.toFixed(2)),
        `${taxPercent}%`,
        Number(o.gst.toFixed(2)),
        Number(o.total.toFixed(2)),
      ];
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? WHITE : SLATE_BG } };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: colNum >= 8 && colNum !== 9 ? 'right' : 'center' };
        if (colNum === 8 || colNum === 10 || colNum === 11) cell.numFmt = '#,##0.00';
      });
      oRowIdx++;
    });

    [12, 13, 11, 14, 15, 17, 36, 18, 12, 18, 18].forEach((w, i) => {
      wsOrders.getColumn(i + 1).width = w;
    });

    // SHEET 3: GST Input
    const wsInput = workbook.addWorksheet('GST Input (Purchases)', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });
    wsInput.mergeCells('A1:J1');
    const inTitle = wsInput.getCell('A1');
    inTitle.value = `${(info.name || 'RESTAURANT POS').toUpperCase()} — GST INPUT TAX CREDIT (PURCHASES LEDGER)`;
    inTitle.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: WHITE } };
    inTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } };
    inTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    wsInput.getRow(1).height = 34;

    const inHeaders = [
      'Material Name', 'Category', 'Supplier Name', 'Stock on Hand', 'Unit',
      `Purchase Price (${cur})`, 'GST Input Rate', `Tax Paid/Unit (${cur})`,
      `Total Cost (${cur})`, `Input GST Credit (${cur})`
    ];
    const inHRow = wsInput.getRow(5);
    inHRow.values = inHeaders;
    inHRow.height = 26;
    inHRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: colNum >= 6 ? 'right' : 'center' };
    });

    let inRowIdx = 6;
    enrichedInventory.forEach((item, idx) => {
      const row = wsInput.getRow(inRowIdx);
      const isEven = idx % 2 === 0;
      row.values = [
        item._name, item._category, item._supplier, item._stock, item._unit,
        Number(item._purchasePrice.toFixed(2)), `${item._gstRate}%`,
        Number(item._gstPerUnit.toFixed(2)), Number(item._purchaseCost.toFixed(2)), Number(item._gstInput.toFixed(2)),
      ];
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Segoe UI', size: 9, color: colNum === 10 ? { argb: VIOLET_TXT } : { argb: 'FF1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? WHITE : SLATE_BG } };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: colNum >= 6 && colNum !== 7 ? 'right' : 'center' };
        if (colNum === 6 || colNum === 8 || colNum === 9 || colNum === 10) cell.numFmt = '#,##0.00';
      });
      inRowIdx++;
    });

    [26, 16, 24, 15, 10, 18, 15, 18, 20, 22].forEach((w, i) => {
      wsInput.getColumn(i + 1).width = w;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Reconciliation_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── 2. Export Orders CSV ───────────────────────────────────────── */
  const handleExportCSV = () => {
    const cur = currSymbol || 'Nu.';
    const clean = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rangeLabel =
      selectedMonth !== 'all' ? monthLabel(selectedMonth) :
      selectedYear  !== 'all' ? String(selectedYear)      : 'All Time';

    const headers = [
      'Order ID', 'Date', 'Time', 'Order Type', 'Table / Token', 'Payment Method',
      'Items Ordered', `Subtotal (${cur})`, 'GST Rate (%)', `GST Amount (${cur})`, `Total Paid (${cur})`
    ];

    const rows = filteredOrders.map((o) => {
      const isTakeaway = String(o.type || '').toUpperCase() === 'TAKEAWAY';
      return [
        clean(o.id),
        clean(o._date.toLocaleDateString('en-IN')),
        clean(o._date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })),
        clean(isTakeaway ? 'Takeaway' : 'Dine-In'),
        clean(o.table_name || o.token || '-'),
        clean(o.payment_method || '-'),
        clean(o._items),
        o.subtotal.toFixed(2),
        `${taxPercent}%`,
        o.gst.toFixed(2),
        o.total.toFixed(2),
      ];
    });

    const totalRow = [
      clean(`TOTAL (${filteredOrders.length} orders)`), '', '', '', '', '', '',
      totalSalesSubtotal.toFixed(2), '', totalGSTOutput.toFixed(2), totalSalesRevenue.toFixed(2)
    ];

    const csvContent = [headers.map(clean).join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanPeriod = String(rangeLabel).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `GST_Output_Sales_${cleanPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── 3. Export Monthly Summary CSV ─────────────────────────────── */
  const handleExportMonthlyCSV = () => {
    const cur = currSymbol || 'Nu.';
    const clean = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = ['Month', 'Total Orders', `Taxable Subtotal (${cur})`, `GST Output (${cur})`, `Grand Total (${cur})`];
    const rows = monthSummaries.map((m) => [
      clean(m.label), m.orders, m.subtotal.toFixed(2), m.gst.toFixed(2), m.total.toFixed(2)
    ]);
    const totalRow = [
      clean('GRAND TOTAL'), filteredOrders.length, totalSalesSubtotal.toFixed(2), totalGSTOutput.toFixed(2), totalSalesRevenue.toFixed(2)
    ];

    const csvContent = [headers.map(clean).join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Monthly_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── 4. Export Inventory Input GST CSV ─────────────────────────── */
  const handleExportInventoryCSV = () => {
    const cur = currSymbol || 'Nu.';
    const clean = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Material Name', 'Category', 'Supplier', 'Stock on Hand', 'Unit',
      `Purchase Price (${cur})`, 'GST Input Rate (%)', `GST per Unit (${cur})`,
      `Total Purchase Value (${cur})`, `Claimable Input GST (${cur})`, 'Last Purchase Date'
    ];

    const rows = filteredInventory.map((i) => [
      clean(i._name),
      clean(i._category),
      clean(i._supplier),
      i._stock,
      clean(i._unit),
      i._purchasePrice.toFixed(2),
      i._gstRate,
      i._gstPerUnit.toFixed(2),
      i._purchaseCost.toFixed(2),
      i._gstInput.toFixed(2),
      clean(i._lastPurchaseDate),
    ]);

    const totalRow = [
      clean(`TOTAL (${filteredInventory.length} materials)`), '', '', '', '', '', '', '',
      totalInventoryPurchaseCost.toFixed(2), totalGSTInput.toFixed(2), ''
    ];

    const csvContent = [headers.map(clean).join(','), ...rows.map((r) => r.join(',')), totalRow.join(',')].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Input_Inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── 5. Print Executive Report ─────────────────────────────────── */
  const handlePrint = () => {
    const info = loadRestaurantInfo();
    const cur = currSymbol || 'Nu.';
    const rangeLabel =
      selectedMonth !== 'all' ? monthLabel(selectedMonth) :
      selectedYear  !== 'all' ? String(selectedYear)      : 'All Time';

    const orderRows = filteredOrders.slice(0, 50).map((o, i) => `
      <tr style="background:${i%2===0?'#fff':'#F8FAFC'}">
        <td>#${o.id}</td>
        <td>${o._date.toLocaleDateString('en-IN')}<br><small>${o._date.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></td>
        <td>${String(o.type||'').toUpperCase()==='TAKEAWAY'?'Takeaway':'Dine-In'}</td>
        <td>${o.table_name||o.token||'-'}</td>
        <td>${o.payment_method||'-'}</td>
        <td style="font-size:11px;color:#475569">${o._items}</td>
        <td style="text-align:right">${cur} ${o.subtotal.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:#16A34A">${cur} ${o.gst.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700">${cur} ${o.total.toFixed(2)}</td>
      </tr>`).join('');

    const monthRows = monthSummaries.map((m) => `
      <tr>
        <td colspan="3"><b>${m.label}</b></td>
        <td style="text-align:center">${m.orders}</td>
        <td style="text-align:right">${cur} ${m.subtotal.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:#16A34A">${cur} ${m.gst.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700">${cur} ${m.total.toFixed(2)}</td>
      </tr>`).join('');

    const invRows = enrichedInventory.map((it, idx) => `
      <tr style="background:${idx%2===0?'#fff':'#F8FAFC'}">
        <td><b>${it._name}</b><br><small style="color:#64748B">${it._category}</small></td>
        <td>${it._supplier}</td>
        <td style="text-align:center">${it._stock} ${it._unit}</td>
        <td style="text-align:right">${cur} ${it._purchasePrice.toFixed(2)}</td>
        <td style="text-align:center;font-weight:600">${it._gstRate}%</td>
        <td style="text-align:right">${cur} ${it._purchaseCost.toFixed(2)}</td>
        <td style="text-align:right;font-weight:700;color:#7C3AED">${cur} ${it._gstInput.toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GST Tax Settlement Report — ${rangeLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#1e293b;padding:26px}
    h1{font-size:22px;font-weight:800;color:#0F2045;margin-bottom:2px}
    .meta{color:#64748b;font-size:11px;margin-bottom:16px}
    .settlement-box{background:#F8FAFC;border:2px solid #E2E8F0;border-radius:12px;padding:14px;margin-bottom:20px}
    .settlement-title{font-size:12px;font-weight:700;text-transform:uppercase;color:#0F2045;margin-bottom:10px}
    .settlement-grid{display:flex;gap:12px}
    .settlement-card{flex:1;border:1px solid #CBD5E1;border-radius:8px;padding:10px 12px;background:white}
    .settlement-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748B;margin-bottom:3px}
    .settlement-val{font-size:16px;font-weight:800;color:#0F2045}
    .green{color:#16A34A}
    .violet{color:#7C3AED}
    .amber{color:#B45309}
    h2{font-size:13px;font-weight:700;color:#0F2045;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #E2E8F0}
    table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
    thead tr{background:#0F2045}
    thead th{color:#E2E8F0;padding:7px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.04em}
    tbody tr:hover{background:#F0FDF4}
    td{padding:6px 10px;border-bottom:1px solid #F1F5F9}
    tfoot tr{background:#F8FAFC;border-top:2px solid #CBD5E1}
    tfoot td{font-weight:800;padding:7px 10px}
    .footer{margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px dashed #E2E8F0;padding-top:8px;text-align:center}
    @media print{body{padding:12px}}
  </style>
</head>
<body>
  <h1>${info.name} — GST Tax Settlement Report</h1>
  <div class="meta">
    Period: <b>${rangeLabel}</b> &nbsp;|&nbsp; Sales GST Rate: <b>${taxPercent}%</b>
    &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}
    ${info.bstNo ? `&nbsp;|&nbsp; GSTIN/TPN: <b>${info.bstNo}</b>` : ''}
  </div>

  <div class="settlement-box">
    <div class="settlement-title">Tax Reconciliation &amp; Net Tax Position</div>
    <div class="settlement-grid">
      <div class="settlement-card">
        <div class="settlement-label">1. GST Output (Sales)</div>
        <div class="settlement-val green">${cur} ${totalGSTOutput.toFixed(2)}</div>
        <small style="color:#64748B">Collected from ${filteredOrders.length} orders</small>
      </div>
      <div class="settlement-card">
        <div class="settlement-label">2. GST Input / ITC (Purchases)</div>
        <div class="settlement-val violet">${cur} ${totalGSTInput.toFixed(2)}</div>
        <small style="color:#64748B">Paid on ${enrichedInventory.length} materials</small>
      </div>
      <div class="settlement-card" style="border-color:${isNetPayable ? '#FDE68A' : '#BBF7D0'};background:${isNetPayable ? '#FFFBEB' : '#F0FDF4'}">
        <div class="settlement-label" style="font-weight:700;color:${isNetPayable ? '#B45309' : '#15803D'}">
          ${isNetPayable ? 'Net GST Payable to Authority' : 'Net ITC Credit Available'}
        </div>
        <div class="settlement-val ${isNetPayable ? 'amber' : 'green'}">${cur} ${Math.abs(netGSTPayable).toFixed(2)}</div>
      </div>
    </div>
  </div>

  <h2>Monthly Sales GST Summary</h2>
  <table>
    <thead><tr>
      <th colspan="3">Month</th><th style="text-align:center">Orders</th>
      <th>Subtotal</th><th>GST Output</th><th>Total Revenue</th>
    </tr></thead>
    <tbody>${monthRows}</tbody>
    <tfoot><tr>
      <td colspan="3">TOTAL SALES</td>
      <td style="text-align:center">${filteredOrders.length}</td>
      <td>${cur} ${totalSalesSubtotal.toFixed(2)}</td>
      <td style="color:#16A34A">${cur} ${totalGSTOutput.toFixed(2)}</td>
      <td>${cur} ${totalSalesRevenue.toFixed(2)}</td>
    </tr></tfoot>
  </table>

  <h2>GST Input (Purchases &amp; Inventory Stock)</h2>
  <table>
    <thead><tr>
      <th>Material Name</th><th>Supplier</th><th style="text-align:center">Stock</th>
      <th>Purchase Price</th><th style="text-align:center">GST Rate</th>
      <th>Total Cost</th><th>Input Tax Credit (ITC)</th>
    </tr></thead>
    <tbody>${invRows}</tbody>
    <tfoot><tr>
      <td colspan="5">TOTAL INVENTORY INPUT TAX CREDIT</td>
      <td>${cur} ${totalInventoryPurchaseCost.toFixed(2)}</td>
      <td style="color:#7C3AED">${cur} ${totalGSTInput.toFixed(2)}</td>
    </tr></tfoot>
  </table>

  <h2>Order-wise GST Collection (Sample 50 records)</h2>
  <table>
    <thead><tr>
      <th>Order</th><th>Date</th><th>Type</th><th>Table/Token</th>
      <th>Payment</th><th>Items</th><th>Subtotal</th><th>GST Output</th><th>Total</th>
    </tr></thead>
    <tbody>${orderRows}</tbody>
  </table>

  <div class="footer">Computer-generated GST reconciliation report — Official restaurant tax record.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1000,height=760');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* ── render ──────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] p-4 sm:p-6 lg:p-8 text-gray-800 dark:text-slate-100 transition-colors duration-200">

      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 shadow-sm">
                <BadgePercent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                GST Accounting &amp; Ledger
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 ml-1">
              Sales GST Output, Inventory Input Tax Credit (ITC), and Net Tax Reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={refreshAll}
              title="Refresh All Data"
              className="p-2 sm:p-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loading || invLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="gst-export-excel"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm hover:shadow-md transition active:scale-95"
              title="Download comprehensive multi-sheet Excel file (.xlsx)"
            >
              <Download className="w-4 h-4" /> Export Excel (.xlsx)
            </button>
            <button
              id="gst-export-csv"
              onClick={activeTab === 'input' ? handleExportInventoryCSV : handleExportCSV}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 transition shadow-sm active:scale-95"
              title="Download CSV"
            >
              <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {activeTab === 'input' ? 'Export Input CSV' : 'Export Sales CSV'}
            </button>
            <button
              id="gst-print-report"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#0F2045] hover:bg-[#1E3A8A] text-white shadow-sm hover:shadow-md transition active:scale-95 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Printer className="w-4 h-4" /> Print Tax Report
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-slate-700/80 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
          }`}
        >
          <Scale className="w-4 h-4" />
          Overview &amp; Net Tax
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            activeTab === 'overview' ? 'bg-blue-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
          }`}>
            Reconciliation
          </span>
        </button>

        <button
          onClick={() => setActiveTab('output')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'output'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          GST Output (Sales)
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            activeTab === 'output' ? 'bg-emerald-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
          }`}>
            {filteredOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'input'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
          }`}
        >
          <Boxes className="w-4 h-4" />
          GST Input (Purchases &amp; Stock)
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            activeTab === 'input' ? 'bg-violet-700 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
          }`}>
            {enrichedInventory.length}
          </span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={refreshAll} className="ml-auto underline font-semibold text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-slate-700 border-t-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400 dark:text-slate-400 text-sm font-medium">Loading GST accounting data…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW & NET TAX POSITION                        */}
          {/* ========================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4 Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <StatCard
                  icon={ArrowUpRight}
                  label="GST Output (Sales Tax)"
                  value={fmt(totalGSTOutput)}
                  sub={`From ${filteredOrders.length} completed orders`}
                  color="#10B981"
                  badge={`${taxPercent}% GST`}
                />
                <StatCard
                  icon={ArrowDownRight}
                  label="GST Input (Purchase ITC)"
                  value={fmt(totalGSTInput)}
                  sub={`From ${itemsWithGstInput} inventory materials`}
                  color="#8B5CF6"
                  badge="Input Tax Credit"
                />
                <StatCard
                  icon={Scale}
                  label={isNetPayable ? 'Net GST Payable' : 'Net Tax Credit'}
                  value={fmt(Math.abs(netGSTPayable))}
                  sub={isNetPayable ? 'Payable to Government' : 'Eligible for set-off'}
                  color={isNetPayable ? '#F59E0B' : '#10B981'}
                  badge={isNetPayable ? 'Tax Liability' : 'Credit Carry Forward'}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Gross Sales Turnover"
                  value={fmt(totalSalesRevenue)}
                  sub={`Taxable Subtotal: ${fmt(totalSalesSubtotal)}`}
                  color="#3B82F6"
                  badge="Turnover"
                />
              </div>

              {/* Visual Net Reconciliation Card */}
              <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      GST Net Settlement Calculation
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                      Net Tax Payable = Output GST (Collected from Customers) − Input GST (Paid to Suppliers on Materials)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">ITC Offset Coverage:</span>
                    <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60">
                      {itcCoverageRatio}% Covered
                    </span>
                  </div>
                </div>

                {/* Formula Breakdown Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch bg-gray-50/80 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-700/60">
                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        1. GST Output (Collected)
                      </p>
                      <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                        {fmt(totalGSTOutput)}
                      </p>
                    </div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      From {filteredOrders.length} completed orders
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-violet-50/70 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-800/50 flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        2. Less: GST Input (ITC Claimed)
                      </p>
                      <p className="text-2xl font-extrabold text-violet-800 dark:text-violet-200 mt-1">
                        {fmt(totalGSTInput)}
                      </p>
                    </div>
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-2">
                      From inventory purchases &amp; stock
                    </p>
                  </div>

                  <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isNetPayable
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50'
                  }`}>
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${
                        isNetPayable ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                      }`}>
                        3. {isNetPayable ? '= Net Tax Payable to Govt' : '= Net ITC Refund / Carry Forward'}
                      </p>
                      <p className={`text-2xl font-extrabold mt-1 ${
                        isNetPayable ? 'text-amber-900 dark:text-amber-100' : 'text-emerald-900 dark:text-emerald-100'
                      }`}>
                        {fmt(Math.abs(netGSTPayable))}
                      </p>
                    </div>
                    <p className={`text-xs mt-2 font-medium ${
                      isNetPayable ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {isNetPayable ? 'Tax due for remittance' : 'Credit available to offset future sales tax'}
                    </p>
                  </div>
                </div>

                {/* Offset Progress Bar */}
                <div className="mt-5">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                    <span>Input Tax Credit Applied: {fmt(totalGSTInput)}</span>
                    <span>Total Output Liability: {fmt(totalGSTOutput)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden flex">
                    <div
                      className="bg-violet-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, itcCoverageRatio)}%` }}
                    />
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${Math.max(0, 100 - itcCoverageRatio)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                      <span>Input Tax Credit (ITC Paid)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Net Tax Payable</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate-Wise ITC Slab Table & Quick Jump Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Slab Table */}
                <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                        Input Tax Credit (ITC) by GST Slab
                      </h3>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-400">Inventory Purchases</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900/60 text-gray-500 dark:text-slate-400 text-xs font-semibold uppercase">
                          <th className="px-5 py-3 text-left">GST Rate Slab</th>
                          <th className="px-5 py-3 text-center">Items Count</th>
                          <th className="px-5 py-3 text-right">Purchase Value</th>
                          <th className="px-5 py-3 text-right">ITC Claim Amount</th>
                          <th className="px-5 py-3 text-center">Eligibility</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                        {rateWiseITC.map((slab) => (
                          <tr key={slab.rate} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/30 transition">
                            <td className="px-5 py-3 font-bold text-gray-800 dark:text-slate-100">
                              <span className="inline-block px-2.5 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-bold text-xs border border-violet-200 dark:border-violet-800/60">
                                {slab.rate}% GST
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center text-gray-600 dark:text-slate-300">
                              {slab.count} materials
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-gray-700 dark:text-slate-200">
                              {fmt(slab.cost)}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-violet-600 dark:text-violet-400">
                              {fmt(slab.itc)}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                slab.rate > 0
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                              }`}>
                                {slab.rate > 0 ? 'Eligible ITC' : 'Exempt / 0%'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-violet-50/60 dark:bg-slate-900 font-bold border-t border-violet-200 dark:border-slate-700 text-gray-800 dark:text-white">
                          <td className="px-5 py-3.5">Total ITC Pool</td>
                          <td className="px-5 py-3.5 text-center">{enrichedInventory.length} materials</td>
                          <td className="px-5 py-3.5 text-right">{fmt(totalInventoryPurchaseCost)}</td>
                          <td className="px-5 py-3.5 text-right text-violet-700 dark:text-violet-300 text-base">
                            {fmt(totalGSTInput)}
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs text-violet-700 dark:text-violet-300">
                            Claimable ITC
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Quick Drill-down Cards */}
                <div className="space-y-4">
                  <div
                    onClick={() => setActiveTab('output')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">GST Output Ledger</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Monthly collections and order-level sales tax breakdowns.
                    </p>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
                      <span className="text-gray-400 dark:text-slate-400">Total Output:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalGSTOutput)}</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTab('input')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <ArrowDownRight className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">GST Input (Inventory)</h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Raw materials, supplier purchases, and claimable Input Tax Credit (ITC).
                    </p>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
                      <span className="text-gray-400 dark:text-slate-400">Total ITC:</span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">{fmt(totalGSTInput)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: GST OUTPUT (SALES ORDERS)                          */}
          {/* ========================================================= */}
          {activeTab === 'output' && (
            <div className="space-y-6">
              {/* Filters row */}
              <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 text-sm font-semibold">
                  <Filter className="w-4 h-4" /> Filters:
                </div>

                {/* Year */}
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => { setSelectedYear(e.target.value); setSelectedMonth('all'); }}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Month */}
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Order type */}
                <div className="relative">
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="dine-in">Dine-In</option>
                    <option value="takeaway">Takeaway</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <span className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Sales GST Rate: {taxPercent}%
                </span>
              </div>

              {/* Monthly Summary Table */}
              {monthSummaries.length > 0 && (
                <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                  <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-slate-700 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h2 className="font-bold text-gray-900 dark:text-white text-sm">Monthly GST Output Summary</h2>
                    </div>
                    <button
                      onClick={handleExportMonthlyCSV}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg transition"
                      title="Export monthly summary as CSV"
                    >
                      <Download className="w-3.5 h-3.5" /> Export Monthly CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#0F2045] dark:bg-slate-900 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                          {['Month', 'Orders', 'Taxable Subtotal', `GST Output (${taxPercent}%)`, 'Grand Total'].map((h) => (
                            <th key={h} className="px-5 py-3 text-left whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                        {monthSummaries.map((m) => (
                          <tr
                            key={m.key}
                            className="bg-white dark:bg-slate-800 even:bg-slate-50/50 dark:even:bg-slate-800/50 hover:bg-emerald-50/30 dark:hover:bg-slate-700/40 transition"
                          >
                            <td className="px-5 py-3 font-semibold text-gray-800 dark:text-slate-100 whitespace-nowrap">{m.label}</td>
                            <td className="px-5 py-3 text-gray-500 dark:text-slate-400 whitespace-nowrap">{m.orders}</td>
                            <td className="px-5 py-3 text-gray-700 dark:text-slate-200 whitespace-nowrap">{fmt(m.subtotal)}</td>
                            <td className="px-5 py-3 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(m.gst)}</td>
                            <td className="px-5 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{fmt(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/80 dark:bg-slate-900 border-t-2 border-emerald-300 dark:border-emerald-800 font-bold text-gray-900 dark:text-white">
                          <td className="px-5 py-3.5">Total</td>
                          <td className="px-5 py-3.5">{filteredOrders.length}</td>
                          <td className="px-5 py-3.5">{fmt(totalSalesSubtotal)}</td>
                          <td className="px-5 py-3.5 text-emerald-700 dark:text-emerald-400 text-[15px]">{fmt(totalGSTOutput)}</td>
                          <td className="px-5 py-3.5 text-[15px]">{fmt(totalSalesRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Order-wise details table */}
              <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="font-bold text-gray-900 dark:text-white text-sm">Order-wise GST Output Details</h2>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-400">{filteredOrders.length} records</span>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="py-20 text-center">
                    <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">No paid orders found for the selected filter.</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">Try adjusting the year / month / type filter above.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900/60 border-b-2 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                          {['Order #', 'Date & Time', 'Type', 'Table / Token', 'Payment', 'Items Ordered', 'Subtotal', `GST (${taxPercent}%)`, 'Total'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                        {filteredOrders.map((o) => {
                          const isTakeaway = String(o.type || '').toUpperCase() === 'TAKEAWAY';
                          return (
                            <tr
                              key={o.id}
                              className="bg-white dark:bg-slate-800 even:bg-slate-50/40 dark:even:bg-slate-800/40 hover:bg-emerald-50/20 dark:hover:bg-slate-700/30 transition"
                            >
                              <td className="px-4 py-3 font-bold text-gray-800 dark:text-slate-100 whitespace-nowrap">#{o.id}</td>
                              <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">
                                <div>{o._date.toLocaleDateString('en-IN')}</div>
                                <div className="text-gray-400 dark:text-slate-500">
                                  {o._date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                                    isTakeaway
                                      ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                  }`}
                                >
                                  {isTakeaway ? 'Takeaway' : 'Dine-In'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-slate-200 font-medium whitespace-nowrap">
                                {o.table_name || o.token || '-'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 capitalize whitespace-nowrap">
                                {o.payment_method || '-'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300 max-w-[200px]">
                                <span title={o._items} className="block truncate">{o._items}</span>
                              </td>
                              <td className="px-4 py-3 text-gray-700 dark:text-slate-200 whitespace-nowrap">{fmt(o.subtotal)}</td>
                              <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{fmt(o.gst)}</td>
                              <td className="px-4 py-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">{fmt(o.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/80 dark:bg-slate-900 border-t-2 border-emerald-300 dark:border-emerald-800 font-bold text-gray-900 dark:text-white">
                          <td colSpan={6} className="px-4 py-3.5">
                            Total ({filteredOrders.length} orders)
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{fmt(totalSalesSubtotal)}</td>
                          <td className="px-4 py-3.5 text-emerald-700 dark:text-emerald-400 text-[15px] whitespace-nowrap">{fmt(totalGSTOutput)}</td>
                          <td className="px-4 py-3.5 text-[15px] whitespace-nowrap">{fmt(totalSalesRevenue)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: GST INPUT (PURCHASES & INVENTORY)                  */}
          {/* ========================================================= */}
          {activeTab === 'input' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                <StatCard
                  icon={Package}
                  label="Total Inventory Materials"
                  value={enrichedInventory.length}
                  sub={`${itemsWithGstInput} items have GST rate configured`}
                  color="#8B5CF6"
                />
                <StatCard
                  icon={FileText}
                  label="Total Stock Purchase Value"
                  value={fmt(totalInventoryPurchaseCost)}
                  sub="Cost basis excluding GST"
                  color="#3B82F6"
                />
                <StatCard
                  icon={BadgePercent}
                  label="Total GST Input Credit (ITC)"
                  value={fmt(totalGSTInput)}
                  sub="Claimable tax credit against sales"
                  color="#10B981"
                  badge="Claimable ITC"
                />
              </div>

              {/* Filters */}
              <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-gray-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                    placeholder="Search material or supplier..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  {invSearch && (
                    <button
                      onClick={() => setInvSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <select
                    value={invCategoryFilter}
                    onChange={(e) => setInvCategoryFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {inventoryCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    value={invRateFilter}
                    onChange={(e) => setInvRateFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
                  >
                    <option value="all">All GST Rates</option>
                    {inventoryGstRates.map((r) => <option key={r} value={r}>{r}% GST</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <button
                  onClick={handleExportInventoryCSV}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/50 hover:bg-violet-100 dark:hover:bg-violet-900/60 border border-violet-200 dark:border-violet-800 rounded-xl transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export Input CSV
                </button>
              </div>

              {/* Table */}
              <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                      Inventory Material Purchases &amp; Input Tax Credit (ITC)
                    </h2>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-400">{filteredInventory.length} materials</span>
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="py-20 text-center">
                    <Package className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400 font-medium text-sm">No inventory items found matching filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-900/60 border-b-2 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                          <th className="px-4 py-3 text-left whitespace-nowrap">Material &amp; Category</th>
                          <th className="px-4 py-3 text-left whitespace-nowrap">Supplier</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Stock on Hand</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Purchase Price</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Input GST Rate</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Tax / Unit</th>
                          <th className="px-4 py-3 text-right whitespace-nowrap">Total Purchase Cost</th>
                          <th className="px-4 py-3 text-right text-violet-600 dark:text-violet-400 whitespace-nowrap">Claimable ITC</th>
                          <th className="px-4 py-3 text-center whitespace-nowrap">Last Purchase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                        {filteredInventory.map((item) => (
                          <tr
                            key={item.id}
                            className="bg-white dark:bg-slate-800 even:bg-slate-50/40 dark:even:bg-slate-800/40 hover:bg-violet-50/20 dark:hover:bg-slate-700/30 transition"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="font-bold text-gray-800 dark:text-white">{item._name}</p>
                              <span className="text-[10px] text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {item._category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300 whitespace-nowrap">
                              {item._supplier !== '-' ? item._supplier : <span className="text-gray-300 dark:text-slate-600">Unspecified</span>}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-slate-200 whitespace-nowrap">
                              {item._stock} {item._unit}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-200 whitespace-nowrap">
                              {item._purchasePrice > 0 ? `${fmt(item._purchasePrice)}/${item._unit}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                                item._gstRate > 0
                                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                                  : 'bg-gray-100 text-gray-400 dark:bg-slate-700 dark:text-slate-400'
                              }`}>
                                {item._gstRate}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-violet-600 dark:text-violet-400 font-medium whitespace-nowrap">
                              {item._gstPerUnit > 0 ? fmt(item._gstPerUnit) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-200 font-semibold whitespace-nowrap">
                              {item._purchaseCost > 0 ? fmt(item._purchaseCost) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-violet-700 dark:text-violet-300 text-sm whitespace-nowrap">
                              {item._gstInput > 0 ? fmt(item._gstInput) : '-'}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-400 dark:text-slate-400 whitespace-nowrap">
                              {item._lastPurchaseDate}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-violet-50/80 dark:bg-slate-900 border-t-2 border-violet-300 dark:border-violet-800 font-bold text-gray-900 dark:text-white">
                          <td colSpan={6} className="px-4 py-3.5">
                            Total ({filteredInventory.length} materials)
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {fmt(filteredInventory.reduce((s, i) => s + i._purchaseCost, 0))}
                          </td>
                          <td className="px-4 py-3.5 text-right text-violet-800 dark:text-violet-300 text-[15px] whitespace-nowrap">
                            {fmt(filteredInventory.reduce((s, i) => s + i._gstInput, 0))}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GSTLedger;
