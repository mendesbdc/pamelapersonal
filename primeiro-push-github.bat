@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================
echo  Primeiro envio para: github.com/mendesbdc/pamelapersonal
echo ============================================
echo.

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 (
  if exist "C:\Program Files\Git\cmd\git.exe" set "GIT=C:\Program Files\Git\cmd\git.exe"
  if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT=%LocalAppData%\Programs\Git\cmd\git.exe"
)
if /I "%GIT%"=="git" where git >nul 2>&1
if /I not "%GIT%"=="git" if not exist "%GIT%" (
  echo [ERRO] Nao encontrei o git.exe. Instale: https://git-scm.com/download/win
  echo Depois: feche esta janela, abra a pasta e volte a correr este ficheiro.
  pause
  exit /b 1
)
if /I "%GIT%"=="git" (
  where git >nul 2>&1
  if errorlevel 1 (
    echo [ERRO] O Git nao esta no PATH.
    echo Instale: https://git-scm.com/download/win
    echo Ou reabra o PC apos a instalacao.
    pause
    exit /b 1
  )
)
echo A usar: %GIT%
echo.

set "REPO=https://github.com/mendesbdc/pamelapersonal.git"

if not exist ".git" (
  echo [1/5] git init
  call "%GIT%" init
) else (
  echo [1/5] repositorio git ja existe — a continuar
)

"%GIT%" config user.name "mendesbdc"
"%GIT%" config user.email "mendesbdc@users.noreply.github.com"

echo [2/5] git add .
call "%GIT%" add .
if errorlevel 1 ( echo ERRO no git add. & pause & exit /b 1 )

echo [3/5] commit
call "%GIT%" status --short
call "%GIT%" commit -m "Primeiro envio Pâmela Personal"
if errorlevel 1 (
  echo Aviso: commit falhou ^(pode nao haver alteracoes^). Tenta: git status
)

echo [4/5] branch main e remote
call "%GIT%" branch -M main 2>nul
"%GIT%" remote get-url origin >nul 2>&1
if errorlevel 1 (
  call "%GIT%" remote add origin %REPO%
) else (
  call "%GIT%" remote set-url origin %REPO%
)

echo [5/5] git push — pode pedir login do GitHub ^(navegador ou token^)
call "%GIT%" push -u origin main
if errorlevel 1 (
  echo.
  echo [ERRO] O push falhou. Comum: falta de login, token, ou 2FA.
  echo Leia: https://docs.github.com/en/get-started/git-basics
  echo Para token: GitHub - Settings - Developer settings - Personal access tokens
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Codigo no GitHub. Atualize a pagina: https://github.com/mendesbdc/pamelapersonal
echo Depois: Settings - Secrets - adicionar VITE_API_URL
echo.
pause
exit /b 0
