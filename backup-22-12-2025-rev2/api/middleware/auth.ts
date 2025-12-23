import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const isProd = process.env.NODE_ENV === 'production'
const rawSecret = process.env.JWT_SECRET || ''
let JWT_SECRET = rawSecret
if (!rawSecret || rawSecret.length < 32) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set and at least 32 characters in production')
  } else {
    console.warn('[security] Weak/missing JWT_SECRET; using dev-secret (development only)')
    JWT_SECRET = 'dev-secret'
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  let token: string | undefined
  if (auth?.startsWith('Bearer ')) {
    token = auth.split(' ')[1]
  } else {
    // Fallback to cookie: 'token'
    token = (req as any).cookies?.token
  }
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    ;(req as any).user = payload
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Forbidden' })
  }
  next()
}