/**
 * Organization Routes for Multi-Tenant SaaS
 * Handles organization settings, branding, and management
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { organizationsDAL, usersDAL, plantsDAL, auditLogsDAL } from '../lib/dal.js'
import logger from '../lib/logger.js'
import { requireAuth, requireOwner, requireAdmin, AuthRequest } from '../middleware/auth.js'
import { requireTenant, TenantRequest } from '../middleware/tenant.js'

const router = Router()

/**
 * GET /api/organizations/current
 * Get current organization details
 */
router.get('/current', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const org = tenantReq.tenant!.organization

    // Get usage stats
    const users = usersDAL.getAll(org.id)
    const plants = plantsDAL.getAll(org.id)

    res.json({
      success: true,
      data: {
        ...org,
        usage: {
          users: users.length,
          plants: plants.length
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/organizations/current
 * Update current organization settings
 */
router.patch(
  '/current',
  requireAuth,
  requireTenant,
  requireAdmin,
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('logoUrl').optional().isString(),
    body('primaryColor').optional().isString().matches(/^#[0-9A-Fa-f]{6}$/),
    body('plantTypes').optional().isIn(['biosems', 'textiles', 'both']),
    body('settings').optional().isObject(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { name, logoUrl, primaryColor, plantTypes, settings } = req.body

    try {
      const org = tenantReq.tenant!.organization
      const oldValue = { ...org }

      const updates: any = {}
      if (name) updates.name = name
      if (logoUrl !== undefined) updates.logoUrl = logoUrl
      if (primaryColor) updates.primaryColor = primaryColor
      if (plantTypes) updates.plantTypes = plantTypes
      if (settings) {
        const currentSettings = org.settings || {}
        updates.settings = JSON.stringify({ ...currentSettings, ...settings })
      }

      const updated = organizationsDAL.update(org.id, updates)

      // Log audit
      auditLogsDAL.create(org.id, {
        userId: tenantReq.user!.sub,
        action: 'organization.updated',
        entityType: 'organization',
        entityId: org.id,
        oldValue: oldValue,
        newValue: updates,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: updated })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/organizations/current/usage
 * Get detailed usage statistics
 */
router.get('/current/usage', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const orgId = tenantReq.tenant!.organizationId

    const users = usersDAL.getAll(orgId)
    const plants = plantsDAL.getAll(orgId)

    // Get plan limits
    const planLimits: Record<string, { plants: number; users: number; apiCalls: number }> = {
      free: { plants: 1, users: 2, apiCalls: 100 },
      starter: { plants: 3, users: 5, apiCalls: 5000 },
      professional: { plants: 10, users: 20, apiCalls: 50000 },
      enterprise: { plants: Infinity, users: Infinity, apiCalls: Infinity }
    }

    const plan = tenantReq.tenant!.organization.plan
    const limits = planLimits[plan] || planLimits.free

    // Get API calls count from audit logs for current month
    const apiCallsCount = auditLogsDAL.countForMonth(orgId)

    res.json({
      success: true,
      data: {
        plan,
        usage: {
          users: { current: users.length, limit: limits.users, percentage: (users.length / limits.users) * 100 },
          plants: { current: plants.length, limit: limits.plants, percentage: (plants.length / limits.plants) * 100 },
          apiCalls: { current: apiCallsCount, limit: limits.apiCalls, percentage: (apiCallsCount / limits.apiCalls) * 100 }
        },
        breakdown: {
          usersByRole: users.reduce((acc: any, u: any) => {
            acc[u.role] = (acc[u.role] || 0) + 1
            return acc
          }, {}),
          plantsByStatus: plants.reduce((acc: any, p: any) => {
            acc[p.status || 'active'] = (acc[p.status || 'active'] || 0) + 1
            return acc
          }, {})
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/organizations/current/audit-logs
 * Get organization audit logs
 */
router.get('/current/audit-logs', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { action, entityType, from, to, limit = '50', offset = '0' } = req.query as Record<string, string>

  try {
    const logs = auditLogsDAL.getAll(tenantReq.tenant!.organizationId, {
      action,
      entityType,
      from,
      to,
      limit: parseInt(limit),
      offset: parseInt(offset)
    })

    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/organizations/current
 * Delete organization (owner only, requires confirmation)
 */
router.delete(
  '/current',
  requireAuth,
  requireTenant,
  requireOwner,
  [
    body('confirmation').equals('DELETE'),
    body('password').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { password } = req.body

    try {
      // Verify password
      const user = usersDAL.getById(tenantReq.tenant!.organizationId, tenantReq.user!.sub) as any
      const crypto = await import('crypto')
      const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')

      if (user.password_hash !== hashedPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        })
      }

      // Cancel Stripe subscription if exists
      const org = tenantReq.tenant!.organization as any
      if (org.stripe_subscription_id) {
        // TODO: Cancel Stripe subscription
      }

      // Soft delete - mark as cancelled
      organizationsDAL.update(org.id, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      })

      // Log audit (to separate admin log since org is being deleted)
      logger.info('Organization deleted', { orgId: org.id, userId: tenantReq.user!.sub })

      res.json({ success: true, message: 'Organization scheduled for deletion' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/organizations/current/export
 * Export all organization data
 */
router.post('/current/export', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const orgId = tenantReq.tenant!.organizationId

    // Gather all data
    const exportData = {
      organization: tenantReq.tenant!.organization,
      users: usersDAL.getAll(orgId),
      plants: plantsDAL.getAll(orgId),
      // Add more entities as needed
      exportedAt: new Date().toISOString(),
      format: 'v1'
    }

    res.json({
      success: true,
      data: exportData
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
