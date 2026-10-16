import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={label}
      title={label}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${className}`}
      style={{
        background: hovered ? 'var(--card-bg)' : 'transparent',
        border: hovered ? '1px solid var(--border)' : '1px solid transparent',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="relative w-5 h-5 block">
        <Sun
          className={'absolute inset-0 w-5 h-5 transition-all duration-300 ' +
            (isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100')}
          style={{ color: hovered ? '#D4A017' : '#64748B' }}
        />
        <Moon
          className={'absolute inset-0 w-5 h-5 transition-all duration-300 ' +
            (isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50')}
          style={{ color: hovered ? '#4338CA' : '#94A3B8' }}
        />
      </span>
    </button>
  );
};

export default ThemeToggle;
