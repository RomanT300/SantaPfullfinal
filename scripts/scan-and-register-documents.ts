import { readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import Database from 'better-sqlite3'

const db = new Database('./data/ptar.db')

// Mapeo de nombres de carpetas a IDs de plantas
const plantNameToId: Record<string, string> = {}

// Cargar el mapeo desde la base de datos
const plants = db.prepare('SELECT id, name FROM plants').all() as Array<{ id: string; name: string }>
for (const plant of plants) {
  plantNameToId[plant.name] = plant.id
  // También mapear variaciones comunes
  plantNameToId[plant.name.toUpperCase()] = plant.id
  plantNameToId[plant.name.toLowerCase()] = plant.id
}

console.log('Mapeo de plantas cargado:', plantNameToId)

// Función recursiva para escanear directorios
function scanDirectory(dir: string, baseDir: string): Array<{ path: string; name: string; plant: string; category: string }> {
  const files: Array<{ path: string; name: string; plant: string; category: string }> = []

  const items = readdirSync(dir)

  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      // Recursivamente escanear subdirectorios
      files.push(...scanDirectory(fullPath, baseDir))
    } else if (stat.isFile()) {
      // Obtener ruta relativa desde uploads/
      const relativePath = relative(baseDir, fullPath)
      const parts = relativePath.split(/[/\\]/)

      // parts[0] es el nombre de la planta
      // parts[1...n-1] son categorías/subcarpetas
      // parts[n] es el nombre del archivo

      const plant = parts[0]
      const category = parts.length > 2 ? parts.slice(1, -1).join(' / ') : parts[1] || 'General'
      const filename = parts[parts.length - 1]

      files.push({
        path: `/uploads/${relativePath.replace(/\\/g, '/')}`,
        name: filename,
        plant,
        category
      })
    }
  }

  return files
}

// Verificar que existan las plantas en la base de datos
function ensurePlantsExist() {
  const plants = ['LA LUZ', 'TAURA', 'SANTA MONICA', 'SAN DIEGO', 'CHANDUY']

  for (const plant of plants) {
    try {
      db.prepare('INSERT OR IGNORE INTO plants (id, name, location) VALUES (?, ?, ?)').run(plant, plant, 'Ecuador')
      const existing = db.prepare('SELECT id FROM plants WHERE id = ?').get(plant)
      if (existing) {
        console.log(`✓ Planta verificada: ${plant}`)
      }
    } catch (error: any) {
      console.log(`⚠ Planta ${plant}: ${error.message}`)
    }
  }
}

// Limpiar documentos existentes (opcional)
function clearExistingDocuments() {
  const count = db.prepare('DELETE FROM documents').run()
  console.log(`✓ Eliminados ${count.changes} documentos existentes`)
}

// Registrar documentos en la base de datos
function registerDocuments() {
  const uploadsDir = join(process.cwd(), 'uploads')
  console.log(`Escaneando directorio: ${uploadsDir}`)

  const files = scanDirectory(uploadsDir, uploadsDir)
  console.log(`\nEncontrados ${files.length} archivos`)

  // Preparar statement para inserción
  const stmt = db.prepare(`
    INSERT INTO documents (plant_id, file_name, file_path, category, uploaded_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)

  let inserted = 0
  let errors = 0

  for (const file of files) {
    try {
      // Convertir nombre de carpeta a ID de planta
      const plantId = plantNameToId[file.plant]
      if (!plantId) {
        console.warn(`  ⚠ Planta no encontrada: ${file.plant}`)
        errors++
        continue
      }

      stmt.run(plantId, file.name, file.path, file.category)
      inserted++

      if (inserted % 50 === 0) {
        console.log(`  Procesados: ${inserted}/${files.length}`)
      }
    } catch (error: any) {
      errors++
      console.error(`  Error con ${file.name}: ${error.message}`)
    }
  }

  console.log(`\n✓ Documentos registrados: ${inserted}`)
  if (errors > 0) {
    console.log(`⚠ Errores: ${errors}`)
  }

  // Mostrar resumen por planta
  const summary = db.prepare(`
    SELECT plant_id, COUNT(*) as count
    FROM documents
    GROUP BY plant_id
    ORDER BY count DESC
  `).all()

  console.log(`\nResumen por planta:`)
  for (const row of summary as any[]) {
    console.log(`  ${row.plant_id}: ${row.count} documentos`)
  }
}

// Ejecución principal
console.log('='.repeat(60))
console.log('REGISTRO DE DOCUMENTOS EN BASE DE DATOS')
console.log('='.repeat(60))
console.log()

try {
  ensurePlantsExist()
  console.log()
  clearExistingDocuments()
  console.log()
  registerDocuments()

  console.log()
  console.log('='.repeat(60))
  console.log('✓ PROCESO COMPLETADO EXITOSAMENTE')
  console.log('='.repeat(60))
} catch (error: any) {
  console.error(`\n❌ ERROR: ${error.message}`)
  process.exit(1)
} finally {
  db.close()
}
