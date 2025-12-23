import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { writeLimiter } from '../middleware/rateLimit.js'
import { body, validationResult } from 'express-validator'
import { maintenanceTasksDAL, emergenciesDAL, plantsDAL } from '../lib/dal.js'
import { db } from '../lib/database.js'
import { emailService } from '../services/emailService.js'

const router = Router()

// GET /api/maintenance/tasks (authenticated users)
router.get('/tasks', requireAuth, async (req: Request, res: Response) => {
  const { plantId, status, periodicity, year, from, to } = (req.query || {}) as Record<string, string>

  try {
    const data = maintenanceTasksDAL.getAll({
      plantId,
      status,
      periodicity,
      year: year ? parseInt(year) : undefined,
      from,
      to
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/maintenance/tasks/history - Get completed tasks history with filters
router.get('/tasks/history', requireAuth, async (req: Request, res: Response) => {
  const { plantId, periodicity, year, from, to } = (req.query || {}) as Record<string, string>

  try {
    const data = maintenanceTasksDAL.getHistory({
      plantId,
      periodicity,
      year: year ? parseInt(year) : undefined,
      from,
      to
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/maintenance/tasks/daily - Get daily maintenance tasks for checklist
router.get('/tasks/daily', requireAuth, async (req: Request, res: Response) => {
  const { plantId } = (req.query || {}) as Record<string, string>

  try {
    const data = maintenanceTasksDAL.getDailyTasks(plantId)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/maintenance/tasks/pending-reminders - Get tasks that need reminder emails
router.get('/tasks/pending-reminders', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const data = maintenanceTasksDAL.getPendingReminders()
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
    body('periodicity').optional().isIn(['daily', 'monthly', 'quarterly', 'annual']),
    body('vendorName').optional().isString(),
    body('estimatedCost').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, type, scheduledDate, description, periodicity, vendorName, estimatedCost, notes } = req.body
    try {
      const data = maintenanceTasksDAL.create({
        plantId,
        taskType: type,
        scheduledDate,
        description,
        periodicity: periodicity || 'annual',
        vendorName,
        estimatedCost,
        notes
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
    body('periodicity').optional().isIn(['daily', 'monthly', 'quarterly', 'annual']),
    body('vendorName').optional().isString(),
    body('estimatedCost').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    body('description').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })
    const id = req.params.id
    const { status, completedDate, scheduledDate, periodicity, vendorName, estimatedCost, notes, description } = req.body
    const user = (req as any).user

    // Only admin can edit scheduled date, periodicity, vendor, cost
    const adminOnlyFields = [scheduledDate, periodicity, vendorName, estimatedCost, description]
    if (adminOnlyFields.some(f => typeof f !== 'undefined') && (!user || user.role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Forbidden: only admin can edit these fields' })
    }

    try {
      const updateData: any = {}
      if (status !== undefined) updateData.status = status
      if (completedDate !== undefined) updateData.completedDate = completedDate || null
      if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate
      if (periodicity !== undefined) updateData.periodicity = periodicity
      if (vendorName !== undefined) updateData.vendorName = vendorName
      if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost
      if (notes !== undefined) updateData.notes = notes
      if (description !== undefined) updateData.description = description

      // If marking as completed, set completedBy
      if (status === 'completed') {
        updateData.completedBy = user?.name || user?.email || 'Usuario'
        if (!updateData.completedDate) {
          updateData.completedDate = new Date().toISOString()
        }
      }

      const data = maintenanceTasksDAL.update(id, updateData)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// POST /api/maintenance/tasks/:id/complete - Mark a task as completed (simplified endpoint)
router.post(
  '/tasks/:id/complete',
  requireAuth,
  writeLimiter,
  [body('notes').optional().isString()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })

    const id = req.params.id
    const { notes } = req.body
    const user = (req as any).user

    try {
      const data = maintenanceTasksDAL.update(id, {
        status: 'completed',
        completedDate: new Date().toISOString(),
        completedBy: user?.name || user?.email || 'Usuario',
        notes
      })
      res.json({ success: true, data, message: 'Mantenimiento marcado como completado' })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// POST /api/maintenance/tasks/:id/uncomplete - Revert a task to pending (admin only)
router.post(
  '/tasks/:id/uncomplete',
  requireAuth,
  requireAdmin,
  writeLimiter,
  async (req: Request, res: Response) => {
    const id = req.params.id

    try {
      const data = maintenanceTasksDAL.update(id, {
        status: 'pending',
        completedDate: '',
        completedBy: ''
      })
      res.json({ success: true, data, message: 'Mantenimiento revertido a pendiente' })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// POST /api/maintenance/tasks/send-reminders - Send reminder emails for tasks due in 30 days
router.post(
  '/tasks/send-reminders',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const pendingTasks = maintenanceTasksDAL.getPendingReminders() as any[]
      const recipients = process.env.MAINTENANCE_REMINDER_EMAILS || process.env.ADMIN_EMAIL || ''

      if (!recipients) {
        return res.status(400).json({ success: false, error: 'No hay destinatarios configurados para recordatorios' })
      }

      let sentCount = 0
      for (const task of pendingTasks) {
        try {
          await emailService.sendMaintenanceReminder(
            recipients.split(',').map((e: string) => e.trim()),
            {
              plantName: task.plant_name,
              taskDescription: task.description,
              scheduledDate: task.scheduled_date,
              periodicity: task.periodicity,
              vendorName: task.vendor_name,
              estimatedCost: task.estimated_cost
            }
          )
          maintenanceTasksDAL.markReminderSent(task.id)
          sentCount++
        } catch (emailError) {
          console.error(`Failed to send reminder for task ${task.id}:`, emailError)
        }
      }

      res.json({
        success: true,
        message: `Se enviaron ${sentCount} recordatorios de ${pendingTasks.length} tareas pendientes`
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
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

// GET /api/maintenance/emergencies (authenticated users)
// No-cache headers to ensure real-time updates from mobile app
// Admins see all; supervisors/operators see only their assigned plant
router.get('/emergencies', requireAuth, async (req: Request, res: Response) => {
  const { plantId, solved, severity, from, to, sortBy = 'reported_at', order = 'desc' } = (req.query || {}) as Record<string, string>
  const user = (req as any).user

  // Disable caching for real-time emergency updates
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  })

  try {
    // Use user's plantId if they are restricted, otherwise use query param
    const effectivePlantId = (user && user.plantId && user.role !== 'admin') ? user.plantId : plantId

    const data = emergenciesDAL.getAll({
      plantId: effectivePlantId,
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

// GET /api/maintenance/emergencies/unacknowledged - Get unacknowledged emergencies (real-time updates)
// Admins see all; supervisors/operators see only their assigned plant
router.get('/emergencies/unacknowledged', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user

  // Disable caching for real-time updates
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })

  try {
    let data = emergenciesDAL.getUnacknowledged()

    // Filter by plantId for non-admin users
    if (user && user.plantId && user.role !== 'admin') {
      data = data.filter((e: any) => e.plant_id === user.plantId)
    }

    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/emergencies/report - For operators to report emergencies (no admin required)
// This is the mobile app endpoint that sends email notifications
// Operators can only report for their assigned plant; admins can report for any plant
router.post(
  '/emergencies/report',
  requireAuth,
  writeLimiter,
  [
    body('plantId').isString().notEmpty(),
    body('reason').isString().notEmpty(),
    body('severity').isIn(['low', 'medium', 'high']),
    body('operatorName').isString().notEmpty(),
    body('operatorId').optional().isString(),
    body('locationDescription').optional().isString(),
    body('observations').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const user = (req as any).user
    const { plantId, reason, severity, operatorName, operatorId, locationDescription, observations } = req.body

    // Validate plant access for non-admin users
    if (user && user.plantId && user.role !== 'admin' && user.plantId !== plantId) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permiso para reportar emergencias de esta planta'
      })
    }

    try {
      // Get plant name for email
      const plant = plantsDAL.getById(plantId) as any
      if (!plant) {
        return res.status(404).json({ success: false, error: 'Planta no encontrada' })
      }

      // Create the emergency
      const emergency = emergenciesDAL.create({
        plantId,
        reason,
        severity,
        observations,
        operatorId,
        operatorName,
        locationDescription,
        source: 'mobile'
      }) as any

      // Send email notification asynchronously
      const { emailService } = await import('../services/emailService.js')
      const emailRecipients = process.env.EMERGENCY_EMAIL_RECIPIENTS || process.env.ADMIN_EMAIL || ''

      if (emailRecipients) {
        try {
          const sent = await emailService.sendEmergencyAlert(
            emailRecipients.split(',').map(e => e.trim()),
            {
              plantName: plant.name,
              reason: reason,
              severity: severity,
              reportedAt: emergency.reported_at
            }
          )
          if (sent) {
            emergenciesDAL.markEmailSent(emergency.id)
            console.log(`🚨 Emergency email sent for ${plant.name}: ${reason}`)
          }
        } catch (emailError) {
          console.error('Failed to send emergency email:', emailError)
          // Don't fail the request if email fails
        }
      }

      res.status(201).json({
        success: true,
        data: emergency,
        message: 'Emergencia reportada exitosamente'
      })
    } catch (error: any) {
      console.error('Error creating emergency:', error)
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// POST /api/maintenance/emergencies/:id/acknowledge - Acknowledge an emergency
router.post(
  '/emergencies/:id/acknowledge',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params
    const user = (req as any).user

    try {
      const data = emergenciesDAL.acknowledge(id, user?.name || user?.email || 'Admin')
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

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
    body('resolvedBy').optional().isString(),
    body('observations').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const id = req.params.id
    const { plantId, reason, solved, resolveTimeHours, severity, resolvedAt, resolvedBy, observations } = req.body

    try {
      const data = emergenciesDAL.update(id, {
        plantId,
        reason,
        solved,
        resolveTimeHours,
        severity,
        resolvedAt,
        resolvedBy,
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

// ============================================
// EMERGENCY TASKS (Todo list for emergencies)
// ============================================

// GET /api/maintenance/emergencies/:emergencyId/tasks - Get all tasks for an emergency
router.get('/emergencies/:emergencyId/tasks', requireAuth, async (req: Request, res: Response) => {
  const { emergencyId } = req.params
  try {
    const tasks = db.prepare(`
      SELECT * FROM emergency_tasks
      WHERE emergency_id = ?
      ORDER BY
        CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        due_date ASC NULLS LAST,
        created_at DESC
    `).all(emergencyId)
    res.json({ success: true, data: tasks })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/emergencies/:emergencyId/tasks - Create a new task
router.post(
  '/emergencies/:emergencyId/tasks',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('title').isString().notEmpty(),
    body('description').optional().isString(),
    body('assignedToEmail').optional().isEmail(),
    body('assignedToName').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('dueDate').optional().isISO8601(),
    body('reminderDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { emergencyId } = req.params
    const { title, description, assignedToEmail, assignedToName, priority, dueDate, reminderDate } = req.body
    const user = (req as any).user

    try {
      // Verify emergency exists
      const emergency = db.prepare('SELECT * FROM maintenance_emergencies WHERE id = ?').get(emergencyId) as any
      if (!emergency) {
        return res.status(404).json({ success: false, error: 'Emergencia no encontrada' })
      }

      const taskId = randomUUID()
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO emergency_tasks (
          id, emergency_id, title, description, assigned_to_email, assigned_to_name,
          priority, due_date, reminder_date, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId, emergencyId, title, description || null,
        assignedToEmail || null, assignedToName || null,
        priority || 'medium', dueDate || null, reminderDate || null,
        user?.name || 'Admin', now, now
      )

      // Send email if assigned to someone
      if (assignedToEmail) {
        const plant = db.prepare('SELECT name FROM plants WHERE id = ?').get(emergency.plant_id) as any
        await emailService.sendTaskAssignment(assignedToEmail, {
          taskTitle: title,
          taskDescription: description || '',
          emergencyReason: emergency.reason,
          plantName: plant?.name || 'Planta',
          assignedBy: user?.name || 'Administrador',
          dueDate: dueDate || null,
          priority: priority || 'medium',
        })

        // Update email_sent_at
        db.prepare('UPDATE emergency_tasks SET email_sent_at = ? WHERE id = ?').run(now, taskId)
      }

      const task = db.prepare('SELECT * FROM emergency_tasks WHERE id = ?').get(taskId)
      res.status(201).json({ success: true, data: task })
    } catch (error: any) {
      console.error('Error creating emergency task:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// PATCH /api/maintenance/emergency-tasks/:taskId - Update a task
router.patch(
  '/emergency-tasks/:taskId',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('assignedToEmail').optional().isEmail(),
    body('assignedToName').optional().isString(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
    body('dueDate').optional().isISO8601(),
    body('reminderDate').optional().isISO8601(),
    body('notes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { taskId } = req.params
    const updates = req.body
    const user = (req as any).user

    try {
      const existingTask = db.prepare('SELECT * FROM emergency_tasks WHERE id = ?').get(taskId) as any
      if (!existingTask) {
        return res.status(404).json({ success: false, error: 'Tarea no encontrada' })
      }

      const now = new Date().toISOString()
      const setClauses: string[] = ['updated_at = ?']
      const values: any[] = [now]

      // Build dynamic update
      if (updates.title !== undefined) { setClauses.push('title = ?'); values.push(updates.title) }
      if (updates.description !== undefined) { setClauses.push('description = ?'); values.push(updates.description) }
      if (updates.assignedToEmail !== undefined) { setClauses.push('assigned_to_email = ?'); values.push(updates.assignedToEmail) }
      if (updates.assignedToName !== undefined) { setClauses.push('assigned_to_name = ?'); values.push(updates.assignedToName) }
      if (updates.priority !== undefined) { setClauses.push('priority = ?'); values.push(updates.priority) }
      if (updates.dueDate !== undefined) { setClauses.push('due_date = ?'); values.push(updates.dueDate) }
      if (updates.reminderDate !== undefined) { setClauses.push('reminder_date = ?'); values.push(updates.reminderDate) }
      if (updates.notes !== undefined) { setClauses.push('notes = ?'); values.push(updates.notes) }

      // Handle status changes
      if (updates.status !== undefined) {
        setClauses.push('status = ?')
        values.push(updates.status)

        if (updates.status === 'in_progress' && !existingTask.started_at) {
          setClauses.push('started_at = ?')
          values.push(now)
        }

        if (updates.status === 'completed') {
          setClauses.push('completed_at = ?')
          setClauses.push('completed_by = ?')
          values.push(now)
          values.push(user?.name || 'Admin')
        }
      }

      values.push(taskId)

      db.prepare(`UPDATE emergency_tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values)

      // If newly assigned, send email
      if (updates.assignedToEmail && updates.assignedToEmail !== existingTask.assigned_to_email) {
        const emergency = db.prepare('SELECT * FROM maintenance_emergencies WHERE id = ?').get(existingTask.emergency_id) as any
        const plant = db.prepare('SELECT name FROM plants WHERE id = ?').get(emergency?.plant_id) as any

        await emailService.sendTaskAssignment(updates.assignedToEmail, {
          taskTitle: updates.title || existingTask.title,
          taskDescription: updates.description || existingTask.description || '',
          emergencyReason: emergency?.reason || '',
          plantName: plant?.name || 'Planta',
          assignedBy: user?.name || 'Administrador',
          dueDate: updates.dueDate || existingTask.due_date,
          priority: updates.priority || existingTask.priority,
        })

        db.prepare('UPDATE emergency_tasks SET email_sent_at = ? WHERE id = ?').run(now, taskId)
      }

      const task = db.prepare('SELECT * FROM emergency_tasks WHERE id = ?').get(taskId)
      res.json({ success: true, data: task })
    } catch (error: any) {
      console.error('Error updating emergency task:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// DELETE /api/maintenance/emergency-tasks/:taskId - Delete a task
router.delete('/emergency-tasks/:taskId', requireAuth, requireAdmin, writeLimiter, async (req: Request, res: Response) => {
  const { taskId } = req.params
  try {
    const result = db.prepare('DELETE FROM emergency_tasks WHERE id = ?').run(taskId)
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' })
    }
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/emergency-tasks/:taskId/comments - Add a comment to a task
router.post(
  '/emergency-tasks/:taskId/comments',
  requireAuth,
  writeLimiter,
  [body('comment').isString().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { taskId } = req.params
    const { comment } = req.body
    const user = (req as any).user

    try {
      const task = db.prepare('SELECT id FROM emergency_tasks WHERE id = ?').get(taskId)
      if (!task) {
        return res.status(404).json({ success: false, error: 'Tarea no encontrada' })
      }

      const commentId = randomUUID()
      db.prepare(`
        INSERT INTO emergency_task_comments (id, task_id, author_name, author_email, comment)
        VALUES (?, ?, ?, ?, ?)
      `).run(commentId, taskId, user?.name || 'Usuario', user?.email || null, comment)

      const newComment = db.prepare('SELECT * FROM emergency_task_comments WHERE id = ?').get(commentId)
      res.status(201).json({ success: true, data: newComment })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

// GET /api/maintenance/emergency-tasks/:taskId/comments - Get comments for a task
router.get('/emergency-tasks/:taskId/comments', requireAuth, async (req: Request, res: Response) => {
  const { taskId } = req.params
  try {
    const comments = db.prepare(`
      SELECT * FROM emergency_task_comments
      WHERE task_id = ?
      ORDER BY created_at DESC
    `).all(taskId)
    res.json({ success: true, data: comments })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/maintenance/emergency-tasks/:taskId/send-reminder - Send reminder email
router.post('/emergency-tasks/:taskId/send-reminder', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { taskId } = req.params
  try {
    const task = db.prepare('SELECT * FROM emergency_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' })
    }

    if (!task.assigned_to_email) {
      return res.status(400).json({ success: false, error: 'La tarea no tiene asignado un email' })
    }

    const emergency = db.prepare('SELECT * FROM maintenance_emergencies WHERE id = ?').get(task.emergency_id) as any
    const plant = db.prepare('SELECT name FROM plants WHERE id = ?').get(emergency?.plant_id) as any

    await emailService.sendTaskReminder(task.assigned_to_email, {
      taskTitle: task.title,
      taskDescription: task.description || '',
      emergencyReason: emergency?.reason || '',
      plantName: plant?.name || 'Planta',
      dueDate: task.due_date,
      priority: task.priority,
      status: task.status,
    })

    db.prepare('UPDATE emergency_tasks SET reminder_sent = 1 WHERE id = ?').run(taskId)

    res.json({ success: true, message: 'Recordatorio enviado' })
  } catch (error: any) {
    console.error('Error sending reminder:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/maintenance/emergency-tasks/pending - Get all pending tasks (for dashboard)
router.get('/emergency-tasks/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT et.*, me.reason as emergency_reason, p.name as plant_name
      FROM emergency_tasks et
      JOIN maintenance_emergencies me ON et.emergency_id = me.id
      JOIN plants p ON me.plant_id = p.id
      WHERE et.status IN ('pending', 'in_progress')
      ORDER BY
        CASE et.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        et.due_date ASC NULLS LAST
    `).all()
    res.json({ success: true, data: tasks })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
