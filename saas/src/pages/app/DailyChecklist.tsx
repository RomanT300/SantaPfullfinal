/**
 * Daily Checklist Page - Mobile-first design for field operators
 * Allows completing daily inspections at each plant
 */
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Camera,
  MessageSquare,
  ClipboardCheck,
  ArrowLeft,
  Send,
  Factory,
  Loader2,
} from 'lucide-react'
import { usePlants } from '../../hooks/useApi'
import { useDailyChecklist, useUpdateChecklistItem, useCompleteChecklist } from '../../hooks/useApi'
import toast from 'react-hot-toast'

// Category labels and icons
const categoryLabels: Record<string, string> = {
  general: 'General',
  difusores: 'Difusores',
  ductos: 'Ductos',
  cuadro_electrico: 'Cuadro Eléctrico',
  lamelas: 'Lamelas',
  motores: 'Motores/Bombas',
  sensores: 'Sensores',
  tanques: 'Tanques',
  valvulas: 'Válvulas',
  otros: 'Otros',
}

export default function DailyChecklist() {
  const { plantId } = useParams<{ plantId: string }>()
  const navigate = useNavigate()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']))
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  // Fetch data
  const { data: plants } = usePlants()
  const { data: checklistData, isLoading, refetch } = useDailyChecklist(plantId || '')
  const updateItem = useUpdateChecklistItem()
  const completeChecklist = useCompleteChecklist()

  const plant = plants?.find(p => p.id === plantId)

  // Toggle category expansion
  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat)
    } else {
      newExpanded.add(cat)
    }
    setExpandedCategories(newExpanded)
  }

  // Handle item check
  const handleCheck = async (itemId: string, currentChecked: boolean) => {
    try {
      await updateItem.mutateAsync({
        itemId,
        is_checked: !currentChecked,
      })
      refetch()
    } catch (error) {
      // Error handled by mutation
    }
  }

  // Handle observation update
  const handleObservation = async (itemId: string, observation: string) => {
    try {
      await updateItem.mutateAsync({
        itemId,
        observation,
      })
      toast.success('Observación guardada')
    } catch (error) {
      // Error handled by mutation
    }
  }

  // Handle complete checklist
  const handleComplete = async () => {
    if (!checklistData?.checklist.id) return

    try {
      await completeChecklist.mutateAsync({
        checklistId: checklistData.checklist.id,
        notes,
      })
      refetch()
    } catch (error) {
      // Error handled by mutation
    }
  }

  if (!plantId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <PlantSelector />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-gray-500">Cargando checklist...</p>
        </div>
      </div>
    )
  }

  if (!checklistData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <ClipboardCheck size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-300">No se pudo cargar el checklist</p>
          <button
            onClick={() => navigate('/checklist')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Seleccionar otra planta
          </button>
        </div>
      </div>
    )
  }

  const isCompleted = checklistData.checklist.completed_at !== null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate('/checklist')}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="text-center flex-1">
            <h1 className="font-bold text-gray-900 dark:text-white">{plant?.name || 'Planta'}</h1>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-300">
              {checklistData.checked} de {checklistData.total}
            </span>
            <span className={`font-bold ${
              isCompleted
                ? 'text-emerald-600 dark:text-emerald-400'
                : checklistData.progress >= 50
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-600 dark:text-gray-300'
            }`}>
              {checklistData.progress}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : checklistData.progress >= 50
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${checklistData.progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Completed banner */}
      {isCompleted && (
        <div className="mx-4 mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Checklist Completado</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Completado el {new Date(checklistData.checklist.completed_at!).toLocaleString('es-EC')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checklist items by category */}
      <div className="p-4 space-y-3">
        {Object.entries(checklistData.items).map(([category, items]) => (
          <div key={category} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {categoryLabels[category] || category}
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                  {(items as any[]).filter(i => i.is_checked).length}/{(items as any[]).length}
                </span>
              </div>
              {expandedCategories.has(category) ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {/* Items */}
            {expandedCategories.has(category) && (
              <div className="border-t border-gray-100 dark:border-gray-700">
                {(items as any[]).map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    disabled={isCompleted}
                    onCheck={() => handleCheck(item.id, item.is_checked)}
                    onObservation={(obs) => handleObservation(item.id, obs)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Notes section */}
      {!isCompleted && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={20} className="text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">Notas generales</span>
            </div>
            {showNotes ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
          </button>
          {showNotes && (
            <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas o comentarios sobre la inspección del día..."
                className="w-full h-24 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}

      {/* Fixed bottom action */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <button
            onClick={handleComplete}
            disabled={checklistData.progress < 100 || completeChecklist.isPending}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-white transition-all ${
              checklistData.progress >= 100
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {completeChecklist.isPending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <Send size={20} />
                {checklistData.progress >= 100 ? 'Finalizar Inspección' : `Faltan ${checklistData.total - checklistData.checked} items`}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// Single checklist item row
function ChecklistItemRow({
  item,
  disabled,
  onCheck,
  onObservation,
}: {
  item: any
  disabled: boolean
  onCheck: () => void
  onObservation: (obs: string) => void
}) {
  const [showObservation, setShowObservation] = useState(false)
  const [observation, setObservation] = useState(item.observation || '')

  return (
    <div className="border-b border-gray-50 dark:border-gray-700 last:border-0">
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={onCheck}
          disabled={disabled}
          className={`flex-shrink-0 mt-0.5 transition-colors ${
            disabled ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {item.is_checked ? (
            <CheckCircle2 size={24} className="text-emerald-500" />
          ) : (
            <Circle size={24} className="text-gray-300 dark:text-gray-600" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${
            item.is_checked
              ? 'text-gray-500 dark:text-gray-400 line-through'
              : 'text-gray-900 dark:text-white'
          }`}>
            {item.item_description}
          </p>
          {item.equipment_description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {item.item_code}: {item.equipment_description}
            </p>
          )}
          {item.observation && !showObservation && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              📝 {item.observation}
            </p>
          )}
        </div>
        {!disabled && (
          <button
            onClick={() => setShowObservation(!showObservation)}
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <MessageSquare size={18} />
          </button>
        )}
      </div>
      {showObservation && (
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Agregar observación..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => {
                onObservation(observation)
                setShowObservation(false)
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckCircle2 size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Plant selector component (shown when no plant is selected)
function PlantSelector() {
  const navigate = useNavigate()
  const { data: plants, isLoading } = usePlants()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
            <ClipboardCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Checklist Diario</h1>
            <p className="text-sm text-gray-500">Selecciona una planta para iniciar</p>
          </div>
        </div>
      </header>

      <div className="grid gap-3">
        {plants?.map((plant) => (
          <button
            key={plant.id}
            onClick={() => navigate(`/checklist/${plant.id}`)}
            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left"
          >
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Factory size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">{plant.name}</p>
              <p className="text-sm text-gray-500">{plant.location}</p>
            </div>
            <ChevronDown size={20} className="text-gray-400 rotate-[-90deg]" />
          </button>
        ))}
      </div>
    </div>
  )
}
