/**
 * Audit Log Service
 * Tracks all user actions for security and compliance
 */
import { db } from '../lib/database.js'
import { randomUUID } from 'crypto'

export interface AuditLogEntry {
  id?: string
  organization_id: string
  user_id?: string
  action: AuditAction
  entity_type: string
  entity_id?: string
  old_value?: any
  new_value?: any
  ip_address?: string
  user_agent?: string
  created_at?: string
}

export type AuditAction =
  // Auth actions
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_changed'
  | 'password_reset'
  | '2fa_enabled'
  | '2fa_disabled'
  // User actions
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_invited'
  | 'user_suspended'
  | 'user_activated'
  | 'role_changed'
  // Organization actions
  | 'org_settings_updated'
  | 'org_plan_changed'
  // Plant actions
  | 'plant_created'
  | 'plant_updated'
  | 'plant_deleted'
  // Data actions
  | 'data_created'
  | 'data_updated'
  | 'data_deleted'
  | 'data_exported'
  // API/Webhook actions
  | 'api_key_created'
  | 'api_key_revoked'
  | 'webhook_created'
  | 'webhook_updated'
  | 'webhook_deleted'
  // Document actions
  | 'document_uploaded'
  | 'document_downloaded'
  | 'document_deleted'
  // Billing actions
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_succeeded'
  | 'payment_failed'

/**
 * Create an audit log entry
 */
export function createAuditLog(entry: AuditLogEntry): string {
  const id = entry.id || randomUUID()

  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)

  stmt.run(
    id,
    entry.organization_id,
    entry.user_id || null,
    entry.action,
    entry.entity_type,
    entry.entity_id || null,
    entry.old_value ? JSON.stringify(entry.old_value) : null,
    entry.new_value ? JSON.stringify(entry.new_value) : null,
    entry.ip_address || null,
    entry.user_agent || null
  )

  return id
}

/**
 * Get audit logs for an organization
 */
export function getAuditLogs(
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    action?: AuditAction
    entity_type?: string
    user_id?: string
    from_date?: string
    to_date?: string
  } = {}
): { logs: any[], total: number } {
  const { limit = 50, offset = 0, action, entity_type, user_id, from_date, to_date } = options

  let whereClause = 'WHERE organization_id = ?'
  const params: any[] = [organizationId]

  if (action) {
    whereClause += ' AND action = ?'
    params.push(action)
  }

  if (entity_type) {
    whereClause += ' AND entity_type = ?'
    params.push(entity_type)
  }

  if (user_id) {
    whereClause += ' AND user_id = ?'
    params.push(user_id)
  }

  if (from_date) {
    whereClause += ' AND created_at >= ?'
    params.push(from_date)
  }

  if (to_date) {
    whereClause += ' AND created_at <= ?'
    params.push(to_date)
  }

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${whereClause}`)
  const countResult = countStmt.get(...params) as any
  const total = countResult?.count || 0

  // Get logs with user info
  const logsStmt = db.prepare(`
    SELECT
      a.*,
      u.name as user_name,
      u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `)

  const logs = logsStmt.all(...params, limit, offset) as any[]

  // Parse JSON values
  return {
    logs: logs.map(log => ({
      ...log,
      old_value: log.old_value ? JSON.parse(log.old_value) : null,
      new_value: log.new_value ? JSON.parse(log.new_value) : null
    })),
    total
  }
}

/**
 * Get recent activity for a user
 */
export function getUserActivity(organizationId: string, userId: string, limit = 20): any[] {
  const stmt = db.prepare(`
    SELECT * FROM audit_logs
    WHERE organization_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  return stmt.all(organizationId, userId, limit) as any[]
}

/**
 * Get security events (login attempts, password changes, etc.)
 */
export function getSecurityEvents(organizationId: string, limit = 50): any[] {
  const securityActions = [
    'login', 'logout', 'login_failed', 'password_changed', 'password_reset',
    '2fa_enabled', '2fa_disabled', 'api_key_created', 'api_key_revoked'
  ]

  const placeholders = securityActions.map(() => '?').join(',')

  const stmt = db.prepare(`
    SELECT
      a.*,
      u.name as user_name,
      u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.organization_id = ? AND a.action IN (${placeholders})
    ORDER BY a.created_at DESC
    LIMIT ?
  `)

  return stmt.all(organizationId, ...securityActions, limit) as any[]
}

/**
 * Delete old audit logs (retention policy)
 */
export function cleanupOldLogs(organizationId: string, retentionDays = 90): number {
  const stmt = db.prepare(`
    DELETE FROM audit_logs
    WHERE organization_id = ?
    AND created_at < datetime('now', '-' || ? || ' days')
  `)

  const result = stmt.run(organizationId, retentionDays)
  return result.changes
}

/**
 * Export audit logs as CSV
 */
export function exportAuditLogs(
  organizationId: string,
  from_date?: string,
  to_date?: string
): string {
  let whereClause = 'WHERE organization_id = ?'
  const params: any[] = [organizationId]

  if (from_date) {
    whereClause += ' AND created_at >= ?'
    params.push(from_date)
  }

  if (to_date) {
    whereClause += ' AND created_at <= ?'
    params.push(to_date)
  }

  const stmt = db.prepare(`
    SELECT
      a.created_at,
      u.email as user_email,
      a.action,
      a.entity_type,
      a.entity_id,
      a.ip_address
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ${whereClause}
    ORDER BY a.created_at DESC
  `)

  const logs = stmt.all(...params) as any[]

  // Convert to CSV
  const headers = ['Fecha', 'Usuario', 'Acción', 'Tipo', 'ID Entidad', 'IP']
  const rows = logs.map(log => [
    log.created_at,
    log.user_email || 'Sistema',
    log.action,
    log.entity_type,
    log.entity_id || '',
    log.ip_address || ''
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}

/**
 * Middleware to extract request info for audit logging
 */
export function getRequestInfo(req: any): { ip: string, userAgent: string } {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'

  const userAgent = req.headers['user-agent'] || 'unknown'

  return { ip, userAgent }
}
