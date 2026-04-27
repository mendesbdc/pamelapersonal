@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Repor lista Git — ignora JDK e pastas grandes

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 if exist "C:\Program Files\Git\cmd\git.exe" set "GIT=C:\Program Files\Git\cmd\git.exe"
if errorlevel 1 if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "GIT=%LocalAppData%\Programs\Git\cmd\git.exe"

where git >nul 2>&1
if /I "%GIT%"=="git" if errorlevel 1 (
  echo Git nao encontrado. Instale o Git e volte a correr.
  pause
  exit /b 1
)

echo A repor o indice Git (git rm --cached) e a voltar a adicionar respeitando .gitignore...
echo Isto NAO apaga ficheiros no disco, so a lista do Git.
echo.

if not exist ".git" (
  echo Pasta .git nao encontrada. Corra "Create repository" no GitHub Desktop primeiro.
  pause
  exit /b 1
)

"%GIT%" rm -r --cached . 2>nul
if errorlevel 1 (
  echo Se o comando acima falhou, o indice pode estar corrompido.
  echo Opcao A: apague a pasta oculta .git e crie o repositorio de novo no GitHub Desktop.
  echo Opcao B: copie esta pasta, apague .git na original, volte a "Add existing repository".
  pause
  exit /b 1
)

"%GIT%" add .
echo.
echo Pronto. Abra o GitHub Desktop — o numero de ficheiros deve ser MUITO menor.
echo Faca o commit e depois Publish.
echo.
pause
