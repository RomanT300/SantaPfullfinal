/**
 * Two-Factor Authentication Service
 * Implements TOTP (Time-based One-Time Password)
 * Compatible with Google Authenticator, Authy, etc.
 */
import { db } from '../lib/database.js'
import { randomBytes, createHmac } from 'crypto'
import { createAuditLog, getRequestInfo } from './auditService.js'

// TOTP configuration
const TOTP_DIGITS = 6
const TOTP_PERIOD = 30 // seconds
const TOTP_ALGORITHM = 'sha1'

// Recovery codes configuration
const RECOVERY_CODE_COUNT = 10
const RECOVERY_CODE_LENGTH = 8

export interface TwoFactorSetup {
  secret: string
  qrCodeUrl: string
  recoveryCodes: string[]
}

/**
 * Generate a random base32 secret
 */
function generateSecret(length = 20): string {
  const buffer = randomBytes(length)
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''

  for (let i = 0; i < buffer.length; i++) {
    secret += base32Chars[buffer[i] % 32]
  }

  return secret
}

/**
 * Decode base32 string to buffer
 */
function base32Decode(encoded: string): Buffer {
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const lookup: Record<string, number> = {}
  base32Chars.split('').forEach((char, i) => {
    lookup[char] = i
  })

  const bits: number[] = []
  for (const char of encoded.toUpperCase()) {
    if (lookup[char] !== undefined) {
      for (let j = 4; j >= 0; j--) {
        bits.push((lookup[char] >> j) & 1)
      }
    }
  }

  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j]
    }
    bytes.push(byte)
  }

  return Buffer.from(bytes)
}

/**
 * Generate TOTP code for a given time
 */
function generateTOTP(secret: string, time?: number): string {
  const counter = Math.floor((time || Date.now() / 1000) / TOTP_PERIOD)
  const counterBuffer = Buffer.alloc(8)

  for (let i = 7; i >= 0; i--) {
    counterBuffer[i] = counter & 0xff
    // @ts-ignore - intentional bitwise operation
    counter = counter >> 8
  }

  const decodedSecret = base32Decode(secret)
  const hmac = createHmac(TOTP_ALGORITHM, decodedSecret)
  hmac.update(counterBuffer)
  const hash = hmac.digest()

  const offset = hash[hash.length - 1] & 0xf
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)

  const otp = binary % Math.pow(10, TOTP_DIGITS)
  return otp.toString().padStart(TOTP_DIGITS, '0')
}

/**
 * Verify TOTP code (allows 1 period before and after for clock drift)
 */
export function verifyTOTP(secret: string, code: string, window = 1): boolean {
  const now = Date.now() / 1000

  for (let i = -window; i <= window; i++) {
    const time = now + i * TOTP_PERIOD
    if (generateTOTP(secret, time) === code) {
      return true
    }
  }

  return false
}

/**
 * Generate recovery codes
 */
function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding similar chars

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    let code = ''
    for (let j = 0; j < RECOVERY_CODE_LENGTH; j++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    // Format: XXXX-XXXX
    codes.push(code.slice(0, 4) + '-' + code.slice(4))
  }

  return codes
}

/**
 * Hash recovery code for storage
 */
function hashRecoveryCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase()
  return createHmac('sha256', 'recovery').update(normalized).digest('hex')
}

/**
 * Start 2FA setup for a user
 */
export function setup2FA(userId: string, email: string): TwoFactorSetup {
  const secret = generateSecret()
  const recoveryCodes = generateRecoveryCodes()

  // Store pending 2FA setup in database
  const hashedCodes = recoveryCodes.map(hashRecoveryCode)

  db.prepare(`
    UPDATE users SET
      two_factor_secret = ?,
      two_factor_recovery_codes = ?,
      two_factor_pending = 1
    WHERE id = ?
  `).run(secret, JSON.stringify(hashedCodes), userId)

  // Generate QR code URL (otpauth format)
  const issuer = encodeURIComponent('PTAR SaaS')
  const accountName = encodeURIComponent(email)
  const qrCodeUrl = `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=${TOTP_ALGORITHM.toUpperCase()}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`

  return {
    secret,
    qrCodeUrl,
    recoveryCodes
  }
}

/**
 * Confirm 2FA setup with a valid code
 */
export function confirm2FA(userId: string, code: string, req?: any): boolean {
  // Get pending secret
  const user = db.prepare(`
    SELECT two_factor_secret, two_factor_pending, organization_id
    FROM users WHERE id = ?
  `).get(userId) as any

  if (!user || !user.two_factor_pending || !user.two_factor_secret) {
    return false
  }

  // Verify the code
  if (!verifyTOTP(user.two_factor_secret, code)) {
    return false
  }

  // Enable 2FA
  db.prepare(`
    UPDATE users SET
      two_factor_enabled = 1,
      two_factor_pending = 0
    WHERE id = ?
  `).run(userId)

  // Log the action
  const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
  createAuditLog({
    organization_id: user.organization_id,
    user_id: userId,
    action: '2fa_enabled',
    entity_type: 'user',
    entity_id: userId,
    ip_address: requestInfo.ip,
    user_agent: requestInfo.userAgent
  })

  return true
}

/**
 * Verify 2FA code during login
 */
export function verify2FALogin(userId: string, code: string): boolean {
  const user = db.prepare(`
    SELECT two_factor_secret, two_factor_enabled
    FROM users WHERE id = ?
  `).get(userId) as any

  if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
    return false
  }

  return verifyTOTP(user.two_factor_secret, code)
}

/**
 * Verify recovery code and mark it as used
 */
export function verifyRecoveryCode(userId: string, code: string): boolean {
  const user = db.prepare(`
    SELECT two_factor_recovery_codes, organization_id
    FROM users WHERE id = ?
  `).get(userId) as any

  if (!user || !user.two_factor_recovery_codes) {
    return false
  }

  const codes = JSON.parse(user.two_factor_recovery_codes) as string[]
  const hashedCode = hashRecoveryCode(code)
  const codeIndex = codes.indexOf(hashedCode)

  if (codeIndex === -1) {
    return false
  }

  // Remove used code
  codes.splice(codeIndex, 1)

  db.prepare(`
    UPDATE users SET two_factor_recovery_codes = ?
    WHERE id = ?
  `).run(JSON.stringify(codes), userId)

  // Log the action
  createAuditLog({
    organization_id: user.organization_id,
    user_id: userId,
    action: 'password_reset',
    entity_type: 'user',
    entity_id: userId,
    new_value: { method: 'recovery_code', remaining_codes: codes.length }
  })

  return true
}

/**
 * Disable 2FA for a user
 */
export function disable2FA(userId: string, req?: any): boolean {
  const user = db.prepare(`
    SELECT organization_id FROM users WHERE id = ?
  `).get(userId) as any

  if (!user) return false

  db.prepare(`
    UPDATE users SET
      two_factor_enabled = 0,
      two_factor_pending = 0,
      two_factor_secret = NULL,
      two_factor_recovery_codes = NULL
    WHERE id = ?
  `).run(userId)

  // Log the action
  const requestInfo = req ? getRequestInfo(req) : { ip: 'system', userAgent: 'system' }
  createAuditLog({
    organization_id: user.organization_id,
    user_id: userId,
    action: '2fa_disabled',
    entity_type: 'user',
    entity_id: userId,
    ip_address: requestInfo.ip,
    user_agent: requestInfo.userAgent
  })

  return true
}

/**
 * Check if user has 2FA enabled
 */
export function has2FAEnabled(userId: string): boolean {
  const user = db.prepare(`
    SELECT two_factor_enabled FROM users WHERE id = ?
  `).get(userId) as any

  return user?.two_factor_enabled === 1
}

/**
 * Generate new recovery codes (replaces existing ones)
 */
export function regenerateRecoveryCodes(userId: string): string[] | null {
  const user = db.prepare(`
    SELECT two_factor_enabled FROM users WHERE id = ?
  `).get(userId) as any

  if (!user?.two_factor_enabled) {
    return null
  }

  const newCodes = generateRecoveryCodes()
  const hashedCodes = newCodes.map(hashRecoveryCode)

  db.prepare(`
    UPDATE users SET two_factor_recovery_codes = ?
    WHERE id = ?
  `).run(JSON.stringify(hashedCodes), userId)

  return newCodes
}

/**
 * Get remaining recovery codes count
 */
export function getRemainingRecoveryCodesCount(userId: string): number {
  const user = db.prepare(`
    SELECT two_factor_recovery_codes FROM users WHERE id = ?
  `).get(userId) as any

  if (!user?.two_factor_recovery_codes) {
    return 0
  }

  const codes = JSON.parse(user.two_factor_recovery_codes) as string[]
  return codes.length
}
