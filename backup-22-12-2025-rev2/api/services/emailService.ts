/**
 * Email Service - Handles all email notifications
 * Uses nodemailer with SMTP configuration
 */
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Email templates
type EmailTemplate = 'maintenance_reminder' | 'parameter_alert' | 'emergency_alert'

interface MaintenanceReminderData {
  plantName: string
  taskDescription: string
  scheduledDate: string
  daysRemaining: number
}

interface ParameterAlertData {
  plantName: string
  parameter: string
  value: number
  threshold: number
  unit: string
  measurementDate: string
}

interface EmergencyAlertData {
  plantName: string
  reason: string
  severity: 'low' | 'medium' | 'high'
  reportedAt: string
}

type TemplateData = MaintenanceReminderData | ParameterAlertData | EmergencyAlertData

class EmailService {
  private transporter: Transporter | null = null
  private initialized = false

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.warn('⚠️ Email service not configured. Set SMTP_* environment variables.')
      return false
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: parseInt(SMTP_PORT || '587') === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      })

      // Verify connection
      await this.transporter.verify()
      this.initialized = true
      console.log('✉️ Email service initialized successfully')
      return true
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error)
      return false
    }
  }

  private getTemplate(template: EmailTemplate, data: TemplateData): { subject: string; html: string } {
    switch (template) {
      case 'maintenance_reminder': {
        const d = data as MaintenanceReminderData
        return {
          subject: `🔧 Recordatorio: Mantenimiento programado en ${d.daysRemaining} días - ${d.plantName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🔧 Recordatorio de Mantenimiento</h1>
                </div>
                <div class="content">
                  <p>Estimado equipo,</p>

                  <div class="alert-box">
                    <strong>⏰ Faltan ${d.daysRemaining} días</strong> para el mantenimiento programado.
                    <br>Por favor, prepare la <strong>Orden de Compra</strong> correspondiente.
                  </div>

                  <h3>Detalles del mantenimiento:</h3>
                  <ul>
                    <li><strong>Planta:</strong> ${d.plantName}</li>
                    <li><strong>Descripción:</strong> ${d.taskDescription}</li>
                    <li><strong>Fecha programada:</strong> ${new Date(d.scheduledDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
                  </ul>

                  <p>Recuerde coordinar con el proveedor y asegurar la disponibilidad de repuestos necesarios.</p>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/maintenance" class="btn">Ver en el Sistema</a>
                </div>
                <div class="footer">
                  Sistema PTAR Santa Priscila | Este es un mensaje automático
                </div>
              </div>
            </body>
            </html>
          `,
        }
      }

      case 'parameter_alert': {
        const d = data as ParameterAlertData
        const isCritical = this.isParameterCritical(d.parameter, d.value)
        return {
          subject: `${isCritical ? '🚨 CRÍTICO' : '⚠️ ALERTA'}: ${d.parameter} fuera de rango en ${d.plantName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: ${isCritical ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .value-box { background: ${isCritical ? '#fef2f2' : '#fef3c7'}; border: 2px solid ${isCritical ? '#dc2626' : '#f59e0b'}; padding: 20px; margin: 15px 0; text-align: center; border-radius: 10px; }
                .value { font-size: 36px; font-weight: bold; color: ${isCritical ? '#dc2626' : '#f59e0b'}; }
                .threshold { font-size: 14px; color: #64748b; margin-top: 5px; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${isCritical ? '🚨 Alerta Crítica' : '⚠️ Alerta de Parámetro'}</h1>
                </div>
                <div class="content">
                  <p>Se ha detectado un parámetro fuera del rango permitido:</p>

                  <div class="value-box">
                    <div><strong>${d.parameter}</strong></div>
                    <div class="value">${d.value} ${d.unit}</div>
                    <div class="threshold">Límite: ${d.threshold} ${d.unit}</div>
                  </div>

                  <h3>Información:</h3>
                  <ul>
                    <li><strong>Planta:</strong> ${d.plantName}</li>
                    <li><strong>Fecha medición:</strong> ${new Date(d.measurementDate).toLocaleString('es-EC')}</li>
                  </ul>

                  <p><strong>Acción requerida:</strong> Por favor, revise el sistema de tratamiento y tome las medidas correctivas necesarias.</p>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/dashboard" class="btn">Ver Detalles</a>
                </div>
                <div class="footer">
                  Sistema PTAR Santa Priscila | Este es un mensaje automático
                </div>
              </div>
            </body>
            </html>
          `,
        }
      }

      case 'emergency_alert': {
        const d = data as EmergencyAlertData
        const severityColors = { low: '#22c55e', medium: '#f59e0b', high: '#dc2626' }
        const severityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' }
        return {
          subject: `🚨 EMERGENCIA [${severityLabels[d.severity]}]: ${d.plantName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: ${severityColors[d.severity]}; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .emergency-box { background: #fef2f2; border: 2px solid ${severityColors[d.severity]}; padding: 20px; margin: 15px 0; border-radius: 10px; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🚨 Emergencia Reportada</h1>
                </div>
                <div class="content">
                  <div class="emergency-box">
                    <h2>${d.plantName}</h2>
                    <p><strong>Motivo:</strong> ${d.reason}</p>
                    <p><strong>Severidad:</strong> ${severityLabels[d.severity]}</p>
                    <p><strong>Reportado:</strong> ${new Date(d.reportedAt).toLocaleString('es-EC')}</p>
                  </div>

                  <p>Se requiere atención inmediata. Por favor, coordine con el equipo de mantenimiento.</p>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/emergencies" class="btn">Gestionar Emergencia</a>
                </div>
                <div class="footer">
                  Sistema PTAR Santa Priscila | Este es un mensaje automático
                </div>
              </div>
            </body>
            </html>
          `,
        }
      }

      default:
        return { subject: 'Notificación PTAR', html: '<p>Notificación del sistema PTAR</p>' }
    }
  }

  private isParameterCritical(parameter: string, value: number): boolean {
    const criticalThresholds: Record<string, { min?: number; max?: number }> = {
      DQO: { max: 200 },
      pH: { min: 6, max: 8 },
      SS: { max: 100 },
    }

    const threshold = criticalThresholds[parameter]
    if (!threshold) return false

    if (threshold.min !== undefined && value < threshold.min) return true
    if (threshold.max !== undefined && value > threshold.max) return true
    return false
  }

  async sendEmail(
    to: string | string[],
    template: EmailTemplate,
    data: TemplateData
  ): Promise<boolean> {
    if (!this.initialized) {
      const success = await this.initialize()
      if (!success) {
        console.warn('Email not sent: service not initialized')
        return false
      }
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to
    const { subject, html } = this.getTemplate(template, data)

    try {
      await this.transporter!.sendMail({
        from: process.env.SMTP_FROM || 'PTAR System <noreply@santapriscila.com>',
        to: recipients,
        subject,
        html,
      })
      console.log(`✉️ Email sent to ${recipients}: ${subject}`)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  // Convenience methods
  async sendMaintenanceReminder(to: string | string[], data: MaintenanceReminderData): Promise<boolean> {
    return this.sendEmail(to, 'maintenance_reminder', data)
  }

  async sendParameterAlert(to: string | string[], data: ParameterAlertData): Promise<boolean> {
    return this.sendEmail(to, 'parameter_alert', data)
  }

  async sendEmergencyAlert(to: string | string[], data: EmergencyAlertData): Promise<boolean> {
    return this.sendEmail(to, 'emergency_alert', data)
  }
}

// Singleton instance
export const emailService = new EmailService()
export type { MaintenanceReminderData, ParameterAlertData, EmergencyAlertData }
