import { Router, type Request, type Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { writeLimiter } from '../middleware/rateLimit.js'
import { body, validationResult } from 'express-validator'
import { environmentalDAL } from '../lib/dal.js'

const router = Router()

// GET /api/analytics/environmental
router.get('/environmental', async (req: Request, res: Response) => {
  const { plantId, startDate, endDate, parameter, stream, page, limit } = req.query as Record<string, string>

  try {
    const pageNum = parseInt(page) || undefined
    const limitNum = parseInt(limit) || undefined
    const offset = pageNum && limitNum ? (pageNum - 1) * limitNum : undefined

    const data = environmentalDAL.getAll({
      plantId,
      parameter,
      stream,
      startDate,
      endDate,
      limit: limitNum,
      offset
    })

    const summary = Array.isArray(data)
      ? data.reduce<Record<string, any>>((acc, row: any) => {
          const key = row.parameter_type
          acc[key] = acc[key] || { count: 0, sum: 0, min: row.value, max: row.value }
          acc[key].count++
          acc[key].sum += Number(row.value)
          acc[key].min = Math.min(acc[key].min, Number(row.value))
          acc[key].max = Math.max(acc[key].max, Number(row.value))
          return acc
        }, {})
      : {}

    Object.keys(summary).forEach(k => {
      const s = summary[k]
      s.avg = s.count ? s.sum / s.count : 0
    })

    res.json({ success: true, data, summary })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/analytics/environmental (admin only) - insert or update a measurement
router.post(
  '/environmental',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('parameter').isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').isISO8601(),
    body('value').isFloat({ min: 0 }),
    body('stream').optional().isIn(['influent', 'effluent']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, parameter, measurementDate, value, stream } = req.body

    try {
      // Try to find existing row with exact keys
      const existing = environmentalDAL.findByKeys(plantId, parameter, measurementDate, stream)

      if (existing) {
        // Update
        const data = environmentalDAL.update((existing as any).id, { value, stream })
        return res.json({ success: true, data, updated: 1 })
      } else {
        // Insert
        const data = environmentalDAL.create({
          plantId,
          parameter,
          measurementDate,
          value,
          stream
        })
        return res.status(201).json({ success: true, data, inserted: 1 })
      }
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// PUT /api/analytics/environmental/:id (admin only) - update by ID
router.put(
  '/environmental/:id',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').optional().isString(),
    body('parameter').optional().isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').optional().isISO8601(),
    body('value').optional().isFloat({ min: 0 }),
    body('stream').optional().isIn(['influent', 'effluent']),
    body('unit').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const id = req.params.id
    const { plantId, parameter, measurementDate, value, stream, unit } = req.body

    try {
      const data = environmentalDAL.update(id, {
        plantId,
        parameter,
        measurementDate,
        value,
        stream,
        unit
      })
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

// DELETE /api/analytics/environmental/:id (admin only)
router.delete('/environmental/:id', requireAuth, requireAdmin, writeLimiter, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    environmentalDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// DELETE /api/analytics/environmental (admin only) by keys
router.delete(
  '/environmental',
  requireAuth,
  requireAdmin,
  writeLimiter,
  [
    body('plantId').isString(),
    body('parameter').isIn(['DQO', 'pH', 'SS']),
    body('measurementDate').isISO8601(),
    body('stream').optional().isIn(['influent', 'effluent']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }
    const { plantId, parameter, measurementDate, stream } = req.body

    try {
      const existing = environmentalDAL.findByKeys(plantId, parameter, measurementDate, stream)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'Measurement not found' })
      }
      environmentalDAL.delete((existing as any).id)
      res.json({ success: true, deleted: 1 })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

export default router
