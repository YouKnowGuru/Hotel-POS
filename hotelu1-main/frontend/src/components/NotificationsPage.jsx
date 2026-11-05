import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Search,
  Check,
  Trash2,
  Package,
  AlertTriangle,
  Info,
  ShoppingBag,
  Shield,
  CreditCard,
  Receipt,
  Users,
  Wifi,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';

const CATEGORIES = [
  { id: 'all', label: 'All Alerts' },
  { id: 'order', label: 'Order Status' },
  { id: 'inventory', label: 'Inventory Alerts' },
  { id: 'system', label: 'System Updates' },
  { id: 'security', label: 'Security & Access' },
];

const ICONS_BY_CATEGORY = {
  order: ShoppingBag,
  inventory: Package,
  system: Info,
  security: Shield,
};

const ICONS_BY_TYPE = {
  'low-stock': Package,
  'out-of-stock': Package,
  'kitchen-delay': AlertTriangle,
  'new-order': ShoppingBag,
  'order-ready': ShoppingBag,
  'payment-review': CreditCard,
  'bill-request': Receipt,
  'call-waiter': BellRing,
  'staff-account': Users,
  'branch-change': Info,
  attendance: Users,
  payroll: Receipt,
  'system-update': Info,
  'admin-login': Shield,
};

/* Explicit dark variants: the old page had zero `dark:` classes, so every
   card stayed white-on-white in night mode. */
const SEVERITY_STYLES = {
  critical: {
    iconBg: 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  warning: {
    iconBg: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  success: {
    iconBg: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  info: {
    iconBg: 'bg-sky-50 text-sky-500 dark:bg-sky-500/15 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
};

const CONNECTION_TEXT = {
  live: 'Live',
  polling: 'Reconnecting',
  offline: 'Offline',
};

const NotificationsPage = () => {
  const {
    notifications,
    counts,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
    connection,
    soundEnabled,
    setSoundEnabled,
    testBell,
  } = useNotifications();

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((n) => {
      if (activeCategory !== 'all' && n.category !== activeCategory) return false;
      if (!q) return true;
      return (
        String(n.title || '').toLowerCase().includes(q) ||
        String(n.message || '').toLowerCase().includes(q)
      );
    });
  }, [notifications, activeCategory, search]);

  const categoryCount = (id) =>
    id === 'all' ? counts.all || 0 : counts[id] || 0;

  const live = connection === 'live';

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-0 bg-[#F7F7F8] dark:bg-[#0B1220] transition-opacity duration-500 overflow-x-hidden ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
              Notifications
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
                live
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300'
              }`}
              title="Alert delivery status"
            >
              <Wifi className="w-3 h-3" />
              {CONNECTION_TEXT[connection] || 'Offline'}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Real-time order alerts, payment reviews, inventory warnings and staff activity
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute order bell' : 'Unmute order bell'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-semibold transition shadow-sm ${
              soundEnabled
                ? 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 dark:bg-[#141C2E] dark:border-slate-600 dark:text-slate-200'
                : 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {soundEnabled ? 'Bell on' : 'Muted'}
          </button>
          <button
            type="button"
            onClick={testBell}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 text-sm font-semibold transition shadow-sm dark:bg-[#141C2E] dark:border-slate-600 dark:text-slate-200"
          >
            Test bell
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600 text-sm font-semibold transition shadow-sm dark:bg-[#141C2E] dark:border-slate-600 dark:text-slate-200 dark:hover:text-indigo-300"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold transition shadow-sm dark:bg-[#141C2E] dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Clear all
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Categories panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-fit dark:bg-[#141C2E] dark:border-slate-700/60">
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3 px-1 dark:text-slate-500">
            Categories
          </p>
          <ul className="space-y-1">
            {CATEGORIES.map((c) => {
              const active = activeCategory === c.id;
              const count = categoryCount(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                        : 'text-gray-600 hover:bg-indigo-50/40 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-indigo-300'
                    }`}
                  >
                    <span>{c.label}</span>
                    <span
                      className={`min-w-[24px] h-6 px-2 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* List panel */}
        <div className="min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4 dark:bg-[#141C2E] dark:border-slate-700/60">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none dark:text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-gray-50 border border-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-200 dark:bg-[#1A2336] dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center dark:bg-[#141C2E] dark:border-slate-700/60">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-800 mx-auto mb-3 flex items-center justify-center dark:bg-indigo-950/40 dark:text-indigo-300">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-slate-100">
                You're all caught up
              </p>
              <p className="text-sm text-gray-500 mt-1 dark:text-slate-400">
                No notifications in this category right now.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((n, idx) => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  index={idx}
                  isLoaded={isLoaded}
                  onRead={() => markAsRead(n.id)}
                  onDismiss={() => dismiss(n.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const NotificationCard = ({ notification, index, isLoaded, onRead, onDismiss }) => {
  const severity = SEVERITY_STYLES[notification.severity] || SEVERITY_STYLES.info;
  const Icon =
    ICONS_BY_TYPE[notification.type] ||
    ICONS_BY_CATEGORY[notification.category] ||
    Bell;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all px-4 py-3.5 flex items-start gap-3 dark:bg-[#141C2E] dark:border-slate-700/60"
      style={{
        animation: isLoaded
          ? `slideUpFade .35s ease-out ${Math.min(index, 10) * 40}ms both`
          : 'none',
      }}
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${severity.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900 break-words dark:text-slate-100">
            {notification.title}
          </h3>
          {notification.unread && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${severity.dot}`} />
          )}
        </div>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed break-words dark:text-slate-300">
          {notification.message}
        </p>
        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1 dark:text-slate-500">
          <span className="inline-block w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
          {notification.timeAgo}
          {notification.orderId ? ` · Order #${notification.orderId}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {notification.unread && (
          <button
            type="button"
            onClick={onRead}
            className="w-8 h-8 rounded-full bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-500 flex items-center justify-center transition dark:bg-white/5 dark:text-slate-400 dark:hover:bg-emerald-500/15"
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="w-8 h-8 rounded-full bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center transition dark:bg-white/5 dark:text-slate-400 dark:hover:bg-rose-500/15"
          title="Dismiss"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationsPage;
