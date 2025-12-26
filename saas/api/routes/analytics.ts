/**
 * Environmental Analytics Routes for SaaS
 */
import { Router, Request, Response } from 'express'
import { environmentalDAL, plantsDAL } from '../lib/dal.js'

const router = Router()

// Get environmental data
router.get('/environmental', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { plantId, parameter, stream, startDate, endDate, limit, offset } = req.query

    const data = environmentalDAL.getAll(organizationId, {
      plantId: plantId as string,
      parameter: parameter as string,
      stream: stream as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    })

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching environmental data:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Create environmental record
router.post('/environmental', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { plantId, date, parameter, stream, value, unit } = req.body

    const record = environmentalDAL.create(organizationId, {
      plantId,
      date,
      parameter,
      stream,
      value,
      unit
    })

    res.json({ success: true, data: record })
  } catch (error: any) {
    console.error('Error creating environmental record:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Delete environmental record
router.delete('/environmental/:id', async (req: Request, res: Response) => {
  try {
    const organizationId = (req as any).user?.organizationId
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const deleted = environmentalDAL.delete(organizationId, req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Record not found' })
    }

    res.json({ success: true, message: 'Record deleted' })
  } catch (error: any) {
    console.error('Error deleting environmental record:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
