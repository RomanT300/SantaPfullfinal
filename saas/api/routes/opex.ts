/**
 * OPEX Routes for SaaS - Full implementation
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { opexCostsDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, requireAdmin, AuthRequest, requirePermission } from '../middleware/auth.js'
import { requireTenant, TenantRequest } from '../middleware/tenant.js'

const router = Router()

// Standard OPEX categories
const OPEX_CATEGORIES = [
  { id: 'chemicals', name: 'Químicos' },
  { id: 'electricity', name: 'Electricidad' },
  { id: 'maintenance', name: 'Mantenimiento' },
  { id: 'labor', name: 'Mano de obra' },
  { id: 'supplies', name: 'Suministros' },
  { id: 'sludge', name: 'Disposición de lodos' },
  { id: 'testing', name: 'Análisis y pruebas' },
  { id: 'other', name: 'Otros' }
]

/**
 * GET /api/opex
 * Get all OPEX entries for the organization
 */
router.get(
  '/',
  requireAuth,
  requireTenant,
  requirePermission('analytics:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { plantId, year, month, category, limit, offset } = req.query as Record<string, string>

    try {
      const costs = opexCostsDAL.getAll(tenantReq.tenant!.organizationId, {
        plantId,
        year: year ? parseInt(year) : undefined,
        month: month ? parseInt(month) : undefined,
        category,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined
      })
      res.json({ success: true, data: costs })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/opex/summary
 * Get OPEX summary by category
 */
router.get(
  '/summary',
  requireAuth,
  requireTenant,
  requirePermission('analytics:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { year, plantId } = req.query as Record<string, string>

    try {
      const targetYear = year ? parseInt(year) : new Date().getFullYear()

      const summary = opexCostsDAL.getSummary(tenantReq.tenant!.organizationId, targetYear, plantId)
      const monthlyTrend = opexCostsDAL.getMonthlyTrend(tenantReq.tenant!.organizationId, targetYear, plantId)
      const yearTotal = opexCostsDAL.getTotalByYear(tenantReq.tenant!.organizationId, targetYear) as any

      // Calculate totals
      const totalSpent = yearTotal?.total_amount || 0
      const totalVolume = yearTotal?.total_volume || 0

      // Map categories with their data
      const categories = OPEX_CATEGORIES.map(cat => {
        const data = (summary as any[]).find((s: any) => s.category === cat.id)
        return {
          id: cat.id,
          name: cat.name,
          amount: data?.total_amount || 0,
          volume: data?.total_volume || 0,
          avgCostPerM3: data?.avg_cost_per_m3 || 0,
          entries: data?.entries || 0
        }
      })

      res.json({
        success: true,
        data: {
          year: targetYear,
          totalSpent,
          totalVolume,
          avgCostPerM3: totalVolume > 0 ? totalSpent / totalVolume : 0,
          plantsCount: yearTotal?.plants_count || 0,
          categories,
          monthlyTrend: (monthlyTrend as any[]).map((m: any) => ({
            month: m.month,
            amount: m.total_amount || 0,
            volume: m.total_volume || 0
          }))
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/opex/plant/:plantId
 * Get OPEX data for a specific plant
 */
router.get(
  '/plant/:plantId',
  requireAuth,
  requireTenant,
  requirePermission('analytics:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { plantId } = req.params
    const { year } = req.query as Record<string, string>

    try {
      const targetYear = year ? parseInt(year) : new Date().getFullYear()

      const data = opexCostsDAL.getByPlant(tenantReq.tenant!.organizationId, plantId, targetYear)
      const summary = opexCostsDAL.getSummary(tenantReq.tenant!.organizationId, targetYear, plantId)

      // Calculate total
      const total = (summary as any[]).reduce((sum: number, cat: any) => sum + (cat.total_amount || 0), 0)
      const totalVolume = (summary as any[]).reduce((sum: number, cat: any) => sum + (cat.total_volume || 0), 0)

      res.json({
        success: true,
        data: {
          plantId,
          year: targetYear,
          totalSpent: total,
          totalVolume,
          avgCostPerM3: totalVolume > 0 ? total / totalVolume : 0,
          byCategory: summary,
          monthly: data
        }
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/opex/categories
 * Get available OPEX categories
 */
router.get(
  '/categories',
  requireAuth,
  async (req: Request, res: Response) => {
    res.json({ success: true, data: OPEX_CATEGORIES })
  }
)

/**
 * GET /api/opex/:id
 * Get a specific OPEX entry
 */
router.get(
  '/:id',
  requireAuth,
  requireTenant,
  requirePermission('analytics:read'),
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    try {
      const cost = opexCostsDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!cost) {
        return res.status(404).json({ success: false, error: 'OPEX entry not found' })
      }
      res.json({ success: true, data: cost })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/opex
 * Create a new OPEX entry
 */
router.post(
  '/',
  requireAuth,
  requireTenant,
  requirePermission('analytics:create'),
  [
    body('plantId').isString().notEmpty(),
    body('year').isInt({ min: 2000, max: 2100 }),
    body('month').isInt({ min: 1, max: 12 }),
    body('category').isString().isIn(OPEX_CATEGORIES.map(c => c.id)),
    body('description').optional().isString(),
    body('amount').isFloat({ min: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('volumeM3').optional().isFloat({ min: 0 }),
    body('costPerM3').optional().isFloat({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { plantId, year, month, category, description, amount, currency, volumeM3, costPerM3 } = req.body

    try {
      const cost = opexCostsDAL.create(tenantReq.tenant!.organizationId, {
        plantId,
        year,
        month,
        category,
        description,
        amount,
        currency,
        volumeM3,
        costPerM3
      })

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'opex.created',
        entityType: 'opex',
        entityId: (cost as any)?.id,
        newValue: { category, amount, year, month },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({ success: true, data: cost })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * POST /api/opex/import
 * Bulk import OPEX entries
 */
router.post(
  '/import',
  requireAuth,
  requireTenant,
  requireAdmin,
  [body('records').isArray({ min: 1 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { records } = req.body

    try {
      // Validate each record
      for (const rec of records) {
        if (!rec.plantId || !rec.year || !rec.month || !rec.category || rec.amount === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Each record must have plantId, year, month, category, and amount'
          })
        }
        if (!OPEX_CATEGORIES.some(c => c.id === rec.category)) {
          return res.status(400).json({
            success: false,
            error: `Invalid category: ${rec.category}`
          })
        }
      }

      const count = opexCostsDAL.bulkCreate(tenantReq.tenant!.organizationId, records)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'opex.bulk_import',
        entityType: 'opex',
        newValue: { count, records: records.length },
        ipAddress: req.ip || undefined
      })

      res.status(201).json({ success: true, data: { imported: count } })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * PATCH /api/opex/:id
 * Update an OPEX entry
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  requirePermission('analytics:update'),
  [
    body('year').optional().isInt({ min: 2000, max: 2100 }),
    body('month').optional().isInt({ min: 1, max: 12 }),
    body('category').optional().isString().isIn(OPEX_CATEGORIES.map(c => c.id)),
    body('description').optional().isString(),
    body('amount').optional().isFloat({ min: 0 }),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('volumeM3').optional().isFloat({ min: 0 }),
    body('costPerM3').optional().isFloat({ min: 0 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = opexCostsDAL.getById(tenantReq.tenant!.organizationId, id)
      if (!existing) {
        return res.status(404).json({ success: false, error: 'OPEX entry not found' })
      }

      const cost = opexCostsDAL.update(tenantReq.tenant!.organizationId, id, req.body)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'opex.updated',
        entityType: 'opex',
        entityId: id,
        oldValue: existing,
        newValue: req.body,
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, data: cost })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/opex/:id
 * Delete an OPEX entry (admin only)
 */
router.delete(
  '/:id',
  requireAuth,
  requireTenant,
  requireAdmin,
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest & AuthRequest
    const { id } = req.params

    try {
      const existing = opexCostsDAL.getById(tenantReq.tenant!.organizationId, id) as any
      if (!existing) {
        return res.status(404).json({ success: false, error: 'OPEX entry not found' })
      }

      const deleted = opexCostsDAL.delete(tenantReq.tenant!.organizationId, id)

      // Log audit
      auditLogsDAL.create(tenantReq.tenant!.organizationId, {
        userId: tenantReq.user!.sub,
        action: 'opex.deleted',
        entityType: 'opex',
        entityId: id,
        oldValue: { category: existing.category, amount: existing.amount },
        ipAddress: req.ip || undefined
      })

      res.json({ success: true, deleted })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message })
    }
  }
)

export default router
