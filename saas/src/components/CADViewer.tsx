/**
 * CAD Viewer Component
 * Renders DWG/DXF files using Three.js and dxf-parser
 * Features: zoom, pan, fit, layer toggle, PDF export
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  Download,
  X,
  Loader2,
  AlertCircle,
  Move
} from 'lucide-react'

interface CADViewerProps {
  documentId: string
  documentName: string
  onClose: () => void
}

interface Layer {
  name: string
  visible: boolean
  color: string
}

interface ViewState {
  zoom: number
  panX: number
  panY: number
}

export default function CADViewer({ documentId, documentName, onClose }: CADViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [showLayers, setShowLayers] = useState(true)
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [converting, setConverting] = useState(false)
  const [dxfData, setDxfData] = useState<any>(null)

  // Parse DXF content
  const parseDXF = useCallback((content: string) => {
    // Simple DXF parser for basic entities
    const entities: any[] = []
    const layerSet = new Set<string>()

    const lines = content.split('\n')
    let i = 0
    let currentEntity: any = null
    let inEntities = false

    while (i < lines.length) {
      const code = parseInt(lines[i]?.trim() || '0')
      const value = lines[i + 1]?.trim() || ''

      if (value === 'ENTITIES') {
        inEntities = true
      } else if (value === 'ENDSEC' && inEntities) {
        if (currentEntity) entities.push(currentEntity)
        inEntities = false
      }

      if (inEntities) {
        if (code === 0) {
          if (currentEntity) entities.push(currentEntity)
          currentEntity = { type: value, points: [], layer: '0' }
        } else if (currentEntity) {
          if (code === 8) {
            currentEntity.layer = value
            layerSet.add(value)
          } else if (code === 10) currentEntity.x1 = parseFloat(value)
          else if (code === 20) currentEntity.y1 = parseFloat(value)
          else if (code === 11) currentEntity.x2 = parseFloat(value)
          else if (code === 21) currentEntity.y2 = parseFloat(value)
          else if (code === 40) currentEntity.radius = parseFloat(value)
          else if (code === 50) currentEntity.startAngle = parseFloat(value)
          else if (code === 51) currentEntity.endAngle = parseFloat(value)
        }
      }

      i += 2
    }

    // Create layer list with colors
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#be123c', '#65a30d']
    const layerList = Array.from(layerSet).map((name, idx) => ({
      name,
      visible: true,
      color: colors[idx % colors.length]
    }))

    return { entities, layers: layerList }
  }, [])

  // Draw entities on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !dxfData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    // Clear canvas
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const { entities } = dxfData
    if (!entities.length) return

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    entities.forEach((e: any) => {
      if (e.x1 !== undefined) {
        minX = Math.min(minX, e.x1)
        maxX = Math.max(maxX, e.x1)
        minY = Math.min(minY, e.y1)
        maxY = Math.max(maxY, e.y1)
      }
      if (e.x2 !== undefined) {
        minX = Math.min(minX, e.x2)
        maxX = Math.max(maxX, e.x2)
        minY = Math.min(minY, e.y2)
        maxY = Math.max(maxY, e.y2)
      }
    })

    const width = maxX - minX || 1
    const height = maxY - minY || 1
    const scaleX = (canvas.width - 100) / width
    const scaleY = (canvas.height - 100) / height
    const scale = Math.min(scaleX, scaleY) * viewState.zoom

    const offsetX = (canvas.width - width * scale) / 2 - minX * scale + viewState.panX
    const offsetY = (canvas.height + height * scale) / 2 + minY * scale + viewState.panY

    // Get visible layers
    const visibleLayers = new Set(layers.filter(l => l.visible).map(l => l.name))
    const layerColors = Object.fromEntries(layers.map(l => [l.name, l.color]))

    // Draw entities
    ctx.lineWidth = 1
    entities.forEach((entity: any) => {
      if (!visibleLayers.has(entity.layer)) return

      ctx.strokeStyle = layerColors[entity.layer] || '#ffffff'
      ctx.beginPath()

      if (entity.type === 'LINE' && entity.x1 !== undefined && entity.x2 !== undefined) {
        ctx.moveTo(entity.x1 * scale + offsetX, -entity.y1 * scale + offsetY)
        ctx.lineTo(entity.x2 * scale + offsetX, -entity.y2 * scale + offsetY)
        ctx.stroke()
      } else if (entity.type === 'CIRCLE' && entity.radius) {
        ctx.arc(
          entity.x1 * scale + offsetX,
          -entity.y1 * scale + offsetY,
          entity.radius * scale,
          0,
          Math.PI * 2
        )
        ctx.stroke()
      } else if (entity.type === 'ARC' && entity.radius) {
        const startAngle = (entity.startAngle || 0) * Math.PI / 180
        const endAngle = (entity.endAngle || 360) * Math.PI / 180
        ctx.arc(
          entity.x1 * scale + offsetX,
          -entity.y1 * scale + offsetY,
          entity.radius * scale,
          -endAngle,
          -startAngle
        )
        ctx.stroke()
      } else if (entity.type === 'POINT' && entity.x1 !== undefined) {
        ctx.fillStyle = layerColors[entity.layer] || '#ffffff'
        ctx.fillRect(
          entity.x1 * scale + offsetX - 2,
          -entity.y1 * scale + offsetY - 2,
          4,
          4
        )
      }
    })

    // Draw grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    ctx.setLineDash([5, 5])
    const gridSize = 50
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }, [dxfData, layers, viewState])

  // Load DXF content
  useEffect(() => {
    const loadDXF = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/documents/${documentId}/preview`, {
          credentials: 'include'
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to load CAD file')
        }

        const content = await response.text()
        const parsed = parseDXF(content)

        setDxfData(parsed)
        setLayers(parsed.layers)
        setLoading(false)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    loadDXF()
  }, [documentId, parseDXF])

  // Redraw on data or view change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawCanvas])

  // Mouse pan handling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let isDragging = false
    let lastX = 0
    let lastY = 0

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.style.cursor = 'grabbing'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      setViewState(prev => ({
        ...prev,
        panX: prev.panX + dx,
        panY: prev.panY + dy
      }))
    }

    const handleMouseUp = () => {
      isDragging = false
      canvas.style.cursor = 'grab'
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setViewState(prev => ({
        ...prev,
        zoom: Math.max(0.1, Math.min(10, prev.zoom * delta))
      }))
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.style.cursor = 'grab'

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const handleZoomIn = () => {
    setViewState(prev => ({ ...prev, zoom: Math.min(10, prev.zoom * 1.2) }))
  }

  const handleZoomOut = () => {
    setViewState(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom / 1.2) }))
  }

  const handleFit = () => {
    setViewState({ zoom: 1, panX: 0, panY: 0 })
  }

  const toggleLayer = (layerName: string) => {
    setLayers(prev => prev.map(l =>
      l.name === layerName ? { ...l, visible: !l.visible } : l
    ))
  }

  const handleDownloadPdf = async () => {
    try {
      setConverting(true)
      const response = await fetch(`/api/documents/${documentId}/convert-pdf`, {
        method: 'POST',
        credentials: 'include'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to convert to PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documentName.replace(/\.(dwg|dxf)$/i, '.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-medium truncate max-w-md">{documentName}</h2>
          <span className="text-gray-400 text-sm">
            Zoom: {Math.round(viewState.zoom * 100)}%
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Alejar"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Acercar"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={handleFit}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Ajustar a pantalla"
          >
            <Maximize size={20} />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          <button
            onClick={() => setShowLayers(!showLayers)}
            className={`p-2 rounded-lg transition-colors ${
              showLayers ? 'text-blue-400 bg-blue-900/50' : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
            title="Capas"
          >
            <Layers size={20} />
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={converting}
            className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Descargar PDF"
          >
            {converting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            <span className="text-sm">PDF</span>
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-red-600/80 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Layers panel */}
        {showLayers && layers.length > 0 && (
          <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <Layers size={16} />
                Capas ({layers.length})
              </h3>
              <div className="space-y-1">
                {layers.map(layer => (
                  <label
                    key={layer.name}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={() => toggleLayer(layer.name)}
                      className="rounded border-gray-500"
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                    <span className="text-gray-300 text-sm truncate">{layer.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Canvas container */}
        <div ref={containerRef} className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Loader2 size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-400">Cargando plano...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center max-w-md p-6">
                <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">Error al cargar el plano</h3>
                <p className="text-gray-400 mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            className={`w-full h-full ${loading || error ? 'hidden' : ''}`}
          />

          {/* Pan instructions */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 text-gray-500 text-sm bg-gray-900/80 px-3 py-2 rounded-lg">
              <Move size={14} />
              <span>Arrastra para mover | Scroll para zoom</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
