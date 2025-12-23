#!/bin/bash

# Script para subir documentos de Camaroneras a la aplicación
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi0wMDEiLCJlbWFpbCI6ImFkbWluQHNhbnRhcHJpc2NpbGEuY29tIiwicm9sZSI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmFkb3IiLCJpYXQiOjE3NjU5OTg1MTYsImV4cCI6MTc2NjA0MTcxNn0.CKb3sAk5iQOAT7-67iI0B-AIbOlimclNtjwuiqUYA3k"
API_URL="http://localhost:8080/api/documents/upload"
CAMARONERAS_DIR="/home/roman/Santa Priscila/Camaroneras"

# Mapeo de plantas a IDs
declare -A PLANT_IDS
PLANT_IDS["Chanduy"]="77777777-7777-7777-7777-777777777777"
PLANT_IDS["La Luz"]="33333333-3333-3333-3333-333333333333"
PLANT_IDS["San Diego"]="66666666-6666-6666-6666-666666666666"
PLANT_IDS["Santa Monica"]="55555555-5555-5555-5555-555555555555"
PLANT_IDS["Taura 7"]="44444444-4444-4444-4444-444444444444"
PLANT_IDS["Textiles"]="88888888-8888-8888-8888-888888888881"
PLANT_IDS["Tropack Biosem 1"]="88888888-8888-8888-8888-888888888883"
PLANT_IDS["Tropack Biosem 2"]="88888888-8888-8888-8888-888888888884"
PLANT_IDS["Tropack Insustrial"]="88888888-8888-8888-8888-888888888885"

# Mapeo de carpetas a categorías
declare -A CATEGORY_MAP
CATEGORY_MAP["PLANOS"]="planos"
CATEGORY_MAP["Planos"]="planos"
CATEGORY_MAP["Manuales"]="manuales"
CATEGORY_MAP["Mantenimiento"]="informes_mantenimiento"
CATEGORY_MAP["Mantenimientos"]="informes_mantenimiento"
CATEGORY_MAP["Analíticas"]="analiticas"

upload_file() {
    local file="$1"
    local plant_id="$2"
    local category="$3"
    local filename=$(basename "$file")

    echo "Subiendo: $filename -> Planta: $plant_id, Categoría: $category"

    # IMPORTANTE: plantId debe ir ANTES de file para que multer lo procese correctamente
    response=$(curl -s -X POST "$API_URL" \
        -H "Authorization: Bearer $TOKEN" \
        -F "plantId=$plant_id" \
        -F "category=$category" \
        -F "description=Importado desde Camaroneras" \
        -F "file=@$file")

    if echo "$response" | grep -q '"success":true'; then
        echo "  ✓ OK"
    else
        echo "  ✗ Error: $response"
    fi
}

# Procesar cada planta
for plant_dir in "$CAMARONERAS_DIR"/*/; do
    plant_name=$(basename "$plant_dir")
    plant_id=${PLANT_IDS["$plant_name"]}

    if [ -z "$plant_id" ]; then
        echo "⚠ Planta no encontrada: $plant_name"
        continue
    fi

    echo ""
    echo "=== Procesando: $plant_name (ID: $plant_id) ==="

    # Procesar cada subcarpeta
    for category_dir in "$plant_dir"*/; do
        category_name=$(basename "$category_dir")
        category=${CATEGORY_MAP["$category_name"]}

        if [ -z "$category" ]; then
            echo "  ⚠ Categoría no mapeada: $category_name"
            continue
        fi

        echo "  Categoría: $category_name -> $category"

        # Subir cada archivo
        find "$category_dir" -maxdepth 1 -type f \( -name "*.pdf" -o -name "*.docx" -o -name "*.xlsx" -o -name "*.xlsb" -o -name "*.dwg" -o -name "*.zip" -o -name "*.doc" -o -name "*.xls" \) | while read file; do
            upload_file "$file" "$plant_id" "$category"
        done
    done
done

echo ""
echo "=== Subida completada ==="
