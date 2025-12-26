/**
 * Structured Logger for Production
 * Replaces console.log with structured, level-based logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: {
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// Get log level from environment (default: info in production, debug in development)
const currentLevel = (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse in log aggregators)
    return JSON.stringify(entry)
  }

  // Human-readable format for development
  const { timestamp, level, message, context, error } = entry
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m'  // red
  }
  const reset = '\x1b[0m'
  const color = levelColors[level]

  let output = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`

  if (context && Object.keys(context).length > 0) {
    output += ` ${JSON.stringify(context)}`
  }

  if (error) {
    output += `\n  Error: ${error.message}`
    if (error.stack) {
      output += `\n  Stack: ${error.stack}`
    }
  }

  return output
}

function log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  }

  if (error) {
    entry.error = {
      message: error.message,
      stack: error.stack
    }
  }

  const output = formatLog(entry)

  switch (level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, any>) => log('debug', message, context),
  info: (message: string, context?: Record<string, any>) => log('info', message, context),
  warn: (message: string, context?: Record<string, any>, error?: Error) => log('warn', message, context, error),
  error: (message: string, context?: Record<string, any>, error?: Error) => log('error', message, context, error),

  // HTTP request logging helper
  request: (method: string, path: string, statusCode: number, duration: number, context?: Record<string, any>) => {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    log(level, `${method} ${path} ${statusCode}`, { ...context, duration: `${duration}ms` })
  }
}

export default logger
