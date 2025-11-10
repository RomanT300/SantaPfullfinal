@echo off
REM ================================================================
REM Script para detener PTAR App
REM ================================================================

echo.
echo ========================================
echo   Deteniendo PTAR Application
echo ========================================
echo.

REM Verificar si Docker está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker no esta corriendo.
    echo.
    pause
    exit /b 1
)

echo Deteniendo contenedores...
docker-compose down

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al detener los contenedores.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Aplicacion detenida correctamente
echo ========================================
echo.
echo Presiona cualquier tecla para salir...
pause >nul
