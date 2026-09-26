import React, { useState, useEffect, useMemo } from 'react';
import { fetchWithErrorHandling } from '../utils/api';
import Notification from './Notification';
import {
  Plus,
  Package,
  AlertTriangle,
  Layers,
  TrendingUp,
  Search,
  Edit2,
  Trash2,
  X,
  Minus,
  Save,
  BadgePercent,
  ShoppingCart,
  Filter,
} from 'lucide-react';
import useCurrency from '../hooks/useCurrency';
import { getLocationSettingsForCountry } from '../utils/currency';

/* ===============================================================
   Inventory Management — Professional UI/UX & Dark Mode Support
   =============================================================== */

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

const formatStock = (value) => {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
};

const CATEGORY_LIST = ['All', 'Grains', 'Meat', 'Dairy', 'Oils', 'Vegetables', 'Spices', 'Other'];

const InventoryManagement = () => {
  const locationSettings = getLocationSettingsForCountry(
    localStorage.getItem('posCountry') || 'Bhutan'
  );
  const { format: fmt } = useCurrency(locationSettings);

  const [inventory, setInventory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    material_name: '',
    current_stock: '',
    min_stock: '',
    unit: 'kg',
    supplier: '',
    unit_price: '',
    purchase_price: '',
    gst_rate: '',
    last_purchase_date: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [editMinStock, setEditMinStock] = useState('');

  /* ---------------- data ---------------- */
  const fetchInventory = async () => {
    try {
      const data = await fetchWithErrorHandling('/api/inventory');
      setInventory(Array.isArray(data) ? data : []);
    } catch (err) {
      setInventory([]);
      setNotification({ message: err.message || 'Failed to load inventory', type: 'error' });
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  /* ---------------- handlers ---------------- */
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.material_name || newItem.current_stock === '' || newItem.min_stock === '') {
      setNotification({ message: 'Please fill all required fields', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    try {
      const added = await fetchWithErrorHandling('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          material_name: newItem.material_name.trim(),
          current_stock: parseFloat(newItem.current_stock),
          min_stock: parseFloat(newItem.min_stock),
          unit: newItem.unit || 'kg',
          supplier: newItem.supplier || '',
          unit_price: newItem.unit_price ? parseFloat(newItem.unit_price) : null,
          purchase_price: newItem.purchase_price ? parseFloat(newItem.purchase_price) : null,
          gst_rate: newItem.gst_rate ? parseFloat(newItem.gst_rate) : 0,
          last_purchase_date: newItem.last_purchase_date || null,
        }),
      });
      setInventory((prev) => [...prev, added]);
      setNewItem({
        material_name: '',
        current_stock: '',
        min_stock: '',
        unit: 'kg',
        supplier: '',
        unit_price: '',
        purchase_price: '',
        gst_rate: '',
        last_purchase_date: '',
      });
      setShowAddModal(false);
      setNotification({ message: 'Inventory item added successfully!', type: 'success' });
      fetchInventory();
    } catch (err) {
      let msg = 'Error adding item';
      if (err.message?.includes('409')) msg = 'Material with this name already exists';
      else if (err.message?.includes('401')) msg = 'Authentication error. Please login again.';
      else if (err.message?.includes('403')) msg = 'Permission denied.';
      else if (err.message) msg = err.message;
      setNotification({ message: msg, type: 'error' });
    }
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddStock = async (id) => {
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'add' }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setNotification({ message: 'Stock increased (+1)', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error adding stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleRemoveStock = async (id) => {
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ operation: 'remove' }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setNotification({ message: 'Stock reduced (-1)', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error removing stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await fetchWithErrorHandling(`/api/inventory/${id}`, { method: 'DELETE' });
      setInventory((prev) => prev.filter((i) => i.id !== id));
      setNotification({ message: 'Item deleted', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error deleting item', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  const startEditMinStock = (id, currentVal) => {
    setEditingId(id);
    setEditMinStock(currentVal !== undefined ? currentVal.toString() : '');
  };

  const saveMinStock = async (id) => {
    const val = parseFloat(editMinStock);
    if (isNaN(val) || val < 0) {
      setNotification({ message: 'Please enter a valid min stock level', type: 'error' });
      setTimeout(() => setNotification(null), 2500);
      return;
    }
    try {
      const updated = await fetchWithErrorHandling(`/api/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ min_stock: val }),
      });
      setInventory((prev) => prev.map((i) => (i.id === id ? updated.item : i)));
      setEditingId(null);
      setEditMinStock('');
      setNotification({ message: 'Min stock updated', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error saving min stock', type: 'error' });
    }
    setTimeout(() => setNotification(null), 2500);
  };

  /* ---------------- derived metrics ---------------- */
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(
    (i) => Number(i.current_stock) <= Number(i.min_stock)
  );
  const lowStockCount = lowStockItems.length;
  const categories = useMemo(
    () => new Set(inventory.map((i) => guessCategory(i.material_name))),
    [inventory]
  );
  const totalValue = inventory.reduce((sum, i) => {
    const stock = Number(i.current_stock) || 0;
    const rate = Number(i.unit_price) || 0;
    return sum + stock * rate;
  }, 0);

  // Total GST Input = sum of (purchase_price * current_stock * gst_rate/100)
  const totalGSTInput = inventory.reduce((sum, i) => {
    const stock = Number(i.current_stock) || 0;
    const price = Number(i.purchase_price) || 0;
    const gstPct = Number(i.gst_rate) || 0;
    return sum + (stock * price * gstPct / 100);
  }, 0);
  const itemsWithGST = inventory.filter((i) => Number(i.gst_rate) > 0).length;

  /* ---------------- filter ---------------- */
  const filtered = useMemo(() => {
    return inventory.filter((i) => {
      const cat = guessCategory(i.material_name);
      if (selectedCategory !== 'All' && cat !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (i.material_name || '').toLowerCase().includes(q);
        const matchesSupplier = (i.supplier || '').toLowerCase().includes(q);
        const matchesCat = cat.toLowerCase().includes(q);
        return matchesName || matchesSupplier || matchesCat;
      }
      return true;
    });
  }, [inventory, search, selectedCategory]);

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1220] px-4 sm:px-6 lg:px-8 py-6 text-gray-800 dark:text-slate-100 transition-colors duration-200">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Inventory Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Track restaurant stock levels, purchase prices, and Input Tax Credit (ITC).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all transform active:scale-95"
        >
          <Plus className="w-4 h-4" /> ADD MATERIAL
        </button>
      </div>

      {/* Summary cards — Unified 5-Column Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
        <SummaryCard
          icon={Package}
          iconBg="bg-orange-50 dark:bg-orange-950/40"
          iconColor="text-orange-500 dark:text-orange-400"
          label="TOTAL ITEMS"
          value={totalItems}
        />
        <SummaryCard
          icon={AlertTriangle}
          iconBg="bg-rose-50 dark:bg-rose-950/40"
          iconColor="text-rose-500 dark:text-rose-400"
          label="LOW STOCK"
          value={lowStockCount}
          valueClass="text-rose-500 dark:text-rose-400"
          highlight={lowStockCount > 0}
        />
        <SummaryCard
          icon={Layers}
          iconBg="bg-blue-50 dark:bg-blue-950/40"
          iconColor="text-blue-500 dark:text-blue-400"
          label="CATEGORIES"
          value={categories.size}
        />
        <SummaryCard
          icon={TrendingUp}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconColor="text-emerald-500 dark:text-emerald-400"
          label="TOTAL STOCK VALUE"
          value={fmt(totalValue)}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          icon={BadgePercent}
          iconBg="bg-violet-50 dark:bg-violet-950/40"
          iconColor="text-violet-500 dark:text-violet-400"
          label="GST INPUT (STOCK)"
          value={fmt(totalGSTInput)}
          valueClass="text-violet-600 dark:text-violet-400"
          sub={`${itemsWithGST} items with GST`}
        />
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material or supplier..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          {CATEGORY_LIST.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <Package className="w-7 h-7" />
          </div>
          <p className="text-base font-bold text-gray-700 dark:text-slate-200">No inventory items found</p>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {search || selectedCategory !== 'All'
              ? 'Try adjusting your search query or category filter.'
              : 'Click "Add Material" above to begin tracking stock and GST input tax.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <InventoryCard
              key={item.id}
              item={item}
              fmt={fmt}
              editingId={editingId}
              editMinStock={editMinStock}
              setEditMinStock={setEditMinStock}
              onStartEditMin={startEditMinStock}
              onSaveMin={saveMinStock}
              onCancelEditMin={() => {
                setEditingId(null);
                setEditMinStock('');
              }}
              onAddStock={handleAddStock}
              onRemoveStock={handleRemoveStock}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-2xl w-full max-w-lg my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Add Material</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  Configure purchase costs and GST rate for Input Tax Credit
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-4">
              {/* Material Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                  Material Name *
                </label>
                <input
                  type="text"
                  value={newItem.material_name}
                  onChange={(e) => setNewItem((p) => ({ ...p, material_name: e.target.value }))}
                  placeholder="e.g., Basmati Rice, Dairy Cheese"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  required
                />
              </div>

              {/* Stock Fields */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Initial Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.current_stock}
                    onChange={(e) => setNewItem((p) => ({ ...p, current_stock: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Min Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.min_stock}
                    onChange={(e) => setNewItem((p) => ({ ...p, min_stock: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Unit
                  </label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  >
                    {['kg', 'g', 'L', 'ml', 'pcs', 'dozen', 'box', 'bag', 'litre'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  value={newItem.supplier}
                  onChange={(e) => setNewItem((p) => ({ ...p, supplier: e.target.value }))}
                  placeholder="e.g., Apex Wholesale Mart"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Selling Price / Unit
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.unit_price}
                    onChange={(e) => setNewItem((p) => ({ ...p, unit_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                    Purchase Price / Unit
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItem.purchase_price}
                    onChange={(e) => setNewItem((p) => ({ ...p, purchase_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                  />
                </div>
              </div>

              {/* GST Input Section */}
              <div className="rounded-2xl border border-violet-100 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BadgePercent className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                    GST Input (Purchase Tax)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      GST Rate on Purchase (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={newItem.gst_rate}
                      onChange={(e) => setNewItem((p) => ({ ...p, gst_rate: e.target.value }))}
                      placeholder="e.g., 5 or 12"
                      className="w-full px-3 py-2.5 rounded-xl border border-violet-200 dark:border-violet-700/60 bg-white dark:bg-slate-700/90 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-1">GST paid to supplier</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">
                      Last Purchase Date
                    </label>
                    <input
                      type="date"
                      value={newItem.last_purchase_date}
                      onChange={(e) => setNewItem((p) => ({ ...p, last_purchase_date: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-violet-200 dark:border-violet-700/60 bg-white dark:bg-slate-700/90 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                    />
                  </div>
                </div>

                {newItem.purchase_price && newItem.gst_rate && (
                  <div className="mt-3 p-2.5 rounded-xl bg-violet-100/60 dark:bg-violet-900/40 text-xs text-violet-700 dark:text-violet-300 font-semibold">
                    GST per unit = {(parseFloat(newItem.purchase_price || 0) * parseFloat(newItem.gst_rate || 0) / 100).toFixed(2)}
                    {newItem.current_stock &&
                      ` · Total GST on ${newItem.current_stock} ${newItem.unit} = ${(
                        parseFloat(newItem.purchase_price || 0) *
                        (parseFloat(newItem.gst_rate || 0) / 100) *
                        parseFloat(newItem.current_stock || 0)
                      ).toFixed(2)}`}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition active:scale-95"
                >
                  Add Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── SummaryCard ─── */
const SummaryCard = ({ icon: Icon, iconBg, iconColor, label, value, valueClass = '', highlight = false, sub }) => (
  <div
    className={`rounded-2xl bg-white dark:bg-slate-800/90 border p-4 shadow-sm hover:shadow-md transition backdrop-blur-sm flex items-start gap-3.5 ${
      highlight
        ? 'border-rose-200 dark:border-rose-800/60 bg-rose-50/20 dark:bg-rose-950/20'
        : 'border-gray-100 dark:border-slate-700/80'
    }`}
  >
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-400 font-bold truncate">
        {label}
      </p>
      <p className={`text-xl sm:text-2xl font-extrabold mt-0.5 truncate ${valueClass || 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

/* ─── InventoryCard ─── */
const InventoryCard = ({
  item,
  fmt,
  editingId,
  editMinStock,
  setEditMinStock,
  onStartEditMin,
  onSaveMin,
  onCancelEditMin,
  onAddStock,
  onRemoveStock,
  onDelete,
}) => {
  const current = Number(item.current_stock) || 0;
  const min = Number(item.min_stock) || 0;
  const max = Math.max(current * 1.5, min * 2, 1);
  const ratio = Math.min(100, Math.max(5, (current / max) * 100));
  const lowStock = current <= min;
  const ok = current > min * 1.5;

  const barColor = lowStock
    ? 'bg-gradient-to-r from-rose-400 to-rose-500'
    : ok
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    : 'bg-gradient-to-r from-amber-400 to-amber-500';

  const stockColor = lowStock
    ? 'text-rose-500 dark:text-rose-400'
    : ok
    ? 'text-emerald-500 dark:text-emerald-400'
    : 'text-amber-500 dark:text-amber-400';

  const category = guessCategory(item.material_name);
  const unit = item.unit || 'kg';
  const supplier = item.supplier || '';
  const unitPrice = Number(item.unit_price) || 0;
  const purchasePrice = Number(item.purchase_price) || 0;
  const gstRate = Number(item.gst_rate) || 0;
  const gstPerUnit = (purchasePrice * gstRate) / 100;
  const totalItemGst = gstPerUnit * current;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-gray-100 dark:border-slate-700/80 shadow-sm hover:shadow-md transition p-4 flex flex-col justify-between">
      <div>
        {/* Top title & badge */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={item.material_name}>
              {item.material_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-full">
                {category}
              </span>
              {supplier && (
                <span
                  className="text-[10px] text-gray-500 dark:text-slate-300 bg-gray-50 dark:bg-slate-700/60 px-2 py-0.5 rounded-full border border-gray-100 dark:border-slate-600 truncate max-w-[130px]"
                  title={`Supplier: ${supplier}`}
                >
                  {supplier}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {lowStock && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/60 dark:text-rose-300">
                Low Stock
              </span>
            )}
            <button
              onClick={() => onDelete(item.id, item.material_name)}
              title="Delete material"
              className="w-7 h-7 rounded-xl bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 flex items-center justify-center transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stock Level Bar */}
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Stock Level</p>
          <p className={`text-sm font-bold ${stockColor}`}>
            {formatStock(current)} {unit}
          </p>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${ratio}%` }} />
        </div>

        {/* Min Stock Row */}
        <div className="flex items-center justify-between mt-2.5 text-xs text-gray-500 dark:text-slate-400">
          {editingId === item.id ? (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="number"
                min="0"
                step="0.01"
                value={editMinStock}
                onChange={(e) => setEditMinStock(e.target.value)}
                className="flex-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                autoFocus
              />
              <button
                onClick={() => onSaveMin(item.id)}
                className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 flex items-center justify-center transition"
                title="Save"
              >
                <Save className="w-3 h-3" />
              </button>
              <button
                onClick={onCancelEditMin}
                className="w-6 h-6 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-slate-300 hover:bg-gray-100 flex items-center justify-center transition"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <span>
                Min alert: <span className="font-semibold text-gray-700 dark:text-slate-200">{formatStock(min)} {unit}</span>
              </span>
              <button
                onClick={() => onStartEditMin(item.id, min)}
                title="Edit min stock alert"
                className="w-6 h-6 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-700 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 flex items-center justify-center transition"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* GST Input & Purchase Info Box */}
        {(purchasePrice > 0 || gstRate > 0) && (
          <div className="mt-2.5 p-2 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800/40 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                Buy: <b className="text-violet-900 dark:text-violet-100">{fmt(purchasePrice)}</b>/{unit}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
                GST {gstRate}%
              </span>
            </div>
            {gstRate > 0 && purchasePrice > 0 && (
              <div className="flex items-center justify-between mt-1 text-[10px] text-violet-600 dark:text-violet-400">
                <span>Tax/unit: {fmt(gstPerUnit)}</span>
                <span>Stock ITC: <b>{fmt(totalItemGst)}</b></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stock Adjust Controls & Selling Price */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/80">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRemoveStock(item.id)}
            className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 flex items-center justify-center transition border border-gray-200 dark:border-slate-600"
            title="Deduct 1 unit"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAddStock(item.id)}
            className="w-7 h-7 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 flex items-center justify-center transition border border-gray-200 dark:border-slate-600"
            title="Add 1 unit"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-right">
          {unitPrice > 0 && (
            <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
              {fmt(unitPrice)}
              <span className="text-xs font-normal text-gray-400 dark:text-slate-400">/{unit}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
