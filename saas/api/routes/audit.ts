/**
 * Audit Log Routes
 * View and export audit logs for security compliance
 */
import { Router } from 'express'
import { requireRole } from '../middleware/auth.js'
import {
  getAuditLogs,
  getSecurityEvents,
  getUserActivity,
  exportAuditLogs
} from '../services/auditService.js'

const router = Router()

// All routes require admin role (auth already applied in app.ts)
router.use(requireRole('admin', 'owner'))

/**
 * GET /api/audit/logs
 * Get paginated audit logs with filters
 */
router.get('/logs', (req, res) => {
  try {
    const organizationId = (req as any).user.organizationId

    const {
      page = '1',
      limit = '50',
      action,
      entity_type,
      user_id,
      from_date,
      to_date
    } = req.query

    const pageNum = parseInt(page as string, 10)
    const limitNum = Math.min(parseInt(limit as string, 10), 100)
    const offset = (pageNum - 1) * limitNum

    const { logs, total } = getAuditLogs(organizationId, {
      limit: limitNum,
      offset,
      action: action as any,
      entity_type: entity_type as string,
      user_id: user_id as string,
      from_date: from_date as string,
      to_date: to_date as string
    })

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener logs de auditoría'
    })
  }
})

/**
 * GET /api/audit/security
 * Get security-related events (logins, password changes, etc.)
 */
router.get('/security', (req, res) => {
  try {
    const organizationId = (req as any).user.organizationId
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100)

    const events = getSecurityEvents(organizationId, limit)

    res.json({
      success: true,
      data: events
    })
  } catch (error: any) {
    console.error('Error fetching security events:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener eventos de seguridad'
    })
  }
})

/**
 * GET /api/audit/users/:userId
 * Get activity for a specific user
 */
router.get('/users/:userId', (req, res) => {
  try {
    const organizationId = (req as any).user.organizationId
    const { userId } = req.params
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100)

    const activity = getUserActivity(organizationId, userId, limit)

    res.json({
      success: true,
      data: activity
    })
  } catch (error: any) {
    console.error('Error fetching user activity:', error)
    res.status(500).json({
      success: false,
      error: 'Error al obtener actividad del usuario'
    })
  }
})

/**
 * GET /api/audit/export
 * Export audit logs as CSV
 */
router.get('/export', (req, res) => {
  try {
    const organizationId = (req as any).user.organizationId
    const { from_date, to_date } = req.query

    const csv = exportAuditLogs(
      organizationId,
      from_date as string,
      to_date as string
    )

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (error: any) {
    console.error('Error exporting audit logs:', error)
    res.status(500).json({
      success: false,
      error: 'Error al exportar logs de auditoría'
    })
  }
})

/**
 * GET /api/audit/actions
 * Get list of available action types for filtering
 */
router.get('/actions', (_req, res) => {
  const actions = {
    auth: [
      { value: 'login', label: 'Inicio de sesión' },
      { value: 'logout', label: 'Cierre de sesión' },
      { value: 'login_failed', label: 'Intento fallido' },
      { value: 'password_changed', label: 'Cambio de contraseña' },
      { value: '2fa_enabled', label: '2FA activado' },
      { value: '2fa_disabled', label: '2FA desactivado' }
    ],
    users: [
      { value: 'user_created', label: 'Usuario creado' },
      { value: 'user_updated', label: 'Usuario actualizado' },
      { value: 'user_deleted', label: 'Usuario eliminado' },
      { value: 'user_invited', label: 'Usuario invitado' },
      { value: 'role_changed', label: 'Rol cambiado' }
    ],
    data: [
      { value: 'data_created', label: 'Dato creado' },
      { value: 'data_updated', label: 'Dato actualizado' },
      { value: 'data_deleted', label: 'Dato eliminado' },
      { value: 'data_exported', label: 'Datos exportados' }
    ],
    api: [
      { value: 'api_key_created', label: 'API Key creada' },
      { value: 'api_key_revoked', label: 'API Key revocada' },
      { value: 'webhook_created', label: 'Webhook creado' },
      { value: 'webhook_deleted', label: 'Webhook eliminado' }
    ],
    billing: [
      { value: 'subscription_created', label: 'Suscripción creada' },
      { value: 'subscription_cancelled', label: 'Suscripción cancelada' },
      { value: 'payment_succeeded', label: 'Pago exitoso' },
      { value: 'payment_failed', label: 'Pago fallido' }
    ]
  }

  res.json({ success: true, data: actions })
})

export default router
