/**
 * Webhook Service
 * Send events to external URLs for integrations
 */
import { db } from '../lib/database.js'
import { randomUUID, createHmac } from 'crypto'
import { createAuditLog, getRequestInfo } from './auditService.js'

export interface Webhook {
  id: string
  organization_id: string
  url: string
  events: string[]
  secret: string
  status: 'active' | 'paused' | 'failed'
  failure_count: number
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

export interface WebhookEvent {
  event: string
  data: any
  timestamp: string
  organization_id: string
}

// Available webhook events
export const WEBHOOK_EVENTS = {
  // Plant events
  'plant.created': 'Cuando se crea una nueva planta',
  'plant.updated': 'Cuando se actualiza una planta',
  'plant.deleted': 'Cuando se elimina una planta',

  // Environmental data events
  'data.created': 'Cuando se registran nuevos datos ambientales',
  'data.alert': 'Cuando un parámetro excede el límite',

  // Maintenance events
  'maintenance.created': 'Cuando se crea una tarea de mantenimiento',
  'maintenance.completed': 'Cuando se completa una tarea',
  'maintenance.overdue': 'Cuando una tarea está vencida',

  // Emergency events
  'emergency.created': 'Cuando se reporta una emergencia',
  'emergency.resolved': 'Cuando se resuelve una emergencia',

  // Checklist events
  'checklist.completed': 'Cuando se completa un checklist',
  'checklist.red_flag': 'Cuando se marca una bandera roja',

  // Ticket events
  'ticket.created': 'Cuando se crea un ticket',
  'ticket.updated': 'Cuando se actualiza un ticket',
  'ticket.resolved': 'Cuando se resuelve un ticket',

  // User events
  'user.created': 'Cuando se crea un nuevo usuario',
  'user.invited': 'Cuando se invita a un usuario',

  // Document events
  'document.uploaded': 'Cuando se sube un documento',
  'document.deleted': 'Cuando se elimina un documento'
} as const

/**
 * Generate HMAC signature for webhook payload
 */
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Create a new webhook
 */
export function createWebhook(
  organizationId: string,
  data: { url: string, events: string[], userId: string },
  req?: any
): Webhook {
  const id = randomUUID()
  const secret = `whsec_${randomUUID().replace(/-/g, '')}`

  const stmt = db.prepare(`
    INSERT INTO webhooks (id, organization_id, url, events, secret, status, failure_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', 0, datetime('now'), datetime('now'))
  `)

  stmt.run(id, organizationId, data.url, JSON.stringify(data.events), secret)

  // Log the action
  const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
  createAuditLog({
    organization_id: organizationId,
    user_id: data.userId,
    action: 'webhook_created',
    entity_type: 'webhook',
    entity_id: id,
    new_value: { url: data.url, events: data.events },
    ip_address: requestInfo.ip,
    user_agent: requestInfo.userAgent
  })

  return {
    id,
    organization_id: organizationId,
    url: data.url,
    events: data.events,
    secret,
    status: 'active',
    failure_count: 0,
    last_triggered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Get all webhooks for an organization
 */
export function getWebhooks(organizationId: string): Webhook[] {
  const stmt = db.prepare(`
    SELECT * FROM webhooks WHERE organization_id = ?
    ORDER BY created_at DESC
  `)

  const webhooks = stmt.all(organizationId) as any[]

  return webhooks.map(w => ({
    ...w,
    events: JSON.parse(w.events || '[]')
  }))
}

/**
 * Get webhook by ID
 */
export function getWebhookById(organizationId: string, webhookId: string): Webhook | null {
  const stmt = db.prepare(`
    SELECT * FROM webhooks WHERE id = ? AND organization_id = ?
  `)

  const webhook = stmt.get(webhookId, organizationId) as any

  if (!webhook) return null

  return {
    ...webhook,
    events: JSON.parse(webhook.events || '[]')
  }
}

/**
 * Update webhook
 */
export function updateWebhook(
  organizationId: string,
  webhookId: string,
  updates: { url?: string, events?: string[], status?: 'active' | 'paused' }
): boolean {
  const setClauses: string[] = ['updated_at = datetime(\'now\')']
  const params: any[] = []

  if (updates.url) {
    setClauses.push('url = ?')
    params.push(updates.url)
  }

  if (updates.events) {
    setClauses.push('events = ?')
    params.push(JSON.stringify(updates.events))
  }

  if (updates.status) {
    setClauses.push('status = ?')
    params.push(updates.status)
    if (updates.status === 'active') {
      setClauses.push('failure_count = 0')
    }
  }

  params.push(webhookId, organizationId)

  const stmt = db.prepare(`
    UPDATE webhooks SET ${setClauses.join(', ')}
    WHERE id = ? AND organization_id = ?
  `)

  return stmt.run(...params).changes > 0
}

/**
 * Delete webhook
 */
export function deleteWebhook(
  organizationId: string,
  webhookId: string,
  userId: string,
  req?: any
): boolean {
  // Get webhook info first
  const webhook = getWebhookById(organizationId, webhookId)
  if (!webhook) return false

  const stmt = db.prepare(`
    DELETE FROM webhooks WHERE id = ? AND organization_id = ?
  `)

  const result = stmt.run(webhookId, organizationId)

  if (result.changes > 0) {
    const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
    createAuditLog({
      organization_id: organizationId,
      user_id: userId,
      action: 'webhook_deleted',
      entity_type: 'webhook',
      entity_id: webhookId,
      old_value: { url: webhook.url, events: webhook.events },
      ip_address: requestInfo.ip,
      user_agent: requestInfo.userAgent
    })
  }

  return result.changes > 0
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(event: WebhookEvent): Promise<void> {
  // Get all active webhooks for this organization that listen to this event
  const stmt = db.prepare(`
    SELECT * FROM webhooks
    WHERE organization_id = ? AND status = 'active'
  `)

  const webhooks = stmt.all(event.organization_id) as any[]

  for (const webhook of webhooks) {
    const events = JSON.parse(webhook.events || '[]')

    // Check if webhook listens to this event
    if (!events.includes(event.event) && !events.includes('*')) {
      continue
    }

    // Send webhook asynchronously
    sendWebhook(webhook, event).catch(err => {
      console.error(`Webhook ${webhook.id} failed:`, err.message)
    })
  }
}

/**
 * Send a webhook request
 */
async function sendWebhook(webhook: any, event: WebhookEvent): Promise<void> {
  const payload = JSON.stringify({
    id: randomUUID(),
    event: event.event,
    data: event.data,
    timestamp: event.timestamp,
    organization_id: event.organization_id
  })

  const signature = signPayload(payload, webhook.secret)
  const startTime = Date.now()

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event.event,
        'X-Webhook-Timestamp': event.timestamp,
        'User-Agent': 'PTAR-SaaS-Webhook/1.0'
      },
      body: payload,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    const duration = Date.now() - startTime
    const responseBody = await response.text().catch(() => '')

    // Log the webhook delivery
    logWebhookDelivery(
      webhook.id,
      event.event,
      payload,
      response.status,
      responseBody,
      duration
    )

    if (response.ok) {
      // Reset failure count on success
      db.prepare(`
        UPDATE webhooks SET
          last_triggered_at = datetime('now'),
          failure_count = 0,
          status = 'active'
        WHERE id = ?
      `).run(webhook.id)
    } else {
      handleWebhookFailure(webhook.id)
    }
  } catch (error: any) {
    const duration = Date.now() - startTime

    logWebhookDelivery(
      webhook.id,
      event.event,
      payload,
      0,
      error.message,
      duration
    )

    handleWebhookFailure(webhook.id)
  }
}

/**
 * Log webhook delivery attempt
 */
function logWebhookDelivery(
  webhookId: string,
  event: string,
  payload: string,
  status: number,
  responseBody: string,
  duration: number
): void {
  const stmt = db.prepare(`
    INSERT INTO webhook_logs (id, webhook_id, event, payload, response_status, response_body, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)

  stmt.run(
    randomUUID(),
    webhookId,
    event,
    payload,
    status,
    responseBody.substring(0, 10000), // Limit response body size
    duration
  )
}

/**
 * Handle webhook failure
 */
function handleWebhookFailure(webhookId: string): void {
  const stmt = db.prepare(`
    UPDATE webhooks SET
      failure_count = failure_count + 1,
      status = CASE WHEN failure_count >= 4 THEN 'failed' ELSE status END
    WHERE id = ?
  `)

  stmt.run(webhookId)
}

/**
 * Get webhook delivery logs
 */
export function getWebhookLogs(webhookId: string, limit = 50): any[] {
  const stmt = db.prepare(`
    SELECT * FROM webhook_logs
    WHERE webhook_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  return stmt.all(webhookId, limit) as any[]
}

/**
 * Retry a failed webhook delivery
 */
export async function retryWebhook(organizationId: string, webhookId: string, logId: string): Promise<boolean> {
  const webhook = getWebhookById(organizationId, webhookId)
  if (!webhook) return false

  const logStmt = db.prepare(`
    SELECT * FROM webhook_logs WHERE id = ? AND webhook_id = ?
  `)
  const log = logStmt.get(logId, webhookId) as any
  if (!log) return false

  const event: WebhookEvent = {
    event: log.event,
    data: JSON.parse(log.payload),
    timestamp: new Date().toISOString(),
    organization_id: organizationId
  }

  await sendWebhook(webhook, event)
  return true
}

/**
 * Test a webhook with a sample payload
 */
export async function testWebhook(organizationId: string, webhookId: string): Promise<{ success: boolean, status?: number, error?: string }> {
  const webhook = getWebhookById(organizationId, webhookId)
  if (!webhook) return { success: false, error: 'Webhook not found' }

  const testEvent: WebhookEvent = {
    event: 'test.ping',
    data: {
      message: 'This is a test webhook',
      organization_id: organizationId,
      webhook_id: webhookId
    },
    timestamp: new Date().toISOString(),
    organization_id: organizationId
  }

  const payload = JSON.stringify(testEvent)
  const signature = signPayload(payload, webhook.secret)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': 'test.ping',
        'User-Agent': 'PTAR-SaaS-Webhook/1.0'
      },
      body: payload,
      signal: AbortSignal.timeout(10000)
    })

    return {
      success: response.ok,
      status: response.status
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
}
