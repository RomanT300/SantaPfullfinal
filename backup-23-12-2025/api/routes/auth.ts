/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { supabaseAdmin, supabaseClient } from '../lib/supabase.js'
import { authLimiter } from '../middleware/rateLimit.js'
import type { CookieOptions } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load fixed users from config file
const usersConfig = JSON.parse(
  readFileSync(join(__dirname, '../config/users.json'), 'utf-8')
)

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const isProd = process.env.NODE_ENV === 'production'

/**
 * User Registration - DISABLED
 * This application only supports 2 fixed users (admin and operador)
 * POST /api/auth/register
 */
router.post(
  '/register',
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    res.status(403).json({
      success: false,
      error: 'El registro de nuevos usuarios está deshabilitado. Solo se permiten usuarios predefinidos.'
    })
  },
)

/**
 * User Login - FIXED USERS ONLY
 * POST /api/auth/login
 */
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail(), body('password').isString()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() })
      return
    }

    const { email, password } = req.body

    // Find user in fixed users list
    const user = usersConfig.users.find((u: any) => u.email === email)

    if (!user) {
      res.status(401).json({ success: false, error: 'Credenciales inválidas' })
      return
    }

    // Validate password against bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password)

    if (!passwordMatch) {
      res.status(401).json({ success: false, error: 'Credenciales inválidas' })
      return
    }

    // Generate JWT token (include plantId for restricted users)
    const tokenPayload: any = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }

    // Add plantId for supervisor and operator roles
    if (user.plantId) {
      tokenPayload.plantId = user.plantId
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' })

    const cookieOptions: CookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'strict',
      path: '/',
      maxAge: 12 * 60 * 60 * 1000,
    }

    res.cookie('token', token, cookieOptions)
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        plantId: user.plantId || null,
      },
      token,
    })
  },
)

/**
 * Dev-only login - DISABLED
 * Use fixed user credentials instead
 * POST /api/auth/dev-login
 */
router.post(
  '/dev-login',
  authLimiter,
  async (req: Request, res: Response): Promise<void> => {
    res.status(403).json({
      success: false,
      error: 'Endpoint deshabilitado. Use /api/auth/login con las credenciales fijas.'
    })
  },
)

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  // Client-side should discard tokens; invalidate refresh if needed
  res.status(200).json({ success: true })
})

/**
 * Current user info (from JWT cookie or Authorization header)
 * GET /api/auth/me - Requires valid authentication
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  // Try to get token from cookie
  const token = req.cookies?.token

  // ALWAYS require valid token - no anonymous access
  if (!token) {
    res.status(401).json({ success: false, error: 'No authenticated' })
    return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    res.status(200).json({
      success: true,
      user: {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || null,
        plantId: decoded.plantId || null,
      }
    })
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
})

export default router
