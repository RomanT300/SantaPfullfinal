@echo off
REM ================================================================
REM Script para ver logs de PTAR App
REM ================================================================

echo.
echo ========================================
echo   Logs de PTAR Application
echo ========================================
echo.
echo Presiona Ctrl+C para salir
echo.

docker-compose logs -f --tail=100
