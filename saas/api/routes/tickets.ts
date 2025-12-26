/**
 * Tickets Routes for SaaS
 */
import { Router, Request, Response } from 'express'
import { ticketsDAL, ticketCommentsDAL, plantsDAL } from '../lib/dal.js'

const router = Router()

// Get all tickets
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { plantId, status, category, priority, from, to, search } = req.query

    const tickets = ticketsDAL.getAll(organizationId, {
      plantId: plantId as string,
      status: status as string,
      category: category as string,
      priority: priority as string,
      from: from as string,
      to: to as string,
      search: search as string
    })

    res.json({ success: true, data: tickets })
  } catch (error: any) {
    console.error('Error fetching tickets:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get ticket stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { plantId } = req.query
    const stats = ticketsDAL.getStats(organizationId, plantId as string)

    res.json({ success: true, data: stats })
  } catch (error: any) {
    console.error('Error fetching ticket stats:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get single ticket
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const ticket = ticketsDAL.getById(organizationId, req.params.id)
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    res.json({ success: true, data: ticket })
  } catch (error: any) {
    console.error('Error fetching ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { plantId, subject, description, category, priority, requesterName, requesterEmail, requesterPhone, assignedTo } = req.body

    const ticket = ticketsDAL.create(organizationId, {
      plantId,
      subject,
      description,
      category,
      priority,
      requesterName,
      requesterEmail,
      requesterPhone,
      assignedTo
    })

    res.json({ success: true, data: ticket })
  } catch (error: any) {
    console.error('Error creating ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Update ticket
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const ticket = ticketsDAL.update(organizationId, req.params.id, req.body)
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    res.json({ success: true, data: ticket })
  } catch (error: any) {
    console.error('Error updating ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete ticket
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const deleted = ticketsDAL.delete(organizationId, req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ticket not found' })
    }

    res.json({ success: true, message: 'Ticket deleted' })
  } catch (error: any) {
    console.error('Error deleting ticket:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get ticket comments
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const comments = ticketCommentsDAL.getByTicketId(organizationId, req.params.id)
    res.json({ success: true, data: comments })
  } catch (error: any) {
    console.error('Error fetching comments:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Add comment to ticket
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    const user = (req as any).user
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { content, isInternal } = req.body
    const comment = ticketCommentsDAL.create(organizationId, {
      ticketId: req.params.id,
      authorName: user?.name || 'Usuario',
      authorEmail: user?.email,
      comment: content,
      isInternal: isInternal || false
    })

    res.json({ success: true, data: comment })
  } catch (error: any) {
    console.error('Error creating comment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
