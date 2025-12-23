import { Router, type Request, type Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { equipmentDAL, equipmentMaintenanceLogDAL, equipmentScheduledMaintenanceDAL } from '../lib/dal.js'

const router = Router()

// GET /api/equipment - Get all equipment (optionally filter by plant)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { plantId, category, search } = req.query as Record<string, string>

  try {
    const data = equipmentDAL.getAll({ plantId, category, search })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/equipment/plant/:plantId - Get equipment for a specific plant
router.get('/plant/:plantId', requireAuth, async (req: Request, res: Response) => {
  const { plantId } = req.params

  try {
    const data = equipmentDAL.getByPlant(plantId)
    const categories = equipmentDAL.getCategories(plantId)
    res.json({ success: true, data, categories })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/equipment/:id - Get equipment by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const equipment = equipmentDAL.getById(id)
    if (!equipment) {
      return res.status(404).json({ success: false, error: 'Equipment not found' })
    }
    res.json({ success: true, data: equipment })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/equipment - Create new equipment (admin only)
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const {
    plantId, itemCode, description, reference, location, quantity, category,
    dailyCheck, monthlyCheck, quarterlyCheck, biannualCheck, annualCheck,
    timeBasedReference, spareParts, extras
  } = req.body

  if (!plantId || !itemCode || !description) {
    return res.status(400).json({ success: false, error: 'plantId, itemCode, and description are required' })
  }

  try {
    const equipment = equipmentDAL.create({
      plantId, itemCode, description, reference, location, quantity, category,
      dailyCheck, monthlyCheck, quarterlyCheck, biannualCheck, annualCheck,
      timeBasedReference, spareParts, extras
    })
    res.status(201).json({ success: true, data: equipment })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// PUT /api/equipment/:id - Update equipment (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = equipmentDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Equipment not found' })
    }

    const updated = equipmentDAL.update(id, req.body)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// DELETE /api/equipment/:id - Delete equipment (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = equipmentDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Equipment not found' })
    }

    equipmentDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// ===== Maintenance Log Routes =====

// GET /api/equipment/:equipmentId/logs - Get maintenance logs for equipment
router.get('/:equipmentId/logs', requireAuth, async (req: Request, res: Response) => {
  const { equipmentId } = req.params
  const { maintenanceType, startDate, endDate } = req.query as Record<string, string>

  try {
    const data = equipmentMaintenanceLogDAL.getAll({ equipmentId, maintenanceType, startDate, endDate })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/equipment/:equipmentId/logs - Create maintenance log entry
router.post('/:equipmentId/logs', requireAuth, async (req: Request, res: Response) => {
  const { equipmentId } = req.params
  const {
    maintenanceType, operation, maintenanceDate,
    descriptionAveria, descriptionRealizado,
    nextMaintenanceDate, operatorName, responsibleName
  } = req.body

  if (!maintenanceType || !operation || !maintenanceDate) {
    return res.status(400).json({ success: false, error: 'maintenanceType, operation, and maintenanceDate are required' })
  }

  // Validate equipment exists
  const equipment = equipmentDAL.getById(equipmentId)
  if (!equipment) {
    return res.status(404).json({ success: false, error: 'Equipment not found' })
  }

  try {
    const log = equipmentMaintenanceLogDAL.create({
      equipmentId,
      maintenanceType,
      operation,
      maintenanceDate,
      descriptionAveria,
      descriptionRealizado,
      nextMaintenanceDate,
      operatorName,
      responsibleName
    })
    res.status(201).json({ success: true, data: log })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// GET /api/equipment/logs/:logId - Get specific log entry
router.get('/logs/:logId', requireAuth, async (req: Request, res: Response) => {
  const { logId } = req.params

  try {
    const log = equipmentMaintenanceLogDAL.getById(logId)
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log entry not found' })
    }
    res.json({ success: true, data: log })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// PUT /api/equipment/logs/:logId - Update log entry
router.put('/logs/:logId', requireAuth, async (req: Request, res: Response) => {
  const { logId } = req.params

  try {
    const existing = equipmentMaintenanceLogDAL.getById(logId)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Log entry not found' })
    }

    const updated = equipmentMaintenanceLogDAL.update(logId, req.body)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// DELETE /api/equipment/logs/:logId - Delete log entry
router.delete('/logs/:logId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { logId } = req.params

  try {
    const existing = equipmentMaintenanceLogDAL.getById(logId)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Log entry not found' })
    }

    equipmentMaintenanceLogDAL.delete(logId)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// ===== Scheduled Maintenance Routes =====

// GET /api/equipment/scheduled/plant/:plantId/:year - Get scheduled maintenance for plant and year
router.get('/scheduled/plant/:plantId/:year', requireAuth, async (req: Request, res: Response) => {
  const { plantId, year } = req.params

  try {
    // Update overdue statuses first
    equipmentScheduledMaintenanceDAL.updateOverdueStatus()
    const data = equipmentScheduledMaintenanceDAL.getByPlantAndYear(plantId, parseInt(year))
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/equipment/scheduled/generate/:plantId/:year - Generate year plan for all equipment in plant
router.post('/scheduled/generate/:plantId/:year', requireAuth, async (req: Request, res: Response) => {
  const { plantId, year } = req.params

  try {
    const equipment = equipmentDAL.getByPlant(plantId) as any[]
    const allTasks: any[] = []

    equipment.forEach((eq: any) => {
      const tasks = equipmentScheduledMaintenanceDAL.generateYearPlan(eq.id, parseInt(year))
      allTasks.push(...tasks)
    })

    res.json({ success: true, data: allTasks, generated: allTasks.length })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// PUT /api/equipment/scheduled/:id/complete - Mark task as completed
router.put('/scheduled/:id/complete', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const { completedDate, completedBy, notes } = req.body

  try {
    const existing = equipmentScheduledMaintenanceDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' })
    }

    const updated = equipmentScheduledMaintenanceDAL.markCompleted(
      id,
      completedDate || new Date().toISOString().slice(0, 10),
      completedBy,
      notes
    )
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// PUT /api/equipment/scheduled/:id/pending - Mark task as pending (undo completion)
router.put('/scheduled/:id/pending', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = equipmentScheduledMaintenanceDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' })
    }

    const updated = equipmentScheduledMaintenanceDAL.markPending(id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// GET /api/equipment/scheduled/:equipmentId/:year - Get scheduled tasks for specific equipment
router.get('/scheduled/:equipmentId/:year', requireAuth, async (req: Request, res: Response) => {
  const { equipmentId, year } = req.params

  try {
    equipmentScheduledMaintenanceDAL.updateOverdueStatus()
    const data = equipmentScheduledMaintenanceDAL.getByEquipmentAndYear(equipmentId, parseInt(year))
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// DELETE /api/equipment/scheduled/:id - Delete scheduled task
router.delete('/scheduled/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = equipmentScheduledMaintenanceDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' })
    }

    equipmentScheduledMaintenanceDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
