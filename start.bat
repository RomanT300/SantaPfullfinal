@echo off
REM ================================================================
REM Script de inicio automático para PTAR App
REM ================================================================

echo.
echo ========================================
echo   Iniciando PTAR Application
echo ========================================
echo.

REM Verificar si Docker está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker no esta corriendo.
    echo Por favor, inicia Docker Desktop y ejecuta este script nuevamente.
    echo.
    pause
    exit /b 1
)

echo [1/4] Docker detectado correctamente
echo.

REM Copiar archivo de variables de entorno si no existe
if not exist .env (
    echo [2/4] Copiando archivo de configuracion .env
    copy .env.docker .env >nul
    echo       Variables de entorno configuradas
) else (
    echo [2/4] Archivo .env ya existe
)
echo.

REM Detener contenedores previos si existen
echo [3/4] Deteniendo contenedores previos (si existen)...
docker-compose down >nul 2>&1
echo       Contenedores anteriores detenidos
echo.

REM Iniciar contenedores
echo [4/4] Iniciando contenedores de la aplicacion...
echo       Esto puede tardar unos minutos la primera vez...
echo.
docker-compose up -d

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema al iniciar los contenedores.
    echo Por favor, revisa los logs con: docker-compose logs
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Aplicacion iniciada correctamente
echo ========================================
echo.
echo   Frontend: http://localhost
echo   Backend:  http://localhost:5000
echo.
echo Esperando a que los servicios esten listos...
timeout /t 5 /nobreak >nul

REM Verificar estado de contenedores
echo.
echo Estado de contenedores:
docker ps --filter "name=ptar" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

REM Abrir navegador automáticamente
echo Abriendo navegador...
timeout /t 2 /nobreak >nul
start http://localhost

echo.
echo ========================================
echo   Comandos utiles:
echo ========================================
echo   Ver logs:      docker-compose logs -f
echo   Detener app:   docker-compose down
echo   Reiniciar:     docker-compose restart
echo ========================================
echo.
echo Presiona cualquier tecla para salir...
pause >nul
