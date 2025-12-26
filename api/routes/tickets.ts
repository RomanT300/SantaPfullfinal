import { Router, type Request, type Response } from 'express'
import { body, validationResult } from 'express-validator'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { writeLimiter } from '../middleware/rateLimit.js'
import { ticketsDAL, ticketCommentsDAL, plantsDAL } from '../lib/dal.js'
import { emailService } from '../services/emailService.js'

const router = Router()

// GET /api/tickets - Get all tickets with filters
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { plantId, status, category, priority, from, to, search } = req.query as Record<string, string>

  try {
    const data = ticketsDAL.getAll({ plantId, status, category, priority, from, to, search })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/tickets/stats - Get ticket statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  const { plantId } = req.query as Record<string, string>

  try {
    const stats = ticketsDAL.getStats(plantId)
    res.json({ success: true, data: stats })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/tickets/:id - Get ticket by ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const ticket = ticketsDAL.getById(id)
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    // Get comments for this ticket
    const comments = ticketCommentsDAL.getByTicketId(id)

    res.json({ success: true, data: { ...(ticket as Record<string, any>), comments } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/tickets - Create a new ticket
router.post(
  '/',
  requireAuth,
  writeLimiter,
  [
    body('plantId').isString().notEmpty(),
    body('subject').isString().notEmpty(),
    body('description').isString().notEmpty(),
    body('category').isIn(['mantenimiento', 'repuestos', 'insumos', 'consulta', 'emergencia', 'otro']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('requesterName').isString().notEmpty(),
    body('requesterEmail').optional().isEmail(),
    body('requesterPhone').optional().isString(),
    body('assignedTo').optional().isString(),
    body('sendEmail').optional().isBoolean(),
    body('sendWhatsapp').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const {
      plantId, subject, description, category, priority,
      requesterName, requesterEmail, requesterPhone, assignedTo,
      sendEmail, sendWhatsapp
    } = req.body

    try {
      const ticket = ticketsDAL.create({
        plantId,
        subject,
        description,
        category,
        priority,
        requesterName,
        requesterEmail,
        requesterPhone,
        assignedTo
      }) as any

      // Send notifications if requested
      if (sendEmail && process.env.TICKET_NOTIFICATION_EMAILS) {
        const plant = plantsDAL.getById(plantId) as any
        try {
          await emailService.sendEmail(
            process.env.TICKET_NOTIFICATION_EMAILS.split(',').map(e => e.trim()),
            'ticket_new',
            {
              ticketNumber: ticket.ticket_number,
              subject,
              description,
              category,
              priority: priority || 'medium',
              plantName: plant?.name || 'N/A',
              requesterName,
              requesterEmail,
              requesterPhone
            }
          )
          ticketsDAL.update(ticket.id, {
            sentViaEmail: true,
            emailSentAt: new Date().toISOString()
          })
        } catch (emailError) {
          console.error('Error sending ticket email:', emailError)
        }
      }

      // WhatsApp notification (generate link for manual sending)
      if (sendWhatsapp) {
        ticketsDAL.update(ticket.id, {
          sentViaWhatsapp: true,
          whatsappSentAt: new Date().toISOString()
        })
      }

      const updatedTicket = ticketsDAL.getById(ticket.id)
      res.status(201).json({ success: true, data: updatedTicket })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// PATCH /api/tickets/:id - Update ticket
router.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  [
    body('subject').optional().isString(),
    body('description').optional().isString(),
    body('category').optional().isIn(['mantenimiento', 'repuestos', 'insumos', 'consulta', 'emergencia', 'otro']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('status').optional().isIn(['open', 'in_progress', 'waiting', 'resolved', 'closed']),
    body('assignedTo').optional().isString(),
    body('resolutionNotes').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { id } = req.params
    const updates = req.body

    try {
      const existing = ticketsDAL.getById(id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      // If status changes to resolved, set resolved_at
      if (updates.status === 'resolved' && (existing as any).status !== 'resolved') {
        updates.resolvedAt = new Date().toISOString()
      }

      const data = ticketsDAL.update(id, updates)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// POST /api/tickets/:id/comments - Add comment to ticket
router.post(
  '/:id/comments',
  requireAuth,
  writeLimiter,
  [
    body('comment').isString().notEmpty(),
    body('isInternal').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { id } = req.params
    const { comment, isInternal } = req.body
    const user = (req as any).user

    try {
      const ticket = ticketsDAL.getById(id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const newComment = ticketCommentsDAL.create({
        ticketId: id,
        authorName: user?.name || 'Usuario',
        authorEmail: user?.email,
        comment,
        isInternal: isInternal || false
      })

      res.status(201).json({ success: true, data: newComment })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// GET /api/tickets/:id/comments - Get ticket comments
router.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const comments = ticketCommentsDAL.getByTicketId(id)
    res.json({ success: true, data: comments })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/tickets/:id/send-email - Send ticket via email
router.post('/:id/send-email', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const { recipients } = req.body

  try {
    const ticket = ticketsDAL.getById(id) as any
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    const emailRecipients = recipients || process.env.TICKET_NOTIFICATION_EMAILS
    if (!emailRecipients) {
      return res.status(400).json({ success: false, error: 'No recipients configured' })
    }

    const plant = plantsDAL.getById(ticket.plant_id) as any

    await emailService.sendEmail(
      Array.isArray(emailRecipients) ? emailRecipients : emailRecipients.split(',').map((e: string) => e.trim()),
      'ticket_new',
      {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        plantName: plant?.name || 'N/A',
        requesterName: ticket.requester_name,
        requesterEmail: ticket.requester_email,
        requesterPhone: ticket.requester_phone
      }
    )

    ticketsDAL.update(id, {
      sentViaEmail: true,
      emailSentAt: new Date().toISOString()
    })

    res.json({ success: true, message: 'Email sent successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/tickets/:id/whatsapp-link - Generate WhatsApp link for ticket
router.get('/:id/whatsapp-link', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params
  const { phone } = req.query as Record<string, string>

  try {
    const ticket = ticketsDAL.getById(id) as any
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    const plant = plantsDAL.getById(ticket.plant_id) as any

    // Category labels
    const categoryLabels: Record<string, string> = {
      mantenimiento: 'Mantenimiento',
      repuestos: 'Repuestos',
      insumos: 'Insumos',
      consulta: 'Consulta',
      emergencia: 'Emergencia',
      otro: 'Otro'
    }

    // Priority labels
    const priorityLabels: Record<string, string> = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente'
    }

    const message = `🎫 *TICKET DE SOPORTE*
━━━━━━━━━━━━━━━━━━
📋 *Número:* ${ticket.ticket_number}
🏭 *Planta:* ${plant?.name || 'N/A'}
📁 *Categoría:* ${categoryLabels[ticket.category] || ticket.category}
⚡ *Prioridad:* ${priorityLabels[ticket.priority] || ticket.priority}

📝 *Asunto:*
${ticket.subject}

📄 *Descripción:*
${ticket.description}

👤 *Solicitante:* ${ticket.requester_name}
${ticket.requester_email ? `📧 ${ticket.requester_email}` : ''}
${ticket.requester_phone ? `📞 ${ticket.requester_phone}` : ''}

📅 *Fecha:* ${new Date(ticket.created_at).toLocaleDateString('es-EC', { dateStyle: 'full' })}
━━━━━━━━━━━━━━━━━━
Sistema PTAR Santa Priscila`

    const targetPhone = phone || process.env.WHATSAPP_SUPPORT_NUMBER || ''
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '')
    const encodedMessage = encodeURIComponent(message)
    const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`

    // Mark as sent via WhatsApp
    ticketsDAL.update(id, {
      sentViaWhatsapp: true,
      whatsappSentAt: new Date().toISOString()
    })

    res.json({
      success: true,
      data: {
        link: whatsappLink,
        message,
        phone: cleanPhone
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// DELETE /api/tickets/:id - Delete ticket (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const existing = ticketsDAL.getById(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    ticketsDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
