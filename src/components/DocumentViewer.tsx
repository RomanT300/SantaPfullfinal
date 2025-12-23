import { X, Download } from 'lucide-react'

type DocumentViewerProps = {
  document: {
    id: string
    file_name: string
    file_path: string
  }
  onClose: () => void
}

// Determinar el tipo de archivo por extensión
const getFileType = (fileName: string): 'pdf' | 'image' | 'office' | 'other' => {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (['doc', 'docx', 'xls', 'xlsx', 'xlsb', 'ppt', 'pptx'].includes(ext)) return 'office'
  return 'other'
}

// Obtener extensión para mostrar
const getExtension = (fileName: string): string => {
  return (fileName.toLowerCase().split('.').pop() || '').toUpperCase()
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const fileType = getFileType(document.file_name)
  const extension = getExtension(document.file_name)
  const previewUrl = `/api/documents/preview/${document.id}`
  const downloadUrl = `/api/documents/download/${document.id}`

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
              {extension}
            </span>
            <h3 className="font-medium truncate">{document.file_name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              Descargar
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 min-h-[400px]">
          {fileType === 'pdf' && (
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-[600px]"
              title={document.file_name}
            />
          )}

          {fileType === 'image' && (
            <div className="flex items-center justify-center p-4 h-full">
              <img
                src={previewUrl}
                alt={document.file_name}
                className="max-w-full max-h-[70vh] object-contain rounded shadow-lg"
              />
            </div>
          )}

          {fileType === 'office' && (
            <div className="flex flex-col items-center justify-center p-8 h-full text-center">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md">
                <div className="text-6xl mb-4">
                  {extension.includes('XLS') ? '📊' : extension.includes('DOC') ? '📄' : '📑'}
                </div>
                <h4 className="text-lg font-medium mb-2">{document.file_name}</h4>
                <p className="text-gray-500 mb-4">
                  Los archivos de Office ({extension}) requieren descargarse para visualizarse.
                </p>
                <a
                  href={downloadUrl}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-lg"
                >
                  <Download size={20} />
                  Descargar y abrir
                </a>
                <p className="text-xs text-gray-400 mt-4">
                  El archivo se abrirá con Excel, Word o LibreOffice según tu sistema.
                </p>
              </div>
            </div>
          )}

          {fileType === 'other' && (
            <div className="flex flex-col items-center justify-center p-8 h-full text-center">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md">
                <div className="text-6xl mb-4">
                  {extension === 'DWG' ? '📐' : extension === 'ZIP' ? '📦' : '📁'}
                </div>
                <h4 className="text-lg font-medium mb-2">{document.file_name}</h4>
                <p className="text-gray-500 mb-6">
                  {extension === 'DWG'
                    ? 'Los archivos CAD (.dwg) requieren software especializado como AutoCAD.'
                    : extension === 'ZIP'
                    ? 'Los archivos comprimidos deben descargarse y extraerse localmente.'
                    : 'Este tipo de archivo no se puede previsualizar en el navegador.'}
                </p>
                <a
                  href={downloadUrl}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Descargar archivo
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
