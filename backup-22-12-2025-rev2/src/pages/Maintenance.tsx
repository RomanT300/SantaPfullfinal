import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

type Maint = {
  id: string
  plant_id: string
  task_type: 'preventive' | 'corrective' | 'general'
  description: string
  scheduled_date: string
  completed_date?: string
  status: 'pending' | 'completed' | 'overdue'
  isPlaceholder?: boolean
}

type Emergency = {
  id: string
  plant_id: string
  reason: string
  reported_at: string
  solved: boolean
  resolve_time_hours?: number
}

// Plantas excluidas de la vista general (tienen su propia subpestaña detallada)
const EXCLUDED_PLANT_IDS = [
  '88888888-8888-8888-8888-888888888885', // Tropack Industrial
  '88888888-8888-8888-8888-888888888886', // Tropack Tilapia
]

export default function Maintenance() {
  const [tasks, setTasks] = useState<Maint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [view, setView] = useState<ViewMode>(ViewMode.Week)
  const [durationDays, setDurationDays] = useState<number>(10)
  const [plantDurations, setPlantDurations] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem('maintenance_durations_by_plant') || '{}')
    } catch { return {} }
  })
  const [showYearExample, setShowYearExample] = useState<boolean>(false)
  // Emergencias se movió a una página aparte
  const [doneMap, setDoneMap] = useState<Record<string, string>>(JSON.parse(localStorage.getItem('maintenance_done') || '{}'))
  const [editDates, setEditDates] = useState<Record<string, { scheduled?: string; completed?: string }>>({})
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [plants, setPlants] = useState<{id: string; name: string}[]>([])

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    tasks.forEach(t => years.add(new Date(t.scheduled_date).getFullYear()))
    // Siempre incluir los últimos 2 años y próximos 3 años
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
      years.add(y)
    }
    return Array.from(years).sort((a,b)=>a-b)
  }, [tasks, currentYear])

  const plantNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    plants.forEach(p => { map[p.id] = p.name })
    return map
  }, [plants])

  const plantOptions = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach(t => set.add(t.plant_id))
    return Array.from(set).sort()
  }, [tasks])

  useEffect(() => {
    // Inicializa duración por planta con valor por defecto si no existe
    setPlantDurations(prev => {
      const next = { ...prev }
      plantOptions.forEach(pid => { if (typeof next[pid] !== 'number' || next[pid] <= 0) next[pid] = durationDays })
      localStorage.setItem('maintenance_durations_by_plant', JSON.stringify(next))
      return next
    })
  }, [plantOptions])
  const [selectedPlants, setSelectedPlants] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Consultar rol desde cookie HttpOnly
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(json => setIsAdmin((json?.user?.role) === 'admin'))
      .catch(() => setIsAdmin(false))

    // Fetch plants for name mapping (excluding Tropack Industrial & Tilapia)
    fetch('/api/plants', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setPlants(json.data
            .filter((p: any) => !EXCLUDED_PLANT_IDS.includes(p.id))
            .map((p: any) => ({ id: p.id, name: p.name })))
        }
      })
      .catch(() => {
        // Fallback to demo plants
        setPlants([
          { id: '33333333-3333-3333-3333-333333333333', name: 'LA LUZ' },
          { id: '44444444-4444-4444-4444-444444444444', name: 'TAURA' },
          { id: '55555555-5555-5555-5555-555555555555', name: 'SANTA MONICA' },
          { id: '66666666-6666-6666-6666-666666666666', name: 'SAN DIEGO' },
          { id: '77777777-7777-7777-7777-777777777777', name: 'CHANDUY' },
        ])
      })
  }, [])
  const demoTasks = (): Maint[] => {
    const year = new Date().getFullYear()
    const plants = ['LA LUZ', 'TAURA', 'SANTA MONICA', 'SAN DIEGO', 'CHANDUY']
    return plants.map((plant) => ({
      id: `demo-${plant}-${year}`,
      plant_id: plant,
      task_type: 'general',
      description: 'Mantenimiento completo',
      scheduled_date: new Date(year, 6, 1).toISOString(), // 1 de julio
      status: 'pending',
    }))
  }

  useEffect(() => {
    fetch('/api/maintenance/tasks', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error || 'Error')
        const rows: Maint[] = (json.data || []).filter(
          (t: Maint) => !EXCLUDED_PLANT_IDS.includes(t.plant_id)
        )
        const isDemo = rows.length === 0
        setUsingDemo(isDemo)
        setTasks(isDemo ? demoTasks() : rows)
      })
      .catch(() => {
        // Si el backend no responde con JSON (ej. HTML), usamos demo silenciosamente
        setUsingDemo(true)
        setTasks(demoTasks())
        setError(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const reloadTasks = async () => {
    try {
      const r = await fetch('/api/maintenance/tasks', { credentials: 'include' })
      const json = await r.json()
      if (!json.success) throw new Error(json.error || 'Error')
      const rows: Maint[] = (json.data || []).filter(
        (t: Maint) => !EXCLUDED_PLANT_IDS.includes(t.plant_id)
      )
      setUsingDemo(false)
      setTasks(rows)
    } catch {
      // mantener estado actual si falla
    }
  }

  // Emergencias: manejado en /emergencies

  const COLUMN_WIDTH = 60
  // Generar automáticamente una tarea por cada planta para el año seleccionado
  const yearTasks = useMemo(() => {
    const existingMap = new Map<string, Maint>()

    // Primero, mapear las tareas existentes para este año
    tasks.forEach(t => {
      const taskYear = new Date(t.scheduled_date).getFullYear()
      if (taskYear === selectedYear) {
        existingMap.set(t.plant_id, t)
      }
    })

    // Crear una tarea por cada planta (usar existente o crear placeholder)
    return plants.map(p => {
      if (existingMap.has(p.id)) {
        return existingMap.get(p.id)!
      }
      // Placeholder para plantas sin tarea este año
      return {
        id: `placeholder-${p.id}-${selectedYear}`,
        plant_id: p.id,
        task_type: 'general' as const,
        description: 'Mantenimiento completo',
        scheduled_date: new Date(selectedYear, 6, 1).toISOString(), // Default: 1 julio
        status: 'pending' as const,
        isPlaceholder: true
      }
    }).filter(t => t !== null) as Maint[]
  }, [plants, tasks, selectedYear])

  const ganttTasks: Task[] = useMemo(() => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)

    const filtered = yearTasks.filter(t => {
      if (selectedPlants.length > 0 && !selectedPlants.includes(t.plant_id)) return false
      return true
    })

    const rows: Task[] = []
    filtered.forEach(t => {
      // Usar fecha editada si existe, sino usar la fecha guardada
      const scheduledDateStr = editDates[t.id]?.scheduled ?? t.scheduled_date.slice(0, 10)
      const startPlan = new Date(scheduledDateStr)
      const dDays = plantDurations[t.plant_id] ?? durationDays
      const endPlan = addDays(startPlan, Math.max(1, dDays))
      const clampedStartPlan = startPlan < yearStart ? yearStart : startPlan
      const clampedEndPlan = endPlan > yearEnd ? yearEnd : endPlan

      // Determinar color según estado
      const isCompleted = t.status === 'completed' || !!doneMap[t.id]
      const isOverdue = !isCompleted && scheduledDateStr < todayStr

      let backgroundColor = '#60a5fa' // Azul: pendiente
      if (isCompleted) {
        backgroundColor = '#16a34a' // Verde: completado
      } else if (isOverdue) {
        backgroundColor = '#ef4444' // Rojo: vencido
      }

      rows.push({
        start: clampedStartPlan,
        end: clampedEndPlan,
        name: `${plantNameMap[t.plant_id] || t.plant_id} - Mantenimiento`,
        id: `${t.id}-plan`,
        type: 'task',
        progress: isCompleted ? 100 : 0,
        styles: { backgroundColor, progressColor: backgroundColor, progressSelectedColor: backgroundColor },
      })
    })
    return rows
  }, [yearTasks, doneMap, selectedYear, selectedPlants, durationDays, plantDurations, plantNameMap, editDates])

  const todayLineOffset = useMemo(() => {
    const today = new Date()
    if (today.getFullYear() !== selectedYear) return null
    const yearStart = new Date(selectedYear, 0, 1)
    const diffDays = Math.floor((today.getTime() - yearStart.getTime()) / 86400000)
    const weekIndex = Math.floor(diffDays / 7)
    return weekIndex * COLUMN_WIDTH
  }, [selectedYear])

  const toggleDone = async (taskOrId: Maint | string) => {
    const task = typeof taskOrId === 'string' ? yearTasks.find(t => t.id === taskOrId) : taskOrId
    if (!task) return

    // Si es placeholder, primero crear la tarea
    if (task.isPlaceholder) {
      try {
        const res = await fetch('/api/maintenance/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: task.plant_id,
            type: task.task_type,
            scheduledDate: task.scheduled_date,
            description: task.description
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Error')

        // Marcar inmediatamente como completado
        const newId = json.data.id
        const res2 = await fetch(`/api/maintenance/tasks/${newId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'completed', completedDate: new Date().toISOString().slice(0,10) }),
        })
        const json2 = await res2.json()
        if (!json2.success) throw new Error(json2.error || 'Error')

        await reloadTasks()
      } catch (e: any) {
        alert(`Error al guardar: ${e.message}`)
      }
      return
    }

    // Tarea existente: toggle completed/pending
    const isDone = !!doneMap[task.id]
    const completedDate = isDone ? null : new Date().toISOString().slice(0,10)
    const status = isDone ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/maintenance/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, completedDate }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: status as any, completed_date: completedDate || undefined } : t))
      setDoneMap(prev => {
        const next = { ...prev }
        if (isDone) delete next[task.id]; else next[task.id] = new Date().toISOString()
        localStorage.setItem('maintenance_done', JSON.stringify(next))
        return next
      })
    } catch (e: any) {
      alert(`Error: ${e.message}`)
    }
  }

  const updateScheduledDate = async (task: Maint, date: string) => {
    try {
      // Si es placeholder, crear nueva tarea
      if (task.isPlaceholder) {
        const res = await fetch('/api/maintenance/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plantId: task.plant_id,
            type: task.task_type,
            scheduledDate: date,
            description: task.description
          }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Error')
        await reloadTasks()
      } else {
        // Actualizar tarea existente
        const res = await fetch(`/api/maintenance/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ scheduledDate: date }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Error')
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, scheduled_date: date } : t))
      }
    } catch (e: any) {
      alert(`Error al guardar: ${e.message}`)
    }
  }

  const updateCompletedDate = async (id: string, date: string) => {
    const status = date ? 'completed' : 'pending'
    try {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, completedDate: date || null }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as any, completed_date: date || undefined } : t))
      setDoneMap(prev => {
        const next = { ...prev }
        if (!date) delete next[id]; else next[id] = new Date().toISOString()
        localStorage.setItem('maintenance_done', JSON.stringify(next))
        return next
      })
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as any, completed_date: date || undefined } : t))
      setDoneMap(prev => {
        const next = { ...prev }
        if (!date) delete next[id]; else next[id] = new Date().toISOString()
        localStorage.setItem('maintenance_done', JSON.stringify(next))
        return next
      })
    }
  }

  const deleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch {
      // fallback local
      setTasks(prev => prev.filter(t => t.id !== id))
    }
  }

  const complianceRows = useMemo(() => {
    const today = new Date().toISOString().slice(0,10)
    return tasks.map(t => {
      const completedAt = doneMap[t.id] || t.completed_date || ''
      const scheduled = t.scheduled_date.slice(0,10)
      const realizado = !!completedAt
      const overdue = (!realizado && scheduled < today) || (realizado && completedAt.slice(0,10) > scheduled)
      const delayDays = overdue ? Math.ceil((new Date((realizado ? completedAt : new Date().toISOString())).getTime() - new Date(scheduled).getTime())/86400000) : 0
      return { ...t, realizado, overdue, delayDays }
    })
  }, [tasks, doneMap])

  const planningRows = useMemo(() => {
    return yearTasks.filter(r => {
      if (selectedPlants.length > 0 && !selectedPlants.includes(r.plant_id)) return false
      return true
    })
  }, [yearTasks, selectedPlants])

  const executedRows = useMemo(() => {
    return complianceRows.filter(r => {
      const d = new Date(r.scheduled_date)
      if (d.getFullYear() !== selectedYear) return false
      if (selectedPlants.length > 0 && !selectedPlants.includes(r.plant_id)) return false
      return r.realizado
    })
  }, [complianceRows, selectedYear, selectedPlants])

  const weeklyMatrix = useMemo(() => {
    const matrix: { planned: number; completed: number; overdue: number }[][] = Array.from({ length: 12 }, () => Array.from({ length: 5 }, () => ({ planned: 0, completed: 0, overdue: 0 })))
    const todayStr = new Date().toISOString().slice(0,10)
    tasks.forEach(t => {
      const d = new Date(t.scheduled_date)
      if (d.getFullYear() !== selectedYear) return
      if (selectedPlants.length > 0 && !selectedPlants.includes(t.plant_id)) return
      const m = d.getMonth()
      const weekIndex = Math.min(4, Math.floor((d.getDate() - 1) / 7))
      const realizado = !!(doneMap[t.id] || t.completed_date)
      const scheduled = t.scheduled_date.slice(0,10)
      const completedAt = (doneMap[t.id] || t.completed_date || '').slice(0,10)
      const overdue = (!realizado && scheduled < todayStr) || (realizado && completedAt > scheduled)
      const cell = matrix[m][weekIndex]
      cell.planned += 1
      if (realizado) cell.completed += 1
      if (overdue) cell.overdue += 1
    })
    return matrix
  }, [tasks, doneMap, selectedYear, selectedPlants])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Cronograma de Mantenimiento</h1>
        <Link
          to="/tropack-maintenance"
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md text-sm font-medium"
        >
          📋 Plan Tropack Industrial
        </Link>
      </div>
      {loading && <div>Cargando...</div>}
      {usingDemo && !loading && (
        <div className="mb-3 text-sm rounded border border-yellow-200 bg-yellow-50 text-yellow-800 px-3 py-2">
          Mostrando datos de ejemplo (backend no disponible)
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-sm text-gray-600">Leyenda:</div>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-100 text-blue-800">Programado<div className="w-3 h-3 rounded" style={{background:'#60a5fa'}}/></span>
        <span className="inline-flex items-center gap-2 px-2 py-1 rounded bg-emerald-100 text-emerald-800">Ejecutado<div className="w-3 h-3 rounded" style={{background:'#16a34a'}}/></span>
      </div>
      {!loading && (
        <div className="bg-white dark:bg-gray-800 rounded shadow p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">Vista:</span>
            <span className="px-2 py-1 rounded border bg-gray-50 dark:bg-gray-700">Semanas (1 año)</span>
          </div>
          {/* Gantt movido al final de la página */}
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">Año:</label>
              <select value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))} className="px-2 py-1 rounded border bg-white dark:bg-gray-800">
                {availableYears.map(y => (<option key={y} value={y}>{y}</option>))}
              </select>
              <span className="text-sm text-gray-600 ml-4">Planta:</span>
              <button
                className={`px-2 py-1 rounded border text-xs ${selectedPlants.length===0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 dark:bg-gray-700'}`}
                onClick={()=>setSelectedPlants([])}
              >Todas</button>
              <div className="flex flex-wrap gap-2">
                {plantOptions.map(p => {
                  const active = selectedPlants.includes(p)
                  const plantName = plantNameMap[p] || p
                  return (
                    <button
                      key={p}
                      className={`px-2 py-1 rounded border text-xs ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 dark:bg-gray-700'}`}
                      onClick={()=>setSelectedPlants(prev => active ? prev.filter(x=>x!==p) : [...prev, p])}
                    >{plantName}</button>
                  )
                })}
              </div>
              <div className="ml-4 flex items-center gap-2">
                <span className="text-sm text-gray-600">Duración por planta (días):</span>
                <div className="flex flex-wrap gap-2">
                  {plantOptions.map(pid => {
                    const plantName = plantNameMap[pid] || pid
                    return (
                      <label key={`dur-${pid}`} className="flex items-center gap-1 text-xs bg-white dark:bg-gray-800 rounded border px-2 py-1">
                        <span>{plantName}</span>
                        <input
                          type="number"
                          min={1}
                          value={plantDurations[pid] ?? durationDays}
                          onChange={e=>{
                            const v = Math.max(1, parseInt(e.target.value||'1'))
                            setPlantDurations(prev => {
                              const next = { ...prev, [pid]: v }
                              localStorage.setItem('maintenance_durations_by_plant', JSON.stringify(next))
                              return next
                            })
                          }}
                          className="px-2 py-1 rounded border w-16 bg-white dark:bg-gray-800"
                        />
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="text-sm font-semibold mb-2">Mantenimientos {selectedYear}</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left bg-gray-50 dark:bg-gray-700">
                    <th className="p-3">Planta</th>
                    <th className="p-3">Fecha Programada</th>
                    <th className="p-3 text-center">Realizado</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {planningRows.map(row => {
                    const isCompleted = row.status === 'completed' || !!doneMap[row.id]
                    const todayStr = new Date().toISOString().slice(0, 10)
                    // Usar fecha editada si existe para calcular si está vencido
                    const scheduledDateStr = editDates[row.id]?.scheduled ?? row.scheduled_date.slice(0, 10)
                    const isOverdue = !isCompleted && scheduledDateStr < todayStr
                    const statusColor = isCompleted ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-blue-600'
                    const statusText = isCompleted ? '✓ Completado' : isOverdue ? '⚠ Vencido' : '○ Pendiente'

                    return (
                      <tr key={row.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="p-3 font-medium">{plantNameMap[row.plant_id] || row.plant_id}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={scheduledDateStr}
                              onChange={e => setEditDates(prev => ({ ...prev, [row.id]: { ...(prev[row.id]||{}), scheduled: e.target.value } }))}
                              disabled={!isAdmin}
                              className="px-2 py-1 rounded border bg-white dark:bg-gray-800 disabled:opacity-50"
                            />
                            {isAdmin && (
                              <button
                                className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 text-xs"
                                onClick={() => updateScheduledDate(row, scheduledDateStr)}
                              >
                                Guardar
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={() => toggleDone(row)}
                            className="w-5 h-5 cursor-pointer"
                          />
                        </td>
                        <td className={`p-3 text-center font-semibold ${statusColor}`}>
                          {statusText}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Gantt Anual de Mantenimientos</div>
            <div className="text-xs text-gray-600 mb-2">
              <span className="inline-block mr-4">🔵 Azul: Pendiente</span>
              <span className="inline-block mr-4">🟢 Verde: Completado</span>
              <span className="inline-block mr-4">🔴 Rojo: Vencido (no realizado)</span>
              <span className="inline-block">│ Línea roja: Hoy</span>
            </div>
            {ganttTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay tareas de mantenimiento programadas para este año
              </div>
            ) : (
              <div className="relative">
                <Gantt tasks={ganttTasks} viewMode={view} barCornerRadius={8} listCellWidth="200px" columnWidth={COLUMN_WIDTH} />
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
      )}
    </div>
  )
}