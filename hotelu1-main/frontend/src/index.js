import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, applyThemeEarly } from './contexts/ThemeContext';
import './index.css';

// Apply saved theme to <html> synchronously, before React renders,
// to avoid a flash of the wrong theme on cold loads.
applyThemeEarly();

// Enhanced service worker and cache clearing
const clearCachesAndServiceWorkers = async () => {
  try {
    // Clear all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      console.log('All service workers unregistered');
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('All caches cleared');
    }

    // Clear localStorage (except for specific keys you want to keep)
    const keysToKeep = [
      'theme',
      'language',
      'systemSettingsExtended_v1',
      'token',
      'user',
      'role',
      'globalTaxDiscount',
      'rolePermissionsMatrix',
      'posCountry',
      'soundNotificationPreferences',
      'qrTableCodes',
      'lastOrder'
    ];
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

// Execute cache clearing immediately
clearCachesAndServiceWorkers();

// Prevent hot reload issues with better error handling
if (module.hot) {
  module.hot.accept();
  module.hot.dispose(() => {
    console.log('Hot module replacement disposed');
  });
}

// Add cache busting to prevent stale hot-update.js files
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('hot-update')) {
    const separator = url.includes('?') ? '&' : '?';
    args[0] = `${url}${separator}t=${Date.now()}`;
  }
  return originalFetch.apply(this, args);
};

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