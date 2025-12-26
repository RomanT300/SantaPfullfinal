/**
 * Tenant Context Middleware
 * Validates and extracts organization context from requests
 */
import { Request, Response, NextFunction } from 'express'
import { organizationsDAL, plantsDAL, usersDAL } from '../lib/dal.js'
import { AuthenticatedRequest } from './auth.js'

export interface TenantContext {
  organizationId: string
  organization: {
    id: string
    name: string
    slug: string
    plan: string
    status: string
    settings: any
  }
}

export interface TenantRequest extends AuthenticatedRequest {
  tenant?: TenantContext
}

/**
 * Extract tenant slug from URL path
 * Supports: /org/:slug/... and /api/v1/:slug/...
 */
function extractSlugFromPath(path: string): string | null {
  // Match /org/{slug}/...
  const orgMatch = path.match(/^\/org\/([^\/]+)/)
  if (orgMatch) return orgMatch[1]

  // Match /api/v1/{slug}/...
  const apiMatch = path.match(/^\/api\/v1\/([^\/]+)/)
  if (apiMatch) return apiMatch[1]

  return null
}

/**
 * Middleware: Require tenant context
 * Validates that request has valid organization context
 */
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest

  // First check if user has organization from JWT
  if (authReq.user?.organizationId) {
    const org = organizationsDAL.getById(authReq.user.organizationId) as any

    if (!org) {
      return res.status(404).json({
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

    ;(req as TenantRequest).tenant = {
      organizationId: org.id,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        settings: org.settings ? JSON.parse(org.settings) : {}
      }
    }

    return next()
  }

  // Fallback: try to get from URL path
  const slug = extractSlugFromPath(req.path)
  if (slug) {
    const org = organizationsDAL.getBySlug(slug) as any

    if (!org) {
      return res.status(404).json({
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

    // Verify user belongs to this org (if authenticated)
    if (authReq.user && authReq.user.organizationId !== org.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this organization',
        code: 'ORG_ACCESS_DENIED'
      })
    }

    ;(req as TenantRequest).tenant = {
      organizationId: org.id,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        settings: org.settings ? JSON.parse(org.settings) : {}
      }
    }

    return next()
  }

  return res.status(400).json({
    success: false,
    error: 'Organization context required',
    code: 'ORG_CONTEXT_MISSING'
  })
}

/**
 * Middleware: Validate plan limits
 * Checks if organization is within their plan limits
 */
export function checkPlanLimits(resource: 'plants' | 'users' | 'apiCalls') {
  const PLAN_LIMITS = {
    starter: { plants: 3, users: 5, apiCalls: 5000, storage: 5 * 1024 * 1024 * 1024 },
    pro: { plants: 10, users: 25, apiCalls: 50000, storage: 50 * 1024 * 1024 * 1024 }
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest

    if (!tenantReq.tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_REQUIRED'
      })
    }

    const plan = tenantReq.tenant.organization.plan as keyof typeof PLAN_LIMITS
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

    // -1 means unlimited
    if (limits[resource] === -1) {
      return next()
    }

    let currentCount = 0

    switch (resource) {
      case 'plants':
        currentCount = plantsDAL.countByOrg(tenantReq.tenant.organizationId)
        break
      case 'users':
        currentCount = usersDAL.countByOrg(tenantReq.tenant.organizationId)
        break
      case 'apiCalls':
        // API calls would need a separate tracking mechanism
        // For now, just pass through
        return next()
    }

    if (currentCount >= limits[resource]) {
      return res.status(403).json({
        success: false,
        error: `Plan limit reached for ${resource}`,
        code: 'PLAN_LIMIT_REACHED',
        resource,
        limit: limits[resource],
        current: currentCount,
        plan: tenantReq.tenant.organization.plan
      })
    }

    next()
  }
}

/**
 * Middleware: Require specific plan or higher
 */
export function requirePlan(...allowedPlans: string[]) {
  const PLAN_HIERARCHY = ['starter', 'pro']

  return (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest

    if (!tenantReq.tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_REQUIRED'
      })
    }

    const currentPlan = tenantReq.tenant.organization.plan
    const currentIndex = PLAN_HIERARCHY.indexOf(currentPlan)

    // Check if current plan is in allowed plans or higher
    const hasAccess = allowedPlans.some(plan => {
      const planIndex = PLAN_HIERARCHY.indexOf(plan)
      return currentIndex >= planIndex
    })

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Plan upgrade required',
        code: 'PLAN_UPGRADE_REQUIRED',
        currentPlan,
        requiredPlans: allowedPlans
      })
    }

    next()
  }
}

/**
 * Middleware: Check feature flag
 */
export function requireFeature(featureName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantReq = req as TenantRequest

    if (!tenantReq.tenant) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context required',
        code: 'TENANT_REQUIRED'
      })
    }

    const settings = tenantReq.tenant.organization.settings || {}
    const features = settings.features || {}

    if (!features[featureName]) {
      return res.status(403).json({
        success: false,
        error: `Feature not available: ${featureName}`,
        code: 'FEATURE_NOT_AVAILABLE',
        feature: featureName
      })
    }

    next()
  }
}
