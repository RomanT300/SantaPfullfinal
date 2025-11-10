import { useEffect, useState } from 'react'
import { FileText, Download, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'

type Doc = {
  id: string
  file_name: string
  file_path: string
  category: string
  uploaded_at: string
  plant_id: string
}

type Plant = {
  id: string
  name: string
}

type PlantFolder = {
  plant: Plant
  documents: Doc[]
  isOpen: boolean
}

export default function Documents() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [folders, setFolders] = useState<PlantFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Organizar documentos por planta
        const plantFolders: PlantFolder[] = plantsData.map((plant: Plant) => ({
          plant,
          documents: docsData.filter((doc: Doc) => doc.plant_id === plant.id),
          isOpen: false
        }))

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

  const totalDocs = docs.length

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
                  {folder.documents.length} {folder.documents.length === 1 ? 'documento' : 'documentos'}
                </div>
              </div>
            </div>

            {/* Documentos dentro de la carpeta */}
            {folder.isOpen && (
              <div className="bg-gray-50 dark:bg-gray-900">
                {folder.documents.length === 0 ? (
                  <div className="px-4 py-6 text-center text-gray-500 text-sm">
                    No hay documentos en esta planta
                  </div>
                ) : (
                  folder.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 px-4 py-3 ml-8 border-t border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition"
                    >
                      <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/50 text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{doc.file_name}</div>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          <span>Categoría: {doc.category}</span>
                          <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <a
                        href={`/api/documents/download/${doc.id}`}
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

      {folders.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          No hay documentos disponibles
        </div>
      )}
    </div>
  )
}