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
/* Color palettes                                                       */
/* ------------------------------------------------------------------ */

const THEME_COLORS = {
  orange: {
    50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
    400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
    800: '#9a3412', 900: '#7c2d12', 950: '#431407',
  },
  blue: {
    50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
    400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
    800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
  },
  emerald: {
    50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
    400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
    800: '#065f46', 900: '#064e3b', 950: '#022c22',
  },
  purple: {
    50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
    400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
    800: '#6b21a8', 900: '#581c87', 950: '#3b0764',
  },
  rose: {
    50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af',
    400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
    800: '#9f1239', 900: '#881337', 950: '#4c0519',
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
        --tw-shadow-color: var(--theme-200)80 !important;
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
