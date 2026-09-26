#!/bin/bash

# Clear all caches and prevent service worker issues
echo "🧹 Cleaning React project caches..."

# Clear npm cache
npm cache clean --force

# Clear node_modules cache
rm -rf node_modules/.cache

# Clear browser data directories
rm -rf .eslintcache

# Clear any service worker files
find . -name "*.worker.js" -delete 2>/dev/null || true
find . -name "service-worker.js" -delete 2>/dev/null || true
find . -name "sw.js" -delete 2>/dev/null || true

# Clear build directory
rm -rf build

echo "✅ Cache cleanup complete!"
echo "🚀 Starting React development server..."

# Start with no cache
npm start
