/**
 * Authentication Routes for Multi-Tenant SaaS
 * Handles login, registration, password reset, and token management
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { createHash, randomBytes } from 'crypto'
import jwt from 'jsonwebtoken'
import { usersDAL, organizationsDAL, invitationsDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, AuthRequest, JWTPayload } from '../middleware/auth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const JWT_EXPIRES_IN = '12h'
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7 days

// Hash password
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

// Generate tokens
function generateTokens(user: any, org: any) {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: org.id,
    organizationSlug: org.slug,
    plantId: user.plant_id
  }

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
  const refreshToken = randomBytes(64).toString('hex')

  return { accessToken, refreshToken, payload }
}

/**
 * POST /api/auth/register
 * Register a new organization and owner user
 */
router.post(
  '/register',
  [
    body('organizationName').isString().trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 8 }),
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { organizationName, email, password, name } = req.body

    try {
      // Check if email already exists
      const existingUser = usersDAL.getByEmail(email)
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        })
      }

      // Generate unique slug
      let slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Check if slug exists and make unique if needed
      let slugSuffix = 0
      let finalSlug = slug
      while (organizationsDAL.getBySlug(finalSlug)) {
        slugSuffix++
        finalSlug = `${slug}-${slugSuffix}`
      }

      // Create organization with trial
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14) // 14-day trial

      const org = organizationsDAL.create({
        name: organizationName,
        slug: finalSlug,
        plan: 'free',
        status: 'active',
        trialEndsAt: trialEndsAt.toISOString(),
        settings: JSON.stringify({
          timezone: 'America/Guayaquil',
          language: 'es',
          notifications: { email: true, inApp: true }
        })
      }) as any

      // Create owner user
      const user = usersDAL.createWithHash(org.id, {
        email,
        passwordHash: hashPassword(password),
        name,
        role: 'owner',
        status: 'active'
      }) as any

      // Log audit
      auditLogsDAL.create(org.id, {
        userId: user.id,
        action: 'organization.created',
        entityType: 'organization',
        entityId: org.id,
        newValue: { name: org.name, slug: org.slug },
        ipAddress: req.ip || undefined
      })

      // Generate tokens
      const { accessToken, refreshToken, payload } = generateTokens(user, org)

      // Store refresh token (in production, store in Redis)
      usersDAL.update(org.id, user.id, {
        refreshToken: hashPassword(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN).toISOString()
      })

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: JWT_EXPIRES_IN
          }
        }
      })
    } catch (error: any) {
      console.error('Registration error:', error)
      res.status(500).json({ success: false, error: 'Registration failed' })
    }
  }
)

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { email, password } = req.body

    try {
      // Find user by email
      const user = usersDAL.getByEmail(email) as any
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        })
      }

      // Verify password
      if (user.password_hash !== hashPassword(password)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        })
      }

      // Check user status
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account is suspended',
          code: 'ACCOUNT_SUSPENDED'
        })
      }

      // Get organization
      const org = organizationsDAL.getById(user.organization_id) as any
      if (!org || org.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Organization is not active',
          code: 'ORG_INACTIVE'
        })
      }

      // Generate tokens
      const { accessToken, refreshToken, payload } = generateTokens(user, org)

      // Update last login and store refresh token
      usersDAL.update(org.id, user.id, {
        lastLoginAt: new Date().toISOString(),
        refreshToken: hashPassword(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN).toISOString()
      })

      // Log audit
      auditLogsDAL.create(org.id, {
        userId: user.id,
        action: 'user.login',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip || undefined
      })

      // Set cookie for browser-based auth
      res.cookie('token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000 // 12 hours
      })

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plantId: user.plant_id
          },
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            logoUrl: org.logo_url,
            primaryColor: org.primary_color,
            plantTypes: org.plant_types || 'both'
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: JWT_EXPIRES_IN
          }
        }
      })
    } catch (error: any) {
      console.error('Login error:', error)
      res.status(500).json({ success: false, error: 'Login failed' })
    }
  }
)

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
  '/refresh',
  [
    body('refreshToken').isString().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { refreshToken } = req.body

    try {
      // Find user by refresh token hash
      const hashedToken = hashPassword(refreshToken)
      const user = usersDAL.getByRefreshToken(hashedToken) as any

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        })
      }

      // Check token expiration
      if (new Date(user.refresh_token_expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED'
        })
      }

      // Get organization
      const org = organizationsDAL.getById(user.organization_id) as any
      if (!org || org.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Organization is not active',
          code: 'ORG_INACTIVE'
        })
      }

      // Generate new tokens
      const tokens = generateTokens(user, org)

      // Update refresh token
      usersDAL.update(org.id, user.id, {
        refreshToken: hashPassword(tokens.refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN).toISOString()
      })

      res.json({
        success: true,
        data: {
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: JWT_EXPIRES_IN
          }
        }
      })
    } catch (error: any) {
      console.error('Token refresh error:', error)
      res.status(500).json({ success: false, error: 'Token refresh failed' })
    }
  }
)

/**
 * POST /api/auth/logout
 * Logout and invalidate refresh token
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    // Clear refresh token
    usersDAL.update(authReq.user!.organizationId, authReq.user!.sub, {
      refreshToken: null,
      refreshTokenExpiresAt: null
    })

    // Log audit
    auditLogsDAL.create(authReq.user!.organizationId, {
      userId: authReq.user!.sub,
      action: 'user.logout',
      entityType: 'user',
      entityId: authReq.user!.sub,
      ipAddress: req.ip || undefined
    })

    // Clear auth cookie
    res.clearCookie('token')

    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error: any) {
    console.error('Logout error:', error)
    res.status(500).json({ success: false, error: 'Logout failed' })
  }
})

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const user = usersDAL.getById(authReq.user!.organizationId, authReq.user!.sub) as any
    const org = organizationsDAL.getById(authReq.user!.organizationId) as any

    if (!user || !org) {
      return res.status(404).json({
        success: false,
        error: 'User or organization not found'
      })
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plantId: user.plant_id,
          status: user.status,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          status: org.status,
          logoUrl: org.logo_url,
          primaryColor: org.primary_color,
          trialEndsAt: org.trial_ends_at,
          settings: org.settings ? JSON.parse(org.settings) : {}
        }
      }
    })
  } catch (error: any) {
    console.error('Get user error:', error)
    res.status(500).json({ success: false, error: 'Failed to get user info' })
  }
})

/**
 * POST /api/auth/accept-invitation
 * Accept an invitation and create user account
 */
router.post(
  '/accept-invitation',
  [
    body('token').isString().notEmpty(),
    body('password').isString().isLength({ min: 8 }),
    body('name').isString().trim().isLength({ min: 2, max: 100 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { token, password, name } = req.body

    try {
      // Find invitation
      const invitation = invitationsDAL.getByToken(token) as any
      if (!invitation) {
        return res.status(404).json({
          success: false,
          error: 'Invitation not found',
          code: 'INVITATION_NOT_FOUND'
        })
      }

      // Check if already accepted
      if (invitation.accepted_at) {
        return res.status(400).json({
          success: false,
          error: 'Invitation already accepted',
          code: 'INVITATION_ACCEPTED'
        })
      }

      // Check expiration
      if (new Date(invitation.expires_at) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Invitation has expired',
          code: 'INVITATION_EXPIRED'
        })
      }

      // Check if email already registered
      const existingUser = usersDAL.getByEmail(invitation.email)
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        })
      }

      // Get organization
      const org = organizationsDAL.getById(invitation.organization_id) as any
      if (!org || org.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Organization is not active',
          code: 'ORG_INACTIVE'
        })
      }

      // Create user
      const user = usersDAL.createWithHash(org.id, {
        email: invitation.email,
        passwordHash: hashPassword(password),
        name,
        role: invitation.role,
        plantId: invitation.plant_id,
        status: 'active'
      }) as any

      // Mark invitation as accepted
      invitationsDAL.update(invitation.id, {
        acceptedAt: new Date().toISOString()
      })

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user, org)

      // Store refresh token
      usersDAL.update(org.id, user.id, {
        refreshToken: hashPassword(refreshToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN).toISOString()
      })

      // Log audit
      auditLogsDAL.create(org.id, {
        userId: user.id,
        action: 'invitation.accepted',
        entityType: 'invitation',
        entityId: invitation.id,
        ipAddress: req.ip || undefined
      })

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          },
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan: org.plan
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: JWT_EXPIRES_IN
          }
        }
      })
    } catch (error: any) {
      console.error('Accept invitation error:', error)
      res.status(500).json({ success: false, error: 'Failed to accept invitation' })
    }
  }
)

/**
 * POST /api/auth/change-password
 * Change current user's password
 */
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const authReq = req as AuthRequest
    const { currentPassword, newPassword } = req.body

    try {
      const user = usersDAL.getById(authReq.user!.organizationId, authReq.user!.sub) as any
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      // Verify current password
      if (user.password_hash !== hashPassword(currentPassword)) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        })
      }

      // Update password
      usersDAL.update(authReq.user!.organizationId, user.id, {
        passwordHash: hashPassword(newPassword)
      })

      // Log audit
      auditLogsDAL.create(authReq.user!.organizationId, {
        userId: authReq.user!.sub,
        action: 'user.password_changed',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, message: 'Password changed successfully' })
    } catch (error: any) {
      console.error('Change password error:', error)
      res.status(500).json({ success: false, error: 'Failed to change password' })
    }
  }
)

export default router
