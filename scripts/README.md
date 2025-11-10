# Scripts de Utilidad

## import-documents.ts

Script para importar documentos desde una carpeta externa a la base de datos SQLite.

### Uso

```bash
npx tsx scripts/import-documents.ts
```

### Funcionalidad

- Escanea recursivamente la carpeta `D:\Carpetas camaroneras\Camaroneras`
- Copia los archivos al directorio `uploads/` organizados por planta
- Registra cada archivo en la tabla `documents` de SQLite
- Asigna automáticamente:
  - **Planta**: Basado en la estructura de carpetas (La Luz, Taura 7, San Diego, Santa Monica)
  - **Categoría**: Basado en el tipo de carpeta (MANUAL, EQUIPOS, PLANOS, etc.)
  - **Descripción**: Basado en la ruta del archivo

### Categorías Soportadas

- `manual`: Manuales de operación y mantenimiento
- `technical_report`: Memorias técnicas y reportes
- `equipment`: Información de equipos
- `blueprint`: Planos y diagramas (PID, arquitectónicos, etc.)
- `maintenance`: Planes de mantenimiento
- `other`: Otros documentos

### Mapeo de Plantas

| Carpeta       | Planta       | ID en DB |
|---------------|--------------|----------|
| La Luz        | LA LUZ       | 33333... |
| Taura 7       | TAURA        | 44444... |
| San Diego     | SAN DIEGO    | 66666... |
| Santa Monica  | SANTA MONICA | 55555... |

### Notas

- El script evita duplicados verificando rutas existentes
- Los archivos se copian físicamente a `uploads/[plant_id]/[filename]`
- Solo se importan archivos de plantas que existen en la base de datos

## check-documents.js

Script para verificar el estado de los documentos importados.

### Uso

```bash
node scripts/check-documents.js
```

### Salida

```
Total documentos: 164

Documentos por planta:
  CHANDUY: 0
  LA LUZ: 47
  SAN DIEGO: 38
  SANTA MONICA: 37
  TAURA: 42

Documentos por categoría:
  equipment: 87
  blueprint: 47
  technical_report: 19
  manual: 5
  maintenance: 4
  other: 2
```
