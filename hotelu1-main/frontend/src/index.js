import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, applyThemeEarly } from './contexts/ThemeContext';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import './index.css';

// Apply saved theme to <html> synchronously, before React renders,
// to avoid a flash of the wrong theme on cold loads.
applyThemeEarly();

// BUGFIX: the browser's automatic scroll restoration memory made SPA
// route changes "land" at the previous page's viewport offset — for
// users who had scrolled to the footer that meant clicking any nav link
// opened the next page already at its footer. Manual restoration lets
// PublicShell control scroll position on every navigation.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// NOTE: an earlier version of this file wiped localStorage, sessionStorage
// and caches on EVERY page load. That destroyed the QR customer session
// (placed-order tracking, payment tokens), staff notification state and the
// branding cache, breaking every reload-based journey. Persisted state is
// app data now — do not clear it at boot. Dev-only stale-cache recovery is
// handled by the browser DevTools / hard reload instead.

// Prevent hot reload issues with better error handling
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    console.log('Hot module replacement disposed');
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// BUGFIX: the registered PWA service worker precached the old JS bundle and
// kept serving it after deployments, so UI changes never appeared for
// returning visitors ("the hero still looks the same"). Unregistering makes
// the browser fetch the fresh hashed bundle on every load. Re-enable with
// an update-on-reload strategy once a stable offline shell is needed.
serviceWorkerRegistration.unregister();