/**
 * User Management Routes for Multi-Tenant SaaS
 * Handles user CRUD, invitations, and role management
 */
import { Router, Request, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { createHash, randomBytes } from 'crypto'
import { usersDAL, invitationsDAL, plantsDAL, auditLogsDAL, organizationsDAL } from '../lib/dal.js'
import { requireAuth, requireAdmin, requireOwner, AuthRequest, PERMISSIONS } from '../middleware/auth.js'
import { requireTenant, checkPlanLimits, TenantRequest } from '../middleware/tenant.js'
import { emailService } from '../services/emailService.js'

const router = Router()

// Hash password
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * GET /api/users
 * Get all users in organization
 */
router.get('/', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { role, status, search } = req.query as Record<string, string>

  try {
    const users = usersDAL.getAll(tenantReq.tenant!.organizationId, { role, status, search })

    // Remove sensitive fields
    const safeUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      plantId: u.plant_id,
      status: u.status,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at
    }))

    res.json({ success: true, data: safeUsers })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/users/:id
 * Get user by ID
 */
router.get('/:id', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const user = usersDAL.getById(tenantReq.tenant!.organizationId, id) as any
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Get plant info if assigned
    let plant = null
    if (user.plant_id) {
      plant = plantsDAL.getById(tenantReq.tenant!.organizationId, user.plant_id)
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plantId: user.plant_id,
        plant: plant ? { id: (plant as any).id, name: (plant as any).name } : null,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        permissions: PERMISSIONS[user.role as keyof typeof PERMISSIONS] || []
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/users/invite
 * Invite a new user to the organization
 */
router.post(
  '/invite',
  requireAuth,
  requireTenant,
  requireAdmin,
  checkPlanLimits('users'),
  [
    body('email').isEmail().normalizeEmail(),
    body('role').isIn(['admin', 'supervisor', 'operator', 'viewer']),
    body('plantId').optional().isString(),
    body('name').optional().isString().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { email, role, plantId, name } = req.body

    try {
      // Check if user already exists in this organization
      const existingUser = usersDAL.getByEmailInOrg(tenantReq.tenant!.organizationId, email)
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'User already exists in this organization',
          code: 'USER_EXISTS'
        })
      }

      // Check if there's already a pending invitation
      const existingInvitation = invitationsDAL.getByEmailInOrg(tenantReq.tenant!.organizationId, email)
      if (existingInvitation && !(existingInvitation as any).accepted_at) {
        return res.status(409).json({
          success: false,
          error: 'Invitation already sent to this email',
          code: 'INVITATION_EXISTS'
        })
      }

      // Verify plant exists if provided
      if (plantId) {
        const plant = plantsDAL.getById(tenantReq.tenant!.organizationId, plantId)
        if (!plant) {
          return res.status(400).json({
            success: false,
            error: 'Plant not found',
            code: 'PLANT_NOT_FOUND'
          })
        }
      }

      // Generate invitation token
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

      // Create invitation
      const invitation = invitationsDAL.create(tenantReq.tenant!.organizationId, {
        email,
        role,
        plantId,
        invitedBy: tenantReq.user!.sub,
        expiresAt: expiresAt.toISOString()
      }) as any

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'invitation.created',
        entityType: 'invitation',
        entityId: invitation.id,
        newValue: { email, role },
        ipAddress: req.ip || undefined
      })

      // Send invitation email
      const inviteUrl = `${process.env.APP_URL || 'http://localhost:5174'}/accept-invitation/${token}`
      const organization = organizationsDAL.getById(tenantReq.tenant!.organizationId) as { name?: string } | undefined
      const inviter = usersDAL.getById(tenantReq.tenant!.organizationId, tenantReq.user!.sub) as { name?: string; email?: string } | undefined

      await emailService.sendInvitation(email, {
        inviteeName: '',
        organizationName: organization?.name || 'PTAR SaaS',
        role,
        invitedBy: inviter?.name || inviter?.email || 'Un administrador',
        inviteUrl,
        expiresAt: expiresAt.toISOString()
      })

      res.status(201).json({
        success: true,
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          emailSent: true
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/users/invitations
 * Get all pending invitations
 */
router.get('/invitations/pending', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const invitations = invitationsDAL.getPending(tenantReq.tenant!.organizationId)
    res.json({ success: true, data: invitations })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/users/invitations/:id
 * Cancel a pending invitation
 */
router.delete('/invitations/:id', requireAuth, requireTenant, requireAdmin, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest & AuthRequest
  const { id } = req.params

  try {
    const invitation = invitationsDAL.getById(id) as any
    if (!invitation || invitation.organization_id !== tenantReq.tenant!.organizationId) {
      return res.status(404).json({ success: false, error: 'Invitation not found' })
    }

    if (invitation.accepted_at) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel accepted invitation',
        code: 'INVITATION_ACCEPTED'
      })
    }

    invitationsDAL.delete(tenantReq.tenant!.organizationId, id)

    // Log audit
    auditLogsDAL.create(tenantReq.tenant!.organizationId, {
      userId: tenantReq.user!.sub,
      action: 'invitation.cancelled',
      entityType: 'invitation',
      entityId: id,
      ipAddress: req.ip || undefined
    })

    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/users/:id
 * Update user (role, plant assignment, status)
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  [
    param('id').isString().notEmpty(),
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('role').optional().isIn(['admin', 'supervisor', 'operator', 'viewer']),
    body('plantId').optional(),
    body('status').optional().isIn(['active', 'suspended']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params
    const { name, role, plantId, status } = req.body

    try {
      const user = usersDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      // Can't modify owner role
      if (user.role === 'owner' && role && role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: 'Cannot change owner role',
          code: 'CANNOT_MODIFY_OWNER'
        })
      }

      // Can't demote yourself
      if (id === tenantReq.user!.sub && role && role !== user.role) {
        return res.status(403).json({
          success: false,
          error: 'Cannot change your own role',
          code: 'CANNOT_SELF_DEMOTE'
        })
      }

      // Verify plant exists if provided
      if (plantId) {
        const plant = plantsDAL.getById(tenantReq.tenant!.organizationId, plantId)
        if (!plant) {
          return res.status(400).json({
            success: false,
            error: 'Plant not found',
            code: 'PLANT_NOT_FOUND'
          })
        }
      }

      const oldValue = { name: user.name, role: user.role, plantId: user.plant_id, status: user.status }

      const updates: any = {}
      if (name) updates.name = name
      if (role) updates.role = role
      if (plantId !== undefined) updates.plantId = plantId
      if (status) updates.status = status

      const updated = usersDAL.update(tenantReq.tenant!.organizationId, id, updates)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
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
 * DELETE /api/users/:id
 * Remove user from organization
 */
router.delete('/:id', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest & AuthRequest
  const { id } = req.params

  try {
    const user = usersDAL.getById(tenantReq.tenant!.organizationId, id) as any
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Can't delete owner
    if (user.role === 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete organization owner',
        code: 'CANNOT_DELETE_OWNER'
      })
    }

    // Can't delete yourself
    if (id === tenantReq.user!.sub) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete yourself',
        code: 'CANNOT_SELF_DELETE'
      })
    }

    usersDAL.delete(tenantReq.tenant!.organizationId, id)

    // Log audit
    auditLogsDAL.create(tenantReq.tenant!.organizationId, {
      userId: tenantReq.user!.sub,
      action: 'user.deleted',
      entityType: 'user',
      entityId: id,
      oldValue: { email: user.email, role: user.role },
      ipAddress: req.ip || undefined
    })

    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/users/:id/reset-password
 * Admin resets user's password
 */
router.post(
  '/:id/reset-password',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const user = usersDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      // Generate temporary password
      const tempPassword = randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)

      usersDAL.update(tenantReq.tenant!.organizationId, id, {
        passwordHash: hashPassword(tempPassword),
        // Force password change on next login
        mustChangePassword: true
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: id,
        ipAddress: req.ip || undefined
      })

      // Send email with temporary password
      const organization = organizationsDAL.getById(tenantReq.tenant!.organizationId) as { name?: string } | undefined
      await emailService.sendTempPassword(user.email, {
        userName: user.name || user.email,
        organizationName: organization?.name || 'PTAR SaaS',
        tempPassword,
        loginUrl: `${process.env.APP_URL || 'http://localhost:5174'}/login`
      })

      res.json({
        success: true,
        data: {
          message: 'Password reset successfully. Email sent to user.',
          emailSent: true
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/users/:id/transfer-ownership
 * Transfer organization ownership to another user
 */
router.post(
  '/:id/transfer-ownership',
  requireAuth,
  requireTenant,
  requireOwner,
  [
    body('password').isString().notEmpty(),
    body('confirmation').equals('TRANSFER'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params
    const { password } = req.body

    try {
      // Verify current owner's password
      const currentOwner = usersDAL.getById(tenantReq.tenant!.organizationId, tenantReq.user!.sub) as any
      if (currentOwner.password_hash !== hashPassword(password)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        })
      }

      // Get new owner
      const newOwner = usersDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!newOwner) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      if (newOwner.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Cannot transfer ownership to inactive user',
          code: 'USER_INACTIVE'
        })
      }

      // Transfer ownership
      usersDAL.update(tenantReq.tenant!.organizationId, id, { role: 'owner' })
      usersDAL.update(tenantReq.tenant!.organizationId, tenantReq.user!.sub, { role: 'admin' })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'organization.ownership_transferred',
        entityType: 'organization',
        entityId: tenantReq.tenant!.organizationId,
        oldValue: { ownerId: tenantReq.user!.sub },
        newValue: { ownerId: id },
        ipAddress: req.ip || undefined
      })

      res.json({
        success: true,
        message: 'Ownership transferred successfully'
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

export default router
