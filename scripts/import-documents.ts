/**
 * Script para importar documentos desde la carpeta Camaroneras a la base de datos
 */
import { db } from '../api/lib/database.js'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

// Mapeo de nombres de carpetas de plantas a IDs en la base de datos
const plantMapping: Record<string, string> = {}

// Obtener todas las plantas de la base de datos
const plants = db.prepare('SELECT id, name FROM plants').all() as { id: string; name: string }[]

// Crear mapeo flexible de nombres
plants.forEach(plant => {
  const nameLower = plant.name.toLowerCase()
  plantMapping[nameLower] = plant.id

  // Agregar aliases comunes
  if (nameLower.includes('luz')) plantMapping['la luz'] = plant.id
  if (nameLower.includes('taura')) plantMapping['taura 7'] = plant.id
  if (nameLower.includes('monica')) plantMapping['santa monica'] = plant.id
  if (nameLower.includes('diego')) plantMapping['san diego'] = plant.id
  if (nameLower.includes('chanduy')) plantMapping['chanduy'] = plant.id
  if (nameLower.includes('textil')) plantMapping['textiles'] = plant.id
  if (nameLower.includes('biosem 1') || nameLower.includes('biosem-1')) plantMapping['tropack biosem 1'] = plant.id
  if (nameLower.includes('biosem 2') || nameLower.includes('biosem-2')) plantMapping['tropack biosem 2'] = plant.id
  if (nameLower.includes('industrial') || nameLower.includes('insustrial')) plantMapping['tropack insustrial'] = plant.id
  if (nameLower.includes('industrial') || nameLower.includes('insustrial')) plantMapping['tropack industrial'] = plant.id
})

console.log('Plantas encontradas:', plants.map(p => p.name).join(', '))
console.log('Mapeo de plantas:', plantMapping)

// Mapeo de subcarpetas a categorías
const categoryMapping: Record<string, string> = {
  'planos': 'planos',
  'manuales': 'manuales',
  'analiticas': 'analiticas',
  'analíticas': 'analiticas',
  'mantenimiento': 'informes_mantenimiento',
  'mantenimientos': 'informes_mantenimiento',
}

const camaronerasPath = path.join(process.cwd(), 'Camaroneras')
const uploadsPath = path.join(process.cwd(), 'uploads', 'documents')

// Crear carpeta de uploads si no existe
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

// Función para obtener categoría desde el nombre de carpeta
function getCategory(folderName: string): string | null {
  const normalized = folderName.toLowerCase().trim()
  return categoryMapping[normalized] || null
}

// Función para obtener plant ID desde el nombre de carpeta
function getPlantId(folderName: string): string | null {
  const normalized = folderName.toLowerCase().trim()
  return plantMapping[normalized] || null
}

// Extensiones permitidas
const allowedExtensions = ['.pdf', '.xlsx', '.docx', '.dwg', '.xls', '.doc']

// Importar documentos
let imported = 0
let skipped = 0
let errors: string[] = []

// Preparar statement para insertar
const insertStmt = db.prepare(`
  INSERT INTO documents (id, plant_id, file_name, file_path, category, description, uploaded_by, uploaded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
`)

// Verificar si documento ya existe
const checkExistsStmt = db.prepare('SELECT id FROM documents WHERE plant_id = ? AND file_name = ?')

// Recorrer carpetas de plantas
const plantFolders = fs.readdirSync(camaronerasPath)

for (const plantFolder of plantFolders) {
  const plantPath = path.join(camaronerasPath, plantFolder)

  if (!fs.statSync(plantPath).isDirectory()) continue

  const plantId = getPlantId(plantFolder)
  if (!plantId) {
    errors.push(`Planta no encontrada en BD: ${plantFolder}`)
    continue
  }

  console.log(`\nProcesando planta: ${plantFolder} (ID: ${plantId})`)

  // Recorrer subcarpetas de categorías
  const categoryFolders = fs.readdirSync(plantPath)

  for (const categoryFolder of categoryFolders) {
    const categoryPath = path.join(plantPath, categoryFolder)

    if (!fs.statSync(categoryPath).isDirectory()) continue

    const category = getCategory(categoryFolder)
    if (!category) {
      errors.push(`Categoría no reconocida: ${categoryFolder} en ${plantFolder}`)
      continue
    }

    console.log(`  Categoría: ${categoryFolder} -> ${category}`)

    // Obtener archivos
    const files = fs.readdirSync(categoryPath)

    for (const file of files) {
      const filePath = path.join(categoryPath, file)

      if (!fs.statSync(filePath).isFile()) continue

      const ext = path.extname(file).toLowerCase()
      if (!allowedExtensions.includes(ext)) {
        console.log(`    Saltando (extensión no permitida): ${file}`)
        skipped++
        continue
      }

      // Verificar si ya existe
      const existing = checkExistsStmt.get(plantId, file)
      if (existing) {
        console.log(`    Ya existe: ${file}`)
        skipped++
        continue
      }

      try {
        // Copiar archivo a uploads
        const destFileName = `${Date.now()}-${file.replace(/\s+/g, '_')}`
        const destPath = path.join(uploadsPath, destFileName)

        fs.copyFileSync(filePath, destPath)

        // Crear descripción desde nombre de archivo
        const description = file.replace(/\.[^.]+$/, '').replace(/_/g, ' ')

        // Insertar en base de datos
        const id = randomUUID()
        insertStmt.run(id, plantId, file, `/uploads/documents/${destFileName}`, category, description, 'system-import')

        console.log(`    Importado: ${file}`)
        imported++
      } catch (err: any) {
        errors.push(`Error importando ${file}: ${err.message}`)
      }
    }
  }
}

console.log('\n========================================')
console.log('Resumen de importación:')
console.log(`  Importados: ${imported}`)
console.log(`  Saltados: ${skipped}`)
console.log(`  Errores: ${errors.length}`)

if (errors.length > 0) {
  console.log('\nErrores:')
  errors.forEach(e => console.log(`  - ${e}`))
}

console.log('\nImportación completada.')
