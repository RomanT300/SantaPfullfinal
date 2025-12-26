import { useState, useEffect } from 'react'
import {
  Search, Calendar, User, Building2, Clock, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, RefreshCw, FileText, Flag, X, Eye
} from 'lucide-react'

type Checklist = {
  id: string
  plant_id: string
  plant_name: string
  template_id: string
  template_name: string
  template_code: string
  checklist_date: string
  operator_name: string
  supervisor_name: string | null
  shift: string
  status: string
  has_red_flags: number
  completed_items: number
  total_items: number
  notes: string | null
  created_at: string
}

type ChecklistItem = {
  id: string
  checklist_id: string
  template_item_id: string
  section: string
  element: string
  activity: string
  is_checked: number
  value: number | null
  value_unit: string | null
  requires_value: number
  notes: string | null
  photo_url: string | null
  is_red_flag: number
}

type RedFlag = {
  id: string
  checklist_id: string
  template_item_id: string
  element: string
  activity: string
  reason: string
  flagged_at: string
  resolved_at: string | null
}

type Plant = {
  id: string
  name: string
}

type DateWithCount = {
  date: string
  count: number
}

export default function ChecklistHistory() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [availableDates, setAvailableDates] = useState<DateWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDates, setLoadingDates] = useState(false)

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedPlant, setSelectedPlant] = useState<string>('')
  const [operatorSearch, setOperatorSearch] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Selected checklist detail
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null)
  const [checklistDetail, setChecklistDetail] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    loadPlants()
    loadAvailableDates()
    // Load today's checklists by default
    const today = new Date().toISOString().slice(0, 10)
    setSelectedDate(today)
  }, [])

  useEffect(() => {
    if (selectedDate || selectedPlant || operatorSearch || (dateFrom && dateTo)) {
      searchChecklists()
    }
  }, [selectedDate, selectedPlant])

  const loadPlants = async () => {
    try {
      const res = await fetch('/api/plants', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setPlants(json.data)
      }
    } catch (e) {
      console.error('Error loading plants:', e)
    }
  }

  const loadAvailableDates = async () => {
    setLoadingDates(true)
    try {
      const res = await fetch('/api/checklist/history/dates', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setAvailableDates(json.data)
      }
    } catch (e) {
      console.error('Error loading dates:', e)
    } finally {
      setLoadingDates(false)
    }
  }

  const searchChecklists = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedDate) params.append('date', selectedDate)
      if (selectedPlant) params.append('plantId', selectedPlant)
      if (operatorSearch) params.append('operatorName', operatorSearch)
      if (dateFrom) params.append('from', dateFrom)
      if (dateTo) params.append('to', dateTo)

      const res = await fetch(`/api/checklist/history/search?${params}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setChecklists(json.data)
      }
    } catch (e) {
      console.error('Error searching checklists:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadChecklistDetail = async (checklist: Checklist) => {
    setSelectedChecklist(checklist)
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/checklist/history/${checklist.id}`, { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setChecklistDetail(json.data)
      }
    } catch (e) {
      console.error('Error loading checklist detail:', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSearch = () => {
    if (operatorSearch || (dateFrom && dateTo)) {
      setSelectedDate('')
      searchChecklists()
    }
  }

  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setDateFrom('')
    setDateTo('')
    setOperatorSearch('')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <FileText size={32} />
            <div>
              <h1 className="text-2xl font-bold">Historial de Checklists</h1>
              <p className="text-emerald-200 text-sm">Busca y revisa los checklists completados por los operadores</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Filters and Calendar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search by Operator */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Search size={18} />
                Buscar
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operador</label>
                  <input
                    type="text"
                    value={operatorSearch}
                    onChange={e => setOperatorSearch(e.target.value)}
                    placeholder="Nombre del operador..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Planta</label>
                  <select
                    value={selectedPlant}
                    onChange={e => setSelectedPlant(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">Todas las plantas</option>
                    {plants.map(plant => (
                      <option key={plant.id} value={plant.id}>{plant.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSearch}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
                >
                  <Search size={16} />
                  Buscar
                </button>
              </div>
            </div>

            {/* Available Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar size={18} />
                Fechas con Registros
              </h3>
              {loadingDates ? (
                <div className="text-center py-4">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {availableDates.slice(0, 30).map(({ date, count }) => (
                    <button
                      key={date}
                      onClick={() => handleDateClick(date)}
                      className={`w-full px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors ${
                        selectedDate === date
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span>
                        {new Date(date + 'T12:00:00').toLocaleDateString('es-EC', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-xs">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Results */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Checklists {selectedDate && `del ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', { dateStyle: 'full' })}`}
                  {' '}({checklists.length})
                </h2>
                <button
                  onClick={searchChecklists}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500">Buscando checklists...</p>
                </div>
              ) : checklists.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">No se encontraron checklists</p>
                  <p className="text-sm text-gray-400 mt-1">Selecciona una fecha o usa los filtros de busqueda</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {checklists.map(checklist => (
                    <div
                      key={checklist.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                      onClick={() => loadChecklistDetail(checklist)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          checklist.has_red_flags ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {checklist.has_red_flags ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {checklist.template_name || 'Checklist'}
                            </span>
                            {checklist.template_code && (
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                {checklist.template_code}
                              </span>
                            )}
                            {checklist.has_red_flags === 1 && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full flex items-center gap-1">
                                <Flag size={10} /> Alertas
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Building2 size={14} />
                              {checklist.plant_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={14} />
                              {checklist.operator_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {checklist.shift}
                            </span>
                            <span className="text-emerald-600">
                              {checklist.completed_items}/{checklist.total_items} items
                            </span>
                          </div>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-emerald-600">
                          <Eye size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Detail Modal */}
      {selectedChecklist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedChecklist.template_name}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedChecklist.checklist_date).toLocaleDateString('es-EC', { dateStyle: 'full' })}
                    {' - '}{selectedChecklist.plant_name}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedChecklist(null); setChecklistDetail(null) }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetail ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-500">Cargando detalles...</p>
                </div>
              ) : checklistDetail ? (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-500">Operador</div>
                      <div className="font-medium">{checklistDetail.operator_name}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-500">Turno</div>
                      <div className="font-medium">{checklistDetail.shift}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-500">Completado</div>
                      <div className="font-medium text-emerald-600">
                        {checklistDetail.completed_items}/{checklistDetail.total_items}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="text-sm text-gray-500">Estado</div>
                      <div className={`font-medium ${
                        checklistDetail.has_red_flags ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {checklistDetail.has_red_flags ? 'Con Alertas' : 'Normal'}
                      </div>
                    </div>
                  </div>

                  {/* Red Flags */}
                  {checklistDetail.redFlags && checklistDetail.redFlags.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        Alertas Reportadas ({checklistDetail.redFlags.length})
                      </h4>
                      <div className="space-y-2">
                        {checklistDetail.redFlags.map((flag: RedFlag) => (
                          <div key={flag.id} className="bg-white dark:bg-gray-800 rounded p-3 text-sm">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {flag.element} - {flag.activity}
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">{flag.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items by Section */}
                  {checklistDetail.itemsBySection && Object.keys(checklistDetail.itemsBySection).map(section => (
                    <div key={section} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 font-medium text-gray-700 dark:text-gray-300">
                        {section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {checklistDetail.itemsBySection[section].map((item: ChecklistItem) => (
                          <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              item.is_red_flag
                                ? 'bg-red-500 text-white'
                                : item.is_checked
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600'
                            }`}>
                              {item.is_red_flag ? (
                                <AlertTriangle size={12} />
                              ) : item.is_checked ? (
                                <CheckCircle size={12} />
                              ) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.element}
                              </div>
                              <div className="text-sm text-gray-500">{item.activity}</div>
                              {item.value !== null && (
                                <div className="text-sm text-emerald-600 mt-1">
                                  Valor: {item.value} {item.value_unit || ''}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-sm text-gray-400 mt-1 italic">
                                  Nota: {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* General Notes */}
                  {checklistDetail.notes && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                        Notas Generales
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {checklistDetail.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No se pudo cargar el detalle
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
