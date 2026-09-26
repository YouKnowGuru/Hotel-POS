@echo off
echo 🧹 Cleaning React project caches...

REM Clear npm cache
call npm cache clean --force

REM Clear node_modules cache
if exist node_modules\.cache rmdir /s /q node_modules\.cache

REM Clear browser data directories
if exist .eslintcache del .eslintcache

REM Clear any service worker files
del /f /q *.worker.js 2>nul
del /f /q service-worker.js 2>nul
del /f /q sw.js 2>nul

REM Clear build directory
if exist build rmdir /s /q build

echo ✅ Cache cleanup complete!
echo 🚀 Starting React development server...

REM Start with no cache
call npm start
