/* ------------------------------------------------------------------ */
/*  Role/module permission helpers                                     */
/*                                                                     */
/*  The Module Permissions Matrix (UserManagement → Module Permissions */
/*  Matrix tab) is saved to BOTH localStorage and the server-side      */
/*  /api/settings table under the key `rolePermissionsMatrix`. The     */
/*  shape is:                                                          */
/*                                                                     */
/*    { [roleId]: { [moduleId]: boolean } }                            */
/*                                                                     */
/*  Module IDs are the ones declared in UserManagement.jsx (MODULES). */
/*  Sidebar / route guards use this util so that toggling a module on  */
/*  or off in the matrix controls what each role can see — and the     */
/*  server copy ensures the same permissions apply across browsers,    */
/*  devices and freshly-logged-in staff users.                         */
/* ------------------------------------------------------------------ */

import { getAPI_URL } from './api';

const STORAGE_KEY = 'rolePermissionsMatrix';
const SETTING_KEY = 'rolePermissionsMatrix';
export const PERMISSIONS_UPDATED_EVENT = 'permissions-matrix-updated';

// Default matrix is duplicated here (kept in sync with
// UserManagement.jsx MODULES list) so guards work even before the
// admin has saved the matrix once.
export const DEFAULT_ROLE_MATRIX = {
  admin: {
    dashboard: true,
    reports: true,
    qr_management: true,
    dine_in: true,
    takeaway: true,
    inventory: true,
    billing: true,
    kitchen_display: true,
    menu_management: true,
    user_management: true,
    permissions: true,
    franchise: true,
    settings: true,
    customers: true,
    staff_directory: true,
    attendance: true,
    payroll: true,
  },
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
    payroll: true,
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
    payroll: true,
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
    payroll: true,
  },
};

export const loadPermissionsMatrix = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROLE_MATRIX;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_ROLE_MATRIX;
    // Merge with defaults so any roles/modules missing in the saved
    // matrix still resolve to a sensible value.
    const merged = { ...DEFAULT_ROLE_MATRIX };
    Object.keys(parsed).forEach((roleId) => {
      merged[roleId] = {
        ...(DEFAULT_ROLE_MATRIX[roleId] || {}),
        ...(parsed[roleId] || {}),
      };
    });
    return merged;
  } catch {
    return DEFAULT_ROLE_MATRIX;
  }
};

/**
 * Persist the matrix to localStorage AND the server-side settings
 * table. Falls back gracefully if either side fails — the in-memory
 * UI update succeeds even when the network is offline.
 */
export const savePermissionsMatrix = (matrix) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
    try {
      window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT));
    } catch {
      /* noop */
    }
  } catch {
    /* noop */
  }
  // Best-effort persist to server so other users (different
  // browsers / devices) pick up the new permissions.
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${getAPI_URL()}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        key: SETTING_KEY,
        value: matrix,
        description: 'Role → module permissions matrix',
      }),
    }).catch(() => {
      /* noop */
    });
  } catch {
    /* noop */
  }
};

/**
 * Pull the matrix from the server settings table and write it into
 * localStorage so the rest of the app reads a consistent value.
 * Should be called once on mount of the main app shell. Returns the
 * fetched matrix (or null if no server copy exists yet).
 */
export const fetchPermissionsMatrixFromServer = async () => {
  try {
    const res = await fetch(
      `${getAPI_URL()}/api/settings?key=${encodeURIComponent(SETTING_KEY)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.value && typeof data.value === 'object') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value));
        try {
          window.dispatchEvent(new CustomEvent(PERMISSIONS_UPDATED_EVENT));
        } catch {
          /* noop */
        }
      } catch {
        /* noop */
      }
      return data.value;
    }
    return null;
  } catch {
    return null;
  }
};

const normaliseRole = (role) => {
  const r = String(role || '').trim().toLowerCase();
  // Common aliases — backend sometimes labels admin accounts as
  // "owner" / "superadmin" / "administrator".
  if (['administrator', 'owner', 'superadmin', 'super_admin'].includes(r)) {
    return 'admin';
  }
  return r;
};

/**
 * Returns true when a role is allowed to see a given module ID. If
 * the role isn't in the matrix at all (e.g. `franchise`, `subfranchise`,
 * unknown custom roles), we default to allowing it — those flows have
 * their own dedicated guards in the UI.
 *
 * Admin / super-admin are always allowed.
 */
export const canRoleAccessModule = (role, moduleId, matrix) => {
  const r = normaliseRole(role);
  if (r === 'admin') return true;
  // Roles that aren't part of the staff matrix (franchise/subfranchise
  // owners) — leave their existing guards untouched.
  if (!['admin', 'manager', 'waiter', 'cashier'].includes(r)) {
    return true;
  }
  const m = matrix || loadPermissionsMatrix();
  const roleMap = m[r];
  if (!roleMap || !(moduleId in roleMap)) {
    // Unknown module → fall back to default matrix
    const def = DEFAULT_ROLE_MATRIX[r];
    return def ? !!def[moduleId] : false;
  }
  return !!roleMap[moduleId];
};

export const canRoleAccessAnyModule = (role, moduleIds, matrix) => {
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) return true;
  return moduleIds.some((m) => canRoleAccessModule(role, m, matrix));
};
