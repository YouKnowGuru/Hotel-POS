import React from 'react';

/**
 * Reusable empty-state component for grids/lists that have no data.
 * Matches the app's liquid-glass design system (navy/gold, 16px radius).
 */
const EmptyState = ({
  illustration = '🍽️',
  title = 'Nothing here yet',
  description = 'There is no data to display right now.',
  actionLabel,
  onAction,
  variant = 'neutral',
}) => {
  const variants = {
    neutral: { iconBg: 'var(--app-bg)', iconColor: 'var(--text-muted)' },
    empty: { iconBg: 'var(--card-bg)', iconColor: 'var(--text-muted)' },
    info: { iconBg: 'var(--accent-light)', iconColor: '#FFFFFF' },
    warning: { iconBg: '#D97706', iconColor: '#FFFFFF' },
    error: { iconBg: '#DC2626', iconColor: '#FFFFFF' },
  };

  const style = variants[variant] || variants.neutral;

  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed"
      style={{
        background: 'var(--app-bg)',
        border: '1.5px dashed var(--border)',
        borderRadius: '16px',
        minWidth: '280px',
        maxWidth: '480px',
        margin: '40px auto',
      }}
    >
      <div
        className="w-16 h-16 flex items-center justify-center rounded-full mb-4"
        style={{ background: style.iconBg, color: style.iconColor }}
      >
        <span style={{ fontSize: '32px' }}>{illustration}</span>
      </div>
      <h3
        className="text-lg font-semibold mb-2"
        style={{ color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {title}
      </h3>
      <p
        className="text-sm text-gray-500"
        style={{ color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif', marginBottom: '16px' }}
      >
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm hover:shadow-md"
          style={{
            background: 'var(--accent)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
