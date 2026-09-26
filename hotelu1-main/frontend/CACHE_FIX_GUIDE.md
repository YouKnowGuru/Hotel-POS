# Restaurant POS System - Cache Management Guide

## Quick Solutions for Caching Issues

### 1. Automatic Cache Clearing (Built-in)
The app now automatically clears all caches and service workers on startup.

### 2. Manual Browser Cache Clearing
**Chrome/Edge:**
- Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
- Select "All time" for time range
- Check "Cached images and files" and "Cookies and other site data"
- Click "Clear data"

**Firefox:**
- Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
- Select "Everything" for time range
- Check "Cache" and "Cookies"
- Click "Clear Now"

**Safari (Mac):**
- Develop menu → Empty Caches
- Safari menu → Clear History → All history

### 3. Development Commands

```bash
# Start with cache cleanup
npm run start-clean

# Complete reset (if issues persist)
npm run hard-reset

# Regular start (after initial cleanup)
npm start
```

### 4. Developer Tools Cache Clearing
- Open Developer Tools (`F12` or `Ctrl+Shift+I`)
- Right-click refresh button → "Empty Cache and Hard Reload"
- Network tab → Disable cache checkbox

### 5. Service Worker Management
The app automatically unregisters all service workers. To verify:
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(console.log);
```

## What We Fixed

1. **Service Worker Elimination**: Complete unregistration on app load
2. **Cache Prevention**: Meta tags prevent browser caching
3. **Hot Update Fix**: Fetch interceptor prevents stale hot-update.js files
4. **Storage Cleanup**: Automatic localStorage/sessionStorage clearing
5. **Build Cache**: Scripts to clear build and npm caches

## Testing

1. Run `npm run start-clean` for first-time setup
2. Test in normal browser mode - should work same as incognito
3. If issues appear, run `npm run hard-reset`

The app will now consistently load the latest code in all browser modes.
