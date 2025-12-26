/**
 * Metrics Service
 * Collects and exposes application metrics for Prometheus
 */
import { db } from '../lib/database.js'

interface MetricValue {
  name: string
  help: string
  type: 'counter' | 'gauge' | 'histogram'
  value: number | { [key: string]: number }
  labels?: { [key: string]: string }[]
}

// In-memory counters (reset on server restart)
const counters: Record<string, number> = {
  http_requests_total: 0,
  http_requests_success: 0,
  http_requests_error: 0,
  auth_login_total: 0,
  auth_login_failed: 0,
  api_key_requests: 0,
  webhook_deliveries_total: 0,
  webhook_delivery_failures: 0
}

// Request timing histogram buckets
const requestDurations: number[] = []

/**
 * Increment a counter
 */
export function incrementCounter(name: string, value = 1): void {
  if (counters[name] !== undefined) {
    counters[name] += value
  }
}

/**
 * Record request duration
 */
export function recordRequestDuration(durationMs: number): void {
  requestDurations.push(durationMs)
  // Keep only last 1000 measurements
  if (requestDurations.length > 1000) {
    requestDurations.shift()
  }
}

/**
 * Get current metrics in Prometheus format
 */
export function getMetrics(): string {
  const metrics: string[] = []

  // HTTP Request counters
  metrics.push('# HELP http_requests_total Total number of HTTP requests')
  metrics.push('# TYPE http_requests_total counter')
  metrics.push(`http_requests_total ${counters.http_requests_total}`)

  metrics.push('# HELP http_requests_success Total successful HTTP requests')
  metrics.push('# TYPE http_requests_success counter')
  metrics.push(`http_requests_success ${counters.http_requests_success}`)

  metrics.push('# HELP http_requests_error Total failed HTTP requests')
  metrics.push('# TYPE http_requests_error counter')
  metrics.push(`http_requests_error ${counters.http_requests_error}`)

  // Auth counters
  metrics.push('# HELP auth_login_total Total login attempts')
  metrics.push('# TYPE auth_login_total counter')
  metrics.push(`auth_login_total ${counters.auth_login_total}`)

  metrics.push('# HELP auth_login_failed Failed login attempts')
  metrics.push('# TYPE auth_login_failed counter')
  metrics.push(`auth_login_failed ${counters.auth_login_failed}`)

  // API Key usage
  metrics.push('# HELP api_key_requests Total API key requests')
  metrics.push('# TYPE api_key_requests counter')
  metrics.push(`api_key_requests ${counters.api_key_requests}`)

  // Webhook metrics
  metrics.push('# HELP webhook_deliveries_total Total webhook deliveries')
  metrics.push('# TYPE webhook_deliveries_total counter')
  metrics.push(`webhook_deliveries_total ${counters.webhook_deliveries_total}`)

  metrics.push('# HELP webhook_delivery_failures Failed webhook deliveries')
  metrics.push('# TYPE webhook_delivery_failures counter')
  metrics.push(`webhook_delivery_failures ${counters.webhook_delivery_failures}`)

  // Request duration histogram
  if (requestDurations.length > 0) {
    const sorted = [...requestDurations].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)] / 1000
    const p95 = sorted[Math.floor(sorted.length * 0.95)] / 1000
    const p99 = sorted[Math.floor(sorted.length * 0.99)] / 1000

    metrics.push('# HELP http_request_duration_seconds Request duration in seconds')
    metrics.push('# TYPE http_request_duration_seconds summary')
    metrics.push(`http_request_duration_seconds{quantile="0.5"} ${p50.toFixed(4)}`)
    metrics.push(`http_request_duration_seconds{quantile="0.95"} ${p95.toFixed(4)}`)
    metrics.push(`http_request_duration_seconds{quantile="0.99"} ${p99.toFixed(4)}`)
    metrics.push(`http_request_duration_seconds_sum ${requestDurations.reduce((a, b) => a + b, 0) / 1000}`)
    metrics.push(`http_request_duration_seconds_count ${requestDurations.length}`)
  }

  // Database metrics from actual counts
  try {
    // Organizations
    const orgsCount = (db.prepare('SELECT COUNT(*) as count FROM organizations').get() as any)?.count || 0
    const activeOrgs = (db.prepare("SELECT COUNT(*) as count FROM organizations WHERE status = 'active'").get() as any)?.count || 0

    metrics.push('# HELP organizations_total Total number of organizations')
    metrics.push('# TYPE organizations_total gauge')
    metrics.push(`organizations_total ${orgsCount}`)
    metrics.push(`organizations_active ${activeOrgs}`)

    // Users
    const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0
    const activeUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get() as any)?.count || 0

    metrics.push('# HELP users_total Total number of users')
    metrics.push('# TYPE users_total gauge')
    metrics.push(`users_total ${usersCount}`)
    metrics.push(`users_active ${activeUsers}`)

    // Plants
    const plantsCount = (db.prepare('SELECT COUNT(*) as count FROM plants').get() as any)?.count || 0

    metrics.push('# HELP plants_total Total number of plants')
    metrics.push('# TYPE plants_total gauge')
    metrics.push(`plants_total ${plantsCount}`)

    // API Keys
    const apiKeysCount = (db.prepare("SELECT COUNT(*) as count FROM api_keys WHERE status = 'active'").get() as any)?.count || 0

    metrics.push('# HELP api_keys_active Active API keys')
    metrics.push('# TYPE api_keys_active gauge')
    metrics.push(`api_keys_active ${apiKeysCount}`)

    // Webhooks
    const webhooksCount = (db.prepare("SELECT COUNT(*) as count FROM webhooks WHERE status = 'active'").get() as any)?.count || 0

    metrics.push('# HELP webhooks_active Active webhooks')
    metrics.push('# TYPE webhooks_active gauge')
    metrics.push(`webhooks_active ${webhooksCount}`)

  } catch (e) {
    // Ignore database errors for metrics
  }

  // Node.js metrics
  const memUsage = process.memoryUsage()

  metrics.push('# HELP nodejs_heap_used_bytes Node.js heap used')
  metrics.push('# TYPE nodejs_heap_used_bytes gauge')
  metrics.push(`nodejs_heap_used_bytes ${memUsage.heapUsed}`)

  metrics.push('# HELP nodejs_heap_total_bytes Node.js heap total')
  metrics.push('# TYPE nodejs_heap_total_bytes gauge')
  metrics.push(`nodejs_heap_total_bytes ${memUsage.heapTotal}`)

  metrics.push('# HELP nodejs_external_bytes Node.js external memory')
  metrics.push('# TYPE nodejs_external_bytes gauge')
  metrics.push(`nodejs_external_bytes ${memUsage.external}`)

  metrics.push('# HELP nodejs_rss_bytes Node.js RSS')
  metrics.push('# TYPE nodejs_rss_bytes gauge')
  metrics.push(`nodejs_rss_bytes ${memUsage.rss}`)

  // Uptime
  metrics.push('# HELP process_uptime_seconds Process uptime in seconds')
  metrics.push('# TYPE process_uptime_seconds gauge')
  metrics.push(`process_uptime_seconds ${process.uptime()}`)

  return metrics.join('\n') + '\n'
}

/**
 * Metrics middleware
 */
export function metricsMiddleware(req: any, res: any, next: any): void {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    recordRequestDuration(duration)
    incrementCounter('http_requests_total')

    if (res.statusCode >= 400) {
      incrementCounter('http_requests_error')
    } else {
      incrementCounter('http_requests_success')
    }
  })

  next()
}
