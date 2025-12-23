/**
 * Notifications API Routes
 * Manages email notifications and notification settings
 */
import { Router, Request, Response } from 'express'
import { db } from '../lib/database'
import { emailService } from '../services/emailService'
import { notificationScheduler } from '../services/notificationScheduler'

const router = Router()

// Types
interface NotificationSetting {
  id: string
  user_id: string
  email: string
  maintenance_reminders: boolean
  parameter_alerts: boolean
  emergency_alerts: boolean
  reminder_days: number
  created_at: string
  updated_at: string
}

/**
 * GET /api/notifications/settings
 * Get notification settings for current user
 */
router.get('/settings', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub

    if (!userId) {
      return res.json({ success: false, error: 'No autenticado' })
    }

    // Get or create settings
    let settings = db.prepare(`
      SELECT * FROM notification_settings WHERE user_id = ?
    `).get(userId) as NotificationSetting | undefined

    if (!settings) {
      // Return default settings
      settings = {
        id: '',
        user_id: userId,
        email: (req as any).user?.email || '',
        maintenance_reminders: true,
        parameter_alerts: true,
        emergency_alerts: true,
        reminder_days: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error getting notification settings:', error)
    res.status(500).json({ success: false, error: 'Error al obtener configuración' })
  }
})

/**
 * PUT /api/notifications/settings
 * Update notification settings
 */
router.put('/settings', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub
    const { email, maintenance_reminders, parameter_alerts, emergency_alerts, reminder_days } = req.body

    if (!userId) {
      return res.json({ success: false, error: 'No autenticado' })
    }

    // Check if settings exist
    const existing = db.prepare('SELECT id FROM notification_settings WHERE user_id = ?').get(userId)

    if (existing) {
      db.prepare(`
        UPDATE notification_settings
        SET email = ?, maintenance_reminders = ?, parameter_alerts = ?,
            emergency_alerts = ?, reminder_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        email,
        maintenance_reminders ? 1 : 0,
        parameter_alerts ? 1 : 0,
        emergency_alerts ? 1 : 0,
        reminder_days || 45,
        userId
      )
    } else {
      const id = `notif-${Date.now()}`
      db.prepare(`
        INSERT INTO notification_settings (id, user_id, email, maintenance_reminders, parameter_alerts, emergency_alerts, reminder_days)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        email,
        maintenance_reminders ? 1 : 0,
        parameter_alerts ? 1 : 0,
        emergency_alerts ? 1 : 0,
        reminder_days || 45
      )
    }

    res.json({ success: true, message: 'Configuración actualizada' })
  } catch (error) {
    console.error('Error updating notification settings:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' })
  }
})

/**
 * GET /api/notifications/upcoming-maintenance
 * Get maintenance tasks due in the next N days (for reminder widget)
 */
router.get('/upcoming-maintenance', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    const today = new Date().toISOString().split('T')[0]

    const tasks = db.prepare(`
      SELECT
        mt.*,
        p.name as plant_name,
        p.location as plant_location,
        CAST((julianday(mt.scheduled_date) - julianday('now')) AS INTEGER) as days_until
      FROM maintenance_tasks mt
      JOIN plants p ON mt.plant_id = p.id
      WHERE mt.status = 'pending'
      AND DATE(mt.scheduled_date) >= DATE(?)
      AND DATE(mt.scheduled_date) <= DATE(?)
      ORDER BY mt.scheduled_date ASC
    `).all(today, futureDateStr)

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Error getting upcoming maintenance:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mantenimientos' })
  }
})

/**
 * GET /api/notifications/maintenance-reminders
 * Get maintenance tasks due in ~45 days (for purchase order reminders)
 */
router.get('/maintenance-reminders', (req: Request, res: Response) => {
  try {
    const reminderDays = parseInt(req.query.days as string) || 45

    // Range of +/- 3 days around target
    const minDate = new Date()
    minDate.setDate(minDate.getDate() + reminderDays - 3)
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + reminderDays + 3)

    const tasks = db.prepare(`
      SELECT
        mt.*,
        p.name as plant_name,
        p.location as plant_location,
        CAST((julianday(mt.scheduled_date) - julianday('now')) AS INTEGER) as days_until
      FROM maintenance_tasks mt
      JOIN plants p ON mt.plant_id = p.id
      WHERE mt.status = 'pending'
      AND DATE(mt.scheduled_date) >= DATE(?)
      AND DATE(mt.scheduled_date) <= DATE(?)
      ORDER BY mt.scheduled_date ASC
    `).all(minDate.toISOString().split('T')[0], maxDate.toISOString().split('T')[0])

    res.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Error getting maintenance reminders:', error)
    res.status(500).json({ success: false, error: 'Error al obtener recordatorios' })
  }
})

/**
 * POST /api/notifications/test-email
 * Send a test email (admin only)
 */
router.post('/test-email', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado' })
    }

    const { email } = req.body
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requerido' })
    }

    const success = await emailService.sendMaintenanceReminder(email, {
      plantName: 'Planta de Prueba',
      taskDescription: 'Mantenimiento preventivo de prueba',
      scheduledDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 45,
    })

    if (success) {
      res.json({ success: true, message: 'Email de prueba enviado' })
    } else {
      res.status(500).json({ success: false, error: 'Error al enviar email' })
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    res.status(500).json({ success: false, error: 'Error al enviar email' })
  }
})

/**
 * POST /api/notifications/trigger-check
 * Manually trigger notification check (admin only)
 */
router.post('/trigger-check', async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado' })
    }

    const { type } = req.body // 'maintenance' or 'parameters'

    if (type === 'maintenance') {
      await notificationScheduler.triggerMaintenanceCheck()
    } else if (type === 'parameters') {
      await notificationScheduler.triggerParameterCheck()
    } else {
      await notificationScheduler.triggerMaintenanceCheck()
      await notificationScheduler.triggerParameterCheck()
    }

    res.json({ success: true, message: 'Verificación ejecutada' })
  } catch (error) {
    console.error('Error triggering check:', error)
    res.status(500).json({ success: false, error: 'Error al ejecutar verificación' })
  }
})

export default router
