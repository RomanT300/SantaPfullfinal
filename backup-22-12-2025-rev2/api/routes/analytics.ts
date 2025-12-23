import { Router, type Request, type Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { writeLimiter } from '../middleware/rateLimit.js'
import { body, validationResult } from 'express-validator'
import { environmentalDAL, plantsDAL } from '../lib/dal.js'
import { getWatcherStatus, processCSV, getCSVPath } from '../services/csvWatcher.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = Router()

// Configurar multer para subida de archivos CSV
const uploadsDir = path.join(process.cwd(), 'uploads', 'csv')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now()
    cb(null, `analiticas_${timestamp}.csv`)
  }
})

const csvUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos CSV'))
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB máximo
})

// GET /api/analytics/environmental (authenticated users)
router.get('/environmental', requireAuth, async (req: Request, res: Response) => {
  const { plantId, startDate, endDate, parameter, stream, page, limit } = req.query as Record<string, string>

  try {
    const pageNum = parseInt(page) || undefined
    const limitNum = parseInt(limit) || undefined
    const offset = pageNum && limitNum ? (pageNum - 1) * limitNum : undefined

    const data = environmentalDAL.getAll({
      plantId,
      parameter,
      stream,
      startDate,
      endDate,
      limit: limitNum,
      offset
    })

    const summary = Array.isArray(data)
      ? data.reduce<Record<string, any>>((acc, row: any) => {
          const key = row.parameter_type
          acc[key] = acc[key] || { count: 0, sum: 0, min: row.value, max: row.value }
          acc[key].count++
          acc[key].sum += Number(row.value)
          acc[key].min = Math.min(acc[key].min, Number(row.value))
          acc[key].max = Math.max(acc[key].max, Number(row.value))
          return acc
        }, {})
      : {}

    Object.keys(summary).forEach(k => {
      const s = summary[k]
      s.avg = s.count ? s.sum / s.count : 0
    })

    res.json({ success: true, data, summary })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/environmental (admin only) - insert or update a measurement
router.post(
  '/environmental',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('parameter').isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').isISO8601(),
    body('value').isFloat({ min: 0 }),
    body('stream').optional().isIn(['influent', 'effluent']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, parameter, measurementDate, value, stream } = req.body

    try {
      // Try to find existing row with exact keys
      const existing = environmentalDAL.findByKeys(plantId, parameter, measurementDate, stream)

      if (existing) {
        // Update
        const data = environmentalDAL.update((existing as any).id, { value, stream })
        return res.json({ success: true, data, updated: 1 })
      } else {
        // Insert
        const data = environmentalDAL.create({
          plantId,
          parameter,
          measurementDate,
          value,
          stream
        })
        return res.status(201).json({ success: true, data, inserted: 1 })
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// PUT /api/analytics/environmental/:id (admin only) - update by ID
router.put(
  '/environmental/:id',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').optional().isString(),
    body('parameter').optional().isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').optional().isISO8601(),
    body('value').optional().isFloat({ min: 0 }),
    body('stream').optional().isIn(['influent', 'effluent']),
    body('unit').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const id = req.params.id
    const { plantId, parameter, measurementDate, value, stream, unit } = req.body

    try {
      const data = environmentalDAL.update(id, {
        plantId,
        parameter,
        measurementDate,
        value,
        stream,
        unit
      })
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// DELETE /api/analytics/environmental/:id (admin only)
router.delete('/environmental/:id', requireAuth, requireAdmin, writeLimiter, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    environmentalDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// DELETE /api/analytics/environmental (admin only) by keys
router.delete(
  '/environmental',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('parameter').isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').isISO8601(),
    body('stream').optional().isIn(['influent', 'effluent']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, parameter, measurementDate, stream } = req.body

    try {
      const existing = environmentalDAL.findByKeys(plantId, parameter, measurementDate, stream)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Measurement not found' })
      }
      environmentalDAL.delete((existing as any).id)
      res.json({ success: true, deleted: 1 })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// POST /api/analytics/upload-csv - Subir archivo CSV con datos de analíticas
router.post(
  '/upload-csv',
  requireAuth,
  requireAdmin,
  csvUpload.single('file'),
  async (req: Request, res: Response) => {
    const file = (req as any).file
    if (!file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó archivo CSV' })
    }

    try {
      // Leer el archivo CSV
      const csvContent = fs.readFileSync(file.path, 'utf-8')
      const lines = csvContent.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        return res.status(400).json({ success: false, error: 'El archivo CSV está vacío o no tiene datos' })
      }

      // Parsear encabezados (primera línea)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      // Validar encabezados requeridos
      const requiredHeaders = ['planta', 'fecha', 'parametro', 'valor', 'tipo']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      if (missingHeaders.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Faltan columnas requeridas: ${missingHeaders.join(', ')}`,
          expectedHeaders: requiredHeaders
        })
      }

      // Obtener índices de columnas
      const plantaIdx = headers.indexOf('planta')
      const fechaIdx = headers.indexOf('fecha')
      const parametroIdx = headers.indexOf('parametro')
      const valorIdx = headers.indexOf('valor')
      const tipoIdx = headers.indexOf('tipo') // influent/effluent (entrada/salida)

      // Obtener lista de plantas para mapear nombres a IDs
      const plants = plantsDAL.getAll() as { id: string; name: string }[]
      const plantMap = new Map(plants.map(p => [p.name.toLowerCase(), p.id]))

      let inserted = 0
      let updated = 0
      let errors: string[] = []

      // Procesar cada línea de datos
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim())

        const plantaName = values[plantaIdx]
        const fecha = values[fechaIdx]
        const parametro = values[parametroIdx]?.toUpperCase()
        const valor = parseFloat(values[valorIdx])
        let tipo = values[tipoIdx]?.toLowerCase()

        // Mapear tipo entrada/salida a influent/effluent
        if (tipo === 'entrada') tipo = 'influent'
        if (tipo === 'salida') tipo = 'effluent'

        // Validaciones
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
          errors.push(`Línea ${i + 1}: Parámetro "${parametro}" no válido (usar DQO, pH o SS)`)
          continue
        }

        if (isNaN(valor)) {
          errors.push(`Línea ${i + 1}: Valor "${values[valorIdx]}" no es un número válido`)
          continue
        }

        if (!['influent', 'effluent'].includes(tipo)) {
          errors.push(`Línea ${i + 1}: Tipo "${values[tipoIdx]}" no válido (usar entrada/salida o influent/effluent)`)
          continue
        }

        // Formatear fecha a ISO si es necesario (soporta DD/MM/YYYY o YYYY-MM-DD)
        let measurementDate: string
        if (fecha.includes('/')) {
          const [day, month, year] = fecha.split('/')
          measurementDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`
        } else {
          measurementDate = fecha.includes('T') ? fecha : `${fecha}T12:00:00.000Z`
        }

        try {
          // Buscar si ya existe un registro con los mismos parámetros
          const existing = environmentalDAL.findByKeys(plantId, parametro === 'PH' ? 'pH' : parametro, measurementDate, tipo)

          if (existing) {
            // Actualizar
            environmentalDAL.update((existing as any).id, { value: valor })
            updated++
          } else {
            // Insertar
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
          errors.push(`Línea ${i + 1}: Error al guardar - ${err.message}`)
        }
      }

      res.json({
        success: true,
        message: `Procesado: ${inserted} registros insertados, ${updated} actualizados`,
        inserted,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        fileSaved: file.filename
      })

    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// GET /api/analytics/csv-template - Descargar plantilla CSV
router.get('/csv-template', (_req: Request, res: Response) => {
  const templatePath = path.join(process.cwd(), 'uploads', 'plantilla_analiticas.csv')

  // Si no existe la plantilla, crearla
  if (!fs.existsSync(templatePath)) {
    const template = `planta,fecha,parametro,valor,tipo
TEXTILES,15/12/2025,DQO,2500,entrada
TEXTILES,15/12/2025,DQO,180,salida
TEXTILES,15/12/2025,pH,7.0,entrada
TEXTILES,15/12/2025,pH,7.0,salida
TEXTILES,15/12/2025,SS,600,entrada
TEXTILES,15/12/2025,SS,90,salida
TPI,15/12/2025,DQO,2500,entrada
TPI,15/12/2025,DQO,180,salida`
    fs.writeFileSync(templatePath, template)
  }

  res.download(templatePath, 'plantilla_analiticas.csv')
})

// GET /api/analytics/csv-watcher/status - Estado del watcher automático
router.get('/csv-watcher/status', (_req: Request, res: Response) => {
  const status = getWatcherStatus()
  res.json({ success: true, ...status })
})

// POST /api/analytics/csv-watcher/process - Procesar CSV manualmente
router.post('/csv-watcher/process', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const result = processCSV()
  res.json({ success: result.success, ...result })
})

// GET /api/analytics/csv-watcher/download - Descargar el CSV principal para edición
router.get('/csv-watcher/download', (_req: Request, res: Response) => {
  const csvPath = getCSVPath()
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ success: false, error: 'Archivo CSV no encontrado' })
  }
  res.download(csvPath, 'plantilla_analiticas.csv')
})

export default router
