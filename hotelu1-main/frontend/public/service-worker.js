// KILL-SWITCH SERVICE WORKER (hotel-pos v2 — cache demolition)
//
// History: an early build shipped a precaching service worker
// (cache 'hotel-pos-v1.0.0', stale-while-revalidate). We since stopped
// registering service workers entirely (src/index.js calls unregister())
// because cached legacy shells made every new deploy look "broken" /
// "not applied" on returning devices.
//
// This file now exists ONLY for devices that still have the old worker
// installed: the browser re-checks /service-worker.js on navigation, sees
// new bytes, installs this replacement, and the activate step below:
//   1. deletes EVERY cache the old worker ever wrote, and
//   2. unregisters the worker itself.
// After that the site behaves like a normal network-first web app again.
// There is deliberately no fetch handler — the default (network) applies.

const kill = async () => {
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch (_) {
    // private mode / quota errors are non-fatal
  }
  await self.registration.unregister();
};

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(kill());
});
