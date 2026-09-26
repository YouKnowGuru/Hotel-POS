import React, { useState, useEffect, useMemo } from 'react';
import Notification from './Notification';
import { getAPI_URL } from '../utils/api';
import { savePermissionsMatrix } from '../utils/permissions';
import {
  Users,
  Shield,
  LayoutGrid,
  Search,
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  ChevronRight,
  Save,
  UserCog,
  Briefcase,
  Wallet,
  Crown,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROLES = ['admin', 'franchise', 'subfranchise', 'manager', 'waiter', 'cashier'];

const TABS = [
  { id: 'users', label: 'User Management', Icon: Users },
  { id: 'roles', label: 'Role Management', Icon: Shield },
  { id: 'matrix', label: 'Module Permissions Matrix', Icon: LayoutGrid },
];

const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'qr_management', label: 'QR Management' },
  { id: 'dine_in', label: 'Dine-In' },
  { id: 'takeaway', label: 'Takeaway' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'billing', label: 'Billing' },
  { id: 'kitchen_display', label: 'Kitchen Display' },
  { id: 'menu_management', label: 'Menu Management' },
  { id: 'user_management', label: 'User Management' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'franchise', label: 'Franchise' },
  { id: 'settings', label: 'Settings' },
  { id: 'customers', label: 'Customers (CRM)' },
  { id: 'staff_directory', label: 'Staff Directory' },
  { id: 'attendance', label: 'Attendance' },
];

const ROLE_META = {
  admin: {
    label: 'Admin',
    Icon: Crown,
    pill: 'bg-orange-50 text-orange-600 border-orange-100',
    bar: 'from-orange-400 to-orange-500',
    dot: 'bg-orange-500',
    access: 'Full Access',
    accessClass: 'text-gray-700 bg-gray-100',
    description:
      'Unrestricted administrative access to all restaurant branches, system configurations, billing, and system audits.',
    immutable: true,
  },
  manager: {
    label: 'Manager',
    Icon: Briefcase,
    pill: 'bg-blue-50 text-blue-600 border-blue-100',
    bar: 'from-blue-400 to-blue-500',
    dot: 'bg-blue-500',
    access: 'Custom Access',
    accessClass: 'text-gray-700 bg-gray-100',
    description:
      'Manage daily operations including menu management, inventory items, sub-franchise settings, and operational reports.',
  },
  waiter: {
    label: 'Waiter',
    Icon: UserCog,
    pill: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    bar: 'from-emerald-400 to-emerald-500',
    dot: 'bg-emerald-500',
    access: 'Restricted Access',
    accessClass: 'text-gray-700 bg-gray-100',
    description:
      'Front-of-house table service management, checkout billing, order taking, and KDS updates for dine-in tables.',
  },

  cashier: {
    label: 'Cashier',
    Icon: Wallet,
    pill: 'bg-slate-50 text-slate-600 border-slate-200',
    bar: 'from-slate-400 to-slate-500',
    dot: 'bg-slate-500',
    access: 'Restricted Access',
    accessClass: 'text-gray-700 bg-gray-100',
    description:
      'Order collection payments processing, takeaway order creations, invoices generation, and POS terminal management.',
  },
};

const DEFAULT_ROLE_MATRIX = {
  admin: MODULES.reduce((a, m) => ({ ...a, [m.id]: true }), {}),
  manager: {
    dashboard: true,
    reports: true,
    qr_management: true,
    dine_in: true,
    takeaway: true,
    inventory: true,
    billing: true,
    kitchen_display: true,
    menu_management: true,
    user_management: false,
    permissions: false,
    franchise: true,
    settings: true,
    customers: true,
    staff_directory: true,
    attendance: true,
  },
  waiter: {
    dashboard: true,
    reports: false,
    qr_management: false,
    dine_in: true,
    takeaway: true,
    inventory: false,
    billing: false,
    kitchen_display: true,
    menu_management: false,
    user_management: false,
    permissions: false,
    franchise: false,
    settings: false,
    customers: false,
    staff_directory: false,
    attendance: true,
  },

  cashier: {
    dashboard: true,
    reports: false,
    qr_management: false,
    dine_in: false,
    takeaway: true,
    inventory: false,
    billing: true,
    kitchen_display: false,
    menu_management: false,
    user_management: false,
    permissions: false,
    franchise: false,
    settings: false,
    customers: true,
    staff_directory: false,
    attendance: true,
  },
};

const ROLES_FOR_MATRIX = ['admin', 'manager', 'waiter', 'cashier'];

const AVATAR_COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-rose-500',
];

const avatarColor = (key = '') => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 9973;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const lastActivityLabel = (user) => {
  const src =
    user.updated_at || user.updatedAt || user.last_login || user.created_at || user.createdAt;
  if (!src) return 'Recently';
  const ms = Date.now() - new Date(src).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'Recently';
  const min = Math.floor(ms / 60000);
  if (min < 2) return 'Just now';
  if (min < 60) return `${min} mins ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(src).toLocaleDateString();
};

const buildEmail = (user) => {
  if (user.email) return user.email;
  return `${user.username || 'user'}@restaurant.com`;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const UserManagement = ({ token }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'waiter',
    subfranchise_id: '',
  });
  const [branches, setBranches] = useState([]);

  const [matrix, setMatrix] = useState(DEFAULT_ROLE_MATRIX);
  const [dirty, setDirty] = useState(false);

  /* ------------------------------ data ------------------------------ */
  useEffect(() => {
    fetchUsers();
    fetchBranches();
    // eslint-disable-next-line
  }, [token]);

  const fetchBranches = async () => {
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/subfranchises`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setBranches(Array.isArray(data) ? data : []);
      }
    } catch {
      /* admin may not have franchise access in demo — ignore */
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'waiter',
      subfranchise_id: '',
    });
    setShowUserModal(true);
  };

  const openEditModal = (user) => {
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      subfranchise_id:
        user.subfranchise_id != null ? String(user.subfranchise_id) : '',
    });
    setEditingId(user.id);
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingId(null);
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'waiter',
      subfranchise_id: '',
    });
  };

  const buildUserPayload = () => {
    const subfranchise_id =
      formData.subfranchise_id !== '' && formData.subfranchise_id != null
        ? Number(formData.subfranchise_id)
        : null;
    return {
      username: formData.username,
      name: formData.name,
      role: formData.role,
      subfranchise_id,
      ...(formData.password ? { password: formData.password } : {}),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.role) {
      setNotification({
        message: 'Username, name, and role are required',
        type: 'error',
      });
      return;
    }
    if (!editingId && !formData.password) {
      setNotification({
        message: 'Password is required for new users',
        type: 'error',
      });
      return;
    }
    if (formData.password && formData.password.length < 4) {
      setNotification({
        message: 'Password must be at least 4 characters',
        type: 'error',
      });
      return;
    }
    try {
      const API_URL = getAPI_URL();
      const url = editingId
        ? `${API_URL}/api/users/${editingId}`
        : `${API_URL}/api/users`;
      const method = editingId ? 'PUT' : 'POST';
      const body = buildUserPayload();
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotification({
          message: data.message || 'Operation failed',
          type: 'error',
        });
        return;
      }
      setNotification({
        message: editingId ? 'User updated successfully!' : 'User created successfully!',
        type: 'success',
      });
      closeUserModal();
      fetchUsers();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (!response.ok) {
        setNotification({
          message: data.message || 'Failed to delete user',
          type: 'error',
        });
        return;
      }
      setNotification({
        message: `User "${username}" deleted successfully!`,
        type: 'success',
      });
      fetchUsers();
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  /* ------------------------------ derived ------------------------------ */
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q) ||
        buildEmail(u).toLowerCase().includes(q)
    );
  }, [users, search]);

  const roleCoverage = useMemo(() => {
    const out = {};
    ROLES_FOR_MATRIX.forEach((r) => {
      const m = matrix[r] || {};
      const count = MODULES.reduce((acc, mod) => acc + (m[mod.id] ? 1 : 0), 0);
      out[r] = {
        count,
        total: MODULES.length,
        percent: Math.round((count / MODULES.length) * 100),
      };
    });
    return out;
  }, [matrix]);

  const toggleMatrix = (role, moduleId) => {
    if (role === 'admin') return;
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...prev[role], [moduleId]: !prev[role]?.[moduleId] },
    }));
    setDirty(true);
  };

  const saveMatrix = () => {
    try {
      // savePermissionsMatrix persists to localStorage AND fires a
      // window event so the Sidebar (and any other listeners) can
      // re-render immediately — no page reload required.
      savePermissionsMatrix(matrix);
      setDirty(false);
      setNotification({
        message:
          'Permissions matrix saved. Roles will see the new modules on their next page load.',
        type: 'success',
      });
      setTimeout(() => setNotification(null), 2600);
    } catch (err) {
      setNotification({ message: 'Failed to save matrix.', type: 'error' });
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rolePermissionsMatrix');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMatrix((prev) => ({ ...prev, ...parsed }));
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

  /* ------------------------------ render ------------------------------ */
  const renderHeaderAction = () => {
    if (activeTab === 'users') {
      return (
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <Plus className="w-4 h-4" />
          ADD USER
        </button>
      );
    }
    if (activeTab === 'roles') {
      return (
        <button
          onClick={() => setActiveTab('matrix')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition"
        >
          <Plus className="w-4 h-4" />
          CREATE ROLE
        </button>
      );
    }
    return (
      <button
        onClick={saveMatrix}
        disabled={!dirty}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md transition ${
          dirty
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-200/60 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
            : 'bg-gray-300 cursor-not-allowed shadow-none'
        }`}
      >
        <Save className="w-4 h-4" />
        SAVE CHANGES
      </button>
    );
  };

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
            User &amp; Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consolidated administration of security credentials, access levels, and module
            authorizations
          </p>
        </div>
        {renderHeaderAction()}
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 sm:gap-2 mb-5 border-b border-gray-200">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold transition ${
                active ? 'text-orange-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-orange-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && (
        <UsersTab
          users={filteredUsers}
          loading={loading}
          search={search}
          setSearch={setSearch}
          onEdit={openEditModal}
          onDelete={handleDelete}
          isLoaded={isLoaded}
        />
      )}
      {activeTab === 'roles' && (
        <RolesTab
          coverage={roleCoverage}
          onConfigure={() => setActiveTab('matrix')}
          isLoaded={isLoaded}
        />
      )}
      {activeTab === 'matrix' && (
        <MatrixTab matrix={matrix} coverage={roleCoverage} onToggle={toggleMatrix} />
      )}

      {/* User Modal */}
      {showUserModal && (
        <UserFormModal
          editingId={editingId}
          formData={formData}
          branches={branches}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onClose={closeUserModal}
        />
      )}

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-modal-in { animation: fadeScale .22s ease-out both; }
        .animate-row-in { animation: rowIn .35s ease-out both; }
      `}</style>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Users tab                                                          */
/* ------------------------------------------------------------------ */

const UsersTab = ({ users, loading, search, setSearch, onEdit, onDelete, isLoaded }) => (
  <div>
    <div className="relative mb-4">
      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        placeholder="Search user by name, username, or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 shadow-sm"
      />
    </div>

    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="hidden md:grid grid-cols-[2fr_1fr_0.8fr_1fr_0.6fr] gap-4 px-6 py-3 bg-gray-50/70 border-b border-gray-100 text-[11px] font-bold text-gray-500 tracking-wider uppercase">
        <div>User Details</div>
        <div>System Role</div>
        <div>Status</div>
        <div>Last Activity</div>
        <div className="text-right">Actions</div>
      </div>

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-gray-400">
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-400">No users found</p>
        </div>
      ) : (
        users.map((u, idx) => {
          const meta = ROLE_META[u.role] || ROLE_META.cashier;
          return (
            <div
              key={u.id}
              className="grid grid-cols-1 md:grid-cols-[2fr_1fr_0.8fr_1fr_0.6fr] gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-orange-50/30 transition"
              style={{
                animation: isLoaded
                  ? `slideUpFade .3s ease-out ${idx * 30}ms both`
                  : 'none',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full ${avatarColor(
                    u.username || u.name || ''
                  )} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                >
                  {(u.name || u.username || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {u.name || u.username}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    @{u.username} · {buildEmail(u)}
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${meta.pill}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </div>

              <div className="flex items-center">
                <span className="inline-flex items-center text-[11px] font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  ACTIVE
                </span>
              </div>

              <div className="flex items-center text-xs text-gray-500">
                {lastActivityLabel(u)}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onEdit(u)}
                  className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-orange-50 text-gray-500 hover:text-orange-500 flex items-center justify-center transition"
                  title="Edit user"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(u.id, u.username)}
                  className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-rose-50 text-gray-500 hover:text-rose-500 flex items-center justify-center transition"
                  title="Delete user"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Roles tab                                                          */
/* ------------------------------------------------------------------ */

const RolesTab = ({ coverage, onConfigure, isLoaded }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {ROLES_FOR_MATRIX.map((roleId, idx) => {
      const meta = ROLE_META[roleId];
      const cov = coverage[roleId] || { count: 0, total: MODULES.length, percent: 0 };
      const Icon = meta.Icon;
      return (
        <div
          key={roleId}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col hover:shadow-md transition"
          style={{
            animation: isLoaded
              ? `slideUpFade .35s ease-out ${idx * 60}ms both`
              : 'none',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${meta.pill}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
            <span
              className={`text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-full ${meta.accessClass}`}
            >
              {meta.access}
            </span>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            {meta.description}
          </p>

          <div className="mt-auto">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-2">
              <span>Module Coverage</span>
              <span className="text-gray-700">
                {cov.count} of {cov.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${meta.bar} transition-all duration-500`}
                style={{ width: `${cov.percent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-gray-500">{cov.percent}% access level</span>
              <button
                onClick={onConfigure}
                className="inline-flex items-center gap-1 text-orange-500 hover:text-orange-600 font-semibold transition"
              >
                Configure matrix
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Matrix tab                                                         */
/* ------------------------------------------------------------------ */

const MatrixTab = ({ matrix, coverage, onToggle }) => (
  <div className="space-y-5">
    {/* Summary header */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {ROLES_FOR_MATRIX.map((roleId) => {
        const meta = ROLE_META[roleId];
        const cov = coverage[roleId];
        return (
          <div
            key={roleId}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold ${meta.text || meta.pill}`}>
                <span className={`inline-block ${meta.dot} w-1.5 h-1.5 rounded-full mr-1.5 align-middle`} />
                {meta.label}
              </span>
              <span className="text-[11px] font-semibold text-gray-500">
                {cov.count}/{cov.total}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${meta.bar} transition-all duration-500`}
                style={{ width: `${cov.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {cov.percent}% access
            </p>
          </div>
        );
      })}
    </div>

    {/* Matrix table */}
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-[1.6fr_repeat(5,1fr)] gap-4 px-6 py-3 bg-gray-50/70 border-b border-gray-100 items-center">
        <div className="text-[11px] font-bold tracking-wider uppercase text-gray-500 inline-flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5" />
          System Modules
        </div>
        {ROLES_FOR_MATRIX.map((roleId) => {
          const meta = ROLE_META[roleId];
          return (
            <div key={roleId} className="text-center">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${meta.pill}`}
              >
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {MODULES.map((mod, idx) => (
        <div
          key={mod.id}
          className="grid grid-cols-[1.6fr_repeat(5,1fr)] gap-4 px-6 py-4 border-b border-gray-50 last:border-0 items-center hover:bg-orange-50/20 transition"
          style={{ animation: `slideUpFade .3s ease-out ${idx * 20}ms both` }}
        >
          <div className="text-sm font-semibold text-gray-800">{mod.label}</div>
          {ROLES_FOR_MATRIX.map((roleId) => {
            const enabled = !!matrix[roleId]?.[mod.id];
            const immutable = roleId === 'admin';
            return (
              <div key={roleId} className="flex justify-center">
                <button
                  onClick={() => !immutable && onToggle(roleId, mod.id)}
                  disabled={immutable}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                    enabled
                      ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  } ${immutable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  title={
                    immutable
                      ? 'System administrators retain immutable root privilege'
                      : 'Click to toggle access'
                  }
                >
                  {enabled ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <X className="w-3.5 h-3.5" strokeWidth={3} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ))}

      <div className="flex items-center justify-between flex-wrap gap-2 px-6 py-3 bg-gray-50/50 border-t border-gray-100">
        <p className="text-[11px] text-gray-500">
          Click on cells to instantly grant or revoke modules authorizations.
        </p>
        <p className="text-[11px] text-gray-500">
          System administrators retain immutable root privilege.
        </p>
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  User form modal                                                    */
/* ------------------------------------------------------------------ */

const UserFormModal = ({
  editingId,
  formData,
  branches,
  onChange,
  onSubmit,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-modal-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {editingId ? 'Edit User' : 'Add User'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="Username"
          name="username"
          value={formData.username}
          onChange={onChange}
          placeholder="e.g. john"
          disabled={!!editingId}
        />
        <Field
          label="Full Name"
          name="name"
          value={formData.name}
          onChange={onChange}
          placeholder="e.g. John Doe"
        />
        <Field
          label={`Password ${editingId ? '(leave blank to keep current)' : ''}`}
          name="password"
          type="password"
          value={formData.password}
          onChange={onChange}
          placeholder={editingId ? 'Leave blank to keep current' : 'min 4 chars'}
          required={!editingId}
        />
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
            Role
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={onChange}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {formData.role !== 'admin' && (
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Restaurant / Branch
            </label>
            <select
              name="subfranchise_id"
              value={formData.subfranchise_id}
              onChange={onChange}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm bg-white"
            >
              <option value="">Main Branch / HQ (no branch)</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                  {b.code ? ` (${b.code})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Assign a branch so this login only sees that restaurant&apos;s orders,
              dashboard and kitchen display.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold shadow-md hover:shadow-lg transition"
          >
            {editingId ? 'Update' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

const Field = ({ label, name, type = 'text', value, onChange, placeholder, disabled, required }) => (
  <div>
    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none text-sm ${
        disabled ? 'bg-gray-50 cursor-not-allowed text-gray-500' : 'bg-white'
      }`}
    />
  </div>
);

export default UserManagement;
