import { useEffect, useMemo, useState } from 'react'
import { Settings, Wrench, Activity, Droplets, Gauge, Box, CircuitBoard, Zap, CheckCircle, XCircle, Clock, Plus, History, ChevronDown, ChevronRight, Info, Calendar, RefreshCw, AlertTriangle } from 'lucide-react'

type Equipment = {
  id: string
  plant_id: string
  item_code: string
  description: string
  reference: string | null
  location: string | null
  quantity: number
  category: string
  daily_check: string | null
  monthly_check: string | null
  quarterly_check: string | null
  biannual_check: string | null
  annual_check: string | null
  time_based_reference: string | null
  spare_parts: string | null
  extras: string | null
}

type MaintenanceLog = {
  id: string
  equipment_id: string
  maintenance_type: 'preventivo' | 'correctivo'
  operation: string
  maintenance_date: string
  description_averia: string | null
  description_realizado: string | null
  next_maintenance_date: string | null
  operator_name: string | null
  responsible_name: string | null
}

type ScheduledMaintenance = {
  id: string
  equipment_id: string
  item_code: string
  equipment_description: string
  category: string
  frequency: 'mensual' | 'trimestral' | 'semestral' | 'anual'
  scheduled_date: string
  completed_date: string | null
  status: 'pending' | 'completed' | 'overdue'
  description: string | null
  notes: string | null
  completed_by: string | null
  year: number
}

const TEXTILES_ID = '88888888-8888-8888-8888-888888888881'

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  difusores: { icon: Droplets, label: 'Difusores', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  ductos: { icon: Box, label: 'Ductos', color: 'text-gray-600', bgColor: 'bg-gray-50' },
  cuadro_electrico: { icon: CircuitBoard, label: 'Cuadro Eléctrico', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  lamelas: { icon: Activity, label: 'Lamelas', color: 'text-purple-600', bgColor: 'bg-purple-50' },
  motores: { icon: Zap, label: 'Motores/Bombas', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  sensores: { icon: Gauge, label: 'Sensores', color: 'text-teal-600', bgColor: 'bg-teal-50' },
  tanques: { icon: Box, label: 'Tanques', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  valvulas: { icon: Settings, label: 'Valvulería', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  otros: { icon: Wrench, label: 'Otros', color: 'text-gray-600', bgColor: 'bg-gray-50' },
}

const FREQUENCY_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  mensual: { label: 'Mensual', color: 'text-green-700', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  trimestral: { label: 'Trimestral', color: 'text-yellow-700', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-300' },
  semestral: { label: 'Semestral', color: 'text-orange-700', bgColor: 'bg-orange-100', borderColor: 'border-orange-300' },
  anual: { label: 'Anual', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const OPERATIONS = [
  'Limpieza general',
  'Revisión nivel aceite blowers',
  'Limpieza de filtros, valvulas/ revisión correas',
  'Sistema electrico, ajustes y limpieza',
  'Fugas',
  'Cambio de aceite bombas',
  'Cambio aceite blowers',
  'Cambio de filtros',
  'Lubricacion (grasa)',
  'Ajustes mecánicos, revisión de pernos',
  'Alineación Correas y tensión en poleas',
  'Olores extraños',
  'Control de vibraciones y ruidos extraños',
  'Otros'
]

export default function TextilesMaintenancePlan() {
  const [activeTab, setActiveTab] = useState<'gantt' | 'equipment' | 'history'>('gantt')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledMaintenance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set())
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [logs, setLogs] = useState<MaintenanceLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [logForm, setLogForm] = useState({
    maintenanceType: 'preventivo' as 'preventivo' | 'correctivo',
    operation: '',
    maintenanceDate: new Date().toISOString().slice(0, 10),
    descriptionAveria: '',
    descriptionRealizado: '',
    nextMaintenanceDate: '',
    operatorName: '',
    responsibleName: ''
  })

  // Load equipment
  useEffect(() => {
    fetch(`/api/equipment/plant/${TEXTILES_ID}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'Error')
        setEquipment(json.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Load scheduled tasks for selected year
  useEffect(() => {
    loadScheduledTasks()
  }, [selectedYear])

  const loadScheduledTasks = async () => {
    try {
      const r = await fetch(`/api/equipment/scheduled/plant/${TEXTILES_ID}/${selectedYear}`, { credentials: 'include' })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setScheduledTasks(json.data || [])
    } catch (e: any) {
      console.error('Error loading scheduled tasks:', e.message)
    }
  }

  const generateYearPlan = async () => {
    setGenerating(true)
    try {
      const r = await fetch(`/api/equipment/scheduled/generate/${TEXTILES_ID}/${selectedYear}`, {
        method: 'POST',
        credentials: 'include'
      })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      await loadScheduledTasks()
      alert(`Se generaron ${json.generated} tareas de mantenimiento para ${selectedYear}`)
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const resetYearPlan = async () => {
    setResetting(true)
    try {
      const r = await fetch(`/api/equipment/scheduled/reset/${TEXTILES_ID}/${selectedYear}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      await loadScheduledTasks()
      setShowResetConfirm(false)
      alert(`Se eliminaron ${json.deleted} tareas de mantenimiento para ${selectedYear}`)
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    } finally {
      setResetting(false)
    }
  }

  const toggleTaskCompletion = async (task: ScheduledMaintenance) => {
    try {
      const endpoint = task.status === 'completed'
        ? `/api/equipment/scheduled/${task.id}/pending`
        : `/api/equipment/scheduled/${task.id}/complete`

      const r = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          completedDate: new Date().toISOString().slice(0, 10),
          completedBy: 'Usuario'
        })
      })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      await loadScheduledTasks()
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const categories = useMemo(() => {
    const cats = new Set<string>()
    equipment.forEach(e => e.category && cats.add(e.category))
    return Array.from(cats).sort()
  }, [equipment])

  const filteredEquipment = useMemo(() => {
    if (selectedCategory === 'all') return equipment
    return equipment.filter(e => e.category === selectedCategory)
  }, [equipment, selectedCategory])

  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Equipment[]> = {}
    filteredEquipment.forEach(e => {
      const cat = e.category || 'otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(e)
    })
    return groups
  }, [filteredEquipment])

  // Group scheduled tasks by equipment for Gantt view
  const ganttData = useMemo(() => {
    const grouped: Record<string, { equipment: Equipment; tasks: ScheduledMaintenance[] }> = {}

    // Get relevant equipment based on filter
    const relevantEquipmentIds = new Set(
      selectedCategory === 'all'
        ? equipment.map(e => e.id)
        : equipment.filter(e => e.category === selectedCategory).map(e => e.id)
    )

    scheduledTasks
      .filter(t => relevantEquipmentIds.has(t.equipment_id))
      .forEach(task => {
        if (!grouped[task.equipment_id]) {
          const eq = equipment.find(e => e.id === task.equipment_id)
          if (eq) {
            grouped[task.equipment_id] = { equipment: eq, tasks: [] }
          }
        }
        if (grouped[task.equipment_id]) {
          grouped[task.equipment_id].tasks.push(task)
        }
      })

    return Object.values(grouped).sort((a, b) =>
      a.equipment.item_code.localeCompare(b.equipment.item_code)
    )
  }, [scheduledTasks, equipment, selectedCategory])

  // Statistics
  const stats = useMemo(() => {
    const total = scheduledTasks.length
    const completed = scheduledTasks.filter(t => t.status === 'completed').length
    const pending = scheduledTasks.filter(t => t.status === 'pending').length
    const overdue = scheduledTasks.filter(t => t.status === 'overdue').length
    return { total, completed, pending, overdue, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }, [scheduledTasks])

  const loadLogs = async (equipmentId: string) => {
    setLogsLoading(true)
    try {
      const r = await fetch(`/api/equipment/${equipmentId}/logs`, { credentials: 'include' })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setLogs(json.data || [])
    } catch (e: any) {
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }

  const selectEquipment = (eq: Equipment) => {
    setSelectedEquipment(eq)
    loadLogs(eq.id)
    setShowLogForm(false)
  }

  const toggleExpanded = (id: string) => {
    setExpandedEquipment(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEquipment || !logForm.operation || !logForm.maintenanceDate) return

    try {
      const r = await fetch(`/api/equipment/${selectedEquipment.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          maintenanceType: logForm.maintenanceType,
          operation: logForm.operation,
          maintenanceDate: logForm.maintenanceDate,
          descriptionAveria: logForm.descriptionAveria || null,
          descriptionRealizado: logForm.descriptionRealizado || null,
          nextMaintenanceDate: logForm.nextMaintenanceDate || null,
          operatorName: logForm.operatorName || null,
          responsibleName: logForm.responsibleName || null,
        }),
      })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')

      await loadLogs(selectedEquipment.id)
      setShowLogForm(false)
      setLogForm({
        maintenanceType: 'preventivo',
        operation: '',
        maintenanceDate: new Date().toISOString().slice(0, 10),
        descriptionAveria: '',
        descriptionRealizado: '',
        nextMaintenanceDate: '',
        operatorName: '',
        responsibleName: ''
      })
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const renderCheckItem = (label: string, value: string | null, frequency: string) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-2 py-1.5 px-2 bg-white rounded border border-gray-100">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
          frequency === 'Diario' ? 'bg-blue-100 text-blue-700' :
          frequency === 'Mensual' ? 'bg-green-100 text-green-700' :
          frequency === 'Trimestral' ? 'bg-yellow-100 text-yellow-700' :
          frequency === 'Semestral' ? 'bg-orange-100 text-orange-700' :
          'bg-red-100 text-red-700'
        }`}>{frequency}</span>
        <span className="text-sm text-gray-700 flex-1">{value}</span>
      </div>
    )
  }

  const getTasksForMonth = (equipmentId: string, monthIndex: number) => {
    return scheduledTasks.filter(t => {
      if (t.equipment_id !== equipmentId) return false
      const taskMonth = new Date(t.scheduled_date).getMonth()
      return taskMonth === monthIndex
    })
  }

  const renderGanttCell = (tasks: ScheduledMaintenance[]) => {
    if (tasks.length === 0) return <div className="h-10" />

    return (
      <div className="flex flex-col gap-1 p-1">
        {tasks.map(task => {
          const freqConfig = FREQUENCY_CONFIG[task.frequency]
          const scheduledDay = new Date(task.scheduled_date).getDate()

          return (
            <div
              key={task.id}
              onClick={() => toggleTaskCompletion(task)}
              className={`
                flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-all hover:scale-105
                ${task.status === 'completed'
                  ? 'bg-green-500 text-white'
                  : task.status === 'overdue'
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-500 text-white'
                }
              `}
              title={`${freqConfig.label} - ${task.description || 'Mantenimiento'}\nFecha: ${new Date(task.scheduled_date).toLocaleDateString('es-ES')}\nEstado: ${task.status === 'completed' ? 'COMPLETADO' : task.status === 'overdue' ? 'ATRASADO' : 'PENDIENTE'}`}
            >
              {/* Checkbox visual */}
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                task.status === 'completed'
                  ? 'border-white bg-white/20'
                  : 'border-white/70'
              }`}>
                {task.status === 'completed' && <CheckCircle size={12} className="text-white" />}
              </div>

              {/* Fecha y frecuencia */}
              <span className="text-[10px] font-semibold whitespace-nowrap">
                {scheduledDay}/{freqConfig.label[0]}
              </span>

              {/* Indicador de estado */}
              {task.status === 'overdue' && (
                <AlertTriangle size={10} className="flex-shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center p-8"><Clock className="animate-spin mr-2" /> Cargando...</div>
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-[1600px] mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                <Wrench size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Plan de Mantenimiento - TEXTILES</h1>
                <p className="text-gray-500">PTAR Textiles - Rev. 00</p>
              </div>
            </div>

            {/* Year selector */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600">Año:</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border rounded-lg bg-white shadow-sm"
              >
                {[2023, 2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={generateYearPlan}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50"
              >
                <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generando...' : 'Generar Plan'}
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={resetting || scheduledTasks.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:from-red-600 hover:to-rose-700 transition-all shadow-md disabled:opacity-50"
              >
                <XCircle size={16} />
                Resetear Planificación
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs text-blue-600">Tareas Programadas</div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-green-600">Completadas</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-xl">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-xs text-yellow-600">Pendientes</div>
            </div>
            <div className="p-4 bg-red-50 rounded-xl">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-xs text-red-600">Atrasadas</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="text-2xl font-bold text-purple-600">{stats.completionRate}%</div>
              <div className="text-xs text-purple-600">Cumplimiento</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('gantt')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'gantt'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar size={18} />
            Gantt Anual
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings size={18} />
            Equipos
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <History size={18} />
            Historial
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Todos ({equipment.length})
          </button>
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.otros
            const Icon = config.icon
            const count = equipment.filter(e => e.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {config.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Gantt Chart Tab */}
        {activeTab === 'gantt' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Legend */}
            <div className="px-4 py-3 bg-gray-50 border-b flex flex-wrap gap-4 items-center">
              <span className="text-sm font-medium text-gray-600">Leyenda:</span>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500 text-white text-xs font-semibold">
                  <div className="w-3 h-3 rounded border-2 border-white/70"></div>
                  15/M
                </div>
                <span className="text-xs text-gray-600">Planificado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-500 text-white text-xs font-semibold">
                  <div className="w-3 h-3 rounded border-2 border-white bg-white/20 flex items-center justify-center">
                    <CheckCircle size={8} />
                  </div>
                  15/M
                </div>
                <span className="text-xs text-gray-600">Realizado</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500 text-white text-xs font-semibold animate-pulse">
                  <div className="w-3 h-3 rounded border-2 border-white/70"></div>
                  15/M
                  <AlertTriangle size={10} />
                </div>
                <span className="text-xs text-gray-600">Vencido</span>
              </div>
              <div className="border-l pl-4 ml-2 flex items-center gap-3">
                <span className="text-xs text-gray-500">Frecuencia:</span>
                {Object.entries(FREQUENCY_CONFIG).map(([key, config]) => (
                  <span key={key} className="text-xs text-gray-600">
                    <strong>{key[0].toUpperCase()}</strong>={config.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Gantt Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-10 min-w-[200px]">
                      Equipo
                    </th>
                    {MONTHS.map((month, idx) => (
                      <th key={month} className={`px-2 py-3 text-center text-sm font-semibold ${
                        new Date().getMonth() === idx && new Date().getFullYear() === selectedYear
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700'
                      }`}>
                        {month}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ganttData.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-gray-500">
                        <Calendar size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No hay tareas programadas para {selectedYear}</p>
                        <p className="text-sm mt-1">Haz clic en "Generar Plan" para crear el plan de mantenimiento</p>
                      </td>
                    </tr>
                  ) : (
                    ganttData.map(({ equipment: eq, tasks }) => {
                      const config = CATEGORY_CONFIG[eq.category] || CATEGORY_CONFIG.otros
                      return (
                        <tr key={eq.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2 sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                                {eq.item_code}
                              </span>
                              <span className="text-sm text-gray-700 truncate max-w-[120px]" title={eq.description}>
                                {eq.description}
                              </span>
                            </div>
                          </td>
                          {MONTHS.map((_, idx) => (
                            <td key={idx} className={`px-1 py-1 text-center border-l ${
                              new Date().getMonth() === idx && new Date().getFullYear() === selectedYear
                                ? 'bg-blue-50'
                                : ''
                            }`}>
                              {renderGanttCell(getTasksForMonth(eq.id, idx))}
                            </td>
                          ))}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Equipment List */}
            <div className="lg:col-span-2 space-y-4">
              {Object.entries(groupedEquipment).map(([cat, items]) => {
                const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.otros
                const Icon = config.icon
                return (
                  <div key={cat} className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <div className={`px-4 py-3 ${config.bgColor} border-b flex items-center gap-3`}>
                      <Icon className={config.color} size={20} />
                      <span className={`font-semibold ${config.color}`}>{config.label}</span>
                      <span className="text-sm text-gray-500">({items.length} equipos)</span>
                    </div>
                    <div className="divide-y">
                      {items.map(eq => {
                        const isExpanded = expandedEquipment.has(eq.id)
                        const isSelected = selectedEquipment?.id === eq.id
                        return (
                          <div key={eq.id} className={`${isSelected ? 'bg-blue-50' : ''}`}>
                            <div
                              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => selectEquipment(eq)}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpanded(eq.id) }}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{eq.item_code}</span>
                              <span className="flex-1 text-sm text-gray-800">{eq.description}</span>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">x{eq.quantity}</span>
                            </div>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 bg-gray-50 border-t space-y-2">
                                {eq.reference && (
                                  <div className="text-sm"><span className="font-medium text-gray-600">Referencia:</span> {eq.reference}</div>
                                )}
                                {eq.location && (
                                  <div className="text-sm"><span className="font-medium text-gray-600">Ubicación:</span> {eq.location}</div>
                                )}
                                <div className="text-sm font-medium text-gray-700 mt-3 mb-2">Revisiones Programadas:</div>
                                <div className="space-y-1.5">
                                  {renderCheckItem('Diario', eq.daily_check, 'Diario')}
                                  {renderCheckItem('Mensual', eq.monthly_check, 'Mensual')}
                                  {renderCheckItem('Trimestral', eq.quarterly_check, 'Trimestral')}
                                  {renderCheckItem('Semestral', eq.biannual_check, 'Semestral')}
                                  {renderCheckItem('Anual', eq.annual_check, 'Anual')}
                                </div>
                                {eq.time_based_reference && (
                                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                    <span className="font-medium text-amber-700">Por tiempo:</span> {eq.time_based_reference}
                                  </div>
                                )}
                                {eq.spare_parts && (
                                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                                    <span className="font-medium text-blue-700">Repuestos:</span> {eq.spare_parts}
                                  </div>
                                )}
                                {eq.extras && (
                                  <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                                    <span className="font-medium text-purple-700">Notas:</span> {eq.extras}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Detail Panel */}
            <div className="space-y-4">
              {selectedEquipment ? (
                <>
                  <div className="bg-white rounded-2xl shadow-md p-5 sticky top-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900">{selectedEquipment.item_code}</h2>
                      <button
                        onClick={() => setShowLogForm(!showLogForm)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Plus size={16} />
                        Registrar
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{selectedEquipment.description}</p>

                    {showLogForm && (
                      <form onSubmit={handleSubmitLog} className="space-y-3 p-4 bg-gray-50 rounded-lg mb-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                            <select
                              value={logForm.maintenanceType}
                              onChange={e => setLogForm({ ...logForm, maintenanceType: e.target.value as any })}
                              className="w-full px-3 py-2 rounded border text-sm"
                            >
                              <option value="preventivo">Preventivo</option>
                              <option value="correctivo">Correctivo</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                            <input
                              type="date"
                              value={logForm.maintenanceDate}
                              onChange={e => setLogForm({ ...logForm, maintenanceDate: e.target.value })}
                              className="w-full px-3 py-2 rounded border text-sm"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Operación</label>
                          <select
                            value={logForm.operation}
                            onChange={e => setLogForm({ ...logForm, operation: e.target.value })}
                            className="w-full px-3 py-2 rounded border text-sm"
                            required
                          >
                            <option value="">Seleccionar...</option>
                            {OPERATIONS.map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                        </div>
                        {logForm.maintenanceType === 'correctivo' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción de Avería</label>
                            <textarea
                              value={logForm.descriptionAveria}
                              onChange={e => setLogForm({ ...logForm, descriptionAveria: e.target.value })}
                              className="w-full px-3 py-2 rounded border text-sm h-16"
                              placeholder="Describa la avería encontrada..."
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción del Trabajo</label>
                          <textarea
                            value={logForm.descriptionRealizado}
                            onChange={e => setLogForm({ ...logForm, descriptionRealizado: e.target.value })}
                            className="w-full px-3 py-2 rounded border text-sm h-16"
                            placeholder="Describa el trabajo realizado..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Operador</label>
                            <input
                              type="text"
                              value={logForm.operatorName}
                              onChange={e => setLogForm({ ...logForm, operatorName: e.target.value })}
                              className="w-full px-3 py-2 rounded border text-sm"
                              placeholder="Nombre"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
                            <input
                              type="text"
                              value={logForm.responsibleName}
                              onChange={e => setLogForm({ ...logForm, responsibleName: e.target.value })}
                              className="w-full px-3 py-2 rounded border text-sm"
                              placeholder="Nombre"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowLogForm(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Equipment Scheduled Tasks */}
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Calendar size={16} />
                        Tareas {selectedYear}
                      </h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {scheduledTasks
                          .filter(t => t.equipment_id === selectedEquipment.id)
                          .map(task => (
                            <div
                              key={task.id}
                              className={`p-2 rounded-lg border flex items-center justify-between ${
                                task.status === 'completed'
                                  ? 'bg-green-50 border-green-200'
                                  : task.status === 'overdue'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${FREQUENCY_CONFIG[task.frequency].bgColor} ${FREQUENCY_CONFIG[task.frequency].color}`}>
                                  {FREQUENCY_CONFIG[task.frequency].label}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {new Date(task.scheduled_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleTaskCompletion(task)}
                                className={`p-1 rounded ${
                                  task.status === 'completed'
                                    ? 'text-green-600 hover:bg-green-100'
                                    : task.status === 'overdue'
                                      ? 'text-red-600 hover:bg-red-100'
                                      : 'text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {task.status === 'completed' ? (
                                  <CheckCircle size={20} />
                                ) : task.status === 'overdue' ? (
                                  <AlertTriangle size={20} />
                                ) : (
                                  <Clock size={20} />
                                )}
                              </button>
                            </div>
                          ))}
                        {scheduledTasks.filter(t => t.equipment_id === selectedEquipment.id).length === 0 && (
                          <div className="text-center py-4 text-gray-400 text-sm">
                            Sin tareas programadas
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Maintenance History */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <History size={16} />
                        Historial
                      </h3>
                      {logsLoading ? (
                        <div className="text-center py-4 text-gray-500">Cargando...</div>
                      ) : logs.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg">
                          <Info size={24} className="mx-auto mb-2" />
                          <p className="text-sm">Sin registros</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {logs.slice(0, 5).map(log => (
                            <div key={log.id} className="p-2 bg-gray-50 rounded-lg border text-xs">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded font-medium ${
                                  log.maintenance_type === 'preventivo'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {log.maintenance_type === 'preventivo' ? 'Prev' : 'Corr'}
                                </span>
                                <span className="text-gray-500">
                                  {new Date(log.maintenance_date).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                              <div className="text-gray-800">{log.operation}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl shadow-md p-8 text-center">
                  <Info size={48} className="mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Seleccione un Equipo</h3>
                  <p className="text-sm text-gray-400">
                    Haga clic en un equipo para ver detalles
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History size={20} />
              Historial de Mantenimientos Realizados
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Equipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Frecuencia</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Descripción</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledTasks
                    .filter(t => t.status === 'completed')
                    .sort((a, b) => new Date(b.completed_date || '').getTime() - new Date(a.completed_date || '').getTime())
                    .slice(0, 50)
                    .map(task => {
                      const config = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.otros
                      return (
                        <tr key={task.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {task.completed_date
                              ? new Date(task.completed_date).toLocaleDateString('es-ES')
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                                {task.item_code}
                              </span>
                              <span className="text-sm text-gray-700">{task.equipment_description}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${FREQUENCY_CONFIG[task.frequency].bgColor} ${FREQUENCY_CONFIG[task.frequency].color}`}>
                              {FREQUENCY_CONFIG[task.frequency].label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {task.description || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle size={16} />
                              Completado
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  {scheduledTasks.filter(t => t.status === 'completed').length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        <History size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No hay mantenimientos completados</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Resetear Planificación</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Está seguro de que desea eliminar todas las tareas programadas para el año <strong>{selectedYear}</strong>?
              Se eliminarán <strong>{scheduledTasks.length}</strong> tareas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={resetYearPlan}
                disabled={resetting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resetting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Confirmar Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
