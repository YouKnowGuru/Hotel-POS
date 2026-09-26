/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display SC"', 'Georgia', 'serif'],
        body: ['Karla', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1E3A8A',
          600: '#1E40AF',
          700: '#1D4ED8',
          800: '#1E3A8A',
          900: '#1E2D5E',
          950: '#0F172A',
        },
        gold: {
          300: '#F0C050',
          400: '#D4A017',
          500: '#B8860B',
          600: '#A16207',
        },
        orange: {
          50: 'var(--theme-50)',
          100: 'var(--theme-100)',
          200: 'var(--theme-200)',
          300: 'var(--theme-300)',
          400: 'var(--theme-400)',
          500: 'var(--theme-500)',
          600: 'var(--theme-600)',
          700: 'var(--theme-700)',
          800: 'var(--theme-800)',
          900: 'var(--theme-900)',
          950: 'var(--theme-950)',
        },
      },
      borderRadius: {
        'glass': '16px',
        'glass-sm': '12px',
        'glass-lg': '20px',
        'glass-xl': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(30, 58, 138, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-hover': '0 12px 40px rgba(30, 58, 138, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'navy': '0 4px 24px rgba(30, 58, 138, 0.15)',
        'gold': '0 4px 16px rgba(161, 98, 7, 0.15)',
        'kpi': '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'kpi-hover': '0 4px 16px rgba(30, 58, 138, 0.07), 0 2px 4px rgba(15, 23, 42, 0.04)',
      },
      backdropBlur: {
        'glass': '16px',
        'glass-heavy': '24px',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'scale-in': 'scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-left': 'slideInLeft 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'float': 'float 4s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(30, 58, 138, 0.15)' },
          '50%': { boxShadow: '0 0 30px rgba(30, 58, 138, 0.25)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
