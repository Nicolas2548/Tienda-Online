@echo off
echo.
echo  ================================================
echo   UpvShop - Iniciando proyecto...
echo  ================================================
echo.

REM Verificar que Docker esté corriendo
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no está corriendo.
    echo Por favor abre Docker Desktop y vuelve a ejecutar este script.
    pause
    exit /b 1
)

echo [1/4] Docker detectado correctamente.

REM Detener contenedores anteriores si existen
echo [2/4] Limpiando contenedores anteriores...
docker-compose down -v >nul 2>&1

REM Construir e iniciar todos los contenedores
echo [3/4] Construyendo e iniciando contenedores (primera vez tarda ~5 min)...
docker-compose up --build -d

if errorlevel 1 (
    echo [ERROR] Hubo un problema al iniciar los contenedores.
    echo Ejecuta: docker-compose logs para ver los detalles.
    pause
    exit /b 1
)

echo [4/4] Esperando que los servicios estén listos...
timeout /t 15 /nobreak >nul

echo.
echo  ================================================
echo   Proyecto iniciado exitosamente!
echo  ================================================
echo.
echo   Tienda:        http://localhost:3000
echo   API Usuarios:  http://localhost:8001/docs
echo   API Catalogo:  http://localhost:8002/docs
echo   API Carrito:   http://localhost:8003/docs
echo   API Ordenes:   http://localhost:8004/docs
echo   API Pagos:     http://localhost:8005/docs
echo   Base de datos: http://localhost:5050
echo.
echo   Cuenta admin:
echo     Email:       admin@upvshop.com
echo     Password:    Admin123!
echo.
echo   Para detener: stop.bat
echo  ================================================
echo.

start http://localhost:3000
pause
