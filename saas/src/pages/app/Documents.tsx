import { useEffect, useState } from 'react'
import { FileText, Download, Folder, FolderOpen, ChevronRight, ChevronDown, Eye, FileBox } from 'lucide-react'
import DocumentViewer from '../../components/DocumentViewer'
import CADViewer from '../../components/CADViewer'

type Doc = {
  id: string
  file_name: string
  file_path: string
  category: string
  uploaded_at: string
  plant_id: string
  isCADFile?: boolean
  cadFormat?: 'dwg' | 'dxf' | null
}

// Check if file is a CAD file
const isCADFile = (filename: string): boolean => {
  const ext = filename.toLowerCase()
  return ext.endsWith('.dwg') || ext.endsWith('.dxf')
}

type Plant = {
  id: string
  name: string
}

// Subcarpetas predefinidas para cada planta
const DOCUMENT_CATEGORIES = [
  { id: 'planos', name: 'Planos', color: 'text-blue-500' },
  { id: 'manuales', name: 'Manuales', color: 'text-green-500' },
  { id: 'analiticas', name: 'Analíticas', color: 'text-purple-500' },
  { id: 'informes_mantenimiento', name: 'Informes de mantenimiento', color: 'text-orange-500' },
]

type SubFolder = {
  category: typeof DOCUMENT_CATEGORIES[number]
  documents: Doc[]
  isOpen: boolean
}

type PlantFolder = {
  plant: Plant
  subFolders: SubFolder[]
  isOpen: boolean
}

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [folders, setFolders] = useState<PlantFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<Doc | null>(null)
  const [cadViewerDoc, setCadViewerDoc] = useState<Doc | null>(null)

  useEffect(() => {
    // Cargar plantas y documentos en paralelo
    Promise.all([
      fetch('/api/plants', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/documents', { credentials: 'include' }).then(r => r.json())
    ])
      .then(([plantsJson, docsJson]) => {
        if (!plantsJson.success) throw new Error(plantsJson.error || 'Error cargando plantas')
        if (!docsJson.success) throw new Error(docsJson.error || 'Error cargando documentos')

        const plantsData = plantsJson.data || []
        const docsData = docsJson.data || []

        setPlants(plantsData)
        setDocs(docsData)

        // Organizar documentos por planta y subcarpeta
        const plantFolders: PlantFolder[] = plantsData.map((plant: Plant) => {
          const plantDocs = docsData.filter((doc: Doc) => doc.plant_id === plant.id)

          // Crear subcarpetas para cada categoría
          const subFolders: SubFolder[] = DOCUMENT_CATEGORIES.map(category => ({
            category,
            documents: plantDocs.filter((doc: Doc) =>
              doc.category?.toLowerCase() === category.id.toLowerCase() ||
              doc.category?.toLowerCase() === category.name.toLowerCase()
            ),
            isOpen: false
          }))

          return {
            plant,
            subFolders,
            isOpen: false
          }
        })

        setFolders(plantFolders)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const toggleFolder = (plantId: string) => {
    setFolders(folders.map(f =>
      f.plant.id === plantId ? { ...f, isOpen: !f.isOpen } : f
    ))
  }

  const toggleSubFolder = (plantId: string, categoryId: string) => {
    setFolders(folders.map(f =>
      f.plant.id === plantId
        ? {
            ...f,
            subFolders: f.subFolders.map(sf =>
              sf.category.id === categoryId ? { ...sf, isOpen: !sf.isOpen } : sf
            )
          }
        : f
    ))
  }

  const totalDocs = docs.length
  const getTotalDocsInPlant = (folder: PlantFolder) =>
    folder.subFolders.reduce((sum, sf) => sum + sf.documents.length, 0)

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Repositorio Documental</h1>
          <p className="text-sm text-gray-500 mt-1">{totalDocs} documentos en {plants.length} plantas</p>
        </div>
      </div>

      {loading && <div className="text-center py-8">Cargando documentos...</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>}

      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm">
        {folders.map(folder => (
          <div key={folder.plant.id} className="border-b last:border-b-0">
            {/* Carpeta de planta */}
            <div
              onClick={() => toggleFolder(folder.plant.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition"
            >
              <div className="text-gray-500">
                {folder.isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </div>
              <div className="text-yellow-500">
                {folder.isOpen ? <FolderOpen size={24} /> : <Folder size={24} />}
              </div>
              <div className="flex-1">
                <div className="font-medium">{folder.plant.name}</div>
                <div className="text-xs text-gray-500">
                  {getTotalDocsInPlant(folder)} {getTotalDocsInPlant(folder) === 1 ? 'documento' : 'documentos'} en {DOCUMENT_CATEGORIES.length} carpetas
                </div>
              </div>
            </div>

            {/* Subcarpetas dentro de la planta */}
            {folder.isOpen && (
              <div className="bg-gray-50 dark:bg-gray-900">
                {folder.subFolders.map(subFolder => (
                  <div key={subFolder.category.id}>
                    {/* Subcarpeta */}
                    <div
                      onClick={() => toggleSubFolder(folder.plant.id, subFolder.category.id)}
                      className="flex items-center gap-3 px-4 py-2 ml-8 border-t border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 cursor-pointer transition"
                    >
                      <div className="text-gray-400">
                        {subFolder.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                      <div className={subFolder.category.color}>
                        {subFolder.isOpen ? <FolderOpen size={20} /> : <Folder size={20} />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{subFolder.category.name}</div>
                        <div className="text-xs text-gray-500">
                          {subFolder.documents.length} {subFolder.documents.length === 1 ? 'documento' : 'documentos'}
                        </div>
                      </div>
                    </div>

                    {/* Documentos dentro de la subcarpeta */}
                    {subFolder.isOpen && (
                      <div className="bg-white dark:bg-gray-800">
                        {subFolder.documents.length === 0 ? (
                          <div className="px-4 py-4 ml-16 text-center text-gray-400 text-sm italic">
                            Sin documentos
                          </div>
                        ) : (
                          subFolder.documents.map(doc => (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 px-4 py-3 ml-16 border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                              <div className={`p-2 rounded ${isCADFile(doc.file_name) ? 'bg-purple-50 dark:bg-purple-900/50 text-purple-600' : 'bg-blue-50 dark:bg-blue-900/50 text-blue-600'}`}>
                                {isCADFile(doc.file_name) ? <FileBox size={18} /> : <FileText size={18} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">
                                  {doc.file_name}
                                  {isCADFile(doc.file_name) && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded">
                                      CAD
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(doc.uploaded_at).toLocaleDateString()}
                                </div>
                              </div>
                              {isCADFile(doc.file_name) ? (
                                <button
                                  onClick={() => setCadViewerDoc(doc)}
                                  className="px-3 py-2 rounded bg-purple-600 text-white text-sm flex items-center gap-2 hover:bg-purple-700 transition"
                                >
                                  <Eye size={14} />
                                  Ver Plano
                                </button>
                              ) : (
                                <button
                                  onClick={() => setViewingDoc(doc)}
                                  className="px-3 py-2 rounded bg-blue-600 text-white text-sm flex items-center gap-2 hover:bg-blue-700 transition"
                                >
                                  <Eye size={14} />
                                  Ver
                                </button>
                              )}
                              <a
                                href={`/api/documents/${doc.id}/download`}
                                className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                              >
                                <Download size={14} />
                                Descargar
                              </a>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {folders.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No hay documentos disponibles
        </div>
      )}

      {/* Modal del visor de documentos */}
      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Modal del visor CAD */}
      {cadViewerDoc && (
        <CADViewer
          documentId={cadViewerDoc.id}
          documentName={cadViewerDoc.file_name}
          onClose={() => setCadViewerDoc(null)}
        />
      )}
    </div>
  )
}