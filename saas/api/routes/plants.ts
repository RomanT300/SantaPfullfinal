/**
 * Plants Routes for Multi-Tenant SaaS
 * Adapted from original project with organization context
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { plantsDAL, auditLogsDAL, maintenanceTasksDAL, maintenanceEmergenciesDAL } from '../lib/dal.js'
import { db } from '../lib/database.js'
import { requireAuth, requireAdmin, AuthRequest, requirePermission } from '../middleware/auth.js'
import { requireTenant, checkPlanLimits, TenantRequest } from '../middleware/tenant.js'

const router = Router()

/**
 * GET /api/plants
 * Get all plants for the organization
 */
router.get(
  '/',
  requireAuth,
  requireTenant,
  requirePermission('plants:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { search, status, type } = req.query as Record<string, string>

    try {
      const plants = plantsDAL.getAll(tenantReq.tenant!.organizationId, { search, status })
      res.json({ success: true, data: plants })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/plants/:id
 * Get plant by ID
 */
router.get(
  '/:id',
  requireAuth,
  requireTenant,
  requirePermission('plants:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    try {
      const plant = plantsDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!plant) {
        return res.status(404).json({ success: false, error: 'Plant not found' })
      }
      res.json({ success: true, data: plant })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/plants
 * Create a new plant
 */
router.post(
  '/',
  requireAuth,
  requireTenant,
  requireAdmin,
  checkPlanLimits('plants'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
    body('location').optional().isString(),
    body('type').optional().isIn(['ptar', 'ptap', 'industrial', 'commercial']),
    body('capacity').optional().isNumeric(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('status').optional().isIn(['active', 'inactive', 'maintenance']),
    body('settings').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { name, location, type, capacity, latitude, longitude, status, settings } = req.body

    try {
      const plant = plantsDAL.create(tenantReq.tenant!.organizationId, {
        name,
        location,
        latitude,
        longitude,
        status: status || 'active'
      }) as any

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'plant.created',
        entityType: 'plant',
        entityId: plant.id,
        newValue: { name, location },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({ success: true, data: plant })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/plants/:id
 * Update plant
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('location').optional().isString(),
    body('type').optional().isIn(['ptar', 'ptap', 'industrial', 'commercial']),
    body('capacity').optional().isNumeric(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('status').optional().isIn(['active', 'inactive', 'maintenance']),
    body('settings').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = plantsDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Plant not found' })
      }

      const updates = { ...req.body }
      if (updates.settings) {
        updates.settings = JSON.stringify(updates.settings)
      }

      const updated = plantsDAL.update(tenantReq.tenant!.organizationId, id, updates)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'plant.updated',
        entityType: 'plant',
        entityId: id,
        oldValue: existing,
        newValue: updates,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: updated })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/plants/:id
 * Delete plant
 */
router.delete(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = plantsDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Plant not found' })
      }

      plantsDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'plant.deleted',
        entityType: 'plant',
        entityId: id,
        oldValue: { name: existing.name },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted: 1 })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/plants/:id/stats
 * Get plant statistics
 */
router.get(
  '/:id/stats',
  requireAuth,
  requireTenant,
  requirePermission('plants:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params
    const { from, to } = req.query as Record<string, string>

    try {
      const plant = plantsDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!plant) {
        return res.status(404).json({ success: false, error: 'Plant not found' })
      }

      const orgId = tenantReq.tenant!.organizationId

      // Calculate actual statistics from database

      // Environmental data stats
      let envQuery = `
        SELECT COUNT(*) as total, parameter, AVG(value) as avg_value
        FROM environmental_data
        WHERE organization_id = ? AND plant_id = ?
      `
      const envParams: any[] = [orgId, id]
      if (from) { envQuery += ' AND date >= ?'; envParams.push(from) }
      if (to) { envQuery += ' AND date <= ?'; envParams.push(to) }
      envQuery += ' GROUP BY parameter'

      const envStats = db.prepare(envQuery).all(...envParams) as Array<{ total: number; parameter: string; avg_value: number }>
      const totalReadings = envStats.reduce((sum, e) => sum + e.total, 0)
      const averages: Record<string, number> = {}
      envStats.forEach(e => { averages[e.parameter] = Math.round(e.avg_value * 100) / 100 })

      // Maintenance stats
      const maintenanceStats = maintenanceTasksDAL.getStats(orgId, id) as { completed: number; pending: number; overdue: number } | undefined

      // Checklist stats
      let checklistQuery = `
        SELECT
          COUNT(*) as submitted,
          SUM(CASE WHEN has_red_flags = 1 THEN 1 ELSE 0 END) as flagged
        FROM daily_checklists
        WHERE organization_id = ? AND plant_id = ?
      `
      const checklistParams: any[] = [orgId, id]
      if (from) { checklistQuery += ' AND checklist_date >= ?'; checklistParams.push(from) }
      if (to) { checklistQuery += ' AND checklist_date <= ?'; checklistParams.push(to) }

      const checklistStats = db.prepare(checklistQuery).get(...checklistParams) as { submitted: number; flagged: number } | undefined

      // Emergency stats
      const emergencyStats = maintenanceEmergenciesDAL.getStats(orgId, id) as { total: number; open: number; in_progress: number; resolved: number } | undefined

      const stats = {
        plantId: id,
        period: { from, to },
        environmentalData: {
          totalReadings,
          averages
        },
        maintenance: {
          completed: maintenanceStats?.completed || 0,
          pending: maintenanceStats?.pending || 0,
          overdue: maintenanceStats?.overdue || 0
        },
        checklists: {
          submitted: checklistStats?.submitted || 0,
          flagged: checklistStats?.flagged || 0
        },
        emergencies: {
          total: emergencyStats?.total || 0,
          resolved: emergencyStats?.resolved || 0,
          active: (emergencyStats?.open || 0) + (emergencyStats?.in_progress || 0)
        }
      }

      res.json({ success: true, data: stats })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
