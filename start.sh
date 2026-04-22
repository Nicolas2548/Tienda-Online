#!/bin/bash

echo ""
echo " ================================================"
echo "  UpvShop - Iniciando proyecto..."
echo " ================================================"
echo ""

if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker no está corriendo."
    echo "Por favor inicia Docker Desktop y vuelve a ejecutar."
    exit 1
fi

echo "[1/4] Docker detectado correctamente."

echo "[2/4] Limpiando contenedores anteriores..."
docker-compose down -v > /dev/null 2>&1

echo "[3/4] Construyendo e iniciando contenedores (primera vez tarda ~5 min)..."
docker-compose up --build -d

if [ $? -ne 0 ]; then
    echo "[ERROR] Hubo un problema al iniciar."
    echo "Ejecuta: docker-compose logs"
    exit 1
fi

echo "[4/4] Esperando que los servicios estén listos..."
sleep 15

echo ""
echo " ================================================"
echo "  Proyecto iniciado exitosamente!"
echo " ================================================"
echo ""
echo "  Tienda:        http://localhost:3000"
echo "  API Usuarios:  http://localhost:8001/docs"
echo "  API Catalogo:  http://localhost:8002/docs"
echo "  API Carrito:   http://localhost:8003/docs"
echo "  API Ordenes:   http://localhost:8004/docs"
echo "  API Pagos:     http://localhost:8005/docs"
echo "  Base de datos: http://localhost:5050"
echo ""
echo "  Cuenta admin:"
echo "    Email:    admin@upvshop.com"
echo "    Password: Admin123!"
echo ""
echo "  Para detener: ./stop.sh"
echo " ================================================"
echo ""

if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
elif command -v open > /dev/null; then
    open http://localhost:3000
fi
