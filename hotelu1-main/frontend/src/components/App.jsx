import React, { useState, useEffect, startTransition, Suspense, lazy } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import Login from './Login';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import NoAccessMessage from './NoAccessMessage';
import ProtectedRoute from './ProtectedRoute';
import RoleBasedRoute from './RoleBasedRoute';
import PermissionBasedRoute from './PermissionBasedRoute';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { getLocationSettingsForCountry } from '../utils/currency';
import { canRoleAccessModule } from '../utils/permissions';
import {
  loadBranding,
  fetchBrandingFromServer,
  applyDocumentBranding,
  BRANDING_UPDATED_EVENT,
} from '../utils/branding';

// BUNDLE SIZE: everything used to be eagerly imported, so the public QR
// menu shipped the whole admin suite (xlsx ≈ 1 MB, exceljs ≈ 3 MB,
// recharts, …) in one bundle before rendering a single dish. Heavy,
// role-gated pages are split into lazily-loaded chunks below.
const Dashboard = lazy(() => import('./Dashboard'));
const OrdersPage = lazy(() => import('./OrdersPage'));
const Reports = lazy(() => import('./Reports'));
const QRManagement = lazy(() => import('./QRManagement'));
const DineInManagement = lazy(() => import('./DineInManagement'));
const TakeawayManagement = lazy(() => import('./TakeawayManagement'));
const InventoryManagement = lazy(() => import('./InventoryManagement'));
const BillingPage = lazy(() => import('./BillingPage'));
const MenuManagement = lazy(() => import('./MenuManagement'));
const QRCodeOrdering = lazy(() => import('./QRCodeOrdering'));
const UserManagement = lazy(() => import('./UserManagement'));
const PermissionManagementNew = lazy(() => import('./PermissionManagementNew'));
const FranchiseDashboard = lazy(() => import('./FranchiseDashboard'));
const SubFranchiseManagement = lazy(() => import('./SubFranchiseManagement'));
const CustomerIndex = lazy(() => import('./CustomerIndex'));
const OrderConfirmation = lazy(() => import('./OrderConfirmation'));
const WaiterDeliveryPanel = lazy(() => import('./WaiterDeliveryPanel'));
const NotificationsPage = lazy(() => import('./NotificationsPage'));
const SettingsPage = lazy(() => import('./SettingsPage'));
const StaffByBranch = lazy(() => import('./StaffByBranch'));
const GSTLedger = lazy(() => import('./GSTLedger'));
const AttendanceSystem = lazy(() => import('./AttendanceSystem'));
const PayrollSystem = lazy(() => import('./PayrollSystem'));

// Loading component for Suspense fallback - Reference Image Design
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
    <div className="text-center bg-white rounded-2xl shadow-lg p-8">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-100 border-t-orange-500 mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);


const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [locationSettings, setLocationSettings] = useState(() =>
    getLocationSettingsForCountry('Bhutan')
  );
  const [nextOrderId, setNextOrderId] = useState(6);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Apply admin branding (document title + favicon) immediately from
  // the local cache, then converge on the server copy for other devices.
  useEffect(() => {
    applyDocumentBranding(loadBranding());
    const onBranding = () => applyDocumentBranding(loadBranding());
    window.addEventListener(BRANDING_UPDATED_EVENT, onBranding);
    fetchBrandingFromServer().then((b) => b && applyDocumentBranding(b));
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, onBranding);
  }, []);
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        startTransition(() => {
          setCurrentUser(user);
          if (user.role === 'waiter') {
            setActiveTab('delivery');
          } else if (user.role === 'franchise' || user.role === 'subfranchise') {
            setActiveTab('franchise-dashboard');
          } else {
            setActiveTab('dashboard');
          }
        });
      } catch (error) {
        console.error('Failed to restore user from localStorage:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (user, token) => {
    startTransition(() => {
      setCurrentUser(user);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      if (user.role === 'waiter') {
        setActiveTab('delivery');
      } else if (user.role === 'franchise' || user.role === 'subfranchise') {
        setActiveTab('franchise-dashboard');
      } else {
        setActiveTab('dashboard');
      }
    });
    navigate('/dashboard');
  };

  const handleLogout = () => {
    startTransition(() => {
      setCurrentUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setActiveTab('dashboard');
    });
    navigate('/login');
  };

  const handleLocationChange = () => {
    const settings = getLocationSettingsForCountry('Bhutan');
    setLocationSettings(settings);
    localStorage.setItem('posCountry', 'Bhutan');
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const renderContent = () => {
    if (activeTab === 'qr-ordering') {
      return <QRCodeOrdering locationSettings={locationSettings} />;
    }
    if (!currentUser) return null;
    const { role } = currentUser;

    // Matrix-aware gate: admin always passes, the staff roles
    // (manager/waiter/cashier) consult the Module Permissions
    // Matrix saved by the admin, and franchise/sub-franchise fall
    // back to the legacy role allow-lists below.
    const allow = (moduleId, fallbackRoles = []) => {
      if (role === 'admin') return true;
      if (['manager', 'waiter', 'cashier'].includes(role)) {
        return canRoleAccessModule(role, moduleId);
      }
      return fallbackRoles.includes(role);
    };

    if (activeTab === 'orders') {
      return allow('dine_in', ['franchise', 'subfranchise'])
        ? <OrdersPage locationSettings={locationSettings} />
        : <NoAccessMessage />;
    }
    switch (activeTab) {
      case 'reports':
        return allow('reports', ['franchise', 'subfranchise']) ? (
          <Reports locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'qr-management':
        return allow('qr_management', ['subfranchise']) ? (
          <QRManagement locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'dine-in-management':
        return allow('dine_in', ['franchise', 'subfranchise']) ? (
          <DineInManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
        ) : (
          <NoAccessMessage />
        );
      case 'takeaway-management':
        return allow('takeaway', ['franchise', 'subfranchise']) ? (
          <TakeawayManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
        ) : (
          <NoAccessMessage />
        );
      case 'inventory':
        return allow('inventory', ['subfranchise']) ? <InventoryManagement /> : <NoAccessMessage />;
      case 'dashboard':
        if (role === 'subfranchise' || role === 'franchise') {
          return <FranchiseDashboard currentUser={currentUser} locationSettings={locationSettings} setActiveTab={setActiveTab} />;
        }
        return allow('dashboard') ? (
          <Dashboard locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'billing':
        return allow('billing', ['franchise', 'subfranchise']) ? (
          <BillingPage locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'menu-management':
        return allow('menu_management', ['subfranchise']) ? (
          <MenuManagement locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'user-management':
        return role === 'admin' ? <UserManagement token={localStorage.getItem('token')} /> : <NoAccessMessage />;
      case 'permission-management':
        return role === 'admin' ? <PermissionManagementNew token={localStorage.getItem('token')} /> : <NoAccessMessage />;
      case 'franchise-dashboard':
        return (role === 'admin' || role === 'franchise' || role === 'subfranchise') ? (
          <FranchiseDashboard currentUser={currentUser} locationSettings={locationSettings} setActiveTab={setActiveTab} />
        ) : (
          <NoAccessMessage />
        );
      case 'subfranchise-management':
        return (role === 'admin' || role === 'franchise') ? (
          <SubFranchiseManagement currentUser={currentUser} locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'staff-directory':
        return allow('staff_directory', ['franchise', 'subfranchise']) ? (
          <StaffByBranch token={localStorage.getItem('token')} />
        ) : (
          <NoAccessMessage />
        );
      case 'notifications':
        return <NotificationsPage />;
      case 'settings':
        return allow('settings', ['subfranchise', 'franchise']) ? (
          <SettingsPage />
        ) : (
          <NoAccessMessage />
        );
      case 'gst-ledger':
        return allow('reports', []) ? (
          <GSTLedger locationSettings={locationSettings} />
        ) : (
          <NoAccessMessage />
        );
      case 'attendance':
        return allow('attendance', ['franchise', 'subfranchise']) ? (
          <AttendanceSystem currentUser={currentUser} />
        ) : (
          <NoAccessMessage />
        );
      case 'payroll':
        return allow('payroll', ['waiter', 'cashier']) ? (
          <PayrollSystem currentUser={currentUser} />
        ) : (
          <NoAccessMessage />
        );
      default:
        if (role === 'waiter') return <WaiterDeliveryPanel locationSettings={locationSettings} />;
        if (role === 'franchise' || role === 'subfranchise') {
          return <FranchiseDashboard currentUser={currentUser} locationSettings={locationSettings} />;
        }
        return <Dashboard locationSettings={locationSettings} />;
    }
  };

  const MenuLayout = ({ children }) => {
    if (!currentUser) {
      return <Navigate to="/login" />;
    }

    return (
      <div className="flex min-h-screen font-inter relative bg-[#F8FAFC] dark:bg-[#0B1220]">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          locationSettings={locationSettings}
          handleLocationChange={handleLocationChange}
          handleLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0 pt-16 lg:pt-0">
          <TopHeader currentUser={currentUser} handleLogout={handleLogout} setActiveTab={setActiveTab} />
          <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B1220]">{children}</main>
        </div>
      </div>
    );
  };

  const DashboardLayout = () => {
    useEffect(() => {
      const user = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!user || !token) {
        navigate('/login');
      }
    }, [navigate]);

    if (!currentUser) {
      return <Navigate to="/login" />;
    }

    return (
      <div className="flex min-h-screen font-inter relative bg-[#F8FAFC] dark:bg-[#0B1220]">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          locationSettings={locationSettings}
          handleLocationChange={handleLocationChange}
          handleLogout={handleLogout}
        />
        <div className="flex-1 flex flex-col min-w-0 pt-16 lg:pt-0">
          <TopHeader currentUser={currentUser} handleLogout={handleLogout} setActiveTab={setActiveTab} />
          <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#0B1220]">{renderContent()}</main>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <NotificationsProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={
            currentUser
              ? <Navigate to="/dashboard" replace />
              : <Navigate to="/login" replace />
          } />
          <Route 
            path="/login" 
            element={
              currentUser ? 
              <Navigate to="/dashboard" replace /> : 
              <Login onLogin={handleLogin} />
            } 
          />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          } />

          <Route path="/orders" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="dine_in" requiredRoles={['admin', 'manager', 'subfranchise', 'franchise', 'waiter']} requiredPermissions={['view_orders', 'manage_orders', 'create_order']}>
                <MenuLayout>
                  <OrdersPage locationSettings={locationSettings} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/menu" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="menu_management" requiredRoles={['admin', 'manager', 'subfranchise']} requiredPermissions={['view_menu', 'manage_menu', 'create_menu_item', 'edit_menu_item', 'delete_menu_item']}>
                <MenuLayout>
                  <MenuManagement locationSettings={locationSettings} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/dinein" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="dine_in" requiredRoles={['admin', 'manager', 'subfranchise', 'waiter']} requiredPermissions={['view_orders', 'manage_orders', 'create_order']}>
                <MenuLayout>
                  <DineInManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/inventory" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="inventory" requiredRoles={['admin', 'manager', 'subfranchise']} requiredPermissions={['view_inventory', 'manage_inventory', 'edit_inventory']}>
                <MenuLayout>
                  <InventoryManagement />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/billing" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="billing" requiredRoles={['admin', 'manager', 'subfranchise']} requiredPermissions={['view_billing', 'process_payments', 'view_bills']}>
                <MenuLayout>
                  <BillingPage locationSettings={locationSettings} currentUser={currentUser} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/reports" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="reports" requiredRoles={['admin', 'manager']} requiredPermissions={['view_reports', 'view_dashboard']}>
                <MenuLayout>
                  <Reports locationSettings={locationSettings} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/delivery" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="dine_in" requiredRoles={['admin', 'manager', 'waiter']} requiredPermissions={['confirm_order_delivery']}>
                <MenuLayout>
                  <WaiterDeliveryPanel locationSettings={locationSettings} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/qr-management" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="qr_management" requiredRoles={['admin', 'manager', 'waiter']} requiredPermissions={['manage_qr_codes']}>
                <MenuLayout>
                  <QRManagement locationSettings={locationSettings} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />
          
          <Route path="/takeaway" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="takeaway" requiredRoles={['admin', 'manager', 'waiter']} requiredPermissions={['view_orders', 'manage_orders', 'create_order']}>
                <MenuLayout>
                  <TakeawayManagement locationSettings={locationSettings} nextOrderId={nextOrderId} setNextOrderId={setNextOrderId} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <MenuLayout>
                  <UserManagement token={localStorage.getItem('token')} />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/permissions" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin']}>
                <MenuLayout>
                  <PermissionManagementNew token={localStorage.getItem('token')} />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/franchise-overview" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin', 'franchise']}>
                <MenuLayout>
                  <FranchiseDashboard currentUser={currentUser} locationSettings={locationSettings} setActiveTab={setActiveTab} />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/manage-sub-franchises" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin', 'franchise']}>
                <MenuLayout>
                  <SubFranchiseManagement currentUser={currentUser} />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/notifications" element={
            <ProtectedRoute>
              <MenuLayout>
                <NotificationsPage />
              </MenuLayout>
            </ProtectedRoute>
          } />

          <Route path="/staff" element={
            <ProtectedRoute>
              <PermissionBasedRoute requiredModule="staff_directory" requiredRoles={['admin', 'manager', 'franchise', 'subfranchise']}>
                <MenuLayout>
                  <StaffByBranch token={localStorage.getItem('token')} />
                </MenuLayout>
              </PermissionBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin', 'manager', 'subfranchise', 'franchise']}>
                <MenuLayout>
                  <SettingsPage />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/gst-ledger" element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['admin', 'manager']}>
                <MenuLayout>
                  <GSTLedger locationSettings={locationSettings} />
                </MenuLayout>
              </RoleBasedRoute>
            </ProtectedRoute>
          } />

          <Route path="/attendance" element={
            <ProtectedRoute>
              <MenuLayout>
                <AttendanceSystem currentUser={currentUser} />
              </MenuLayout>
            </ProtectedRoute>
          } />

          <Route path="/payroll" element={
            <ProtectedRoute>
              <MenuLayout>
                <PayrollSystem currentUser={currentUser} />
              </MenuLayout>
            </ProtectedRoute>
          } />

          {/* QR Ordering Route - Public */}
          <Route path="/qr-ordering" element={<QRCodeOrdering locationSettings={locationSettings} />} />

          {/* Order Confirmation Route - Public */}
          <Route path="/order-confirmation/:tableId?" element={<OrderConfirmation />} />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </NotificationsProvider>
    </ErrorBoundary>
  );
};

export default App; 
