import React, { useState, useEffect } from 'react';
import Notification from './Notification';
import {
  Users,
  Clipboard,
  Box,
  CreditCard,
  BarChart2,
  Settings,
  Lock,
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { getAPI_URL } from '../utils/api';

const PERMISSION_GROUPS = {
  user_management: {
    title: 'User Management',
    icon: <Users className="inline-block mr-2 text-orange-500" />,
    description: 'Control who can access the system',
    permissions: [
      { name: 'view_users', label: 'View Staff List', simple: 'See all employees in the system' },
      { name: 'create_user', label: 'Add New Staff', simple: 'Create new employee accounts' },
      { name: 'edit_user', label: 'Edit Staff Info', simple: 'Change employee details' },
      { name: 'delete_user', label: 'Remove Staff', simple: 'Delete employee accounts' },
      { name: 'manage_roles', label: 'Assign Roles', simple: 'Give employees different job titles with permissions' },
    ],
  },
  menu_management: {
    title: 'Menu Management',
    icon: <Box className="inline-block mr-2 text-orange-500" />,
    description: 'Manage restaurant menu items',
    permissions: [
      { name: 'view_menu', label: 'View Menu', simple: 'See all dishes and items' },
      { name: 'create_menu_item', label: 'Add Dishes', simple: 'Add new items to the menu' },
      { name: 'edit_menu_item', label: 'Edit Dishes', simple: 'Change dish names, prices, descriptions' },
      { name: 'delete_menu_item', label: 'Remove Dishes', simple: 'Delete items from menu' },
    ],
  },
  order_management: {
    title: 'Order Management',
    icon: <Clipboard className="inline-block mr-2 text-orange-500" />,
    description: 'Handle customer orders',
    permissions: [
      { name: 'view_orders', label: 'View Orders', simple: 'See all customer orders' },
      { name: 'create_order', label: 'Create Orders', simple: 'Take orders from customers' },
      { name: 'edit_order', label: 'Edit Orders', simple: 'Modify order details' },
      { name: 'delete_order', label: 'Cancel Orders', simple: 'Cancel customer orders' },
      { name: 'manage_qr_codes', label: 'QR Code Ordering', simple: 'Allow customers to order via QR codes' },
      { name: 'mark_order_preparing', label: 'Mark Orders Preparing', simple: 'Mark orders as being prepared in kitchen' },
      { name: 'mark_order_ready', label: 'Mark Orders Ready', simple: 'Mark orders as ready for pickup' },
      { name: 'confirm_order_delivery', label: 'Confirm Delivery', simple: 'Confirm order delivery and generate bills' },
    ],
  },
  inventory_management: {
    title: 'Inventory Management',
    icon: <Box className="inline-block mr-2 text-orange-500" />,
    description: 'Track stock and ingredients',
    permissions: [
      { name: 'view_inventory', label: 'Check Stock', simple: 'See what items are in stock' },
      { name: 'edit_inventory', label: 'Update Stock', simple: 'Add or remove items from inventory' },
    ],
  },
  billing: {
    title: 'Billing & Payments',
    icon: <CreditCard className="inline-block mr-2 text-orange-500" />,
    description: 'Process payments and bills',
    permissions: [
      { name: 'view_billing', label: 'View Bills', simple: 'See billing information' },
      { name: 'process_payments', label: 'Process Payments', simple: 'Accept and process customer payments' },
      { name: 'view_bills', label: 'Bill History', simple: 'View past bills and transactions' },
    ],
  },
  reporting: {
    title: 'Dashboard & Reports',
    icon: <BarChart2 className="inline-block mr-2 text-orange-500" />,
    description: 'View business analytics',
    permissions: [
      { name: 'view_dashboard', label: 'View Dashboard', simple: 'See sales, orders, and business overview' },
      { name: 'view_reports', label: 'View Reports', simple: 'Access detailed business reports' },
      { name: 'kitchen_display', label: 'Kitchen Display', simple: 'View orders in kitchen' },
    ],
  },
  settings: {
    title: 'System Settings',
    icon: <Settings className="inline-block mr-2 text-orange-500" />,
    description: 'Configure system features',
    permissions: [
      { name: 'manage_settings', label: 'System Settings', simple: 'Configure system preferences' },
      { name: 'manage_subfranchise', label: 'Multi-Location Control', simple: 'Manage multiple restaurant locations' },
    ],
  },
};

const PermissionManagementNew = ({ token }) => {
  const [activeTab, setActiveTab] = useState('roles');
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);

  // Fetch users with permissions
  const fetchUsersWithPermissions = async () => {
    try {
      setLoading(true);
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users-with-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.filter((u) => u.role !== "admin"));
    } catch (err) {
      setNotification({ message: 'Could not load users', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions
  const fetchPermissions = async () => {
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setNotification({ message: 'Could not load permissions', type: 'error' });
    }
  };

  useEffect(() => {
    fetchUsersWithPermissions();
    fetchPermissions();
  }, []);

  // Create role - REMOVED as per user request
  // Roles are now managed through User Management only

  const togglePermission = (permName) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName]
    );
  };

  const startEditingUser = (user) => {
    setEditingUserId(user.id);
    setSelectedPermissions(user.permissions || []);
    setExpandedUser(user.id);
  };

  const handleUpdateUserPermissions = async (userId) => {
    try {
      const API_URL = getAPI_URL();
      const response = await fetch(`${API_URL}/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: selectedPermissions }),
      });

      if (response.ok) {
        setNotification({ message: 'Permissions updated successfully! ✓', type: 'success' });
        setEditingUserId(null);
        fetchUsersWithPermissions();
      } else {
        const error = await response.json();
        setNotification({ message: error.message, type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-8 p-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center">
            <Lock className="mr-3 text-white" /> System Access Control
          </h1>
          <p className="text-orange-100 text-lg">Manage who can do what in your restaurant</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b-2 border-orange-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
              activeTab === 'roles'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/50'
            }`}
          >
            <span className="inline-flex items-center gap-2"><Users className="text-orange-500" /> Manage Roles (Jobs)</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-3 font-semibold transition-all rounded-t-lg ${
              activeTab === 'permissions'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                : 'text-gray-600 hover:text-orange-600 hover:bg-orange-50/50'
            }`}
          >
            <span className="inline-flex items-center gap-2"><Clipboard className="text-orange-500" /> View Permissions</span>
          </button>
        </div>

        {/* Roles Tab - Now showing Users */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {/* Users with Permissions */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-900">Manage User Permissions</h2>
              <p className="text-gray-600">Click on a user to view and edit their permissions. Administrator has full access and is not listed here.</p>
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-orange-600 font-medium">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center bg-white rounded-2xl shadow-lg p-12 border border-orange-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-orange-500" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">No users found</p>
                  <p className="text-gray-500 text-sm mt-1">Create users in User Management first</p>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white rounded-2xl border-2 border-orange-100 overflow-hidden hover:border-orange-300 hover:shadow-xl transition-all duration-300"
                  >
                    <button
                      onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                      className="w-full px-6 py-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/50 transition-all duration-300"
                    >
                      <div className="text-left flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-md">
                          <span className="text-lg font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{user.name} <span className="text-gray-500 font-normal">({user.username})</span></h3>
                          <p className="text-gray-600 text-sm mt-1">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'admin' ? 'bg-red-100 text-red-700 border border-red-200' :
                              user.role === 'manager' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                              user.role === 'waiter' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                              user.role === 'franchise' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                              'bg-green-100 text-green-700 border border-green-200'
                            }`}>
                              {user.role}
                            </span>
                            <span className="ml-3 text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-full text-xs">
                              {user.permissions?.length || 0} permissions
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-gray-500">{expandedUser === user.id ? <ChevronDown /> : <ChevronRight />}</div>
                    </button>

                    {expandedUser === user.id && (
                      <div className="bg-gray-50 border-t border-gray-100 p-6">
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-4">Current Permissions: {user.permissions?.length || 0}</h4>
                          {editingUserId === user.id ? (
                            <div className="space-y-6">
                              <div className="grid md:grid-cols-2 gap-4">
                                {Object.values(PERMISSION_GROUPS).map((group) => (
                                  <div key={group.title} className="bg-white rounded-xl p-4 border-2 border-orange-100 shadow-sm hover:shadow-md transition-all duration-300">
                                    <h3 className="font-semibold text-orange-700 mb-3 flex items-center gap-2 pb-2 border-b border-orange-100">
                                      {group.icon} {group.title}
                                    </h3>
                                    <div className="space-y-2">
                                      {group.permissions.map((perm) => (
                                        <label key={perm.name} className="flex items-start gap-3 cursor-pointer hover:bg-orange-50 p-2 rounded-lg transition-all duration-200">
                                          <input
                                            type="checkbox"
                                            checked={selectedPermissions.includes(perm.name)}
                                            onChange={() => togglePermission(perm.name)}
                                            className="w-5 h-5 mt-0.5 rounded accent-orange-500 cursor-pointer"
                                          />
                                          <div>
                                            <div className="font-medium text-gray-800">{perm.label}</div>
                                            <div className="text-xs text-gray-500">{perm.simple}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleUpdateUserPermissions(user.id)}
                                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 inline-flex items-center justify-center gap-2"
                                >
                                  <Check className="w-5 h-5" /> Save Changes
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  className="flex-1 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 inline-flex items-center justify-center gap-2"
                                >
                                  <X className="w-5 h-5" /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {user.permissions?.length > 0 ? (
                                  user.permissions.map((perm) => (
                                    <span
                                      key={perm}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-emerald-700 rounded-full text-sm border border-emerald-200 font-medium"
                                    >
                                      <Check className="w-4 h-4 text-emerald-500" /> {perm.replace(/_/g, ' ')}
                                    </span>
                                  ))
                                ) : (
                                  <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm">No permissions assigned</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => startEditingUser(user)}
                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" /> Edit Permissions
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">All Available Permissions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(PERMISSION_GROUPS).map((group) => (
                <div key={group.title} className="bg-white rounded-2xl p-6 border-2 border-orange-100 shadow-sm hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                  <h3 className="text-xl font-bold text-orange-600 mb-2 flex items-center gap-2 pb-3 border-b border-orange-100">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-md">
                      {React.cloneElement(group.icon, { className: "w-5 h-5 text-white mr-0" })}
                    </div>
                    {group.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">{group.description}</p>
                  <div className="space-y-3">
                    {group.permissions.map((perm) => (
                      <div key={perm.name} className="bg-gradient-to-r from-orange-50 to-white rounded-xl p-3 border border-orange-100 hover:border-orange-200 transition-colors duration-200">
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                          {perm.label}
                        </div>
                        <div className="text-sm text-gray-500 ml-4">{perm.simple}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionManagementNew;
