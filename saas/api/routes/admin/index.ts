/**
 * Admin Routes for SaaS Platform Management
 * Super admin access to manage all organizations and platform
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { organizationsDAL, usersDAL, plantsDAL, auditLogsDAL, maintenanceTasksDAL, maintenanceEmergenciesDAL, opexCostsDAL } from '../../lib/dal.js'
import { requireAuth, AuthRequest } from '../../middleware/auth.js'
import { db } from '../../lib/database.js'

const router = Router()

// List of super admin emails
const SUPER_ADMIN_EMAILS = (process.env.SAAS_ADMIN_EMAILS || '').split(',').map(e => e.trim())

/**
 * Middleware: Require super admin access
 */
function requireSuperAdmin(req: Request, res: Response, next: Function) {
  const authReq = req as AuthRequest

  if (!authReq.user || !SUPER_ADMIN_EMAILS.includes(authReq.user.email)) {
    return res.status(403).json({
      success: false,
      error: 'Super admin access required',
      code: 'SUPER_ADMIN_REQUIRED'
    })
  }

  next()
}

// Apply super admin requirement to all routes
router.use(requireSuperAdmin)

/**
 * GET /api/admin/dashboard
 * Get platform dashboard metrics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Get organization counts by plan
    const orgsByPlan = db.prepare(`
      SELECT plan, COUNT(*) as count
      FROM organizations
      WHERE status = 'active'
      GROUP BY plan
    `).all()

    // Get organization counts by status
    const orgsByStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM organizations
      GROUP BY status
    `).all()

    // Get total users
    const userCount = db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE status = 'active'
    `).get() as { count: number }

    // Get total plants
    const plantCount = db.prepare(`
      SELECT COUNT(*) as count FROM plants
    `).get() as { count: number }

    // Get recent signups (last 30 days)
    const recentSignups = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM organizations
      WHERE created_at >= date('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all()

    // Calculate MRR (Monthly Recurring Revenue)
    const planPrices: Record<string, number> = {
      free: 0,
      starter: 49,
      professional: 149,
      enterprise: 499
    }

    let mrr = 0
    ;(orgsByPlan as any[]).forEach(row => {
      mrr += (planPrices[row.plan] || 0) * row.count
    })

    res.json({
      success: true,
      data: {
        metrics: {
          totalOrganizations: (orgsByStatus as any[]).reduce((sum, r) => sum + r.count, 0),
          activeOrganizations: (orgsByPlan as any[]).reduce((sum, r) => sum + r.count, 0),
          totalUsers: userCount.count,
          totalPlants: plantCount.count,
          mrr
        },
        breakdown: {
          organizationsByPlan: orgsByPlan,
          organizationsByStatus: orgsByStatus
        },
        trends: {
          recentSignups
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations
 * List all organizations with filters
 */
router.get('/organizations', async (req: Request, res: Response) => {
  const { plan, status, search, limit = '50', offset = '0' } = req.query as Record<string, string>

  try {
    let query = 'SELECT * FROM organizations WHERE 1=1'
    const params: any[] = []

    if (plan) {
      query += ' AND plan = ?'
      params.push(plan)
    }

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    if (search) {
      query += ' AND (name LIKE ? OR slug LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const organizations = db.prepare(query).all(...params)

    // Get user and plant counts for each org
    const orgsWithStats = organizations.map((org: any) => {
      const userCount = db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE organization_id = ?'
      ).get(org.id) as { count: number }

      const plantCount = db.prepare(
        'SELECT COUNT(*) as count FROM plants WHERE organization_id = ?'
      ).get(org.id) as { count: number }

      return {
        ...org,
        userCount: userCount.count,
        plantCount: plantCount.count
      }
    })

    res.json({ success: true, data: orgsWithStats })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations/:id
 * Get organization details
 */
router.get('/organizations/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const org = organizationsDAL.getById(id) as any
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    // Get users
    const users = usersDAL.getAll(id)

    // Get plants
    const plants = plantsDAL.getAll(id)

    // Get recent audit logs
    const auditLogs = auditLogsDAL.getAll(id, { limit: 20 })

    res.json({
      success: true,
      data: {
        organization: org,
        users,
        plants,
        recentActivity: auditLogs
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/admin/organizations/:id
 * Update organization (plan, status, etc.)
 */
router.patch(
  '/organizations/:id',
  [
    body('plan').optional().isIn(['free', 'starter', 'professional', 'enterprise']),
    body('status').optional().isIn(['active', 'suspended', 'cancelled']),
    body('notes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const authReq = req as AuthRequest
    const { id } = req.params
    const { plan, status, notes } = req.body

    try {
      const org = organizationsDAL.getById(id) as any
      if (!org) {
        return res.status(404).json({ success: false, error: 'Organization not found' })
      }

      const updates: any = {}
      if (plan) updates.plan = plan
      if (status) updates.status = status
      if (notes !== undefined) updates.adminNotes = notes

      const updated = organizationsDAL.update(id, updates)

      // Log admin action
      auditLogsDAL.create(id, {
        userId: authReq.user!.sub,
        action: 'admin.organization_updated',
        entityType: 'organization',
        entityId: id,
        oldValue: { plan: org.plan, status: org.status },
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
 * POST /api/admin/organizations/:id/impersonate
 * Get a temporary login token for an organization owner
 */
router.post('/organizations/:id/impersonate', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const { id } = req.params

  try {
    const org = organizationsDAL.getById(id) as any
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    // Find owner user
    const owner = db.prepare(
      'SELECT * FROM users WHERE organization_id = ? AND role = ? LIMIT 1'
    ).get(id, 'owner') as any

    if (!owner) {
      return res.status(404).json({ success: false, error: 'Organization owner not found' })
    }

    // Generate temporary token (short expiry)
    const jwt = await import('jsonwebtoken')
    const token = jwt.default.sign(
      {
        sub: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role,
        organizationId: org.id,
        organizationSlug: org.slug,
        impersonatedBy: authReq.user!.email
      },
      process.env.JWT_SECRET || 'your-secret',
      { expiresIn: '1h' }
    )

    // Log impersonation
    auditLogsDAL.create(id, {
      userId: authReq.user!.sub,
      action: 'admin.impersonation',
      entityType: 'user',
      entityId: owner.id,
      newValue: { adminEmail: authReq.user!.email },
      ipAddress: req.ip || undefined
    })

    res.json({
      success: true,
      data: {
        token,
        expiresIn: '1h',
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug
        },
        user: {
          id: owner.id,
          email: owner.email,
          name: owner.name
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/audit-logs
 * Get platform-wide audit logs
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  const { organizationId, action, from, to, limit = '100', offset = '0' } = req.query as Record<string, string>

  try {
    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    const params: any[] = []

    if (organizationId) {
      query += ' AND organization_id = ?'
      params.push(organizationId)
    }

    if (action) {
      query += ' AND action LIKE ?'
      params.push(`%${action}%`)
    }

    if (from) {
      query += ' AND created_at >= ?'
      params.push(from)
    }

    if (to) {
      query += ' AND created_at <= ?'
      params.push(to)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const logs = db.prepare(query).all(...params)

    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/system
 * Get system information
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    // Database size
    const dbStats = db.prepare('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()').get() as { size: number }

    // Table row counts
    const tables = ['organizations', 'users', 'plants', 'environmental_data', 'maintenance_tasks', 'audit_logs']
    const tableCounts: Record<string, number> = {}

    for (const table of tables) {
      try {
        const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        tableCounts[table] = result.count
      } catch {
        tableCounts[table] = 0
      }
    }

    res.json({
      success: true,
      data: {
        database: {
          size: dbStats.size,
          sizeFormatted: `${(dbStats.size / 1024 / 1024).toFixed(2)} MB`
        },
        tables: tableCounts,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime()
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/admin/organizations
 * Create a new organization with owner
 */
router.post(
  '/organizations',
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
    body('ownerEmail').isEmail().normalizeEmail(),
    body('ownerName').isString().trim().isLength({ min: 2, max: 100 }),
    body('ownerPassword').isString().isLength({ min: 6 }),
    body('plan').isIn(['starter', 'pro']),
    body('plantTypes').isIn(['biosems', 'textiles', 'both']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const authReq = req as AuthRequest
    const { name, ownerEmail, ownerName, ownerPassword, plan, plantTypes } = req.body

    try {
      // Generate slug from name
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      // Check if slug exists
      let slug = baseSlug
      let suffix = 1
      while (organizationsDAL.getBySlug(slug)) {
        slug = `${baseSlug}-${suffix}`
        suffix++
      }

      // Check if email already exists
      const existingUser = db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).get(ownerEmail)

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Ya existe un usuario con ese email',
          code: 'EMAIL_EXISTS'
        })
      }

      // Create organization
      const org = organizationsDAL.create({
        name,
        slug,
        plan,
        plantTypes,
        status: 'active',
        settings: JSON.stringify({
          timezone: 'America/Guayaquil',
          language: 'es'
        })
      }) as any

      // Create owner user
      const crypto = await import('crypto')
      const passwordHash = crypto.createHash('sha256').update(ownerPassword).digest('hex')

      const owner = usersDAL.createWithHash(org.id, {
        email: ownerEmail,
        passwordHash,
        name: ownerName,
        role: 'owner',
        status: 'active'
      })

      // Log admin action
      auditLogsDAL.create(org.id, {
        userId: authReq.user!.sub,
        action: 'admin.organization_created',
        entityType: 'organization',
        entityId: org.id,
        newValue: { name, slug, plan, plantTypes, ownerEmail },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({
        success: true,
        data: {
          organization: org,
          owner: {
            id: (owner as { id: string } | undefined)?.id,
            email: ownerEmail,
            name: ownerName
          }
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/admin/seed-demo
 * Create a demo organization for testing
 */
router.post('/seed-demo', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    // Check if demo org already exists
    const existing = organizationsDAL.getBySlug('demo')
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Demo organization already exists',
        code: 'DEMO_EXISTS'
      })
    }

    // Create demo organization
    const org = organizationsDAL.create({
      name: 'Demo Organization',
      slug: 'demo',
      plan: 'professional',
      status: 'active',
      settings: JSON.stringify({
        timezone: 'America/Guayaquil',
        language: 'es'
      })
    }) as any

    // Create demo user
    const crypto = await import('crypto')
    const passwordHash = crypto.createHash('sha256').update('demo123').digest('hex')

    usersDAL.createWithHash(org.id, {
      email: 'demo@example.com',
      passwordHash,
      name: 'Demo User',
      role: 'owner',
      status: 'active'
    })

    // Create demo plant
    plantsDAL.create(org.id, {
      name: 'Demo PTAR',
      location: 'Demo Location',
      status: 'active'
    })

    // Log action
    auditLogsDAL.create(org.id, {
      userId: authReq.user!.sub,
      action: 'admin.demo_created',
      entityType: 'organization',
      entityId: org.id,
      ipAddress: req.ip || undefined
    })

    res.status(201).json({
      success: true,
      data: {
        organization: org,
        credentials: {
          email: 'demo@example.com',
          password: 'demo123'
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// =====================================================
// USER MANAGEMENT ENDPOINTS (Super Admin)
// =====================================================

/**
 * GET /api/admin/users
 * List all users across all organizations
 */
router.get('/users', async (req: Request, res: Response) => {
  const { organizationId, role, status, search, limit = '50', offset = '0' } = req.query as Record<string, string>

  try {
    let query = `
      SELECT u.*, o.name as organization_name, o.slug as organization_slug
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE 1=1
    `
    const params: any[] = []

    if (organizationId) {
      query += ' AND u.organization_id = ?'
      params.push(organizationId)
    }

    if (role) {
      query += ' AND u.role = ?'
      params.push(role)
    }

    if (status) {
      query += ' AND u.status = ?'
      params.push(status)
    }

    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const users = db.prepare(query).all(...params)

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM users u WHERE 1=1'
    const countParams: any[] = []

    if (organizationId) {
      countQuery += ' AND u.organization_id = ?'
      countParams.push(organizationId)
    }
    if (role) {
      countQuery += ' AND u.role = ?'
      countParams.push(role)
    }
    if (status) {
      countQuery += ' AND u.status = ?'
      countParams.push(status)
    }
    if (search) {
      countQuery += ' AND (u.name LIKE ? OR u.email LIKE ?)'
      countParams.push(`%${search}%`, `%${search}%`)
    }

    const { total } = db.prepare(countQuery).get(...countParams) as { total: number }

    res.json({
      success: true,
      data: users.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        plantId: u.plant_id,
        organizationId: u.organization_id,
        organizationName: u.organization_name,
        organizationSlug: u.organization_slug,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/users/:id
 * Get user details with activity history
 */
router.get('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const user = db.prepare(`
      SELECT u.*, o.name as organization_name, o.slug as organization_slug, o.plan as organization_plan
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ?
    `).get(id) as any

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Get user's plant if assigned
    let plant = null
    if (user.plant_id) {
      plant = db.prepare('SELECT id, name, location FROM plants WHERE id = ?').get(user.plant_id)
    }

    // Get available plants in the org
    const availablePlants = db.prepare(
      'SELECT id, name, location FROM plants WHERE organization_id = ?'
    ).all(user.organization_id)

    // Get recent activity (audit logs)
    const recentActivity = db.prepare(`
      SELECT * FROM audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(id)

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          plantId: user.plant_id,
          avatarUrl: user.avatar_url,
          emailVerified: user.email_verified,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        organization: {
          id: user.organization_id,
          name: user.organization_name,
          slug: user.organization_slug,
          plan: user.organization_plan
        },
        plant,
        availablePlants,
        recentActivity
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/admin/users/:id
 * Update any user (Super Admin power)
 */
router.patch(
  '/users/:id',
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 100 }),
    body('role').optional().isIn(['owner', 'admin', 'supervisor', 'operator', 'viewer']),
    body('status').optional().isIn(['active', 'suspended', 'inactive']),
    body('plantId').optional(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const authReq = req as AuthRequest
    const { id } = req.params
    const { name, role, status, plantId } = req.body

    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' })
      }

      const updates: string[] = []
      const params: any[] = []

      if (name !== undefined) { updates.push('name = ?'); params.push(name) }
      if (role !== undefined) { updates.push('role = ?'); params.push(role) }
      if (status !== undefined) { updates.push('status = ?'); params.push(status) }
      if (plantId !== undefined) { updates.push('plant_id = ?'); params.push(plantId || null) }

      if (updates.length === 0) {
        return res.json({ success: true, data: user })
      }

      updates.push("updated_at = datetime('now')")
      params.push(id)

      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params)

      // Log action
      auditLogsDAL.create(user.organization_id, {
        userId: authReq.user!.sub,
        action: 'admin.user_updated',
        entityType: 'user',
        entityId: id,
        oldValue: { name: user.name, role: user.role, status: user.status, plantId: user.plant_id },
        newValue: { name, role, status, plantId },
        ipAddress: req.ip || undefined
      })

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      res.json({ success: true, data: updated })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/admin/users/:id
 * Delete any user (Super Admin power)
 */
router.delete('/users/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const { id } = req.params

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Check if user is the only owner of an org
    if (user.role === 'owner') {
      const ownerCount = db.prepare(
        'SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND role = ?'
      ).get(user.organization_id, 'owner') as { count: number }

      if (ownerCount.count <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the only owner. Transfer ownership first.',
          code: 'CANNOT_DELETE_ONLY_OWNER'
        })
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id)

    // Log action
    auditLogsDAL.create(user.organization_id, {
      userId: authReq.user!.sub,
      action: 'admin.user_deleted',
      entityType: 'user',
      entityId: id,
      oldValue: { email: user.email, name: user.name, role: user.role },
      ipAddress: req.ip || undefined
    })

    res.json({ success: true, message: 'User deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password (generates temporary password)
 */
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const { id } = req.params

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Generate temporary password
    const crypto = await import('crypto')
    const tempPassword = crypto.randomBytes(8).toString('hex')
    const passwordHash = crypto.createHash('sha256').update(tempPassword).digest('hex')

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)

    // Log action
    auditLogsDAL.create(user.organization_id, {
      userId: authReq.user!.sub,
      action: 'admin.user_password_reset',
      entityType: 'user',
      entityId: id,
      ipAddress: req.ip || undefined
    })

    res.json({
      success: true,
      data: {
        temporaryPassword: tempPassword,
        message: 'Password reset. User should change it on next login.'
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/admin/users/:id/impersonate
 * Get a temporary login token for any user
 */
router.post('/users/:id/impersonate', async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const { id } = req.params

  try {
    const user = db.prepare(`
      SELECT u.*, o.slug as organization_slug
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = ?
    `).get(id) as any

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Generate temporary token (short expiry)
    const jwt = await import('jsonwebtoken')
    const token = jwt.default.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organizationSlug: user.organization_slug,
        plantId: user.plant_id,
        impersonatedBy: authReq.user!.email
      },
      process.env.JWT_SECRET || 'your-secret',
      { expiresIn: '1h' }
    )

    // Log impersonation
    auditLogsDAL.create(user.organization_id, {
      userId: authReq.user!.sub,
      action: 'admin.user_impersonation',
      entityType: 'user',
      entityId: id,
      newValue: { adminEmail: authReq.user!.email },
      ipAddress: req.ip || undefined
    })

    res.json({
      success: true,
      data: {
        token,
        expiresIn: '1h',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==============================================
// ORGANIZATION DATA ACCESS (for OrganizationDetail tabs)
// ==============================================

/**
 * GET /api/admin/organizations/:orgId/plants
 * Get all plants for a specific organization
 */
router.get('/organizations/:orgId/plants', async (req: Request, res: Response) => {
  const { orgId } = req.params

  try {
    const org = organizationsDAL.getById(orgId)
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    const plants = plantsDAL.getAll(orgId)
    res.json({ success: true, data: plants })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations/:orgId/maintenance
 * Get all maintenance tasks for a specific organization
 */
router.get('/organizations/:orgId/maintenance', async (req: Request, res: Response) => {
  const { orgId } = req.params

  try {
    const org = organizationsDAL.getById(orgId)
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    const tasks = maintenanceTasksDAL.getAll(orgId)
    res.json({ success: true, data: tasks })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations/:orgId/emergencies
 * Get all emergencies for a specific organization
 */
router.get('/organizations/:orgId/emergencies', async (req: Request, res: Response) => {
  const { orgId } = req.params

  try {
    const org = organizationsDAL.getById(orgId)
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    const emergencies = maintenanceEmergenciesDAL.getAll(orgId)
    res.json({ success: true, data: emergencies })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations/:orgId/opex
 * Get all OPEX costs for a specific organization
 */
router.get('/organizations/:orgId/opex', async (req: Request, res: Response) => {
  const { orgId } = req.params
  const { year } = req.query

  try {
    const org = organizationsDAL.getById(orgId)
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    const opex = opexCostsDAL.getAll(orgId, {
      year: year ? parseInt(year as string) : undefined
    })
    res.json({ success: true, data: opex })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/admin/organizations/:orgId/stats
 * Get stats for a specific organization
 */
router.get('/organizations/:orgId/stats', async (req: Request, res: Response) => {
  const { orgId } = req.params

  try {
    const org = organizationsDAL.getById(orgId)
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' })
    }

    const users = usersDAL.getAll(orgId)
    const plants = plantsDAL.getAll(orgId)
    const maintenanceStats = maintenanceTasksDAL.getStats(orgId)
    const emergencyStats = maintenanceEmergenciesDAL.getStats(orgId)
    const opexTotal = opexCostsDAL.getTotalByYear(orgId, new Date().getFullYear())

    res.json({
      success: true,
      data: {
        users: users.length,
        plants: plants.length,
        maintenance: maintenanceStats,
        emergencies: emergencyStats,
        opex: opexTotal
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
