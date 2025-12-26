/**
 * Dashboard Routes for SaaS
 */
import { Router, Request, Response } from 'express'
import { plantsDAL, ticketsDAL, environmentalDAL } from '../lib/dal.js'

const router = Router()

// Dashboard summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const plants = plantsDAL.getAll(organizationId)
    const ticketStats = ticketsDAL.getStats(organizationId)

    res.json({
      success: true,
      data: {
        plants: {
          total: plants.length,
          active: plants.filter((p: any) => p.status === 'active').length,
          in_maintenance: plants.filter((p: any) => p.status === 'maintenance').length
        },
        emergencies: {
          total: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        maintenance: {
          total: 0,
          urgent: 0,
          soon: 0
        },
        checklists: {
          total_plants: plants.length,
          completed: 0,
          started: 0,
          pending: plants.length
        },
        tickets: ticketStats
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Upcoming maintenance
router.get('/upcoming-maintenance', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    res.json({
      success: true,
      data: {
        all: [],
        urgent: [],
        soon: [],
        planned: [],
        total: 0
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Cost per m3
router.get('/cost-per-m3', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    res.json({
      success: true,
      data: {
        byPlant: [],
        overall: {
          avg_cost_per_m3: 0,
          total_volume: 0,
          total_cost: 0
        },
        history: []
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// Environmental alerts
router.get('/environmental-alerts', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    res.json({
      success: true,
      data: {
        alerts: [],
        total: 0,
        critical: 0,
        warning: 0
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// User widget configuration
router.get('/widgets', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        layout: ['summary', 'maintenance', 'alerts', 'checklists']
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/widgets', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: req.body })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
