/**
 * Secure Error Handler Middleware
 * Sanitizes error messages in production to prevent information leakage
 */
import type { Request, Response, NextFunction } from 'express'

const isProd = process.env.NODE_ENV === 'production'

// Known safe error messages that can be shown to users
const safeErrors = new Set([
  'Unauthorized',
  'Forbidden',
  'Not found',
  'Invalid credentials',
  'Token expired',
  'Invalid token',
  'Missing required fields',
  'Invalid file type',
  'File too large',
  'Rate limit exceeded',
])

/**
 * Sanitize error message for client response
 * In production, only show generic messages unless explicitly safe
 */
export function sanitizeErrorMessage(message: string): string {
  if (!isProd) return message

  // Check if it's a known safe message
  for (const safe of safeErrors) {
    if (message.toLowerCase().includes(safe.toLowerCase())) {
      return message
    }
  }

  // Generic message for unknown errors in production
  return 'An error occurred. Please try again.'
}

/**
 * Create a safe error response object
 */
export function createErrorResponse(error: Error, includeStack = false) {
  const response: { success: false; error: string; stack?: string } = {
    success: false,
    error: sanitizeErrorMessage(error.message),
  }

  // Only include stack trace in development
  if (includeStack && !isProd && error.stack) {
    response.stack = error.stack
  }

  return response
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error internally
  console.error('[ERROR]', new Date().toISOString(), error.message)
  if (!isProd) {
    console.error(error.stack)
  }

  // Determine status code
  const statusCode = (error as any).statusCode || (error as any).status || 500

  // Send sanitized response
  res.status(statusCode).json(createErrorResponse(error, !isProd))
}

/**
 * Async handler wrapper to catch errors in async routes
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
