/**
 * Main Express Application for Multi-Tenant SaaS
 * Configures middleware, routes, and error handling
 */
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import logger from './lib/logger.js'

// Routes - SaaS management
import authRoutes from './routes/auth.js'
import organizationRoutes from './routes/organizations.js'
import userRoutes from './routes/users.js'
import subscriptionRoutes from './routes/subscriptions.js'
import apiKeyRoutes from './routes/apiKeys.js'
import webhookRoutes from './routes/webhooks.js'
import auditRoutes from './routes/audit.js'
import twoFactorRoutes from './routes/twoFactor.js'

// Services
import { getMetrics, metricsMiddleware } from './services/metricsService.js'

// Business routes (from original software)
import plantRoutes from './routes/plants.js'
import analyticsRoutes from './routes/analytics.js'
import maintenanceRoutes from './routes/maintenance.js'
import checklistRoutes from './routes/checklist.js'
import ticketRoutes from './routes/tickets.js'
import equipmentRoutes from './routes/equipment.js'
import documentRoutes from './routes/documents.js'
import dashboardRoutes from './routes/dashboard.js'
import opexRoutes from './routes/opex.js'
import notificationRoutes from './routes/notifications.js'

// Middleware
import { requireAuth } from './middleware/auth.js'
import { requireTenant } from './middleware/tenant.js'
import { apiKeyAuth } from './middleware/apiKey.js'

const app = express()

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
const allowedOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  process.env.APP_URL
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Organization-Id']
}))

// Body parsing - Special handling for Stripe webhooks
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Metrics middleware (for Prometheus)
app.use(metricsMiddleware)

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.request(req.method, req.path, res.statusCode, duration)
  })
  next()
})

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  })
})

// Metrics endpoint for Prometheus
app.get('/metrics', (req: Request, res: Response) => {
  res.set('Content-Type', 'text/plain; charset=utf-8')
  res.send(getMetrics())
})

// API Routes

// Public routes (no auth required)
app.use('/api/auth', authRoutes)
app.use('/api/subscriptions/plans', subscriptionRoutes) // Only /plans is public
app.use('/api/subscriptions/webhook', subscriptionRoutes) // Stripe webhook

// 2FA verify is public (called during login flow)
app.post('/api/2fa/verify', twoFactorRoutes)

// Protected routes (require auth)
app.use('/api/organizations', requireAuth, organizationRoutes)
app.use('/api/users', requireAuth, userRoutes)
app.use('/api/subscriptions', requireAuth, subscriptionRoutes)
app.use('/api/api-keys', requireAuth, apiKeyRoutes)
app.use('/api/webhooks', requireAuth, webhookRoutes)
app.use('/api/audit', requireAuth, auditRoutes)
app.use('/api/2fa', requireAuth, twoFactorRoutes)

// Business routes with auth (from original software - adapted for SaaS)
app.use('/api/plants', requireAuth, plantRoutes)
app.use('/api/analytics', requireAuth, analyticsRoutes)
app.use('/api/maintenance', requireAuth, maintenanceRoutes)
app.use('/api/checklist', requireAuth, checklistRoutes)
app.use('/api/tickets', requireAuth, ticketRoutes)
app.use('/api/equipment', requireAuth, equipmentRoutes)
app.use('/api/documents', requireAuth, documentRoutes)
app.use('/api/dashboard', requireAuth, dashboardRoutes)
app.use('/api/opex', requireAuth, opexRoutes)
app.use('/api/notifications', requireAuth, notificationRoutes)

// Public API v1 routes (API key required)
// app.use('/api/v1', requireApiKey, publicApiRoutes)

// 404 handler
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  })
})

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { path: req.path, method: req.method }, err)

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    })
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    })
  }

  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN'
    })
  }

  // Generic server error
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: 'INTERNAL_ERROR'
  })
})

export default app
