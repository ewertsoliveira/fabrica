@echo off
title Servidor - Laboratorio de Design
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O programa Node nao foi encontrado neste computador.
  echo Peca ao agente para instalar ou conferir o Node e tente de novo.
  echo.
  pause
  exit /b 1
)
echo ========================================================
echo   Abrindo o Laboratorio de Design
echo ========================================================
echo.
echo Deixe esta janela aberta enquanto estiver usando.
echo Para encerrar, feche esta janela ou aperte Ctrl+C.
echo.
node _fabrica/paineis/servidor.js
pause
