/**
 * CAD Converter Service
 * Handles conversion between DWG, DXF, and PDF formats
 *
 * Requirements:
 * - LibreDWG (libredwg-tools): sudo apt-get install libredwg-tools
 * - Python with ezdxf: pip3 install ezdxf matplotlib
 * - Or ODA File Converter for better DWG support
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

export interface ConversionResult {
  success: boolean
  outputPath?: string
  error?: string
  converter?: string
}

export interface CADFileInfo {
  format: 'dwg' | 'dxf' | 'unknown'
  size: number
  name: string
}

/**
 * Detect CAD file format from extension
 */
export function detectCADFormat(filePath: string): CADFileInfo['format'] {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.dwg') return 'dwg'
  if (ext === '.dxf') return 'dxf'
  return 'unknown'
}

/**
 * Check if a file is a CAD file (DWG or DXF)
 */
export function isCADFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ext === '.dwg' || ext === '.dxf'
}

/**
 * Get CAD file info
 */
export async function getCADFileInfo(filePath: string): Promise<CADFileInfo | null> {
  try {
    const stats = await fs.stat(filePath)
    return {
      format: detectCADFormat(filePath),
      size: stats.size,
      name: path.basename(filePath)
    }
  } catch {
    return null
  }
}

/**
 * Check if LibreDWG is available
 */
async function hasLibreDWG(): Promise<boolean> {
  try {
    await execAsync('which dwg2dxf')
    return true
  } catch {
    return false
  }
}

/**
 * Check if ODA File Converter is available
 */
async function hasODAConverter(): Promise<boolean> {
  const odaPaths = [
    '/opt/ODAFileConverter/ODAFileConverter',
    '/usr/local/bin/ODAFileConverter',
    process.env.ODA_CONVERTER_PATH || ''
  ]

  for (const odaPath of odaPaths) {
    if (odaPath && existsSync(odaPath)) {
      return true
    }
  }
  return false
}

/**
 * Check if Python ezdxf is available
 */
async function hasEzdxf(): Promise<boolean> {
  try {
    await execAsync('python3 -c "import ezdxf"')
    return true
  } catch {
    return false
  }
}

/**
 * Convert DWG to DXF using LibreDWG
 */
async function convertDwgToDxfWithLibreDWG(inputPath: string, outputPath: string): Promise<ConversionResult> {
  try {
    await execAsync(`dwg2dxf -o "${outputPath}" "${inputPath}"`)

    // Verify output file exists
    if (existsSync(outputPath)) {
      return { success: true, outputPath, converter: 'libredwg' }
    }
    return { success: false, error: 'Output file not created' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Convert DWG to DXF using ODA File Converter
 */
async function convertDwgToDxfWithODA(inputPath: string, outputPath: string): Promise<ConversionResult> {
  const odaPath = process.env.ODA_CONVERTER_PATH || '/opt/ODAFileConverter/ODAFileConverter'
  const inputDir = path.dirname(inputPath)
  const outputDir = path.dirname(outputPath)
  const inputFilename = path.basename(inputPath)

  try {
    // ODA syntax: ODAFileConverter "Input Folder" "Output Folder" ACAD2018 DXF 0 1 "filename"
    await execAsync(`"${odaPath}" "${inputDir}" "${outputDir}" ACAD2018 DXF 0 1 "${inputFilename}"`)

    if (existsSync(outputPath)) {
      return { success: true, outputPath, converter: 'oda' }
    }
    return { success: false, error: 'Output file not created' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Convert DWG to DXF - tries multiple converters
 */
export async function convertDwgToDxf(inputPath: string): Promise<ConversionResult> {
  const outputPath = inputPath.replace(/\.dwg$/i, '.dxf')

  // Check if already converted
  if (existsSync(outputPath)) {
    return { success: true, outputPath, converter: 'cached' }
  }

  // Try LibreDWG first (open source)
  if (await hasLibreDWG()) {
    const result = await convertDwgToDxfWithLibreDWG(inputPath, outputPath)
    if (result.success) return result
  }

  // Try ODA File Converter (better compatibility)
  if (await hasODAConverter()) {
    const result = await convertDwgToDxfWithODA(inputPath, outputPath)
    if (result.success) return result
  }

  return {
    success: false,
    error: 'No DWG converter available. Install LibreDWG (sudo apt-get install libredwg-tools) or ODA File Converter.'
  }
}

/**
 * Convert DXF to PDF using Python ezdxf + matplotlib
 */
export async function convertDxfToPdf(inputPath: string): Promise<ConversionResult> {
  const outputPath = inputPath.replace(/\.dxf$/i, '.pdf')

  // Check if already converted
  if (existsSync(outputPath)) {
    return { success: true, outputPath, converter: 'cached' }
  }

  if (!await hasEzdxf()) {
    return {
      success: false,
      error: 'Python ezdxf not available. Install with: pip3 install ezdxf matplotlib'
    }
  }

  const pythonScript = `
import ezdxf
from ezdxf.addons.drawing import matplotlib
import matplotlib.pyplot as plt

doc = ezdxf.readfile('${inputPath.replace(/'/g, "\\'")}')
msp = doc.modelspace()

fig = plt.figure()
ax = fig.add_axes([0, 0, 1, 1])
ctx = matplotlib.RenderContext(doc)
out = matplotlib.MatplotlibBackend(ax)
matplotlib.Frontend(ctx, out).draw_layout(msp)

fig.savefig('${outputPath.replace(/'/g, "\\'")}', format='pdf', bbox_inches='tight', dpi=150)
plt.close(fig)
print('OK')
`

  try {
    const { stdout } = await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, {
      timeout: 60000 // 60 second timeout for large files
    })

    if (existsSync(outputPath)) {
      return { success: true, outputPath, converter: 'ezdxf' }
    }
    return { success: false, error: 'PDF not created' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Convert any CAD file to DXF for viewing
 */
export async function convertToViewable(inputPath: string): Promise<ConversionResult> {
  const format = detectCADFormat(inputPath)

  if (format === 'dxf') {
    // Already in viewable format
    return { success: true, outputPath: inputPath, converter: 'none' }
  }

  if (format === 'dwg') {
    return convertDwgToDxf(inputPath)
  }

  return { success: false, error: 'Unsupported file format' }
}

/**
 * Convert any CAD file to PDF for download
 */
export async function convertToPdf(inputPath: string): Promise<ConversionResult> {
  const format = detectCADFormat(inputPath)
  let dxfPath = inputPath

  // If DWG, first convert to DXF
  if (format === 'dwg') {
    const dxfResult = await convertDwgToDxf(inputPath)
    if (!dxfResult.success) {
      return dxfResult
    }
    dxfPath = dxfResult.outputPath!
  }

  // Now convert DXF to PDF
  return convertDxfToPdf(dxfPath)
}

/**
 * Get system capabilities for CAD conversion
 */
export async function getCADCapabilities(): Promise<{
  canViewDxf: boolean
  canConvertDwg: boolean
  canExportPdf: boolean
  converters: string[]
}> {
  const converters: string[] = []

  if (await hasLibreDWG()) converters.push('libredwg')
  if (await hasODAConverter()) converters.push('oda')
  if (await hasEzdxf()) converters.push('ezdxf')

  return {
    canViewDxf: true, // DXF can always be viewed (parsed in browser)
    canConvertDwg: await hasLibreDWG() || await hasODAConverter(),
    canExportPdf: await hasEzdxf(),
    converters
  }
}

/**
 * Clean up temporary converted files
 */
export async function cleanupConvertedFiles(originalPath: string): Promise<void> {
  const basePath = originalPath.replace(/\.(dwg|dxf)$/i, '')
  const extensions = ['.dxf', '.pdf']

  for (const ext of extensions) {
    const filePath = basePath + ext
    if (filePath !== originalPath && existsSync(filePath)) {
      try {
        await fs.unlink(filePath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
