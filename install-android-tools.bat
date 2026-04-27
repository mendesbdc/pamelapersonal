@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo Pamela Personal - Instalar Android Tools
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-android-toolchain.ps1"
if errorlevel 1 (
  echo.
  echo ERRO: Nao foi possivel instalar as ferramentas Android.
  echo.
  pause
  exit /b 1
)

echo.
echo Ferramentas Android instaladas.
echo.
pause
