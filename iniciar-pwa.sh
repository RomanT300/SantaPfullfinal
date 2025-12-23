#!/bin/bash
# ============================================
# PTAR Checklist PWA - Servidor Local
# Para probar la app móvil como PWA
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║     PTAR CHECKLIST - APP MÓVIL PWA             ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar que existe el build
if [ ! -d "mobile-app/dist" ]; then
    echo -e "${YELLOW}Generando build de la PWA...${NC}"
    cd mobile-app

    # Instalar dependencias si es necesario
    if [ ! -d "node_modules" ]; then
        npm install
    fi

    # Generar build
    npx expo export --platform web

    # Copiar assets PWA
    cp public/icon-192.svg public/icon-512.svg public/manifest.json public/sw.js dist/ 2>/dev/null

    cd ..
fi

echo -e "${GREEN}✓ Build PWA listo${NC}"
echo ""

# Matar proceso anterior si existe
pkill -f "serve.*3333" 2>/dev/null
sleep 1

echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Iniciando servidor PWA...${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}IMPORTANTE: El backend principal debe estar corriendo${NC}"
echo -e "${YELLOW}Ejecuta primero: ./iniciar-app.sh${NC}"
echo ""
echo -e "URL de la PWA: ${BLUE}http://localhost:3333${NC}"
echo ""
echo -e "${YELLOW}Para instalar en tu celular:${NC}"
echo -e "  1. Abre http://localhost:3333 en Chrome"
echo -e "  2. Menú → 'Instalar aplicación' o 'Añadir a pantalla'"
echo ""
echo -e "${RED}Para detener: Cierra esta ventana o presiona Ctrl+C${NC}"
echo ""

# Abrir navegador
(sleep 2 && xdg-open "http://localhost:3333" 2>/dev/null || open "http://localhost:3333" 2>/dev/null) &

# Iniciar servidor
cd mobile-app/dist
npx serve -l 3333

echo ""
echo -e "${YELLOW}Servidor PWA detenido${NC}"
read -p "Presiona Enter para cerrar..."
