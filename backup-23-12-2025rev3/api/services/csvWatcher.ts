/**
 * CSV File Watcher Service
 * Monitors plantilla_analiticas.csv for changes and auto-imports data
 */
import fs from 'fs'
import path from 'path'
import { environmentalDAL, plantsDAL } from '../lib/dal.js'

// Track last processed state
let lastModified: number = 0
let isProcessing = false
let lastResult: {
  timestamp: string
  inserted: number
  updated: number
  errors: string[]
  skipped: number
} | null = null

const CSV_PATH = path.join(process.cwd(), 'plantilla_analiticas.csv')

/**
 * Process CSV file and import data
 */
export function processCSV(): { success: boolean; message: string; inserted: number; updated: number; errors: string[]; skipped: number } {
  if (isProcessing) {
    return { success: false, message: 'Ya hay un procesamiento en curso', inserted: 0, updated: 0, errors: [], skipped: 0 }
  }

  if (!fs.existsSync(CSV_PATH)) {
    return { success: false, message: 'Archivo CSV no encontrado', inserted: 0, updated: 0, errors: [], skipped: 0 }
  }

  isProcessing = true

  try {
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
    const lines = csvContent.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      isProcessing = false
      return { success: false, message: 'El archivo CSV está vacío', inserted: 0, updated: 0, errors: [], skipped: 0 }
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const requiredHeaders = ['planta', 'fecha', 'parametro', 'valor', 'tipo']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

    if (missingHeaders.length > 0) {
      isProcessing = false
      return { success: false, message: `Faltan columnas: ${missingHeaders.join(', ')}`, inserted: 0, updated: 0, errors: [], skipped: 0 }
    }

    // Get column indices
    const plantaIdx = headers.indexOf('planta')
    const fechaIdx = headers.indexOf('fecha')
    const parametroIdx = headers.indexOf('parametro')
    const valorIdx = headers.indexOf('valor')
    const tipoIdx = headers.indexOf('tipo')

    // Get plants map
    const plants = plantsDAL.getAll() as { id: string; name: string }[]
    const plantMap = new Map(plants.map(p => [p.name.toLowerCase(), p.id]))

    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(',').map(v => v.trim())

      const plantaName = values[plantaIdx]
      const fecha = values[fechaIdx]
      const parametro = values[parametroIdx]?.toUpperCase()
      const valorStr = values[valorIdx]
      let tipo = values[tipoIdx]?.toLowerCase()

      // Skip rows without value
      if (!valorStr || valorStr === '') {
        skipped++
        continue
      }

      const valor = parseFloat(valorStr)

      // Map tipo
      if (tipo === 'entrada') tipo = 'influent'
      if (tipo === 'salida') tipo = 'effluent'

      // Validations
      if (!plantaName) {
        errors.push(`Línea ${i + 1}: Falta nombre de planta`)
        continue
      }

      const plantId = plantMap.get(plantaName.toLowerCase())
      if (!plantId) {
        errors.push(`Línea ${i + 1}: Planta "${plantaName}" no encontrada`)
        continue
      }

      if (!['DQO', 'PH', 'SS'].includes(parametro)) {
        errors.push(`Línea ${i + 1}: Parámetro "${parametro}" no válido`)
        continue
      }

      if (isNaN(valor)) {
        errors.push(`Línea ${i + 1}: Valor "${valorStr}" no es válido`)
        continue
      }

      if (!['influent', 'effluent'].includes(tipo)) {
        errors.push(`Línea ${i + 1}: Tipo "${values[tipoIdx]}" no válido`)
        continue
      }

      // Format date to ISO
      let measurementDate: string
      if (fecha.includes('/')) {
        const [day, month, year] = fecha.split('/')
        measurementDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`
      } else {
        measurementDate = fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`
      }

      try {
        const existing = environmentalDAL.findByKeys(
          plantId,
          parametro === 'PH' ? 'pH' : parametro,
          measurementDate,
          tipo
        )

        if (existing) {
          environmentalDAL.update((existing as any).id, { value: valor })
          updated++
        } else {
          environmentalDAL.create({
            plantId,
            parameter: parametro === 'PH' ? 'pH' : parametro,
            measurementDate,
            value: valor,
            unit: parametro === 'pH' || parametro === 'PH' ? '' : 'mg/L',
            stream: tipo
          })
          inserted++
        }
      } catch (err: any) {
        errors.push(`Línea ${i + 1}: Error - ${err.message}`)
      }
    }

    lastResult = {
      timestamp: new Date().toISOString(),
      inserted,
      updated,
      errors,
      skipped
    }

    isProcessing = false
    return { success: true, message: `Procesado: ${inserted} insertados, ${updated} actualizados, ${skipped} omitidos`, inserted, updated, errors, skipped }

  } catch (error: any) {
    isProcessing = false
    return { success: false, message: error.message, inserted: 0, updated: 0, errors: [error.message], skipped: 0 }
  }
}

/**
 * Start watching the CSV file
 */
export function startWatcher(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.log('[CSV Watcher] Archivo no existe, creando plantilla vacía...')
    // El archivo debería existir, si no, se crea al iniciar
  }

  console.log(`[CSV Watcher] Monitoreando: ${CSV_PATH}`)

  // Get initial modification time
  try {
    const stats = fs.statSync(CSV_PATH)
    lastModified = stats.mtimeMs
  } catch {
    lastModified = 0
  }

  // Watch for changes
  fs.watch(CSV_PATH, { persistent: true }, (eventType, filename) => {
    if (eventType === 'change') {
      try {
        const stats = fs.statSync(CSV_PATH)
        // Debounce: only process if modified time changed significantly (> 500ms)
        if (stats.mtimeMs - lastModified > 500) {
          lastModified = stats.mtimeMs
          console.log(`[CSV Watcher] Cambio detectado en ${filename}, procesando...`)

          // Small delay to ensure file is fully written
          setTimeout(() => {
            const result = processCSV()
            console.log(`[CSV Watcher] ${result.message}`)
            if (result.errors.length > 0) {
              console.log(`[CSV Watcher] Errores: ${result.errors.slice(0, 5).join(', ')}${result.errors.length > 5 ? '...' : ''}`)
            }
          }, 300)
        }
      } catch (err) {
        console.error('[CSV Watcher] Error al verificar archivo:', err)
      }
    }
  })
}

/**
 * Get watcher status
 */
export function getWatcherStatus(): {
  active: boolean
  csvPath: string
  lastResult: typeof lastResult
  isProcessing: boolean
} {
  return {
    active: true,
    csvPath: CSV_PATH,
    lastResult,
    isProcessing
  }
}

/**
 * Get CSV path
 */
export function getCSVPath(): string {
  return CSV_PATH
}
