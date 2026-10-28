import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  ClipboardList,
  Receipt,
  Utensils,
  ShoppingBag,
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
  Percent,
  ChevronRight,
} from 'lucide-react';
import { getAPI_URL } from '../utils/api';
import { useNotifications } from '../contexts/NotificationsContext';
import {
  canRoleAccessModule,
  loadPermissionsMatrix,
  fetchPermissionsMatrixFromServer,
  PERMISSIONS_UPDATED_EVENT,
} from '../utils/permissions';
import BrandMark from './BrandMark';
import { loadBranding } from '../utils/branding';

/* ── NavItem ─────────────────────────────────────────────────────── */
const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className="group relative flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
    style={{
      background: active ? 'linear-gradient(135deg, color-mix(in srgb, var(--theme-gold, #D4A017) 18%, transparent) 0%, color-mix(in srgb, var(--theme-gold, #D4A017) 6%, transparent) 100%)' : 'transparent',
      color: active ? '#FFFFFF' : '#94A3B8',
      boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--theme-gold, #D4A017) 25%, transparent)' : 'none',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        e.currentTarget.style.color = '#E2E8F0';
        e.currentTarget.style.transform = 'translateX(2px)';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '#94A3B8';
        e.currentTarget.style.transform = 'translateX(0)';
      }
    }}
  >
    {/* Active indicator bar */}
    {active && (
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full"
        style={{ background: 'var(--theme-gold-light, #F0C050)', boxShadow: '0 0 8px color-mix(in srgb, var(--theme-gold-light, #F0C050) 60%, transparent)' }}
      />
    )}
    <Icon
      className="w-[18px] h-[18px] shrink-0 transition-colors duration-200"
      style={{ color: active ? 'var(--theme-gold-light, #F0C050)' : '#64748B' }}
    />
    <span className="truncate flex-1 text-left">{label}</span>
    {badge != null && badge > 0 && (
      <span
        className="ml-auto min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: 'var(--theme-gold, #D4A017)', boxShadow: '0 2px 6px color-mix(in srgb, var(--theme-gold, #D4A017) 35%, transparent)' }}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    {active && (
      <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'color-mix(in srgb, var(--theme-gold-light, #F0C050) 50%, transparent)' }} />
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
  // Track if we're on desktop (lg = 1024px) to skip the transform on desktop
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Lock body scroll when mobile drawer is open to prevent background scrolling
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // The mobile hamburger now lives in TopHeader (single unified top bar —
  // the old separate dark bar stacked two nav rows on small screens).
  // TopHeader opens the drawer via this event; no prop-drilling needed.
  useEffect(() => {
    const openMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('open-mobile-menu', openMenu);
    return () => window.removeEventListener('open-mobile-menu', openMenu);
  }, []);
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
      'qr-management': '/qr-management',
      'takeaway-management': '/takeaway',
      'user-management': '/user-management',
      'franchise-dashboard': '/franchise-dashboard',
      'subfranchise-management': '/manage-sub-franchises',
      'staff-directory': '/staff',
      notifications: '/notifications',
      settings: '/settings',
      'gst-ledger': '/gst-ledger',
      'service-charge': '/service-charge',
      attendance: '/attendance',
      payroll: '/payroll',
    };
    navigate(routeMap[tab] || '/dashboard');
  };

  /* ── Sidebar content ─────────────────────────────────────────── */
  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      {/* Decorative gradient overlay for visual depth */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '180px',
          background: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--theme-primary, #4F46E5) 12%, transparent) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Brand ────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-5 relative" style={{ zIndex: 1 }}>
        <div className="flex items-center justify-between">
          <BrandMark size={44} iconSize={24} light nameClass="text-base font-bold tracking-wide" taglineClass="text-[11px]" />
          {isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                color: '#94A3B8',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Gold divider with glow */}
        <div
          className="mt-5 h-px"
          style={{
            background: 'linear-gradient(90deg, color-mix(in srgb, var(--theme-gold, #D4A017) 60%, transparent) 0%, color-mix(in srgb, var(--theme-gold, #D4A017) 15%, transparent) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Compact status line ─────────────────────────────── */}
      <div className="px-4 mb-3 relative" style={{ zIndex: 1 }}>
        <div
          className="flex items-center justify-between px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: '#34D399' }}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#34D399',
                boxShadow: '0 0 6px rgba(52, 211, 153, 0.5)',
              }}
            />
            Online
          </span>
          <span className="text-[11px] font-medium" style={{ color: '#64748B' }}>
            {currentUser?.name || currentUser?.email?.split('@')[0] || 'Admin'}
          </span>
        </div>
      </div>

      {/* ── Section label ────────────────────────────────────── */}
      <div className="px-5 mb-2 relative" style={{ zIndex: 1 }}>
        <p className="text-[10px] font-bold tracking-widest" style={{ color: '#475569' }}>NAVIGATION</p>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 px-3 overflow-y-auto scrollbar-thin relative" style={{ zIndex: 1 }}>
        <ul className="space-y-1">
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

          {canSee('reports', 'view_reports') && !isFranchiseLogin && (
            <li>
              <NavItem
                icon={Percent}
                label="Service Charge"
                active={activeTab === 'service-charge'}
                onClick={() => handleTabClick('service-charge')}
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

          {canSee('attendance', 'view_attendance') && (
            <li>
              <NavItem
                icon={CalendarClock}
                label="Attendance"
                active={activeTab === 'attendance'}
                onClick={() => handleTabClick('attendance')}
              />
            </li>
          )}

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

      {/* ── User card + logout ──────────────────────────────── */}
      <div className="px-4 pb-4 pt-3 relative" style={{ zIndex: 1 }}>
        <div
          className="rounded-2xl p-3.5"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary, #4F46E5) 20%, transparent) 0%, color-mix(in srgb, var(--theme-primary, #4F46E5) 5%, transparent) 100%)',
            border: '1px solid color-mix(in srgb, var(--theme-primary, #4F46E5) 12%, transparent)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--theme-primary, #4F46E5) 0%, var(--theme-primary-light, #6366F1) 100%)',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-primary, #4F46E5) 30%, transparent)',
              }}
            >
              {(currentUser?.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {currentUser?.name || 'User'}
              </p>
              <p className="text-[11px] leading-tight truncate" style={{ color: '#64748B' }}>
                {(currentUser?.role || 'user').charAt(0).toUpperCase() + (currentUser?.role || 'user').slice(1)}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: 'rgba(239,68,68,0.10)',
              color: '#F87171',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.18)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.10)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.15)';
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Footer copyright */}
        <p className="text-center text-[10px] mt-3" style={{ color: '#334155' }}>
          © {new Date().getFullYear()} {loadBranding().siteName}
        </p>
      </div>
    </div>
  );

  // On desktop: render as a normal static flex child (in flow)
  if (isDesktop) {
    return (
      <aside
        style={{
          width: '16rem',
          minWidth: '16rem',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          overflowY: 'auto',
        }}
      >
        <SidebarContent />
      </aside>
    );
  }

  // On mobile: render the drawer and backdrop as portals (attached to body)
  // so they are completely outside the flex layout container
  return createPortal(
    <>
      {/* ── Backdrop: only in DOM when open so it can never block touches ── */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ── Drawer ────────────────────────────────────────────── */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: '82vw',
          maxWidth: '20rem',
          display: 'flex',
          flexDirection: 'column',
          background: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: isMobileMenuOpen ? '8px 0 40px rgba(0,0,0,0.5)' : 'none',
          transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(-110%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          // Completely disable interaction when closed — critical for mobile
          visibility: isMobileMenuOpen ? 'visible' : 'hidden',
          pointerEvents: isMobileMenuOpen ? 'auto' : 'none',
        }}
      >
        <SidebarContent isMobile={true} />
      </aside>
    </>,
    document.body
  );
};

export default Sidebar;
