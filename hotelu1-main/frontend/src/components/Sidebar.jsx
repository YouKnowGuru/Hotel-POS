import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  ClipboardList,
  Receipt,
  Utensils,
  Flame,
  ShoppingBag,
  Store,
  HelpCircle,
  LogOut,
  Package,
  BarChart3,
  QrCode,
  Users,
  Building,
  Settings,
  Bell,
  UserCog,
  Menu as MenuIcon,
  X,
  Sparkles,
  ArrowRight,
  BadgePercent,
  CalendarClock,
  Banknote,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import { useNotifications } from '../contexts/NotificationsContext';
import {
  canRoleAccessModule,
  loadPermissionsMatrix,
  fetchPermissionsMatrixFromServer,
  PERMISSIONS_UPDATED_EVENT,
} from '../utils/permissions';
import { getBranchLabel, getBranchSubLabel, isAdminUser } from '../utils/branchScope';
import BrandMark from './BrandMark';
import { loadBranding } from '../utils/branding';

/* ── NavItem ─────────────────────────────────────────────────────── */
const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className="group relative flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
    style={{
      background: active
        ? 'rgba(255,255,255,0.12)'
        : 'transparent',
      backdropFilter: active ? 'blur(8px)' : 'none',
      WebkitBackdropFilter: active ? 'blur(8px)' : 'none',
      color: active ? '#FFFFFF' : '#CBD5E1',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.color = '#FFFFFF';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#CBD5E1';
      }
    }}
  >
    {/* Active indicator bar */}
    {active && (
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
        style={{
          background: 'linear-gradient(180deg, #F0C050, #D4A017, #A16207)',
          boxShadow: '0 0 8px rgba(212, 160, 23, 0.4)',
        }}
      />
    )}
    <Icon
      className="w-[18px] h-[18px] shrink-0 transition-all duration-200"
      style={{
        color: active ? '#FBBF24' : 'var(--text-muted)',
        filter: active ? 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.3))' : 'none',
      }}
    />
    <span className="truncate flex-1 text-left tracking-wide">{label}</span>
    {badge != null && badge > 0 && (
      <span
        className="ml-auto min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, #D4A017, #A16207)',
          boxShadow: '0 2px 8px rgba(212, 160, 23, 0.35)',
        }}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

/* ── Sidebar ─────────────────────────────────────────────────────── */
const Sidebar = ({
  activeTab,
  setActiveTab,
  currentUser,
  locationSettings,
  handleLocationChange,
  handleLogout,
}) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [matrix, setMatrix] = useState(() => loadPermissionsMatrix());
  const { unreadCount } = useNotifications();

  React.useEffect(() => {
    fetchUserPermissions();
    // eslint-disable-next-line
  }, [currentUser]);

  React.useEffect(() => {
    const reload = () => setMatrix(loadPermissionsMatrix());
    const onStorage = (e) => {
      if (e.key === 'rolePermissionsMatrix') reload();
    };
    window.addEventListener(PERMISSIONS_UPDATED_EVENT, reload);
    window.addEventListener('storage', onStorage);

    fetchPermissionsMatrixFromServer().then((serverMatrix) => {
      if (serverMatrix) reload();
    });

    return () => {
      window.removeEventListener(PERMISSIONS_UPDATED_EVENT, reload);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUser]);

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return setLoadingPermissions(false);
      const res = await fetch(`${getAPI_URL()}/api/my-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserPermissions(data.permissions || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingPermissions(false);
    }
  };

  const isSubFranchise = currentUser?.role === 'subfranchise';
  const isFranchiseOwner = currentUser?.role === 'franchise';
  const isFranchiseLogin = isSubFranchise || isFranchiseOwner;
  const role = String(currentUser?.role || '').toLowerCase();
  const isStaffRole = ['manager', 'waiter', 'cashier'].includes(role);

  const hasPermission = (p) =>
    role === 'admin' ? true : userPermissions.includes(p);
  const hasAnyPermission = (ps) =>
    role === 'admin' ? true : ps.some((p) => userPermissions.includes(p));

  const canSee = (moduleId, fallbackPerms) => {
    if (role === 'admin') return true;
    if (isStaffRole) {
      return canRoleAccessModule(role, moduleId, matrix);
    }
    if (Array.isArray(fallbackPerms)) return hasAnyPermission(fallbackPerms);
    if (typeof fallbackPerms === 'string') return hasPermission(fallbackPerms);
    return true;
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    const routeMap = {
      dashboard: '/dashboard',
      orders: '/orders',
      'menu-management': '/menu',
      'dine-in-management': '/dinein',
      delivery: '/delivery',
      inventory: '/inventory',
      billing: '/billing',
      reports: '/reports',
      kds: '/kitchen',
      'qr-management': '/qr-management',
      'takeaway-management': '/takeaway',
      'user-management': '/user-management',
      'franchise-dashboard': '/franchise-dashboard',
      'subfranchise-management': '/manage-sub-franchises',
      'staff-directory': '/staff',
      notifications: '/notifications',
      settings: '/settings',
      'gst-ledger': '/gst-ledger',
      attendance: '/attendance',
      payroll: '/payroll',
    };
    navigate(routeMap[tab] || '/dashboard');
  };

  /* ── Sidebar content ─────────────────────────────────────────── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* ── Brand ────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5">
        <BrandMark size={44} iconSize={24} light nameClass="text-base font-bold tracking-wide" taglineClass="text-[11px]" />

        {/* Gold divider with glow */}
        <div
          className="mt-5 h-px"
          style={{
            background: 'linear-gradient(90deg, rgba(212,160,23,0.6) 0%, rgba(212,160,23,0.15) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Branch / location glass card ─────────────────────── */}
      <div className="px-4 mb-4">
        <div
          className="flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(212,160,23,0.15)',
              border: '1px solid rgba(212,160,23,0.2)',
            }}
          >
            <Store className="w-4 h-4" style={{ color: '#FBBF24' }} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {getBranchLabel(currentUser)}
            </p>
            <p className="text-[11px] leading-tight truncate" style={{ color: 'var(--text-muted)' }}>
              {getBranchSubLabel(currentUser)}
            </p>
            <p className="text-[11px] font-semibold flex items-center gap-1 mt-0.5" style={{ color: '#34D399' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: '#34D399',
                  boxShadow: '0 0 6px rgba(52, 211, 153, 0.5)',
                }}
              />
              Online
            </p>
          </div>
        </div>
      </div>

      {/* ── Currency glass badge ─────────────────────────────── */}
      <div className="px-5 mb-4">
        <div
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs"
          style={{
            background: 'rgba(212,160,23,0.08)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(212,160,23,0.15)',
          }}
        >
          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Currency</span>
          <span
            className="font-bold text-[11px] px-2.5 py-1 rounded-lg"
            style={{
              color: '#FBBF24',
              background: 'rgba(212,160,23,0.12)',
              border: '1px solid rgba(212,160,23,0.2)',
            }}
          >
            Nu. (BTN)
          </span>
        </div>
      </div>

      {/* ── Section label ────────────────────────────────────── */}
      <div className="px-5 mb-2">
        <p className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(212,160,23,0.7)' }}>NAVIGATION</p>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-0.5">
          {isFranchiseLogin && (
            <li>
              <NavItem
                icon={Building}
                label={isSubFranchise ? 'My Franchise' : 'Franchise Overview'}
                active={activeTab === 'franchise-dashboard'}
                onClick={() => handleTabClick('franchise-dashboard')}
              />
            </li>
          )}

          {!isFranchiseLogin && canSee('dashboard', 'view_dashboard') && (
            <li>
              <NavItem
                icon={LayoutGrid}
                label="Dashboard"
                active={activeTab === 'dashboard'}
                onClick={() => handleTabClick('dashboard')}
              />
            </li>
          )}

          {canSee('dine_in', ['manage_orders', 'create_order', 'view_orders']) && (
            <li>
              <NavItem
                icon={ClipboardList}
                label="Orders"
                active={activeTab === 'orders'}
                onClick={() => handleTabClick('orders')}
              />
            </li>
          )}

          {canSee('billing', ['view_billing', 'process_payments', 'view_bills']) && (
            <li>
              <NavItem
                icon={Receipt}
                label="POS Billing"
                active={activeTab === 'billing'}
                onClick={() => handleTabClick('billing')}
              />
            </li>
          )}

          {canSee('dine_in', ['manage_orders', 'create_order', 'view_orders']) && (
            <li>
              <NavItem
                icon={Utensils}
                label="Table Management"
                active={activeTab === 'dine-in-management'}
                onClick={() => handleTabClick('dine-in-management')}
              />
            </li>
          )}

          {canSee('dine_in', ['confirm_order_delivery']) && (
            <li>
              <NavItem
                icon={Bell}
                label="Delivery Panel"
                active={activeTab === 'delivery'}
                onClick={() => handleTabClick('delivery')}
              />
            </li>
          )}

          {canSee('takeaway', ['manage_orders', 'create_order', 'view_orders']) && (
            <li>
              <NavItem
                icon={ShoppingBag}
                label="Takeaway"
                active={activeTab === 'takeaway-management'}
                onClick={() => handleTabClick('takeaway-management')}
              />
            </li>
          )}

          {canSee('kitchen_display', 'kitchen_display') && (
            <li>
              <NavItem
                icon={Flame}
                label="Kitchen Display"
                active={activeTab === 'kds'}
                onClick={() => handleTabClick('kds')}
              />
            </li>
          )}

          {!isFranchiseLogin &&
            canSee('menu_management', [
              'view_menu',
              'manage_menu',
              'create_menu_item',
              'edit_menu_item',
              'delete_menu_item',
            ]) && (
              <li>
                <NavItem
                  icon={Utensils}
                  label="Menu Management"
                  active={activeTab === 'menu-management'}
                  onClick={() => handleTabClick('menu-management')}
                />
              </li>
            )}

          {canSee('reports', 'view_reports') && (
            <li>
              <NavItem
                icon={BarChart3}
                label="Reports"
                active={activeTab === 'reports'}
                onClick={() => handleTabClick('reports')}
              />
            </li>
          )}

          {canSee('reports', 'view_reports') && !isFranchiseLogin && (
            <li>
              <NavItem
                icon={BadgePercent}
                label="GST Ledger"
                active={activeTab === 'gst-ledger'}
                onClick={() => handleTabClick('gst-ledger')}
              />
            </li>
          )}

          {!isFranchiseLogin &&
            canSee('inventory', [
              'view_inventory',
              'manage_inventory',
              'edit_inventory',
            ]) && (
              <li>
                <NavItem
                  icon={Package}
                  label="Inventory"
                  active={activeTab === 'inventory'}
                  onClick={() => handleTabClick('inventory')}
                />
              </li>
            )}

          {!isFranchiseLogin && canSee('qr_management', 'manage_qr_codes') && (
            <li>
              <NavItem
                icon={QrCode}
                label="QR Code Management"
                active={activeTab === 'qr-management'}
                onClick={() => handleTabClick('qr-management')}
              />
            </li>
          )}

          {canSee('user_management') && role === 'admin' && (
            <li>
              <NavItem
                icon={Users}
                label="User Management"
                active={activeTab === 'user-management'}
                onClick={() => handleTabClick('user-management')}
              />
            </li>
          )}

          {canSee('staff_directory') && (
            <li>
              <NavItem
                icon={UserCog}
                label="Staff"
                active={activeTab === 'staff-directory'}
                onClick={() => handleTabClick('staff-directory')}
              />
            </li>
          )}

          <li>
            <NavItem
              icon={CalendarClock}
              label="Attendance"
              active={activeTab === 'attendance'}
              onClick={() => handleTabClick('attendance')}
            />
          </li>

          {canSee('payroll') && (
            <li>
              <NavItem
                icon={Banknote}
                label={role === 'admin' || role === 'manager' ? 'Payroll' : 'My Salary'}
                active={activeTab === 'payroll'}
                onClick={() => handleTabClick('payroll')}
              />
            </li>
          )}

          {canSee('franchise') && role === 'admin' && (
            <li>
              <NavItem
                icon={Building}
                label="Franchise Overview"
                active={activeTab === 'franchise-dashboard'}
                onClick={() => handleTabClick('franchise-dashboard')}
              />
            </li>
          )}

          {canSee('franchise', 'manage_subfranchise') &&
            (role === 'admin' || isFranchiseOwner) && (
              <li>
                <NavItem
                  icon={Users}
                  label="Sub-Franchises"
                  active={activeTab === 'subfranchise-management'}
                  onClick={() => handleTabClick('subfranchise-management')}
                />
              </li>
            )}

          <li>
            <NavItem
              icon={Bell}
              label="Notifications"
              active={activeTab === 'notifications'}
              onClick={() => handleTabClick('notifications')}
              badge={unreadCount}
            />
          </li>

          {!isFranchiseLogin && canSee('settings') && (
            <li>
              <NavItem
                icon={Settings}
                label="Settings"
                active={activeTab === 'settings'}
                onClick={() => handleTabClick('settings')}
              />
            </li>
          )}
        </ul>
      </nav>

      {/* ── Help glass card ──────────────────────────────────── */}
      <div className="px-4 pb-3 pt-2">
        <div
          className="rounded-2xl p-4 transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(212,160,23,0.2), rgba(212,160,23,0.1))',
                border: '1px solid rgba(212,160,23,0.2)',
              }}
            >
              <HelpCircle className="w-4 h-4" style={{ color: '#FBBF24' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Need Help?</p>
              <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>We are here for you</p>
            </div>
          </div>
          <button
            className="w-full py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #D4A017 0%, #A16207 100%)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(212, 160, 23, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(212, 160, 23, 0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(212, 160, 23, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)';
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Contact Support
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div
        className="px-5 pb-5 pt-1 flex items-center justify-between text-[11px]"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="pt-3">
          <p style={{ color: 'var(--text-secondary)' }}>© 2026 {loadBranding().siteName}</p>
          <p style={{ color: 'var(--text-secondary)' }}>All rights reserved.</p>
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="mt-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
            e.currentTarget.style.color = '#EF4444';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ────────────────────────────────────── */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-50 px-4 py-3"
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl transition-all duration-200"
            style={{
              color: '#CBD5E1',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <MenuIcon size={22} />
          </button>
          <BrandMark size={32} iconSize={16} light nameClass="text-sm font-bold" showTagline={false} style={{ gap: '10px' }} />
          {currentUser && (
            <div
              className="w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs text-white"
              style={{
                background: 'linear-gradient(135deg, #D4A017, #A16207)',
                boxShadow: '0 2px 8px rgba(212, 160, 23, 0.25)',
              }}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile overlay ────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 transition-opacity duration-300"
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-72 flex flex-col h-screen
        transform transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{
          background: 'linear-gradient(180deg, #0A1628 0%, #0F2045 40%, #1E3A8A 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Close button (mobile) */}
        <div className="lg:hidden flex justify-end p-3">
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-xl transition-all duration-200"
            style={{
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
