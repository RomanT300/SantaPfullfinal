/**
 * Emergencies Page - Real-time emergency management
 * Shows emergencies reported from mobile app and admin panel
 * Supports auto-refresh for real-time updates
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Filter,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Smartphone,
  Monitor,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Factory,
  MailCheck,
} from 'lucide-react'

type Emergency = {
  id: string
  plant_id: string
  plant_name?: string
  reason: string
  solved: boolean
  resolve_time_hours?: number
  reported_at: string
  severity?: 'low' | 'medium' | 'high'
  resolved_at?: string
  resolved_by?: string
  observations?: string
  operator_name?: string
  operator_id?: string
  location_description?: string
  source?: 'admin' | 'mobile'
  email_sent?: boolean
  acknowledged_at?: string
  acknowledged_by?: string
}

type PlantOption = { id: string; name: string }

const severityConfig = {
  high: { label: 'Alta', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400', icon: '🔴', priority: 3 },
  medium: { label: 'Media', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400', icon: '🟡', priority: 2 },
  low: { label: 'Baja', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400', icon: '🟢', priority: 1 },
}

const Emergencies: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [emergencies, setEmergencies] = useState<Emergency[]>([])
  const [plants, setPlants] = useState<PlantOption[]>([])
  const [plantsFallback, setPlantsFallback] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedPlants, setSelectedPlants] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'mobile' | 'admin'>('all')

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    emergencies.forEach(e => {
      const y = new Date(e.reported_at).getFullYear()
      years.add(y)
    })
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [emergencies])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const json = await res.json()
          setIsAdmin((json?.user?.role) === 'admin')
        }
      } catch (_) {
        // ignore
      }
    })()
  }, [])

  useEffect(() => {
    const loadPlants = async () => {
      try {
        const res = await fetch('/api/plants', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load plants')
        const data = await res.json()
        const mapped: PlantOption[] = (data?.data || []).map((p: any) => ({ id: p.id, name: p.name })) || []
        setPlants(mapped)
        setPlantsFallback(false)
        if (mapped.length && selectedPlants.length === 0) setSelectedPlants(mapped.map(p => p.id))
      } catch (err) {
        let rows: Emergency[] = []
        try {
          const cached = localStorage.getItem('emergencies_cache')
          if (cached) rows = JSON.parse(cached)
        } catch {}
        if (!rows || rows.length === 0) {
          try {
            const res2 = await fetch('/api/maintenance/emergencies', { credentials: 'include' })
            if (res2.ok) {
              const json2 = await res2.json()
              rows = json2?.data || []
            }
          } catch {}
        }
        const ids = Array.from(new Set((rows || []).map(r => r.plant_id).filter(Boolean)))
        const options: PlantOption[] = ids.map(id => ({ id, name: (rows.find(r => r.plant_id === id)?.plant_name) || id }))
        if (options.length > 0) {
          setPlants(options)
          setPlantsFallback(true)
          if (selectedPlants.length === 0) setSelectedPlants(options.map(p => p.id))
        }
      }
    }
    loadPlants()
  }, [])

  const loadEmergencies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/maintenance/emergencies', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load emergencies')
      const data = await res.json()
      const rows: Emergency[] = data?.data || []
      setEmergencies(rows)
      setLastRefresh(new Date())
      localStorage.setItem('emergencies_cache', JSON.stringify(rows))
    } catch (err) {
      const cached = localStorage.getItem('emergencies_cache')
      if (cached) {
        setEmergencies(JSON.parse(cached))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmergencies()
  }, [loadEmergencies])

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      loadEmergencies()
    }, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadEmergencies])

  const filteredEmergencies = useMemo(() => {
    return emergencies.filter(e => {
      const y = new Date(e.reported_at).getFullYear()
      if (y !== selectedYear) return false
      if (selectedPlants.length > 0 && !selectedPlants.includes(e.plant_id)) return false
      if (statusFilter === 'pending' && e.solved) return false
      if (statusFilter === 'resolved' && !e.solved) return false
      if (sourceFilter === 'mobile' && e.source !== 'mobile') return false
      if (sourceFilter === 'admin' && e.source !== 'admin' && e.source !== undefined) return false
      return true
    }).sort((a, b) => {
      if (a.solved !== b.solved) return a.solved ? 1 : -1
      const aSev = severityConfig[a.severity || 'medium'].priority
      const bSev = severityConfig[b.severity || 'medium'].priority
      if (aSev !== bSev) return bSev - aSev
      return new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime()
    })
  }, [emergencies, selectedYear, selectedPlants, statusFilter, sourceFilter])

  const stats = useMemo(() => {
    const total = filteredEmergencies.length
    const pending = filteredEmergencies.filter(e => !e.solved).length
    const resolved = filteredEmergencies.filter(e => e.solved).length
    const fromMobile = filteredEmergencies.filter(e => e.source === 'mobile').length
    const high = filteredEmergencies.filter(e => e.severity === 'high' && !e.solved).length
    return { total, pending, resolved, fromMobile, high }
  }, [filteredEmergencies])

  const [newEm, setNewEm] = useState<{
    plant_id: string
    reason: string
    solved: boolean
    resolveTimeHours?: number
    severity?: 'low' | 'medium' | 'high'
    reportedAt?: string
    resolvedAt?: string
    observations?: string
  }>({
    plant_id: '',
    reason: '',
    solved: false,
    resolveTimeHours: undefined,
    severity: 'medium',
    reportedAt: undefined,
    resolvedAt: undefined,
    observations: undefined,
  })

  const createEmergency = async () => {
    if (!newEm.plant_id || !newEm.reason) return
    try {
      const res = await fetch('/api/maintenance/emergencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plantId: newEm.plant_id,
          reason: newEm.reason,
          solved: newEm.solved,
          resolveTimeHours: newEm.resolveTimeHours,
          severity: newEm.severity,
          reportedAt: newEm.reportedAt,
          resolvedAt: newEm.resolvedAt,
          observations: newEm.observations,
        }),
      })
      if (!res.ok) throw new Error('Failed to create emergency')
      await loadEmergencies()
      setNewEm({ plant_id: '', reason: '', solved: false, resolveTimeHours: undefined, severity: 'medium', reportedAt: undefined, resolvedAt: undefined, observations: undefined })
    } catch (err) {
      console.error('Error creating emergency:', err)
    }
  }

  const updateEmergency = async (id: string, patch: Partial<Emergency>) => {
    try {
      const body: any = {}
      if (patch.plant_id !== undefined) body.plantId = patch.plant_id
      if (patch.reason !== undefined) body.reason = patch.reason
      if (patch.solved !== undefined) body.solved = patch.solved
      if (patch.resolve_time_hours !== undefined) body.resolveTimeHours = patch.resolve_time_hours
      if (patch.severity !== undefined) body.severity = patch.severity
      if (patch.resolved_at !== undefined) body.resolvedAt = patch.resolved_at
      if (patch.resolved_by !== undefined) body.resolvedBy = patch.resolved_by
      if (patch.observations !== undefined) body.observations = patch.observations

      const res = await fetch(`/api/maintenance/emergencies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) {
        console.error('Update failed:', json.error)
        alert('Error al actualizar: ' + (json.error || 'Unknown error'))
        return
      }
      setEmergencies(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
    } catch (err) {
      console.error('Update error:', err)
      alert('Error al actualizar emergencia')
    }
  }

  const acknowledgeEmergency = async (id: string) => {
    try {
      const res = await fetch(`/api/maintenance/emergencies/${id}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        await loadEmergencies()
      }
    } catch (err) {
      console.error('Error acknowledging emergency:', err)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl shadow-lg">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emergencias</h1>
                <p className="text-sm text-gray-500">
                  Última actualización: {lastRefresh.toLocaleTimeString('es-EC')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  autoRefresh
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {autoRefresh ? <Bell size={16} /> : <BellOff size={16} />}
                {autoRefresh ? 'Auto ON' : 'Auto OFF'}
              </button>
              <button
                onClick={loadEmergencies}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-red-500">
            <div className="text-sm text-gray-500">Pendientes</div>
            <div className="text-2xl font-bold text-red-600">{stats.pending}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-green-500">
            <div className="text-sm text-gray-500">Resueltas</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Smartphone size={14} /> App Móvil
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.fromMobile}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-orange-500">
            <div className="text-sm text-gray-500">Urgentes</div>
            <div className="text-2xl font-bold text-orange-600">{stats.high}</div>
          </div>
        </div>
      </div>

      {plants.length === 0 && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
            No hay plantas registradas. Regístralas en <a href="/admin" className="underline">Admin</a>.
          </div>
        </div>
      )}

      {plantsFallback && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            Plantas cargadas desde emergencias por conexión limitada.
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
          <Filter size={18} className="text-gray-400" />

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="resolved">Resueltas</option>
          </select>

          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="all">Todas las fuentes</option>
            <option value="mobile">📱 App Móvil</option>
            <option value="admin">💻 Admin</option>
          </select>

          <select
            multiple
            value={selectedPlants}
            onChange={e => {
              const options = Array.from(e.target.selectedOptions).map(o => o.value)
              setSelectedPlants(options)
            }}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm min-w-[200px] h-20 text-gray-700 dark:text-gray-200"
          >
            {plants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Admin Form */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Monitor size={18} />
              Registrar Emergencia (Admin)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Planta</label>
                <select
                  value={newEm.plant_id}
                  onChange={e => setNewEm(s => ({ ...s, plant_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccione planta</option>
                  {plants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
                <input
                  type="text"
                  value={newEm.reason}
                  onChange={e => setNewEm(s => ({ ...s, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Descripción de la emergencia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severidad</label>
                <select
                  value={newEm.severity || 'medium'}
                  onChange={e => setNewEm(s => ({ ...s, severity: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="low">🟢 Baja</option>
                  <option value="medium">🟡 Media</option>
                  <option value="high">🔴 Alta</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
                <textarea
                  value={newEm.observations ?? ''}
                  onChange={e => setNewEm(s => ({ ...s, observations: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={2}
                  placeholder="Detalles adicionales..."
                />
              </div>
              <div>
                <button
                  onClick={createEmergency}
                  disabled={!newEm.plant_id || !newEm.reason}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Registrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergencies List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Emergencias ({filteredEmergencies.length})
            </h2>
          </div>

          {loading && emergencies.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 mx-auto text-gray-400 animate-spin mb-2" />
              <p className="text-gray-500">Cargando emergencias...</p>
            </div>
          ) : filteredEmergencies.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No hay emergencias con los filtros seleccionados</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredEmergencies.map(e => {
                const sev = severityConfig[e.severity || 'medium']
                const isExpanded = expandedIds.has(e.id)
                const isMobile = e.source === 'mobile'

                return (
                  <div
                    key={e.id}
                    className={`p-4 transition-colors ${
                      !e.solved ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <div
                      className="flex items-start gap-4 cursor-pointer"
                      onClick={() => toggleExpanded(e.id)}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">{sev.icon}</span>
                        {isMobile && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 rounded">
                            📱
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>
                            {sev.label}
                          </span>
                          {!e.solved && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                              Pendiente
                            </span>
                          )}
                          {e.solved && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle size={12} /> Resuelta
                            </span>
                          )}
                          {e.email_sent && (
                            <MailCheck size={14} className="text-green-500" title="Email enviado" />
                          )}
                        </div>

                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {e.reason}
                        </h3>

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Factory size={14} />
                            {e.plant_name || plants.find(p => p.id === e.plant_id)?.name || e.plant_id}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {new Date(e.reported_at).toLocaleString('es-EC')}
                          </span>
                          {e.operator_name && (
                            <span className="flex items-center gap-1">
                              <User size={14} />
                              {e.operator_name}
                            </span>
                          )}
                          {e.location_description && (
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {e.location_description}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center text-gray-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pl-12 space-y-4">
                        {e.observations && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Observaciones</label>
                            <p className="text-gray-700 dark:text-gray-300">{e.observations}</p>
                          </div>
                        )}

                        {isAdmin && (
                          <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                              <select
                                value={e.solved ? 'true' : 'false'}
                                onChange={ev => updateEmergency(e.id, { solved: ev.target.value === 'true' })}
                                className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="false">Pendiente</option>
                                <option value="true">Resuelta</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Severidad</label>
                              <select
                                value={e.severity || 'medium'}
                                onChange={ev => updateEmergency(e.id, { severity: ev.target.value as any })}
                                className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Tiempo (h)</label>
                              <input
                                type="number"
                                min={0}
                                value={e.resolve_time_hours ?? ''}
                                onChange={ev => updateEmergency(e.id, { resolve_time_hours: ev.target.value ? Number(ev.target.value) : undefined })}
                                className="px-2 py-1 text-sm border rounded w-20 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Resuelto por</label>
                              <input
                                type="text"
                                value={e.resolved_by ?? ''}
                                onChange={ev => updateEmergency(e.id, { resolved_by: ev.target.value || undefined })}
                                placeholder="Nombre del responsable"
                                className="px-2 py-1 text-sm border rounded w-40 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            {!e.acknowledged_at && isMobile && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Acciones</label>
                                <button
                                  onClick={() => acknowledgeEmergency(e.id)}
                                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Confirmar recepción
                                </button>
                              </div>
                            )}
                            {e.acknowledged_at && (
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Confirmado</label>
                                <span className="text-sm text-green-600">
                                  ✓ {e.acknowledged_by}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {(e.resolved_at || e.resolved_by) && (
                          <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                            {e.resolved_at && (
                              <span>Resuelta: {new Date(e.resolved_at).toLocaleString('es-EC')}</span>
                            )}
                            {e.resolve_time_hours && (
                              <span className="text-gray-400">({e.resolve_time_hours}h)</span>
                            )}
                            {e.resolved_by && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <User size={14} /> {e.resolved_by}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Emergencies
