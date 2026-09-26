import React, { useState, useEffect } from 'react';
import Notification from './Notification';
import { getAPI_URL } from '../utils/api';

const PermissionManagement = ({ token }) => {
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [editingRoleId, setEditingRoleId] = useState(null);

  // Fetch roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getAPI_URL()}/api/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setNotification({ message: 'Error fetching roles', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions
  const fetchPermissions = async () => {
    try {
      const response = await fetch(`${getAPI_URL()}/api/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      setNotification({ message: 'Error fetching permissions', type: 'error' });
    }
  };

  // Create role
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName) {
      setNotification({ message: 'Role name is required', type: 'error' });
      return;
    }

    try {
      const response = await fetch(`${getAPI_URL()}/api/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDesc,
          permissions: selectedPermissions,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setNotification({ message: 'Role created successfully', type: 'success' });
        setNewRoleName('');
        setNewRoleDesc('');
        setSelectedPermissions([]);
        fetchRoles();
      } else {
        setNotification({ message: data.message || 'Error creating role', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  // Update role permissions
  const handleUpdateRolePermissions = async (roleId) => {
    try {
      const response = await fetch(`${getAPI_URL()}/api/roles/${roleId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: selectedPermissions }),
      });

      const data = await response.json();
      if (response.ok) {
        setNotification({ message: 'Role permissions updated successfully', type: 'success' });
        setEditingRoleId(null);
        setSelectedPermissions([]);
        fetchRoles();
      } else {
        setNotification({ message: data.message || 'Error updating role', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    }
  };

  // Toggle permission
  const togglePermission = (permName) => {
    setSelectedPermissions((prev) =>
      prev.includes(permName)
        ? prev.filter((p) => p !== permName)
        : [...prev, permName]
    );
  };

  // Start editing role
  const startEditingRole = (role) => {
    setEditingRoleId(role.id);
    setSelectedPermissions(role.permissions || []);
  };

  // Load both roles and permissions on component mount
  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  // Re-fetch when tab changes
  useEffect(() => {
    if (activeTab === 'roles') fetchRoles();
    if (activeTab === 'permissions') fetchPermissions();
  }, [activeTab]);

  return (
    <div className="min-h-screen p-6 bg-[#FFF8F0]">
      {/* Header Section - Orange Theme */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-xl rounded-2xl mb-6">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Permission Management</h1>
              <p className="text-orange-100 text-base">Manage roles and permissions</p>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-2 rounded-xl backdrop-blur-sm">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-white text-sm font-medium">Security</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-orange-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'roles'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            Manage Roles
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'permissions'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-orange-600'
            }`}
          >
            View Permissions
          </button>
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Create Role Form */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Role</h2>
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300"
                    placeholder="e.g., supervisor"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300"
                    placeholder="Role description"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign Permissions
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {permissions.length > 0 ? (
                      permissions.map((perm) => (
                        <label key={perm.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.name)}
                            onChange={() => togglePermission(perm.name)}
                            className="w-4 h-4 text-orange-500 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {perm.name} ({perm.category})
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-gray-500">No permissions available</p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary"
                >
                  Create Role
                </button>
              </form>
            </div>

            {/* Existing Roles */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Existing Roles</h2>
              {loading ? (
                <p className="text-gray-500">Loading...</p>
              ) : roles.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <h3 className="font-bold text-gray-800">{role.name}</h3>
                      <p className="text-sm text-gray-600">{role.description}</p>
                      <div className="mt-2">
                        <p className="text-xs text-gray-700 font-medium">Permissions:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {role.permissions && role.permissions.length > 0 ? (
                            role.permissions.map((perm) => (
                              <span
                                key={perm}
                                className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded"
                              >
                                {perm}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">No permissions</span>
                          )}
                        </div>
                      </div>

                      {editingRoleId === role.id ? (
                        <div className="mt-3 space-y-2">
                          <div className="space-y-2">
                            {permissions.map((perm) => (
                              <label key={perm.id} className="flex items-center text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(perm.name)}
                                  onChange={() => togglePermission(perm.name)}
                                  className="w-3 h-3 text-orange-500"
                                />
                                <span className="ml-2">{perm.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateRolePermissions(role.id)}
                              className="flex-1 bg-green-600 text-white text-xs py-1 rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRoleId(null)}
                              className="flex-1 bg-gray-400 text-white text-xs py-1 rounded hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingRole(role)}
                          className="mt-3 w-full bg-gray-600 text-white text-xs py-1 rounded hover:bg-gray-700"
                        >
                          Edit Permissions
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No roles found</p>
              )}
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">All Permissions</h2>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : permissions.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {permissions.map((perm) => (
                  <div key={perm.id} className="p-4 border border-gray-200 rounded-lg">
                    <h3 className="font-bold text-gray-800">{perm.name}</h3>
                    <p className="text-sm text-gray-600">{perm.description}</p>
                    <span className="inline-block mt-2 bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded">
                      {perm.category}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No permissions found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PermissionManagement;
