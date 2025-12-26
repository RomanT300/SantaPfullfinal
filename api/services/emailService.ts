/**
 * Email Service - Handles all email notifications
 * Uses nodemailer with SMTP configuration
 */
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Email templates
type EmailTemplate = 'maintenance_reminder' | 'parameter_alert' | 'emergency_alert' | 'task_assignment' | 'task_reminder' | 'ticket_new'

interface MaintenanceReminderData {
  plantName: string
  taskDescription: string
  scheduledDate: string
  daysRemaining?: number
  periodicity?: string
  vendorName?: string
  estimatedCost?: number
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

interface TaskAssignmentData {
  taskTitle: string
  taskDescription: string
  emergencyReason: string
  plantName: string
  assignedBy: string
  dueDate: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

interface TaskReminderData {
  taskTitle: string
  taskDescription: string
  emergencyReason: string
  plantName: string
  dueDate: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: string
}

interface TicketNewData {
  ticketNumber: string
  subject: string
  description: string
  category: string
  priority: string
  plantName: string
  requesterName: string
  requesterEmail?: string
  requesterPhone?: string
}

type TemplateData = MaintenanceReminderData | ParameterAlertData | EmergencyAlertData | TaskAssignmentData | TaskReminderData | TicketNewData

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
        const daysRemaining = d.daysRemaining ?? Math.ceil((new Date(d.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        const periodicityLabels: Record<string, string> = { daily: 'Diario', monthly: 'Mensual', quarterly: 'Trimestral', annual: 'Anual' }
        return {
          subject: `🔧 Recordatorio: Mantenimiento programado en ${daysRemaining} días - ${d.plantName}`,
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
                .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
                .cost { font-size: 24px; font-weight: bold; color: #059669; }
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
                    <strong>⏰ Faltan ${daysRemaining} días</strong> para el mantenimiento programado.
                    <br>Por favor, prepare la <strong>Orden de Compra</strong> y coordine el viaje si es necesario.
                  </div>

                  <h3>Detalles del mantenimiento:</h3>
                  <ul>
                    <li><strong>Planta:</strong> ${d.plantName}</li>
                    <li><strong>Descripción:</strong> ${d.taskDescription}</li>
                    <li><strong>Periodicidad:</strong> ${d.periodicity ? periodicityLabels[d.periodicity] || d.periodicity : 'No especificada'}</li>
                    <li><strong>Fecha programada:</strong> ${new Date(d.scheduledDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
                    ${d.vendorName ? `<li><strong>Proveedor:</strong> ${d.vendorName}</li>` : ''}
                  </ul>

                  ${d.estimatedCost ? `
                  <div class="info-box">
                    <strong>💰 Costo Estimado:</strong>
                    <div class="cost">$${d.estimatedCost.toLocaleString('es-EC', { minimumFractionDigits: 2 })}</div>
                    <small>Asegúrese de gestionar el pago al proveedor con anticipación.</small>
                  </div>
                  ` : ''}

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

      case 'task_assignment': {
        const d = data as TaskAssignmentData
        const priorityColors = { low: '#22c55e', medium: '#f59e0b', high: '#dc2626', urgent: '#7c3aed' }
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
        return {
          subject: `📋 Nueva tarea asignada: ${d.taskTitle} - ${d.plantName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .task-box { background: white; border-left: 4px solid ${priorityColors[d.priority]}; padding: 15px; margin: 15px 0; border-radius: 0 8px 8px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .priority-badge { display: inline-block; background: ${priorityColors[d.priority]}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; }
                .info-row { display: flex; margin: 8px 0; }
                .info-label { color: #64748b; min-width: 120px; }
                .info-value { font-weight: 500; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📋 Nueva Tarea Asignada</h1>
                </div>
                <div class="content">
                  <p>Hola,</p>
                  <p>Se te ha asignado una nueva tarea relacionada con una emergencia:</p>

                  <div class="task-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                      <h2 style="margin: 0; color: #1e293b;">${d.taskTitle}</h2>
                      <span class="priority-badge">${priorityLabels[d.priority]}</span>
                    </div>
                    ${d.taskDescription ? `<p style="color: #475569; margin: 10px 0;">${d.taskDescription}</p>` : ''}

                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                      <div class="info-row">
                        <span class="info-label">🏭 Planta:</span>
                        <span class="info-value">${d.plantName}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">🚨 Emergencia:</span>
                        <span class="info-value">${d.emergencyReason}</span>
                      </div>
                      ${d.dueDate ? `
                      <div class="info-row">
                        <span class="info-label">📅 Fecha límite:</span>
                        <span class="info-value">${new Date(d.dueDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      ` : ''}
                      <div class="info-row">
                        <span class="info-label">👤 Asignado por:</span>
                        <span class="info-value">${d.assignedBy}</span>
                      </div>
                    </div>
                  </div>

                  <p>Por favor, revisa la tarea y actualiza su estado cuando comiences a trabajar en ella.</p>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/emergencies" class="btn">Ver en el Sistema</a>
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

      case 'task_reminder': {
        const d = data as TaskReminderData
        const priorityColors = { low: '#22c55e', medium: '#f59e0b', high: '#dc2626', urgent: '#7c3aed' }
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
        const statusLabels: Record<string, string> = { pending: 'Pendiente', in_progress: 'En Progreso', completed: 'Completada' }
        const isOverdue = d.dueDate && new Date(d.dueDate) < new Date()
        return {
          subject: `⏰ Recordatorio: ${d.taskTitle}${isOverdue ? ' (VENCIDA)' : ''} - ${d.plantName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: ${isOverdue ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .task-box { background: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border: 2px solid ${isOverdue ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 15px 0; border-radius: 8px; }
                .priority-badge { display: inline-block; background: ${priorityColors[d.priority]}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .status-badge { display: inline-block; background: #64748b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 8px; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; }
                .warning { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 12px; border-radius: 8px; margin: 15px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>⏰ Recordatorio de Tarea</h1>
                </div>
                <div class="content">
                  ${isOverdue ? `
                  <div class="warning">
                    <strong>⚠️ Esta tarea está vencida.</strong> Por favor, actualiza su estado lo antes posible.
                  </div>
                  ` : ''}

                  <p>Este es un recordatorio sobre la siguiente tarea pendiente:</p>

                  <div class="task-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                      <h2 style="margin: 0; color: #1e293b;">${d.taskTitle}</h2>
                      <div>
                        <span class="priority-badge">${priorityLabels[d.priority]}</span>
                        <span class="status-badge">${statusLabels[d.status] || d.status}</span>
                      </div>
                    </div>
                    ${d.taskDescription ? `<p style="color: #475569;">${d.taskDescription}</p>` : ''}

                    <div style="margin-top: 15px;">
                      <p><strong>🏭 Planta:</strong> ${d.plantName}</p>
                      <p><strong>🚨 Emergencia:</strong> ${d.emergencyReason}</p>
                      ${d.dueDate ? `<p><strong>📅 Fecha límite:</strong> ${new Date(d.dueDate).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                    </div>
                  </div>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/emergencies" class="btn">Ver Tarea</a>
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

      case 'ticket_new': {
        const d = data as TicketNewData
        const categoryLabels: Record<string, string> = {
          mantenimiento: 'Mantenimiento',
          repuestos: 'Repuestos',
          insumos: 'Insumos',
          consulta: 'Consulta',
          emergencia: 'Emergencia',
          otro: 'Otro'
        }
        const priorityColors: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#dc2626', urgent: '#7c3aed' }
        const priorityLabels: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }
        return {
          subject: `🎫 Nuevo Ticket: ${d.ticketNumber} - ${d.subject}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
                .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
                .ticket-box { background: white; border: 2px solid #e2e8f0; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .priority-badge { display: inline-block; background: ${priorityColors[d.priority] || '#64748b'}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .category-badge { display: inline-block; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-left: 8px; }
                .footer { background: #1e293b; color: #94a3b8; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; }
                .info-row { display: flex; margin: 8px 0; }
                .info-label { font-weight: bold; color: #64748b; min-width: 120px; }
                .ticket-number { font-size: 24px; font-weight: bold; color: #6366f1; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎫 Nuevo Ticket de Soporte</h1>
                  <p class="ticket-number">${d.ticketNumber}</p>
                </div>
                <div class="content">
                  <p>Se ha registrado un nuevo ticket de soporte en el sistema:</p>

                  <div class="ticket-box">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                      <h2 style="margin: 0; color: #1e293b;">${d.subject}</h2>
                      <div>
                        <span class="priority-badge">${priorityLabels[d.priority] || d.priority}</span>
                        <span class="category-badge">${categoryLabels[d.category] || d.category}</span>
                      </div>
                    </div>

                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                      <p style="margin: 0; color: #475569;">${d.description}</p>
                    </div>

                    <div style="margin-top: 15px;">
                      <div class="info-row"><span class="info-label">🏭 Planta:</span> ${d.plantName}</div>
                      <div class="info-row"><span class="info-label">👤 Solicitante:</span> ${d.requesterName}</div>
                      ${d.requesterEmail ? `<div class="info-row"><span class="info-label">📧 Email:</span> ${d.requesterEmail}</div>` : ''}
                      ${d.requesterPhone ? `<div class="info-row"><span class="info-label">📞 Teléfono:</span> ${d.requesterPhone}</div>` : ''}
                    </div>
                  </div>

                  <a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets" class="btn">Ver Ticket</a>
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

  async sendTaskAssignment(to: string | string[], data: TaskAssignmentData): Promise<boolean> {
    return this.sendEmail(to, 'task_assignment', data)
  }

  async sendTaskReminder(to: string | string[], data: TaskReminderData): Promise<boolean> {
    return this.sendEmail(to, 'task_reminder', data)
  }
}

// Singleton instance
export const emailService = new EmailService()
export type { MaintenanceReminderData, ParameterAlertData, EmergencyAlertData, TaskAssignmentData, TaskReminderData }
