@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo Pamela Personal - Site + Webhook HTTPS
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-payment-tunnel.ps1"

pause
