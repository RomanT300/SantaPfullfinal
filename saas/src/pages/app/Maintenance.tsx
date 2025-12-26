import { useEffect, useMemo, useState, useCallback } from 'react'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

// Custom styles to make Gantt bars clickable and draggable
const ganttStyles = `
  .gantt-task-react .bar-wrapper {
    cursor: grab !important;
  }
  .gantt-task-react .bar-wrapper:active {
    cursor: grabbing !important;
  }
  .gantt-task-react .bar-wrapper:hover {
    filter: brightness(1.1);
  }
  .gantt-task-react .bar {
    cursor: grab !important;
  }
  .gantt-task-react .bar:active {
    cursor: grabbing !important;
  }
  .gantt-task-react .bar:hover {
    filter: brightness(1.1);
  }
  .gantt-task-react .handleGroup {
    cursor: ew-resize !important;
  }
`

type Maint = {
  id: string
  plant_id: string
  plant_name?: string
  task_type: 'preventive' | 'corrective' | 'general'
  description: string
  scheduled_date: string
  completed_date?: string
  completed_by?: string
  status: 'pending' | 'completed' | 'overdue'
  periodicity?: 'daily' | 'monthly' | 'quarterly' | 'annual'
  vendor_name?: string
  estimated_cost?: number
  notes?: string
  isPlaceholder?: boolean
}

type Plant = { id: string; name: string }

// Excluded plant IDs (if needed for specific organizations)
const EXCLUDED_PLANT_IDS: string[] = []

const PERIODICITY_LABELS: Record<string, string> = {
  daily: 'Diario',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  annual: 'Anual'
}

const PERIODICITY_COLORS: Record<string, string> = {
  daily: 'bg-purple-100 text-purple-800',
  monthly: 'bg-blue-100 text-blue-800',
  quarterly: 'bg-amber-100 text-amber-800',
  annual: 'bg-emerald-100 text-emerald-800'
}

export default function Maintenance() {
  const [tasks, setTasks] = useState<Maint[]>([])
  const [historyTasks, setHistoryTasks] = useState<Maint[]>([])
  const [loading, setLoading] = useState(true)
  const [plants, setPlants] = useState<Plant[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  // Filters
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedPlant, setSelectedPlant] = useState<string>('')
  const [selectedPeriodicity, setSelectedPeriodicity] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'planning' | 'history'>('planning')

  // Duration settings
  const [plantDurations, setPlantDurations] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('maintenance_durations_by_plant') || '{}')
    } catch { return {} }
  })
  const defaultDuration = 10

  // New task form
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  // Month selector modal for moving tasks
  const [monthSelectorTask, setMonthSelectorTask] = useState<Maint | null>(null)
  const [newTask, setNewTask] = useState({
    plantId: '',
    type: 'preventive' as 'preventive' | 'corrective' | 'general',
    description: '',
    scheduledDate: '',
    periodicity: 'annual' as 'daily' | 'monthly' | 'quarterly' | 'annual',
    vendorName: '',
    estimatedCost: '',
    notes: ''
  })

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    tasks.forEach(t => years.add(new Date(t.scheduled_date).getFullYear()))
    for (let y = currentYear - 2; y <= currentYear + 3; y++) years.add(y)
    return Array.from(years).sort((a, b) => a - b)
  }, [tasks, currentYear])

  const plantNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    plants.forEach(p => { map[p.id] = p.name })
    return map
  }, [plants])

  // Initial data loading
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        const adminStatus = json?.user?.role === 'admin'
        console.log('[Maintenance] User role:', json?.user?.role, 'isAdmin:', adminStatus)
        setIsAdmin(adminStatus)
      })
      .catch(() => setIsAdmin(false))

    fetch('/api/plants', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setPlants(json.data.filter((p: Plant) => !EXCLUDED_PLANT_IDS.includes(p.id)))
        }
      })
      .catch(() => {})

    loadTasks()
  }, [])

  // Load history when switching to history tab or changing filters
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab, selectedYear, selectedPlant, selectedPeriodicity])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedYear) params.set('year', String(selectedYear))
      if (selectedPlant) params.set('plantId', selectedPlant)
      if (selectedPeriodicity) params.set('periodicity', selectedPeriodicity)

      const r = await fetch(`/api/maintenance/tasks?${params}`, { credentials: 'include' })
      const json = await r.json()
      if (json.success) {
        const rows = (json.data || []).filter((t: Maint) => !EXCLUDED_PLANT_IDS.includes(t.plant_id))
        setTasks(rows)
      }
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedYear) params.set('year', String(selectedYear))
      if (selectedPlant) params.set('plantId', selectedPlant)
      if (selectedPeriodicity) params.set('periodicity', selectedPeriodicity)

      const r = await fetch(`/api/maintenance/tasks/history?${params}`, { credentials: 'include' })
      const json = await r.json()
      if (json.success) {
        setHistoryTasks((json.data || []).filter((t: Maint) => !EXCLUDED_PLANT_IDS.includes(t.plant_id)))
      }
    } catch {
      setHistoryTasks([])
    }
  }

  // Reload when filters change
  useEffect(() => {
    loadTasks()
  }, [selectedYear, selectedPlant, selectedPeriodicity])

  // Generate placeholder tasks for plants without maintenance in selected year
  // Distribute maintenance evenly throughout the year (one plant per month approximately)
  const yearTasks = useMemo(() => {
    const existingMap = new Map<string, Maint>()
    tasks.forEach(t => {
      const taskYear = new Date(t.scheduled_date).getFullYear()
      if (taskYear === selectedYear && (t.periodicity === 'annual' || !t.periodicity)) {
        existingMap.set(t.plant_id, t)
      }
    })

    // Add non-daily tasks only (daily tasks should NOT appear in planning view)
    const result: Maint[] = tasks.filter(t => {
      const taskYear = new Date(t.scheduled_date).getFullYear()
      return taskYear === selectedYear && t.periodicity !== 'daily'
    })

    // Create placeholders for plants without annual maintenance
    // Distribute evenly throughout the year (not all in December!)
    const plantsNeedingPlaceholder = plants.filter(p => !existingMap.has(p.id))
    plantsNeedingPlaceholder.forEach((p, index) => {
      // Distribute across months: Feb to Nov (avoid Dec/Jan for better planning)
      const monthsToUse = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // Feb-Nov (0-indexed)
      const monthIndex = index % monthsToUse.length
      const month = monthsToUse[monthIndex]
      // Day 15 of the month
      const day = 15

      result.push({
        id: `placeholder-${p.id}-${selectedYear}`,
        plant_id: p.id,
        plant_name: p.name,
        task_type: 'general',
        description: 'Mantenimiento anual',
        scheduled_date: new Date(selectedYear, month, day).toISOString(),
        status: 'pending',
        periodicity: 'annual',
        isPlaceholder: true
      })
    })

    return result
  }, [plants, tasks, selectedYear])

  // Gantt chart data
  const ganttTasks: Task[] = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)

    const filtered = yearTasks.filter(t => {
      if (selectedPlant && t.plant_id !== selectedPlant) return false
      if (selectedPeriodicity && t.periodicity !== selectedPeriodicity) return false
      // Only show non-daily tasks in Gantt
      return t.periodicity !== 'daily'
    })

    return filtered.map(t => {
      const startPlan = new Date(t.scheduled_date)
      const dDays = plantDurations[t.plant_id] ?? defaultDuration
      const endPlan = addDays(startPlan, Math.max(1, dDays))
      const clampedStart = startPlan < yearStart ? yearStart : startPlan
      const clampedEnd = endPlan > yearEnd ? yearEnd : endPlan

      const isCompleted = t.status === 'completed'
      const isOverdue = !isCompleted && t.scheduled_date.slice(0, 10) < todayStr

      let backgroundColor = '#60a5fa' // Blue: pending
      if (isCompleted) backgroundColor = '#16a34a' // Green: completed
      else if (isOverdue) backgroundColor = '#ef4444' // Red: overdue

      const periodLabel = t.periodicity ? ` (${PERIODICITY_LABELS[t.periodicity] || t.periodicity})` : ''

      return {
        start: clampedStart,
        end: clampedEnd,
        name: `${t.plant_name || plantNameMap[t.plant_id] || t.plant_id}${periodLabel}`,
        id: t.id,
        type: 'task',
        progress: isCompleted ? 100 : 0,
        styles: { backgroundColor, progressColor: backgroundColor, progressSelectedColor: backgroundColor }
      }
    })
  }, [yearTasks, selectedYear, selectedPlant, selectedPeriodicity, plantDurations, plantNameMap])

  const todayLineOffset = useMemo(() => {
    const today = new Date()
    if (today.getFullYear() !== selectedYear) return null
    const yearStart = new Date(selectedYear, 0, 1)
    const diffDays = Math.floor((today.getTime() - yearStart.getTime()) / 86400000)
    const weekIndex = Math.floor(diffDays / 7)
    return weekIndex * 60
  }, [selectedYear])

  const toggleComplete = async (task: Maint) => {
    if (task.isPlaceholder) {
      // Create task first, then mark as completed
      try {
        const res = await fetch('/api/maintenance/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: task.plant_id,
            type: task.task_type,
            scheduledDate: task.scheduled_date,
            description: task.description,
            periodicity: task.periodicity || 'annual'
          })
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)

        // Mark as completed
        await fetch(`/api/maintenance/tasks/${json.data.id}/complete`, {
          method: 'POST',
          credentials: 'include'
        })
        await loadTasks()
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
      return
    }

    const isCompleted = task.status === 'completed'
    try {
      const endpoint = isCompleted
        ? `/api/maintenance/tasks/${task.id}/uncomplete`
        : `/api/maintenance/tasks/${task.id}/complete`

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include'
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: isCompleted ? 'pending' : 'completed', completed_date: isCompleted ? undefined : new Date().toISOString() }
          : t
      ))
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const updateScheduledDate = async (task: Maint, date: string) => {
    if (task.isPlaceholder) {
      try {
        const res = await fetch('/api/maintenance/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: task.plant_id,
            type: task.task_type,
            scheduledDate: date,
            description: task.description,
            periodicity: task.periodicity || 'annual'
          })
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        await loadTasks()
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
    } else {
      try {
        const res = await fetch(`/api/maintenance/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scheduledDate: date })
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled_date: date } : t))
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
    }
  }

  const createTask = async () => {
    if (!newTask.plantId || !newTask.description || !newTask.scheduledDate) {
      alert('Complete todos los campos requeridos')
      return
    }

    try {
      const res = await fetch('/api/maintenance/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plantId: newTask.plantId,
          type: newTask.type,
          description: newTask.description,
          scheduledDate: newTask.scheduledDate,
          periodicity: newTask.periodicity,
          vendorName: newTask.vendorName || undefined,
          estimatedCost: newTask.estimatedCost ? parseFloat(newTask.estimatedCost) : undefined,
          notes: newTask.notes || undefined
        })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setShowNewTaskForm(false)
      setNewTask({
        plantId: '',
        type: 'preventive',
        description: '',
        scheduledDate: '',
        periodicity: 'annual',
        vendorName: '',
        estimatedCost: '',
        notes: ''
      })
      await loadTasks()
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('¿Eliminar esta tarea de mantenimiento?')) return
    try {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  // Handle Gantt drag & drop - update task date when moved
  // Signature: (task: Task, children: Task[]) => void | boolean | Promise<void> | Promise<boolean>
  const handleGanttDateChange = useCallback(async (task: Task, _children: Task[]): Promise<boolean> => {
    console.log('[Gantt] onDateChange triggered!', task.id, task.name, 'new start:', task.start)
    const maintTask = yearTasks.find(t => t.id === task.id)
    if (!maintTask) {
      console.log('[Gantt] Task not found in yearTasks')
      return false
    }

    const newDate = task.start.toISOString()
    console.log('[Gantt] Updating to new date:', newDate)

    try {
      if (maintTask.isPlaceholder) {
        // Create the task with the new date
        const res = await fetch('/api/maintenance/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: maintTask.plant_id,
            type: maintTask.task_type,
            scheduledDate: newDate,
            description: maintTask.description,
            periodicity: maintTask.periodicity || 'annual'
          })
        })
        const json = await res.json()
        if (!json.success) {
          alert(`Error al crear tarea: ${json.error}`)
          return false
        }
        await loadTasks()
        return true
      } else {
        // Update existing task (this also updates reminder_date automatically on backend)
        const res = await fetch(`/api/maintenance/tasks/${maintTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scheduledDate: newDate })
        })
        const json = await res.json()
        if (!json.success) {
          alert(`Error al mover tarea: ${json.error}`)
          return false
        }
        // Update local state
        setTasks(prev => prev.map(t =>
          t.id === maintTask.id ? { ...t, scheduled_date: newDate } : t
        ))
        return true
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`)
      return false
    }
  }, [yearTasks, loadTasks])

  // Handle click on Gantt task - open month selector modal
  const handleGanttClick = useCallback((task: Task) => {
    console.log('[Gantt] Click on task:', task.id, task.name)
    const maintTask = yearTasks.find(t => t.id === task.id)
    console.log('[Gantt] Found maintTask:', maintTask?.plant_name, maintTask?.scheduled_date)
    if (maintTask) {
      setMonthSelectorTask(maintTask)
    }
  }, [yearTasks])

  // Move task to selected month
  const moveTaskToMonth = async (month: number) => {
    if (!monthSelectorTask) return

    // Use day 15 of the selected month
    const newDate = new Date(selectedYear, month, 15).toISOString().slice(0, 10)

    await updateScheduledDate(monthSelectorTask, newDate)
    setMonthSelectorTask(null)
  }

  // Delete all tasks for the selected year (reset planning)
  const deleteAllTasksForYear = async () => {
    const realTasks = yearTasks.filter(t => !t.isPlaceholder)
    if (realTasks.length === 0) {
      alert('No hay tareas para eliminar')
      return
    }

    if (!confirm(`¿Eliminar TODAS las ${realTasks.length} tareas de mantenimiento del año ${selectedYear}?\n\nEsto permitirá planificar manualmente desde cero.\n\nEsta acción no se puede deshacer.`)) {
      return
    }

    let deleted = 0
    let errors = 0

    for (const task of realTasks) {
      try {
        const res = await fetch(`/api/maintenance/tasks/${task.id}`, {
          method: 'DELETE',
          credentials: 'include'
        })
        const json = await res.json()
        if (json.success) deleted++
        else errors++
      } catch {
        errors++
      }
    }

    alert(`Eliminadas: ${deleted} tareas${errors > 0 ? `\nErrores: ${errors}` : ''}`)
    await loadTasks()
  }

  const displayTasks = useMemo(() => {
    return yearTasks.filter(t => {
      if (selectedPlant && t.plant_id !== selectedPlant) return false
      if (selectedPeriodicity && t.periodicity !== selectedPeriodicity) return false
      return true
    }).sort((a, b) => {
      // Sort by date, then by plant name
      const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
      if (dateCompare !== 0) return dateCompare
      return (a.plant_name || '').localeCompare(b.plant_name || '')
    })
  }, [yearTasks, selectedPlant, selectedPeriodicity])

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Cronograma de Mantenimiento</h1>
          {isAdmin && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Admin</span>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowNewTaskForm(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md text-sm font-medium"
          >
            + Nueva Tarea
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'planning' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('planning')}
        >
          Planificación
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('history')}
        >
          Historial
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Año</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 rounded border bg-white dark:bg-gray-700"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Planta</label>
            <select
              value={selectedPlant}
              onChange={e => setSelectedPlant(e.target.value)}
              className="px-3 py-2 rounded border bg-white dark:bg-gray-700"
            >
              <option value="">Todas las plantas</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Periodicidad</label>
            <select
              value={selectedPeriodicity}
              onChange={e => setSelectedPeriodicity(e.target.value)}
              className="px-3 py-2 rounded border bg-white dark:bg-gray-700"
            >
              <option value="">Todas</option>
              {activeTab === 'history' && <option value="daily">Diario</option>}
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="annual">Anual</option>
            </select>
          </div>
          {activeTab === 'planning' && (
            <div className="ml-auto text-xs text-gray-500 italic">
              Las tareas diarias se gestionan en el Checklist Diario
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500"></div> Pendiente
        </span>
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div> Completado
        </span>
        <span className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div> Vencido
        </span>
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : activeTab === 'planning' ? (
        <div className="space-y-6">
          {/* Tasks Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-semibold">Mantenimientos {selectedYear}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">Planta</th>
                    <th className="p-3 text-left">Descripción</th>
                    <th className="p-3 text-left">Periodicidad</th>
                    <th className="p-3 text-left">Fecha Programada</th>
                    <th className="p-3 text-center">Realizado</th>
                    <th className="p-3 text-center">Estado</th>
                    {isAdmin && <th className="p-3 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {displayTasks.map(task => {
                    const isCompleted = task.status === 'completed'
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const isOverdue = !isCompleted && task.scheduled_date.slice(0, 10) < todayStr
                    const statusColor = isCompleted ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-blue-600'
                    const statusText = isCompleted ? '✓ Completado' : isOverdue ? '⚠ Vencido' : '○ Pendiente'
                    const periodicityClass = PERIODICITY_COLORS[task.periodicity || 'annual'] || 'bg-gray-100'

                    return (
                      <tr key={task.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-3 font-medium">{task.plant_name || plantNameMap[task.plant_id] || task.plant_id}</td>
                        <td className="p-3">{task.description}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${periodicityClass}`}>
                            {PERIODICITY_LABELS[task.periodicity || 'annual'] || task.periodicity}
                          </span>
                        </td>
                        <td className="p-3">
                          {isAdmin ? (
                            <input
                              type="date"
                              value={task.scheduled_date.slice(0, 10)}
                              onChange={e => updateScheduledDate(task, e.target.value)}
                              className="px-2 py-1 rounded border bg-white dark:bg-gray-700"
                            />
                          ) : (
                            new Date(task.scheduled_date).toLocaleDateString('es-EC')
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={() => toggleComplete(task)}
                            className="w-5 h-5 cursor-pointer"
                          />
                        </td>
                        <td className={`p-3 text-center font-semibold ${statusColor}`}>
                          {statusText}
                        </td>
                        {isAdmin && (
                          <td className="p-3 text-center">
                            {!task.isPlaceholder && (
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {displayTasks.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-gray-500">
                        No hay tareas de mantenimiento para los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gantt Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <style>{ganttStyles}</style>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Gantt Anual de Mantenimientos</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Haz clic en una barra para mover la tarea a otro mes. Arrastra los extremos para cambiar duración.
                </p>
              </div>
              <button
                onClick={deleteAllTasksForYear}
                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                title="Borrar todas las tareas y planificar manualmente"
              >
                Resetear Planificación {selectedYear}
              </button>
            </div>
            {ganttTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay tareas para mostrar en el Gantt
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <Gantt
                  tasks={ganttTasks}
                  viewMode={ViewMode.Week}
                  barCornerRadius={8}
                  listCellWidth="250px"
                  columnWidth={60}
                  handleWidth={8}
                  onDateChange={handleGanttDateChange}
                  onProgressChange={() => false}
                  onClick={handleGanttClick}
                  onDoubleClick={handleGanttClick}
                />
                {todayLineOffset !== null && (
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: todayLineOffset, width: 2, background: '#ef4444', opacity: 0.85, pointerEvents: 'none' }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Historial de Mantenimientos Completados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="p-3 text-left">Planta</th>
                  <th className="p-3 text-left">Descripción</th>
                  <th className="p-3 text-left">Periodicidad</th>
                  <th className="p-3 text-left">Fecha Programada</th>
                  <th className="p-3 text-left">Fecha Realizado</th>
                  <th className="p-3 text-left">Realizado Por</th>
                </tr>
              </thead>
              <tbody>
                {historyTasks.map(task => {
                  const periodicityClass = PERIODICITY_COLORS[task.periodicity || 'annual'] || 'bg-gray-100'
                  return (
                    <tr key={task.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="p-3 font-medium">{task.plant_name || plantNameMap[task.plant_id]}</td>
                      <td className="p-3">{task.description}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${periodicityClass}`}>
                          {PERIODICITY_LABELS[task.periodicity || 'annual']}
                        </span>
                      </td>
                      <td className="p-3">{new Date(task.scheduled_date).toLocaleDateString('es-EC')}</td>
                      <td className="p-3">{task.completed_date ? new Date(task.completed_date).toLocaleDateString('es-EC') : '-'}</td>
                      <td className="p-3">{task.completed_by || '-'}</td>
                    </tr>
                  )
                })}
                {historyTasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No hay mantenimientos completados para los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Month Selector Modal */}
      {monthSelectorTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-2">Mover Mantenimiento</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <strong>{monthSelectorTask.plant_name || plantNameMap[monthSelectorTask.plant_id]}</strong>
              <br />
              {monthSelectorTask.description}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Seleccione el mes para programar este mantenimiento:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'Ene', month: 0 },
                { name: 'Feb', month: 1 },
                { name: 'Mar', month: 2 },
                { name: 'Abr', month: 3 },
                { name: 'May', month: 4 },
                { name: 'Jun', month: 5 },
                { name: 'Jul', month: 6 },
                { name: 'Ago', month: 7 },
                { name: 'Sep', month: 8 },
                { name: 'Oct', month: 9 },
                { name: 'Nov', month: 10 },
                { name: 'Dic', month: 11 }
              ].map(({ name, month }) => {
                const currentMonth = new Date(monthSelectorTask.scheduled_date).getMonth()
                const isCurrentMonth = currentMonth === month
                return (
                  <button
                    key={month}
                    onClick={() => moveTaskToMonth(month)}
                    className={`px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isCurrentMonth
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-blue-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-blue-900'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between items-center mt-6">
              <div className="text-xs text-gray-500">
                Actual: {new Date(monthSelectorTask.scheduled_date).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={() => setMonthSelectorTask(null)}
                className="px-4 py-2 rounded border hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Nueva Tarea de Mantenimiento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Planta *</label>
                <select
                  value={newTask.plantId}
                  onChange={e => setNewTask({ ...newTask, plantId: e.target.value })}
                  className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                >
                  <option value="">Seleccionar planta</option>
                  {plants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción *</label>
                <input
                  type="text"
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                  placeholder="Descripción del mantenimiento"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <select
                    value={newTask.type}
                    onChange={e => setNewTask({ ...newTask, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                  >
                    <option value="preventive">Preventivo</option>
                    <option value="corrective">Correctivo</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Periodicidad</label>
                  <select
                    value={newTask.periodicity}
                    onChange={e => setNewTask({ ...newTask, periodicity: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                  >
                    <option value="daily">Diario</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fecha Programada *</label>
                <input
                  type="date"
                  value={newTask.scheduledDate}
                  onChange={e => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                  className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={newTask.vendorName}
                    onChange={e => setNewTask({ ...newTask, vendorName: e.target.value })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                    placeholder="Nombre del proveedor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Costo Estimado</label>
                  <input
                    type="number"
                    value={newTask.estimatedCost}
                    onChange={e => setNewTask({ ...newTask, estimatedCost: e.target.value })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                    placeholder="$0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  value={newTask.notes}
                  onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-700"
                  rows={3}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewTaskForm(false)}
                className="px-4 py-2 rounded border hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={createTask}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                Crear Tarea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
