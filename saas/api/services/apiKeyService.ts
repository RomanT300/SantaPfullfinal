/**
 * API Key Service
 * Manage API keys for programmatic access
 */
import { db } from '../lib/database.js'
import { randomUUID, createHash, randomBytes } from 'crypto'
import { createAuditLog, getRequestInfo } from './auditService.js'

export interface ApiKey {
  id: string
  organization_id: string
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit: number
  last_used_at: string | null
  expires_at: string | null
  status: 'active' | 'revoked'
  created_by: string
  created_at: string
}

export interface CreateApiKeyInput {
  organization_id: string
  name: string
  scopes?: string[]
  rate_limit?: number
  expires_in_days?: number
  created_by: string
}

// Available API scopes
export const API_SCOPES = {
  'plants:read': 'Ver plantas',
  'plants:write': 'Modificar plantas',
  'data:read': 'Ver datos ambientales',
  'data:write': 'Escribir datos ambientales',
  'maintenance:read': 'Ver mantenimientos',
  'maintenance:write': 'Gestionar mantenimientos',
  'documents:read': 'Ver documentos',
  'documents:write': 'Subir documentos',
  'checklists:read': 'Ver checklists',
  'checklists:write': 'Completar checklists',
  'tickets:read': 'Ver tickets',
  'tickets:write': 'Gestionar tickets',
  'users:read': 'Ver usuarios',
  'webhooks:manage': 'Gestionar webhooks'
} as const

/**
 * Generate a secure API key
 */
function generateApiKey(): { key: string, hash: string, prefix: string } {
  // Generate 32 random bytes for the key
  const keyBytes = randomBytes(32)
  const key = `ptar_${keyBytes.toString('base64url')}`

  // Hash the key for storage
  const hash = createHash('sha256').update(key).digest('hex')

  // Get prefix for display (first 8 chars after ptar_)
  const prefix = key.substring(0, 12)

  return { key, hash, prefix }
}

/**
 * Hash an API key for lookup
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Create a new API key
 * Returns the full key only once - it cannot be retrieved later
 */
export function createApiKey(input: CreateApiKeyInput, req?: any): { apiKey: ApiKey, fullKey: string } {
  const id = randomUUID()
  const { key, hash, prefix } = generateApiKey()

  const expiresAt = input.expires_in_days
    ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  const scopes = input.scopes || ['plants:read', 'data:read']

  const stmt = db.prepare(`
    INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
  `)

  stmt.run(
    id,
    input.organization_id,
    input.name,
    hash,
    prefix,
    JSON.stringify(scopes),
    input.rate_limit || 1000,
    expiresAt,
    input.created_by
  )

  // Log the action
  const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
  createAuditLog({
    organization_id: input.organization_id,
    user_id: input.created_by,
    action: 'api_key_created',
    entity_type: 'api_key',
    entity_id: id,
    new_value: { name: input.name, scopes, prefix },
    ip_address: requestInfo.ip,
    user_agent: requestInfo.userAgent
  })

  return {
    apiKey: {
      id,
      organization_id: input.organization_id,
      name: input.name,
      key_prefix: prefix,
      scopes,
      rate_limit: input.rate_limit || 1000,
      last_used_at: null,
      expires_at: expiresAt,
      status: 'active',
      created_by: input.created_by,
      created_at: new Date().toISOString()
    },
    fullKey: key
  }
}

/**
 * Get all API keys for an organization
 */
export function getApiKeys(organizationId: string): ApiKey[] {
  const stmt = db.prepare(`
    SELECT
      ak.*,
      u.name as created_by_name
    FROM api_keys ak
    LEFT JOIN users u ON ak.created_by = u.id
    WHERE ak.organization_id = ?
    ORDER BY ak.created_at DESC
  `)

  const keys = stmt.all(organizationId) as any[]

  return keys.map(key => ({
    ...key,
    scopes: JSON.parse(key.scopes || '[]')
  }))
}

/**
 * Get API key by hash (for authentication)
 */
export function getApiKeyByHash(keyHash: string): (ApiKey & { organization_id: string }) | null {
  const stmt = db.prepare(`
    SELECT * FROM api_keys
    WHERE key_hash = ? AND status = 'active'
  `)

  const key = stmt.get(keyHash) as any

  if (!key) return null

  // Check expiration
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return null
  }

  return {
    ...key,
    scopes: JSON.parse(key.scopes || '[]')
  }
}

/**
 * Update last used timestamp
 */
export function updateLastUsed(keyId: string): void {
  const stmt = db.prepare(`
    UPDATE api_keys SET last_used_at = datetime('now')
    WHERE id = ?
  `)

  stmt.run(keyId)
}

/**
 * Revoke an API key
 */
export function revokeApiKey(organizationId: string, keyId: string, userId: string, req?: any): boolean {
  // Get key info first
  const getStmt = db.prepare(`
    SELECT * FROM api_keys WHERE id = ? AND organization_id = ?
  `)
  const key = getStmt.get(keyId, organizationId) as any

  if (!key) return false

  const stmt = db.prepare(`
    UPDATE api_keys SET status = 'revoked'
    WHERE id = ? AND organization_id = ?
  `)

  const result = stmt.run(keyId, organizationId)

  if (result.changes > 0) {
    // Log the action
    const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
    createAuditLog({
      organization_id: organizationId,
      user_id: userId,
      action: 'api_key_revoked',
      entity_type: 'api_key',
      entity_id: keyId,
      old_value: { name: key.name, status: key.status },
      new_value: { status: 'revoked' },
      ip_address: requestInfo.ip,
      user_agent: requestInfo.userAgent
    })
  }

  return result.changes > 0
}

/**
 * Update API key settings
 */
export function updateApiKey(
  organizationId: string,
  keyId: string,
  updates: { name?: string, scopes?: string[], rate_limit?: number }
): boolean {
  const setClauses: string[] = []
  const params: any[] = []

  if (updates.name) {
    setClauses.push('name = ?')
    params.push(updates.name)
  }

  if (updates.scopes) {
    setClauses.push('scopes = ?')
    params.push(JSON.stringify(updates.scopes))
  }

  if (updates.rate_limit) {
    setClauses.push('rate_limit = ?')
    params.push(updates.rate_limit)
  }

  if (setClauses.length === 0) return false

  params.push(keyId, organizationId)

  const stmt = db.prepare(`
    UPDATE api_keys SET ${setClauses.join(', ')}
    WHERE id = ? AND organization_id = ?
  `)

  return stmt.run(...params).changes > 0
}

/**
 * Check if a scope is valid for an API key
 */
export function hasScope(apiKey: ApiKey, requiredScope: string): boolean {
  return apiKey.scopes.includes(requiredScope)
}

/**
 * Delete expired API keys
 */
export function cleanupExpiredKeys(): number {
  const stmt = db.prepare(`
    UPDATE api_keys SET status = 'revoked'
    WHERE status = 'active' AND expires_at < datetime('now')
  `)

  return stmt.run().changes
}
