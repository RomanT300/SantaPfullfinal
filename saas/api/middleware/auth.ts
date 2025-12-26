/**
 * Authentication Middleware for SaaS
 * Handles JWT validation and extracts user + organization context
 */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { usersDAL, organizationsDAL } from '../lib/dal.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
const JWT_EXPIRES_IN = '12h'

export interface JWTPayload {
  sub: string              // User ID
  email: string
  name: string
  role: 'owner' | 'admin' | 'supervisor' | 'operator' | 'viewer'
  organizationId: string
  organizationSlug: string
  plantId?: string         // For plant-scoped roles
  iat?: number
  exp?: number
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload
  organizationId?: string
}

// Alias for compatibility
export type AuthRequest = AuthenticatedRequest

/**
 * Generate JWT token for a user
 */
export function generateToken(user: any, organization: any): string {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: organization.id,
    organizationSlug: organization.slug,
    plantId: user.plant_id || undefined
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload
  } catch {
    return null
  }
}

/**
 * Middleware: Require authentication
 * Validates JWT from cookie or Authorization header
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Get token from cookie or header
  let token = req.cookies?.token

  if (!token) {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'TOKEN_INVALID'
    })
  }

  // Verify organization still exists and is active
  const org = organizationsDAL.getById(payload.organizationId) as any
  if (!org) {
    return res.status(401).json({
      success: false,
      error: 'Organization not found',
      code: 'ORG_NOT_FOUND'
    })
  }

  if (org.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Organization is suspended or cancelled',
      code: 'ORG_INACTIVE'
    })
  }

  // Attach user and org to request
  ;(req as AuthenticatedRequest).user = payload
  ;(req as AuthenticatedRequest).organizationId = payload.organizationId

  next()
}

/**
 * Middleware: Require specific role(s)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      })
    }

    // Owner has access to everything
    if (user.role === 'owner') {
      return next()
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        userRole: user.role
      })
    }

    next()
  }
}

/**
 * Middleware: Require admin role (owner or admin)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    })
  }

  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    })
  }

  next()
}

/**
 * Middleware: Require owner role
 */
export function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    })
  }

  if (user.role !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Owner access required',
      code: 'OWNER_REQUIRED'
    })
  }

  next()
}

/**
 * Middleware: Validate plant access
 * For users with plantId, restrict access to only their plant
 */
export function requirePlantAccess(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user
  const requestedPlantId = req.params.plantId || req.query.plantId || req.body?.plantId

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    })
  }

  // Owner and admin can access all plants
  if (user.role === 'owner' || user.role === 'admin') {
    return next()
  }

  // If user has plantId restriction, validate access
  if (user.plantId && requestedPlantId && user.plantId !== requestedPlantId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this plant',
      code: 'PLANT_ACCESS_DENIED'
    })
  }

  next()
}

/**
 * Permission definitions for RBAC
 */
export const PERMISSIONS = {
  owner: ['*'],
  admin: [
    'plants:*', 'users:*', 'equipment:*', 'maintenance:*',
    'analytics:*', 'documents:*', 'tickets:*', 'settings:read',
    'billing:read', 'api_keys:*', 'webhooks:*'
  ],
  supervisor: [
    'plants:read', 'equipment:read', 'maintenance:*',
    'analytics:*', 'documents:*', 'emergencies:*', 'checklists:*',
    'tickets:*'
  ],
  operator: [
    'plants:read', 'checklists:*', 'emergencies:create',
    'maintenance:read', 'equipment:read', 'tickets:create'
  ],
  viewer: [
    'plants:read', 'analytics:read', 'maintenance:read',
    'documents:read', 'tickets:read'
  ]
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: JWTPayload, permission: string): boolean {
  const userPerms = PERMISSIONS[user.role]

  // Owner has all permissions
  if (userPerms.includes('*')) return true

  // Direct permission match
  if (userPerms.includes(permission)) return true

  // Wildcard permission match (e.g., 'plants:*' matches 'plants:read')
  const [resource, action] = permission.split(':')
  if (userPerms.includes(`${resource}:*`)) return true

  return false
}

/**
 * Middleware: Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      })
    }

    if (!hasPermission(user, permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        requiredPermission: permission
      })
    }

    next()
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.token

  if (!token) {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      ;(req as AuthenticatedRequest).user = payload
      ;(req as AuthenticatedRequest).organizationId = payload.organizationId
    }
  }

  next()
}
