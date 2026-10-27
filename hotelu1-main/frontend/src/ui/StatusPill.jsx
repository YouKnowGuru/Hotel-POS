import React from 'react';

/**
 * Reusable status pill component matching the app's design system.
 * Color-coded background + foreground pair with an optional indicator dot.
 * Sizes: 'sm' (11px, default), 'md' (12px), 'lg' (13px).
 */
const STATUS_CONFIG = {
  // Success states
  ready: { bg: 'rgba(5,150,105,0.10)', text: '#059669', dot: '#059669' },
  delivered: { bg: 'rgba(5,150,105,0.10)', text: '#059669', dot: '#059669' },
  paid: { bg: 'rgba(5,150,105,0.10)', text: '#059669', dot: '#059669' },
  completed: { bg: 'rgba(5,150,105,0.10)', text: '#059669', dot: '#059669' },

  // Warning / pending states
  pending: { bg: 'rgba(212,160,23,0.10)', text: '#A16207', dot: '#D4A017' },
  preparing: { bg: 'rgba(212,160,23,0.10)', text: '#A16207', dot: '#D4A017' },
  awaiting_payment: { bg: 'rgba(99,102,241,0.10)', text: '#4F46E5', dot: '#4F46E5' },
  verification_pending: { bg: 'rgba(245,158,11,0.10)', text: '#D97706', dot: '#D97706' },
  cash_pending: { bg: 'rgba(34,197,94,0.10)', text: '#059669', dot: '#059669' },
  cash_pending_admin: { bg: 'rgba(245,158,11,0.10)', text: '#D97706', dot: '#D97706' },

  // Neutral
  cancelled: { bg: 'rgba(225,29,72,0.10)', text: '#E11D48', dot: '#E11D48' },
  rejected: { bg: 'rgba(225,29,72,0.10)', text: '#E11D48', dot: '#E11D48' },

  // Fallback
  default: { bg: 'rgba(100,116,139,0.08)', text: '#475569', dot: '#94A3B8' },
};

const FONT_SIZES = {
  sm: '11px',
  md: '12px',
  lg: '13px',
};

const StatusPill = ({ status, label, size = 'sm', dot = true, title }) => {
  const s = (status || '').toLowerCase();
  const config = STATUS_CONFIG[s] || STATUS_CONFIG.default;
  const displayLabel = label || `${status || 'pending'}${status ? ' ' : ''}`.trim();

  return (
    <span
      role="status"
      aria-label={title || `Order status: ${status || 'pending'}`}
      className="inline-flex items-center gap-1 rounded-full font-semibold transition"
      style={{
        fontSize: FONT_SIZES[size] || FONT_SIZES.sm,
        padding: size === 'lg' ? '6px 14px' : size === 'md' ? '4px 10px' : '3px 10px',
        background: config.bg,
        color: config.text,
        border: size === 'lg' ? '1px solid' : 'none',
        borderColor: config.text + '33',
        whiteSpace: 'nowrap',
      }}
      {...(title ? { title } : {})}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: config.dot }} />}
      {displayLabel}
    </span>
  );
};

export default StatusPill;
