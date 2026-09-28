import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  ArrowLeft,
  X,
  User,
  MapPin as MapPinIcon,
  Calendar,
  Award,
  Trash2,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import Notification from './Notification';
import LocationDetailPanel from './LocationDetailPanel';
import useCurrency from '../hooks/useCurrency';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TIERS = [
  { id: 'standard', label: 'Standard Tier' },
  { id: 'basic', label: 'Basic Tier' },
  { id: 'enterprise', label: 'Enterprise Tier' },
  { id: 'premium', label: 'Premium Tier' },
];

const emptyForm = {
  name: '',
  code: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  manager_name: '',
  status: 'active',
  notes: '',
  login_username: '',
  login_password: '',
  owner_user_id: '',
  gstin: '',
  tier: 'standard',
  license_validity: '',
};

const formatGSTIN = (code, id) => {
  if (!code && !id) return '';
  const base = String(code || `BR${id || ''}`)
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .padEnd(15, '0')
    .slice(0, 15);
  return `36${base.slice(0, 13)}`;
};

const tierFromCode = (code) => {
  if (!code) return 'Standard Tier';
  const c = String(code).toLowerCase();
  if (c.includes('hq') || c.includes('ent')) return 'Enterprise Tier';
  if (c.includes('basic')) return 'Basic Tier';
  if (c.includes('prem')) return 'Premium Tier';
  return 'Standard Tier';
};

const formatLicenseValidity = (raw) => {
  if (!raw) {
    // Default to one year from now
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  try {
    return new Date(raw).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) {
    return String(raw);
  }
};

const tierBadgeClass = (tier) => {
  const t = String(tier || '').toLowerCase();
  if (t.includes('enterprise')) return 'text-purple-600';
  if (t.includes('basic')) return 'text-blue-500';
  if (t.includes('premium')) return 'text-emerald-600';
  return 'text-orange-500';
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const SubFranchiseManagement = ({ currentUser, locationSettings }) => {
  const isAdmin = currentUser?.role === 'admin';
  // eslint-disable-next-line no-unused-vars
  const { format: fmt } = useCurrency(locationSettings);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notification, setNotification] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [franchiseUsers, setFranchiseUsers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadFranchiseUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await authFetch('/api/users');
      if (res.ok) {
        const users = await res.json();
        setFranchiseUsers(users.filter((u) => u.role === 'franchise'));
      }
    } catch (_) {
      /* ignore */
    }
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/subfranchises');
      if (!res.ok) throw new Error('Failed to load sub-franchises');
      setList(await res.json());
    } catch (e) {
      setNotification({ message: e.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadFranchiseUsers();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load, loadFranchiseUsers]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      code: row.code || '',
      address: row.address || '',
      city: row.city || '',
      phone: row.phone || '',
      email: row.email || '',
      manager_name: row.manager_name || '',
      status: row.status || 'active',
      notes: row.notes || '',
      login_username: row.loginUsername || '',
      login_password: '',
      owner_user_id: row.owner_user_id ? String(row.owner_user_id) : '',
      gstin: row.gstin || formatGSTIN(row.code, row.id),
      tier: String(tierFromCode(row.code)).toLowerCase().split(' ')[0],
      license_validity: row.license_validity || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNotification({ message: 'Branch name is required', type: 'error' });
      return;
    }
    const safeCode = form.code.trim() || form.name.replace(/\s+/g, '').slice(0, 8).toUpperCase();
    try {
      const url = editingId ? `/api/subfranchises/${editingId}` : '/api/subfranchises';
      const res = await authFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          code: safeCode,
          owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Save failed');
      }
      setNotification({
        message: editingId ? 'Branch updated' : 'Branch registered successfully',
        type: 'success',
      });
      setShowForm(false);
      load();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const handleSuspend = async (row) => {
    if (
      !window.confirm(
        `${row.status === 'active' ? 'Suspend' : 'Activate'} branch "${row.name}"?`
      )
    )
      return;
    try {
      const next = row.status === 'active' ? 'inactive' : 'active';
      const res = await authFetch(`/api/subfranchises/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Update failed');
      setNotification({
        message: next === 'active' ? 'Branch reactivated' : 'Branch suspended',
        type: 'success',
      });
      load();
    } catch (e) {
      setNotification({ message: e.message, type: 'error' });
    }
  };

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Delete branch "${name}"?\n\nThis permanently removes the branch and any staff accounts linked to it. Branches with open orders cannot be deleted.`
      )
    )
      return;
    try {
      const res = await authFetch(`/api/subfranchises/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Delete failed');
      }
      setNotification({ message: data.message || 'Branch removed', type: 'success' });
      load();
    } catch (e) {
      setNotification({ message: e.message, type: 'error' });
    }
  };

  const enrichedList = useMemo(() => {
    return list.map((row, idx) => ({
      ...row,
      _id: `F${idx + 1}`,
      _gstin: row.gstin || formatGSTIN(row.code, idx + 1),
      _tier: tierFromCode(row.code),
      _validity: formatLicenseValidity(row.license_validity),
      _isHQ: idx === 0,
    }));
  }, [list]);

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-start gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:border-gray-300 transition"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Sub-Franchise Registration
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Register location nodes, licenses records, owner allocations and track
              subscription metrics
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" />
            REGISTER BRANCH
          </button>
        )}
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

      <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-3">
        Active Franchise Ledger
      </h3>

      {loading && enrichedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
          Loading branches…
        </div>
      ) : enrichedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 text-orange-400 flex items-center justify-center mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No sub-franchises yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click &quot;Register Branch&quot; to onboard your first location
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrichedList.map((sf, idx) => (
            <BranchCard
              key={sf.id || idx}
              sf={sf}
              isAdmin={isAdmin}
              isLoaded={isLoaded}
              idx={idx}
              onClick={() => isAdmin && setDetailId(sf.id)}
              onSuspend={() => handleSuspend(sf)}
              onEdit={() => openEdit(sf)}
              onDelete={() => handleDelete(sf.id, sf.name)}
            />
          ))}
        </div>
      )}

      {/* Slide-over form */}
      {showForm && (
        <RegisterDrawer
          editingId={editingId}
          form={form}
          setForm={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
          isAdmin={isAdmin}
          franchiseUsers={franchiseUsers}
        />
      )}

      {isAdmin && detailId && (
        <LocationDetailPanel
          locationId={detailId}
          locationSettings={locationSettings}
          onClose={() => setDetailId(null)}
        />
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slide-right { animation: slideInRight .3s ease-out both; }
        .animate-fade-in { animation: fadeIn .25s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Branch card                                                        */
/* ------------------------------------------------------------------ */

const BranchCard = ({ sf, isAdmin, isLoaded, idx, onClick, onSuspend, onEdit, onDelete }) => {
  const active = sf.status === 'active';
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition flex flex-col"
      style={{
        animation: isLoaded ? `slideUpFade .35s ease-out ${idx * 50}ms both` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={onClick}
          disabled={!isAdmin}
          className="flex items-center gap-3 min-w-0 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-900 truncate">{sf.name}</p>
              {sf._isHQ && (
                <span className="text-[10px] font-bold tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                  HQ
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">ID: {sf._id}</p>
          </div>
        </button>
        <span
          className={`text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full ${
            active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {active ? 'ACTIVE' : 'SUSPENDED'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <InfoCell
          Icon={User}
          label="Owner / Lead"
          value={sf.manager_name || sf.loginUsername || '—'}
        />
        <InfoCell
          Icon={MapPinIcon}
          label="GSTIN Register"
          value={sf._gstin}
          mono
        />
        <InfoCell
          Icon={Calendar}
          label="License Validity"
          value={sf._validity}
        />
        <InfoCell
          Icon={Award}
          label="Tier Level"
          value={sf._tier}
          valueClass={tierBadgeClass(sf._tier)}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <p className="text-[11px] text-gray-400">
          HQ Auditing {active ? 'Synchronized' : 'Paused'}
        </p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={onSuspend}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                active
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              {active ? 'Suspend Branch' : 'Activate'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onEdit}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition"
            >
              Edit
            </button>
          )}
          {isAdmin && (
            <button
              onClick={onDelete}
              className={`w-7 h-7 rounded-full bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center transition ${
                sf._isHQ ? 'opacity-50' : ''
              }`}
              title="Delete branch"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoCell = ({ Icon, label, value, mono = false, valueClass = '' }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
      {label}
    </p>
    <p
      className={`text-sm font-semibold text-gray-800 mt-1 flex items-center gap-1.5 ${
        mono ? 'font-mono' : ''
      } ${valueClass}`}
    >
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="truncate">{value || '—'}</span>
    </p>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Register drawer (right slide-over)                                 */
/* ------------------------------------------------------------------ */

const RegisterDrawer = ({ editingId, form, setForm, onClose, onSubmit, isAdmin, franchiseUsers }) => (
  <div
    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-fade-in"
    onClick={onClose}
  >
    <div
      className="absolute right-0 top-0 h-full w-full sm:max-w-md bg-white shadow-2xl overflow-y-auto animate-slide-right"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-gray-900">
            {editingId ? 'Edit Branch' : 'Register Sub-Franchise'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
        <FieldUC
          label="Branch Name"
          placeholder="e.g. Madhapur Branch"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          required
        />
        <FieldUC
          label="Owner / Manager Name"
          placeholder="e.g. Ramesh Varma"
          value={form.manager_name}
          onChange={(v) => setForm({ ...form, manager_name: v })}
        />
        <FieldUC
          label="Owner Email"
          type="email"
          placeholder="e.g. ramesh@branch.com"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <FieldUC
          label="GSTIN Number"
          placeholder="e.g. 1234567"
          value={form.gstin}
          onChange={(v) => setForm({ ...form, gstin: v.toUpperCase() })}
          mono
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Sub Tier
            </p>
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
            >
              {TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              License Expires
            </p>
            <input
              type="date"
              value={form.license_validity}
              onChange={(e) => setForm({ ...form, license_validity: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
            />
          </div>
        </div>

        {/* Optional sub-section */}
        <details className="border border-gray-100 rounded-xl">
          <summary className="px-4 py-2.5 text-xs font-semibold text-gray-700 cursor-pointer select-none">
            Advanced (branch code, address, login)
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <FieldUC
              label="Branch Code"
              placeholder="e.g. SF-HYD"
              value={form.code}
              onChange={(v) => setForm({ ...form, code: v.toUpperCase() })}
              mono
            />
            <FieldUC
              label="Address"
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <FieldUC
                label="City"
                value={form.city}
                onChange={(v) => setForm({ ...form, city: v })}
              />
              <FieldUC
                label="Phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </div>
            {isAdmin && franchiseUsers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Franchise Owner
                </p>
                <select
                  value={form.owner_user_id}
                  onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
                >
                  <option value="">— None —</option>
                  {franchiseUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FieldUC
                label="Login Username"
                value={form.login_username}
                onChange={(v) => setForm({ ...form, login_username: v })}
              />
              <FieldUC
                label="Login Password"
                type="password"
                value={form.login_password}
                onChange={(v) => setForm({ ...form, login_password: v })}
              />
            </div>
          </div>
        </details>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold shadow-md hover:shadow-lg transition"
        >
          {editingId ? 'SAVE CHANGES' : 'AUTHORIZE & REGISTER'}
        </button>

        <p className="text-[11px] text-gray-400 leading-relaxed mt-2">
          Onboarding creates a branch registry entry and prepares terminal config variables.
          Owner credentials invitation will be sent to the registered email immediately.
        </p>
      </form>
    </div>
  </div>
);

const FieldUC = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  mono = false,
}) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
      {label}
    </p>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm placeholder:text-gray-300 ${
        mono ? 'font-mono' : ''
      }`}
    />
  </div>
);

export default SubFranchiseManagement;
