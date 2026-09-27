import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, applyThemeEarly } from './contexts/ThemeContext';
import './index.css';

// Apply saved theme to <html> synchronously, before React renders,
// to avoid a flash of the wrong theme on cold loads.
applyThemeEarly();

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