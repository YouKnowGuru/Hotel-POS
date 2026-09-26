import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Search,
  MapPin,
  Phone,
  ShieldCheck,
  Coffee,
  Wallet,
  UserCog,
  Building2,
  RefreshCcw,
  ChevronDown,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { getAPI_URL, getSocketUrl } from '../utils/api';

/* ------------------------------------------------------------------ */
/*  Role pill metadata                                                 */
/* ------------------------------------------------------------------ */

const ROLE_META = {
  admin: {
    label: 'Admin',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    Icon: ShieldCheck,
  },
  manager: {
    label: 'Manager',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    Icon: UserCog,
  },
  waiter: {
    label: 'Waiter',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    Icon: Coffee,
  },

  cashier: {
    label: 'Cashier',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    Icon: Wallet,
  },
  franchise: {
    label: 'Franchise',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    Icon: Building2,
  },
  subfranchise: {
    label: 'Branch Owner',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    Icon: Building2,
  },
};

const roleMeta = (role) =>
  ROLE_META[role] || {
    label: role,
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    Icon: Users,
  };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const avatarColor = (seed) => {
  const colors = [
    'from-orange-500 to-red-500',
    'from-blue-500 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-purple-500 to-pink-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
  ];
  const idx =
    Math.abs(
      (seed || '')
        .split('')
        .reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % colors.length;
  return colors[idx];
};

const initials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Defensively parse a fetch response as JSON. If the server returned
 * HTML (e.g. a 404 page because the backend hasn't been restarted with
 * the new /api/staff endpoint), throw a clean error instead of letting
 * `res.json()` blow up with "Unexpected token '<'".
 */
const safeJson = async (res) => {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const StaffByBranch = ({ token }) => {
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeBranch, setActiveBranch] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  /**
   * Primary loader: tries the new `/api/staff` endpoint first
   * (returns staff + branches in a single round-trip). If that fails
   * — most commonly because the backend hasn't been restarted yet —
   * falls back to the existing `/api/users` + `/api/subfranchises`
   * endpoints so the page still renders meaningfully.
   */
  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };
    const apiUrl = getAPI_URL();

    // Attempt 1 — the new combined endpoint.
    try {
      const res = await fetch(`${apiUrl}/api/staff`, { headers });
      if (res.ok) {
        const data = await safeJson(res);
        if (data && (Array.isArray(data.staff) || Array.isArray(data.branches))) {
          setStaff(Array.isArray(data.staff) ? data.staff : []);
          setBranches(Array.isArray(data.branches) ? data.branches : []);
          setLastUpdatedAt(new Date());
          setLoading(false);
          return;
        }
      }
    } catch {
      /* fall through to legacy endpoints */
    }

    // Attempt 2 — legacy endpoints. Works against any backend version.
    try {
      const [usersRes, branchesRes] = await Promise.all([
        fetch(`${apiUrl}/api/users`, { headers }),
        fetch(`${apiUrl}/api/subfranchises`, { headers }),
      ]);

      let usersData = [];
      let branchesData = [];

      if (usersRes.ok) {
        const u = await safeJson(usersRes);
        if (Array.isArray(u)) usersData = u;
      }
      if (branchesRes.ok) {
        const b = await safeJson(branchesRes);
        if (Array.isArray(b)) branchesData = b;
      }

      if (!usersRes.ok && !branchesRes.ok) {
        throw new Error(
          'Could not reach the backend. Restart the server (so /api/staff is registered) or check the API URL.'
        );
      }

      setStaff(
        usersData.map((u) => ({
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          subfranchise_id: u.subfranchise_id ?? null,
        }))
      );
      setBranches(
        branchesData.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          city: b.city,
          phone: b.phone,
        }))
      );
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load staff directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line
  }, [token]);

  /**
   * Real-time updates:
   *   - socket events emitted by the backend when users / branches change
   *   - polling fallback every 30 s so the directory still self-heals
   *     even if the socket connection drops
   */
  useEffect(() => {
    let pollTimer = null;
    try {
      const socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socketRef.current = socket;
      socket.on('connect', () => setLiveConnected(true));
      socket.on('disconnect', () => setLiveConnected(false));
      const refresh = () => fetchStaff();
      socket.on('user_created', refresh);
      socket.on('user_updated', refresh);
      socket.on('user_deleted', refresh);
      socket.on('subfranchise_created', refresh);
      socket.on('subfranchise_updated', refresh);
      socket.on('subfranchise_deleted', refresh);
    } catch {
      /* socket unavailable — polling will keep us fresh */
    }

    pollTimer = setInterval(() => fetchStaff(), 30000);
    return () => {
      if (pollTimer) clearInterval(pollTimer);
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line
  }, [token]);

  /* --------------------------- grouping -------------------------- */

  const branchById = useMemo(() => {
    const m = new Map();
    branches.forEach((b) => m.set(Number(b.id), b));
    return m;
  }, [branches]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (activeBranch === 'all') {
        // include everyone
      } else if (activeBranch === 'unassigned') {
        if (u.subfranchise_id != null) return false;
      } else {
        if (Number(u.subfranchise_id) !== Number(activeBranch)) return false;
      }
      if (!q) return true;
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });
  }, [staff, search, activeBranch, roleFilter]);

  const branchGroups = useMemo(() => {
    // Always include "Main / HQ" group for users without a branch.
    const groups = new Map();
    groups.set('unassigned', {
      key: 'unassigned',
      name: 'Main Branch / Headquarters',
      meta: { code: 'HQ', city: '—', phone: null },
      staff: [],
    });
    branches.forEach((b) => {
      groups.set(String(b.id), {
        key: String(b.id),
        name: b.name,
        meta: b,
        staff: [],
      });
    });

    filteredStaff.forEach((u) => {
      const key =
        u.subfranchise_id != null ? String(u.subfranchise_id) : 'unassigned';
      const grp = groups.get(key);
      if (grp) grp.staff.push(u);
    });

    // If filter is by a specific branch, only show that group
    if (activeBranch === 'unassigned') {
      return [groups.get('unassigned')];
    }
    if (activeBranch !== 'all') {
      const g = groups.get(String(activeBranch));
      return g ? [g] : [];
    }

    // Order: HQ first, then by branch name
    const all = Array.from(groups.values());
    const hq = all.find((g) => g.key === 'unassigned');
    const rest = all
      .filter((g) => g.key !== 'unassigned')
      .sort((a, b) => a.name.localeCompare(b.name));
    return hq ? [hq, ...rest] : rest;
  }, [filteredStaff, branches, activeBranch]);

  /* --------------------------- stats ----------------------------- */

  const stats = useMemo(() => {
    const totalStaff = staff.length;
    const totalBranches = branches.length;
    const byRole = {};
    staff.forEach((u) => {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });
    return { totalStaff, totalBranches, byRole };
  }, [staff, branches]);

  /* --------------------------- render ---------------------------- */

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header
        className={`mb-6 transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Staff Directory
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  liveConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
                title={
                  liveConnected
                    ? 'Real-time updates connected — changes appear instantly'
                    : 'Polling every 30 seconds — socket disconnected'
                }
              >
                <Wifi className="w-3 h-3" />
                {liveConnected ? 'Live' : 'Auto'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Everyone who works across your branches — grouped by location,
              filtered by role.
              {lastUpdatedAt && (
                <span className="ml-2 text-[11px] text-gray-400">
                  · updated{' '}
                  {lastUpdatedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-60"
          >
            <RefreshCcw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </header>

      {/* KPIs */}
      <section
        className={`mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-all duration-700 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        <KpiCard
          label="Total staff"
          value={stats.totalStaff}
          Icon={Users}
          tint="from-blue-500 to-indigo-500"
        />
        <KpiCard
          label="Branches"
          value={stats.totalBranches}
          Icon={Building2}
          tint="from-emerald-500 to-teal-500"
        />

        <KpiCard
          label="Waiters"
          value={stats.byRole.waiter || 0}
          Icon={Coffee}
          tint="from-purple-500 to-pink-500"
        />
      </section>

      {/* Controls */}
      <section className="mb-5 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name, username or role..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white"
            />
          </div>

          {/* Branch filter */}
          <div className="relative">
            <select
              value={activeBranch}
              onChange={(e) => setActiveBranch(e.target.value)}
              className="appearance-none pl-3 pr-9 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="all">All branches</option>
              <option value="unassigned">Main / HQ only</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Role filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none pl-3 pr-9 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>

              <option value="waiter">Waiter</option>
              <option value="cashier">Cashier</option>
              <option value="franchise">Franchise</option>
              <option value="subfranchise">Branch Owner</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Error / hint */}
      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Couldn&apos;t load the latest staff list</p>
            <p className="text-amber-700 mt-0.5 text-[12px]">{error}</p>
          </div>
        </div>
      )}

      {/* Branch groups */}
      <section className="space-y-5">
        {branchGroups.map((grp, idx) => (
          <BranchGroup
            key={grp.key}
            group={grp}
            visible={isLoaded}
            delay={idx * 70}
          />
        ))}

        {!loading && branchGroups.every((g) => g.staff.length === 0) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">
              No staff members match your filters
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Try changing the branch / role filter or clearing the search.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const KpiCard = ({ label, value, Icon, tint }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[11px] font-bold tracking-wider text-gray-400 uppercase">
        {label}
      </span>
      <span
        className={`w-8 h-8 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center`}
      >
        <Icon className="w-4 h-4 text-white" />
      </span>
    </div>
    <p className="text-2xl font-extrabold tracking-tight text-gray-900">
      {value}
    </p>
  </div>
);

const BranchGroup = ({ group, visible, delay = 0 }) => {
  const byRole = group.staff.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-500 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </span>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {group.name}
              </h3>
              <div className="mt-0.5 flex items-center gap-3 text-[12px] text-gray-500 flex-wrap">
                {group.meta?.code && (
                  <span className="font-mono font-semibold text-gray-600">
                    {group.meta.code}
                  </span>
                )}
                {group.meta?.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {group.meta.city}
                  </span>
                )}
                {group.meta?.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {group.meta.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Role counters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold tracking-wider uppercase">
              {group.staff.length} member{group.staff.length === 1 ? '' : 's'}
            </span>
            {Object.entries(byRole).map(([role, count]) => {
              const meta = roleMeta(role);
              return (
                <span
                  key={role}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.bg} ${meta.color} flex items-center gap-1`}
                >
                  <meta.Icon className="w-3 h-3" />
                  {count}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Staff cards */}
      <div className="p-4 sm:p-5">
        {group.staff.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-6">
            No staff assigned to this branch yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.staff.map((u) => (
              <StaffCard key={u.id} user={u} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StaffCard = ({ user }) => {
  const meta = roleMeta(user.role);
  return (
    <div className="group p-4 rounded-2xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all bg-white">
      <div className="flex items-start gap-3">
        <span
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarColor(
            user.name || user.username || ''
          )} flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0`}
        >
          {initials(user.name || user.username)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">
            {user.name || user.username}
          </p>
          <p className="text-[11px] text-gray-500 truncate">
            @{user.username}
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color}`}
          >
            <meta.Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StaffByBranch;
