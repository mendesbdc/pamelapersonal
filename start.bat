@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo Pâmela Personal - Iniciando projeto
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js/npm nao foi encontrado no computador.
  echo Instale o Node.js antes de iniciar o projeto.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERRO: Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Limpando API antiga na porta 3334, se existir...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3334" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>nul
)

echo.
echo Atualizando banco de dados...
call npm run db:setup
if errorlevel 1 (
  echo.
  echo ERRO: Falha ao preparar o banco de dados.
  pause
  exit /b 1
)

echo.
echo Abrindo o painel em modo desenvolvimento...
echo Site: http://127.0.0.1:5173
echo API:  http://127.0.0.1:3334
echo.
echo IMPORTANTE: mantenha esta janela aberta enquanto usa o site.
echo.

call npm run dev

pause

