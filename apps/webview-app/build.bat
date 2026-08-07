@echo off
echo =======================================================
echo Orbit Bus Tracker - Android App Builder
echo =======================================================
echo.

set EAS_SKIP_AUTO_FINGERPRINT=1
call npx eas-cli build -p android --profile preview

echo.
pause
