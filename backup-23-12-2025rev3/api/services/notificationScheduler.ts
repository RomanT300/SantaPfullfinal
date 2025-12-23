/**
 * Notification Scheduler - Cron jobs for automated notifications
 * Runs daily to check for upcoming maintenance and parameter alerts
 */
import cron from 'node-cron'
import { db } from '../lib/database'
import { emailService } from './emailService'

// Types
interface MaintenanceTask {
  id: string
  plant_id: string
  task_type: string
  description: string
  scheduled_date: string
  status: string
}

interface Plant {
  id: string
  name: string
  location: string
}

interface EnvironmentalData {
  id: string
  plant_id: string
  parameter_type: string
  value: number
  measurement_date: string
  unit: string
  stream: string
}

// Parameter thresholds for alerts
const PARAMETER_THRESHOLDS = {
  DQO: { max: 200, unit: 'mg/L' },
  pH: { min: 6, max: 8, unit: '' },
  SS: { max: 100, unit: 'mg/L' },
}

class NotificationScheduler {
  private isRunning = false

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler already running')
      return
    }

    console.log('🕐 Starting notification scheduler...')

    // Run maintenance check daily at 8:00 AM
    cron.schedule('0 8 * * *', () => {
      console.log('Running daily maintenance check...')
      this.checkUpcomingMaintenance()
    })

    // Run parameter check every 4 hours
    cron.schedule('0 */4 * * *', () => {
      console.log('Running parameter alert check...')
      this.checkParameterAlerts()
    })

    // Run emergency task reminder check every hour
    cron.schedule('0 * * * *', () => {
      console.log('Running emergency task reminder check...')
      this.checkEmergencyTaskReminders()
    })

    this.isRunning = true
    console.log('✅ Notification scheduler started')

    // Run initial checks on startup (with delay)
    setTimeout(() => {
      this.checkUpcomingMaintenance()
      this.checkEmergencyTaskReminders()
    }, 5000)
  }

  /**
   * Check for maintenance tasks due in 45 days
   * Sends email reminders for purchase order preparation
   */
  async checkUpcomingMaintenance(): Promise<void> {
    const notificationEmails = process.env.NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []

    if (notificationEmails.length === 0) {
      console.log('No notification emails configured')
      return
    }

    try {
      // Get all plants for name lookup
      const plants = db.prepare('SELECT * FROM plants').all() as Plant[]
      const plantMap = new Map(plants.map(p => [p.id, p]))

      // Calculate date 45 days from now
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 45)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      // Also check 44 and 46 days to catch edge cases
      const dateRange = [43, 44, 45, 46, 47].map(days => {
        const d = new Date()
        d.setDate(d.getDate() + days)
        return d.toISOString().split('T')[0]
      })

      // Get pending tasks scheduled around 45 days from now
      const tasks = db.prepare(`
        SELECT * FROM maintenance_tasks
        WHERE status = 'pending'
        AND DATE(scheduled_date) IN (${dateRange.map(() => '?').join(',')})
      `).all(...dateRange) as MaintenanceTask[]

      console.log(`Found ${tasks.length} maintenance tasks due in ~45 days`)

      for (const task of tasks) {
        const plant = plantMap.get(task.plant_id)
        if (!plant) continue

        const scheduledDate = new Date(task.scheduled_date)
        const today = new Date()
        const daysRemaining = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        await emailService.sendMaintenanceReminder(notificationEmails, {
          plantName: plant.name,
          taskDescription: task.description,
          scheduledDate: task.scheduled_date,
          daysRemaining,
        })

        // Mark that notification was sent (optional: add notified_at column)
        console.log(`📧 Sent maintenance reminder for ${plant.name}: ${task.description}`)
      }
    } catch (error) {
      console.error('Error checking upcoming maintenance:', error)
    }
  }

  /**
   * Check for parameters out of acceptable range
   * Sends alerts for critical values
   */
  async checkParameterAlerts(): Promise<void> {
    const notificationEmails = process.env.NOTIFICATION_EMAILS?.split(',').map(e => e.trim()) || []

    if (notificationEmails.length === 0) return

    try {
      // Get all plants
      const plants = db.prepare('SELECT * FROM plants').all() as Plant[]
      const plantMap = new Map(plants.map(p => [p.id, p]))

      // Get latest effluent readings from last 24 hours
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString()

      const readings = db.prepare(`
        SELECT * FROM environmental_data
        WHERE stream = 'effluent'
        AND measurement_date > ?
        ORDER BY measurement_date DESC
      `).all(yesterdayStr) as EnvironmentalData[]

      // Track which plant+parameter combinations we've alerted on
      const alerted = new Set<string>()

      for (const reading of readings) {
        const key = `${reading.plant_id}-${reading.parameter_type}`
        if (alerted.has(key)) continue

        const threshold = PARAMETER_THRESHOLDS[reading.parameter_type as keyof typeof PARAMETER_THRESHOLDS]
        if (!threshold) continue

        let isOutOfRange = false
        let thresholdValue = 0

        if ('max' in threshold && reading.value > threshold.max) {
          isOutOfRange = true
          thresholdValue = threshold.max
        }
        if ('min' in threshold && reading.value < threshold.min) {
          isOutOfRange = true
          thresholdValue = threshold.min
        }

        if (isOutOfRange) {
          const plant = plantMap.get(reading.plant_id)
          if (!plant) continue

          await emailService.sendParameterAlert(notificationEmails, {
            plantName: plant.name,
            parameter: reading.parameter_type,
            value: reading.value,
            threshold: thresholdValue,
            unit: threshold.unit,
            measurementDate: reading.measurement_date,
          })

          alerted.add(key)
          console.log(`📧 Sent parameter alert for ${plant.name}: ${reading.parameter_type} = ${reading.value}`)
        }
      }
    } catch (error) {
      console.error('Error checking parameter alerts:', error)
    }
  }

  /**
   * Manually trigger maintenance check (for testing or API)
   */
  async triggerMaintenanceCheck(): Promise<{ sent: number }> {
    await this.checkUpcomingMaintenance()
    return { sent: 0 } // Could track count
  }

  /**
   * Manually trigger parameter check
   */
  async triggerParameterCheck(): Promise<{ sent: number }> {
    await this.checkParameterAlerts()
    return { sent: 0 }
  }

  /**
   * Check for emergency tasks that need reminders
   * - Tasks with reminder_date that have passed and not yet reminded
   * - Tasks with due_date that are overdue
   */
  async checkEmergencyTaskReminders(): Promise<void> {
    try {
      const now = new Date().toISOString()
      const today = now.split('T')[0]

      // Get tasks with reminder dates that have passed
      const tasksWithReminders = db.prepare(`
        SELECT et.*, me.reason as emergency_reason, p.name as plant_name
        FROM emergency_tasks et
        JOIN maintenance_emergencies me ON et.emergency_id = me.id
        JOIN plants p ON me.plant_id = p.id
        WHERE et.status IN ('pending', 'in_progress')
        AND et.assigned_to_email IS NOT NULL
        AND et.reminder_date IS NOT NULL
        AND DATE(et.reminder_date) <= DATE(?)
        AND (et.reminder_sent = 0 OR et.reminder_sent IS NULL)
      `).all(today) as any[]

      console.log(`Found ${tasksWithReminders.length} emergency tasks needing reminders`)

      for (const task of tasksWithReminders) {
        await emailService.sendTaskReminder(task.assigned_to_email, {
          taskTitle: task.title,
          taskDescription: task.description || '',
          emergencyReason: task.emergency_reason,
          plantName: task.plant_name,
          dueDate: task.due_date,
          priority: task.priority,
          status: task.status,
        })

        // Mark as reminded
        db.prepare('UPDATE emergency_tasks SET reminder_sent = 1, updated_at = ? WHERE id = ?').run(now, task.id)
        console.log(`📧 Sent task reminder to ${task.assigned_to_email}: ${task.title}`)
      }

      // Also check for overdue tasks that haven't been reminded in 24 hours
      const overdueTasks = db.prepare(`
        SELECT et.*, me.reason as emergency_reason, p.name as plant_name
        FROM emergency_tasks et
        JOIN maintenance_emergencies me ON et.emergency_id = me.id
        JOIN plants p ON me.plant_id = p.id
        WHERE et.status IN ('pending', 'in_progress')
        AND et.assigned_to_email IS NOT NULL
        AND et.due_date IS NOT NULL
        AND DATE(et.due_date) < DATE(?)
        AND (et.updated_at < datetime('now', '-24 hours') OR et.updated_at IS NULL)
      `).all(today) as any[]

      console.log(`Found ${overdueTasks.length} overdue emergency tasks`)

      for (const task of overdueTasks) {
        await emailService.sendTaskReminder(task.assigned_to_email, {
          taskTitle: task.title,
          taskDescription: task.description || '',
          emergencyReason: task.emergency_reason,
          plantName: task.plant_name,
          dueDate: task.due_date,
          priority: task.priority,
          status: task.status,
        })

        // Update timestamp to avoid spam
        db.prepare('UPDATE emergency_tasks SET updated_at = ? WHERE id = ?').run(now, task.id)
        console.log(`📧 Sent overdue task reminder to ${task.assigned_to_email}: ${task.title}`)
      }
    } catch (error) {
      console.error('Error checking emergency task reminders:', error)
    }
  }

  /**
   * Manually trigger emergency task reminder check
   */
  async triggerEmergencyTaskCheck(): Promise<{ sent: number }> {
    await this.checkEmergencyTaskReminders()
    return { sent: 0 }
  }
}

export const notificationScheduler = new NotificationScheduler()
