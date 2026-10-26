// Service Worker registration helper for Hotel POS PWA

export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('PWA ServiceWorker registered successfully:', registration.scope);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('PWA: New content available; please refresh.');
                  if (config && config.onUpdate) {
                    config.onUpdate(registration);
                  }
                } else {
                  console.log('PWA: Content cached for offline use.');
                  if (config && config.onSuccess) {
                    config.onSuccess(registration);
                  }
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn('PWA ServiceWorker registration failed:', error);
        });
    });
  }
}

/**
 * BUGFIX: unregister() used to remove the worker registration only. Any
 * Cache Storage entries the old worker had written kept being served, so
 * visitors who had loaded an older build saw a zombie bundle FOREVER —
 * new deploys looked "not applied" — bugs we had already fixed (cart
 * popup, scroll resets) kept reappearing on returning devices.
 *
 * This now: (1) unregisters every active/waiting worker, (2) deletes
 * every cache the old precacher wrote, and (3) if the page being shown
 * was controlled by a stale worker, hard-reloads ONCE so the user gets
 * the fresh bundle instead of the cached one (guarded so it can't loop).
 */
export async function unregister() {
  if (!('serviceWorker' in navigator)) return undefined;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const REMOVED_FLAG = 'sw-zombie-reload-done';
    let hadWorker = false;

    await Promise.all(registrations.map(async (reg) => {
      hadWorker = hadWorker || !!reg.active || !!reg.installing || !!reg.waiting;
      await reg.unregister();
    }));

    // Delete every cache the old precaching SW wrote, otherwise the stale
    // app chunks keep being served to returning visitors. The app itself
    // never writes to Cache Storage (verified) — its data lives in
    // localStorage — so nothing of value is lost here.
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) { /* private-mode / quota — non-fatal */ }
    }

    if (registrations.length === 0) {
      // Clean boot (or the zombie is already gone) — clear the guard.
      try { window.sessionStorage.removeItem(REMOVED_FLAG); } catch (_) {}
      return undefined;
    }

    // If the just-removed worker still controls this page, the bundle we
    // are running may itself be the stale one. Reload once so the fresh
    // bundle is the FIRST thing the user sees after this code ships.
    if (hadWorker && !navigator.serviceWorker.controller &&
        !window.sessionStorage.getItem(REMOVED_FLAG)) {
      try {
        window.sessionStorage.setItem(REMOVED_FLAG, '1');
        window.location.reload();
      } catch (_) { /* blocked storage — skip the reload */ }
    }
    return undefined;
  } catch (_) {
    // Last-resort legacy path if the richer flow is unavailable.
    try {
      navigator.serviceWorker.ready
        .then((registration) => registration.unregister())
        .catch(() => {});
    } catch (_) { /* ignore */ }
    return undefined;
  }
}
