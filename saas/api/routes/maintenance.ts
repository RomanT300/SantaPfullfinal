/**
 * Maintenance Routes for SaaS - Full implementation
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { maintenanceTasksDAL, maintenanceEmergenciesDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, requireAdmin, AuthRequest, requirePermission } from '../middleware/auth.js'
import { requireTenant, TenantRequest } from '../middleware/tenant.js'

const router = Router()

// ======================
// MAINTENANCE TASKS
// ======================

/**
 * GET /api/maintenance/tasks
 * Get all maintenance tasks for the organization
 */
router.get(
  '/tasks',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { plantId, status, periodicity, from, to, assignedTo, limit, offset } = req.query as Record<string, string>

    try {
      const tasks = maintenanceTasksDAL.getAll(tenantReq.tenant!.organizationId, {
        plantId,
        status,
        periodicity,
        from,
        to,
        assignedTo,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      })
      res.json({ success: true, data: tasks })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/maintenance/tasks/:id
 * Get a specific maintenance task
 */
router.get(
  '/tasks/:id',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    try {
      const task = maintenanceTasksDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }
      res.json({ success: true, data: task })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/maintenance/tasks
 * Create a new maintenance task
 */
router.post(
  '/tasks',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:create'),
  [
    body('plantId').isString().notEmpty(),
    body('taskName').isString().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('periodicity').optional().isIn(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']),
    body('nextDue').optional().isISO8601(),
    body('assignedTo').optional().isString(),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { plantId, taskName, description, periodicity, nextDue, assignedTo, notes } = req.body

    try {
      const task = maintenanceTasksDAL.create(tenantReq.tenant!.organizationId, {
        plantId,
        taskName,
        description,
        periodicity,
        nextDue,
        assignedTo,
        notes
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'maintenance_task.created',
        entityType: 'maintenance_task',
        entityId: (task as any)?.id,
        newValue: { taskName, plantId },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({ success: true, data: task })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/maintenance/tasks/:id
 * Update a maintenance task
 */
router.patch(
  '/tasks/:id',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:update'),
  [
    body('taskName').optional().isString().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('periodicity').optional().isIn(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual']),
    body('nextDue').optional().isISO8601(),
    body('lastCompleted').optional().isISO8601(),
    body('status').optional().isIn(['pending', 'completed', 'overdue', 'skipped']),
    body('assignedTo').optional().isString(),
    body('notes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = maintenanceTasksDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      const task = maintenanceTasksDAL.update(tenantReq.tenant!.organizationId, id, req.body)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'maintenance_task.updated',
        entityType: 'maintenance_task',
        entityId: id,
        oldValue: existing,
        newValue: req.body,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: task })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/maintenance/tasks/:id/complete
 * Mark a task as completed and calculate next due date
 */
router.post(
  '/tasks/:id/complete',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:update'),
  [body('notes').optional().isString()],
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params
    const { notes } = req.body

    try {
      const task = maintenanceTasksDAL.complete(tenantReq.tenant!.organizationId, id, notes)
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'maintenance_task.completed',
        entityType: 'maintenance_task',
        entityId: id,
        newValue: { completedBy: tenantReq.user!.name, notes },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: task })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/maintenance/tasks/:id
 * Delete a maintenance task (admin only)
 */
router.delete(
  '/tasks/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = maintenanceTasksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      const deleted = maintenanceTasksDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'maintenance_task.deleted',
        entityType: 'maintenance_task',
        entityId: id,
        oldValue: { taskName: existing.task_name },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// ======================
// MAINTENANCE EMERGENCIES
// ======================

/**
 * GET /api/maintenance/emergencies
 * Get all emergencies for the organization
 */
router.get(
  '/emergencies',
  requireAuth,
  requireTenant,
  requirePermission('emergencies:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { plantId, status, severity, from, to, limit, offset } = req.query as Record<string, string>

    try {
      const emergencies = maintenanceEmergenciesDAL.getAll(tenantReq.tenant!.organizationId, {
        plantId,
        status,
        severity,
        from,
        to,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      })
      res.json({ success: true, data: emergencies })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/maintenance/emergencies/:id
 * Get a specific emergency
 */
router.get(
  '/emergencies/:id',
  requireAuth,
  requireTenant,
  requirePermission('emergencies:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    try {
      const emergency = maintenanceEmergenciesDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!emergency) {
        return res.status(404).json({ success: false, error: 'Emergency not found' })
      }
      res.json({ success: true, data: emergency })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/maintenance/emergencies
 * Create a new emergency
 */
router.post(
  '/emergencies',
  requireAuth,
  requireTenant,
  requirePermission('emergencies:create'),
  [
    body('plantId').isString().notEmpty(),
    body('title').isString().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical'])
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { plantId, title, description, severity } = req.body

    try {
      const emergency = maintenanceEmergenciesDAL.create(tenantReq.tenant!.organizationId, {
        plantId,
        title,
        description,
        severity,
        reportedBy: tenantReq.user!.name
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'emergency.created',
        entityType: 'emergency',
        entityId: (emergency as any)?.id,
        newValue: { title, severity, plantId },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({ success: true, data: emergency })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/maintenance/emergencies/:id
 * Update an emergency
 */
router.patch(
  '/emergencies/:id',
  requireAuth,
  requireTenant,
  requirePermission('emergencies:update'),
  [
    body('title').optional().isString().trim().isLength({ min: 2, max: 200 }),
    body('description').optional().isString(),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
    body('resolutionNotes').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = maintenanceEmergenciesDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Emergency not found' })
      }

      const emergency = maintenanceEmergenciesDAL.update(tenantReq.tenant!.organizationId, id, req.body)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'emergency.updated',
        entityType: 'emergency',
        entityId: id,
        oldValue: existing,
        newValue: req.body,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: emergency })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/maintenance/emergencies/:id
 * Delete an emergency (admin only)
 */
router.delete(
  '/emergencies/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = maintenanceEmergenciesDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Emergency not found' })
      }

      const deleted = maintenanceEmergenciesDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'emergency.deleted',
        entityType: 'emergency',
        entityId: id,
        oldValue: { title: existing.title },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// ======================
// STATS
// ======================

/**
 * GET /api/maintenance/stats
 * Get maintenance statistics
 */
router.get(
  '/stats',
  requireAuth,
  requireTenant,
  requirePermission('maintenance:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { plantId } = req.query as Record<string, string>

    try {
      // First mark any overdue tasks
      maintenanceTasksDAL.markOverdue(tenantReq.tenant!.organizationId)

      const taskStats = maintenanceTasksDAL.getStats(tenantReq.tenant!.organizationId, plantId) as any
      const emergencyStats = maintenanceEmergenciesDAL.getStats(tenantReq.tenant!.organizationId, plantId) as any

      res.json({
        success: true,
        data: {
          tasks: {
            total: taskStats?.total || 0,
            completed: taskStats?.completed || 0,
            pending: taskStats?.pending || 0,
            overdue: taskStats?.overdue || 0
          },
          emergencies: {
            total: emergencyStats?.total || 0,
            open: emergencyStats?.open || 0,
            inProgress: emergencyStats?.in_progress || 0,
            resolved: emergencyStats?.resolved || 0,
            criticalActive: emergencyStats?.critical_active || 0
          }
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
