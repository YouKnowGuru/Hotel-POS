import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  Search,
  Check,
  Trash2,
  Package,
  AlertTriangle,
  Info,
  ShoppingBag,
  Shield,
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
  'system-update': Info,
  'admin-login': Shield,
};

const SEVERITY_STYLES = {
  critical: {
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-500',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
  },
  success: {
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
  },
  info: {
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-500',
  },
};

const NotificationsPage = () => {
  const {
    notifications,
    counts,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
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
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    });
  }, [notifications, activeCategory, search]);

  const categoryCount = (id) => {
    if (id === 'all') return counts.all || 0;
    return counts[id] || 0;
  };

  return (
    <div
      className={`px-4 sm:px-6 lg:px-8 py-6 min-h-screen bg-[#F7F7F8] transition-opacity duration-500 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            View real-time alerts, inventory warnings, and order status updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 text-sm font-semibold transition shadow-sm"
          >
            <Check className="w-4 h-4" />
            Mark all as read
          </button>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold transition shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear all
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Categories panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-fit">
          <p className="text-[10px] font-bold tracking-widest text-gray-400 mb-3 px-1">
            CATEGORIES
          </p>
          <ul className="space-y-1">
            {CATEGORIES.map((c) => {
              const active = activeCategory === c.id;
              const count = categoryCount(c.id);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveCategory(c.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-600 hover:bg-orange-50/40 hover:text-orange-600'
                    }`}
                  >
                    <span>{c.label}</span>
                    <span
                      className={`min-w-[24px] h-6 px-2 inline-flex items-center justify-center rounded-full text-[11px] font-bold ${
                        active
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-600'
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
        <div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications..."
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-gray-50 border border-gray-100 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-200"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-400 mx-auto mb-3 flex items-center justify-center">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-gray-900">
                You're all caught up
              </p>
              <p className="text-sm text-gray-500 mt-1">
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
          to { opacity: 1; transform: translateY(0); }
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
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all px-4 py-3.5 flex items-start gap-3"
      style={{
        animation: isLoaded
          ? `slideUpFade .35s ease-out ${Math.min(index, 10) * 40}ms both`
          : 'none',
      }}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-xl ${severity.iconBg} ${severity.iconColor} flex items-center justify-center`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-gray-900 truncate">
            {notification.title}
          </h3>
          {notification.unread && (
            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
          )}
        </div>
        <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-gray-300" />
          {notification.timeAgo}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {notification.unread && (
          <button
            onClick={onRead}
            className="w-8 h-8 rounded-full bg-gray-50 hover:bg-emerald-50 text-gray-400 hover:text-emerald-500 flex items-center justify-center transition"
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="w-8 h-8 rounded-full bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center transition"
          title="Dismiss"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationsPage;
