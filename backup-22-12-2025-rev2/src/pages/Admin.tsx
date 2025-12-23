import { useEffect, useState } from 'react'

type Plant = { id: string; name: string }

export default function Admin() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [activeTab, setActiveTab] = useState<'plantas'|'mantenimientos'|'analitica'|'coordenadas'>('plantas')
  const [plantId, setPlantId] = useState<string>('')
  const [parameter, setParameter] = useState<'DQO'|'pH'|'SS'>('DQO')
  const [stream, setStream] = useState<'influent'|'effluent'>('influent')
  const [measurementDate, setMeasurementDate] = useState<string>('')
  const [value, setValue] = useState<string>('1000')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  // Crear usuario
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState<'admin'|'standard'>('standard')
  const [creatingUser, setCreatingUser] = useState(false)
  const [userMessage, setUserMessage] = useState<string>('')
  // Rol actual (dev)
  const [currentRole, setCurrentRole] = useState<'admin'|'standard'|'unknown'>('unknown')
  // Formularios de pestañas admin
  const [newPlant, setNewPlant] = useState<{ name: string; location: string; latitude: string; longitude: string }>({ name: '', location: '', latitude: '', longitude: '' })
  const [maint, setMaint] = useState<{ plantId: string; type: 'preventive'|'corrective'|'general'; scheduledDate: string; description: string }>({ plantId: '', type: 'general', scheduledDate: '', description: '' })
  const [baseline, setBaseline] = useState<{ plantId: string; parameter: 'DQO'|'pH'|'SS'; stream?: 'influent'|'effluent'; measurementDate: string; value: string }>({ plantId: '', parameter: 'DQO', stream: 'influent', measurementDate: '', value: '' })
  const [coord, setCoord] = useState<{ plantId: string; latitude: string; longitude: string }>({ plantId: '', latitude: '', longitude: '' })
  const [tabMsg, setTabMsg] = useState<string>('')
  // Listados
  const [envRows, setEnvRows] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loadingTab, setLoadingTab] = useState(false)
  // Filtros y paginación
  const [analyticsFilter, setAnalyticsFilter] = useState<{ plantId: string; parameter: ''|'DQO'|'pH'|'SS'; stream?: ''|'influent'|'effluent'; startDate: string; endDate: string }>({ plantId: '', parameter: '', stream: '', startDate: '', endDate: '' })
  const [analyticsPage, setAnalyticsPage] = useState(1)
  const [analyticsPageSize, setAnalyticsPageSize] = useState(10)
  const [tasksFilter, setTasksFilter] = useState<{ plantId: string; status: ''|'pending'|'completed'|'overdue'; startDate: string; endDate: string }>({ plantId: '', status: '', startDate: '', endDate: '' })
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(10)
  const [plantsQuery, setPlantsQuery] = useState('')
  const [plantsPage, setPlantsPage] = useState(1)
  const [plantsPageSize, setPlantsPageSize] = useState(10)

  // Demo storage fallback helpers
  const readDemo = (): any[] => {
    try {
      return JSON.parse(localStorage.getItem('env_demo') || '[]')
    } catch {
      return []
    }
  }
  const writeDemo = (rows: any[]) => {
    localStorage.setItem('env_demo', JSON.stringify(rows))
  }
  const upsertDemo = (r: { plant_id: string; parameter_type: string; measurement_date: string; value: number; stream?: 'influent'|'effluent' }) => {
    const list = readDemo()
    const idx = list.findIndex((x: any) => x.plant_id === r.plant_id && x.parameter_type === r.parameter_type && x.measurement_date === r.measurement_date && (x.stream ?? null) === (r.stream ?? null))
    if (idx >= 0) {
      list[idx] = { ...list[idx], value: r.value, ...(typeof r.stream !== 'undefined' ? { stream: r.stream } : {}) }
    } else {
      list.push({ id: `local-${Date.now()}`, ...r })
    }
    writeDemo(list)
  }
  const deleteDemo = (keys: { plant_id: string; parameter_type: string; measurement_date: string; stream?: 'influent'|'effluent' }) => {
    const list = readDemo()
    const next = list.filter((x: any) => !(x.plant_id === keys.plant_id && x.parameter_type === keys.parameter_type && x.measurement_date === keys.measurement_date && (x.stream ?? null) === (keys.stream ?? null)))
    writeDemo(next)
  }

  useEffect(() => {
    fetch('/api/plants', { credentials: 'include' })
      .then(r=>r.json()).then(json=>{ if(json.success) setPlants(json.data || []) })
      .catch(()=>{
        setPlants([
          { id: 'LA LUZ', name: 'LA LUZ' },
          { id: 'TAURA', name: 'TAURA' },
          { id: 'SANTA MONICA', name: 'SANTA MONICA' },
          { id: 'SAN DIEGO', name: 'SAN DIEGO' },
          { id: 'CHANDUY', name: 'CHANDUY' },
        ])
      })
    // Detectar rol actual
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          const role = (json?.user?.role as 'admin'|'standard') || 'standard'
          setCurrentRole(role)
        } else {
          setCurrentRole('unknown')
        }
      } catch {
        setCurrentRole('unknown')
      }
    })()
  }, [])

  // Cargar listados al cambiar de pestaña
  useEffect(() => {
    const load = async () => {
      if (currentRole !== 'admin') return
      setLoadingTab(true)
      try {
        if (activeTab === 'analitica') {
          const params = new URLSearchParams()
          if (analyticsFilter.plantId) params.set('plantId', analyticsFilter.plantId)
          if (analyticsFilter.parameter) params.set('parameter', analyticsFilter.parameter)
          if (analyticsFilter.stream) params.set('stream', analyticsFilter.stream!)
          if (analyticsFilter.startDate) params.set('startDate', analyticsFilter.startDate)
          if (analyticsFilter.endDate) params.set('endDate', analyticsFilter.endDate)
          const res = await fetch(`/api/analytics/environmental?${params.toString()}`, { credentials: 'include' })
          const json = await res.json()
          if (json.success) setEnvRows((json.data || []).map((r:any)=> ({ ...r, _original: { plant_id: r.plant_id, parameter_type: r.parameter_type, measurement_date: r.measurement_date, stream: r.stream } })))
        } else if (activeTab === 'mantenimientos') {
          const res = await fetch('/api/maintenance/tasks', { credentials: 'include' })
          const json = await res.json()
          if (json.success) setTasks(json.data || [])
        } else if (activeTab === 'plantas' || activeTab === 'coordenadas') {
          const res = await fetch('/api/plants', { credentials: 'include' })
          const json = await res.json()
          if (json.success) setPlants(json.data || [])
        }
      } catch (_) {
        // noop
      } finally {
        setLoadingTab(false)
      }
    }
    load()
  }, [activeTab, currentRole, analyticsFilter])

  const saveMeasurement = async () => {
    setSaving(true)
    setMessage('')
    try {
      const resp = await fetch('/api/analytics/environmental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plantId, parameter, stream, measurementDate, value: Number(value) }),
      })
      const json = await resp.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setMessage('Guardado correctamente')
    } catch (e: any) {
      // fallback demo local
      upsertDemo({
        plant_id: plantId,
        parameter_type: parameter,
        measurement_date: measurementDate,
        value: Number(value),
        stream,
      })
      setMessage('Guardado en modo demo (local)')
    } finally {
      setSaving(false)
    }
  }

  const deleteMeasurement = async () => {
    setSaving(true)
    setMessage('')
    try {
      const resp = await fetch('/api/analytics/environmental', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plantId, parameter, stream, measurementDate }),
      })
      const json = await resp.json()
      if (!json.success) throw new Error(json.error || 'Error')
      setMessage('Eliminado correctamente')
    } catch (e: any) {
      // fallback demo local
      deleteDemo({
        plant_id: plantId,
        parameter_type: parameter,
        measurement_date: measurementDate,
        stream,
      })
      setMessage('Eliminado en modo demo (local)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Panel de Administración</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gestión de rol (solo desarrollo) */}
        <div className="bg-white dark:bg-gray-800 rounded border p-4">
          <h2 className="text-lg font-medium mb-3">Sesión y rol (desarrollo)</h2>
          <div className="text-sm mb-2">Rol actual: <span className="font-semibold">{currentRole}</span></div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded border bg-emerald-600 text-white"
              onClick={async ()=>{
                try {
                  const resp = await fetch('/api/auth/dev-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ role: 'admin', email: 'admin@demo' })
                  })
                  const json = await resp.json()
                  if (!json.success) throw new Error(json.error || 'Error')
                  setCurrentRole('admin')
                } catch (e:any) {
                  alert('No se pudo activar rol admin: ' + e.message)
                }
              }}
            >
              Activar rol Admin (dev)
            </button>
            <button
              className="px-3 py-2 rounded border bg-gray-600 text-white"
              onClick={async ()=>{
                try {
                  const resp = await fetch('/api/auth/dev-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ role: 'standard', email: 'user@demo' })
                  })
                  const json = await resp.json()
                  if (!json.success) throw new Error(json.error || 'Error')
                  setCurrentRole('standard')
                } catch (e:any) {
                  alert('No se pudo activar rol standard: ' + e.message)
                }
              }}
            >
              Activar rol Standard (dev)
            </button>
          </div>
          <p className="text-xs text-yellow-700 bg-yellow-50 border rounded p-2 mt-3">
            Nota: este conmutador usa un endpoint de desarrollo. En producción, accede con usuarios reales creados.
          </p>
        </div>
        {/* Pestaña de gestión solo Admin */}
        <div className="bg-white dark:bg-gray-800 rounded border p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Gestión rápida (solo admin)</h2>
            <div className="flex gap-2 text-sm">
              <button className={`px-3 py-1 rounded border ${activeTab==='plantas'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800'}`} onClick={()=>setActiveTab('plantas')}>Plantas</button>
              <button className={`px-3 py-1 rounded border ${activeTab==='mantenimientos'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800'}`} onClick={()=>setActiveTab('mantenimientos')}>Mantenimientos próximos</button>
              <button className={`px-3 py-1 rounded border ${activeTab==='analitica'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800'}`} onClick={()=>setActiveTab('analitica')}>Analítica inicial</button>
              <button className={`px-3 py-1 rounded border ${activeTab==='coordenadas'?'bg-blue-600 text-white':'bg-white dark:bg-gray-800'}`} onClick={()=>setActiveTab('coordenadas')}>Coordenadas</button>
            </div>
          </div>
          {currentRole !== 'admin' ? (
            <div className="text-sm text-gray-600">Esta sección requiere rol <span className="font-semibold">admin</span>. Actívalo en “Sesión y rol (desarrollo)” o inicia sesión como admin real.</div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'plantas' && (
                <div>
                  <h3 className="font-medium mb-2">Añadir planta</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="px-3 py-2 rounded border" placeholder="Nombre" value={newPlant.name} onChange={e=>setNewPlant(p=>({ ...p, name: e.target.value }))} />
                    <input className="px-3 py-2 rounded border" placeholder="Ubicación (opcional)" value={newPlant.location} onChange={e=>setNewPlant(p=>({ ...p, location: e.target.value }))} />
                    <input className="px-3 py-2 rounded border" placeholder="Latitud" value={newPlant.latitude} onChange={e=>setNewPlant(p=>({ ...p, latitude: e.target.value }))} />
                    <input className="px-3 py-2 rounded border" placeholder="Longitud" value={newPlant.longitude} onChange={e=>setNewPlant(p=>({ ...p, longitude: e.target.value }))} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-2 rounded border bg-blue-600 text-white" onClick={async()=>{
                      setTabMsg('')
                      try {
                        if (!newPlant.name || !newPlant.latitude || !newPlant.longitude) throw new Error('Completa nombre y coordenadas')
                        const payload = {
                          name: newPlant.name,
                          location: newPlant.location || `${newPlant.latitude}, ${newPlant.longitude}`,
                          latitude: Number(newPlant.latitude),
                          longitude: Number(newPlant.longitude),
                        }
                        const resp = await fetch('/api/plants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                        const json = await resp.json()
                        if (!json.success) throw new Error(json.error || 'Error')
                        setPlants(prev=>[...prev, json.data])
                        setNewPlant({ name: '', location: '', latitude: '', longitude: '' })
                        setTabMsg('Planta creada correctamente')
                      } catch (e:any) {
                        setTabMsg('No se pudo crear la planta: ' + e.message)
                      }
                    }}>Guardar planta</button>
                    <a href="/map" className="px-3 py-2 rounded border">Abrir mapa</a>
                  </div>
                </div>
              )}
              {activeTab === 'mantenimientos' && (
                <div>
                  <h3 className="font-medium mb-2">Programar mantenimiento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="px-3 py-2 rounded border" value={maint.plantId} onChange={e=>setMaint(m=>({ ...m, plantId: e.target.value }))}>
                      <option value="">Selecciona planta</option>
                      {plants.map(pl=> <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                    <select className="px-3 py-2 rounded border" value={maint.type} onChange={e=>setMaint(m=>({ ...m, type: e.target.value as any }))}>
                      <option value="general">General</option>
                      <option value="preventive">Preventivo</option>
                      <option value="corrective">Correctivo</option>
                    </select>
                    <input type="datetime-local" className="px-3 py-2 rounded border" value={maint.scheduledDate} onChange={e=>setMaint(m=>({ ...m, scheduledDate: e.target.value }))} />
                    <input className="px-3 py-2 rounded border" placeholder="Descripción" value={maint.description} onChange={e=>setMaint(m=>({ ...m, description: e.target.value }))} />
                  </div>
                  <button className="mt-2 px-3 py-2 rounded border bg-blue-600 text-white" onClick={async()=>{
                    setTabMsg('')
                    try {
                      if (!maint.plantId || !maint.scheduledDate || !maint.description) throw new Error('Completa planta, fecha y descripción')
                      const payload = { plantId: maint.plantId, type: maint.type, scheduledDate: maint.scheduledDate, description: maint.description }
                      const resp = await fetch('/api/maintenance/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                      const json = await resp.json()
                      if (!json.success) throw new Error(json.error || 'Error')
                      setTabMsg('Mantenimiento programado')
                      setMaint({ plantId: '', type: 'general', scheduledDate: '', description: '' })
                    } catch (e:any) {
                      setTabMsg('No se pudo programar: ' + e.message)
                    }
                  }}>Guardar mantenimiento</button>
                  {/* Listado y edición */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Tareas registradas</h4>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <select className="px-2 py-1 rounded border" value={tasksFilter.plantId} onChange={e=>{ setTasksFilter(prev=>({ ...prev, plantId: e.target.value })); setTasksPage(1) }}>
                        <option value="">Todas las plantas</option>
                        {plants.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select className="px-2 py-1 rounded border" value={tasksFilter.status} onChange={e=>{ setTasksFilter(prev=>({ ...prev, status: e.target.value as any })); setTasksPage(1) }}>
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="completed">Completado</option>
                        <option value="overdue">Atrasado</option>
                      </select>
                      <input type="date" className="px-2 py-1 rounded border" value={tasksFilter.startDate} onChange={e=>{ setTasksFilter(prev=>({ ...prev, startDate: e.target.value })); setTasksPage(1) }} />
                      <input type="date" className="px-2 py-1 rounded border" value={tasksFilter.endDate} onChange={e=>{ setTasksFilter(prev=>({ ...prev, endDate: e.target.value })); setTasksPage(1) }} />
                      <select className="ml-auto px-2 py-1 rounded border" value={tasksPageSize} onChange={e=>{ setTasksPageSize(Number(e.target.value)); setTasksPage(1) }}>
                        <option value={10}>10 por página</option>
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                      </select>
                    </div>
                    {loadingTab ? (
                      <div className="text-sm">Cargando...</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="p-2">Planta</th>
                              <th className="p-2">Tipo</th>
                              <th className="p-2">Programado</th>
                              <th className="p-2">Estado</th>
                              <th className="p-2">Completado</th>
                              <th className="p-2">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasks
                              .filter((t:any)=> (tasksFilter.plantId ? t.plant_id===tasksFilter.plantId : true)
                                && (tasksFilter.status ? t.status===tasksFilter.status : true)
                                && (tasksFilter.startDate ? (t.scheduled_date ? t.scheduled_date.slice(0,10) >= tasksFilter.startDate : false) : true)
                                && (tasksFilter.endDate ? (t.scheduled_date ? t.scheduled_date.slice(0,10) <= tasksFilter.endDate : false) : true))
                              .slice((tasksPage-1)*tasksPageSize, (tasksPage-1)*tasksPageSize + tasksPageSize)
                              .map((t:any)=>(
                              <tr key={t.id} className="border-b">
                                <td className="p-2">{plants.find(p=>p.id===t.plant_id)?.name || t.plant_id}</td>
                                <td className="p-2">{t.task_type}</td>
                                <td className="p-2">
                                  <input type="datetime-local" className="px-2 py-1 rounded border"
                                    value={t.scheduled_date?.slice(0,16) || ''}
                                    onChange={e=>{
                                      const v = e.target.value
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, scheduled_date: v}:x))
                                    }}
                                  />
                                </td>
                                <td className="p-2">
                                  <select className="px-2 py-1 rounded border" value={t.status}
                                    onChange={e=>setTasks(prev=>prev.map(x=>x.id===t.id?{...x, status: e.target.value}:x))}
                                  >
                                    <option value="pending">Pendiente</option>
                                    <option value="completed">Completado</option>
                                    <option value="overdue">Atrasado</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input type="datetime-local" className="px-2 py-1 rounded border"
                                    value={t.completed_date?.slice(0,16) || ''}
                                    onChange={e=>{
                                      const v = e.target.value
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, completed_date: v}:x))
                                    }}
                                  />
                                </td>
                                <td className="p-2">
                                  <button className="px-2 py-1 rounded border mr-2 disabled:opacity-50" disabled={t._saving} onClick={async()=>{
                                    try {
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, _saving: true}:x))
                                      const payload: any = { status: t.status }
                                      if (typeof t.completed_date !== 'undefined') payload.completedDate = t.completed_date || null
                                      if (typeof t.scheduled_date !== 'undefined') payload.scheduledDate = t.scheduled_date
                                      const res = await fetch(`/api/maintenance/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      setTabMsg('Tarea actualizada')
                                    } catch(e:any) {
                                      setTabMsg('No se pudo actualizar: ' + e.message)
                                    } finally {
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, _saving: false}:x))
                                    }
                                  }}>Guardar</button>
                                  <button className="px-2 py-1 rounded border bg-red-600 text-white disabled:opacity-50" disabled={t._deleting} onClick={async()=>{
                                    if (!confirm('¿Eliminar tarea?')) return
                                    try {
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, _deleting: true}:x))
                                      const res = await fetch(`/api/maintenance/tasks/${t.id}`, { method: 'DELETE', credentials: 'include' })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      setTasks(prev=>prev.filter(x=>x.id!==t.id))
                                      setTabMsg('Tarea eliminada')
                                    } catch(e:any) {
                                      setTabMsg('No se pudo eliminar: ' + e.message)
                                    } finally {
                                      setTasks(prev=>prev.map(x=>x.id===t.id?{...x, _deleting: false}:x))
                                    }
                                  }}>Eliminar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <button className="px-2 py-1 rounded border" onClick={()=> setTasksPage(p=> Math.max(1, p-1))}>Anterior</button>
                          <span>Página {tasksPage}</span>
                          <button className="px-2 py-1 rounded border" onClick={()=> setTasksPage(p=> p+1)}>Siguiente</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'analitica' && (
                <div>
                  <h3 className="font-medium mb-2">Registrar analítica inicial</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="px-3 py-2 rounded border" value={baseline.plantId} onChange={e=>setBaseline(b=>({ ...b, plantId: e.target.value }))}>
                      <option value="">Selecciona planta</option>
                      {plants.map(pl=> <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                    <select className="px-3 py-2 rounded border" value={baseline.parameter} onChange={e=>setBaseline(b=>({ ...b, parameter: e.target.value as any }))}>
                      <option value="DQO">DQO</option>
                      <option value="pH">pH</option>
                      <option value="SS">SS</option>
                    </select>
                    <select className="px-3 py-2 rounded border" value={baseline.stream || ''} onChange={e=>setBaseline(b=>({ ...b, stream: (e.target.value || undefined) as any }))}>
                      <option value="">Sin flujo</option>
                      <option value="influent">Afluente</option>
                      <option value="effluent">Efluente</option>
                    </select>
                    <input type="datetime-local" className="px-3 py-2 rounded border" value={baseline.measurementDate} onChange={e=>setBaseline(b=>({ ...b, measurementDate: e.target.value }))} />
                    <input type="number" step="0.01" className="px-3 py-2 rounded border" placeholder="Valor" value={baseline.value} onChange={e=>setBaseline(b=>({ ...b, value: e.target.value }))} />
                  </div>
                  <button className="mt-2 px-3 py-2 rounded border bg-blue-600 text-white" onClick={async()=>{
                    setTabMsg('')
                    try {
                      if (!baseline.plantId || !baseline.measurementDate || !baseline.value) throw new Error('Completa planta, fecha y valor')
                      const payload = { plantId: baseline.plantId, parameter: baseline.parameter, measurementDate: baseline.measurementDate, value: Number(baseline.value), ...(baseline.stream ? { stream: baseline.stream } : {}) }
                      const resp = await fetch('/api/analytics/environmental', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                      const json = await resp.json()
                      if (!json.success) throw new Error(json.error || 'Error')
                      setTabMsg('Analítica registrada')
                      setBaseline({ plantId: '', parameter: 'DQO', stream: 'influent', measurementDate: '', value: '' })
                    } catch (e:any) {
                      setTabMsg('No se pudo registrar: ' + e.message)
                    }
                  }}>Guardar analítica</button>
                  {/* Listado y edición */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Mediciones registradas</h4>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <select className="px-2 py-1 rounded border" value={analyticsFilter.plantId} onChange={e=>{ setAnalyticsFilter(prev=>({ ...prev, plantId: e.target.value })); setAnalyticsPage(1) }}>
                        <option value="">Todas las plantas</option>
                        {plants.map(p=> <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select className="px-2 py-1 rounded border" value={analyticsFilter.parameter} onChange={e=>{ setAnalyticsFilter(prev=>({ ...prev, parameter: e.target.value as any })); setAnalyticsPage(1) }}>
                        <option value="">Todos parámetros</option>
                        <option value="DQO">DQO</option>
                        <option value="pH">pH</option>
                        <option value="SS">SS</option>
                      </select>
                      <select className="px-2 py-1 rounded border" value={analyticsFilter.stream} onChange={e=>{ setAnalyticsFilter(prev=>({ ...prev, stream: e.target.value as any })); setAnalyticsPage(1) }}>
                        <option value="">Cualquier flujo</option>
                        <option value="influent">Afluente</option>
                        <option value="effluent">Efluente</option>
                      </select>
                      <input type="date" className="px-2 py-1 rounded border" value={analyticsFilter.startDate} onChange={e=>{ setAnalyticsFilter(prev=>({ ...prev, startDate: e.target.value })); setAnalyticsPage(1) }} />
                      <input type="date" className="px-2 py-1 rounded border" value={analyticsFilter.endDate} onChange={e=>{ setAnalyticsFilter(prev=>({ ...prev, endDate: e.target.value })); setAnalyticsPage(1) }} />
                      <select className="ml-auto px-2 py-1 rounded border" value={analyticsPageSize} onChange={e=>{ setAnalyticsPageSize(Number(e.target.value)); setAnalyticsPage(1) }}>
                        <option value={10}>10 por página</option>
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                      </select>
                    </div>
                    {loadingTab ? (
                      <div className="text-sm">Cargando...</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="p-2">Planta</th>
                              <th className="p-2">Parámetro</th>
                              <th className="p-2">Fecha</th>
                              <th className="p-2">Flujo</th>
                              <th className="p-2">Valor</th>
                              <th className="p-2">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {envRows
                              .slice((analyticsPage-1)*analyticsPageSize, (analyticsPage-1)*analyticsPageSize + analyticsPageSize)
                              .map((r:any, idx:number)=>(
                              <tr key={r.id || idx} className="border-b">
                                <td className="p-2">{plants.find(p=>p.id===r.plant_id)?.name || r.plant_id}</td>
                                <td className="p-2">
                                  <select className="px-2 py-1 rounded border" value={r.parameter_type}
                                    onChange={e=>{
                                      const v = e.target.value
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, parameter_type: v } : x))
                                    }}
                                  >
                                    <option value="DQO">DQO</option>
                                    <option value="pH">pH</option>
                                    <option value="SS">SS</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input type="datetime-local" className="px-2 py-1 rounded border"
                                    value={r.measurement_date?.slice(0,16) || ''}
                                    onChange={e=>{
                                      const v = e.target.value
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, measurement_date: v } : x))
                                    }}
                                  />
                                </td>
                                <td className="p-2">
                                  <select className="px-2 py-1 rounded border" value={r.stream ?? ''}
                                    onChange={e=>{
                                      const v = e.target.value || undefined
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, stream: v } : x))
                                    }}
                                  >
                                    <option value="">-</option>
                                    <option value="influent">Afluente</option>
                                    <option value="effluent">Efluente</option>
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input type="number" step="0.01" className="px-2 py-1 rounded border w-28" value={r.value}
                                    onChange={e=>{
                                      const v = e.target.value
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, value: v } : x))
                                    }}
                                  />
                                </td>
                                <td className="p-2">
                                  <button className="px-2 py-1 rounded border mr-2 disabled:opacity-50" disabled={r._saving} onClick={async()=>{
                                    try {
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, _saving: true } : x))
                                      const payload: any = { plantId: r.plant_id, parameter: r.parameter_type, measurementDate: r.measurement_date, value: Number(r.value) }
                                      if (typeof r.stream !== 'undefined') payload.stream = r.stream
                                      const res = await fetch('/api/analytics/environmental', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      const changed = r._original && (r._original.parameter_type !== r.parameter_type || r._original.measurement_date !== r.measurement_date || r._original.stream !== r.stream)
                                      if (changed && r.id) {
                                        try {
                                          await fetch(`/api/analytics/environmental/${r.id}`, { method: 'DELETE', credentials: 'include' })
                                        } catch {}
                                      }
                                      setTabMsg('Medición actualizada')
                                      setAnalyticsFilter(prev=> ({ ...prev }))
                                    } catch(e:any) {
                                      setTabMsg('No se pudo actualizar: ' + e.message)
                                    } finally {
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, _saving: false } : x))
                                    }
                                  }}>Guardar</button>
                                  <button className="px-2 py-1 rounded border bg-red-600 text-white disabled:opacity-50" disabled={r._deleting} onClick={async()=>{
                                    if (!confirm('¿Eliminar medición?')) return
                                    try {
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, _deleting: true } : x))
                                      const res = await fetch(`/api/analytics/environmental/${r.id}`, { method: 'DELETE', credentials: 'include' })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      setEnvRows(prev=>prev.filter((x:any)=> x.id !== r.id))
                                      setTabMsg('Medición eliminada')
                                    } catch(e:any) {
                                      setTabMsg('No se pudo eliminar: ' + e.message)
                                    } finally {
                                      setEnvRows(prev=>prev.map((x,i)=> i===idx ? { ...x, _deleting: false } : x))
                                    }
                                  }}>Eliminar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <button className="px-2 py-1 rounded border" onClick={()=> setAnalyticsPage(p=> Math.max(1, p-1))}>Anterior</button>
                          <span>Página {analyticsPage}</span>
                          <button className="px-2 py-1 rounded border" onClick={()=> setAnalyticsPage(p=> p+1)}>Siguiente</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === 'coordenadas' && (
                <div>
                  <h3 className="font-medium mb-2">Actualizar coordenadas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select className="px-3 py-2 rounded border" value={coord.plantId} onChange={e=>setCoord(c=>({ ...c, plantId: e.target.value }))}>
                      <option value="">Selecciona planta</option>
                      {plants.map(pl=> <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                    </select>
                    <input className="px-3 py-2 rounded border" placeholder="Latitud" value={coord.latitude} onChange={e=>setCoord(c=>({ ...c, latitude: e.target.value }))} />
                    <input className="px-3 py-2 rounded border" placeholder="Longitud" value={coord.longitude} onChange={e=>setCoord(c=>({ ...c, longitude: e.target.value }))} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-2 rounded border bg-blue-600 text-white" onClick={async()=>{
                      setTabMsg('')
                      try {
                        if (!coord.plantId || !coord.latitude || !coord.longitude) throw new Error('Completa planta y coordenadas')
                        const payload = { latitude: Number(coord.latitude), longitude: Number(coord.longitude) }
                        const resp = await fetch(`/api/plants/${coord.plantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                        const json = await resp.json()
                        if (!json.success) throw new Error(json.error || 'Error')
                        setPlants(prev=>prev.map(p=> p.id===coord.plantId ? json.data : p))
                        setTabMsg('Coordenadas actualizadas')
                        setCoord({ plantId: '', latitude: '', longitude: '' })
                      } catch (e:any) {
                        setTabMsg('No se pudo actualizar: ' + e.message)
                      }
                    }}>Guardar coordenadas</button>
                    <a href="/map" className="px-3 py-2 rounded border">Abrir mapa</a>
                  </div>
                  {/* Listado y edición de plantas */}
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Plantas registradas</h4>
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <input className="px-2 py-1 rounded border" placeholder="Buscar por nombre/ubicación" value={plantsQuery} onChange={e=>{ setPlantsQuery(e.target.value); setPlantsPage(1) }} />
                      <select className="ml-auto px-2 py-1 rounded border" value={plantsPageSize} onChange={e=>{ setPlantsPageSize(Number(e.target.value)); setPlantsPage(1) }}>
                        <option value={10}>10 por página</option>
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                      </select>
                    </div>
                    {loadingTab ? (
                      <div className="text-sm">Cargando...</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left border-b">
                              <th className="p-2">Nombre</th>
                              <th className="p-2">Ubicación</th>
                              <th className="p-2">Latitud</th>
                              <th className="p-2">Longitud</th>
                              <th className="p-2">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plants
                              .filter((p:any)=>{
                                const q = plantsQuery.trim().toLowerCase()
                                if (!q) return true
                                return (p.name?.toLowerCase().includes(q) || p.location?.toLowerCase().includes(q))
                              })
                              .slice((plantsPage-1)*plantsPageSize, (plantsPage-1)*plantsPageSize + plantsPageSize)
                              .map((p:any)=>(
                              <tr key={p.id} className="border-b">
                                <td className="p-2">
                                  <input className="px-2 py-1 rounded border" value={p.name} onChange={e=>setPlants(prev=>prev.map(x=>x.id===p.id?{...x, name: e.target.value}:x))} />
                                </td>
                                <td className="p-2">
                                  <input className="px-2 py-1 rounded border" value={p.location || ''} onChange={e=>setPlants(prev=>prev.map(x=>x.id===p.id?{...x, location: e.target.value}:x))} />
                                </td>
                                <td className="p-2">
                                  <input className="px-2 py-1 rounded border w-28" value={p.latitude ?? ''} onChange={e=>setPlants(prev=>prev.map(x=>x.id===p.id?{...x, latitude: e.target.value}:x))} />
                                </td>
                                <td className="p-2">
                                  <input className="px-2 py-1 rounded border w-28" value={p.longitude ?? ''} onChange={e=>setPlants(prev=>prev.map(x=>x.id===p.id?{...x, longitude: e.target.value}:x))} />
                                </td>
                                <td className="p-2">
                                  <button className="px-2 py-1 rounded border mr-2 disabled:opacity-50" disabled={p._saving} onClick={async()=>{
                                    try {
                                      setPlants(prev=>prev.map(x=>x.id===p.id?{...x, _saving: true}:x))
                                      const payload: any = {}
                                      if (typeof p.name !== 'undefined') payload.name = p.name
                                      if (typeof p.location !== 'undefined') payload.location = p.location
                                      if (typeof p.latitude !== 'undefined') payload.latitude = Number(p.latitude)
                                      if (typeof p.longitude !== 'undefined') payload.longitude = Number(p.longitude)
                                      const res = await fetch(`/api/plants/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      setTabMsg('Planta actualizada')
                                    } catch(e:any) {
                                      setTabMsg('No se pudo actualizar: ' + e.message)
                                    } finally {
                                      setPlants(prev=>prev.map(x=>x.id===p.id?{...x, _saving: false}:x))
                                    }
                                  }}>Guardar</button>
                                  <button className="px-2 py-1 rounded border bg-red-600 text-white disabled:opacity-50" disabled={p._deleting} onClick={async()=>{
                                    if (!confirm('¿Eliminar planta?')) return
                                    try {
                                      setPlants(prev=>prev.map(x=>x.id===p.id?{...x, _deleting: true}:x))
                                      const res = await fetch(`/api/plants/${p.id}`, { method: 'DELETE', credentials: 'include' })
                                      const json = await res.json()
                                      if (!json.success) throw new Error(json.error || 'Error')
                                      setPlants(prev=>prev.filter(x=>x.id!==p.id))
                                      setTabMsg('Planta eliminada')
                                    } catch(e:any) {
                                      setTabMsg('No se pudo eliminar: ' + e.message)
                                    } finally {
                                      setPlants(prev=>prev.map(x=>x.id===p.id?{...x, _deleting: false}:x))
                                    }
                                  }}>Eliminar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <button className="px-2 py-1 rounded border" onClick={()=> setPlantsPage(p=> Math.max(1, p-1))}>Anterior</button>
                          <span>Página {plantsPage}</span>
                          <button className="px-2 py-1 rounded border" onClick={()=> setPlantsPage(p=> p+1)}>Siguiente</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tabMsg && <div className="text-sm">{tabMsg}</div>}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded border p-4">
          <h2 className="text-lg font-medium mb-3">Editar analíticas ambientales</h2>
          <div className="space-y-3">
            <label className="block text-sm">Planta</label>
            <select value={plantId} onChange={e=>setPlantId(e.target.value)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800">
              <option value="">Selecciona planta</option>
              {plants.map(pl=> <option key={pl.id} value={pl.id}>{pl.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Parámetro</label>
                <select value={parameter} onChange={e=>setParameter(e.target.value as any)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800">
                  <option value="DQO">DQO</option>
                  <option value="pH">pH</option>
                  <option value="SS">SS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm">Flujo</label>
                <select value={stream} onChange={e=>setStream(e.target.value as any)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800">
                  <option value="influent">Afluente</option>
                  <option value="effluent">Efluente</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm">Fecha de medición</label>
                <input type="datetime-local" value={measurementDate} onChange={e=>setMeasurementDate(e.target.value)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-sm">Valor</label>
                <input type="number" step="0.01" value={value} onChange={e=>setValue(e.target.value)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800" />
              </div>
            </div>
            <button disabled={saving || !plantId || !measurementDate} onClick={saveMeasurement} className="px-3 py-2 rounded border bg-blue-600 text-white disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar medición'}
            </button>
            <button disabled={saving || !plantId || !measurementDate} onClick={deleteMeasurement} className="ml-2 px-3 py-2 rounded border bg-red-600 text-white disabled:opacity-50">
              {saving ? 'Eliminando...' : 'Eliminar medición'}
            </button>
            {message && <div className="text-sm mt-2">{message}</div>}
            <div className="text-xs text-yellow-700 bg-yellow-50 border rounded p-2">
              Nota: requiere configurar Supabase en el servidor para persistencia. Si no está disponible, se usa almacenamiento local de demostración para estas acciones.
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded border p-4">
          <h2 className="text-lg font-medium mb-3">Crear usuario</h2>
          <div className="space-y-3">
            <input className="w-full px-3 py-2 rounded border" type="email" placeholder="Email" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} />
            <input className="w-full px-3 py-2 rounded border" type="text" placeholder="Nombre" value={newUserName} onChange={e=>setNewUserName(e.target.value)} />
            <input className="w-full px-3 py-2 rounded border" type="password" placeholder="Contraseña (mín. 8)" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)} />
            <div>
              <label className="block text-sm">Rol</label>
              <select value={newUserRole} onChange={e=>setNewUserRole(e.target.value as any)} className="px-3 py-2 rounded border w-full bg-white dark:bg-gray-800">
                <option value="standard">Standard</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {userMessage && <div className="text-sm">{userMessage}</div>}
            <button
              disabled={creatingUser || !newUserEmail || !newUserName || !newUserPassword}
              className="px-3 py-2 rounded border bg-emerald-600 text-white disabled:opacity-50"
              onClick={async ()=>{
                setCreatingUser(true)
                setUserMessage('')
                try {
                  const resp = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email: newUserEmail, password: newUserPassword, name: newUserName, role: newUserRole })
                  })
                  const json = await resp.json()
                  if (!json.success) throw new Error(json.error || 'Error')
                  setUserMessage(`Usuario creado: ${json.user?.email || newUserEmail}`)
                  setNewUserEmail('')
                  setNewUserName('')
                  setNewUserPassword('')
                  setNewUserRole('standard')
                } catch (e: any) {
                  setUserMessage('No se pudo crear el usuario: ' + e.message)
                } finally {
                  setCreatingUser(false)
                }
              }}
            >
              {creatingUser ? 'Creando...' : 'Crear usuario'}
            </button>
            <div className="text-xs text-yellow-700 bg-yellow-50 border rounded p-2">
              Nota: en producción se recomienda proteger la creación de usuarios con flujos administrativos y verificación adicional. En desarrollo puede usarse libremente.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}