/**
 * Two-Factor Authentication Routes
 * Setup, verify, and manage 2FA for users
 */
import { Router } from 'express'
import {
  setup2FA,
  confirm2FA,
  verify2FALogin,
  verifyRecoveryCode,
  disable2FA,
  has2FAEnabled,
  regenerateRecoveryCodes,
  getRemainingRecoveryCodesCount
} from '../services/twoFactorService.js'
import { db } from '../lib/database.js'
import { usersDAL } from '../lib/dal.js'

const router = Router()

/**
 * GET /api/2fa/status
 * Check if 2FA is enabled for current user
 */
router.get('/status', (req, res) => {
  try {
    const user = (req as any).user
    const enabled = has2FAEnabled(user.sub)
    const remainingCodes = enabled ? getRemainingRecoveryCodesCount(user.sub) : 0

    res.json({
      success: true,
      data: {
        enabled,
        remainingRecoveryCodes: remainingCodes
      }
    })
  } catch (error: any) {
    console.error('Error checking 2FA status:', error)
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado de 2FA'
    })
  }
})

/**
 * POST /api/2fa/setup
 * Start 2FA setup process
 */
router.post('/setup', (req, res) => {
  try {
    const user = (req as any).user

    // Check if already enabled
    if (has2FAEnabled(user.sub)) {
      return res.status(400).json({
        success: false,
        error: '2FA ya está habilitado'
      })
    }

    const setup = setup2FA(user.sub, user.email)

    // Generate QR code data URL
    const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.qrCodeUrl)}`

    res.json({
      success: true,
      data: {
        secret: setup.secret,
        qrCodeUrl: setup.qrCodeUrl,
        qrCodeImage: qrCodeDataUrl,
        recoveryCodes: setup.recoveryCodes
      },
      message: 'Escanea el código QR con tu app de autenticación y guarda los códigos de recuperación'
    })
  } catch (error: any) {
    console.error('Error setting up 2FA:', error)
    res.status(500).json({
      success: false,
      error: 'Error al configurar 2FA'
    })
  }
})

/**
 * POST /api/2fa/confirm
 * Confirm 2FA setup with a valid code
 */
router.post('/confirm', (req, res) => {
  try {
    const user = (req as any).user
    const { code } = req.body

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código inválido. Debe ser de 6 dígitos'
      })
    }

    const confirmed = confirm2FA(user.sub, code, req)

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Código incorrecto o expirado'
      })
    }

    res.json({
      success: true,
      message: '2FA habilitado correctamente'
    })
  } catch (error: any) {
    console.error('Error confirming 2FA:', error)
    res.status(500).json({
      success: false,
      error: 'Error al confirmar 2FA'
    })
  }
})

/**
 * POST /api/2fa/verify
 * Verify 2FA code during login
 * This is called after initial login if 2FA is enabled
 */
router.post('/verify', (req, res) => {
  try {
    const { userId, code, isRecoveryCode } = req.body

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos'
      })
    }

    let verified = false

    if (isRecoveryCode) {
      verified = verifyRecoveryCode(userId, code)
    } else {
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Código inválido. Debe ser de 6 dígitos'
        })
      }
      verified = verify2FALogin(userId, code)
    }

    if (!verified) {
      return res.status(401).json({
        success: false,
        error: isRecoveryCode
          ? 'Código de recuperación inválido'
          : 'Código incorrecto o expirado'
      })
    }

    // Get user data for JWT
    const user = db.prepare(`
      SELECT id, organization_id, email, name, role
      FROM users WHERE id = ?
    `).get(userId) as any

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      })
    }

    res.json({
      success: true,
      data: {
        verified: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id
        }
      }
    })
  } catch (error: any) {
    console.error('Error verifying 2FA:', error)
    res.status(500).json({
      success: false,
      error: 'Error al verificar 2FA'
    })
  }
})

/**
 * POST /api/2fa/disable
 * Disable 2FA for current user
 */
router.post('/disable', (req, res) => {
  try {
    const user = (req as any).user
    const { code, password } = req.body

    // Require either 2FA code or password for security
    if (!code && !password) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere código 2FA o contraseña para desactivar'
      })
    }

    // If code provided, verify it
    if (code) {
      const verified = verify2FALogin(user.sub, code)
      if (!verified) {
        return res.status(401).json({
          success: false,
          error: 'Código incorrecto'
        })
      }
    }

    // If password provided, verify it
    if (password) {
      const userWithPassword = usersDAL.getByIdWithPassword(user.sub)
      if (!userWithPassword || !usersDAL.verifyPassword(userWithPassword, password)) {
        return res.status(401).json({
          success: false,
          error: 'Contraseña incorrecta'
        })
      }
    }

    const disabled = disable2FA(user.sub, req)

    if (!disabled) {
      return res.status(400).json({
        success: false,
        error: '2FA no está habilitado'
      })
    }

    res.json({
      success: true,
      message: '2FA deshabilitado correctamente'
    })
  } catch (error: any) {
    console.error('Error disabling 2FA:', error)
    res.status(500).json({
      success: false,
      error: 'Error al deshabilitar 2FA'
    })
  }
})

/**
 * POST /api/2fa/recovery-codes
 * Generate new recovery codes
 */
router.post('/recovery-codes', (req, res) => {
  try {
    const user = (req as any).user
    const { code } = req.body

    // Verify current 2FA code for security
    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere código 2FA actual'
      })
    }

    const verified = verify2FALogin(user.sub, code)
    if (!verified) {
      return res.status(401).json({
        success: false,
        error: 'Código incorrecto'
      })
    }

    const newCodes = regenerateRecoveryCodes(user.sub)

    if (!newCodes) {
      return res.status(400).json({
        success: false,
        error: '2FA no está habilitado'
      })
    }

    res.json({
      success: true,
      data: {
        recoveryCodes: newCodes
      },
      message: 'Nuevos códigos de recuperación generados. Los anteriores ya no son válidos.'
    })
  } catch (error: any) {
    console.error('Error regenerating recovery codes:', error)
    res.status(500).json({
      success: false,
      error: 'Error al regenerar códigos'
    })
  }
})

export default router
