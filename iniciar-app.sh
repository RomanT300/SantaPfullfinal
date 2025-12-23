#!/bin/bash
# ============================================
# PTAR Santa Priscila - Iniciar Aplicación
# Doble clic para ejecutar
# ============================================

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════╗"
echo "║     PTAR CHECKLIST - SANTA PRISCILA            ║"
echo "║     Sistema de Gestión de Plantas              ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

# Función para verificar si un puerto está en uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Puerto en uso
    else
        return 1  # Puerto libre
    fi
}

# Función para matar procesos en un puerto
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Liberando puerto $port...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# Verificar Node.js
echo -e "${BLUE}[1/5]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js no está instalado${NC}"
    echo "Instala Node.js desde: https://nodejs.org/"
    read -p "Presiona Enter para salir..."
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"

# Verificar pnpm
echo -e "${BLUE}[2/5]${NC} Verificando pnpm..."
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Instalando pnpm...${NC}"
    npm install -g pnpm
fi
echo -e "${GREEN}✓ pnpm disponible${NC}"

# Instalar dependencias si es necesario
echo -e "${BLUE}[3/5]${NC} Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Instalando dependencias (primera vez)...${NC}"
    pnpm install
fi
echo -e "${GREEN}✓ Dependencias listas${NC}"

# Verificar base de datos
echo -e "${BLUE}[4/5]${NC} Verificando base de datos..."
if [ ! -f "data/santa-priscila.db" ]; then
    echo -e "${YELLOW}La base de datos se creará al iniciar${NC}"
fi
echo -e "${GREEN}✓ Base de datos configurada${NC}"

# Liberar puertos si están ocupados
echo -e "${BLUE}[5/5]${NC} Preparando puertos..."
if check_port 8080; then
    kill_port 8080
fi
if check_port 5173; then
    kill_port 5173
fi
if check_port 5174; then
    kill_port 5174
fi
echo -e "${GREEN}✓ Puertos disponibles${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Iniciando aplicación...${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}La aplicación se abrirá en tu navegador automáticamente${NC}"
echo ""
echo -e "URLs disponibles:"
echo -e "  ${BLUE}• Web Principal:${NC}  http://localhost:5173"
echo -e "  ${BLUE}• API Backend:${NC}    http://localhost:8080"
echo ""
echo -e "${YELLOW}Usuarios de prueba:${NC}"
echo -e "  Admin:    admin@santapriscila.com / admin123"
echo -e "  Operador: operador@santapriscila.com / operador123"
echo ""
echo -e "${RED}Para detener: Cierra esta ventana o presiona Ctrl+C${NC}"
echo ""

# Esperar un momento antes de abrir el navegador
(sleep 5 && xdg-open "http://localhost:5173" 2>/dev/null || open "http://localhost:5173" 2>/dev/null || start "http://localhost:5173" 2>/dev/null) &

# Iniciar la aplicación
pnpm run dev

# Si llega aquí, la app se detuvo
echo ""
echo -e "${YELLOW}Aplicación detenida${NC}"
read -p "Presiona Enter para cerrar..."
