/**
 * Documents Routes for SaaS
 * Handles document management with CAD file support (DWG, DXF, PDF conversion)
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { existsSync, createReadStream } from 'fs'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth.js'
import { requireTenant, TenantRequest } from '../middleware/tenant.js'
import { db } from '../lib/database.js'
import {
  isCADFile,
  getCADFileInfo,
  convertToViewable,
  convertToPdf,
  getCADCapabilities,
  detectCADFormat
} from '../services/cadConverter.js'

const router = Router()

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'documents')

// Ensure upload directory exists
fs.mkdir(uploadDir, { recursive: true }).catch(() => {})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantReq = req as TenantRequest
    const orgDir = path.join(uploadDir, tenantReq.tenant?.organizationId || 'unknown')
    fs.mkdir(orgDir, { recursive: true })
      .then(() => cb(null, orgDir))
      .catch(err => cb(err, orgDir))
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types + CAD files
    const allowedTypes = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.json', '.xml',
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.dwg', '.dxf' // CAD files
    ]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${ext} not allowed`))
    }
  }
})

// Document categories
const CATEGORIES = [
  'planos', 'manuales', 'reportes', 'certificados',
  'permisos', 'contratos', 'facturas', 'fotos', 'otros'
]

/**
 * GET /api/documents
 * List all documents for the organization
 */
router.get('/', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const { plantId, category, search } = req.query

    let query = `
      SELECT d.*, p.name as plant_name
      FROM documents d
      LEFT JOIN plants p ON d.plant_id = p.id
      WHERE d.organization_id = ?
    `
    const params: any[] = [tenantReq.tenant!.organizationId]

    if (plantId) {
      query += ' AND d.plant_id = ?'
      params.push(plantId)
    }

    if (category) {
      query += ' AND d.category = ?'
      params.push(category)
    }

    if (search) {
      query += ' AND (d.name LIKE ? OR d.file_path LIKE ?)'
      params.push(`%${search}%`, `%${search}%`)
    }

    query += ' ORDER BY d.created_at DESC'

    const documents = db.prepare(query).all(...params)

    // Add CAD info to each document
    const docsWithCADInfo = documents.map((doc: any) => ({
      ...doc,
      isCADFile: isCADFile(doc.name),
      cadFormat: isCADFile(doc.name) ? detectCADFormat(doc.file_path) : null
    }))

    res.json({ success: true, data: docsWithCADInfo })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/documents/categories
 * Get available document categories
 */
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  res.json({ success: true, data: CATEGORIES })
})

/**
 * GET /api/documents/cad-capabilities
 * Check CAD conversion capabilities on this server
 */
router.get('/cad-capabilities', requireAuth, async (req: Request, res: Response) => {
  try {
    const capabilities = await getCADCapabilities()
    res.json({ success: true, data: capabilities })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/documents
 * Upload a new document
 */
router.post(
  '/',
  requireAuth,
  requireTenant,
  upload.single('file'),
  [
    body('name').optional().isString(),
    body('plantId').optional().isUUID(),
    body('category').optional().isIn(CATEGORIES)
  ],
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const file = req.file

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' })
    }

    try {
      const id = randomUUID()
      const name = req.body.name || file.originalname
      const category = req.body.category || 'otros'
      const plantId = req.body.plantId || null

      const stmt = db.prepare(`
        INSERT INTO documents (id, organization_id, plant_id, name, file_path, file_type, file_size, category, uploaded_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)

      stmt.run(
        id,
        tenantReq.tenant!.organizationId,
        plantId,
        name,
        file.path,
        file.mimetype,
        file.size,
        category,
        (tenantReq as any).user?.sub
      )

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, any> | undefined

      res.status(201).json({
        success: true,
        data: {
          ...(document || {}),
          isCADFile: isCADFile(name),
          cadFormat: isCADFile(name) ? detectCADFormat(file.path) : null
        }
      })
    } catch (error: any) {
      // Clean up uploaded file on error
      if (file.path) {
        fs.unlink(file.path).catch(() => {})
      }
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * GET /api/documents/:id
 * Get document details
 */
router.get('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const document = db.prepare(`
      SELECT d.*, p.name as plant_name
      FROM documents d
      LEFT JOIN plants p ON d.plant_id = p.id
      WHERE d.id = ? AND d.organization_id = ?
    `).get(id, tenantReq.tenant!.organizationId) as any

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    // Add CAD info
    const cadInfo = isCADFile(document.name) ? await getCADFileInfo(document.file_path) : null

    res.json({
      success: true,
      data: {
        ...document,
        isCADFile: isCADFile(document.name),
        cadInfo
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/documents/:id/download
 * Download original document
 */
router.get('/:id/download', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const document = db.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND organization_id = ?
    `).get(id, tenantReq.tenant!.organizationId) as any

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    if (!existsSync(document.file_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' })
    }

    res.download(document.file_path, document.name)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/documents/:id/preview
 * Get CAD file for viewing (converts DWG to DXF if needed)
 */
router.get('/:id/preview', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const document = db.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND organization_id = ?
    `).get(id, tenantReq.tenant!.organizationId) as any

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    if (!isCADFile(document.name)) {
      return res.status(400).json({ success: false, error: 'Not a CAD file' })
    }

    if (!existsSync(document.file_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' })
    }

    // Convert to viewable format (DXF)
    const result = await convertToViewable(document.file_path)

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        hint: 'Install LibreDWG: sudo apt-get install libredwg-tools'
      })
    }

    // Send DXF content as text
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('X-CAD-Converter', result.converter || 'unknown')
    createReadStream(result.outputPath!).pipe(res)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/documents/:id/convert-pdf
 * Convert CAD file to PDF and download
 */
router.post('/:id/convert-pdf', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const document = db.prepare(`
      SELECT * FROM documents
      WHERE id = ? AND organization_id = ?
    `).get(id, tenantReq.tenant!.organizationId) as any

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    if (!isCADFile(document.name)) {
      return res.status(400).json({ success: false, error: 'Not a CAD file' })
    }

    if (!existsSync(document.file_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' })
    }

    // Convert to PDF
    const result = await convertToPdf(document.file_path)

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        hint: 'Install ezdxf: pip3 install ezdxf matplotlib'
      })
    }

    // Send PDF
    const pdfName = document.name.replace(/\.(dwg|dxf)$/i, '.pdf')
    res.download(result.outputPath!, pdfName)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PATCH /api/documents/:id
 * Update document metadata
 */
router.patch(
  '/:id',
  requireAuth,
  requireTenant,
  [
    body('name').optional().isString(),
    body('category').optional().isIn(CATEGORIES),
    body('plantId').optional().isUUID()
  ],
  async (req: Request, res: Response) => {
    const tenantReq = req as TenantRequest
    const { id } = req.params

    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    try {
      const existing = db.prepare(`
        SELECT * FROM documents WHERE id = ? AND organization_id = ?
      `).get(id, tenantReq.tenant!.organizationId)

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Document not found' })
      }

      const { name, category, plantId } = req.body
      const updates: string[] = []
      const params: any[] = []

      if (name !== undefined) {
        updates.push('name = ?')
        params.push(name)
      }
      if (category !== undefined) {
        updates.push('category = ?')
        params.push(category)
      }
      if (plantId !== undefined) {
        updates.push('plant_id = ?')
        params.push(plantId)
      }

      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')")
        params.push(id, tenantReq.tenant!.organizationId)

        db.prepare(`
          UPDATE documents SET ${updates.join(', ')}
          WHERE id = ? AND organization_id = ?
        `).run(...params)
      }

      const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
      res.json({ success: true, data: document })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
)

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest
  const { id } = req.params

  try {
    const document = db.prepare(`
      SELECT * FROM documents WHERE id = ? AND organization_id = ?
    `).get(id, tenantReq.tenant!.organizationId) as any

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    // Delete file from disk
    if (document.file_path && existsSync(document.file_path)) {
      await fs.unlink(document.file_path)

      // Also delete any converted files
      const basePath = document.file_path.replace(/\.(dwg|dxf)$/i, '')
      for (const ext of ['.dxf', '.pdf']) {
        const convertedPath = basePath + ext
        if (convertedPath !== document.file_path && existsSync(convertedPath)) {
          await fs.unlink(convertedPath).catch(() => {})
        }
      }
    }

    // Delete from database
    db.prepare('DELETE FROM documents WHERE id = ?').run(id)

    res.json({ success: true, message: 'Document deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
