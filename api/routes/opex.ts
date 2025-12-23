import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { opexCostsDAL, plantsDAL } from '../lib/dal.js'

const router = Router()

// Multer configuration for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files allowed'))
    }
  }
})

// GET /api/opex - Get all OPEX costs with optional filters
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { plantId, startDate, endDate, year } = req.query as Record<string, string>

  try {
    const data = opexCostsDAL.getAll({
      plantId,
      startDate,
      endDate,
      year: year ? parseInt(year) : undefined
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/opex/summary/:plantId - Get summary for a plant
router.get('/summary/:plantId', requireAuth, async (req: Request, res: Response) => {
  const { plantId } = req.params
  const { year } = req.query as Record<string, string>

  try {
    const data = opexCostsDAL.getSummaryByPlant(plantId, year ? parseInt(year) : undefined)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/opex/:id - Get single OPEX record
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const data = opexCostsDAL.getById(id)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Record not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/opex - Create or update OPEX record (upsert by plant+period)
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const {
    plantId,
    periodDate,
    volumeM3,
    costAgua,
    costPersonal,
    costMantenimiento,
    costEnergia,
    costFloculante,
    costCoagulante,
    costEstabilizadorPh,
    costDap,
    costUrea,
    costMelaza,
    notes
  } = req.body

  if (!plantId || !periodDate || volumeM3 === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: plantId, periodDate, volumeM3'
    })
  }

  try {
    const data = opexCostsDAL.upsert({
      plantId,
      periodDate,
      volumeM3: parseFloat(volumeM3),
      costAgua: costAgua !== undefined ? parseFloat(costAgua) : undefined,
      costPersonal: costPersonal !== undefined ? parseFloat(costPersonal) : undefined,
      costMantenimiento: costMantenimiento !== undefined ? parseFloat(costMantenimiento) : undefined,
      costEnergia: costEnergia !== undefined ? parseFloat(costEnergia) : undefined,
      costFloculante: costFloculante !== undefined ? parseFloat(costFloculante) : undefined,
      costCoagulante: costCoagulante !== undefined ? parseFloat(costCoagulante) : undefined,
      costEstabilizadorPh: costEstabilizadorPh !== undefined ? parseFloat(costEstabilizadorPh) : undefined,
      costDap: costDap !== undefined ? parseFloat(costDap) : undefined,
      costUrea: costUrea !== undefined ? parseFloat(costUrea) : undefined,
      costMelaza: costMelaza !== undefined ? parseFloat(costMelaza) : undefined,
      notes
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// PUT /api/opex/:id - Update OPEX record
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body

  try {
    const existing = opexCostsDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Record not found' })
    }

    const data = opexCostsDAL.update(id, {
      volumeM3: updates.volumeM3 !== undefined ? parseFloat(updates.volumeM3) : undefined,
      costAgua: updates.costAgua !== undefined ? parseFloat(updates.costAgua) : undefined,
      costPersonal: updates.costPersonal !== undefined ? parseFloat(updates.costPersonal) : undefined,
      costMantenimiento: updates.costMantenimiento !== undefined ? parseFloat(updates.costMantenimiento) : undefined,
      costEnergia: updates.costEnergia !== undefined ? parseFloat(updates.costEnergia) : undefined,
      costFloculante: updates.costFloculante !== undefined ? parseFloat(updates.costFloculante) : undefined,
      costCoagulante: updates.costCoagulante !== undefined ? parseFloat(updates.costCoagulante) : undefined,
      costEstabilizadorPh: updates.costEstabilizadorPh !== undefined ? parseFloat(updates.costEstabilizadorPh) : undefined,
      costDap: updates.costDap !== undefined ? parseFloat(updates.costDap) : undefined,
      costUrea: updates.costUrea !== undefined ? parseFloat(updates.costUrea) : undefined,
      costMelaza: updates.costMelaza !== undefined ? parseFloat(updates.costMelaza) : undefined,
      notes: updates.notes
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// DELETE /api/opex/:id - Delete OPEX record
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = opexCostsDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Record not found' })
    }

    opexCostsDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// GET /api/opex/csv-template - Download CSV template
router.get('/csv-template', requireAuth, async (_req: Request, res: Response) => {
  const headers = [
    'planta',
    'periodo',
    'volumen_m3',
    'agua',
    'personal',
    'mantenimiento',
    'energia',
    'floculante',
    'coagulante',
    'estabilizador_ph',
    'dap',
    'urea',
    'melaza',
    'notas'
  ]

  // Example data
  const exampleRows = [
    ['La Luz', '2025-01', '1500', '120.50', '850.00', '200.00', '450.00', '50.00', '45.00', '30.00', '25.00', '20.00', '15.00', 'Ejemplo enero'],
    ['La Luz', '2025-02', '1600', '125.00', '870.00', '180.00', '480.00', '55.00', '48.00', '32.00', '28.00', '22.00', '18.00', 'Ejemplo febrero'],
  ]

  const csvContent = [headers.join(','), ...exampleRows.map(row => row.join(','))].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_opex.csv"')
  res.send('\uFEFF' + csvContent) // BOM for Excel UTF-8 compatibility
})

// POST /api/opex/upload-csv - Upload CSV with OPEX data
router.post('/upload-csv', requireAuth, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file

  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' })
  }

  try {
    const csvContent = file.buffer.toString('utf-8').replace(/^\uFEFF/, '') // Remove BOM if present

    // Parse CSV
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_')
    })

    if (parseResult.errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'CSV parsing errors',
        errors: parseResult.errors.map((e: any) => `Row ${e.row}: ${e.message}`)
      })
    }

    const rows = parseResult.data as Record<string, string>[]
    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'CSV file is empty' })
    }

    // Get all plants for name-to-ID mapping
    const plants = plantsDAL.getAll()
    const plantMap = new Map<string, string>()
    plants.forEach((p: any) => {
      plantMap.set(p.name.toLowerCase().trim(), p.id)
      // Also add some common aliases
      if (p.name.toLowerCase().includes('luz')) plantMap.set('la luz', p.id)
      if (p.name.toLowerCase().includes('taura')) plantMap.set('taura', p.id)
      if (p.name.toLowerCase().includes('monica')) plantMap.set('santa monica', p.id)
      if (p.name.toLowerCase().includes('diego')) plantMap.set('san diego', p.id)
      if (p.name.toLowerCase().includes('chanduy')) plantMap.set('chanduy', p.id)
    })

    let inserted = 0
    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 for header row and 0-indexing

      try {
        // Get plant ID from name
        const plantName = (row.planta || row.plant || row.plant_name || '').trim().toLowerCase()
        let plantId = row.plant_id || plantMap.get(plantName)

        if (!plantId) {
          errors.push(`Row ${rowNum}: Unknown plant "${plantName}"`)
          continue
        }

        // Parse period date
        let periodDate = row.periodo || row.period || row.period_date || row.fecha || ''
        if (!periodDate) {
          errors.push(`Row ${rowNum}: Missing period date`)
          continue
        }
        // Normalize date format (YYYY-MM or YYYY-MM-DD)
        if (periodDate.length === 7) {
          periodDate = periodDate + '-01'
        }

        // Parse numeric values
        const volumeM3 = parseFloat(row.volumen_m3 || row.volume_m3 || row.volumen || '0') || 0
        const costAgua = parseFloat(row.agua || row.cost_agua || row.water || '0') || 0
        const costPersonal = parseFloat(row.personal || row.cost_personal || row.staff || '0') || 0
        const costMantenimiento = parseFloat(row.mantenimiento || row.cost_mantenimiento || row.maintenance || '0') || 0
        const costEnergia = parseFloat(row.energia || row.cost_energia || row.energy || '0') || 0
        const costFloculante = parseFloat(row.floculante || row.cost_floculante || '0') || 0
        const costCoagulante = parseFloat(row.coagulante || row.cost_coagulante || '0') || 0
        const costEstabilizadorPh = parseFloat(row.estabilizador_ph || row.cost_estabilizador_ph || row.ph_stabilizer || '0') || 0
        const costDap = parseFloat(row.dap || row.cost_dap || '0') || 0
        const costUrea = parseFloat(row.urea || row.cost_urea || '0') || 0
        const costMelaza = parseFloat(row.melaza || row.cost_melaza || row.molasses || '0') || 0
        const notes = row.notas || row.notes || null

        // Check if record exists for this plant+period
        const existing = opexCostsDAL.getByPlantAndPeriod(plantId, periodDate) as { id: string } | undefined

        if (existing) {
          // Update existing
          opexCostsDAL.update(existing.id, {
            volumeM3,
            costAgua,
            costPersonal,
            costMantenimiento,
            costEnergia,
            costFloculante,
            costCoagulante,
            costEstabilizadorPh,
            costDap,
            costUrea,
            costMelaza,
            notes
          })
          updated++
        } else {
          // Create new
          opexCostsDAL.create({
            plantId,
            periodDate,
            volumeM3,
            costAgua,
            costPersonal,
            costMantenimiento,
            costEnergia,
            costFloculante,
            costCoagulante,
            costEstabilizadorPh,
            costDap,
            costUrea,
            costMelaza,
            notes
          })
          inserted++
        }
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message}`)
      }
    }

    res.json({
      success: true,
      message: `Procesados: ${inserted} insertados, ${updated} actualizados`,
      inserted,
      updated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
