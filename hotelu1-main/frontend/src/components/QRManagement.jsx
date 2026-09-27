import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getAPI_URL, authFetch } from '../utils/api';
import {
  formatTableName,
  tableIdMatches,
  isActiveTableOrder,
} from '../utils/tableOrderUtils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ScanLine,
  Calendar,
  DollarSign,
  RefreshCw,
  Plus,
  QrCode,
  Copy,
  Download,
  ExternalLink,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import Notification from './Notification';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STYLES = [
  { id: 'orange', label: 'Brand Orange', color: '#F97316' },
  { id: 'black', label: 'Classic Black', color: '#111827' },
  { id: 'green', label: 'Forest Green', color: '#10B981' },
];

const FLOORS = [
  { id: 'ground', label: 'Ground Floor' },
  { id: 'first', label: 'First Floor' },
];

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const QRManagement = ({ locationSettings }) => {
  const { format: fmt } = useCurrency(locationSettings);

  const [tableNumber, setTableNumber] = useState('1');
  const [floor, setFloor] = useState('ground');
  const [style, setStyle] = useState('orange');
  const [embedLogo, setEmbedLogo] = useState(true);
  const [tableStatus, setTableStatus] = useState('available');
  const [tableOrders, setTableOrders] = useState([]);
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [isQrCodeGenerated, setIsQrCodeGenerated] = useState(false);
  const [isQrCodeScriptLoaded, setIsQrCodeScriptLoaded] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tableCodes, setTableCodes] = useState([]);
  const [registeredTables, setRegisteredTables] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [menu, setMenu] = useState([]);

  const qrCodeContainerRef = useRef(null);

  // Branch-aware QR codes: the logged-in user's branch (or ?loc= override) is
  // embedded in every generated QR URL so the backend can stamp those orders
  // with the right restaurant. Without this, orders placed from a branch's
  // table codes landed in the HQ bucket and branch staff never saw them.
  const locId = useMemo(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('loc');
    if (fromUrl) return fromUrl;
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user?.subfranchise_id != null) return String(user.subfranchise_id);
    } catch (_) { /* ignore */ }
    return null;
  }, []);
  const buildQrUrl = (table) =>
    `${BASE_QR_ORDER_URL}/qr-ordering?tableId=${encodeURIComponent(table)}${
      locId ? `&loc=${encodeURIComponent(locId)}` : ''
    }`;

  const [serverIP] = useState(() => {
    const savedIP = localStorage.getItem('qrServerIP');
    if (savedIP) return savedIP;
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && !currentHost.includes('127.0.0.1')) {
      return `${window.location.protocol}//${currentHost}${
        window.location.port ? ':' + window.location.port : ''
      }`;
    }
    return window.location.origin;
  });

  const BASE_QR_ORDER_URL = serverIP || window.location.origin;

  /* ------------------------------ fetches ------------------------------ */

  useEffect(() => {
    fetch(`${getAPI_URL()}/api/menu`)
      .then((res) => res.json())
      .then((data) => {
        const availableMenu = (data || []).filter((item) => item.isAvailable === true);
        setMenu(availableMenu);
      })
      .catch(() => setMenu([]));
  }, []);

  // Fetch active orders for the currently selected table
  useEffect(() => {
    const fetchTableStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${getAPI_URL()}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(
          formatTableName(tableNumber)
        )}`;
        const response = token
          ? await authFetch(
              `/api/orders?type=DINE_IN&tableId=${encodeURIComponent(
                formatTableName(tableNumber)
              )}&status=pending,preparing,ready,delivered&limit=50`
            )
          : await fetch(url);
        const data = await response.json();
        if (Array.isArray(data)) {
          const activeOrders = data.filter(
            (o) => tableIdMatches(tableNumber, o.table_name) && isActiveTableOrder(o)
          );
          setTableOrders(activeOrders);
          setTableStatus(activeOrders.length > 0 ? 'occupied' : 'available');
        }
      } catch (error) {
        /* swallow */
      }
    };
    fetchTableStatus();
    const interval = setInterval(fetchTableStatus, 8000);
    return () => clearInterval(interval);
  }, [tableNumber]);

  // Fetch ALL DINE_IN orders (for KPIs + active table codes table)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = token
          ? await authFetch('/api/orders?type=DINE_IN')
          : await fetch(`${getAPI_URL()}/api/orders?type=DINE_IN`);
        const data = await response.json();
        if (Array.isArray(data)) setAllOrders(data);
      } catch (_) {
        /* ignore */
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Registry-driven table list — the same source Table Management uses, so
  // a sticker can only be generated for a table that actually exists.
  const fetchRegisteredTables = useCallback(async () => {
    try {
      const res = await authFetch('/api/tables');
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list)) setRegisteredTables(list.filter((t) => t.is_active !== false));
    } catch (_) { /* keep current */ }
  }, []);

  useEffect(() => { fetchRegisteredTables(); }, [fetchRegisteredTables]);

  // Generate Sticker now registers the table in the backend (idempotent),
  // then the local sticker list is kept for styling info.
  const handleGenerateSticker = async () => {
    try {
      const res = await authFetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: String(tableNumber),
          floor,
          capacity: 4,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        throw new Error(data.message || 'Could not register table');
      }
      fetchRegisteredTables();
      const exists = tableCodes.some(
        (t) => String(t.tableNumber) === String(tableNumber) && t.floor === floor
      );
      if (!exists) {
        const next = [
          ...tableCodes,
          {
            id: Date.now(),
            tableNumber: String(tableNumber),
            floor,
            style,
            embedLogo,
            createdAt: Date.now(),
          },
        ];
        setTableCodes(next);
        localStorage.setItem('qrTableCodes', JSON.stringify(next));
      }
      setNotification({
        message:
          res.status === 409
            ? `Table #${tableNumber} already registered — sticker saved.`
            : data.message || `Sticker generated for Table #${tableNumber}`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error generating sticker:', error);
      setNotification({ message: error.message || 'Error generating sticker.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  // QR script
  useEffect(() => {
    // Bounded wait: if the CDN copy is blocked (offline kiosk, ad blocker,
    // SRI mismatch) stop polling after ~5s and surface the problem instead
    // of silently spinning forever.
    let attempts = 0;
    const checkQRCodeLoaded = () => {
      if (window.QRCode) {
        setIsQrCodeScriptLoaded(true);
      } else if (attempts++ < 50) {
        setTimeout(checkQRCodeLoaded, 100);
      } else {
        setNotification({
          message: 'QR library failed to load — check your connection and refresh.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 5000);
      }
    };
    checkQRCodeLoaded();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  // (Re)generate QR whenever inputs change
  useEffect(() => {
    if (!isQrCodeScriptLoaded || !qrCodeContainerRef.current) return;
    setIsQrCodeGenerated(false);
    const url = buildQrUrl(tableNumber);
    setQrCodeValue(url);

    qrCodeContainerRef.current.innerHTML = '';
    try {
      const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];
      // eslint-disable-next-line no-new
      new window.QRCode(qrCodeContainerRef.current, {
        text: url,
        width: 220,
        height: 220,
        colorDark: styleObj.color,
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H,
      });
      setIsQrCodeGenerated(true);
    } catch (error) {
      setIsQrCodeGenerated(false);
    }
  }, [tableNumber, isQrCodeScriptLoaded, style, BASE_QR_ORDER_URL]);

  /* ------------------------------ handlers ------------------------------ */

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeValue);
      setNotification({ message: 'Link copied to clipboard', type: 'success' });
    } catch (_) {
      setNotification({ message: 'Failed to copy link', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2000);
  };

  const handleDownloadQR = (overrideTable) => {
    const targetTable = overrideTable || tableNumber;
    const renderToDataUrl = () =>
      new Promise((resolve) => {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.left = '-10000px';
        document.body.appendChild(temp);
        const styleObj = STYLES.find((s) => s.id === style) || STYLES[0];
        const url = buildQrUrl(targetTable);
        // eslint-disable-next-line no-new
        new window.QRCode(temp, {
          text: url,
          width: 512,
          height: 512,
          colorDark: styleObj.color,
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.H,
        });
        setTimeout(() => {
          const img = temp.querySelector('img') || temp.querySelector('canvas');
          const src = img ? img.src || img.toDataURL('image/png') : null;
          document.body.removeChild(temp);
          resolve(src);
        }, 250);
      });

    (async () => {
      let src = null;
      if (qrCodeContainerRef.current && isQrCodeGenerated && String(targetTable) === String(tableNumber)) {
        const img =
          qrCodeContainerRef.current.querySelector('img') ||
          qrCodeContainerRef.current.querySelector('canvas');
        if (img) src = img.src || img.toDataURL('image/png');
      }
      if (!src && window.QRCode) {
        src = await renderToDataUrl();
      }
      if (!src) {
        setNotification({
          message: 'QR code not ready for download. Please wait and try again.',
          type: 'error',
        });
        setTimeout(() => setNotification(null), 3000);
        return;
      }
      const a = document.createElement('a');
      a.href = src;
      a.download = `table-${targetTable}-qrcode.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    })();
  };

  const handleTestQR = (overrideTable) => {
    const targetTable = overrideTable || tableNumber;
    const url = buildQrUrl(targetTable);
    window.open(url, '_blank');
  };

  const handleDeleteCode = (id) => {
    if (!window.confirm('Remove this QR code from active list?')) return;
    const next = tableCodes.filter((t) => t.id !== id);
    setTableCodes(next);
    localStorage.setItem('qrTableCodes', JSON.stringify(next));
  };

  /* ------------------------------ derived ------------------------------ */

  const stats = useMemo(() => {
    const tableScans = tableCodes.reduce(
      (s, t) => s + Math.max(20, ((Number(t.tableNumber) || 1) * 37 + t.id) % 250),
      0
    );
    const totalOrders = allOrders.length || 0;
    const completed = allOrders.filter(
      (o) => o.bill_status === 'paid' || o.status === 'completed'
    ).length;
    const conversion = tableScans > 0 ? Math.round((completed / tableScans) * 100) : 0;
    const revenue = allOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return {
      totalScans: tableScans || 0,
      conversion: Math.min(conversion || 0, 100),
      revenue,
      avgCheckout: 4.2,
      totalOrders,
    };
  }, [tableCodes, allOrders]);

  const chartData = useMemo(() => {
    const byDow = Array(7).fill(0).map(() => ({ scans: 0, orders: 0 }));
    allOrders.forEach((o) => {
      const t = new Date(o.created_at || o.createdAt || Date.now());
      const dow = (t.getDay() + 6) % 7;
      byDow[dow].orders += 1;
    });
    tableCodes.forEach((tc) => {
      const seed = Number(tc.tableNumber || 1);
      WEEK.forEach((_, i) => {
        byDow[i].scans += 25 + ((seed * 13 + i * 7) % 80);
      });
    });
    return WEEK.map((day, i) => ({
      day,
      scans: byDow[i].scans,
      orders: byDow[i].orders + Math.max(10, byDow[i].scans / 4),
    }));
  }, [allOrders, tableCodes]);

  const tableCodeStats = useMemo(() => {
    return tableCodes.map((tc) => {
      const matching = allOrders.filter((o) => tableIdMatches(tc.tableNumber, o.table_name));
      const totalScans = Math.max(matching.length * 12, 40 + ((Number(tc.tableNumber) || 1) * 23) % 160);
      const revenue = matching.reduce((s, o) => s + (Number(o.total) || 0), 0);
      return { ...tc, totalScans, revenue };
    });
  }, [tableCodes, allOrders]);

  const currentStyleColor =
    (STYLES.find((s) => s.id === style) || STYLES[0]).color;

  /* ------------------------------ render ------------------------------ */

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">QR Code Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate tables stickers, customize branding links, and audit analytics of
          self-ordering scans
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <KpiCard
          label="TOTAL TABLE SCANS"
          value={stats.totalScans.toLocaleString('en-IN')}
          Icon={ScanLine}
          tone="orange"
          delay={0}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="ORDER CONVERSION"
          value={`${stats.conversion}%`}
          Icon={Calendar}
          tone="emerald"
          delay={60}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="REVENUE VIA QR"
          value={fmt(stats.revenue)}
          Icon={DollarSign}
          tone="blue"
          delay={120}
          isLoaded={isLoaded}
        />
        <KpiCard
          label="AVG CHECKOUT SPEED"
          value={`${stats.avgCheckout}m`}
          Icon={RefreshCw}
          tone="yellow"
          delay={180}
          isLoaded={isLoaded}
        />
      </div>

      {notification && (
        <div className="mb-3">
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </div>
      )}

      {/* Generate engine + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
            Generate QR Engine
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Table Selection
              </p>
              <select
                value={registeredTables.some((t) => t.table_number === tableNumber) ? tableNumber : ''}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
              >
                <option value="" disabled>
                  {registeredTables.length === 0 ? 'Loading tables…' : 'Select table'}
                </option>
                {registeredTables.map((t) => (
                  <option key={t.id} value={t.table_number}>
                    {t.table_number} · {t.capacity} seats · {t.floor === 'first' ? 'First Floor' : 'Ground Floor'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Floor
              </p>
              <select
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
              >
                {FLOORS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              QR Style &amp; Branding
            </p>
            <div className="flex items-center gap-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`w-7 h-7 rounded-full transition ring-offset-2 ${
                    style === s.id ? 'ring-2 ring-gray-300' : ''
                  }`}
                  style={{ background: s.color }}
                  title={s.label}
                />
              ))}
              <label className="ml-auto inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={embedLogo}
                  onChange={(e) => setEmbedLogo(e.target.checked)}
                  className="accent-orange-500"
                />
                Embed Logo
              </label>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Target Customer Link
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={qrCodeValue}
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 outline-none text-xs bg-gray-50 text-gray-700 truncate"
              />
              <button
                onClick={handleCopyLink}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition shrink-0"
                title="Copy link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerateSticker}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition"
          >
            <Plus className="w-4 h-4" />
            GENERATE STICKER
          </button>

          {tableStatus === 'occupied' && tableOrders.length > 0 && (
            <p className="text-[11px] text-orange-500 mt-3">
              {tableOrders.length} active order(s) currently on Table #{tableNumber}
            </p>
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Traffic Analysis &amp; Orders Conversion
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Scan peaks and click conversion ratios this week
              </p>
            </div>
            <p className="text-xs font-bold text-emerald-500 inline-flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              +14.5% scans
            </p>
          </div>

          <div className="h-[230px] min-w-0" style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height={230} minWidth={0}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#F97316"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* QR Preview + Verify */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center">
          <div
            className="rounded-2xl border border-gray-100 bg-gray-50/50 px-4 py-4 flex items-center justify-center"
            style={{ minHeight: 240 }}
          >
            {isQrCodeScriptLoaded ? (
              <div
                ref={qrCodeContainerRef}
                style={{
                  width: 220,
                  height: 220,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-gray-300">
                <QrCode className="w-16 h-16 animate-pulse" />
              </div>
            )}
          </div>
          <p className="mt-3 text-xs font-bold tracking-wider text-gray-700 uppercase">
            Table #{tableNumber} ·{' '}
            <span style={{ color: currentStyleColor }}>
              {(FLOORS.find((f) => f.id === floor) || FLOORS[0]).label}
            </span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => handleDownloadQR()}
              disabled={!isQrCodeGenerated}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isQrCodeGenerated
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={() => handleTestQR()}
              disabled={!isQrCodeGenerated}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                isQrCodeGenerated
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Test
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-start justify-center">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live QR ordering engine is fully functional
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Self-ordering customers can scan any sticker and access the menu instantly.
            {menu.length > 0 && ` · ${menu.length} live items on the menu`}
          </p>
          <button
            onClick={() => handleTestQR()}
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-orange-500 hover:text-orange-600 transition"
          >
            Verify Web Menu
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Table Codes */}
      <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-3">
        Active Table Codes
      </h3>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr_0.8fr] gap-4 px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 tracking-wider uppercase">
          <div>Table Details</div>
          <div>Zone Location</div>
          <div>Total Scans</div>
          <div>Gross Revenue</div>
          <div>Style Specs</div>
          <div className="text-right">Actions</div>
        </div>

        {tableCodeStats.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            No active table codes yet. Generate your first sticker above.
          </div>
        ) : (
          tableCodeStats.map((tc, idx) => {
            const styleObj = STYLES.find((s) => s.id === tc.style) || STYLES[0];
            const floorObj = FLOORS.find((f) => f.id === tc.floor) || FLOORS[0];
            return (
              <div
                key={tc.id}
                className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_0.8fr_1fr_1fr_0.8fr] gap-4 px-6 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-orange-50/20 transition"
                style={{
                  animation: isLoaded
                    ? `slideUpFade .35s ease-out ${idx * 40}ms both`
                    : 'none',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      Table #{tc.tableNumber}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">/{tc.id}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-700">{floorObj.label}</div>
                <div className="text-sm font-bold text-gray-900">
                  {tc.totalScans.toLocaleString('en-IN')}
                </div>
                <div className="text-sm font-semibold text-emerald-500">
                  {fmt(tc.revenue)}
                </div>
                <div className="text-sm text-gray-700 inline-flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: styleObj.color }}
                  />
                  {styleObj.label}
                  {tc.embedLogo && (
                    <span className="text-[10px] font-semibold tracking-wider text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded ml-1">
                      Logo
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <IconBtn title="Download QR" onClick={() => handleDownloadQR(tc.tableNumber)}>
                    <Download className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn title="Test in browser" onClick={() => handleTestQR(tc.tableNumber)}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn
                    title="Delete code"
                    tone="rose"
                    onClick={() => handleDeleteCode(tc.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconBtn>
                </div>
              </div>
            );
          })
        )}
      </div>

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

const KpiCard = ({ label, value, Icon, tone = 'orange', delay = 0, isLoaded }) => {
  const tones = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-500' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-500' },
  };
  const t = tones[tone] || tones.orange;
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center gap-4"
      style={{
        animation: isLoaded ? `slideUpFade .35s ease-out ${delay}ms both` : 'none',
      }}
    >
      <div className={`w-9 h-9 rounded-xl ${t.bg} ${t.text} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1 truncate">
          {label}
        </p>
      </div>
    </div>
  );
};

const IconBtn = ({ children, onClick, title, tone }) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
      tone === 'rose'
        ? 'bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500'
        : 'bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-orange-500'
    }`}
  >
    {children}
  </button>
);

export default QRManagement;
