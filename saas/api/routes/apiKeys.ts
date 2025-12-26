/**
 * API Key Management Routes for Multi-Tenant SaaS
 * Handles API key creation, listing, and revocation
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { apiKeysDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth.js'
import { requireTenant, requirePlan, TenantRequest } from '../middleware/tenant.js'
import { generateApiKey } from '../middleware/apiKey.js'

const router = Router()

// Available API scopes
const AVAILABLE_SCOPES = [
  'plants:read',
  'plants:write',
  'analytics:read',
  'analytics:write',
  'maintenance:read',
  'maintenance:write',
  'emergencies:read',
  'emergencies:write',
  'checklists:read',
  'checklists:write',
  'documents:read',
  'documents:write',
  'equipment:read',
  'equipment:write',
  'tickets:read',
  'tickets:write'
]

/**
 * GET /api/api-keys
 * List all API keys for organization
 */
router.get(
  '/',
  requireAuth,
  requireTenant,
  requireAdmin,
  requirePlan('starter', 'professional', 'enterprise'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest

    try {
      const keys = apiKeysDAL.getAll(tenantReq.tenant!.organizationId)

      // Remove sensitive hash, show only prefix
      const safeKeys = keys.map((k: any) => ({
        id: k.id,
        name: k.name,
        prefix: k.key_prefix,
        scopes: JSON.parse(k.scopes || '[]'),
        rateLimit: k.rate_limit,
        status: k.status,
        lastUsedAt: k.last_used_at,
        expiresAt: k.expires_at,
        createdAt: k.created_at
      }))

      res.json({ success: true, data: safeKeys })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/api-keys/scopes
 * Get available API scopes
 */
router.get('/scopes', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const scopeDescriptions: Record<string, string> = {
    'plants:read': 'Read plant information',
    'plants:write': 'Create and update plants',
    'analytics:read': 'Read environmental and analytics data',
    'analytics:write': 'Submit analytics data',
    'maintenance:read': 'Read maintenance tasks and schedules',
    'maintenance:write': 'Create and update maintenance tasks',
    'emergencies:read': 'Read emergency records',
    'emergencies:write': 'Create and update emergencies',
    'checklists:read': 'Read checklists and templates',
    'checklists:write': 'Submit and update checklists',
    'documents:read': 'Read documents',
    'documents:write': 'Upload and manage documents',
    'equipment:read': 'Read equipment information',
    'equipment:write': 'Create and update equipment',
    'tickets:read': 'Read support tickets',
    'tickets:write': 'Create and update tickets'
  }

  const scopes = AVAILABLE_SCOPES.map(scope => ({
    id: scope,
    description: scopeDescriptions[scope] || scope,
    resource: scope.split(':')[0],
    action: scope.split(':')[1]
  }))

  res.json({ success: true, data: scopes })
})

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post(
  '/',
  requireAuth,
  requireTenant,
  requireAdmin,
  requirePlan('starter', 'professional', 'enterprise'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('scopes').isArray({ min: 1 }),
    body('scopes.*').isIn([...AVAILABLE_SCOPES, '*', 'plants:*', 'analytics:*', 'maintenance:*', 'emergencies:*', 'checklists:*', 'documents:*', 'equipment:*', 'tickets:*']),
    body('rateLimit').optional().isInt({ min: 100, max: 100000 }),
    body('expiresInDays').optional().isInt({ min: 1, max: 365 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { name, scopes, rateLimit, expiresInDays } = req.body

    try {
      // Generate API key
      const { key, prefix, hash } = generateApiKey()

      // Calculate expiration
      let expiresAt: string | undefined
      if (expiresInDays) {
        const expDate = new Date()
        expDate.setDate(expDate.getDate() + expiresInDays)
        expiresAt = expDate.toISOString()
      }

      // Create API key record
      const apiKey = apiKeysDAL.create(tenantReq.tenant!.organizationId, {
        name,
        keyHash: hash,
        keyPrefix: prefix,
        scopes,
        rateLimit: rateLimit || 1000,
        expiresAt,
        createdBy: tenantReq.user!.sub
      }) as any

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'api_key.created',
        entityType: 'api_key',
        entityId: apiKey.id,
        newValue: { name, scopes },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key, // IMPORTANT: This is the only time the full key is shown
          prefix,
          scopes,
          rateLimit: apiKey.rate_limit,
          expiresAt: apiKey.expires_at,
          createdAt: apiKey.created_at
        },
        message: 'Store this API key securely. It will not be shown again.'
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/api-keys/:id
 * Get API key details
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
      const apiKey = apiKeysDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!apiKey) {
        return res.status(404).json({ success: false, error: 'API key not found' })
      }

      res.json({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          prefix: apiKey.key_prefix,
          scopes: JSON.parse(apiKey.scopes || '[]'),
          rateLimit: apiKey.rate_limit,
          status: apiKey.status,
          lastUsedAt: apiKey.last_used_at,
          expiresAt: apiKey.expires_at,
          createdAt: apiKey.created_at
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/api-keys/:id
 * Update API key (name, scopes, rate limit)
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
    body('scopes').optional().isArray({ min: 1 }),
    body('rateLimit').optional().isInt({ min: 100, max: 100000 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params
    const { name, scopes, rateLimit } = req.body

    try {
      const existing = apiKeysDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'API key not found' })
      }

      if (existing.status === 'revoked') {
        return res.status(400).json({
          success: false,
          error: 'Cannot update revoked API key',
          code: 'KEY_REVOKED'
        })
      }

      const updates: any = {}
      if (name) updates.name = name
      if (scopes) updates.scopes = JSON.stringify(scopes)
      if (rateLimit) updates.rateLimit = rateLimit

      const updated = apiKeysDAL.update(tenantReq.tenant!.organizationId, id, updates)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'api_key.updated',
        entityType: 'api_key',
        entityId: id,
        oldValue: { name: existing.name, scopes: existing.scopes },
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
 * POST /api/api-keys/:id/revoke
 * Revoke an API key
 */
router.post(
  '/:id/revoke',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = apiKeysDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'API key not found' })
      }

      if (existing.status === 'revoked') {
        return res.status(400).json({
          success: false,
          error: 'API key already revoked',
          code: 'ALREADY_REVOKED'
        })
      }

      apiKeysDAL.update(tenantReq.tenant!.organizationId, id, {
        status: 'revoked',
        revokedAt: new Date().toISOString()
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'api_key.revoked',
        entityType: 'api_key',
        entityId: id,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, message: 'API key revoked successfully' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/api-keys/:id
 * Delete an API key permanently
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
      const existing = apiKeysDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'API key not found' })
      }

      apiKeysDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'api_key.deleted',
        entityType: 'api_key',
        entityId: id,
        oldValue: { name: existing.name },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted: 1 })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/api-keys/:id/usage
 * Get API key usage statistics
 */
router.get(
  '/:id/usage',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params
    const { from, to } = req.query as Record<string, string>

    try {
      const apiKey = apiKeysDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!apiKey) {
        return res.status(404).json({ success: false, error: 'API key not found' })
      }

      // TODO: Implement actual usage tracking
      // For now, return placeholder data
      res.json({
        success: true,
        data: {
          keyId: id,
          period: { from, to },
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          rateLimit: apiKey.rate_limit,
          rateLimitRemaining: apiKey.rate_limit,
          lastUsedAt: apiKey.last_used_at,
          requestsByEndpoint: [],
          requestsByDay: []
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
