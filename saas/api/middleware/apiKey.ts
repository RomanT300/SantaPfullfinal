/**
 * API Key Authentication Middleware
 * For public API access with API keys
 */
import { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { apiKeysDAL, organizationsDAL } from '../lib/dal.js'
import { TenantRequest, TenantContext } from './tenant.js'

export interface ApiKeyRequest extends TenantRequest {
  apiKey?: {
    id: string
    organizationId: string
    name: string
    scopes: string[]
    rateLimit: number
  }
}

/**
 * Hash an API key for storage/comparison
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a new API key
 * Returns both the raw key (to show user once) and prefix (for identification)
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = 'ptar_'
  const randomPart = Array.from({ length: 32 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
      Math.floor(Math.random() * 62)
    ]
  ).join('')

  const key = prefix + randomPart
  const hash = hashApiKey(key)

  return { key, prefix: key.substring(0, 12), hash }
}

/**
 * Middleware: Authenticate via API key
 * Checks X-API-Key header
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string

  // No API key provided - pass through (might use JWT instead)
  if (!apiKeyHeader) {
    return next()
  }

  // Validate format (should start with 'ptar_')
  if (!apiKeyHeader.startsWith('ptar_')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT'
    })
  }

  // Get key prefix and hash
  const keyPrefix = apiKeyHeader.substring(0, 12)
  const keyHash = hashApiKey(apiKeyHeader)

  // Look up API key
  const apiKey = apiKeysDAL.getByPrefixAndHash(keyPrefix, keyHash) as any

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    })
  }

  // Check if revoked
  if (apiKey.status !== 'active') {
    return res.status(401).json({
      success: false,
      error: 'API key has been revoked',
      code: 'API_KEY_REVOKED'
    })
  }

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return res.status(401).json({
      success: false,
      error: 'API key has expired',
      code: 'API_KEY_EXPIRED'
    })
  }

  // Get organization
  const org = organizationsDAL.getById(apiKey.organization_id) as any

  if (!org || org.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Organization is not active',
      code: 'ORG_INACTIVE'
    })
  }

  // Update last used timestamp (async, don't wait)
  apiKeysDAL.updateLastUsed(apiKey.id)

  // Attach API key info and tenant context to request
  const apiKeyReq = req as ApiKeyRequest

  apiKeyReq.apiKey = {
    id: apiKey.id,
    organizationId: apiKey.organization_id,
    name: apiKey.name,
    scopes: JSON.parse(apiKey.scopes || '[]'),
    rateLimit: apiKey.rate_limit
  }

  apiKeyReq.tenant = {
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

  next()
}

/**
 * Middleware: Require API key (no JWT fallback)
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string

  if (!apiKeyHeader) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      code: 'API_KEY_REQUIRED'
    })
  }

  // Reuse apiKeyAuth logic
  apiKeyAuth(req, res, (err) => {
    if (err) return next(err)

    const apiKeyReq = req as ApiKeyRequest
    if (!apiKeyReq.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      })
    }

    next()
  })
}

/**
 * Middleware: Check API key scope
 */
export function requireApiScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKeyReq = req as ApiKeyRequest

    // If no API key, skip scope check (might be using JWT)
    if (!apiKeyReq.apiKey) {
      return next()
    }

    const scopes = apiKeyReq.apiKey.scopes

    // Check for wildcard or specific scope
    if (scopes.includes('*') || scopes.includes(requiredScope)) {
      return next()
    }

    // Check for resource-level wildcard (e.g., 'plants:*' matches 'plants:read')
    const [resource, action] = requiredScope.split(':')
    if (scopes.includes(`${resource}:*`)) {
      return next()
    }

    return res.status(403).json({
      success: false,
      error: 'API key lacks required scope',
      code: 'SCOPE_REQUIRED',
      requiredScope,
      availableScopes: scopes
    })
  }
}

/**
 * Combined middleware: Auth via API key OR JWT
 */
export function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key']
  const authHeader = req.headers.authorization
  const tokenCookie = req.cookies?.token

  // If API key is present, use that
  if (apiKeyHeader) {
    return apiKeyAuth(req, res, (err) => {
      if (err) return next(err)

      const apiKeyReq = req as ApiKeyRequest
      if (!apiKeyReq.apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          code: 'INVALID_API_KEY'
        })
      }

      next()
    })
  }

  // Otherwise, require JWT (handled by requireAuth middleware)
  if (!authHeader && !tokenCookie) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required (API key or JWT token)',
      code: 'AUTH_REQUIRED'
    })
  }

  // Let the next middleware (requireAuth) handle JWT validation
  next()
}
