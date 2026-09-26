@echo off
echo ==========================================
echo  Restaurant POS - Network Mode
echo  For Mobile QR Code Access
echo ==========================================
echo.
echo Getting your IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo Your IP: %IP%
echo.
echo 1. Backend will run on: http://%IP%:3001
echo 2. Frontend will run on: http://%IP%:3000
echo.
echo Make sure your phone is on the SAME WiFi!
echo.
echo Starting servers...
echo.

start "Backend Server" cmd /k "cd backend && node server.js"
timeout /t 3
start "Frontend Server" cmd /k "cd frontend && npm run start:network"

echo.
echo Both servers starting...
echo Wait 10-15 seconds, then open http://%IP%:3000
echo.
pause
