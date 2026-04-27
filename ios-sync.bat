@echo off
setlocal EnableDelayedExpansion
title Pâmela Personal - Sincronizar iOS (Capacitor)

cd /d "%~dp0"

set "IOS_LOG=%~dp0ios-sync-ultimo-log.txt"

echo ========================================
echo Pâmela Mendes Personal - Sincronizar iOS
echo ========================================
echo.
echo Este script atualiza a pasta "ios" com o site compilado (dist^) e a config do
echo Capacitor. NO WINDOWS nao e possivel gerar o .ipa: no Mac, abra o Xcode
echo   npm run ios:open
echo e arquive / submeta para a App Store.
echo.
echo Registo desta execucao: %IOS_LOG%
echo.
echo Requisitos: o mesmo que o APK (URL da API acessiveis pelo telemovel):
echo   Crie o ficheiro api-url-for-apk.txt com uma linha, ex.:
echo   http://192.168.1.50:3334
echo Opcional: google-meet-url-for-apk.txt (link de agendamento).
echo.
echo O comando corre: build Vite + npx cap sync ios
echo.
pause

echo ===== Inicio %DATE% %TIME% =====> "%IOS_LOG%"

call npm run ios:sync >> "%IOS_LOG%" 2>&1
set "NPMEC=!ERRORLEVEL!"

echo.>>"%IOS_LOG%"
echo [ios-sync.bat] codigo apos npm run ios:sync: !NPMEC! ^(0=OK^)>>"%IOS_LOG%"
echo ===== Fim %DATE% %TIME% =====>>"%IOS_LOG%"

if not "!NPMEC!"=="0" (
  echo.
  echo ERRO: npm saiu com codigo !NPMEC!.
  echo Ultimas linhas do registo:
  echo ----------------------------------------
  powershell -NoProfile -Command "Get-Content -LiteralPath '%IOS_LOG%' -Tail 50 -ErrorAction SilentlyContinue"
  echo ----------------------------------------
  echo.
  echo Log completo: "%IOS_LOG%"
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Pasta ios\ sincronizada com dist\ e plugins.
echo.
echo Proximo passo (num Mac com Xcode^):
echo   1) Copie a pasta do projeto para o Mac ou use git
echo   2) cd para esta pasta e: npm run ios:open
echo   3) No Xcode: Signing ^+ Team, depois Product -^> Run ou Archive
echo.
echo O registo completo: %IOS_LOG%
echo.
pause
exit /b 0
