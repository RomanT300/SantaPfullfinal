/**
 * Daily Checklist API Routes
 * For field operators to complete daily inspections via mobile app
 * Supports red flags, photos, and supervisor reporting
 * Includes Excel sync for automatic template updates
 */
import { Router, Request, Response } from 'express'
import { db } from '../lib/database'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { execSync } from 'child_process'

// Extend Express Request to include multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File
}

const router = Router()

// Configure multer for photo uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'checklist-photos')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `photo-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten imágenes JPEG, PNG o WebP'))
    }
  }
})

// Configure multer for Excel uploads
const excelUploadDir = path.join(process.cwd(), 'uploads', 'checklist-templates')
if (!fs.existsSync(excelUploadDir)) {
  fs.mkdirSync(excelUploadDir, { recursive: true })
}

const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, excelUploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `template-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const excelUpload = multer({
  storage: excelStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for Excel files
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      'application/octet-stream' // For some .xlsb files
    ]
    const allowedExtensions = ['.xls', '.xlsx', '.xlsb', '.csv']
    const ext = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xls, .xlsx, .xlsb) o CSV'))
    }
  }
})

// Types
interface ChecklistTemplate {
  id: string
  plant_id: string
  template_name: string
  template_code: string
  description: string
  is_active: number
}

interface TemplateItem {
  id: string
  template_id: string
  section: string
  element: string
  activity: string
  requires_value: number
  value_unit: string | null
  display_order: number
}

interface DailyChecklist {
  id: string
  plant_id: string
  check_date: string
  operator_name: string
  operator_id: string
  completed_at: string | null
  notes: string | null
}

interface ChecklistItem {
  id: string
  checklist_id: string
  template_item_id: string | null
  item_description: string
  category: string
  section: string | null
  is_checked: number
  is_red_flag: number
  red_flag_comment: string | null
  numeric_value: number | null
  unit: string | null
  observation: string | null
  photo_path: string | null
  checked_at: string | null
}

/**
 * GET /api/checklist/templates/:plantId
 * Get available checklist templates for a plant
 */
router.get('/templates/:plantId', (req: Request, res: Response) => {
  try {
    const { plantId } = req.params

    const templates = db.prepare(`
      SELECT ct.*,
        (SELECT COUNT(*) FROM checklist_template_items WHERE template_id = ct.id) as item_count
      FROM checklist_templates ct
      WHERE ct.plant_id = ? AND ct.is_active = 1
      ORDER BY ct.template_name
    `).all(plantId)

    res.json({ success: true, data: templates })
  } catch (error) {
    console.error('Error getting templates:', error)
    res.status(500).json({ success: false, error: 'Error al obtener templates' })
  }
})

/**
 * GET /api/checklist/template/:templateId/items
 * Get all items for a template
 */
router.get('/template/:templateId/items', (req: Request, res: Response) => {
  try {
    const { templateId } = req.params

    const items = db.prepare(`
      SELECT * FROM checklist_template_items
      WHERE template_id = ?
      ORDER BY display_order
    `).all(templateId) as TemplateItem[]

    // Group by section and element
    const grouped: Record<string, Record<string, TemplateItem[]>> = {}
    for (const item of items) {
      if (!grouped[item.section]) grouped[item.section] = {}
      if (!grouped[item.section][item.element]) grouped[item.section][item.element] = []
      grouped[item.section][item.element].push(item)
    }

    res.json({ success: true, data: { items, grouped } })
  } catch (error) {
    console.error('Error getting template items:', error)
    res.status(500).json({ success: false, error: 'Error al obtener items del template' })
  }
})

/**
 * GET /api/checklist/today/:plantId
 * Get or create today's checklist for a plant (using templates)
 */
router.get('/today/:plantId', (req: Request, res: Response) => {
  try {
    const { plantId } = req.params
    const { templateId } = req.query
    const today = new Date().toISOString().split('T')[0]
    const operatorName = (req as any).user?.name || 'Operador'
    const operatorId = (req as any).user?.sub || 'unknown'

    // Check if today's checklist exists
    let checklist = db.prepare(`
      SELECT * FROM daily_checklists WHERE plant_id = ? AND check_date = ?
    `).get(plantId, today) as DailyChecklist | undefined

    if (!checklist) {
      // Create new checklist for today
      const checklistId = `checklist-${plantId}-${today}`

      db.prepare(`
        INSERT INTO daily_checklists (id, plant_id, check_date, operator_name)
        VALUES (?, ?, ?, ?)
      `).run(checklistId, plantId, today, operatorName)

      // Get template items if template is specified
      let templateItems: TemplateItem[] = []
      if (templateId) {
        templateItems = db.prepare(`
          SELECT * FROM checklist_template_items WHERE template_id = ? ORDER BY display_order
        `).all(templateId as string) as TemplateItem[]
      }

      // If no template specified, try to get the first available template for the plant
      if (templateItems.length === 0) {
        const template = db.prepare(`
          SELECT id FROM checklist_templates WHERE plant_id = ? AND is_active = 1 LIMIT 1
        `).get(plantId) as { id: string } | undefined

        if (template) {
          templateItems = db.prepare(`
            SELECT * FROM checklist_template_items WHERE template_id = ? ORDER BY display_order
          `).all(template.id) as TemplateItem[]
        }
      }

      // Create checklist items from template
      const insertItem = db.prepare(`
        INSERT INTO daily_checklist_items (id, checklist_id, template_item_id, item_description, category, section, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of templateItems) {
        const itemId = `item-${checklistId}-${item.id}`
        const description = `${item.element}: ${item.activity}`
        insertItem.run(itemId, checklistId, item.id, description, item.element, item.section, item.value_unit)
      }

      // If still no items, add general plant checks
      if (templateItems.length === 0) {
        const generalChecks = [
          { desc: 'Inspección visual del estado general de la planta', cat: 'general', section: 'general' },
          { desc: 'Verificar niveles de agua en todos los tanques', cat: 'tanques', section: 'general' },
          { desc: 'Revisar olores anormales o condiciones inusuales', cat: 'general', section: 'general' },
          { desc: 'Verificar funcionamiento de todos los equipos en operación', cat: 'motores', section: 'general' },
          { desc: 'Revisar indicadores y alarmas del cuadro eléctrico', cat: 'cuadro_electrico', section: 'general' },
        ]

        for (let i = 0; i < generalChecks.length; i++) {
          const check = generalChecks[i]
          const itemId = `item-${checklistId}-general-${i}`
          insertItem.run(itemId, checklistId, null, check.desc, check.cat, check.section, null)
        }
      }

      checklist = db.prepare(`
        SELECT * FROM daily_checklists WHERE id = ?
      `).get(checklistId) as DailyChecklist
    }

    // Get checklist items
    const items = db.prepare(`
      SELECT ci.*, ti.requires_value, ti.value_unit as template_unit
      FROM daily_checklist_items ci
      LEFT JOIN checklist_template_items ti ON ci.template_item_id = ti.id
      WHERE ci.checklist_id = ?
      ORDER BY ci.section, ci.id
    `).all(checklist.id)

    // Group by section and element
    const grouped: Record<string, any[]> = {}
    for (const item of items as any[]) {
      const section = item.section || 'general'
      if (!grouped[section]) grouped[section] = []
      grouped[section].push(item)
    }

    // Calculate progress
    const total = (items as any[]).length
    const checked = (items as any[]).filter((i: any) => i.is_checked).length
    const redFlags = (items as any[]).filter((i: any) => i.is_red_flag).length
    const progress = total > 0 ? Math.round((checked / total) * 100) : 0

    res.json({
      success: true,
      data: {
        checklist,
        items: grouped,
        progress,
        total,
        checked,
        redFlags,
      },
    })
  } catch (error) {
    console.error('Error getting checklist:', error)
    res.status(500).json({ success: false, error: 'Error al obtener checklist' })
  }
})

/**
 * PATCH /api/checklist/item/:itemId
 * Update a checklist item (mark as checked, add observation, set red flag)
 */
router.patch('/item/:itemId', (req: Request, res: Response) => {
  try {
    const { itemId } = req.params
    const { is_checked, is_red_flag, red_flag_comment, observation, numeric_value } = req.body

    const updates: string[] = []
    const values: any[] = []

    if (is_checked !== undefined) {
      updates.push('is_checked = ?')
      values.push(is_checked ? 1 : 0)

      if (is_checked) {
        updates.push('checked_at = CURRENT_TIMESTAMP')
      } else {
        updates.push('checked_at = NULL')
      }
    }

    if (is_red_flag !== undefined) {
      updates.push('is_red_flag = ?')
      values.push(is_red_flag ? 1 : 0)
    }

    if (red_flag_comment !== undefined) {
      updates.push('red_flag_comment = ?')
      values.push(red_flag_comment)
    }

    if (observation !== undefined) {
      updates.push('observation = ?')
      values.push(observation)
    }

    if (numeric_value !== undefined) {
      updates.push('numeric_value = ?')
      values.push(numeric_value)
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay cambios' })
    }

    values.push(itemId)

    db.prepare(`
      UPDATE daily_checklist_items SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // If red flag was set, create a red flag history entry
    if (is_red_flag === true) {
      const item = db.prepare(`
        SELECT ci.*, dc.plant_id, dc.operator_name
        FROM daily_checklist_items ci
        JOIN daily_checklists dc ON ci.checklist_id = dc.id
        WHERE ci.id = ?
      `).get(itemId) as any

      if (item) {
        const operatorId = (req as any).user?.sub || 'unknown'
        db.prepare(`
          INSERT INTO red_flag_history (id, checklist_item_id, checklist_id, plant_id, operator_id, operator_name, section, element, activity, comment, photo_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `redflag-${Date.now()}`,
          itemId,
          item.checklist_id,
          item.plant_id,
          operatorId,
          item.operator_name,
          item.section || 'general',
          item.category || 'general',
          item.item_description,
          red_flag_comment || null,
          item.photo_path
        )
      }
    }

    res.json({ success: true, message: 'Item actualizado' })
  } catch (error) {
    console.error('Error updating checklist item:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar item' })
  }
})

/**
 * POST /api/checklist/item/:itemId/photo
 * Upload a photo for a checklist item
 */
router.post('/item/:itemId/photo', upload.single('photo'), (req: MulterRequest, res: Response) => {
  try {
    const { itemId } = req.params
    const file = req.file

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó una foto' })
    }

    const photoPath = `/uploads/checklist-photos/${file.filename}`

    db.prepare(`
      UPDATE daily_checklist_items SET photo_path = ? WHERE id = ?
    `).run(photoPath, itemId)

    res.json({ success: true, data: { photo_path: photoPath } })
  } catch (error) {
    console.error('Error uploading photo:', error)
    res.status(500).json({ success: false, error: 'Error al subir foto' })
  }
})

/**
 * POST /api/checklist/:checklistId/complete
 * Mark checklist as completed and send report to supervisor
 */
router.post('/:checklistId/complete', (req: Request, res: Response) => {
  try {
    const { checklistId } = req.params
    const { notes, notify_supervisor } = req.body
    const operatorId = (req as any).user?.sub || 'unknown'
    const operatorName = (req as any).user?.name || 'Operador'

    // Get checklist info
    const checklist = db.prepare(`
      SELECT * FROM daily_checklists WHERE id = ?
    `).get(checklistId) as DailyChecklist | undefined

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist no encontrado' })
    }

    // Update checklist as completed
    db.prepare(`
      UPDATE daily_checklists
      SET completed_at = CURRENT_TIMESTAMP, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(notes || null, checklistId)

    // Get checklist stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_checked = 1 THEN 1 ELSE 0 END) as checked,
        SUM(CASE WHEN is_red_flag = 1 THEN 1 ELSE 0 END) as red_flags
      FROM daily_checklist_items
      WHERE checklist_id = ?
    `).get(checklistId) as { total: number, checked: number, red_flags: number }

    // Create supervisor report
    if (notify_supervisor !== false) {
      const reportId = `report-${checklistId}`
      const today = new Date().toISOString().split('T')[0]

      db.prepare(`
        INSERT OR REPLACE INTO supervisor_reports (id, checklist_id, plant_id, operator_id, operator_name, report_date, total_items, checked_items, red_flag_count, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        checklistId,
        checklist.plant_id,
        operatorId,
        operatorName,
        today,
        stats.total,
        stats.checked,
        stats.red_flags,
        notes || null
      )
    }

    res.json({
      success: true,
      message: 'Checklist completado',
      data: {
        total: stats.total,
        checked: stats.checked,
        red_flags: stats.red_flags,
        report_sent: notify_supervisor !== false
      }
    })
  } catch (error) {
    console.error('Error completing checklist:', error)
    res.status(500).json({ success: false, error: 'Error al completar checklist' })
  }
})

/**
 * GET /api/checklist/history/:plantId
 * Get checklist history for a plant
 */
router.get('/history/:plantId', (req: Request, res: Response) => {
  try {
    const { plantId } = req.params
    const days = parseInt(req.query.days as string) || 30

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    const checklists = db.prepare(`
      SELECT
        dc.*,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id) as total_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) as checked_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_red_flag = 1) as red_flag_count
      FROM daily_checklists dc
      WHERE dc.plant_id = ?
      AND dc.check_date >= ?
      ORDER BY dc.check_date DESC
    `).all(plantId, sinceStr)

    res.json({ success: true, data: checklists })
  } catch (error) {
    console.error('Error getting checklist history:', error)
    res.status(500).json({ success: false, error: 'Error al obtener historial' })
  }
})

/**
 * GET /api/checklist/summary
 * Get summary of all checklists for today across all plants
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const summary = db.prepare(`
      SELECT
        p.id as plant_id,
        p.name as plant_name,
        dc.id as checklist_id,
        dc.completed_at,
        dc.operator_name,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id) as total_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) as checked_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_red_flag = 1) as red_flag_count
      FROM plants p
      LEFT JOIN daily_checklists dc ON p.id = dc.plant_id AND dc.check_date = ?
      WHERE p.status = 'active'
      ORDER BY p.name
    `).all(today)

    res.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error getting checklist summary:', error)
    res.status(500).json({ success: false, error: 'Error al obtener resumen' })
  }
})

/**
 * GET /api/checklist/supervisor/all
 * Comprehensive supervisor dashboard data - checklists, operator stats, plant performance
 * This is the main endpoint for the supervisor reports page
 */
router.get('/supervisor/all', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string
    const date = req.query.date as string // Specific date filter

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    let plantFilter = ''
    const baseParams: any[] = [sinceStr]
    if (plantId) {
      plantFilter = ' AND dc.plant_id = ?'
      baseParams.push(plantId)
    }

    let dateFilter = ''
    if (date) {
      dateFilter = ' AND dc.check_date = ?'
      baseParams.push(date)
    }

    // 1. Get all checklists with their stats
    const checklists = db.prepare(`
      SELECT
        dc.id,
        dc.plant_id,
        p.name as plant_name,
        dc.check_date as date,
        dc.operator_name,
        dc.completed_at,
        dc.notes,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id) as total_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) as checked_items,
        (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_red_flag = 1) as red_flags,
        ROUND(
          (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id), 0)
        , 1) as progress
      FROM daily_checklists dc
      JOIN plants p ON dc.plant_id = p.id
      WHERE dc.check_date >= ?${plantFilter}${dateFilter}
      ORDER BY dc.check_date DESC, p.name
    `).all(...baseParams) as any[]

    // Add items detail for each checklist
    const checklistsWithItems = checklists.map(cl => {
      const items = db.prepare(`
        SELECT
          id, item_description, category, section,
          is_checked, is_red_flag, red_flag_comment,
          numeric_value, unit, observation, checked_at
        FROM daily_checklist_items
        WHERE checklist_id = ?
        ORDER BY section, id
      `).all(cl.id)
      return { ...cl, items }
    })

    // 2. Get red flags with details
    const redFlagParams: any[] = [sinceStr]
    let redFlagPlantFilter = ''
    if (plantId) {
      redFlagPlantFilter = ' AND rfh.plant_id = ?'
      redFlagParams.push(plantId)
    }

    const redFlags = db.prepare(`
      SELECT
        rfh.id,
        rfh.checklist_item_id,
        rfh.checklist_id,
        rfh.plant_id,
        p.name as plant_name,
        rfh.operator_id,
        rfh.operator_name,
        rfh.section,
        rfh.element,
        rfh.activity as description,
        rfh.comment,
        rfh.photo_path,
        rfh.flagged_at as created_at,
        rfh.resolved_at,
        rfh.resolved_by,
        rfh.resolution_notes,
        dc.check_date as date,
        CASE WHEN rfh.resolved_at IS NULL THEN 'pending' ELSE 'resolved' END as status
      FROM red_flag_history rfh
      JOIN plants p ON rfh.plant_id = p.id
      LEFT JOIN daily_checklists dc ON rfh.checklist_id = dc.id
      WHERE rfh.flagged_at >= ?${redFlagPlantFilter}
      ORDER BY rfh.flagged_at DESC
    `).all(...redFlagParams)

    // 3. Calculate operator statistics (using operator_name since operator_id doesn't exist)
    const operatorStats = db.prepare(`
      SELECT
        dc.operator_name as id,
        dc.operator_name as name,
        COUNT(DISTINCT dc.id) as total_checklists,
        COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) as completed_checklists,
        ROUND(
          COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) * 100.0 /
          NULLIF(COUNT(DISTINCT dc.id), 0)
        , 1) as completion_rate,
        (SELECT COUNT(*) FROM daily_checklist_items dci
         JOIN daily_checklists dc2 ON dci.checklist_id = dc2.id
         WHERE dc2.operator_name = dc.operator_name
         AND dci.is_red_flag = 1
         AND dc2.check_date >= ?) as red_flags_reported,
        MAX(dc.check_date) as last_activity,
        ROUND(AVG(
          (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id), 0)
        ), 1) as avg_checklist_completion
      FROM daily_checklists dc
      WHERE dc.check_date >= ?${plantId ? ' AND dc.plant_id = ?' : ''}
      GROUP BY dc.operator_name
      ORDER BY completion_rate DESC, total_checklists DESC
    `).all(...(plantId ? [sinceStr, sinceStr, plantId] : [sinceStr, sinceStr])) as any[]

    // 4. Calculate plant performance
    const plantPerformance = db.prepare(`
      SELECT
        p.id,
        p.name,
        COUNT(DISTINCT dc.id) as total_checklists,
        COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) as completed_checklists,
        ROUND(
          COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) * 100.0 /
          NULLIF(COUNT(DISTINCT dc.id), 0)
        , 1) as compliance_rate,
        (SELECT COUNT(*) FROM red_flag_history rfh
         WHERE rfh.plant_id = p.id
         AND rfh.flagged_at >= ?) as total_red_flags,
        (SELECT COUNT(*) FROM red_flag_history rfh
         WHERE rfh.plant_id = p.id
         AND rfh.resolved_at IS NULL
         AND rfh.flagged_at >= ?) as pending_red_flags,
        ROUND(AVG(
          (SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id AND is_checked = 1) * 100.0 /
          NULLIF((SELECT COUNT(*) FROM daily_checklist_items WHERE checklist_id = dc.id), 0)
        ), 1) as avg_items_completion,
        COUNT(DISTINCT dc.operator_name) as active_operators,
        CASE
          WHEN COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) * 100.0 /
               NULLIF(COUNT(DISTINCT dc.id), 0) >= 90 THEN 'excellent'
          WHEN COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) * 100.0 /
               NULLIF(COUNT(DISTINCT dc.id), 0) >= 70 THEN 'good'
          WHEN COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) * 100.0 /
               NULLIF(COUNT(DISTINCT dc.id), 0) >= 50 THEN 'needs_attention'
          ELSE 'critical'
        END as status
      FROM plants p
      LEFT JOIN daily_checklists dc ON p.id = dc.plant_id AND dc.check_date >= ?
      WHERE p.status = 'active'
      ${plantId ? 'AND p.id = ?' : ''}
      GROUP BY p.id, p.name
      ORDER BY compliance_rate DESC
    `).all(...(plantId ? [sinceStr, sinceStr, sinceStr, plantId] : [sinceStr, sinceStr, sinceStr])) as any[]

    // 5. Get daily trend data for charts
    const trendData = db.prepare(`
      SELECT
        dc.check_date as date,
        COUNT(DISTINCT dc.id) as total_checklists,
        COUNT(DISTINCT CASE WHEN dc.completed_at IS NOT NULL THEN dc.id END) as completed,
        (SELECT COUNT(*) FROM daily_checklist_items dci
         JOIN daily_checklists dc2 ON dci.checklist_id = dc2.id
         WHERE dc2.check_date = dc.check_date
         AND dci.is_red_flag = 1
         ${plantId ? 'AND dc2.plant_id = ?' : ''}) as red_flags
      FROM daily_checklists dc
      WHERE dc.check_date >= ?${plantId ? ' AND dc.plant_id = ?' : ''}
      GROUP BY dc.check_date
      ORDER BY dc.check_date
    `).all(...(plantId ? [plantId, sinceStr, plantId] : [sinceStr])) as any[]

    // 6. Summary stats
    const summary = {
      totalChecklists: checklists.length,
      completedChecklists: checklists.filter(c => c.completed_at).length,
      totalRedFlags: redFlags.length,
      pendingRedFlags: redFlags.filter((rf: any) => rf.status === 'pending').length,
      activeOperators: new Set(checklists.map(c => c.operator_name)).size,
      avgCompletionRate: checklists.length > 0
        ? Math.round(checklists.reduce((sum, c) => sum + (c.progress || 0), 0) / checklists.length)
        : 0
    }

    res.json({
      success: true,
      data: {
        checklists: checklistsWithItems,
        redFlags,
        operatorStats,
        plantPerformance,
        trendData,
        summary
      }
    })
  } catch (error) {
    console.error('Error getting supervisor data:', error)
    res.status(500).json({ success: false, error: 'Error al obtener datos de supervisión' })
  }
})

/**
 * GET /api/checklist/supervisor/reports
 * Get all supervisor reports (for supervisor view)
 */
router.get('/supervisor/reports', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    let query = `
      SELECT
        sr.*,
        p.name as plant_name,
        p.location as plant_location
      FROM supervisor_reports sr
      JOIN plants p ON sr.plant_id = p.id
      WHERE sr.report_date >= ?
    `
    const params: any[] = [sinceStr]

    if (plantId) {
      query += ' AND sr.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY sr.sent_at DESC'

    const reports = db.prepare(query).all(...params)

    res.json({ success: true, data: reports })
  } catch (error) {
    console.error('Error getting supervisor reports:', error)
    res.status(500).json({ success: false, error: 'Error al obtener reportes' })
  }
})

/**
 * GET /api/checklist/supervisor/report/:reportId
 * Get detailed report with all items
 */
router.get('/supervisor/report/:reportId', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params

    const report = db.prepare(`
      SELECT sr.*, p.name as plant_name, p.location as plant_location
      FROM supervisor_reports sr
      JOIN plants p ON sr.plant_id = p.id
      WHERE sr.id = ?
    `).get(reportId)

    if (!report) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }

    // Get all checklist items
    const items = db.prepare(`
      SELECT * FROM daily_checklist_items
      WHERE checklist_id = ?
      ORDER BY section, id
    `).all((report as any).checklist_id)

    // Group by section
    const grouped: Record<string, any[]> = {}
    for (const item of items as any[]) {
      const section = item.section || 'general'
      if (!grouped[section]) grouped[section] = []
      grouped[section].push(item)
    }

    res.json({
      success: true,
      data: {
        report,
        items: grouped,
        allItems: items
      }
    })
  } catch (error) {
    console.error('Error getting report details:', error)
    res.status(500).json({ success: false, error: 'Error al obtener detalles del reporte' })
  }
})

/**
 * PATCH /api/checklist/supervisor/report/:reportId/read
 * Mark a report as read by supervisor
 */
router.patch('/supervisor/report/:reportId/read', (req: Request, res: Response) => {
  try {
    const { reportId } = req.params
    const supervisorName = (req as any).user?.name || 'Supervisor'

    db.prepare(`
      UPDATE supervisor_reports
      SET read_at = CURRENT_TIMESTAMP, read_by = ?
      WHERE id = ?
    `).run(supervisorName, reportId)

    res.json({ success: true, message: 'Reporte marcado como leído' })
  } catch (error) {
    console.error('Error marking report as read:', error)
    res.status(500).json({ success: false, error: 'Error al marcar reporte' })
  }
})

/**
 * GET /api/checklist/red-flags
 * Get all red flags (for supervisor analytics)
 */
router.get('/red-flags', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string
    const resolved = req.query.resolved as string

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    let query = `
      SELECT
        rfh.*,
        p.name as plant_name
      FROM red_flag_history rfh
      JOIN plants p ON rfh.plant_id = p.id
      WHERE rfh.flagged_at >= ?
    `
    const params: any[] = [sinceStr]

    if (plantId) {
      query += ' AND rfh.plant_id = ?'
      params.push(plantId)
    }

    if (resolved === 'true') {
      query += ' AND rfh.resolved_at IS NOT NULL'
    } else if (resolved === 'false') {
      query += ' AND rfh.resolved_at IS NULL'
    }

    query += ' ORDER BY rfh.flagged_at DESC'

    const redFlags = db.prepare(query).all(...params)

    // Get summary stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
      FROM red_flag_history
      WHERE flagged_at >= ?
      ${plantId ? 'AND plant_id = ?' : ''}
    `).get(...(plantId ? [sinceStr, plantId] : [sinceStr])) as any

    res.json({
      success: true,
      data: {
        redFlags,
        stats
      }
    })
  } catch (error) {
    console.error('Error getting red flags:', error)
    res.status(500).json({ success: false, error: 'Error al obtener red flags' })
  }
})

/**
 * PATCH /api/checklist/red-flag/:flagId/resolve
 * Mark a red flag as resolved
 */
router.patch('/red-flag/:flagId/resolve', (req: Request, res: Response) => {
  try {
    const { flagId } = req.params
    const { resolution_notes } = req.body
    const resolvedBy = (req as any).user?.name || 'Supervisor'

    db.prepare(`
      UPDATE red_flag_history
      SET resolved_at = CURRENT_TIMESTAMP, resolved_by = ?, resolution_notes = ?
      WHERE id = ?
    `).run(resolvedBy, resolution_notes || null, flagId)

    res.json({ success: true, message: 'Red flag marcado como resuelto' })
  } catch (error) {
    console.error('Error resolving red flag:', error)
    res.status(500).json({ success: false, error: 'Error al resolver red flag' })
  }
})

/**
 * GET /api/checklist/stats
 * Get checklist statistics for dashboard
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    let plantFilter = ''
    const params: any[] = [sinceStr]
    if (plantId) {
      plantFilter = ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    // Completion rate
    const completionStats = db.prepare(`
      SELECT
        COUNT(*) as total_checklists,
        SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
        ROUND(AVG(CASE WHEN completed_at IS NOT NULL THEN 1.0 ELSE 0 END) * 100, 1) as completion_rate
      FROM daily_checklists dc
      WHERE check_date >= ?${plantFilter}
    `).get(...params) as any

    // Red flag stats
    const redFlagStats = db.prepare(`
      SELECT
        COUNT(*) as total_red_flags,
        SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) as resolved
      FROM red_flag_history
      WHERE flagged_at >= ?${plantId ? ' AND plant_id = ?' : ''}
    `).get(...(plantId ? [sinceStr, plantId] : [sinceStr])) as any

    // Daily trend
    const trend = db.prepare(`
      SELECT
        dc.check_date,
        COUNT(*) as checklists,
        SUM(CASE WHEN dc.completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
        (SELECT COUNT(*) FROM daily_checklist_items dci
         JOIN daily_checklists dc2 ON dci.checklist_id = dc2.id
         WHERE dc2.check_date = dc.check_date AND dci.is_red_flag = 1
         ${plantId ? 'AND dc2.plant_id = ?' : ''}) as red_flags
      FROM daily_checklists dc
      WHERE dc.check_date >= ?${plantFilter}
      GROUP BY dc.check_date
      ORDER BY dc.check_date
    `).all(...(plantId ? [plantId, sinceStr, plantId] : [sinceStr])) as any[]

    res.json({
      success: true,
      data: {
        completion: completionStats,
        redFlags: redFlagStats,
        trend
      }
    })
  } catch (error) {
    console.error('Error getting checklist stats:', error)
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' })
  }
})

// =====================================================
// EXCEL SYNC ENDPOINTS
// =====================================================

/**
 * Helper: Parse CSV content to extract checklist items
 */
function parseCSVContent(csvContent: string): Array<{
  section: string
  element: string
  activity: string
  requires_value: boolean
  value_unit: string | null
}> {
  const lines = csvContent.split('\n').filter(line => line.trim())
  const items: Array<{
    section: string
    element: string
    activity: string
    requires_value: boolean
    value_unit: string | null
  }> = []

  let currentSection = 'General'
  let currentElement = 'General'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const columns = line.split(',').map(col => col.trim().replace(/^"|"$/g, ''))

    // Skip header rows (usually first few rows)
    if (i < 2 || columns.every(col => !col || col.toLowerCase().includes('check') || col.toLowerCase().includes('elemento'))) {
      continue
    }

    // Detect section headers (typically rows with content in first column only)
    if (columns[0] && !columns[1] && !columns[2]) {
      currentSection = columns[0]
      continue
    }

    // Detect element (typically in first column with activities in following columns)
    if (columns[0] && columns[0].length > 2) {
      // Check if this looks like an element header
      const hasActivities = columns.slice(1).some(col => col && col.length > 5)
      if (!hasActivities && columns[0].length < 100) {
        currentElement = columns[0]
        continue
      }
    }

    // Extract activities from columns
    for (let j = 0; j < columns.length; j++) {
      const activity = columns[j]
      if (activity && activity.length > 3 && !activity.toLowerCase().includes('check') && !activity.toLowerCase().includes('elemento')) {
        // Check if it requires a value (contains units like kg, m³, pH, etc.)
        const unitMatch = activity.match(/\((.*?)\)$/)
        let requires_value = false
        let value_unit: string | null = null

        if (unitMatch) {
          requires_value = true
          value_unit = unitMatch[1]
        } else if (/\d/.test(activity) || /kg|m³|pH|mg|L|ppm|°C|bar/i.test(activity)) {
          requires_value = true
        }

        items.push({
          section: currentSection,
          element: currentElement || 'General',
          activity: activity.replace(/\(.*?\)$/, '').trim(),
          requires_value,
          value_unit
        })
      }
    }
  }

  return items
}

/**
 * Helper: Convert Excel to CSV using LibreOffice (for .xlsb files)
 */
function convertExcelToCSV(excelPath: string): string {
  const ext = path.extname(excelPath).toLowerCase()
  const outputDir = path.dirname(excelPath)

  if (ext === '.csv') {
    return fs.readFileSync(excelPath, 'utf-8')
  }

  try {
    // Use LibreOffice to convert to CSV
    execSync(`libreoffice --headless --convert-to csv --outdir "${outputDir}" "${excelPath}"`, {
      timeout: 60000
    })

    // Find the generated CSV file
    const baseName = path.basename(excelPath, ext)
    const csvPath = path.join(outputDir, `${baseName}.csv`)

    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8')
      // Clean up temporary CSV
      fs.unlinkSync(csvPath)
      return content
    }

    throw new Error('CSV conversion failed - file not found')
  } catch (error) {
    console.error('Error converting Excel to CSV:', error)
    throw new Error('Error al convertir archivo Excel. Asegúrese de que LibreOffice esté instalado.')
  }
}

/**
 * POST /api/checklist/sync/upload
 * Upload an Excel file to sync checklist templates
 */
router.post('/sync/upload', excelUpload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    const { plantId, templateName, templateCode, replaceExisting } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó un archivo' })
    }

    if (!plantId) {
      return res.status(400).json({ success: false, error: 'Se requiere ID de planta' })
    }

    // Convert to CSV and parse
    let csvContent: string
    try {
      csvContent = convertExcelToCSV(file.path)
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message })
    }

    // Parse the CSV content
    const items = parseCSVContent(csvContent)

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontraron items en el archivo. Verifique el formato.'
      })
    }

    // Generate template ID and name
    const templateId = `template-${plantId}-${Date.now()}`
    const name = templateName || `Checklist ${new Date().toLocaleDateString('es-EC')}`
    const code = templateCode || `CK-${plantId.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-6)}`

    // Begin transaction
    const transaction = db.transaction(() => {
      // If replacing existing, deactivate old templates for this plant
      if (replaceExisting === 'true' || replaceExisting === true) {
        db.prepare(`
          UPDATE checklist_templates SET is_active = 0 WHERE plant_id = ?
        `).run(plantId)
      }

      // Create new template
      db.prepare(`
        INSERT INTO checklist_templates (id, plant_id, template_name, template_code, description, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(templateId, plantId, name, code, `Importado desde ${file.originalname}`)

      // Insert template items
      const insertItem = db.prepare(`
        INSERT INTO checklist_template_items (id, template_id, section, element, activity, requires_value, value_unit, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      let order = 0
      for (const item of items) {
        const itemId = `item-${templateId}-${order}`
        insertItem.run(
          itemId,
          templateId,
          item.section,
          item.element,
          item.activity,
          item.requires_value ? 1 : 0,
          item.value_unit,
          order
        )
        order++
      }
    })

    transaction()

    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    res.json({
      success: true,
      message: `Template creado con ${items.length} items`,
      data: {
        templateId,
        templateName: name,
        templateCode: code,
        itemCount: items.length,
        sections: [...new Set(items.map(i => i.section))],
        elements: [...new Set(items.map(i => i.element))]
      }
    })
  } catch (error) {
    console.error('Error syncing Excel:', error)
    res.status(500).json({ success: false, error: 'Error al sincronizar archivo Excel' })
  }
})

/**
 * POST /api/checklist/sync/preview
 * Preview what would be imported from an Excel file without actually importing
 */
router.post('/sync/preview', excelUpload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ success: false, error: 'No se proporcionó un archivo' })
    }

    // Convert to CSV and parse
    let csvContent: string
    try {
      csvContent = convertExcelToCSV(file.path)
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message })
    }

    // Parse the CSV content
    const items = parseCSVContent(csvContent)

    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }

    // Group items by section and element for preview
    const grouped: Record<string, Record<string, string[]>> = {}
    for (const item of items) {
      if (!grouped[item.section]) grouped[item.section] = {}
      if (!grouped[item.section][item.element]) grouped[item.section][item.element] = []
      grouped[item.section][item.element].push(item.activity)
    }

    res.json({
      success: true,
      data: {
        itemCount: items.length,
        sections: Object.keys(grouped),
        elements: [...new Set(items.map(i => i.element))],
        preview: grouped,
        items: items.slice(0, 50) // First 50 items for preview
      }
    })
  } catch (error) {
    console.error('Error previewing Excel:', error)
    res.status(500).json({ success: false, error: 'Error al previsualizar archivo Excel' })
  }
})

/**
 * GET /api/checklist/sync/templates
 * Get all templates with their sync status
 */
router.get('/sync/templates', (req: Request, res: Response) => {
  try {
    const templates = db.prepare(`
      SELECT
        ct.*,
        p.name as plant_name,
        (SELECT COUNT(*) FROM checklist_template_items WHERE template_id = ct.id) as item_count,
        (SELECT COUNT(*) FROM daily_checklists dc
         JOIN daily_checklist_items dci ON dc.id = dci.checklist_id
         WHERE dci.template_item_id IN (SELECT id FROM checklist_template_items WHERE template_id = ct.id)
        ) as usage_count
      FROM checklist_templates ct
      JOIN plants p ON ct.plant_id = p.id
      ORDER BY ct.created_at DESC
    `).all()

    res.json({ success: true, data: templates })
  } catch (error) {
    console.error('Error getting sync templates:', error)
    res.status(500).json({ success: false, error: 'Error al obtener templates' })
  }
})

/**
 * DELETE /api/checklist/sync/template/:templateId
 * Delete a template (only if not used)
 */
router.delete('/sync/template/:templateId', (req: Request, res: Response) => {
  try {
    const { templateId } = req.params
    const { force } = req.query

    // Check if template is in use
    const usage = db.prepare(`
      SELECT COUNT(*) as count FROM daily_checklist_items
      WHERE template_item_id IN (SELECT id FROM checklist_template_items WHERE template_id = ?)
    `).get(templateId) as { count: number }

    if (usage.count > 0 && force !== 'true') {
      return res.status(400).json({
        success: false,
        error: `Este template está siendo usado en ${usage.count} items. Use force=true para eliminar de todas formas.`
      })
    }

    // Delete template and its items
    db.transaction(() => {
      db.prepare('DELETE FROM checklist_template_items WHERE template_id = ?').run(templateId)
      db.prepare('DELETE FROM checklist_templates WHERE id = ?').run(templateId)
    })()

    res.json({ success: true, message: 'Template eliminado' })
  } catch (error) {
    console.error('Error deleting template:', error)
    res.status(500).json({ success: false, error: 'Error al eliminar template' })
  }
})

/**
 * PATCH /api/checklist/sync/template/:templateId/activate
 * Activate or deactivate a template
 */
router.patch('/sync/template/:templateId/activate', (req: Request, res: Response) => {
  try {
    const { templateId } = req.params
    const { active } = req.body

    db.prepare(`
      UPDATE checklist_templates SET is_active = ? WHERE id = ?
    `).run(active ? 1 : 0, templateId)

    res.json({ success: true, message: active ? 'Template activado' : 'Template desactivado' })
  } catch (error) {
    console.error('Error updating template:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar template' })
  }
})

// =====================================================
// MEASUREMENTS API - Integration with Dashboard
// =====================================================

/**
 * GET /api/checklist/operational-measurements
 * Get operational measurements (energy, chemicals, pressure, etc.) for control and deviation detection
 * Water quality parameters (pH, DQO, SS) go to Analytics - this focuses on operational metrics
 */
router.get('/operational-measurements', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string
    const category = req.query.category as string // 'energy', 'chemicals', 'pressure', 'all'

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    // Query for operational measurements (exclude water quality params)
    let query = `
      SELECT
        dci.id,
        dci.checklist_id,
        dci.item_description,
        COALESCE(dci.category, 'general') as category,
        dci.numeric_value,
        dci.unit,
        dci.observation,
        dci.checked_at,
        dc.check_date,
        dc.plant_id,
        dc.operator_name,
        p.name as plant_name,
        -- Categorize operational measurements
        CASE
          WHEN LOWER(dci.item_description) LIKE '%kwh%'
            OR LOWER(dci.item_description) LIKE '%kw/h%'
            OR LOWER(dci.item_description) LIKE '%kw%'
            OR LOWER(dci.item_description) LIKE '%energía%'
            OR LOWER(dci.item_description) LIKE '%energia%'
            OR LOWER(dci.item_description) LIKE '%eléctric%'
            OR LOWER(dci.item_description) LIKE '%electrica%'
            OR LOWER(dci.item_description) LIKE '%consumo%' AND LOWER(COALESCE(dci.unit,'')) LIKE '%kwh%'
            OR LOWER(dci.item_description) LIKE '%voltaje%'
            OR LOWER(dci.item_description) LIKE '%amperaje%'
            OR LOWER(dci.item_description) LIKE '%corriente%'
            OR LOWER(COALESCE(dci.unit,'')) IN ('kwh', 'kw', 'w', 'v', 'a', 'amp')
          THEN 'energy'
          WHEN LOWER(dci.item_description) LIKE '%cloro%'
            OR LOWER(dci.item_description) LIKE '%químic%'
            OR LOWER(dci.item_description) LIKE '%quimic%'
            OR LOWER(dci.item_description) LIKE '%dosificación%'
            OR LOWER(dci.item_description) LIKE '%dosificacion%'
            OR LOWER(dci.item_description) LIKE '%hipoclorito%'
            OR LOWER(dci.item_description) LIKE '%coagulante%'
            OR LOWER(dci.item_description) LIKE '%floculante%'
            OR LOWER(dci.item_description) LIKE '%polímero%'
            OR LOWER(dci.item_description) LIKE '%polimero%'
            OR LOWER(dci.item_description) LIKE '%sulfato%'
            OR LOWER(dci.item_description) LIKE '%cal%'
            OR LOWER(dci.item_description) LIKE '%reactivo%'
            OR LOWER(COALESCE(dci.unit,'')) IN ('l/h', 'ml/min', 'kg/día', 'kg', 'l', 'ml', 'gal', 'ppm')
          THEN 'chemicals'
          WHEN LOWER(dci.item_description) LIKE '%presión%'
            OR LOWER(dci.item_description) LIKE '%presion%'
            OR LOWER(COALESCE(dci.unit,'')) IN ('psi', 'bar', 'kpa', 'mbar')
          THEN 'pressure'
          WHEN LOWER(dci.item_description) LIKE '%caudal%'
            OR LOWER(dci.item_description) LIKE '%flujo%'
            OR LOWER(COALESCE(dci.unit,'')) LIKE '%m³%'
            OR LOWER(COALESCE(dci.unit,'')) LIKE '%l/s%'
            OR LOWER(COALESCE(dci.unit,'')) LIKE '%gpm%'
          THEN 'flow'
          WHEN LOWER(dci.item_description) LIKE '%nivel%'
            OR LOWER(dci.item_description) LIKE '%altura%'
          THEN 'level'
          WHEN LOWER(dci.item_description) LIKE '%hora%'
            OR LOWER(dci.item_description) LIKE '%tiempo%'
            OR LOWER(dci.item_description) LIKE '%operación%'
            OR LOWER(COALESCE(dci.unit,'')) IN ('h', 'hrs', 'horas', 'min')
          THEN 'runtime'
          ELSE 'other'
        END as measurement_category,
        -- Determine equipment/area
        CASE
          WHEN LOWER(dci.item_description) LIKE '%bomba%' THEN 'Bomba'
          WHEN LOWER(dci.item_description) LIKE '%soplador%' OR LOWER(dci.item_description) LIKE '%blower%' THEN 'Soplador'
          WHEN LOWER(dci.item_description) LIKE '%reactor%' THEN 'Reactor'
          WHEN LOWER(dci.item_description) LIKE '%clarificador%' THEN 'Clarificador'
          WHEN LOWER(dci.item_description) LIKE '%filtro%' THEN 'Filtro'
          WHEN LOWER(dci.item_description) LIKE '%tanque%' THEN 'Tanque'
          WHEN LOWER(dci.item_description) LIKE '%motor%' THEN 'Motor'
          WHEN LOWER(dci.item_description) LIKE '%compresor%' THEN 'Compresor'
          ELSE 'General'
        END as equipment_type
      FROM daily_checklist_items dci
      JOIN daily_checklists dc ON dci.checklist_id = dc.id
      JOIN plants p ON dc.plant_id = p.id
      WHERE dci.numeric_value IS NOT NULL
      AND dc.check_date >= ?
      -- Exclude water quality parameters (those go to Analytics)
      AND NOT (
        LOWER(dci.item_description) LIKE '%ph%'
        OR LOWER(dci.item_description) LIKE '%dqo%'
        OR LOWER(dci.item_description) LIKE '%demanda química%'
        OR LOWER(dci.item_description) LIKE '%sólidos suspendidos%'
        OR LOWER(dci.item_description) LIKE '%solidos suspendidos%'
        OR (LOWER(dci.item_description) LIKE '%ss%' AND LOWER(dci.item_description) LIKE '%agua%')
        OR LOWER(dci.item_description) LIKE '%turbidez%'
        OR LOWER(dci.item_description) LIKE '%oxígeno disuelto%'
        OR LOWER(dci.item_description) LIKE '%oxigeno disuelto%'
        OR (LOWER(dci.item_description) LIKE '%temperatura%' AND LOWER(dci.item_description) LIKE '%agua%')
      )
    `
    const params: any[] = [sinceStr]

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY dc.check_date DESC, dci.checked_at DESC'

    const measurements = db.prepare(query).all(...params) as any[]

    // Filter by category if specified
    const filtered = category && category !== 'all'
      ? measurements.filter(m => m.measurement_category === category)
      : measurements

    // Calculate statistics by category
    const statsByCategory: Record<string, any> = {}
    const categories = ['energy', 'chemicals', 'pressure', 'flow', 'level', 'runtime', 'other']

    for (const cat of categories) {
      const catMeasurements = measurements.filter(m => m.measurement_category === cat)
      if (catMeasurements.length > 0) {
        // Group by item_description for detailed stats
        const byDescription: Record<string, any[]> = {}
        for (const m of catMeasurements) {
          const key = m.item_description
          if (!byDescription[key]) byDescription[key] = []
          byDescription[key].push(m)
        }

        const descStats: Record<string, any> = {}
        for (const [desc, items] of Object.entries(byDescription)) {
          const values = items.map(i => i.numeric_value)
          const avg = values.reduce((a, b) => a + b, 0) / values.length
          const min = Math.min(...values)
          const max = Math.max(...values)
          const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length)

          descStats[desc] = {
            count: items.length,
            avg: avg,
            min: min,
            max: max,
            stdDev: stdDev,
            unit: items[0].unit,
            equipment: items[0].equipment_type,
            // Flag anomalies (values > 2 std deviations from mean)
            anomalies: values.filter(v => Math.abs(v - avg) > 2 * stdDev).length
          }
        }

        statsByCategory[cat] = {
          totalMeasurements: catMeasurements.length,
          uniqueMetrics: Object.keys(byDescription).length,
          metrics: descStats
        }
      }
    }

    // Calculate deviation alerts (values that deviate significantly)
    const deviations: any[] = []
    for (const m of measurements) {
      // Find similar measurements to compare
      const similar = measurements.filter(
        other => other.item_description === m.item_description
          && other.plant_id === m.plant_id
          && other.id !== m.id
      )
      if (similar.length >= 3) {
        const values = similar.map(s => s.numeric_value)
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length)

        // If current value deviates by more than 2 std deviations
        if (stdDev > 0 && Math.abs(m.numeric_value - avg) > 2 * stdDev) {
          deviations.push({
            ...m,
            expected_avg: avg,
            expected_stdDev: stdDev,
            deviation_percent: ((m.numeric_value - avg) / avg * 100).toFixed(1),
            severity: Math.abs(m.numeric_value - avg) > 3 * stdDev ? 'critical' : 'warning'
          })
        }
      }
    }

    // Prepare chart data - daily averages by category
    const chartDataByDate: Record<string, Record<string, number[]>> = {}
    for (const m of measurements) {
      const date = m.check_date
      if (!chartDataByDate[date]) chartDataByDate[date] = {}
      if (!chartDataByDate[date][m.measurement_category]) {
        chartDataByDate[date][m.measurement_category] = []
      }
      chartDataByDate[date][m.measurement_category].push(m.numeric_value)
    }

    const chartData = Object.entries(chartDataByDate)
      .map(([date, cats]) => ({
        date,
        ...Object.fromEntries(
          Object.entries(cats).map(([cat, values]) => [
            cat,
            values.reduce((a, b) => a + b, 0) / values.length
          ])
        )
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Group by category for display
    const byCategory: Record<string, any[]> = {}
    for (const cat of categories) {
      byCategory[cat] = measurements.filter(m => m.measurement_category === cat)
    }

    res.json({
      success: true,
      data: {
        measurements: filtered,
        totalCount: filtered.length,
        categories: categories.filter(c => byCategory[c]?.length > 0),
        byCategory,
        stats: statsByCategory,
        deviations: deviations.slice(0, 20), // Top 20 deviations
        chartData,
        summary: {
          totalMeasurements: measurements.length,
          totalDeviations: deviations.length,
          criticalDeviations: deviations.filter(d => d.severity === 'critical').length,
          categoryCounts: Object.fromEntries(
            categories.map(c => [c, byCategory[c]?.length || 0])
          )
        }
      }
    })
  } catch (error) {
    console.error('Error fetching operational measurements:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mediciones operacionales' })
  }
})

/**
 * GET /api/checklist/measurements
 * Get all numeric measurements from checklists for dashboard integration
 * This allows supervisors to see DQO, pH, SS, temperature, etc. from mobile checklist
 */
router.get('/measurements', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30
    const plantId = req.query.plantId as string
    const parameter = req.query.parameter as string // Filter by specific parameter type

    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    let query = `
      SELECT
        dci.id,
        dci.checklist_id,
        dci.item_description,
        COALESCE(dci.category, 'general') as category,
        dci.numeric_value,
        dci.unit,
        dci.observation,
        dci.checked_at,
        dc.check_date,
        dc.plant_id,
        dc.operator_name,
        p.name as plant_name,
        -- Infer parameter type from description/unit
        CASE
          WHEN LOWER(dci.item_description) LIKE '%ph%' OR LOWER(COALESCE(dci.unit,'')) LIKE '%ph%' THEN 'pH'
          WHEN LOWER(dci.item_description) LIKE '%dqo%' OR LOWER(dci.item_description) LIKE '%demanda química%' THEN 'DQO'
          WHEN LOWER(dci.item_description) LIKE '%sólidos%' OR LOWER(dci.item_description) LIKE '%ss%' THEN 'SS'
          WHEN LOWER(dci.item_description) LIKE '%temperatura%' OR LOWER(COALESCE(dci.unit,'')) = '°c' THEN 'Temperatura'
          WHEN LOWER(dci.item_description) LIKE '%oxígeno%' OR LOWER(dci.item_description) LIKE '%od%' THEN 'Oxígeno Disuelto'
          WHEN LOWER(dci.item_description) LIKE '%caudal%' OR LOWER(COALESCE(dci.unit,'')) LIKE '%m³%' THEN 'Caudal'
          WHEN LOWER(dci.item_description) LIKE '%presión%' OR LOWER(COALESCE(dci.unit,'')) = 'bar' THEN 'Presión'
          WHEN LOWER(dci.item_description) LIKE '%nivel%' AND LOWER(COALESCE(dci.unit,'')) = '%' THEN 'Nivel'
          WHEN LOWER(dci.item_description) LIKE '%lodo%' THEN 'Lodos'
          WHEN LOWER(dci.item_description) LIKE '%kwh%' OR LOWER(dci.item_description) LIKE '%eléctrico%' THEN 'Consumo Eléctrico'
          ELSE 'Otro'
        END as parameter_type,
        -- Infer stream (influent/effluent)
        CASE
          WHEN LOWER(dci.item_description) LIKE '%entrada%' OR LOWER(dci.item_description) LIKE '%afluente%' OR LOWER(dci.item_description) LIKE '%influente%' THEN 'influent'
          WHEN LOWER(dci.item_description) LIKE '%salida%' OR LOWER(dci.item_description) LIKE '%efluente%' THEN 'effluent'
          ELSE NULL
        END as stream
      FROM daily_checklist_items dci
      JOIN daily_checklists dc ON dci.checklist_id = dc.id
      JOIN plants p ON dc.plant_id = p.id
      WHERE dci.numeric_value IS NOT NULL
      AND dc.check_date >= ?
    `
    const params: any[] = [sinceStr]

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY dc.check_date DESC, p.name'

    let measurements = db.prepare(query).all(...params) as any[]

    // Filter by parameter if specified
    if (parameter) {
      const paramLower = parameter.toLowerCase()
      measurements = measurements.filter(m => {
        const typeMatch = m.parameter_type.toLowerCase().includes(paramLower) ||
          paramLower.includes(m.parameter_type.toLowerCase())
        return typeMatch
      })
    }

    // Group measurements by parameter type for summary
    const byParameter: Record<string, any[]> = {}
    for (const m of measurements) {
      if (!byParameter[m.parameter_type]) byParameter[m.parameter_type] = []
      byParameter[m.parameter_type].push(m)
    }

    // Calculate statistics per parameter
    const stats: Record<string, { count: number; avg: number; min: number; max: number; unit: string }> = {}
    for (const [paramType, values] of Object.entries(byParameter)) {
      const nums = values.map(v => v.numeric_value).filter(v => v !== null)
      if (nums.length > 0) {
        stats[paramType] = {
          count: nums.length,
          avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          unit: values[0]?.unit || ''
        }
      }
    }

    // Get daily trends for charting
    const dailyTrend: Record<string, Record<string, number[]>> = {}
    for (const m of measurements) {
      const date = m.check_date
      if (!dailyTrend[date]) dailyTrend[date] = {}
      if (!dailyTrend[date][m.parameter_type]) dailyTrend[date][m.parameter_type] = []
      dailyTrend[date][m.parameter_type].push(m.numeric_value)
    }

    // Average daily values
    const chartData = Object.entries(dailyTrend).map(([date, params]) => {
      const row: any = { date }
      for (const [param, values] of Object.entries(params)) {
        row[param] = values.reduce((a, b) => a + b, 0) / values.length
      }
      return row
    }).sort((a, b) => a.date.localeCompare(b.date))

    res.json({
      success: true,
      data: {
        measurements,
        byParameter,
        stats,
        chartData,
        parameterTypes: Object.keys(byParameter)
      }
    })
  } catch (error) {
    console.error('Error getting measurements:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mediciones' })
  }
})

/**
 * GET /api/checklist/measurements/latest
 * Get the most recent measurements for dashboard widgets
 */
router.get('/measurements/latest', (req: Request, res: Response) => {
  try {
    const plantId = req.query.plantId as string

    let query = `
      SELECT
        dci.numeric_value,
        dci.unit,
        dci.item_description,
        COALESCE(dci.category, 'general') as category,
        dci.checked_at,
        dc.check_date,
        dc.plant_id,
        dc.operator_name,
        p.name as plant_name,
        CASE
          WHEN LOWER(dci.item_description) LIKE '%ph%' OR LOWER(COALESCE(dci.unit,'')) LIKE '%ph%' THEN 'pH'
          WHEN LOWER(dci.item_description) LIKE '%dqo%' THEN 'DQO'
          WHEN LOWER(dci.item_description) LIKE '%sólidos%' OR LOWER(dci.item_description) LIKE '%ss%' THEN 'SS'
          WHEN LOWER(dci.item_description) LIKE '%temperatura%' OR LOWER(COALESCE(dci.unit,'')) = '°c' THEN 'Temperatura'
          WHEN LOWER(dci.item_description) LIKE '%oxígeno%' THEN 'OD'
          WHEN LOWER(dci.item_description) LIKE '%caudal%' THEN 'Caudal'
          ELSE 'Otro'
        END as parameter_type,
        CASE
          WHEN LOWER(dci.item_description) LIKE '%entrada%' OR LOWER(dci.item_description) LIKE '%afluente%' THEN 'Entrada'
          WHEN LOWER(dci.item_description) LIKE '%salida%' OR LOWER(dci.item_description) LIKE '%efluente%' THEN 'Salida'
          ELSE ''
        END as stream_label
      FROM daily_checklist_items dci
      JOIN daily_checklists dc ON dci.checklist_id = dc.id
      JOIN plants p ON dc.plant_id = p.id
      WHERE dci.numeric_value IS NOT NULL
    `
    const params: any[] = []

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += `
      ORDER BY dc.check_date DESC, dci.checked_at DESC
      LIMIT 100
    `

    const latest = db.prepare(query).all(...params)

    // Group by plant and parameter for easy dashboard consumption
    const byPlant: Record<string, any[]> = {}
    for (const m of latest as any[]) {
      if (!byPlant[m.plant_name]) byPlant[m.plant_name] = []
      byPlant[m.plant_name].push(m)
    }

    res.json({
      success: true,
      data: {
        latest,
        byPlant
      }
    })
  } catch (error) {
    console.error('Error getting latest measurements:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mediciones recientes' })
  }
})

/**
 * GET /api/checklist/measurements/sync-to-analytics
 * Export checklist measurements to analytics format
 * Allows data from mobile checklist to be used in the main analytics dashboard
 */
router.get('/measurements/sync-to-analytics', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]

    // Get measurements that can be mapped to analytics parameters
    const measurements = db.prepare(`
      SELECT
        dci.numeric_value as value,
        dci.unit,
        dc.check_date as measurement_date,
        dc.plant_id,
        p.name as plant_name,
        CASE
          WHEN LOWER(dci.item_description) LIKE '%ph%' THEN 'pH'
          WHEN LOWER(dci.item_description) LIKE '%dqo%' THEN 'DQO'
          WHEN LOWER(dci.item_description) LIKE '%sólidos%' OR LOWER(dci.item_description) LIKE '%ss%' THEN 'SS'
          ELSE NULL
        END as parameter_type,
        CASE
          WHEN LOWER(dci.item_description) LIKE '%entrada%' OR LOWER(dci.item_description) LIKE '%afluente%' THEN 'influent'
          WHEN LOWER(dci.item_description) LIKE '%salida%' OR LOWER(dci.item_description) LIKE '%efluente%' THEN 'effluent'
          ELSE NULL
        END as stream
      FROM daily_checklist_items dci
      JOIN daily_checklists dc ON dci.checklist_id = dc.id
      JOIN plants p ON dc.plant_id = p.id
      WHERE dci.numeric_value IS NOT NULL
      AND dc.check_date >= ?
      AND (
        LOWER(dci.item_description) LIKE '%ph%'
        OR LOWER(dci.item_description) LIKE '%dqo%'
        OR LOWER(dci.item_description) LIKE '%sólidos%'
        OR LOWER(dci.item_description) LIKE '%ss%'
      )
      ORDER BY dc.check_date, p.name
    `).all(sinceStr) as any[]

    // Format for analytics import
    const analyticsFormat = measurements
      .filter(m => m.parameter_type !== null)
      .map(m => ({
        plant_id: m.plant_id,
        plant_name: m.plant_name,
        parameter_type: m.parameter_type,
        measurement_date: m.measurement_date,
        value: m.value,
        unit: m.unit || (m.parameter_type === 'pH' ? 'pH' : 'mg/L'),
        stream: m.stream,
        source: 'checklist_mobile'
      }))

    res.json({
      success: true,
      data: {
        count: analyticsFormat.length,
        measurements: analyticsFormat
      }
    })
  } catch (error) {
    console.error('Error syncing measurements:', error)
    res.status(500).json({ success: false, error: 'Error al sincronizar mediciones' })
  }
})

// =====================================================
// GENERIC CHECKLIST ROUTE - MUST BE LAST
// =====================================================

/**
 * GET /api/checklist/:checklistId
 * Get a specific checklist with all its items
 * NOTE: This route MUST be defined last because it catches all paths
 */
router.get('/:checklistId', (req: Request, res: Response) => {
  try {
    const { checklistId } = req.params

    // Get checklist info
    const checklist = db.prepare(`
      SELECT dc.*, p.name as plant_name, p.location as plant_location
      FROM daily_checklists dc
      JOIN plants p ON dc.plant_id = p.id
      WHERE dc.id = ?
    `).get(checklistId) as any

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist no encontrado' })
    }

    // Get all items
    const items = db.prepare(`
      SELECT * FROM daily_checklist_items
      WHERE checklist_id = ?
      ORDER BY section, id
    `).all(checklistId)

    // Group by section
    const grouped: Record<string, any[]> = {}
    for (const item of items as any[]) {
      const section = item.section || 'general'
      if (!grouped[section]) grouped[section] = []
      grouped[section].push(item)
    }

    // Calculate stats
    const total = (items as any[]).length
    const checked = (items as any[]).filter((i: any) => i.is_checked).length
    const redFlags = (items as any[]).filter((i: any) => i.is_red_flag).length
    const progress = total > 0 ? Math.round((checked / total) * 100) : 0

    res.json({
      success: true,
      data: {
        checklist,
        items: grouped,
        allItems: items,
        stats: {
          total,
          checked,
          redFlags,
          progress
        }
      }
    })
  } catch (error) {
    console.error('Error getting checklist:', error)
    res.status(500).json({ success: false, error: 'Error al obtener checklist' })
  }
})

export default router
