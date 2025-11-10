import { Router, type Request, type Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { writeLimiter } from '../middleware/rateLimit.js'
import { body, validationResult } from 'express-validator'
import { maintenanceTasksDAL, emergenciesDAL, plantsDAL } from '../lib/dal.js'

const router = Router()

// GET /api/maintenance/tasks
router.get('/tasks', async (req: Request, res: Response) => {
  const { plantId, status, type, from, to } = (req.query || {}) as Record<string, string>

  try {
    const data = maintenanceTasksDAL.getAll({
      plantId,
      status,
      from,
      to
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/tasks (admin only)
router.post(
  '/tasks',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('type').isIn(['preventive', 'corrective', 'general']),
    body('scheduledDate').isISO8601(),
    body('description').isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, type, scheduledDate, description } = req.body
    try {
      const data = maintenanceTasksDAL.create({
        plantId,
        taskType: type,
        scheduledDate,
        description
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// POST /api/maintenance/tasks/generate-monthly (admin only)
router.post(
  '/tasks/generate-monthly',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [body('year').optional().isInt({ min: 2000, max: 2100 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const year = Number((req.body?.year ?? new Date().getFullYear()))

    try {
      // Get all plants
      const plants = plantsDAL.getAll()
      const plantIds: string[] = Array.isArray(plants) ? plants.map((p: any) => p.id) : []

      if (plantIds.length === 0) {
        return res.status(200).json({ success: true, inserted: 0, message: 'No plants found' })
      }

      // Check existing tasks for the year
      const start = new Date(year, 0, 1).toISOString()
      const end = new Date(year, 11, 31, 23, 59, 59, 999).toISOString()
      const existing = maintenanceTasksDAL.getAll({ from: start, to: end })

      const existingKeys = new Set<string>((existing || []).map((r: any) => `${r.plant_id}|${r.scheduled_date.slice(0,10)}`))
      const plantsWithAnyTask = new Set<string>((existing || []).map((r: any) => r.plant_id))

      const toInsert: any[] = []
      plantIds.forEach(pid => {
        // Insert one task per plant if none exists for the year
        if (!plantsWithAnyTask.has(pid)) {
          toInsert.push({
            plantId: pid,
            taskType: 'general',
            description: 'Mantenimiento completo',
            scheduledDate: new Date(year, 6, 1).toISOString(),
            status: 'pending',
          })
        }
      })

      if (toInsert.length === 0) {
        return res.status(200).json({ success: true, inserted: 0, message: 'No new tasks to insert' })
      }

      const insData = toInsert.map(task => maintenanceTasksDAL.create(task))
      res.status(201).json({ success: true, inserted: insData.length, data: insData })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// PATCH /api/maintenance/tasks/:id - update status and completed date
router.patch(
  '/tasks/:id',
  requireAuth,
  writeLimiter,
  [
    body('status').optional().isIn(['pending', 'completed', 'overdue']),
    body('completedDate').optional().isISO8601(),
    body('scheduledDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })
    const id = req.params.id
    const { status, completedDate, scheduledDate } = req.body as { status?: string; completedDate?: string; scheduledDate?: string }
    const user = (req as any).user

    // Only admin can edit scheduled date
    if (typeof scheduledDate !== 'undefined' && (!user || user.role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden: only admin can edit scheduledDate' })
    }

    try {
      const data = maintenanceTasksDAL.update(id, {
        status,
        completedDate: typeof completedDate !== 'undefined' ? completedDate || undefined : undefined,
        scheduledDate
      })
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// DELETE /api/maintenance/tasks/:id (admin only)
router.delete('/tasks/:id', requireAuth, requireAdmin, writeLimiter, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    maintenanceTasksDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// --- Emergencies endpoints ---

// GET /api/maintenance/emergencies
router.get('/emergencies', async (req: Request, res: Response) => {
  const { plantId, solved, severity, from, to, sortBy = 'reported_at', order = 'desc' } = (req.query || {}) as Record<string, string>

  try {
    const data = emergenciesDAL.getAll({
      plantId,
      solved: typeof solved !== 'undefined' ? solved === 'true' : undefined,
      severity,
      from,
      to,
      sortBy,
      order
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/emergencies (admin only)
router.post(
  '/emergencies',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('reason').isString(),
    body('solved').optional().isBoolean(),
    body('resolveTimeHours').optional().isInt({ min: 0 }),
    body('reportedAt').optional().isISO8601(),
    body('severity').optional().isIn(['low', 'medium', 'high']),
    body('resolvedAt').optional().isISO8601(),
    body('observations').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { plantId, reason, solved = false, resolveTimeHours = null, reportedAt, severity, resolvedAt, observations } = req.body

    try {
      const data = emergenciesDAL.create({
        plantId,
        reason,
        solved,
        resolveTimeHours,
        reportedAt,
        severity,
        observations
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// PATCH /api/maintenance/emergencies/:id (admin only)
router.patch(
  '/emergencies/:id',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').optional().isString(),
    body('reason').optional().isString(),
    body('solved').optional().isBoolean(),
    body('resolveTimeHours').optional().isInt({ min: 0 }),
    body('severity').optional().isIn(['low', 'medium', 'high']),
    body('resolvedAt').optional().isISO8601(),
    body('observations').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const id = req.params.id
    const { plantId, reason, solved, resolveTimeHours, severity, resolvedAt, observations } = req.body

    try {
      const data = emergenciesDAL.update(id, {
        plantId,
        reason,
        solved,
        resolveTimeHours,
        severity,
        resolvedAt,
        observations
      })
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// DELETE /api/maintenance/emergencies/:id (admin only)
router.delete('/emergencies/:id', requireAuth, requireAdmin, writeLimiter, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    emergenciesDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// GET /api/maintenance/stats - aggregated tasks and emergencies
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const { plantId } = (req.query || {}) as Record<string, string>

  try {
    const tasks = maintenanceTasksDAL.getAll({ plantId, status: 'pending' })
    const emergencies = emergenciesDAL.getAll({ plantId, solved: false })

    const byPlant: Record<string, { pendingTasks: number; unresolvedEmergencies: number }> = {}
    tasks.forEach((r: any) => {
      const pid = r.plant_id || 'unknown'
      byPlant[pid] = byPlant[pid] || { pendingTasks: 0, unresolvedEmergencies: 0 }
      byPlant[pid].pendingTasks++
    })

    emergencies.forEach((r: any) => {
      const pid = r.plant_id || 'unknown'
      byPlant[pid] = byPlant[pid] || { pendingTasks: 0, unresolvedEmergencies: 0 }
      byPlant[pid].unresolvedEmergencies++
    })

    const summary = {
      pendingTasks: tasks.length,
      unresolvedEmergencies: emergencies.length,
      byPlant: plantId ? undefined : byPlant,
    }
    res.json({ success: true, summary })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
