#!/bin/bash

# Script de arranque para Santa Priscila PTAR
# Doble clic para iniciar la aplicación y abrir el navegador

PROJECT_DIR="/home/roman/Santa Priscila"

# Liberar puerto 8080 si está ocupado
echo "🔧 Verificando puerto 8080..."
fuser -k 8080/tcp 2>/dev/null
sleep 1

# Navegar al directorio del proyecto
cd "$PROJECT_DIR" || {
    echo "❌ Error: No se pudo acceder al directorio del proyecto"
    read -p "Presiona Enter para cerrar..."
    exit 1
}

# Iniciar la aplicación
echo "🚀 Iniciando Santa Priscila PTAR..."
echo "📍 Frontend: http://localhost:5173"
echo "📍 Backend: http://localhost:8080"
echo ""
echo "⏳ Esperando que el servidor esté listo..."

# Iniciar la app en segundo plano
pnpm run dev &
APP_PID=$!

# Esperar a que AMBOS servidores estén listos (máximo 60 segundos)
echo "Esperando frontend y backend..."
for i in {1..60}; do
    FRONTEND=$(curl -s http://localhost:5173 > /dev/null 2>&1 && echo "1" || echo "0")
    BACKEND=$(curl -s http://localhost:8080/api/health > /dev/null 2>&1 && echo "1" || echo "0")

    if [ "$FRONTEND" = "1" ] && [ "$BACKEND" = "1" ]; then
        echo ""
        echo "✅ Servidor listo!"
        break
    fi
    sleep 1
    echo -n "."
done

# Esperar 2 segundos adicionales para asegurar estabilidad
sleep 2

# Abrir el navegador automáticamente
echo ""
echo "🌐 Abriendo navegador..."
xdg-open http://localhost:5173 || firefox http://localhost:5173 || google-chrome http://localhost:5173

echo ""
echo "✅ Aplicación iniciada correctamente"
echo "⚠️  NO CIERRES ESTA VENTANA - La aplicación está corriendo"
echo "⚠️  Para detener la app, presiona Ctrl+C o cierra esta ventana"
echo ""

# Esperar a que el proceso termine
wait $APP_PID

# Si el usuario cierra con Ctrl+C
echo ""
echo "✅ Aplicación detenida"
