/**
 * Multi-tenant Data Access Layer
 * All functions require organizationId as first parameter for tenant isolation
 */
import { db } from './database.js'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

// ======================
// ORGANIZATIONS DAL
// ======================
export const organizationsDAL = {
  getAll: (filters?: { status?: string; plan?: string; search?: string }) => {
    let query = 'SELECT * FROM organizations WHERE 1=1'
    const params: any[] = []

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.plan) {
      query += ' AND plan = ?'
      params.push(filters.plan)
    }
    if (filters?.search) {
      query += ' AND (name LIKE ? OR slug LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY created_at DESC'
    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM organizations WHERE id = ?').get(id)
  },

  getBySlug: (slug: string) => {
    return db.prepare('SELECT * FROM organizations WHERE slug = ?').get(slug)
  },

  getByStripeCustomerId: (customerId: string) => {
    return db.prepare('SELECT * FROM organizations WHERE stripe_customer_id = ?').get(customerId)
  },

  create: (data: {
    name: string
    slug: string
    plan?: string
    status?: string
    plantTypes?: string
    trialEndsAt?: string
    settings?: string
    billingEmail?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO organizations (id, name, slug, plan, status, plant_types, trial_ends_at, settings, billing_email, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.slug,
      data.plan || 'starter',
      data.status || 'active',
      data.plantTypes || 'both',
      data.trialEndsAt || null,
      data.settings || null,
      data.billingEmail || null,
      now,
      now
    )

    return organizationsDAL.getById(id)
  },

  update: (id: string, data: Partial<{
    name: string
    slug: string
    logoUrl: string
    primaryColor: string
    plantTypes: string
    plan: string
    status: string
    stripeCustomerId: string
    stripeSubscriptionId: string
    subscriptionStatus: string
    trialEndsAt: string
    billingEmail: string
    settings: string
    cancelledAt: string
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string
    adminNotes: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.slug !== undefined) { updates.push('slug = ?'); params.push(data.slug) }
    if (data.logoUrl !== undefined) { updates.push('logo_url = ?'); params.push(data.logoUrl) }
    if (data.primaryColor !== undefined) { updates.push('primary_color = ?'); params.push(data.primaryColor) }
    if (data.plantTypes !== undefined) { updates.push('plant_types = ?'); params.push(data.plantTypes) }
    if (data.plan !== undefined) { updates.push('plan = ?'); params.push(data.plan) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.stripeCustomerId !== undefined) { updates.push('stripe_customer_id = ?'); params.push(data.stripeCustomerId) }
    if (data.stripeSubscriptionId !== undefined) { updates.push('stripe_subscription_id = ?'); params.push(data.stripeSubscriptionId) }
    if (data.subscriptionStatus !== undefined) { updates.push('subscription_status = ?'); params.push(data.subscriptionStatus) }
    if (data.trialEndsAt !== undefined) { updates.push('trial_ends_at = ?'); params.push(data.trialEndsAt) }
    if (data.billingEmail !== undefined) { updates.push('billing_email = ?'); params.push(data.billingEmail) }
    if (data.settings !== undefined) { updates.push('settings = ?'); params.push(data.settings) }
    if (data.cancelledAt !== undefined) { updates.push('cancelled_at = ?'); params.push(data.cancelledAt) }
    if (data.cancelAtPeriodEnd !== undefined) { updates.push('cancel_at_period_end = ?'); params.push(data.cancelAtPeriodEnd ? 1 : 0) }
    if (data.currentPeriodEnd !== undefined) { updates.push('current_period_end = ?'); params.push(data.currentPeriodEnd) }
    if (data.adminNotes !== undefined) { updates.push('admin_notes = ?'); params.push(data.adminNotes) }

    if (updates.length === 0) return organizationsDAL.getById(id)

    updates.push("updated_at = datetime('now')")
    params.push(id)

    db.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    return organizationsDAL.getById(id)
  },

  delete: (id: string) => {
    return db.prepare('DELETE FROM organizations WHERE id = ?').run(id).changes
  },

  getStats: () => {
    return db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free,
        SUM(CASE WHEN plan = 'starter' THEN 1 ELSE 0 END) as starter,
        SUM(CASE WHEN plan = 'professional' THEN 1 ELSE 0 END) as professional,
        SUM(CASE WHEN plan = 'enterprise' THEN 1 ELSE 0 END) as enterprise
      FROM organizations
    `).get()
  }
}

// ======================
// USERS DAL
// ======================
export const usersDAL = {
  getAll: (organizationId: string, filters?: { role?: string; status?: string; search?: string }) => {
    let query = 'SELECT id, organization_id, email, name, role, plant_id, avatar_url, email_verified, last_login_at, status, created_at, updated_at FROM users WHERE organization_id = ?'
    const params: any[] = [organizationId]

    if (filters?.role) {
      query += ' AND role = ?'
      params.push(filters.role)
    }
    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.search) {
      query += ' AND (name LIKE ? OR email LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY name ASC'
    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare('SELECT id, organization_id, email, name, role, plant_id, avatar_url, email_verified, last_login_at, status, created_at, updated_at FROM users WHERE organization_id = ? AND id = ?')
      .get(organizationId, id)
  },

  getByEmail: (email: string) => {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  },

  getByEmailAndOrg: (organizationId: string, email: string) => {
    return db.prepare('SELECT * FROM users WHERE organization_id = ? AND email = ?').get(organizationId, email)
  },

  create: (organizationId: string, data: {
    email: string
    password: string
    name: string
    role: 'owner' | 'admin' | 'supervisor' | 'operator' | 'viewer'
    plantId?: string
    status?: string
  }) => {
    const id = randomUUID()
    const passwordHash = bcrypt.hashSync(data.password, 10)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO users (id, organization_id, email, password_hash, name, role, plant_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.email, passwordHash, data.name, data.role, data.plantId || null, data.status || 'active', now, now)

    return usersDAL.getById(organizationId, id)
  },

  createWithHash: (organizationId: string, data: {
    email: string
    passwordHash: string
    name: string
    role: string
    plantId?: string
    status?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO users (id, organization_id, email, password_hash, name, role, plant_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.email, data.passwordHash, data.name, data.role, data.plantId || null, data.status || 'active', now, now)

    return usersDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    email: string
    password: string
    passwordHash: string
    name: string
    role: string
    plantId: string
    avatarUrl: string
    emailVerified: boolean
    status: string
    refreshToken: string | null
    refreshTokenExpiresAt: string | null
    lastLoginAt: string
    mustChangePassword: boolean
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.email !== undefined) { updates.push('email = ?'); params.push(data.email) }
    if (data.password !== undefined) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(data.password, 10)) }
    if (data.passwordHash !== undefined) { updates.push('password_hash = ?'); params.push(data.passwordHash) }
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.role !== undefined) { updates.push('role = ?'); params.push(data.role) }
    if (data.plantId !== undefined) { updates.push('plant_id = ?'); params.push(data.plantId) }
    if (data.avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(data.avatarUrl) }
    if (data.emailVerified !== undefined) { updates.push('email_verified = ?'); params.push(data.emailVerified ? 1 : 0) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.refreshToken !== undefined) { updates.push('refresh_token = ?'); params.push(data.refreshToken) }
    if (data.refreshTokenExpiresAt !== undefined) { updates.push('refresh_token_expires_at = ?'); params.push(data.refreshTokenExpiresAt) }
    if (data.lastLoginAt !== undefined) { updates.push('last_login_at = ?'); params.push(data.lastLoginAt) }
    if (data.mustChangePassword !== undefined) { updates.push('must_change_password = ?'); params.push(data.mustChangePassword ? 1 : 0) }

    if (updates.length === 0) return usersDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return usersDAL.getById(organizationId, id)
  },

  updateLastLogin: (id: string) => {
    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM users WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  verifyPassword: (user: any, password: string): boolean => {
    return bcrypt.compareSync(password, user.password_hash)
  },

  getByIdWithPassword: (id: string) => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as { password_hash: string; [key: string]: any } | undefined
  },

  countByOrg: (organizationId: string) => {
    const result = db.prepare('SELECT COUNT(*) as count FROM users WHERE organization_id = ?').get(organizationId) as any
    return result?.count || 0
  },

  getByRefreshToken: (refreshTokenHash: string) => {
    return db.prepare('SELECT * FROM users WHERE refresh_token = ?').get(refreshTokenHash)
  },

  getByEmailInOrg: (organizationId: string, email: string) => {
    return db.prepare('SELECT * FROM users WHERE organization_id = ? AND email = ?').get(organizationId, email)
  },

  updateRefreshToken: (organizationId: string, id: string, refreshToken: string | null, expiresAt: string | null) => {
    db.prepare(`
      UPDATE users SET refresh_token = ?, refresh_token_expires_at = ?, updated_at = datetime('now')
      WHERE organization_id = ? AND id = ?
    `).run(refreshToken, expiresAt, organizationId, id)
  }
}

// ======================
// INVITATIONS DAL
// ======================
export const invitationsDAL = {
  getAll: (organizationId: string) => {
    return db.prepare(`
      SELECT i.*, u.name as invited_by_name
      FROM invitations i
      LEFT JOIN users u ON i.invited_by = u.id
      WHERE i.organization_id = ?
      ORDER BY i.created_at DESC
    `).all(organizationId)
  },

  getByToken: (token: string) => {
    return db.prepare('SELECT * FROM invitations WHERE token = ?').get(token)
  },

  create: (organizationId: string, data: {
    email: string
    role: string
    plantId?: string
    invitedBy: string
    expiresAt: string
  }) => {
    const id = randomUUID()
    const token = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO invitations (id, organization_id, email, role, plant_id, token, invited_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.email, data.role, data.plantId || null, token, data.invitedBy, data.expiresAt, now)

    return { id, token, ...data }
  },

  accept: (id: string) => {
    db.prepare("UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?").run(id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM invitations WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM invitations WHERE id = ?').get(id)
  },

  getPending: (organizationId: string) => {
    return db.prepare(`
      SELECT * FROM invitations
      WHERE organization_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).all(organizationId)
  },

  getByEmailInOrg: (organizationId: string, email: string) => {
    return db.prepare('SELECT * FROM invitations WHERE organization_id = ? AND email = ? AND accepted_at IS NULL').get(organizationId, email)
  },

  update: (id: string, data: { acceptedAt?: string }) => {
    if (data.acceptedAt) {
      db.prepare('UPDATE invitations SET accepted_at = ? WHERE id = ?').run(data.acceptedAt, id)
    }
  }
}

// ======================
// API KEYS DAL
// ======================
export const apiKeysDAL = {
  getAll: (organizationId: string) => {
    return db.prepare(`
      SELECT id, organization_id, name, key_prefix, scopes, rate_limit, last_used_at, expires_at, status, created_by, created_at
      FROM api_keys
      WHERE organization_id = ?
      ORDER BY created_at DESC
    `).all(organizationId)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare('SELECT * FROM api_keys WHERE organization_id = ? AND id = ?').get(organizationId, id)
  },

  getByPrefixAndHash: (keyPrefix: string, keyHash: string) => {
    return db.prepare('SELECT * FROM api_keys WHERE key_prefix = ? AND key_hash = ? AND status = ?').get(keyPrefix, keyHash, 'active')
  },

  create: (organizationId: string, data: {
    name: string
    keyHash: string
    keyPrefix: string
    scopes: string[]
    rateLimit?: number
    expiresAt?: string
    createdBy: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, scopes, rate_limit, expires_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.name, data.keyHash, data.keyPrefix, JSON.stringify(data.scopes), data.rateLimit || 1000, data.expiresAt || null, data.createdBy, now)

    return apiKeysDAL.getById(organizationId, id)
  },

  updateLastUsed: (id: string) => {
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(id)
  },

  revoke: (organizationId: string, id: string) => {
    db.prepare("UPDATE api_keys SET status = 'revoked' WHERE organization_id = ? AND id = ?").run(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM api_keys WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  update: (organizationId: string, id: string, data: Partial<{
    name: string
    scopes: string
    rateLimit: number
    status: string
    revokedAt: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.scopes !== undefined) { updates.push('scopes = ?'); params.push(data.scopes) }
    if (data.rateLimit !== undefined) { updates.push('rate_limit = ?'); params.push(data.rateLimit) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.revokedAt !== undefined) { updates.push('revoked_at = ?'); params.push(data.revokedAt) }

    if (updates.length === 0) return apiKeysDAL.getById(organizationId, id)

    params.push(organizationId, id)
    db.prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return apiKeysDAL.getById(organizationId, id)
  }
}

// ======================
// WEBHOOKS DAL
// ======================
export const webhooksDAL = {
  getAll: (organizationId: string) => {
    return db.prepare('SELECT * FROM webhooks WHERE organization_id = ? ORDER BY created_at DESC').all(organizationId)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare('SELECT * FROM webhooks WHERE organization_id = ? AND id = ?').get(organizationId, id)
  },

  getActiveByOrgAndEvent: (organizationId: string, event: string) => {
    const webhooks = db.prepare("SELECT * FROM webhooks WHERE organization_id = ? AND status = 'active'").all(organizationId) as any[]
    return webhooks.filter(w => {
      const events = JSON.parse(w.events || '[]')
      return events.includes(event) || events.includes('*')
    })
  },

  create: (organizationId: string, data: {
    url: string
    events: string[]
    secret: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO webhooks (id, organization_id, url, events, secret, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.url, JSON.stringify(data.events), data.secret, now, now)

    return webhooksDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    url: string
    events: string[]
    status: string
    secret: string
    failureCount: number
    lastDeliveryAt: string
    lastDeliveryStatus: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.url !== undefined) { updates.push('url = ?'); params.push(data.url) }
    if (data.events !== undefined) { updates.push('events = ?'); params.push(JSON.stringify(data.events)) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.secret !== undefined) { updates.push('secret = ?'); params.push(data.secret) }
    if (data.failureCount !== undefined) { updates.push('failure_count = ?'); params.push(data.failureCount) }
    if (data.lastDeliveryAt !== undefined) { updates.push('last_triggered_at = ?'); params.push(data.lastDeliveryAt) }

    if (updates.length === 0) return webhooksDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE webhooks SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return webhooksDAL.getById(organizationId, id)
  },

  getByEvent: (organizationId: string, event: string) => {
    const webhooks = db.prepare("SELECT * FROM webhooks WHERE organization_id = ? AND status = 'active'").all(organizationId) as any[]
    return webhooks.filter(w => {
      const events = JSON.parse(w.events || '[]')
      return events.includes(event) || events.includes('*')
    })
  },

  incrementFailureCount: (id: string) => {
    db.prepare('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?').run(id)
    // Auto-pause after 10 failures
    db.prepare("UPDATE webhooks SET status = 'failed' WHERE id = ? AND failure_count >= 10").run(id)
  },

  resetFailureCount: (id: string) => {
    db.prepare("UPDATE webhooks SET failure_count = 0, last_triggered_at = datetime('now') WHERE id = ?").run(id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM webhooks WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  }
}

// ======================
// WEBHOOK LOGS DAL
// ======================
export const webhookLogsDAL = {
  getByWebhookId: (webhookId: string, options?: { limit?: number; offset?: number } | number) => {
    const limit = typeof options === 'number' ? options : (options?.limit || 50)
    const offset = typeof options === 'object' ? (options?.offset || 0) : 0
    return db.prepare('SELECT * FROM webhook_logs WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(webhookId, limit, offset)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM webhook_logs WHERE id = ?').get(id)
  },

  create: (data: {
    webhookId: string
    event: string
    payload: any
    responseStatus?: number
    statusCode?: number
    responseBody?: string
    response?: string
    durationMs?: number
    duration?: number
    success?: boolean
    retryOf?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()
    const status = data.responseStatus || data.statusCode || null
    const body = data.responseBody || data.response || null
    const duration = data.durationMs || data.duration || null

    db.prepare(`
      INSERT INTO webhook_logs (id, webhook_id, event, payload, response_status, response_body, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.webhookId, data.event, typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload), status, body, duration, now)

    return { id, ...data }
  }
}

// ======================
// AUDIT LOGS DAL
// ======================
export const auditLogsDAL = {
  countForMonth: (organizationId: string, year?: number, month?: number) => {
    const now = new Date()
    const y = year || now.getFullYear()
    const m = month || (now.getMonth() + 1)
    const startOfMonth = `${y}-${String(m).padStart(2, '0')}-01`
    const endOfMonth = `${y}-${String(m).padStart(2, '0')}-31 23:59:59`

    const result = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
    `).get(organizationId, startOfMonth, endOfMonth) as { count: number } | undefined

    return result?.count || 0
  },

  getAll: (organizationId: string, filters?: { entityType?: string; userId?: string; action?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    let query = 'SELECT * FROM audit_logs WHERE organization_id = ?'
    const params: any[] = [organizationId]

    if (filters?.entityType) {
      query += ' AND entity_type = ?'
      params.push(filters.entityType)
    }
    if (filters?.userId) {
      query += ' AND user_id = ?'
      params.push(filters.userId)
    }
    if (filters?.action) {
      query += ' AND action LIKE ?'
      params.push(`%${filters.action}%`)
    }
    if (filters?.from) {
      query += ' AND created_at >= ?'
      params.push(filters.from)
    }
    if (filters?.to) {
      query += ' AND created_at <= ?'
      params.push(filters.to)
    }

    query += ' ORDER BY created_at DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  create: (organizationId: string, data: {
    userId?: string
    action: string
    entityType: string
    entityId?: string
    oldValue?: any
    newValue?: any
    ipAddress?: string
    userAgent?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      organizationId,
      data.userId || null,
      data.action,
      data.entityType,
      data.entityId || null,
      data.oldValue ? JSON.stringify(data.oldValue) : null,
      data.newValue ? JSON.stringify(data.newValue) : null,
      data.ipAddress || null,
      data.userAgent || null,
      now
    )

    return { id, organizationId, ...data, createdAt: now }
  }
}

// ======================
// PLANTS DAL
// ======================
export const plantsDAL = {
  getAll: (organizationId: string, filters?: { search?: string; status?: string }) => {
    let query = 'SELECT * FROM plants WHERE organization_id = ?'
    const params: any[] = [organizationId]

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }
    if (filters?.search) {
      query += ' AND (name LIKE ? OR location LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY name ASC'
    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare('SELECT * FROM plants WHERE organization_id = ? AND id = ?').get(organizationId, id)
  },

  create: (organizationId: string, data: {
    name: string
    location?: string
    latitude?: number
    longitude?: number
    status?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO plants (id, organization_id, name, location, latitude, longitude, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.name, data.location || null, data.latitude || null, data.longitude || null, data.status || 'active', now, now)

    return plantsDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    name: string
    location: string
    latitude: number
    longitude: number
    status: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name) }
    if (data.location !== undefined) { updates.push('location = ?'); params.push(data.location) }
    if (data.latitude !== undefined) { updates.push('latitude = ?'); params.push(data.latitude) }
    if (data.longitude !== undefined) { updates.push('longitude = ?'); params.push(data.longitude) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }

    if (updates.length === 0) return plantsDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE plants SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return plantsDAL.getById(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM plants WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  countByOrg: (organizationId: string) => {
    const result = db.prepare('SELECT COUNT(*) as count FROM plants WHERE organization_id = ?').get(organizationId) as any
    return result?.count || 0
  }
}

// ======================
// ENVIRONMENTAL DATA DAL
// ======================
export const environmentalDAL = {
  getAll: (organizationId: string, filters?: {
    plantId?: string
    parameter?: string
    stream?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) => {
    let query = `
      SELECT e.*, p.name as plant_name
      FROM environmental_data e
      LEFT JOIN plants p ON e.plant_id = p.id
      WHERE e.organization_id = ?
    `
    const params: any[] = [organizationId]

    if (filters?.plantId) {
      query += ' AND e.plant_id = ?'
      params.push(filters.plantId)
    }
    if (filters?.parameter) {
      query += ' AND e.parameter = ?'
      params.push(filters.parameter)
    }
    if (filters?.stream) {
      query += ' AND e.stream = ?'
      params.push(filters.stream)
    }
    if (filters?.startDate) {
      query += ' AND e.date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += ' AND e.date <= ?'
      params.push(filters.endDate)
    }

    query += ' ORDER BY e.date DESC, e.parameter ASC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  create: (organizationId: string, data: {
    plantId: string
    date: string
    parameter: string
    stream: 'influent' | 'effluent'
    value: number
    unit?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO environmental_data (id, organization_id, plant_id, date, parameter, stream, value, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.plantId, data.date, data.parameter, data.stream, data.value, data.unit || null, now)

    return { id, organizationId, ...data, createdAt: now }
  },

  bulkCreate: (organizationId: string, records: Array<{
    plantId: string
    date: string
    parameter: string
    stream: 'influent' | 'effluent'
    value: number
    unit?: string
  }>) => {
    const insert = db.prepare(`
      INSERT INTO environmental_data (id, organization_id, plant_id, date, parameter, stream, value, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()
    const transaction = db.transaction((recs) => {
      for (const rec of recs) {
        insert.run(randomUUID(), organizationId, rec.plantId, rec.date, rec.parameter, rec.stream, rec.value, rec.unit || null, now)
      }
    })

    transaction(records)
    return records.length
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM environmental_data WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  }
}

// ======================
// TICKETS DAL
// ======================
export const ticketsDAL = {
  generateTicketNumber: (organizationId: string) => {
    const year = new Date().getFullYear()
    const count = db.prepare(`
      SELECT COUNT(*) as count FROM tickets
      WHERE organization_id = ? AND ticket_number LIKE ?
    `).get(organizationId, `TKT-${year}-%`) as any

    const nextNum = (count?.count || 0) + 1
    return `TKT-${year}-${String(nextNum).padStart(5, '0')}`
  },

  getAll: (organizationId: string, filters?: {
    plantId?: string
    status?: string
    category?: string
    priority?: string
    from?: string
    to?: string
    search?: string
  }) => {
    let query = `
      SELECT t.*, p.name as plant_name
      FROM tickets t
      LEFT JOIN plants p ON t.plant_id = p.id
      WHERE t.organization_id = ?
    `
    const params: any[] = [organizationId]

    if (filters?.plantId) {
      query += ' AND t.plant_id = ?'
      params.push(filters.plantId)
    }
    if (filters?.status) {
      query += ' AND t.status = ?'
      params.push(filters.status)
    }
    if (filters?.category) {
      query += ' AND t.category = ?'
      params.push(filters.category)
    }
    if (filters?.priority) {
      query += ' AND t.priority = ?'
      params.push(filters.priority)
    }
    if (filters?.from) {
      query += ' AND t.created_at >= ?'
      params.push(filters.from)
    }
    if (filters?.to) {
      query += ' AND t.created_at <= ?'
      params.push(filters.to)
    }
    if (filters?.search) {
      query += ' AND (t.subject LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY t.created_at DESC'
    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare('SELECT * FROM tickets WHERE organization_id = ? AND id = ?').get(organizationId, id)
  },

  create: (organizationId: string, data: {
    plantId: string
    subject: string
    description?: string
    category: string
    priority?: string
    requesterName: string
    requesterEmail?: string
    requesterPhone?: string
    assignedTo?: string
  }) => {
    const id = randomUUID()
    const ticketNumber = ticketsDAL.generateTicketNumber(organizationId)
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO tickets (id, organization_id, plant_id, ticket_number, subject, description, category, priority, requester_name, requester_email, requester_phone, assigned_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, organizationId, data.plantId, ticketNumber, data.subject, data.description || null,
      data.category, data.priority || 'medium', data.requesterName, data.requesterEmail || null,
      data.requesterPhone || null, data.assignedTo || null, now, now
    )

    return ticketsDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    subject: string
    description: string
    category: string
    priority: string
    status: string
    assignedTo: string
    resolvedAt: string
    resolutionNotes: string
    sentViaEmail: boolean
    sentViaWhatsapp: boolean
    emailSentAt: string
    whatsappSentAt: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.subject !== undefined) { updates.push('subject = ?'); params.push(data.subject) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.category !== undefined) { updates.push('category = ?'); params.push(data.category) }
    if (data.priority !== undefined) { updates.push('priority = ?'); params.push(data.priority) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(data.assignedTo) }
    if (data.resolvedAt !== undefined) { updates.push('resolved_at = ?'); params.push(data.resolvedAt) }
    if (data.resolutionNotes !== undefined) { updates.push('resolution_notes = ?'); params.push(data.resolutionNotes) }
    if (data.sentViaEmail !== undefined) { updates.push('sent_via_email = ?'); params.push(data.sentViaEmail ? 1 : 0) }
    if (data.sentViaWhatsapp !== undefined) { updates.push('sent_via_whatsapp = ?'); params.push(data.sentViaWhatsapp ? 1 : 0) }
    if (data.emailSentAt !== undefined) { updates.push('email_sent_at = ?'); params.push(data.emailSentAt) }
    if (data.whatsappSentAt !== undefined) { updates.push('whatsapp_sent_at = ?'); params.push(data.whatsappSentAt) }

    if (updates.length === 0) return ticketsDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return ticketsDAL.getById(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM tickets WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  getStats: (organizationId: string, plantId?: string) => {
    let query = 'SELECT status, COUNT(*) as count FROM tickets WHERE organization_id = ?'
    const params: any[] = [organizationId]

    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    query += ' GROUP BY status'
    const rows = db.prepare(query).all(...params) as any[]

    return {
      total: rows.reduce((sum, r) => sum + r.count, 0),
      open: rows.find(r => r.status === 'open')?.count || 0,
      inProgress: rows.find(r => r.status === 'in_progress')?.count || 0,
      waiting: rows.find(r => r.status === 'waiting')?.count || 0,
      resolved: rows.find(r => r.status === 'resolved')?.count || 0,
      closed: rows.find(r => r.status === 'closed')?.count || 0
    }
  }
}

// ======================
// TICKET COMMENTS DAL
// ======================
export const ticketCommentsDAL = {
  getByTicketId: (organizationId: string, ticketId: string) => {
    return db.prepare('SELECT * FROM ticket_comments WHERE organization_id = ? AND ticket_id = ? ORDER BY created_at ASC')
      .all(organizationId, ticketId)
  },

  create: (organizationId: string, data: {
    ticketId: string
    authorName: string
    authorEmail?: string
    comment: string
    isInternal?: boolean
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO ticket_comments (id, organization_id, ticket_id, author_name, author_email, comment, is_internal, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, organizationId, data.ticketId, data.authorName, data.authorEmail || null, data.comment, data.isInternal ? 1 : 0, now)

    return { id, organizationId, ...data, createdAt: now }
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM ticket_comments WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  }
}

// ======================
// MAINTENANCE TASKS DAL
// ======================
export const maintenanceTasksDAL = {
  getAll: (organizationId: string, filters?: {
    plantId?: string
    status?: string
    periodicity?: string
    from?: string
    to?: string
    assignedTo?: string
    limit?: number
    offset?: number
  }) => {
    let query = `
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.organization_id = ?
    `
    const params: any[] = [organizationId]

    if (filters?.plantId) {
      query += ' AND mt.plant_id = ?'
      params.push(filters.plantId)
    }
    if (filters?.status) {
      query += ' AND mt.status = ?'
      params.push(filters.status)
    }
    if (filters?.periodicity) {
      query += ' AND mt.periodicity = ?'
      params.push(filters.periodicity)
    }
    if (filters?.from) {
      query += ' AND mt.next_due >= ?'
      params.push(filters.from)
    }
    if (filters?.to) {
      query += ' AND mt.next_due <= ?'
      params.push(filters.to)
    }
    if (filters?.assignedTo) {
      query += ' AND mt.assigned_to = ?'
      params.push(filters.assignedTo)
    }

    query += ' ORDER BY mt.next_due ASC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare(`
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.organization_id = ? AND mt.id = ?
    `).get(organizationId, id)
  },

  create: (organizationId: string, data: {
    plantId: string
    taskName: string
    description?: string
    periodicity?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'
    nextDue?: string
    assignedTo?: string
    notes?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO maintenance_tasks (id, organization_id, plant_id, task_name, description, periodicity, next_due, assigned_to, notes, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      organizationId,
      data.plantId,
      data.taskName,
      data.description || null,
      data.periodicity || 'monthly',
      data.nextDue || null,
      data.assignedTo || null,
      data.notes || null,
      now,
      now
    )

    return maintenanceTasksDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    taskName: string
    description: string
    periodicity: string
    nextDue: string
    lastCompleted: string
    status: 'pending' | 'completed' | 'overdue' | 'skipped'
    assignedTo: string
    notes: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.taskName !== undefined) { updates.push('task_name = ?'); params.push(data.taskName) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.periodicity !== undefined) { updates.push('periodicity = ?'); params.push(data.periodicity) }
    if (data.nextDue !== undefined) { updates.push('next_due = ?'); params.push(data.nextDue) }
    if (data.lastCompleted !== undefined) { updates.push('last_completed = ?'); params.push(data.lastCompleted) }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status) }
    if (data.assignedTo !== undefined) { updates.push('assigned_to = ?'); params.push(data.assignedTo) }
    if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes) }

    if (updates.length === 0) return maintenanceTasksDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE maintenance_tasks SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return maintenanceTasksDAL.getById(organizationId, id)
  },

  complete: (organizationId: string, id: string, notes?: string) => {
    const now = new Date().toISOString()
    const task = maintenanceTasksDAL.getById(organizationId, id) as any
    if (!task) return null

    // Calculate next due date based on periodicity
    let nextDue: string | null = null
    if (task.periodicity) {
      const date = new Date()
      switch (task.periodicity) {
        case 'daily': date.setDate(date.getDate() + 1); break
        case 'weekly': date.setDate(date.getDate() + 7); break
        case 'biweekly': date.setDate(date.getDate() + 14); break
        case 'monthly': date.setMonth(date.getMonth() + 1); break
        case 'quarterly': date.setMonth(date.getMonth() + 3); break
        case 'semiannual': date.setMonth(date.getMonth() + 6); break
        case 'annual': date.setFullYear(date.getFullYear() + 1); break
      }
      nextDue = date.toISOString()
    }

    db.prepare(`
      UPDATE maintenance_tasks
      SET status = 'completed', last_completed = ?, next_due = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
      WHERE organization_id = ? AND id = ?
    `).run(now, nextDue, notes || null, organizationId, id)

    return maintenanceTasksDAL.getById(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM maintenance_tasks WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  getStats: (organizationId: string, plantId?: string) => {
    let query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'overdue' OR (status = 'pending' AND next_due < datetime('now')) THEN 1 ELSE 0 END) as overdue
      FROM maintenance_tasks
      WHERE organization_id = ?
    `
    const params: any[] = [organizationId]

    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    return db.prepare(query).get(...params)
  },

  markOverdue: (organizationId: string) => {
    return db.prepare(`
      UPDATE maintenance_tasks
      SET status = 'overdue', updated_at = datetime('now')
      WHERE organization_id = ? AND status = 'pending' AND next_due < datetime('now')
    `).run(organizationId).changes
  }
}

// ======================
// MAINTENANCE EMERGENCIES DAL
// ======================
export const maintenanceEmergenciesDAL = {
  getAll: (organizationId: string, filters?: {
    plantId?: string
    status?: string
    severity?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }) => {
    let query = `
      SELECT me.*, p.name as plant_name
      FROM maintenance_emergencies me
      LEFT JOIN plants p ON me.plant_id = p.id
      WHERE me.organization_id = ?
    `
    const params: any[] = [organizationId]

    if (filters?.plantId) {
      query += ' AND me.plant_id = ?'
      params.push(filters.plantId)
    }
    if (filters?.status) {
      query += ' AND me.status = ?'
      params.push(filters.status)
    }
    if (filters?.severity) {
      query += ' AND me.severity = ?'
      params.push(filters.severity)
    }
    if (filters?.from) {
      query += ' AND me.reported_at >= ?'
      params.push(filters.from)
    }
    if (filters?.to) {
      query += ' AND me.reported_at <= ?'
      params.push(filters.to)
    }

    query += ' ORDER BY me.reported_at DESC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare(`
      SELECT me.*, p.name as plant_name
      FROM maintenance_emergencies me
      LEFT JOIN plants p ON me.plant_id = p.id
      WHERE me.organization_id = ? AND me.id = ?
    `).get(organizationId, id)
  },

  create: (organizationId: string, data: {
    plantId: string
    title: string
    description?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
    reportedBy?: string
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO maintenance_emergencies (id, organization_id, plant_id, title, description, severity, status, reported_by, reported_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      id,
      organizationId,
      data.plantId,
      data.title,
      data.description || null,
      data.severity || 'medium',
      data.reportedBy || null,
      now,
      now,
      now
    )

    return maintenanceEmergenciesDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    title: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    resolutionNotes: string
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.severity !== undefined) { updates.push('severity = ?'); params.push(data.severity) }
    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
      if (data.status === 'resolved' || data.status === 'closed') {
        updates.push('resolved_at = datetime(\'now\')')
      }
    }
    if (data.resolutionNotes !== undefined) { updates.push('resolution_notes = ?'); params.push(data.resolutionNotes) }

    if (updates.length === 0) return maintenanceEmergenciesDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE maintenance_emergencies SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return maintenanceEmergenciesDAL.getById(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM maintenance_emergencies WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  getStats: (organizationId: string, plantId?: string) => {
    let query = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN severity = 'critical' AND status IN ('open', 'in_progress') THEN 1 ELSE 0 END) as critical_active
      FROM maintenance_emergencies
      WHERE organization_id = ?
    `
    const params: any[] = [organizationId]

    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    return db.prepare(query).get(...params)
  }
}

// ======================
// OPEX COSTS DAL
// ======================
export const opexCostsDAL = {
  getAll: (organizationId: string, filters?: {
    plantId?: string
    year?: number
    month?: number
    category?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }) => {
    let query = `
      SELECT oc.*, p.name as plant_name
      FROM opex_costs oc
      LEFT JOIN plants p ON oc.plant_id = p.id
      WHERE oc.organization_id = ?
    `
    const params: any[] = [organizationId]

    if (filters?.plantId) {
      query += ' AND oc.plant_id = ?'
      params.push(filters.plantId)
    }
    if (filters?.year) {
      query += ' AND oc.year = ?'
      params.push(filters.year)
    }
    if (filters?.month) {
      query += ' AND oc.month = ?'
      params.push(filters.month)
    }
    if (filters?.category) {
      query += ' AND oc.category = ?'
      params.push(filters.category)
    }

    query += ' ORDER BY oc.year DESC, oc.month DESC, oc.category ASC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  getById: (organizationId: string, id: string) => {
    return db.prepare(`
      SELECT oc.*, p.name as plant_name
      FROM opex_costs oc
      LEFT JOIN plants p ON oc.plant_id = p.id
      WHERE oc.organization_id = ? AND oc.id = ?
    `).get(organizationId, id)
  },

  create: (organizationId: string, data: {
    plantId: string
    year: number
    month: number
    category: string
    description?: string
    amount: number
    currency?: string
    volumeM3?: number
    costPerM3?: number
  }) => {
    const id = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO opex_costs (id, organization_id, plant_id, year, month, category, description, amount, currency, volume_m3, cost_per_m3, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      organizationId,
      data.plantId,
      data.year,
      data.month,
      data.category,
      data.description || null,
      data.amount,
      data.currency || 'USD',
      data.volumeM3 || null,
      data.costPerM3 || null,
      now,
      now
    )

    return opexCostsDAL.getById(organizationId, id)
  },

  update: (organizationId: string, id: string, data: Partial<{
    year: number
    month: number
    category: string
    description: string
    amount: number
    currency: string
    volumeM3: number
    costPerM3: number
  }>) => {
    const updates: string[] = []
    const params: any[] = []

    if (data.year !== undefined) { updates.push('year = ?'); params.push(data.year) }
    if (data.month !== undefined) { updates.push('month = ?'); params.push(data.month) }
    if (data.category !== undefined) { updates.push('category = ?'); params.push(data.category) }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description) }
    if (data.amount !== undefined) { updates.push('amount = ?'); params.push(data.amount) }
    if (data.currency !== undefined) { updates.push('currency = ?'); params.push(data.currency) }
    if (data.volumeM3 !== undefined) { updates.push('volume_m3 = ?'); params.push(data.volumeM3) }
    if (data.costPerM3 !== undefined) { updates.push('cost_per_m3 = ?'); params.push(data.costPerM3) }

    if (updates.length === 0) return opexCostsDAL.getById(organizationId, id)

    updates.push("updated_at = datetime('now')")
    params.push(organizationId, id)

    db.prepare(`UPDATE opex_costs SET ${updates.join(', ')} WHERE organization_id = ? AND id = ?`).run(...params)
    return opexCostsDAL.getById(organizationId, id)
  },

  delete: (organizationId: string, id: string) => {
    return db.prepare('DELETE FROM opex_costs WHERE organization_id = ? AND id = ?').run(organizationId, id).changes
  },

  bulkCreate: (organizationId: string, records: Array<{
    plantId: string
    year: number
    month: number
    category: string
    description?: string
    amount: number
    currency?: string
    volumeM3?: number
    costPerM3?: number
  }>) => {
    const insert = db.prepare(`
      INSERT INTO opex_costs (id, organization_id, plant_id, year, month, category, description, amount, currency, volume_m3, cost_per_m3, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()
    const transaction = db.transaction((recs) => {
      for (const rec of recs) {
        insert.run(
          randomUUID(),
          organizationId,
          rec.plantId,
          rec.year,
          rec.month,
          rec.category,
          rec.description || null,
          rec.amount,
          rec.currency || 'USD',
          rec.volumeM3 || null,
          rec.costPerM3 || null,
          now,
          now
        )
      }
    })

    transaction(records)
    return records.length
  },

  getSummary: (organizationId: string, year?: number, plantId?: string) => {
    let query = `
      SELECT
        category,
        SUM(amount) as total_amount,
        SUM(volume_m3) as total_volume,
        AVG(cost_per_m3) as avg_cost_per_m3,
        COUNT(*) as entries
      FROM opex_costs
      WHERE organization_id = ?
    `
    const params: any[] = [organizationId]

    if (year) {
      query += ' AND year = ?'
      params.push(year)
    }
    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    query += ' GROUP BY category ORDER BY total_amount DESC'

    return db.prepare(query).all(...params)
  },

  getMonthlyTrend: (organizationId: string, year?: number, plantId?: string) => {
    const targetYear = year || new Date().getFullYear()

    let query = `
      SELECT
        month,
        SUM(amount) as total_amount,
        SUM(volume_m3) as total_volume
      FROM opex_costs
      WHERE organization_id = ? AND year = ?
    `
    const params: any[] = [organizationId, targetYear]

    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    query += ' GROUP BY month ORDER BY month ASC'

    return db.prepare(query).all(...params)
  },

  getByPlant: (organizationId: string, plantId: string, year?: number) => {
    let query = `
      SELECT
        month,
        category,
        SUM(amount) as total_amount,
        SUM(volume_m3) as total_volume
      FROM opex_costs
      WHERE organization_id = ? AND plant_id = ?
    `
    const params: any[] = [organizationId, plantId]

    if (year) {
      query += ' AND year = ?'
      params.push(year)
    }

    query += ' GROUP BY month, category ORDER BY month ASC, category ASC'

    return db.prepare(query).all(...params)
  },

  getTotalByYear: (organizationId: string, year: number) => {
    return db.prepare(`
      SELECT
        SUM(amount) as total_amount,
        SUM(volume_m3) as total_volume,
        COUNT(DISTINCT plant_id) as plants_count
      FROM opex_costs
      WHERE organization_id = ? AND year = ?
    `).get(organizationId, year)
  }
}

export default {
  organizationsDAL,
  usersDAL,
  invitationsDAL,
  apiKeysDAL,
  webhooksDAL,
  webhookLogsDAL,
  auditLogsDAL,
  plantsDAL,
  environmentalDAL,
  ticketsDAL,
  ticketCommentsDAL,
  maintenanceTasksDAL,
  maintenanceEmergenciesDAL,
  opexCostsDAL
}
