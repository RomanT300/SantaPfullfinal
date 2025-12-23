/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import analyticsRoutes from './routes/analytics.js'
import maintenanceRoutes from './routes/maintenance.js'
import documentRoutes from './routes/documents.js'
import plantsRoutes from './routes/plants.js'
import opexRoutes from './routes/opex.js'
import equipmentRoutes from './routes/equipment.js'
import notificationRoutes from './routes/notifications.js'
import checklistRoutes from './routes/checklist.js'
import dashboardRoutes from './routes/dashboard.js'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { globalErrorHandler } from './middleware/errorHandler.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

// Trust proxy when behind nginx or similar
app.set('trust proxy', 1)

const isProd = process.env.NODE_ENV === 'production'

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://localhost:3333',  // PWA local
  'http://localhost:8087',  // Expo web preview
  'http://localhost:8081',  // Expo default port
  'http://localhost:19006', // Expo web default
]

// CORS middleware - allows ngrok and other tunnels dynamically
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined

  // Allow ngrok, localhost, and other tunnel services
  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.includes('.ngrok') ||
    origin.includes('.ngrok-free.app') ||
    origin.includes('.loca.lt') ||
    origin.includes('.serveo.net') ||
    origin.includes('localhost')
  )

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, ngrok-skip-browser-warning')
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Max-Age', '86400')
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }

  next()
})

// Helmet with security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Additional security headers
    contentSecurityPolicy: isProd ? undefined : false, // Disable CSP in dev for hot reload
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
)

// Parse cookies for JWT in HttpOnly cookies
app.use(cookieParser())

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'))
}
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/maintenance', maintenanceRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/plants', plantsRoutes)
app.use('/api/opex', opexRoutes)
app.use('/api/equipment', equipmentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/checklist', checklistRoutes)
app.use('/api/dashboard', dashboardRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * Global error handler middleware (sanitizes errors in production)
 */
app.use(globalErrorHandler)

/**
 * Serve static frontend (for production/ngrok deployment)
 */
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

// Serve mobile app from /mobile path
const mobileDistPath = path.join(__dirname, '..', 'mobile-app', 'dist')
app.use('/mobile', express.static(mobileDistPath))

// Serve uploads folder
const uploadsPath = path.join(__dirname, '..', 'uploads')
app.use('/uploads', express.static(uploadsPath))

// SPA fallback - serve index.html for non-API routes
app.get('*', (req: Request, res: Response) => {
  // If it's an API route that wasn't found, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'API not found',
    })
  }
  // Mobile app routes
  if (req.path.startsWith('/mobile')) {
    return res.sendFile(path.join(mobileDistPath, 'index.html'))
  }
  // Otherwise serve the main SPA
  res.sendFile(path.join(distPath, 'index.html'))
})

export default app
