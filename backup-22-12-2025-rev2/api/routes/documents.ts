import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { documentsDAL } from '../lib/dal.js'

// Document type from database
type Document = {
  id: string
  plant_id: string
  file_name: string
  file_path: string
  category: string
  description: string | null
  uploaded_by: string | null
  uploaded_at: string
}

const router = Router()

// local disk storage for MVP
const uploadDir = path.join(process.cwd(), 'uploads')

// Create uploads folder if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Dynamic storage that creates folder per plant
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const plantId = req.body.plantId || 'general'

    // Sanitize plantId to prevent path traversal (security fix)
    const safePlantId = path.basename(plantId)
    if (safePlantId !== plantId || plantId.includes('..') || plantId.includes('/') || plantId.includes('\\')) {
      return cb(new Error('Invalid plant ID'), '')
    }

    const plantDir = path.join(uploadDir, safePlantId)

    // Create plant folder if it doesn't exist
    if (!fs.existsSync(plantDir)) {
      fs.mkdirSync(plantDir, { recursive: true })
    }

    cb(null, plantDir)
  },
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
})

const maxSize = Number(process.env.MAX_FILE_SIZE || process.env.UPLOAD_MAX_FILE_SIZE || 100 * 1024 * 1024) // 100MB for large files
// Allowed MIME types - removed generic 'application/octet-stream' for security
const allowedMimes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  // Office documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // .xlsb
  'application/msword', // .doc
  'application/vnd.ms-excel', // .xls
  // CAD files - specific MIME types only
  'application/acad', // .dwg
  'application/x-acad',
  'application/autocad_dwg',
  'image/vnd.dwg',
  'application/dwg',
  'drawing/dwg',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
])

// Allowed extensions - strict list (no executable files)
const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.xlsx', '.xls', '.xlsb', '.dwg', '.zip'])

// Blocked dangerous extensions (even if MIME type is spoofed)
const blockedExtensions = new Set(['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.msi', '.dll', '.scr', '.com', '.pif'])

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()

    // First check if extension is in blocked list (security priority)
    if (blockedExtensions.has(ext)) {
      return cb(new Error(`Tipo de archivo bloqueado por seguridad: ${ext}`))
    }

    // Then check if allowed by MIME type or extension whitelist
    if (allowedMimes.has(file.mimetype) || allowedExtensions.has(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype} (${ext})`))
    }
  },
})

// GET /api/documents (authenticated users)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const { plantId, category, search, sortBy = 'uploaded_at', order = 'desc' } = (req.query || {}) as Record<string, string>

  try {
    const data = documentsDAL.getAll({
      plantId,
      category,
      search,
      sortBy,
      order
    })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/documents/upload (admin only)
router.post('/upload', requireAuth, requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as any).file
  const { plantId, category, description } = req.body
  if (!file || !plantId || !category) {
    return res.status(400).json({ success: false, error: 'Missing file/plantId/category' })
  }

  try {
    const data = documentsDAL.create({
      plantId,
      fileName: file.originalname,
      filePath: `/uploads/${plantId}/${file.filename}`,
      category,
      description,
      uploadedBy: (req as any).user?.sub
    })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// GET /api/documents/download/:id (authenticated users)
router.get('/download/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id

  try {
    const doc = documentsDAL.getById(id) as Document | undefined
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    // Ensure file path is safe (prevent path traversal)
    const safePath = path.join(process.cwd(), doc.file_path)
    const uploadDirResolved = path.resolve(uploadDir)
    if (!safePath.startsWith(uploadDirResolved)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    // Check if file exists
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' })
    }

    // Send file with proper headers
    res.download(safePath, doc.file_name)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/documents/preview/:id (authenticated users) - Serve file for inline viewing
router.get('/preview/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id

  try {
    const doc = documentsDAL.getById(id) as Document | undefined
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' })
    }

    // Ensure file path is safe (prevent path traversal)
    const safePath = path.join(process.cwd(), doc.file_path)
    const uploadDirResolved = path.resolve(uploadDir)
    if (!safePath.startsWith(uploadDirResolved)) {
      return res.status(400).json({ success: false, error: 'Invalid file path' })
    }

    // Check if file exists
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' })
    }

    // Determine content type based on extension
    const ext = path.extname(doc.file_name).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.doc': 'application/msword',
      '.xls': 'application/vnd.ms-excel',
      '.dwg': 'application/octet-stream',
      '.zip': 'application/zip',
    }

    const contentType = mimeTypes[ext] || 'application/octet-stream'

    // Set headers for inline display
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.file_name)}"`)

    // Stream the file
    const fileStream = fs.createReadStream(safePath)
    fileStream.pipe(res)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// DELETE /api/documents/:id (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = req.params.id
  try {
    documentsDAL.delete(id)
    res.json({ success: true, deleted: 1 })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
