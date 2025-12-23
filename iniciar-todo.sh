#!/bin/bash
# ============================================
# PTAR Santa Priscila - INICIO COMPLETO
# Inicia: Backend + Frontend Web + PWA Móvil
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear
echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║          PTAR CHECKLIST - SANTA PRISCILA                 ║"
echo "║          Sistema Completo de Gestión                     ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Función para limpiar al salir
cleanup() {
    echo ""
    echo -e "${YELLOW}Deteniendo servicios...${NC}"
    pkill -f "pnpm.*dev" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    pkill -f "tsx.*server" 2>/dev/null
    pkill -f "serve.*3333" 2>/dev/null
    echo -e "${GREEN}Servicios detenidos${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Verificar requisitos
echo -e "${BLUE}[1/4]${NC} Verificando requisitos..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js no instalado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Instalando pnpm...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm disponible${NC}"

# Instalar dependencias
echo -e "${BLUE}[2/4]${NC} Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Instalando dependencias del proyecto principal...${NC}"
    pnpm install
fi
echo -e "${GREEN}✓ Dependencias principales listas${NC}"

# Preparar PWA
echo -e "${BLUE}[3/4]${NC} Preparando PWA móvil..."
if [ ! -d "mobile-app/dist" ]; then
    echo -e "${YELLOW}Generando build PWA...${NC}"
    cd mobile-app
    [ ! -d "node_modules" ] && npm install
    npx expo export --platform web
    cp public/icon-192.svg public/icon-512.svg public/manifest.json public/sw.js dist/ 2>/dev/null
    cd ..
fi
echo -e "${GREEN}✓ PWA lista${NC}"

# Liberar puertos
echo -e "${BLUE}[4/4]${NC} Preparando puertos..."
for port in 8080 5173 5174 3333; do
    pids=$(lsof -ti:$port 2>/dev/null)
    [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
done
sleep 1
echo -e "${GREEN}✓ Puertos disponibles${NC}"

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    INICIANDO SERVICIOS                    ${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""

# Iniciar servidor PWA en background
echo -e "${BLUE}Iniciando servidor PWA...${NC}"
cd mobile-app/dist
npx serve -l 3333 > /tmp/ptar-pwa.log 2>&1 &
PWA_PID=$!
cd "$SCRIPT_DIR"
sleep 2

if kill -0 $PWA_PID 2>/dev/null; then
    echo -e "${GREEN}✓ PWA corriendo en puerto 3333${NC}"
else
    echo -e "${YELLOW}⚠ PWA no pudo iniciar${NC}"
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}URLS DISPONIBLES:${NC}"
echo ""
echo -e "  ${BLUE}🌐 Web Principal:${NC}     http://localhost:5173"
echo -e "  ${BLUE}📱 App Móvil PWA:${NC}     http://localhost:3333"
echo -e "  ${BLUE}⚙️  API Backend:${NC}       http://localhost:8080"
echo ""
echo -e "${YELLOW}CREDENCIALES:${NC}"
echo -e "  Admin:    admin@santapriscila.com / admin123"
echo -e "  Operador: operador@santapriscila.com / operador123"
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${RED}Presiona Ctrl+C para detener todos los servicios${NC}"
echo ""

# Abrir navegador
(sleep 3 && xdg-open "http://localhost:5173" 2>/dev/null || open "http://localhost:5173" 2>/dev/null) &

# Iniciar app principal (esto bloquea)
pnpm run dev

# Si llega aquí, limpiar
cleanup
