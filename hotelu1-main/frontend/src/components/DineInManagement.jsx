import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import OrderEntryModal from './OrderEntryModal';
import { Users, Plus, X, Clock3, Receipt, CircleCheck, Sparkles, Layers, Pencil, Trash2 } from 'lucide-react';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Helpers & constants                                                */
/* ------------------------------------------------------------------ */

// Fallback only — the live floor list comes from GET /api/floors so floors
// added/renamed/deleted by staff are reflected on every page instantly.
const FALLBACK_FLOORS = [
  { key: 'ground', label: 'Ground Floor' },
  { key: 'first', label: 'First Floor' },
];

const STATUS_CONFIG = {
  available: {
    label: 'FREE',
    summaryLabel: 'Free',
    dot: 'bg-emerald-500',
    ringColor: '#10B981',
    badgeBg: 'bg-emerald-100/70',
    text: 'text-emerald-700',
    bigBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100',
    cardRing: 'ring-1 ring-emerald-100 hover:ring-emerald-300',
    showDot: false,
    hint: 'Tap to seat guests',
  },
  occupied: {
    label: 'OCCUPIED',
    summaryLabel: 'Occupied',
    dot: 'bg-orange-500',
    ringColor: '#F97316',
    badgeBg: 'bg-orange-100/70',
    text: 'text-orange-600',
    bigBg: 'bg-gradient-to-br from-orange-50 to-orange-100',
    cardRing: 'ring-1 ring-orange-100 hover:ring-orange-300',
    showDot: true,
    hint: 'Tap to add items',
  },
  reserved: {
    label: 'RESERVED',
    summaryLabel: 'Reserved',
    dot: 'bg-yellow-400',
    ringColor: '#FACC15',
    badgeBg: 'bg-yellow-100/80',
    text: 'text-yellow-700',
    bigBg: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    cardRing: 'ring-1 ring-yellow-100 hover:ring-yellow-300',
    showDot: false,
    hint: 'Tap to view',
  },
  cleaning: {
    label: 'CLEANING',
    summaryLabel: 'Cleaning',
    dot: 'bg-blue-500',
    ringColor: '#3B82F6',
    badgeBg: 'bg-blue-100/70',
    text: 'text-blue-600',
    bigBg: 'bg-gradient-to-br from-blue-50 to-blue-100',
    cardRing: 'ring-1 ring-blue-100 hover:ring-blue-300',
    showDot: false,
    hint: 'Tap “Done Cleaning” to free',
  },
  waiting_payment: {
    label: 'WAITING PAYMENT',
    summaryLabel: 'Waiting Payment',
    dot: 'bg-amber-500',
    ringColor: '#F59E0B',
    badgeBg: 'bg-amber-100/70',
    text: 'text-amber-600',
    bigBg: 'bg-gradient-to-br from-amber-50 to-amber-100',
    cardRing: 'ring-1 ring-amber-100 hover:ring-amber-300',
    showDot: true,
    hint: 'Tap to settle bill',
  },
};

// Fallback only — the live floor plan comes from the backend registry
// (GET /api/tables) so QR Management and this page always agree.
const initialTables = [
  { id: 'T1', capacity: 4, floor: 'ground', status: 'available' },
  { id: 'T2', capacity: 2, floor: 'ground', status: 'available' },
  { id: 'T3', capacity: 6, floor: 'ground', status: 'available' },
  { id: 'T4', capacity: 4, floor: 'ground', status: 'available' },
  { id: 'T5', capacity: 8, floor: 'ground', status: 'available' },
  { id: 'T6', capacity: 2, floor: 'ground', status: 'available' },
  { id: 'T7', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T8', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T9', capacity: 6, floor: 'first', status: 'available' },
  { id: 'T10', capacity: 2, floor: 'first', status: 'available' },
  { id: 'T11', capacity: 4, floor: 'first', status: 'available' },
  { id: 'T12', capacity: 10, floor: 'first', status: 'available' },
];

const tableIdMatches = (tableId, tableName) => {
  if (!tableName) return false;
  const normalizedTableId = String(tableId).replace(/^T/i, '');
  const normalizedTableName = String(tableName).replace(/Table\s*/i, '');
  return normalizedTableId === normalizedTableName || tableId === tableName;
};

const minutesSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.floor(ms / 60000);
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DineInManagement = ({ locationSettings, nextOrderId, setNextOrderId }) => {
  const { format: fmt } = useCurrency(locationSettings);
  const navigate = useNavigate();

  const [tables, setTables] = useState(initialTables);
  const [floors, setFloors] = useState(FALLBACK_FLOORS);
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [notification, setNotification] = useState(null);
  const [activeFloor, setActiveFloor] = useState('all');
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [showManageFloors, setShowManageFloors] = useState(false);
  const [newTable, setNewTable] = useState({ capacity: 4, floor: 'ground' });
  const [newFloorName, setNewFloorName] = useState('');
  const [renamingFloor, setRenamingFloor] = useState(null);
  const [renameFloorLabel, setRenameFloorLabel] = useState('');
  const [busyCleaning, setBusyCleaning] = useState({});
  const [, setTick] = useState(0);

  /* ------------------------------ auth ------------------------------ */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) navigate('/login');
  }, [navigate]);

  /* ------------------------------ fetch ----------------------------- */
  const updateTableStatuses = useCallback((orders) => {
    setTables((prev) =>
      prev.map((table) => {
        const tableOrder = orders.find(
          (o) =>
            tableIdMatches(table.id, o.table_name) &&
            o.status !== 'completed' &&
            o.bill_status !== 'paid'
        );

        if (!tableOrder) {
          // "cleaning" is staff-driven (Mark Cleaned / Done Cleaning below)
          // and "reserved" is set manually, so don't let the poll wipe them.
          if (table.status === 'cleaning' || table.status === 'reserved') return table;
          return { ...table, status: 'available' };
        }
        if (tableOrder.status === 'delivered' && tableOrder.bill_status !== 'paid') {
          return { ...table, status: 'waiting_payment' };
        }
        return { ...table, status: 'occupied' };
      })
    );
  }, []);

  const fetchOrdersAndSync = useCallback(async () => {
    try {
      // Only non-completed dine-in orders matter here; completed history
      // would be re-shipped on every poll. Paired with the server-side
      // limit this keeps the poll small regardless of table volume.
      const response = await authFetch(
        '/api/orders?type=DINE_IN&status=pending,preparing,ready,delivered,NOT_AVAILABLE&limit=200'
      );
      if (!response.ok) {
        setActiveOrders([]);
        return;
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        setActiveOrders([]);
        return;
      }
      const filteredOrders = data.filter((o) => o.status !== 'completed');
      setActiveOrders(filteredOrders);
      updateTableStatuses(data);
    } catch (err) {
      console.error('Failed to fetch DINE_IN orders:', err);
      setActiveOrders([]);
    }
  }, [updateTableStatuses]);

  useEffect(() => {
    fetchOrdersAndSync();
    const orderInterval = setInterval(fetchOrdersAndSync, 5000);
    const timeTick = setInterval(() => setTick((v) => v + 1), 60000);
    return () => {
      clearInterval(orderInterval);
      clearInterval(timeTick);
    };
  }, [fetchOrdersAndSync]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // Load the floor plan from the backend registry (single source of truth
  // shared with QR Management). Falls back to the hardcoded list offline.
  const fetchTables = useCallback(async () => {
    try {
      const res = await authFetch('/api/tables');
      if (!res.ok) return;
      const list = await res.json();
      if (!Array.isArray(list) || list.length === 0) return;
      setTables((prev) =>
        list
          .filter((t) => t.is_active !== false)
          .map((t) => {
            const known = prev.find((p) => p.id === t.table_number);
            return {
              id: t.table_number,
              capacity: t.capacity || 4,
              floor: t.floor || 'ground',
              // keep any staff-driven status already computed locally
              status: known ? known.status : 'available',
            };
          })
      );
    } catch (_) { /* offline: keep current list */ }
  }, []);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  // Load the floor registry (keys + display labels shared with QR Management).
  const fetchFloors = useCallback(async () => {
    try {
      const res = await authFetch('/api/floors');
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        setFloors(list.map((f) => ({ key: f.key, label: f.label })));
      }
    } catch (_) { /* offline: keep fallback */ }
  }, []);

  useEffect(() => { fetchFloors(); }, [fetchFloors]);

  /* ---------------------------- handlers ---------------------------- */
  const handleTableClick = (table) => {
    setSelectedTable(table);
    setShowOrderModal(true);
  };

  const handleOrderPlaced = async (placedOrder) => {
    try {
      fetchOrdersAndSync();
      setNotification({
        message: `Order for ${selectedTable.id} placed! (Order #${placedOrder.id})`,
        type: 'success',
      });
    } catch (error) {
      console.error('Error handling placed order:', error);
      setNotification({ message: 'Error handling order.', type: 'error' });
    }
    setShowOrderModal(false);
    setSelectedTable(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteEmptyOrder = async (order) => {
    try {
      const deleteResponse = await authFetch(`/api/orders/${order.id}`, {
        method: 'DELETE',
      });
      if (!deleteResponse.ok) throw new Error('Failed to delete empty order');
      setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (error) {
      console.error('Error deleting empty order:', error);
    }
  };

  // Table session lifecycle:
  //  1. "Guests Left" (occupied/waiting_payment tables) — completes ALL the
  //     table's active orders (only after payment for delivered ones) and
  //     moves the table to CLEANING. This is how the system learns the
  //     table is physically empty.
  //  2. "Done Cleaning" (cleaning tables) — frees the table for new guests.
  // Cleaning/reserved persist across polls — updateTableStatuses guards them.
  const handleMarkTableAvailable = async (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    const finishing = table?.status === 'cleaning';
    setBusyCleaning((prev) => ({ ...prev, [tableId]: true }));
    try {
      if (!finishing) {
        const tableOrders = activeOrders.filter((order) =>
          tableIdMatches(tableId, order.table_name)
        );
        // Safety net: delivered-but-unpaid orders must be settled (cash
        // collected or QR approved) before the session can be closed, so
        // revenue can't silently vanish from the reports.
        const unpaid = tableOrders.find(
          (o) => o.status === 'delivered' && o.bill_status !== 'paid' &&
                 !(o.payment_method === 'cash' || o.payment_status === 'paid' || o.payment_status === 'cash_pending')
        );
        if (unpaid) {
          setNotification({
            message: `Bill for table ${tableId} is not settled yet. Collect payment first.`,
            type: 'error',
          });
          setTimeout(() => setNotification(null), 3500);
          setBusyCleaning((prev) => ({ ...prev, [tableId]: false }));
          return;
        }
        for (const order of tableOrders) {
          try {
            await authFetch(`/api/orders/${order.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' }),
            });
            setActiveOrders((prev) => prev.filter((o) => o.id !== order.id));
          } catch (err) {
            console.error(`Failed to complete order ${order.id}:`, err);
          }
        }
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, status: 'cleaning' } : t))
        );
        setNotification({ message: `Table ${tableId} is being cleaned…`, type: 'info' });
        fetchOrdersAndSync();
      } else {
        setTables((prev) =>
          prev.map((t) => (t.id === tableId ? { ...t, status: 'available' } : t))
        );
        setNotification({ message: `Table ${tableId} is now available!`, type: 'success' });
        fetchOrdersAndSync();
      }
      setTimeout(() => setNotification(null), 2500);
    } catch (error) {
      console.error('Error updating table cleaning status:', error);
      setNotification({ message: 'Error updating table status.', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setBusyCleaning((prev) => ({ ...prev, [tableId]: false }));
    }
  };

  const handleAddTable = async () => {
    try {
      // Persist to the registry so QR Management can immediately generate a
      // sticker for this table and the occupancy guard knows it exists.
      const existingNumbers = tables
        .map((t) => parseInt(String(t.id).replace(/^T/i, ''), 10))
        .filter((n) => !Number.isNaN(n));
      const nextNum = (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1;
      const res = await authFetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: String(nextNum),
          capacity: Math.max(1, Math.min(30, Number(newTable.capacity) || 4)),
          floor: newTable.floor || 'ground',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not add table');
      await fetchTables();
      setShowAddTable(false);
      setNewTable({ capacity: 4, floor: 'ground' });
      setNotification({ message: data.message || `Table T${nextNum} added.`, type: 'success' });
    } catch (error) {
      console.error('Error adding table:', error);
      setNotification({ message: error.message || 'Error adding table.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const floorName = (key) =>
    floors.find((f) => f.key === key)?.label ||
    String(key).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' Floor';

  const handleAddFloor = async () => {
    const name = newFloorName.trim();
    if (!name) return;
    try {
      const res = await authFetch('/api/floors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not add floor');
      setNewFloorName('');
      await fetchFloors();
      setNotification({ message: data.message || `Floor "${name}" added.`, type: 'success' });
    } catch (error) {
      console.error('Error adding floor:', error);
      setNotification({ message: error.message || 'Error adding floor.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleRenameFloor = async () => {
    if (!renamingFloor) return;
    const label = renameFloorLabel.trim();
    if (!label) return;
    try {
      const res = await authFetch(`/api/floors/${encodeURIComponent(renamingFloor)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not rename floor');
      setRenamingFloor(null);
      setRenameFloorLabel('');
      await fetchFloors();
      setNotification({ message: data.message || 'Floor renamed.', type: 'success' });
    } catch (error) {
      console.error('Error renaming floor:', error);
      setNotification({ message: error.message || 'Error renaming floor.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleDeleteFloor = async (key) => {
    if (!window.confirm(`Delete floor "${floorName(key)}"? Only empty floors (no tables) can be deleted.`)) return;
    try {
      const res = await authFetch(`/api/floors/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not delete floor');
      if (activeFloor === key) setActiveFloor('all');
      await fetchFloors();
      setNotification({ message: data.message || 'Floor deleted.', type: 'success' });
    } catch (error) {
      console.error('Error deleting floor:', error);
      setNotification({ message: error.message || 'Error deleting floor.', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  /* ---------------------------- derived ---------------------------- */
  const summaryCounts = useMemo(() => {
    const c = { available: 0, occupied: 0, waiting_payment: 0, cleaning: 0, reserved: 0 };
    tables.forEach((t) => {
      const s = t.status;
      if (s in c) c[s] += 1;
    });
    return c;
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (activeFloor === 'all') return tables;
    return tables.filter((t) => t.floor === activeFloor);
  }, [tables, activeFloor]);

  const orderForTable = useCallback(
    (tableId) =>
      activeOrders.find(
        (o) =>
          tableIdMatches(tableId, o.table_name) &&
          o.status !== 'completed' &&
          o.bill_status !== 'paid'
      ),
    [activeOrders]
  );

  /* ----------------------------- render ----------------------------- */
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
            Table Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time occupancy and visual floor management system
          </p>
        </div>
        <button
          onClick={() => setShowAddTable(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <Plus className="w-4 h-4" />
          ADD TABLE
        </button>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        {['available', 'occupied', 'waiting_payment', 'cleaning'].map((status, idx) => {
          const cfg = STATUS_CONFIG[status];
          const total = tables.length || 1;
          const pct = Math.round(((summaryCounts[status] || 0) / total) * 100);
          return (
            <div
              key={status}
              className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4"
              style={{
                animation: isLoaded
                  ? `slideUpFade .35s ease-out ${idx * 60}ms both`
                  : 'none',
              }}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${cfg.dot}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {cfg.summaryLabel}
                  </p>
                  <p className="text-3xl font-extrabold text-gray-900 leading-none mt-1.5">
                    {summaryCounts[status]}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">of {total} tables</p>
                </div>
                {/* Donut ring */}
                <div
                  className="w-11 h-11 rounded-full grid place-items-center shrink-0"
                  style={{
                    background: `conic-gradient(currentColor ${pct * 3.6}deg, #F1F5F9 0deg)`,
                    color: cfg.ringColor,
                  }}
                >
                  <span className="w-8 h-8 rounded-full bg-white grid place-items-center text-[10px] font-bold text-gray-600">
                    {pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floor tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {[{ key: 'all', label: 'All Floors' }, ...floors].map((f) => {
          const active = activeFloor === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFloor(f.key)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-200/60 scale-[1.02]'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <button
          onClick={() => setShowManageFloors(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-500 hover:text-orange-600 hover:border-orange-200 transition-all duration-200"
          title="Add, rename or delete floors"
        >
          <Layers className="w-3.5 h-3.5" />
          Manage Floors
        </button>
      </div>

      {/* Tables grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        {filteredTables.map((table, idx) => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.available;
          const tableOrder = orderForTable(table.id);
          // Tables with guests seated (order still open, incl. waiting for
          // payment) show the occupancy footer.
          const hasSession =
            !!tableOrder &&
            (table.status === 'occupied' || table.status === 'waiting_payment');

          const occupiedMin =
            tableOrder && (tableOrder.timestamp || tableOrder.created_at)
              ? minutesSince(tableOrder.timestamp || tableOrder.created_at)
              : null;
          // Real guest count captured when the order was placed. Falls back
          // to a capacity cap only for legacy orders placed before the
          // guests field existed.
          const guestsOccupied =
            tableOrder && (table.status === 'occupied' || table.status === 'waiting_payment')
              ? tableOrder.guests
                ? Number(tableOrder.guests)
                : Math.min(table.capacity, 2)
              : 0;
          const orderValue = tableOrder?.total || 0;

          const canClean =
            table.status === 'occupied' ||
            table.status === 'waiting_payment' ||
            table.status === 'reserved' ||
            table.status === 'cleaning';

          return (
            <div
              key={table.id}
              role="button"
              tabIndex={0}
              onClick={() => handleTableClick(table)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleTableClick(table);
              }}
              className={`relative text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 p-4 ${cfg.cardRing} hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-300`}
              style={{
                animation: isLoaded
                  ? `cardPop .35s ease-out ${Math.min(idx * 35, 600)}ms both`
                  : 'none',
              }}
              title={
                table.status === 'cleaning'
                  ? 'Click to view · Done Cleaning frees the table'
                  : table.status !== 'available'
                    ? 'Click to add items · Guests Left ends the session'
                    : 'Click to place a new order'
              }
            >
              {cfg.showDot && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100 animate-pulse-soft" />
              )}
              {/* Capacity chip */}
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-500">
                <Users className="w-3 h-3" />
                {table.capacity}
              </span>

              {/* Big square badge */}
              <div className={`mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-2xl ${cfg.bigBg} flex flex-col items-center justify-center shadow-inner`}>
                <span className={`text-2xl sm:text-3xl font-extrabold ${cfg.text} leading-none`}>
                  {table.id}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                  Table
                </span>
              </div>

              {/* Status pill */}
              <div className="flex justify-center mt-3">
                <span
                  className={`inline-flex items-center text-[10px] tracking-wider font-bold px-2.5 py-1 rounded-full ${cfg.badgeBg} ${cfg.text}`}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Footer info */}
              {hasSession ? (
                <div className="mt-3 space-y-2 text-[11px]">
                  {/* Occupancy progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Users className="w-3 h-3" />
                        <span className="font-bold text-gray-700">{guestsOccupied}</span>
                        <span className="text-gray-400">/ {table.capacity} guests</span>
                      </span>
                      {occupiedMin !== null && (
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            occupiedMin >= 60
                              ? 'text-rose-600'
                              : occupiedMin >= 30
                                ? 'text-amber-600'
                                : 'text-gray-500'
                          }`}
                        >
                          <Clock3 className="w-3 h-3" />
                          {occupiedMin}m
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, (guestsOccupied / Math.max(1, table.capacity)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {orderValue > 0 && (
                    <p className="flex items-center justify-between rounded-lg bg-orange-50/70 px-2 py-1">
                      <span className="inline-flex items-center gap-1 uppercase tracking-wide text-gray-400">
                        <Receipt className="w-3 h-3" /> Value
                      </span>
                      <span className="font-bold text-orange-600">{fmt(orderValue)}</span>
                    </p>
                  )}
                  <p className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-0.5">
                    {cfg.hint}
                  </p>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full w-0 rounded-full" />
                  </div>
                  <p className="mt-2 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {cfg.hint}
                  </p>
                </div>
              )}

              {/* Explicit cleaning action — was hidden behind right-click */}
              {canClean && (
                <div
                  className="mt-3"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleMarkTableAvailable(table.id)}
                    disabled={busyCleaning[table.id]}
                    className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                      table.status === 'cleaning'
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {table.status === 'cleaning'
                      ? 'Done Cleaning'
                      : table.status === 'reserved'
                        ? 'Free Table'
                        : 'Guests Left'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Add Table</h3>
              <button
                onClick={() => setShowAddTable(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={newTable.capacity}
                  onChange={(e) =>
                    setNewTable((p) => ({ ...p, capacity: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                  Floor
                </label>
                <select
                  value={newTable.floor}
                  onChange={(e) =>
                    setNewTable((p) => ({ ...p, floor: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
                >
                  {floors.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddTable(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTable}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Floors Modal */}
      {showManageFloors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Manage Floors</h3>
              <button
                onClick={() => {
                  setShowManageFloors(false);
                  setRenamingFloor(null);
                  setNewFloorName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add floor */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                maxLength={30}
                value={newFloorName}
                onChange={(e) => setNewFloorName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFloor()}
                placeholder="e.g. Terrace, Basement"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
              />
              <button
                onClick={handleAddFloor}
                disabled={!newFloorName.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Add
              </button>
            </div>

            {/* Floor list with rename/delete */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {floors.map((f) =>
                renamingFloor === f.key ? (
                  <div key={f.key} className="flex gap-2 items-center">
                    <input
                      autoFocus
                      type="text"
                      maxLength={50}
                      value={renameFloorLabel}
                      onChange={(e) => setRenameFloorLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFloor();
                        if (e.key === 'Escape') setRenamingFloor(null);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                    />
                    <button
                      onClick={handleRenameFloor}
                      className="px-3 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setRenamingFloor(null)}
                      className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <span className="text-sm font-semibold text-gray-700 truncate">
                      {f.label}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setRenamingFloor(f.key);
                          setRenameFloorLabel(f.label);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition"
                        title="Rename floor"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFloor(f.key)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete floor (only if empty)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                )
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Renaming only changes the display name — tables stay on their floor. Floors can be deleted only when no tables are on them.
            </p>
          </div>
        </div>
      )}

      {/* Order Entry Modal */}
      {showOrderModal && (
        <OrderEntryModal
          table={
            editingOrder
              ? { id: editingOrder.table_name, status: 'occupied', capacity: 0 }
              : selectedTable
          }
          onClose={() => {
            if (editingOrder && (!editingOrder.items || editingOrder.items.length === 0)) {
              handleDeleteEmptyOrder(editingOrder);
            }
            setShowOrderModal(false);
            setEditingOrder(null);
            setSelectedTable(null);
          }}
          onOrderPlaced={
            editingOrder
              ? (orderData) => {
                  setActiveOrders((prev) =>
                    prev.map((o) =>
                      o.id === editingOrder.id
                        ? { ...o, items: orderData.items, total: orderData.total }
                        : o
                    )
                  );
                  setNotification({
                    message: `Order for ${editingOrder.table_name} updated!`,
                    type: 'success',
                  });
                  setEditingOrder(null);
                  setTimeout(() => setNotification(null), 3000);
                }
              : handleOrderPlaced
          }
          locationSettings={locationSettings}
          nextOrderId={nextOrderId}
          setNextOrderId={setNextOrderId}
          orderType="DINE_IN"
          initialOrder={editingOrder}
        />
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardPop {
          from { opacity: 0; transform: translateY(10px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseSoft {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: .8; }
        }
        .animate-pulse-soft { animation: pulseSoft 1.8s ease-in-out infinite; }
        .animate-modal-in { animation: fadeScale .22s ease-out both; }
      `}</style>
    </div>
  );
};

export default DineInManagement;
