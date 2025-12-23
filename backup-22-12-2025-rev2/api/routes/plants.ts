import { Router, type Request, type Response } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { body, validationResult } from 'express-validator'
import { plantsDAL } from '../lib/dal.js'

const router = Router()

// GET /api/plants (authenticated users)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { search, status } = (req.query || {}) as Record<string, string>

  try {
    const data = plantsDAL.getAll({ search, status })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post(
  '/',
  requireAuth,
  requireAdmin,
  [body('name').isString(), body('location').isString(), body('latitude').isFloat(), body('longitude').isFloat()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })
    const { name, location, latitude, longitude, status = 'active' } = req.body
    try {
      const data = plantsDAL.create({ name, location, latitude, longitude, status })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// PUT /api/plants/:id (admin only)
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  [
    body('name').optional().isString(),
    body('location').optional().isString(),
    body('latitude').optional().isFloat(),
    body('longitude').optional().isFloat(),
    body('status').optional().isIn(['active', 'inactive']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() })
    const id = req.params.id
    const { name, location, latitude, longitude, status } = req.body
    try {
      const data = plantsDAL.update(id, { name, location, latitude, longitude, status })
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  },
)

// DELETE /api/plants/:id (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    plantsDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router