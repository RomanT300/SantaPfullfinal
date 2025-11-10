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
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

// Trust proxy when behind nginx or similar
app.set('trust proxy', 1)

// Helmet baseline; relax COEP to avoid breaking dev assets
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// Strict CORS based on env; default allow local dev ports only
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
const devOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
]
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const list = allowedOrigins.length ? allowedOrigins : devOrigins
      if (list.includes(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
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
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', error.message)
  console.error(error.stack)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
