@echo off
setlocal EnableDelayedExpansion
title Pamela Personal - Gerar APK

cd /d "%~dp0"

set "BUILD_APK_LOG=%~dp0build-apk-ultimo-log.txt"

echo ========================================
echo Pâmela Mendes Personal - Gerar APK Android
echo ========================================
echo.
echo Registo completo desta execucao:
echo   %BUILD_APK_LOG%
echo Se a janela fechar sozinha, abra esse ficheiro para ver o erro.
echo.
echo O APK precisa da URL da API Node (telemovel na mesma rede que o PC).
echo Crie o ficheiro api-url-for-apk.txt com uma linha, ex.:
echo   http://192.168.1.50:3334
echo Modelo: api-url-for-apk.example.txt
echo A API deve estar a correr ^(npm run api^) e a escutar na rede.
echo Se o build der EPERM em dist\, feche o Cursor/antivirus sobre a pasta ou apague dist\ manualmente.
echo.

if exist "%~dp0tools\jdk-21\bin\java.exe" (
  set "JAVA_HOME=%~dp0tools\jdk-21"
  if exist "C:\Android\sdk\cmdline-tools\latest\bin\sdkmanager.bat" (
    set "ANDROID_HOME=C:\Android\sdk"
  ) else (
    set "ANDROID_HOME=%~dp0tools\android-sdk"
  )
  set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
  set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"
) else (
  echo JDK 21 local nao encontrado. Instalando...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-jdk21.ps1"
  if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel instalar o JDK 21.
    echo.
    pause
    exit /b 1
  )
  set "JAVA_HOME=%~dp0tools\jdk-21"
  if exist "C:\Android\sdk\cmdline-tools\latest\bin\sdkmanager.bat" (
    set "ANDROID_HOME=C:\Android\sdk"
  ) else (
    set "ANDROID_HOME=%~dp0tools\android-sdk"
  )
  set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
  set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"
)

echo ===== Inicio %DATE% %TIME% =====> "%BUILD_APK_LOG%"
echo.
echo Esta janela fica sem novas linhas *a proposito*: toda a saida do Vite/Gradle vai
echo para o ficheiro de registo. Abriu-se outra janela "Progresso build APK" com as
echo ultimas linhas em tempo real ^(feche-a quando acabar o build^).
echo.
echo Vite + Gradle costumam levar 5 a 25 minutos (ou mais em PC lento).
echo.
start "Progresso build APK" powershell -NoProfile -WindowStyle Normal -Command "Get-Content -LiteralPath '%BUILD_APK_LOG%' -Wait -Tail 40"
timeout /t 2 /nobreak >nul
call npm run android:apk >> "%BUILD_APK_LOG%" 2>&1
set "NPMEC=%ERRORLEVEL%"
echo.>>"%BUILD_APK_LOG%"
echo [build-apk.bat] codigo npm apos android:apk: !NPMEC! ^(0=OK^)>>"%BUILD_APK_LOG%"

rem layout.buildDirectory do app aponta para %%LOCALAPPDATA%%\PamelaPersonalAndroidBuild\app — APK: ...\app\outputs\apk\debug\
set "APK_OUT1=%LOCALAPPDATA%\PamelaPersonalAndroidBuild\app\outputs\apk\debug\app-debug.apk"
set "APK_OUT2=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
set "HASAPK=0"
if exist "%APK_OUT1%" set "HASAPK=1"
if exist "%APK_OUT2%" set "HASAPK=1"
if "%HASAPK%"=="1" goto after_npm_ok

if not "!NPMEC!"=="0" (
  echo.
  echo ERRO: Nao foi possivel gerar o APK (npm saiu com codigo !NPMEC!^).
  echo Confira Android SDK, feche o Android Studio na pasta do projeto e antivírus.
  echo Se apareceu AccessDenied / clean nao apaga android\build: Area de Trabalho + OneDrive/antivirus.
  echo   Builds Gradle usam %%LOCALAPPDATA%%\PamelaPersonalAndroidBuild (app, root, plugins).
  echo   Pode apagar manualmente android\build se ficar lixo antigo.
  echo.
  echo Ultimas linhas do registo:
  echo ----------------------------------------
  powershell -NoProfile -Command "Get-Content -LiteralPath '%BUILD_APK_LOG%' -Tail 80 -ErrorAction SilentlyContinue"
  echo ----------------------------------------
  echo Log completo: "%BUILD_APK_LOG%"
  echo.
  pause
  exit /b 1
)
echo.
echo ERRO: npm indicou sucesso mas nao encontrei app-debug.apk em:
echo   %APK_OUT1%
echo   %APK_OUT2%
echo.
pause
exit /b 1

:after_npm_ok
if not "!NPMEC!"=="0" (
  echo.>>"%BUILD_APK_LOG%"
  echo [build-apk.bat] npm devolveu !NPMEC! mas o APK existe — a tratar como sucesso.>>"%BUILD_APK_LOG%"
)
echo ===== Fim OK %DATE% %TIME% =====>> "%BUILD_APK_LOG%"
echo.
echo [OK] Compilacao npm/Gradle terminou. A copiar o APK e publicar...
echo.

set "APK_PATH=%LOCALAPPDATA%\PamelaPersonalAndroidBuild\app\outputs\apk\debug\app-debug.apk"
if not exist "%APK_PATH%" set "APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK_PATH%" if exist "android\app-build\outputs\apk\debug\app-debug.apk" set "APK_PATH=android\app-build\outputs\apk\debug\app-debug.apk"
if not exist "%APK_PATH%" if exist "android\app-build-icon\outputs\apk\debug\app-debug.apk" set "APK_PATH=android\app-build-icon\outputs\apk\debug\app-debug.apk"
if not exist "%APK_PATH%" if exist "android\app-build-mendes\outputs\apk\debug\app-debug.apk" set "APK_PATH=android\app-build-mendes\outputs\apk\debug\app-debug.apk"

if not exist "releases" mkdir "releases"
copy /Y "%APK_PATH%" "releases\pamela-mendes-personal.apk" >nul

call node scripts\publish-apk.mjs
if errorlevel 1 (
  echo.
  echo AVISO: Nao foi possivel copiar o APK para dist\downloads.
  echo Feche o navegador/antivirus que esteja usando o arquivo e rode: node scripts\publish-apk.mjs
  echo.
)

echo.
echo APK gerado em:
echo %APK_PATH%
echo.
echo Copia estavel para download do site:
echo releases\pamela-mendes-personal.apk
echo dist\downloads\pamela-mendes-personal.apk
echo.
pause
