import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu as MenuIcon,
  Search,
  Bell,
  Maximize2,
  Minimize2,
  HelpCircle,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Utensils,
  Receipt,
  Coffee,
  CornerDownLeft,
  Sparkles,
  Command,
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { useNotifications } from '../contexts/NotificationsContext';
import ThemeToggle from './ThemeToggle';

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

const DEFAULT_TABLES = [
  { id: 'T1', capacity: 4, floor: 'Ground Floor' },
  { id: 'T2', capacity: 2, floor: 'Ground Floor' },
  { id: 'T3', capacity: 6, floor: 'Ground Floor' },
  { id: 'T4', capacity: 4, floor: 'Ground Floor' },
  { id: 'T5', capacity: 8, floor: 'Ground Floor' },
  { id: 'T6', capacity: 2, floor: 'Ground Floor' },
  { id: 'T7', capacity: 4, floor: 'First Floor' },
  { id: 'T8', capacity: 4, floor: 'First Floor' },
  { id: 'T9', capacity: 6, floor: 'First Floor' },
  { id: 'T10', capacity: 2, floor: 'First Floor' },
  { id: 'T11', capacity: 4, floor: 'First Floor' },
  { id: 'T12', capacity: 10, floor: 'First Floor' },
];

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/* ------------------------------------------------------------------ */
/*  Glass icon button                                                  */
/* ------------------------------------------------------------------ */
const GlassIconBtn = ({ onClick, label, children, className = '', hide = '' }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className={`${hide} relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${className}`}
      style={{
        background: hovered ? 'var(--glass-bg)' : 'transparent',
        border: hovered ? '1px solid var(--glass-border)' : '1px solid transparent',
        backdropFilter: hovered ? 'blur(8px)' : 'none',
        color: hovered ? 'var(--text-primary)' : undefined,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  TopHeader                                                          */
/* ------------------------------------------------------------------ */
const TopHeader = ({ currentUser, handleLogout, setActiveTab }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ddRef = useRef(null);
  const { unreadCount } = useNotifications();
  const notificationCount = unreadCount;
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* --------------------------- search state --------------------------- */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  /* --------------------------- click-outside + keyboard --------------------------- */
  useEffect(() => {
    const onClick = (e) => {
      if (ddRef.current && !ddRef.current.contains(e.target)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchFocused(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  /* --------------------------- fetch sources --------------------------- */
  const fetchMenu = useCallback(async () => {
    try {
      const res = await authFetch('/api/menu');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMenuItems(data);
    } catch { /* ignore */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const today = ymd(new Date());
      const res = await authFetch(`/api/orders?startDate=${today}&endDate=${today}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;
    fetchMenu();
    fetchOrders();
    const id = setInterval(fetchOrders, 15000);
    return () => clearInterval(id);
  }, [searchOpen, fetchMenu, fetchOrders]);

  /* --------------------------- compute results --------------------------- */
  const results = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { menu: [], orders: [], tables: [], total: 0 };

    const menuMatches = menuItems
      .filter((m) => {
        const name = String(m?.name || '').toLowerCase();
        const cat = String(m?.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      })
      .slice(0, 5)
      .map((m) => ({
        type: 'menu',
        id: `menu-${m.id}`,
        name: m.name,
        sub: `${m.category || 'Item'} · Nu. ${Number(m.price || 0).toFixed(2)}`,
        route: '/menu',
      }));

    const orderMatches = orders
      .filter((o) => {
        const id = String(o?.id || '').toLowerCase();
        const tn = String(o?.table_name || '').toLowerCase();
        const status = String(o?.status || '').toLowerCase();
        return `#${id}`.includes(q) || id.includes(q) || tn.includes(q) || status.includes(q);
      })
      .slice(0, 5)
      .map((o) => ({
        type: 'order',
        id: `order-${o.id}`,
        name: `Order #${o.id}`,
        sub: `${o.table_name || (String(o.type).toUpperCase() === 'TAKEAWAY' ? 'Takeaway' : 'Order')} · ${o.status} · Nu. ${Number(o.total || 0).toFixed(2)}`,
        route: '/orders',
      }));

    const tableMatches = DEFAULT_TABLES.filter((t) => {
      const id = String(t.id).toLowerCase();
      const num = id.replace(/^t/, '');
      return id.includes(q) || `table ${num}`.includes(q) || num === q;
    })
      .slice(0, 5)
      .map((t) => ({
        type: 'table',
        id: `table-${t.id}`,
        name: `Table ${t.id.replace(/^T/, '')}`,
        sub: `${t.capacity} seats · ${t.floor}`,
        route: '/dinein',
      }));

    return {
      menu: menuMatches,
      orders: orderMatches,
      tables: tableMatches,
      total: menuMatches.length + orderMatches.length + tableMatches.length,
    };
  }, [searchQuery, menuItems, orders]);

  const flatResults = useMemo(
    () => [...results.tables, ...results.orders, ...results.menu],
    [results]
  );

  useEffect(() => {
    setSearchActiveIdx(0);
  }, [searchQuery]);

  const goToResult = (r) => {
    if (!r) return;
    setSearchOpen(false);
    setSearchQuery('');
    if (typeof setActiveTab === 'function') {
      if (r.type === 'menu') setActiveTab('menu-management');
      if (r.type === 'order') setActiveTab('orders');
      if (r.type === 'table') setActiveTab('dine-in-management');
    }
    navigate(r.route);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.min(i + 1, Math.max(0, flatResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = flatResults[searchActiveIdx];
      if (r) goToResult(r);
    }
  };

  const requestFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const initials = (currentUser?.name || 'A').charAt(0).toUpperCase();
  const roleLabel =
    (currentUser?.role || 'user').charAt(0).toUpperCase() +
    (currentUser?.role || 'user').slice(1);

  /* --------------------------- render --------------------------- */
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-glass)',
      }}
    >
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        {/* Menu toggle */}
        <GlassIconBtn label="Menu" hide="hidden lg:flex" className="text-slate-500 dark:text-slate-400">
          <MenuIcon className="w-5 h-5" />
        </GlassIconBtn>

        {/* ─── Search ─── */}
        <div className="flex-1 max-w-2xl" ref={searchRef}>
          <div className="relative">
            <Search
              className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200"
              style={{ color: searchFocused ? 'var(--text-primary)' : 'var(--text-muted)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                setSearchOpen(true);
                setSearchFocused(true);
              }}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search orders, tables, menu items..."
              className="w-full pl-11 pr-20 py-2.5 rounded-xl text-sm font-body transition-all duration-200"
              style={{
                background: searchFocused
                  ? 'var(--card-bg)'
                  : 'var(--glass-bg)',
                border: searchFocused
                  ? '1.5px solid var(--border)'
                  : '1.5px solid var(--glass-border)',
                boxShadow: searchFocused
                  ? 'var(--shadow-glass-hover)'
                  : 'none',
                backdropFilter: 'blur(12px)',
                color: 'var(--text-primary)',
              }}
            />
            <span
              className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-mono transition-all duration-200"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-muted)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Command className="w-3 h-3" />
              K
            </span>

            {/* ─── Search dropdown ─── */}
            {searchOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-2 overflow-hidden z-50"
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(24px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                  borderRadius: '16px',
                  border: '1px solid var(--glass-border)',
                  boxShadow: 'var(--shadow-glass-hover)',
                }}
              >
                {searchQuery.trim() === '' ? (
                  <SearchHints onPick={(q) => setSearchQuery(q)} />
                ) : results.total === 0 ? (
                  <div className="py-10 text-center">
                    <div
                      className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      <Search className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm text-slate-500">
                      No results for{' '}
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        "{searchQuery}"
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try searching by order #, table name, or menu item
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto scrollbar-thin py-1.5">
                    <ResultGroup
                      title="Tables"
                      icon={Utensils}
                      items={results.tables}
                      offset={0}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <ResultGroup
                      title="Orders"
                      icon={Receipt}
                      items={results.orders}
                      offset={results.tables.length}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <ResultGroup
                      title="Menu Items"
                      icon={Coffee}
                      items={results.menu}
                      offset={results.tables.length + results.orders.length}
                      activeIdx={searchActiveIdx}
                      onPick={goToResult}
                    />
                    <div
                      className="px-4 py-2.5 flex items-center justify-between text-[11px]"
                      style={{
                        borderTop: '1px solid var(--glass-border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <kbd
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
                            style={{
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            ↑↓
                          </kbd>
                          navigate
                        </span>
                        <span className="flex items-center gap-1">
                          <kbd
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono"
                            style={{
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Enter
                          </kbd>
                          open
                        </span>
                      </span>
                      <span style={{ color: '#D4A017' }}>
                        {results.total} result{results.total !== 1 && 's'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right actions ─── */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {/* Notifications */}
          <div className="relative">
            <GlassIconBtn
              onClick={() => {
                if (typeof setActiveTab === 'function') setActiveTab('notifications');
                navigate('/notifications');
              }}
              label="Notifications"
              className="text-slate-500 dark:text-slate-400"
            >
              <Bell className="w-[18px] h-[18px]" />
            </GlassIconBtn>
            {notificationCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, #F0C050, #D4A017, #A16207)',
                  boxShadow: '0 2px 8px rgba(212,160,23,0.4), 0 0 0 2px rgba(255,255,255,0.9)',
                  letterSpacing: '-0.02em',
                }}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Fullscreen */}
          <GlassIconBtn
            onClick={requestFullScreen}
            label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            hide="hidden sm:flex"
            className="text-slate-500 dark:text-slate-400"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </GlassIconBtn>

          {/* Help */}
          <GlassIconBtn
            label="Help"
            hide="hidden sm:flex"
            className="text-slate-500 dark:text-slate-400"
          >
            <HelpCircle className="w-[18px] h-[18px]" />
          </GlassIconBtn>

          {/* Gold divider */}
          <div
            className="hidden sm:block w-px h-7 mx-1.5"
            style={{
              background: 'linear-gradient(180deg, transparent 0%, rgba(212,160,23,0.3) 30%, rgba(212,160,23,0.3) 70%, transparent 100%)',
            }}
          />

          {/* ─── Profile ─── */}
          <div className="relative" ref={ddRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2.5 pr-3 pl-1.5 py-1.5 rounded-xl transition-all duration-200"
              style={{
                border: open
                  ? '1px solid rgba(212,160,23,0.5)'
                  : '1px solid var(--glass-border)',
                background: open
                  ? 'rgba(212,160,23,0.08)'
                  : 'transparent',
                backdropFilter: open ? 'blur(8px)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!open) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'var(--glass-bg)';
                }
              }}
              onMouseLeave={(e) => {
                if (!open) {
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span
                className="w-8 h-8 rounded-lg text-white text-sm font-bold flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                  boxShadow: 'var(--shadow-glass)',
                }}
              >
                {initials}
              </span>
              <span className="hidden sm:block text-left">
                <span className="block text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {currentUser?.name || 'User'}
                </span>
                <span className="block text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                  {roleLabel}
                </span>
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: 'var(--text-muted)',
                  transform: open ? 'rotate(180deg)' : 'rotate(0)',
                }}
              />
            </button>

            {/* ─── Profile dropdown ─── */}
            {open && (
              <div
                className="absolute right-0 mt-2 w-56 py-1 z-50"
                style={{
                  background: 'var(--glass-bg)',
                  backdropFilter: 'blur(24px) saturate(1.5)',
                  WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
                  borderRadius: '16px',
                  border: '1px solid var(--glass-border)',
                  boxShadow:
                    'var(--shadow-glass-hover)',
                  animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                  transformOrigin: 'top right',
                }}
              >
                {/* Profile header */}
                <div
                  className="px-4 py-3 mx-2 mt-1 rounded-xl"
                  style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-10 h-10 rounded-xl text-white text-base font-bold flex items-center justify-center shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #1E3A8A, #2563EB)',
                        boxShadow: 'var(--shadow-glass)',
                      }}
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {currentUser?.name || 'User'}
                      </p>
                      <p
                        className="text-[11px] flex items-center gap-1"
                        style={{ color: '#D4A017' }}
                      >
                        <Sparkles className="w-3 h-3" />
                        {roleLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="my-1 mx-3" style={{ height: '1px', background: 'var(--glass-bg)' }} />

                {/* Profile link */}
                <DropdownItem
                  icon={UserIcon}
                  label="Profile"
                  onClick={() => {
                    setOpen(false);
                    navigate('/dashboard');
                  }}
                />

                <div className="my-1 mx-3" style={{ height: '1px', background: 'var(--glass-bg)' }} />

                {/* Logout */}
                <DropdownItem
                  icon={LogOut}
                  label="Logout"
                  danger
                  onClick={() => {
                    setOpen(false);
                    handleLogout?.();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

/* ------------------------------------------------------------------ */
/*  Dropdown item                                                      */
/* ------------------------------------------------------------------ */
const DropdownItem = ({ icon: Icon, label, onClick, danger = false }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-all duration-150 mx-0"
      style={{
        color: danger
          ? hovered ? '#DC2626' : '#EF4444'
          : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: hovered
          ? danger
            ? 'rgba(239,68,68,0.08)'
            : 'var(--glass-bg)'
          : 'transparent',
        borderRadius: '0',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon
        className="w-4 h-4 transition-colors duration-150"
        style={{
          color: danger
            ? hovered ? '#DC2626' : '#EF4444'
            : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
      />
      <span className="font-medium">{label}</span>
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  Search hints                                                       */
/* ------------------------------------------------------------------ */
const HINT_QUERIES = ['Butter Chicken', 'Table 5', 'Order #', 'Biryani'];

const SearchHints = ({ onPick }) => (
  <div className="py-4 px-4">
    <p
      className="text-[10px] font-bold tracking-widest mb-3"
      style={{ color: 'rgba(212,160,23,0.7)' }}
    >
      QUICK SEARCH
    </p>
    <div className="flex flex-wrap gap-2">
      {HINT_QUERIES.map((h) => (
        <HintChip key={h} label={h} onClick={() => onPick(h)} />
      ))}
    </div>
    <p className="text-[11px] mt-4 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
      <CornerDownLeft className="w-3 h-3" />
      Start typing to search orders, tables, and menu items
    </p>
  </div>
);

const HintChip = ({ label, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{
        background: hovered ? 'var(--glass-bg)' : 'transparent',
        border: hovered ? '1px solid var(--glass-border)' : '1px solid transparent',
        color: hovered ? 'var(--text-primary)' : 'var(--text-muted)',
        backdropFilter: 'blur(4px)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/*  Result group                                                       */
/* ------------------------------------------------------------------ */
const ResultGroup = ({ title, icon: Icon, items, offset, activeIdx, onPick }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="py-1">
      <div className="px-4 py-2 flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <Icon className="w-3 h-3" style={{ color: 'var(--text-primary)' }} />
        </div>
        <p className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {title.toUpperCase()}
        </p>
      </div>
      <ul>
        {items.map((it, idx) => {
          const isActive = activeIdx === offset + idx;
          return (
            <li key={it.id}>
              <button
                onClick={() => onPick(it)}
                className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-all duration-150"
                style={{
                  background: isActive ? 'var(--glass-bg)' : 'transparent',
                  borderLeft: isActive ? '2px solid #D4A017' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--glass-bg)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {it.name}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {it.sub}
                  </p>
                </div>
                {isActive && (
                  <CornerDownLeft className="w-3.5 h-3.5 shrink-0" style={{ color: '#D4A017' }} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TopHeader;
