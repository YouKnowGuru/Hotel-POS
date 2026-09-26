import React, { useState, useEffect } from 'react';
import NoAccessMessage from './NoAccessMessage';

import { getAPI_URL } from '../utils/api';
import {
  canRoleAccessModule,
  fetchPermissionsMatrixFromServer,
} from '../utils/permissions';

/**
 * Route guard that combines two sources of truth:
 *
 *  1. The Module Permissions Matrix saved by the admin (Settings →
 *     User Management → Module Permissions Matrix). For staff roles
 *     (manager/waiter/cashier) this is authoritative — if the
 *     admin unticked a module, the route is blocked even if the
 *     server-side permissions allow it, and vice-versa.
 *  2. The legacy server-issued permission codes (`/api/my-permissions`)
 *     which still apply to franchise / sub-franchise / unknown roles.
 *
 * Pass `requiredModule="dashboard"` (any matrix module ID) to opt in
 * to the matrix check. The existing `requiredRoles` /
 * `requiredPermissions` props keep working as a fallback for non-staff
 * roles.
 */
const PermissionBasedRoute = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requiredModule = null,
}) => {
  const [userPermissions, setUserPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = String(user.role || '').toLowerCase();
  const isStaffRole = ['manager', 'waiter', 'cashier'].includes(userRole);

  useEffect(() => {
    fetchUserPermissions();
    // Also pull the latest matrix from the server so freshly-logged-in
    // staff users get the admin's saved permissions on any browser.
    fetchPermissionsMatrixFromServer().catch(() => {});
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/my-permissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Admin always passes.
  if (userRole === 'admin') {
    return children;
  }

  // Staff roles: matrix is authoritative.
  if (isStaffRole && requiredModule) {
    return canRoleAccessModule(userRole, requiredModule) ? children : <NoAccessMessage />;
  }

  // Allow if role is in the requiredRoles allow-list (used for
  // franchise / sub-franchise routes).
  if (requiredRoles.length > 0 && requiredRoles.includes(userRole)) {
    return children;
  }

  // Fall back to legacy server-issued permission codes.
  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm)
    );
    if (hasPermission) {
      return children;
    }
  }

  return <NoAccessMessage />;
};

export default PermissionBasedRoute;
