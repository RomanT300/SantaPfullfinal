/**
 * Script to import documents from Carpetas camaroneras to SQLite database
 */
import { db } from '../api/lib/database.js'
import { documentsDAL } from '../api/lib/dal.js'
import { plantsDAL } from '../api/lib/dal.js'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

const SOURCE_DIR = 'D:\\Carpetas camaroneras\\Camaroneras'
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Map folder names to plant IDs
const PLANT_MAPPING: Record<string, string> = {
  'La Luz': 'LA LUZ',
  'San Diego': 'SAN DIEGO',
  'Santa Monica': 'SANTA MONICA',
  'Taura 7': 'TAURA'
}

// Category mapping based on folder structure
const CATEGORY_MAPPING: Record<string, string> = {
  'MANUAL': 'manual',
  'MEMORIAS': 'technical_report',
  'MEMORIA': 'technical_report',
  'EQUIPOS': 'equipment',
  'PLANOS': 'blueprint',
  'PID': 'blueprint',
  'PLAN': 'maintenance',
  'ENTREGABLES': 'technical_report',
  'DIAGRAMA': 'blueprint'
}

function getCategoryFromPath(filePath: string): string {
  const upperPath = filePath.toUpperCase()
  for (const [key, category] of Object.entries(CATEGORY_MAPPING)) {
    if (upperPath.includes(key)) {
      return category
    }
  }
  return 'other'
}

function getPlantFromPath(filePath: string): string | null {
  for (const [folderName, plantName] of Object.entries(PLANT_MAPPING)) {
    if (filePath.includes(folderName)) {
      return plantName
    }
  }
  return null
}

function copyFileToUploads(sourcePath: string, plantId: string, plantName: string): string {
  const fileName = path.basename(sourcePath)
  const plantDir = path.join(UPLOAD_DIR, plantName)

  // Create plant directory if it doesn't exist
  if (!fs.existsSync(plantDir)) {
    fs.mkdirSync(plantDir, { recursive: true })
  }

  const destPath = path.join(plantDir, fileName)

  // Copy file
  fs.copyFileSync(sourcePath, destPath)

  // Return relative path for database
  return `/uploads/${plantName}/${fileName}`
}

async function importDocuments() {
  console.log('Starting document import...')

  // Get all plants from database
  const plants = plantsDAL.getAll()
  const plantMap: Record<string, any> = {}
  plants.forEach((plant: any) => {
    plantMap[plant.name] = plant
  })

  // Get all existing documents to avoid duplicates
  const existingDocs = documentsDAL.getAll({})
  const existingPaths = new Set(existingDocs.map((doc: any) => doc.file_path))

  let imported = 0
  let skipped = 0
  let errors = 0

  // Recursively find all files
  function processDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        processDirectory(fullPath)
      } else if (entry.isFile()) {
        try {
          // Determine plant
          const plantName = getPlantFromPath(fullPath)
          if (!plantName) {
            console.log(`Skipping file (no plant match): ${fullPath}`)
            skipped++
            continue
          }

          const plant = plantMap[plantName]
          if (!plant) {
            console.log(`Skipping file (plant not in database): ${fullPath}`)
            skipped++
            continue
          }

          // Copy file to uploads directory
          const uploadPath = copyFileToUploads(fullPath, plant.id, plant.name)

          // Check if already imported
          if (existingPaths.has(uploadPath)) {
            console.log(`Skipping (already exists): ${entry.name}`)
            skipped++
            continue
          }

          // Determine category
          const category = getCategoryFromPath(fullPath)

          // Extract description from path
          const pathParts = fullPath.split(path.sep)
          const relevantParts = pathParts.slice(-3, -1) // Get 2 parent folders
          const description = relevantParts.join(' / ')

          // Insert into database
          documentsDAL.create({
            plantId: plant.id,
            fileName: entry.name,
            filePath: uploadPath,
            category,
            description,
            uploadedBy: 'import-script'
          })

          console.log(`✓ Imported: ${plantName} - ${entry.name}`)
          imported++

        } catch (error: any) {
          console.error(`✗ Error importing ${entry.name}:`, error.message)
          errors++
        }
      }
    }
  }

  // Start processing from source directory
  if (fs.existsSync(SOURCE_DIR)) {
    processDirectory(SOURCE_DIR)
  } else {
    console.error(`Source directory not found: ${SOURCE_DIR}`)
    process.exit(1)
  }

  console.log('\n=== Import Summary ===')
  console.log(`✓ Imported: ${imported}`)
  console.log(`- Skipped:  ${skipped}`)
  console.log(`✗ Errors:   ${errors}`)
  console.log(`Total:      ${imported + skipped + errors}`)
}

// Run import
importDocuments()
  .then(() => {
    console.log('\nImport complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Import failed:', error)
    process.exit(1)
  })
