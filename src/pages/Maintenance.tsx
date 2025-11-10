import { useEffect, useMemo, useState } from 'react'
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
}

type Emergency = {
  id: string
  plant_id: string
  reason: string
  reported_at: string
  solved: boolean
  resolve_time_hours?: number
}

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
    if (years.size === 0) years.add(currentYear)
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

    // Fetch plants for name mapping
    fetch('/api/plants', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setPlants(json.data.map((p: any) => ({ id: p.id, name: p.name })))
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
        const rows: Maint[] = json.data || []
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
      const rows: Maint[] = json.data || []
      setUsingDemo(false)
      setTasks(rows)
    } catch {
      // mantener estado actual si falla
    }
  }

  // Emergencias: manejado en /emergencies

  const COLUMN_WIDTH = 60
  const monthlyDemoTasks = useMemo(() => {
    // Genera UN mantenimiento (demo) por planta detectada en tasks, para el año seleccionado
    const plantIds = Array.from(new Set(tasks.map(t => t.plant_id)))
    const items: Maint[] = []
    plantIds.forEach(pid => {
      const start = new Date(selectedYear, 6, 1) // 1 de julio
      const id = `demo-${pid}-${selectedYear}`
      items.push({
        id,
        plant_id: pid,
        task_type: 'general',
        description: `Mantenimiento completo`,
        scheduled_date: start.toISOString(),
        status: 'pending',
      })
    })
    return items
  }, [tasks, selectedYear])

  const sourceTasks = useMemo(() => showYearExample ? [...tasks, ...monthlyDemoTasks] : tasks, [tasks, monthlyDemoTasks, showYearExample])

  const ganttTasks: Task[] = useMemo(() => {
    const today = new Date()
    const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000)
    const yearStart = new Date(selectedYear, 0, 1)
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)
    const filtered = sourceTasks.filter(t => {
      const d = new Date(t.scheduled_date)
      if (d.getFullYear() !== selectedYear) return false
      if (selectedPlants.length > 0 && !selectedPlants.includes(t.plant_id)) return false
      return true
    })
    const rows: Task[] = []
    filtered.forEach(t => {
      const startPlan = new Date(t.scheduled_date)
      const dDays = plantDurations[t.plant_id] ?? durationDays
      const endPlan = addDays(startPlan, Math.max(1, dDays))
      const clampedStartPlan = startPlan < yearStart ? yearStart : startPlan
      const clampedEndPlan = endPlan > yearEnd ? yearEnd : endPlan
      rows.push({
        start: clampedStartPlan,
        end: clampedEndPlan,
        name: `Planificación · Mantenimiento completo`,
        id: `${t.id}-plan`,
        type: 'task',
        progress: 0,
        styles: { backgroundColor: '#60a5fa', progressColor: '#60a5fa', progressSelectedColor: '#60a5fa' },
      })
      const startExec = new Date(t.scheduled_date)
      const endExecRaw = t.completed_date ? new Date(t.completed_date) : today
      const clampedStartExec = startExec < yearStart ? yearStart : startExec
      const clampedEndExec = endExecRaw > yearEnd ? yearEnd : endExecRaw
      rows.push({
        start: clampedStartExec,
        end: clampedEndExec,
        name: `Ejecución · Mantenimiento completo`,
        id: `${t.id}-exec`,
        type: 'task',
        progress: (t.status === 'completed' || !!doneMap[t.id]) ? 100 : 0,
        styles: { backgroundColor: '#16a34a', progressColor: '#16a34a', progressSelectedColor: '#16a34a' },
      })
    })
    return rows
  }, [sourceTasks, doneMap, selectedYear, selectedPlants, durationDays, plantDurations])

  const todayLineOffset = useMemo(() => {
    const today = new Date()
    if (today.getFullYear() !== selectedYear) return null
    const yearStart = new Date(selectedYear, 0, 1)
    const diffDays = Math.floor((today.getTime() - yearStart.getTime()) / 86400000)
    const weekIndex = Math.floor(diffDays / 7)
    return weekIndex * COLUMN_WIDTH
  }, [selectedYear])

  const toggleDone = async (id: string) => {
    const isDone = !!doneMap[id]
    const completedDate = isDone ? null : new Date().toISOString().slice(0,10)
    const status = isDone ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, completedDate }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      // Update local task row
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as any, completed_date: completedDate || undefined } : t))
      setDoneMap(prev => {
        const next = { ...prev }
        if (isDone) delete next[id]; else next[id] = new Date().toISOString()
        localStorage.setItem('maintenance_done', JSON.stringify(next))
        return next
      })
    } catch {
      // Optimista en local si backend falla
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as any, completed_date: completedDate || undefined } : t))
      setDoneMap(prev => {
        const next = { ...prev }
        if (isDone) delete next[id]; else next[id] = new Date().toISOString()
        localStorage.setItem('maintenance_done', JSON.stringify(next))
        return next
      })
    }
  }

  const updateScheduledDate = async (id: string, date: string) => {
    try {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scheduledDate: date }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduled_date: date } : t))
    } catch {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduled_date: date } : t))
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
    return complianceRows.filter(r => {
      const d = new Date(r.scheduled_date)
      if (d.getFullYear() !== selectedYear) return false
      if (selectedPlants.length > 0 && !selectedPlants.includes(r.plant_id)) return false
      return true
    })
  }, [complianceRows, selectedYear, selectedPlants])

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
      <h1 className="text-2xl font-semibold mb-4">Cronograma de Mantenimiento</h1>
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
              <label className="ml-4 flex items-center gap-2 bg-white dark:bg-gray-800 rounded border px-3 py-2">
                <input type="checkbox" checked={showYearExample} onChange={e=>setShowYearExample(e.target.checked)} />
                <span className="text-sm">Ver ejemplo (1 mantenimiento por planta)</span>
              </label>
              {isAdmin && (
                <button
                  className="ml-2 px-3 py-1 rounded border bg-white dark:bg-gray-800"
                  onClick={async ()=>{
                    try {
                      const res = await fetch('/api/maintenance/tasks/generate-monthly', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ year: selectedYear }),
                      })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || 'Error')
                      setShowYearExample(false)
                      await reloadTasks()
                    } catch (e) {
                      // sin bloqueo, se mantiene la vista
                    }
                  }}
                >Insertar ejemplo en BD (1 por planta)</button>
              )}
            </div>
            <div className="text-sm font-semibold mb-2">Planificación</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Planta</th>
                    <th className="p-2">Tarea</th>
                    <th className="p-2">Programado</th>
                    <th className="p-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {planningRows.map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{plantNameMap[row.plant_id] || row.plant_id}</td>
                      <td className="p-2">Mantenimiento completo</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDates[row.id]?.scheduled ?? row.scheduled_date.slice(0,10)}
                            onChange={e => setEditDates(prev => ({ ...prev, [row.id]: { ...(prev[row.id]||{}), scheduled: e.target.value } }))}
                            disabled={!isAdmin}
                            className="px-2 py-1 rounded border bg-white dark:bg-gray-800"
                          />
                          <button className="px-2 py-1 rounded border" disabled={!isAdmin} onClick={() => updateScheduledDate(row.id, (editDates[row.id]?.scheduled ?? row.scheduled_date.slice(0,10)))}>
                            Guardar
                          </button>
                          {!isAdmin && (
                            <span className="text-xs text-gray-500">Solo Admin edita planificación</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        <button className="px-2 py-1 rounded border" disabled={!isAdmin} onClick={() => deleteTask(row.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Ejecutado</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Planta</th>
                    <th className="p-2">Tarea</th>
                    <th className="p-2">Realizado</th>
                    <th className="p-2">Retraso (días)</th>
                    <th className="p-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {executedRows.map(row => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{plantNameMap[row.plant_id] || row.plant_id}</td>
                      <td className="p-2">Mantenimiento completo</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDates[row.id]?.completed ?? (doneMap[row.id]?.slice(0,10) || row.completed_date?.slice(0,10) || '')}
                            onChange={e => setEditDates(prev => ({ ...prev, [row.id]: { ...(prev[row.id]||{}), completed: e.target.value } }))}
                            className="px-2 py-1 rounded border bg-white dark:bg-gray-800"
                          />
                          <button className="px-2 py-1 rounded border" onClick={() => updateCompletedDate(row.id, (editDates[row.id]?.completed || ''))}>
                            Guardar
                          </button>
                        </div>
                      </td>
                      <td className="p-2">{row.delayDays || 0}</td>
                      <td className="p-2">
                        <button className="px-3 py-1 rounded border" onClick={() => toggleDone(row.id)}>
                          Marcar no realizado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Próximo mantenimiento (completados + 365 días)</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Planta</th>
                    <th className="p-2">Tarea</th>
                    <th className="p-2">Completado</th>
                    <th className="p-2">Próximo</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.filter(t => t.status === 'completed' || !!doneMap[t.id]).map(t => {
                    const base = new Date((doneMap[t.id] || t.completed_date || t.scheduled_date))
                    const next = new Date(base.getTime() + 365 * 86400000)
                    return (
                      <tr key={`next-${t.id}`} className="border-t">
                        <td className="p-2">{t.plant_id}</td>
                        <td className="p-2">Mantenimiento completo</td>
                        <td className="p-2">{(doneMap[t.id] || t.completed_date) ? new Date((doneMap[t.id] || t.completed_date)!).toLocaleDateString() : '-'}</td>
                        <td className="p-2">{next.toLocaleDateString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">Gantt de planificación vs ejecución</div>
            <div className="text-xs text-gray-600 mb-2">Azul: programado · Verde: ejecutado (progreso) · Línea roja: hoy</div>
            <div className="relative">
              <Gantt tasks={ganttTasks} viewMode={view} barCornerRadius={8} listCellWidth="200px" columnWidth={COLUMN_WIDTH} />
              {todayLineOffset !== null && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: todayLineOffset, width: 2, background: '#ef4444', opacity: 0.85, pointerEvents: 'none' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}