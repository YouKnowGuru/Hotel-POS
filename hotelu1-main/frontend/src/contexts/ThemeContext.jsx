import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/**
 * ThemeContext — dark/light/system mode + dynamic theme colour + layout density.
 *
 *   - mode: 'light' | 'dark' | 'system'
 *   - resolvedTheme: 'light' | 'dark'
 *
 * Persists to localStorage.theme.
 * Adds/removes the `dark` class on <html>.
 * Injects a <style id="dynamic-theme-override"> at the END of <head> so it
 * always wins the cascade over compiled Tailwind CSS.
 */

const STORAGE_KEY = 'theme';
export const THEME_CHANGED_EVENT = 'theme-changed';

/* ------------------------------------------------------------------ */
/* Color palettes — exported so SettingsPage can render live previews  */
/* ------------------------------------------------------------------ */

export const THEME_COLORS = {
  orange: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
    400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
    800: '#9a3412', 900: '#7c2d12', 950: '#431407',
    // Gradient pair for UI accents (buttons, badges, logo rings)
    grad: ['#f97316', '#ea580c'],
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
    400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
    800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
    grad: ['#3b82f6', '#1d4ed8'],
  },
  emerald: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
    400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
    800: '#065f46', 900: '#064e3b', 950: '#022c22',
    grad: ['#10b981', '#047857'],
  },
  purple: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
    400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
    800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
    grad: ['#a855f7', '#7e22ce'],
  },
  rose: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
    400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
    800: '#9f1239', 900: '#881337', 950: '#4c0519',
    grad: ['#f43f5e', '#be123c'],
  },
  amber: {
    50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
    400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
    800: '#92400e', 900: '#78350f', 950: '#451a03',
    grad: ['#f59e0b', '#d97706'],
  },
  teal: {
    50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4',
    400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e',
    800: '#115e59', 900: '#134e4a', 950: '#042f2e',
    grad: ['#14b8a6', '#0d9488'],
  },
  indigo: {
    50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
    400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
    800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
    grad: ['#6366f1', '#4338ca'],
  },
  crimson: {
    50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
    400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
    800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a',
    grad: ['#ef4444', '#b91c1c'],
  },
  cyan: {
    50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
    400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
    800: '#155e75', 900: '#164e63', 950: '#083344',
    grad: ['#06b6d4', '#0e7490'],
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const getSystemPref = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export const getStoredMode = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* ignore */ }
  return 'light';
};

export const resolveTheme = (mode) =>
  mode === 'system' ? getSystemPref() : mode;

/* ------------------------------------------------------------------ */
/* applyAppearance — injects CSS at runtime                            */
/* ------------------------------------------------------------------ */

export const applyAppearance = (customSettings) => {
  try {
    const raw = localStorage.getItem('systemSettingsExtended_v1');
    const settings = customSettings || (raw ? JSON.parse(raw) : {});
    const colorKey = settings.themeColor || 'orange';
    const c = THEME_COLORS[colorKey] || THEME_COLORS.orange;
    const density = settings.layoutDensity || 'comfortable';

    const root = document.documentElement;
    root.setAttribute('data-density', density);
    root.setAttribute('data-color-theme', colorKey);

    // Expose the gradient pair as a CSS variable so any component can
    // use var(--theme-grad) for buttons, badges, logo rings, etc.
    const [gradA, gradB] = c.grad || [c[500], c[600]];
    root.style.setProperty('--theme-grad-from', gradA);
    root.style.setProperty('--theme-grad-to', gradB);
    root.style.setProperty('--theme-grad', `linear-gradient(135deg, ${gradA}, ${gradB})`);

    // Legacy hex-alias variables — many components (Dashboard, Sidebar,
    // TopHeader) used hardcoded hex constants like NAVY=#4F46E5,
    // GOLD=#D4A017, GOLD_LIGHT=#F0C050. These are now mapped to the
    // active theme palette so the entire app re-colors on theme change.
    root.style.setProperty('--theme-primary', c[600]);       // was #4F46E5 (indigo-600)
    root.style.setProperty('--theme-primary-deep', c[800]);  // was #312E81 (indigo-900)
    root.style.setProperty('--theme-primary-light', c[500]); // lighter primary
    root.style.setProperty('--theme-gold', c[500]);          // was #D4A017 (gold/amber)
    root.style.setProperty('--theme-gold-light', c[400]);    // was #F0C050 (gold-light)
    root.style.setProperty('--theme-gold-dark', c[700]);     // was #A16207 (gold-dark)
    root.style.setProperty('--theme-accent-blue', '#3B82F6'); // unchanged secondary accent

    // Layout density via root font-size (Tailwind uses rem-based spacing)
    const fontSizeMap = { compact: '14px', comfortable: '16px', spacious: '18px' };
    root.style.fontSize = fontSizeMap[density] || '16px';

    // Detect if dark mode is currently active
    const isDark = root.classList.contains('dark');

    // Dynamically adjust theme palette depending on dark/light state to prevent bright tints in dark mode
    const finalPalette = { ...c };
    if (isDark) {
      // In dark mode, map light background colors to low-opacity variants of the theme color
      finalPalette[50] = `${c[500]}22`;  // ~13% opacity
      finalPalette[100] = `${c[500]}33`; // ~20% opacity
      finalPalette[200] = `${c[500]}4d`; // ~30% opacity
      finalPalette[300] = `${c[500]}66`; // ~40% opacity
      finalPalette[600] = c[400];
      finalPalette[700] = c[300]; // Bright readable accent
      finalPalette[800] = c[200]; // Soft vibrant light accent
      finalPalette[900] = c[100]; // Very light accent for high contrast
    }

    // Set the CSS variables on root
    Object.keys(finalPalette).forEach((key) => {
      root.style.setProperty(`--theme-${key}`, finalPalette[key]);
    });

    // Always REMOVE then RE-APPEND the style tag so it sits after all
    // webpack CSS bundles in the <head>. This guarantees cascade order wins.
    const existing = document.getElementById('dynamic-theme-override');
    if (existing) existing.remove();

    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme-override';
    document.head.appendChild(styleEl);

    // Build CSS overrides pointing to the root-scoped theme CSS variables.
    // In dark mode we use direct rgba() values for backgrounds and bright hex for text
    // so that low-numbered shade classes (50, 100) remain visible on dark surfaces.
    const bgAccent = isDark
      ? `rgba(${parseInt(c[500].slice(1,3),16)},${parseInt(c[500].slice(3,5),16)},${parseInt(c[500].slice(5,7),16)}`
      : null;

    const darkBg50  = isDark ? `${bgAccent},0.12)` : `var(--theme-50)`;
    const darkBg100 = isDark ? `${bgAccent},0.20)` : `var(--theme-100)`;
    const darkBg200 = isDark ? `${bgAccent},0.30)` : `var(--theme-200)`;
    const darkBg300 = isDark ? `${bgAccent},0.40)` : `var(--theme-300)`;

    // In dark mode, text-orange-600/700/800/900 should all be bright accent color
    const darkText50  = isDark ? c[400] : `var(--theme-50)`;
    const darkText100 = isDark ? c[300] : `var(--theme-100)`;
    const darkText200 = isDark ? c[300] : `var(--theme-200)`;
    const darkText300 = isDark ? c[300] : `var(--theme-300)`;
    const darkText400 = isDark ? c[400] : `var(--theme-400)`;
    const darkText500 = isDark ? c[400] : `var(--theme-500)`;
    const darkText600 = isDark ? c[400] : `var(--theme-600)`;
    const darkText700 = isDark ? c[300] : `var(--theme-700)`;
    const darkText800 = isDark ? c[300] : `var(--theme-800)`;
    const darkText900 = isDark ? c[200] : `var(--theme-900)`;

    styleEl.textContent = `
      /* ── Dynamic colour theme: ${colorKey} (isDark: ${isDark}) ── */

      /* ════════════════════════════════════════════════════════════════
         ORANGE class overrides (original accent system)
         ════════════════════════════════════════════════════════════════ */

      /* Backgrounds */
      html .bg-orange-50  { background-color: ${darkBg50}  !important; }
      html .bg-orange-100 { background-color: ${darkBg100} !important; }
      html .bg-orange-200 { background-color: ${darkBg200} !important; }
      html .bg-orange-300 { background-color: ${darkBg300} !important; }
      html .bg-orange-400 { background-color: var(--theme-400) !important; }
      html .bg-orange-500 { background-color: var(--theme-500) !important; }
      html .bg-orange-600 { background-color: var(--theme-600) !important; }
      html .bg-orange-700 { background-color: var(--theme-700) !important; }
      html .bg-orange-800 { background-color: var(--theme-800) !important; }
      html .bg-orange-900 { background-color: var(--theme-900) !important; }

      /* Text — in dark mode use bright/readable accent shades */
      html .text-orange-50  { color: ${darkText50}  !important; }
      html .text-orange-100 { color: ${darkText100} !important; }
      html .text-orange-200 { color: ${darkText200} !important; }
      html .text-orange-300 { color: ${darkText300} !important; }
      html .text-orange-400 { color: ${darkText400} !important; }
      html .text-orange-500 { color: ${darkText500} !important; }
      html .text-orange-600 { color: ${darkText600} !important; }
      html .text-orange-700 { color: ${darkText700} !important; }
      html .text-orange-800 { color: ${darkText800} !important; }
      html .text-orange-900 { color: ${darkText900} !important; }

      /* Borders */
      html .border-orange-50  { border-color: ${darkBg50}  !important; }
      html .border-orange-100 { border-color: ${darkBg100} !important; }
      html .border-orange-200 { border-color: ${isDark ? `${bgAccent},0.35)` : 'var(--theme-200)'} !important; }
      html .border-orange-300 { border-color: ${isDark ? `${bgAccent},0.45)` : 'var(--theme-300)'} !important; }
      html .border-orange-400 { border-color: var(--theme-400) !important; }
      html .border-orange-500 { border-color: var(--theme-500) !important; }
      html .border-orange-600 { border-color: var(--theme-600) !important; }

      /* Rings */
      html .ring-orange-200 { --tw-ring-color: var(--theme-200) !important; }
      html .ring-orange-300 { --tw-ring-color: var(--theme-300) !important; }
      html .ring-orange-500 { --tw-ring-color: var(--theme-500) !important; }
      html .focus\\:ring-orange-200:focus { --tw-ring-color: var(--theme-200) !important; }
      html .focus\\:ring-2:focus { --tw-ring-color: var(--theme-200) !important; }
      html .focus\\:border-orange-300:focus { border-color: var(--theme-300) !important; }

      /* Gradients — override both --tw-gradient-from and --tw-gradient-stops (Tailwind v3) */
      html .from-orange-400 {
        --tw-gradient-from: var(--theme-400) !important;
        --tw-gradient-stops: var(--theme-400), var(--tw-gradient-to, transparent) !important;
      }
      html .from-orange-500 {
        --tw-gradient-from: var(--theme-500) !important;
        --tw-gradient-stops: var(--theme-500), var(--tw-gradient-to, transparent) !important;
      }
      html .from-orange-600 {
        --tw-gradient-from: var(--theme-600) !important;
        --tw-gradient-stops: var(--theme-600), var(--tw-gradient-to, transparent) !important;
      }
      html .to-orange-400 { --tw-gradient-to: var(--theme-400) !important; }
      html .to-orange-500 { --tw-gradient-to: var(--theme-500) !important; }
      html .to-orange-600 { --tw-gradient-to: var(--theme-600) !important; }
      html .to-orange-700 { --tw-gradient-to: var(--theme-700) !important; }
      html .via-orange-500 {
        --tw-gradient-stops: var(--tw-gradient-from), var(--theme-500), var(--tw-gradient-to, transparent) !important;
      }

      /* Hover / focus states */
      html .hover\\:bg-orange-50:hover   { background-color: ${darkBg50}  !important; }
      html .hover\\:bg-orange-100:hover  { background-color: ${darkBg100} !important; }
      html .hover\\:bg-orange-500:hover  { background-color: var(--theme-500) !important; }
      html .hover\\:bg-orange-600:hover  { background-color: var(--theme-600) !important; }
      html .hover\\:text-orange-500:hover { color: var(--theme-500) !important; }
      html .hover\\:text-orange-600:hover { color: ${darkText600} !important; }
      html .hover\\:border-orange-300:hover { border-color: ${isDark ? `${bgAccent},0.45)` : 'var(--theme-300)'} !important; }
      html .hover\\:shadow-orange-200\\/50:hover {
        --tw-shadow-color: color-mix(in srgb, var(--theme-200) 50%, transparent) !important;
      }

      /* Opacity/translucent bg variants */
      html [class*="bg-orange-50\\/"]  { background-color: ${darkBg50}  !important; }
      html [class*="bg-orange-100\\/"] { background-color: ${darkBg100} !important; }
      html [class*="bg-orange-500\\/"] { background-color: ${isDark ? `${bgAccent},0.50)` : 'var(--theme-500)'} !important; }

      /* Shadow colour */
      html [class*="shadow-orange-200"] { --tw-shadow-color: var(--theme-200) !important; }
      html [class*="shadow-orange-500"] { --tw-shadow-color: var(--theme-500) !important; }

      /* Accent */
      html .accent-orange-500 { accent-color: var(--theme-500) !important; }

      /* ════════════════════════════════════════════════════════════════
         INDIGO class overrides — indigo is used as the primary accent in
         many components (buttons, active states, focus rings, badges).
         Remap ALL indigo-* shades to the selected theme color so the
         whole app changes when you pick a new theme.
         ════════════════════════════════════════════════════════════════ */

      /* Backgrounds */
      html .bg-indigo-50  { background-color: ${darkBg50}  !important; }
      html .bg-indigo-100 { background-color: ${darkBg100} !important; }
      html .bg-indigo-200 { background-color: ${darkBg200} !important; }
      html .bg-indigo-300 { background-color: ${darkBg300} !important; }
      html .bg-indigo-400 { background-color: var(--theme-400) !important; }
      html .bg-indigo-500 { background-color: var(--theme-500) !important; }
      html .bg-indigo-600 { background-color: var(--theme-600) !important; }
      html .bg-indigo-700 { background-color: var(--theme-700) !important; }
      html .bg-indigo-800 { background-color: var(--theme-800) !important; }
      html .bg-indigo-900 { background-color: var(--theme-900) !important; }

      /* Text */
      html .text-indigo-50  { color: ${darkText50}  !important; }
      html .text-indigo-100 { color: ${darkText100} !important; }
      html .text-indigo-200 { color: ${darkText200} !important; }
      html .text-indigo-300 { color: ${darkText300} !important; }
      html .text-indigo-400 { color: ${darkText400} !important; }
      html .text-indigo-500 { color: ${darkText500} !important; }
      html .text-indigo-600 { color: ${darkText600} !important; }
      html .text-indigo-700 { color: ${darkText700} !important; }
      html .text-indigo-800 { color: ${darkText800} !important; }
      html .text-indigo-900 { color: ${darkText900} !important; }

      /* Borders */
      html .border-indigo-200 { border-color: ${isDark ? `${bgAccent},0.35)` : 'var(--theme-200)'} !important; }
      html .border-indigo-300 { border-color: ${isDark ? `${bgAccent},0.45)` : 'var(--theme-300)'} !important; }
      html .border-indigo-400 { border-color: var(--theme-400) !important; }
      html .border-indigo-500 { border-color: var(--theme-500) !important; }
      html .border-indigo-600 { border-color: var(--theme-600) !important; }

      /* Rings */
      html .ring-indigo-200 { --tw-ring-color: var(--theme-200) !important; }
      html .ring-indigo-300 { --tw-ring-color: var(--theme-300) !important; }
      html .ring-indigo-400 { --tw-ring-color: var(--theme-400) !important; }
      html .ring-indigo-500 { --tw-ring-color: var(--theme-500) !important; }
      html .focus\\:ring-indigo-200:focus { --tw-ring-color: var(--theme-200) !important; }
      html .focus\\:ring-indigo-300:focus { --tw-ring-color: var(--theme-300) !important; }
      html .focus\\:ring-indigo-400:focus { --tw-ring-color: var(--theme-400) !important; }
      html .focus\\:ring-indigo-500:focus { --tw-ring-color: var(--theme-500) !important; }
      html .focus\\:border-indigo-300:focus { border-color: var(--theme-300) !important; }
      html .focus\\:border-indigo-500:focus { border-color: var(--theme-500) !important; }

      /* Gradients */
      html .from-indigo-400 { --tw-gradient-from: var(--theme-400) !important; --tw-gradient-stops: var(--theme-400), var(--tw-gradient-to, transparent) !important; }
      html .from-indigo-500 { --tw-gradient-from: var(--theme-500) !important; --tw-gradient-stops: var(--theme-500), var(--tw-gradient-to, transparent) !important; }
      html .from-indigo-600 { --tw-gradient-from: var(--theme-600) !important; --tw-gradient-stops: var(--theme-600), var(--tw-gradient-to, transparent) !important; }
      html .to-indigo-400 { --tw-gradient-to: var(--theme-400) !important; }
      html .to-indigo-500 { --tw-gradient-to: var(--theme-500) !important; }
      html .to-indigo-600 { --tw-gradient-to: var(--theme-600) !important; }
      html .to-indigo-700 { --tw-gradient-to: var(--theme-700) !important; }
      html .via-indigo-500 { --tw-gradient-stops: var(--tw-gradient-from), var(--theme-500), var(--tw-gradient-to, transparent) !important; }
      html .via-indigo-600 { --tw-gradient-stops: var(--tw-gradient-from), var(--theme-600), var(--tw-gradient-to, transparent) !important; }

      /* Hover states */
      html .hover\\:bg-indigo-50:hover   { background-color: ${darkBg50}  !important; }
      html .hover\\:bg-indigo-100:hover  { background-color: ${darkBg100} !important; }
      html .hover\\:bg-indigo-500:hover  { background-color: var(--theme-500) !important; }
      html .hover\\:bg-indigo-600:hover  { background-color: var(--theme-600) !important; }
      html .hover\\:bg-indigo-700:hover  { background-color: var(--theme-700) !important; }
      html .hover\\:text-indigo-500:hover { color: var(--theme-500) !important; }
      html .hover\\:text-indigo-600:hover { color: ${darkText600} !important; }
      html .hover\\:border-indigo-300:hover { border-color: ${isDark ? `${bgAccent},0.45)` : 'var(--theme-300)'} !important; }
      html .hover\\:border-indigo-500:hover { border-color: var(--theme-500) !important; }
      html .hover\\:border-indigo-600:hover { border-color: var(--theme-600) !important; }

      /* Opacity/translucent variants */
      html [class*="bg-indigo-50\\/"]  { background-color: ${darkBg50}  !important; }
      html [class*="bg-indigo-100\\/"] { background-color: ${darkBg100} !important; }
      html [class*="bg-indigo-500\\/"] { background-color: ${isDark ? `${bgAccent},0.50)` : 'var(--theme-500)'} !important; }
      html [class*="bg-indigo-600\\/"] { background-color: ${isDark ? `${bgAccent},0.60)` : 'var(--theme-600)'} !important; }

      /* Shadow */
      html [class*="shadow-indigo-200"] { --tw-shadow-color: var(--theme-200) !important; }
      html [class*="shadow-indigo-500"] { --tw-shadow-color: var(--theme-500) !important; }

      /* Accent */
      html .accent-indigo-500 { accent-color: var(--theme-500) !important; }

      /* ════════════════════════════════════════════════════════════════
         AMBER class overrides — amber is used for gold accents in many
         places (badges, highlights, #D4A017 gold equivalents).
         ════════════════════════════════════════════════════════════════ */
      html .bg-amber-50  { background-color: ${darkBg50}  !important; }
      html .bg-amber-100 { background-color: ${darkBg100} !important; }
      html .bg-amber-400 { background-color: var(--theme-400) !important; }
      html .bg-amber-500 { background-color: var(--theme-500) !important; }
      html .bg-amber-600 { background-color: var(--theme-600) !important; }
      html .text-amber-400 { color: ${darkText400} !important; }
      html .text-amber-500 { color: ${darkText500} !important; }
      html .text-amber-600 { color: ${darkText600} !important; }
      html .text-amber-700 { color: ${darkText700} !important; }
      html .border-amber-300 { border-color: ${isDark ? `${bgAccent},0.45)` : 'var(--theme-300)'} !important; }
      html .border-amber-400 { border-color: var(--theme-400) !important; }
      html .border-amber-500 { border-color: var(--theme-500) !important; }
      html .from-amber-400 { --tw-gradient-from: var(--theme-400) !important; --tw-gradient-stops: var(--theme-400), var(--tw-gradient-to, transparent) !important; }
      html .from-amber-500 { --tw-gradient-from: var(--theme-500) !important; --tw-gradient-stops: var(--theme-500), var(--tw-gradient-to, transparent) !important; }
      html .to-amber-400 { --tw-gradient-to: var(--theme-400) !important; }
      html .to-amber-500 { --tw-gradient-to: var(--theme-500) !important; }
      html .to-amber-600 { --tw-gradient-to: var(--theme-600) !important; }
      html .hover\\:bg-amber-50:hover  { background-color: ${darkBg50}  !important; }
      html .hover\\:bg-amber-100:hover { background-color: ${darkBg100} !important; }
      html [class*="bg-amber-50\\/"]  { background-color: ${darkBg50}  !important; }
      html [class*="bg-amber-100\\/"] { background-color: ${darkBg100} !important; }

      /* ════════════════════════════════════════════════════════════════
         Hardcoded hex color overrides — many components use inline styles
         with hex values like #4F46E5 (indigo-600), #D4A017 (gold),
         #F0C050 (gold-light). Override these via attribute selectors on
         inline style is not possible, but we CAN override elements that
         use these as CSS custom properties or via class-based overrides.
         The Tailwind class overrides above handle the majority. For the
         remaining inline hex values, we set CSS variables that components
         can reference: --theme-primary, --theme-gold, --theme-gold-light.
         ════════════════════════════════════════════════════════════════ */
    `;
  } catch (e) {
    console.error('[Theme] applyAppearance error:', e);
  }
};

/* ------------------------------------------------------------------ */
/* applyThemeEarly — called synchronously before React renders         */
/* ------------------------------------------------------------------ */

export const applyThemeEarly = () => {
  try {
    const mode = getStoredMode();
    const resolved = resolveTheme(mode);
    const root = document.documentElement;
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-theme', resolved);
    applyAppearance();
  } catch { /* ignore */ }
};

/* ------------------------------------------------------------------ */
/* Context                                                              */
/* ------------------------------------------------------------------ */

const ThemeContext = createContext({
  mode: 'light',
  resolvedTheme: 'light',
  setMode: () => {},
  toggle: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState(() => getStoredMode());
  const [resolvedTheme, setResolved] = useState(() => resolveTheme(getStoredMode()));

  const applyDom = useCallback((next) => {
    const root = document.documentElement;
    if (next === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.setAttribute('data-theme', next);
    setResolved(next);
    // Trigger appearance recalculation immediately when dark mode state changes
    applyAppearance();
    try {
      window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme: next } }));
    } catch { /* ignore */ }
  }, []);

  const setMode = useCallback((next) => {
    const clean = next === 'dark' || next === 'system' ? next : 'light';
    setModeState(clean);
    try { localStorage.setItem(STORAGE_KEY, clean); } catch { /* ignore */ }
    applyDom(resolveTheme(clean));
  }, [applyDom]);

  const toggle = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [resolvedTheme, setMode]);

  // Honour OS theme changes while user is on "system".
  useEffect(() => {
    if (mode !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => applyDom(e.matches ? 'dark' : 'light');
    try { mq.addEventListener('change', handler); } catch { mq.addListener(handler); }
    return () => {
      try { mq.removeEventListener('change', handler); } catch { mq.removeListener(handler); }
    };
  }, [mode, applyDom]);

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        const next = e.newValue === 'dark' || e.newValue === 'system' ? e.newValue : 'light';
        setModeState(next);
        applyDom(resolveTheme(next));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applyDom]);

  // On mount: apply theme + appearance, then listen for appearance changes.
  useEffect(() => {
    applyDom(resolveTheme(mode));
    applyAppearance();
    const handleAppearanceChange = () => applyAppearance();
    window.addEventListener('appearance-changed', handleAppearanceChange);
    return () => window.removeEventListener('appearance-changed', handleAppearanceChange);
    // eslint-disable-next-line
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedTheme, setMode, toggle }),
    [mode, resolvedTheme, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
