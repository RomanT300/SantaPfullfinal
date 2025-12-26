import rateLimit from 'express-rate-limit'

// Generic write limiter: 100 requests per 15 minutes per IP
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try later' },
})

// Auth limiter: stricter to protect login/register endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please try later' },
})