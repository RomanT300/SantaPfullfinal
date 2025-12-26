/**
 * Webhook Management Routes for Multi-Tenant SaaS
 * Handles webhook configuration and delivery
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { createHmac, randomBytes } from 'crypto'
import { webhooksDAL, webhookLogsDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js'
import { requireTenant, requirePlan, TenantRequest } from '../middleware/tenant.js'

const router = Router()

// Available webhook events
const AVAILABLE_EVENTS = [
  'emergency.created',
  'emergency.updated',
  'emergency.resolved',
  'maintenance.due',
  'maintenance.completed',
  'maintenance.overdue',
  'checklist.submitted',
  'checklist.flagged',
  'analytics.threshold_exceeded',
  'ticket.created',
  'ticket.updated',
  'ticket.resolved',
  'equipment.maintenance_due',
  'user.invited',
  'user.joined'
]

/**
 * GET /api/webhooks
 * List all webhooks for organization
 */
router.get(
  '/',
  requireAuth,
  requireTenant,
  requireAdmin,
  requirePlan('professional', 'enterprise'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest

    try {
      const webhooks = webhooksDAL.getAll(tenantReq.tenant!.organizationId)

      // Mask secrets
      const safeWebhooks = webhooks.map((w: any) => ({
        id: w.id,
        url: w.url,
        events: JSON.parse(w.events || '[]'),
        status: w.status,
        failureCount: w.failure_count,
        lastDeliveryAt: w.last_delivery_at,
        lastDeliveryStatus: w.last_delivery_status,
        createdAt: w.created_at
      }))

      res.json({ success: true, data: safeWebhooks })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/webhooks/events
 * Get available webhook events
 */
router.get('/events', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const eventDescriptions: Record<string, string> = {
    'emergency.created': 'When a new emergency is created',
    'emergency.updated': 'When an emergency is updated',
    'emergency.resolved': 'When an emergency is resolved',
    'maintenance.due': 'When maintenance task is due soon',
    'maintenance.completed': 'When maintenance task is completed',
    'maintenance.overdue': 'When maintenance task becomes overdue',
    'checklist.submitted': 'When a daily checklist is submitted',
    'checklist.flagged': 'When a checklist has flagged items',
    'analytics.threshold_exceeded': 'When an analytics value exceeds threshold',
    'ticket.created': 'When a support ticket is created',
    'ticket.updated': 'When a support ticket is updated',
    'ticket.resolved': 'When a support ticket is resolved',
    'equipment.maintenance_due': 'When equipment maintenance is due',
    'user.invited': 'When a user is invited to organization',
    'user.joined': 'When a user joins the organization'
  }

  const events = AVAILABLE_EVENTS.map(event => ({
    id: event,
    description: eventDescriptions[event] || event,
    category: event.split('.')[0]
  }))

  res.json({ success: true, data: events })
})

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post(
  '/',
  requireAuth,
  requireTenant,
  requireAdmin,
  requirePlan('professional', 'enterprise'),
  [
    body('url').isURL({ protocols: ['https'], require_protocol: true }),
    body('events').isArray({ min: 1 }),
    body('events.*').isIn(AVAILABLE_EVENTS),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { url, events } = req.body

    try {
      // Generate webhook secret
      const secret = `whsec_${randomBytes(32).toString('hex')}`

      const webhook = webhooksDAL.create(tenantReq.tenant!.organizationId, {
        url,
        events,
        secret
      }) as any

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'webhook.created',
        entityType: 'webhook',
        entityId: webhook.id,
        newValue: { url, events },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({
        success: true,
        data: {
          id: webhook.id,
          url: webhook.url,
          events,
          secret, // IMPORTANT: This is the only time the secret is shown
          status: webhook.status,
          createdAt: webhook.created_at
        },
        message: 'Store this webhook secret securely. It will not be shown again.'
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/webhooks/:id
 * Get webhook details
 */
router.get(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    try {
      const webhook = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!webhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      res.json({
        success: true,
        data: {
          id: webhook.id,
          url: webhook.url,
          events: JSON.parse(webhook.events || '[]'),
          status: webhook.status,
          failureCount: webhook.failure_count,
          lastDeliveryAt: webhook.last_delivery_at,
          lastDeliveryStatus: webhook.last_delivery_status,
          createdAt: webhook.created_at
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/webhooks/:id
 * Update webhook (url, events, status)
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  [
    body('url').optional().isURL({ protocols: ['https'], require_protocol: true }),
    body('events').optional().isArray({ min: 1 }),
    body('status').optional().isIn(['active', 'paused']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params
    const { url, events, status } = req.body

    try {
      const existing = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      const updates: any = {}
      if (url) updates.url = url
      if (events) updates.events = JSON.stringify(events)
      if (status) updates.status = status

      // Reset failure count if re-enabling
      if (status === 'active' && existing.status === 'failed') {
        updates.failureCount = 0
      }

      const updated = webhooksDAL.update(tenantReq.tenant!.organizationId, id, updates)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'webhook.updated',
        entityType: 'webhook',
        entityId: id,
        oldValue: { url: existing.url, events: existing.events, status: existing.status },
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
 * POST /api/webhooks/:id/rotate-secret
 * Rotate webhook secret
 */
router.post(
  '/:id/rotate-secret',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      // Generate new secret
      const newSecret = `whsec_${randomBytes(32).toString('hex')}`

      webhooksDAL.update(tenantReq.tenant!.organizationId, id, {
        secret: newSecret
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'webhook.secret_rotated',
        entityType: 'webhook',
        entityId: id,
        ipAddress: req.ip || undefined
      })

      res.json({
        success: true,
        data: {
          secret: newSecret
        },
        message: 'Store this new webhook secret securely. It will not be shown again.'
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/webhooks/:id
 * Delete webhook
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
      const existing = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      webhooksDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'webhook.deleted',
        entityType: 'webhook',
        entityId: id,
        oldValue: { url: existing.url },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted: 1 })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/webhooks/:id/logs
 * Get webhook delivery logs
 */
router.get(
  '/:id/logs',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params
    const { limit = '50', offset = '0' } = req.query as Record<string, string>

    try {
      const webhook = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!webhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      const logs = webhookLogsDAL.getByWebhookId(id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      })

      res.json({ success: true, data: logs })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/webhooks/:id/test
 * Send a test webhook
 */
router.post(
  '/:id/test',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const webhook = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!webhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      // Create test payload
      const payload = {
        event: 'test.ping',
        timestamp: new Date().toISOString(),
        organization: {
          id: tenantReq.tenant!.organizationId,
          slug: tenantReq.tenant!.organization.slug
        },
        data: {
          message: 'This is a test webhook from PTAR SaaS',
          triggeredBy: tenantReq.user!.email
        }
      }

      // Generate signature
      const payloadString = JSON.stringify(payload)
      const timestamp = Math.floor(Date.now() / 1000)
      const signaturePayload = `${timestamp}.${payloadString}`
      const signature = createHmac('sha256', webhook.secret)
        .update(signaturePayload)
        .digest('hex')

      // Send webhook
      const startTime = Date.now()
      let statusCode: number
      let responseBody: string

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
            'X-Webhook-Id': id,
            'X-Webhook-Event': 'test.ping',
            'User-Agent': 'PTAR-Webhook/1.0'
          },
          body: payloadString,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        statusCode = response.status
        responseBody = await response.text()
      } catch (fetchError: any) {
        statusCode = 0
        responseBody = fetchError.message
      }

      const duration = Date.now() - startTime

      // Log the delivery
      const log = webhookLogsDAL.create({
        webhookId: id,
        event: 'test.ping',
        payload: payloadString,
        statusCode,
        response: responseBody.substring(0, 1000),
        duration,
        success: statusCode >= 200 && statusCode < 300
      })

      res.json({
        success: true,
        data: {
          delivered: statusCode >= 200 && statusCode < 300,
          statusCode,
          duration,
          response: responseBody.substring(0, 500)
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/webhooks/:id/logs/:logId/retry
 * Retry a failed webhook delivery
 */
router.post(
  '/:id/logs/:logId/retry',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id, logId } = req.params

    try {
      const webhook = webhooksDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!webhook) {
        return res.status(404).json({ success: false, error: 'Webhook not found' })
      }

      const log = webhookLogsDAL.getById(logId) as any
      if (!log || log.webhook_id !== id) {
        return res.status(404).json({ success: false, error: 'Log not found' })
      }

      // Retry the delivery
      const payload = log.payload
      const timestamp = Math.floor(Date.now() / 1000)
      const signaturePayload = `${timestamp}.${payload}`
      const signature = createHmac('sha256', webhook.secret)
        .update(signaturePayload)
        .digest('hex')

      const startTime = Date.now()
      let statusCode: number
      let responseBody: string

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
            'X-Webhook-Id': id,
            'X-Webhook-Event': log.event,
            'X-Webhook-Retry': 'true',
            'User-Agent': 'PTAR-Webhook/1.0'
          },
          body: payload,
          signal: AbortSignal.timeout(30000)
        })

        statusCode = response.status
        responseBody = await response.text()
      } catch (fetchError: any) {
        statusCode = 0
        responseBody = fetchError.message
      }

      const duration = Date.now() - startTime
      const success = statusCode >= 200 && statusCode < 300

      // Log the retry
      webhookLogsDAL.create({
        webhookId: id,
        event: log.event,
        payload,
        statusCode,
        response: responseBody.substring(0, 1000),
        duration,
        success,
        retryOf: logId
      })

      res.json({
        success: true,
        data: {
          delivered: success,
          statusCode,
          duration
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
