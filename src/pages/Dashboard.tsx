import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Brush, ReferenceLine, ReferenceArea } from 'recharts'
import { Download } from 'lucide-react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type Row = { measurement_date: string; value: number; parameter_type: string }
type AnalyticRecord = {
  id: string
  plant_id: string
  parameter_type: 'DQO' | 'pH' | 'SS'
  measurement_date: string
  value: number
  unit: string
  stream?: 'influent' | 'effluent' | null
}

export default function Dashboard() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [selectedParams, setSelectedParams] = useState<string[]>(['DQO'])
  const [plantId, setPlantId] = useState<string>('')
  const [plants, setPlants] = useState<{id:string;name:string}[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [kpis, setKpis] = useState<Record<string, { count: number; avg: number; min: number; max: number }>>({})
  const [flowMode, setFlowMode] = useState<'single'|'split'>( 'split' )
  const [streamFilter, setStreamFilter] = useState<'both'|'influent'|'effluent'>('both')

  // Estados para gestión de analíticas
  const [showManagement, setShowManagement] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticRecord[]>([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [newRecord, setNewRecord] = useState<Partial<AnalyticRecord>>({
    plant_id: '',
    parameter_type: 'DQO',
    measurement_date: new Date().toISOString().slice(0, 10),
    value: 0,
    unit: 'mg/L',
    stream: null,
  })

  // Actualizar plant_id del nuevo registro cuando cambia la planta seleccionada
  useEffect(() => {
    if (plantId) {
      setNewRecord(prev => ({ ...prev, plant_id: plantId }))
    }
  }, [plantId])

  useEffect(() => {
    // fetch plants for filter
    fetch('/api/plants', { credentials: 'include' })
      .then(r=>r.json()).then(json=>{ if(json.success && json.data?.length) { setPlants(json.data.map((p:any)=>({id:p.id,name:p.name}))) } else { throw new Error('no data') } })
      .catch(()=>{
        // fallback de plantas conocidas
        setPlants([
          { id: 'LA LUZ', name: 'LA LUZ' },
          { id: 'TAURA', name: 'TAURA' },
          { id: 'SANTA MONICA', name: 'SANTA MONICA' },
          { id: 'SAN DIEGO', name: 'SAN DIEGO' },
          { id: 'CHANDUY', name: 'CHANDUY' },
        ])
      })

    // Check admin role
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(json => setIsAdmin(json?.user?.role === 'admin'))
      .catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    setLoading(true)
    const isAllPlants = plantId === ''
    const fetchParam = (param: string, stream?: 'influent'|'effluent') => {
      const qs = new URLSearchParams({ parameter: param, ...(plantId ? { plantId } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(stream ? { stream } : {}) }).toString()
      const url = `/api/analytics/environmental?${qs}`
      return fetch(url, { credentials: 'include' })
        .then(r => r.json())
        .then(json => {
          if (!json.success) throw new Error(json.error || 'Error')
          return json.data || []
        })
        .catch(() => {
          // Si falla, devolvemos array vacío para activar fallback
          return []
        })
    }
    const fetchList: Array<{param:string;stream?:'influent'|'effluent'}> = (() => {
      if (flowMode === 'split') {
        if (streamFilter === 'influent') return [{ param: selectedParams[0], stream: 'influent' }]
        if (streamFilter === 'effluent') return [{ param: selectedParams[0], stream: 'effluent' }]
        return [
          { param: selectedParams[0], stream: 'influent' },
          { param: selectedParams[0], stream: 'effluent' }
        ]
      }
      return [{ param: selectedParams[0] }]
    })()
    Promise.all(fetchList.map(item => fetchParam(item.param, item.stream)))
      .then(results => {
        const anyEmpty = results.every(arr => (arr as any[]).length === 0)
        setUsingDemo(anyEmpty)
        setError(null)
        const allDates = new Set<string>()
        results.forEach(arr => arr.forEach((row: any) => allDates.add(row.measurement_date)))
        let dates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        if (dates.length === 0) {
          // fallback mensual de 12 muestras por planta
          const now = new Date()
          const months = 12
          dates = Array.from({ length: months }).map((_, i) => {
            const d = new Date(now); d.setMonth(now.getMonth() - (months - 1 - i)); d.setDate(15); return d.toISOString()
          })
        }
        let merged: any[] = []
        if (isAllPlants) {
          const p = selectedParams[0]
          const plantNameById: Record<string, string> = {}
          plants.forEach(pl=>{ plantNameById[pl.id] = pl.name })

          if (flowMode === 'split') {
            const arrInfluent = results[0]
            const arrEffluent = results[1]
            const seriesInfluentByPlant: Record<string, Record<string, number>> = {}
            const seriesEffluentByPlant: Record<string, Record<string, number>> = {}
            const baseByPlant: Record<string, { DQO: number; pH: number; SS: number }> = {
              'LA LUZ': { DQO: 110, pH: 7.3, SS: 70 },
              'TAURA': { DQO: 125, pH: 7.4, SS: 80 },
              'SANTA MONICA': { DQO: 95, pH: 7.2, SS: 65 },
              'SAN DIEGO': { DQO: 130, pH: 7.5, SS: 85 },
              'CHANDUY': { DQO: 105, pH: 7.3, SS: 75 },
            }
            if (arrInfluent && arrInfluent.length) {
              arrInfluent.forEach((row: any) => {
                const name = plantNameById[row.plant_id] || row.plant_id || 'Planta'
                seriesInfluentByPlant[name] = seriesInfluentByPlant[name] || {}
                seriesInfluentByPlant[name][row.measurement_date] = row.value
              })
            }
            if (arrEffluent && arrEffluent.length) {
              arrEffluent.forEach((row: any) => {
                const name = plantNameById[row.plant_id] || row.plant_id || 'Planta'
                seriesEffluentByPlant[name] = seriesEffluentByPlant[name] || {}
                seriesEffluentByPlant[name][row.measurement_date] = row.value
              })
            }
            // Fallback demo si vacío
            if ((!arrInfluent || !arrInfluent.length) && (!arrEffluent || !arrEffluent.length)) {
              plants.forEach(pl => {
                const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                seriesInfluentByPlant[pl.name] = {}
                seriesEffluentByPlant[pl.name] = {}
                dates.forEach((d, i) => {
                  const season = Math.sin((i / dates.length) * Math.PI * 2)
                  const baseInfl = p === 'DQO' ? 1000 : p === 'SS' ? (bases.SS || 100) : (bases.pH || 7.3)
                  const baseEffl = p === 'DQO' ? 180 : p === 'SS' ? (bases.SS ? Math.max(30, bases.SS * 0.5) : 40) : (bases.pH || 7.3)
                  const jitterInfl = p === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 40 - 20)
                  const jitterEffl = p === 'pH' ? (Math.random() * 0.2 - 0.1) : (Math.random() * 20 - 10)
                  const valInfl = p === 'pH' ? (baseInfl + season * 0.15 + jitterInfl) : (baseInfl + season * 50 + jitterInfl)
                  const valEffl = p === 'pH' ? (baseEffl + season * 0.1 + jitterEffl) : (baseEffl + season * 20 + jitterEffl)
                  seriesInfluentByPlant[pl.name][d] = Math.max(0, Math.round(valInfl * 100)/100)
                  seriesEffluentByPlant[pl.name][d] = Math.max(0, Math.round(valEffl * 100)/100)
                })
              })
            }
            merged = dates.map(d => {
              const obj: any = { measurement_date: d }
              const names = new Set([...Object.keys(seriesInfluentByPlant), ...Object.keys(seriesEffluentByPlant)])
              names.forEach(name => {
                if (streamFilter !== 'effluent') {
                  obj[`${name} (afluente)`] = seriesInfluentByPlant[name]?.[d] ?? null
                }
                if (streamFilter !== 'influent') {
                  obj[`${name} (efluente)`] = seriesEffluentByPlant[name]?.[d] ?? null
                }
              })
              return obj
            })
          } else {
            const arr = results[0]
            const seriesByPlant: Record<string, Record<string, number>> = {}
            if (arr && arr.length) {
              arr.forEach((row: any) => {
                const name = plantNameById[row.plant_id] || row.plant_id || 'Planta'
                seriesByPlant[name] = seriesByPlant[name] || {}
                seriesByPlant[name][row.measurement_date] = row.value
              })
            } else {
              // Generar líneas por planta (mock) usando estacionalidad por planta
              const baseByPlant: Record<string, { DQO: number; pH: number; SS: number }> = {
                'LA LUZ': { DQO: 110, pH: 7.3, SS: 70 },
                'TAURA': { DQO: 125, pH: 7.4, SS: 80 },
                'SANTA MONICA': { DQO: 95, pH: 7.2, SS: 65 },
                'SAN DIEGO': { DQO: 130, pH: 7.5, SS: 85 },
                'CHANDUY': { DQO: 105, pH: 7.3, SS: 75 },
              }
              plants.forEach(pl => {
                const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                seriesByPlant[pl.name] = {}
                dates.forEach((d, i) => {
                  const season = Math.sin((i / dates.length) * Math.PI * 2)
                  const base = p === 'DQO' ? bases.DQO : p === 'SS' ? bases.SS : bases.pH
                  const jitter = p === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 10 - 5)
                  const val = p === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 10 + jitter)
                  seriesByPlant[pl.name][d] = Math.max(0, Math.round(val * 100)/100)
                })
              })
            }
            merged = dates.map(d => {
              const obj: any = { measurement_date: d }
              Object.keys(seriesByPlant).forEach(name => { obj[name] = seriesByPlant[name][d] ?? null })
              return obj
            })
          }
        } else {
          const plantName = plants.find(pl=>pl.id===plantId)?.name || plantId || 'LA LUZ'
          const baseByPlant: Record<string, { DQO: number; pH: number; SS: number }> = {
            'LA LUZ': { DQO: 110, pH: 7.3, SS: 70 },
            'TAURA': { DQO: 125, pH: 7.4, SS: 80 },
            'SANTA MONICA': { DQO: 95, pH: 7.2, SS: 65 },
            'SAN DIEGO': { DQO: 130, pH: 7.5, SS: 85 },
            'CHANDUY': { DQO: 105, pH: 7.3, SS: 75 },
          }
          const bases = baseByPlant[plantName] || baseByPlant['LA LUZ']

          const p = selectedParams[0]
          if (flowMode === 'split') {
            const arrInfluent = results[0]
            const arrEffluent = results[1]
            const seriesInfluent: Record<string, number> = {}
            const seriesEffluent: Record<string, number> = {}
            if (arrInfluent && arrInfluent.length) {
              arrInfluent.forEach((row: any) => { seriesInfluent[row.measurement_date] = row.value })
            } else {
              dates.forEach((d, i) => {
                const season = Math.sin((i / dates.length) * Math.PI * 2)
                const base = p === 'DQO' ? 1000 : p === 'SS' ? (bases.SS || 100) : (bases.pH || 7.3)
                const jitter = p === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 40 - 20)
                const val = p === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 50 + jitter)
                seriesInfluent[d] = Math.max(0, Math.round(val * 100)/100)
              })
            }
            if (arrEffluent && arrEffluent.length) {
              arrEffluent.forEach((row: any) => { seriesEffluent[row.measurement_date] = row.value })
            } else {
              dates.forEach((d, i) => {
                const season = Math.sin((i / dates.length) * Math.PI * 2)
                const base = p === 'DQO' ? 180 : p === 'SS' ? (bases.SS ? Math.max(30, bases.SS * 0.5) : 40) : (bases.pH || 7.3)
                const jitter = p === 'pH' ? (Math.random() * 0.2 - 0.1) : (Math.random() * 20 - 10)
                const val = p === 'pH' ? (base + season * 0.1 + jitter) : (base + season * 20 + jitter)
                seriesEffluent[d] = Math.max(0, Math.round(val * 100)/100)
              })
            }
            merged = dates.map(d => ({ measurement_date: d, [`${p}_influent`]: seriesInfluent[d] ?? null, [`${p}_effluent`]: seriesEffluent[d] ?? null }))
          } else {
            const arr = results[0]
            const series: Record<string, number> = {}
            if (arr && arr.length) {
              arr.forEach((row: any) => { series[row.measurement_date] = row.value })
            } else {
              dates.forEach((d, i) => {
                const season = Math.sin((i / dates.length) * Math.PI * 2)
                const base = p === 'DQO' ? bases.DQO : p === 'SS' ? bases.SS : bases.pH
                const jitter = p === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 10 - 5)
                const val = p === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 10 + jitter)
                series[d] = Math.max(0, Math.round(val * 100)/100)
              })
            }
            merged = dates.map(d => ({ measurement_date: d, [p]: series[d] ?? null }))
          }
        }
        setData(merged)
        // Compute KPIs
        if (isAllPlants) {
          const p = selectedParams[0]
          const vals = merged.flatMap((row: any) => Object.keys(row).filter(k=>k!=='measurement_date').map(k=>row[k])).filter((v: any) => typeof v === 'number') as number[]
          const count = vals.length
          const sum = vals.reduce((a, b) => a + b, 0)
          const min = vals.length ? Math.min(...vals) : 0
          const max = vals.length ? Math.max(...vals) : 0
          setKpis({ [p]: { count, avg: count ? sum / count : 0, min, max } })
        } else {
          const p = selectedParams[0]
          if (flowMode === 'split') {
            const valsInfl = merged.map((row: any) => row[`${p}_influent`]).filter((v: any) => typeof v === 'number') as number[]
            const valsEffl = merged.map((row: any) => row[`${p}_effluent`]).filter((v: any) => typeof v === 'number') as number[]
            const vals = [...valsInfl, ...valsEffl]
            const count = vals.length
            const sum = vals.reduce((a, b) => a + b, 0)
            const min = vals.length ? Math.min(...vals) : 0
            const max = vals.length ? Math.max(...vals) : 0
            setKpis({ [p]: { count, avg: count ? sum / count : 0, min, max } })
          } else {
            const vals = merged.map((row: any) => row[p]).filter((v: any) => typeof v === 'number') as number[]
            const count = vals.length
            const sum = vals.reduce((a, b) => a + b, 0)
            const min = vals.length ? Math.min(...vals) : 0
            const max = vals.length ? Math.max(...vals) : 0
            setKpis({ [p]: { count, avg: count ? sum / count : 0, min, max } })
          }
        }
      })
      .catch(e => { setError(e.message); setUsingDemo(true) })
      .finally(() => setLoading(false))
  }, [selectedParams, plantId, startDate, endDate, plants, flowMode, streamFilter])

  // Cargar analíticas para gestión cuando se abre el panel
  useEffect(() => {
    if (showManagement && plantId) {
      loadAnalytics()
    }
  }, [showManagement, plantId])

  const loadAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const params: Record<string, string> = {}
      if (plantId) {
        params.plantId = plantId
      }
      const qs = new URLSearchParams(params).toString()
      const url = qs ? `/api/analytics/environmental?${qs}` : '/api/analytics/environmental'
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      if (json.success && json.data) {
        setAnalytics(json.data)
      }
    } catch (e) {
      console.error('Error loading analytics:', e)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const createAnalytic = async () => {
    if (!newRecord.plant_id || !newRecord.parameter_type || !newRecord.measurement_date || newRecord.value === undefined) {
      alert('Complete todos los campos requeridos')
      return
    }
    try {
      const res = await fetch('/api/analytics/environmental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plantId: newRecord.plant_id,
          parameter: newRecord.parameter_type,
          measurementDate: newRecord.measurement_date,
          value: newRecord.value,
          stream: newRecord.stream || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        await loadAnalytics()
        setNewRecord({
          plant_id: plantId || '',
          parameter_type: 'DQO',
          measurement_date: new Date().toISOString().slice(0, 10),
          value: 0,
          unit: 'mg/L',
          stream: null,
        })
        // Recargar visualización
        window.location.reload()
      } else {
        alert('Error: ' + (json.error || 'No se pudo crear'))
      }
    } catch (e) {
      alert('Error al crear analítica')
      console.error(e)
    }
  }

  const updateAnalytic = async (record: AnalyticRecord) => {
    try {
      const res = await fetch(`/api/analytics/environmental/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plantId: record.plant_id,
          parameter: record.parameter_type,
          measurementDate: record.measurement_date,
          value: record.value,
          stream: record.stream || null,
          unit: record.unit,
        }),
      })
      const json = await res.json()
      if (json.success) {
        await loadAnalytics()
        setEditingId(null)
        // Recargar visualización
        window.location.reload()
      } else {
        alert('Error: ' + (json.error || 'No se pudo actualizar'))
      }
    } catch (e) {
      alert('Error al actualizar analítica')
      console.error(e)
    }
  }

  const deleteAnalytic = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta analítica?')) return
    try {
      const res = await fetch(`/api/analytics/environmental/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        await loadAnalytics()
        // Recargar visualización
        window.location.reload()
      } else {
        alert('Error: ' + (json.error || 'No se pudo eliminar'))
      }
    } catch (e) {
      alert('Error al eliminar analítica')
      console.error(e)
    }
  }

  const exportCSV = () => {
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analiticas_${selectedParams.join('-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = async () => {
    const el = document.getElementById('chart-container')!
    const canvas = await html2canvas(el)
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'landscape' })
    const width = pdf.internal.pageSize.getWidth()
    const height = (canvas.height * width) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 10, width, height)
    pdf.save(`analiticas_${selectedParams.join('-')}.pdf`)
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-1">Analíticas Ambientales</h1>
      {usingDemo && (
        <div className="mb-3 text-sm rounded border border-yellow-200 bg-yellow-50 text-yellow-800 px-3 py-2">
          Mostrando datos de ejemplo por planta (backend no disponible)
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {/* KPI Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-2">
          {[selectedParams[0]].map((p) => (
            <div key={p} className="bg-white dark:bg-gray-800 rounded border p-3 shadow-sm">
              <div className="text-xs text-gray-500">{p} · promedio</div>
              <div className="text-xl font-semibold">{(kpis[p]?.avg ?? 0).toFixed(p==='pH'?2:1)}</div>
              <div className="text-xs text-gray-500">min {kpis[p]?.min?.toFixed(p==='pH'?2:1) ?? '—'} · max {kpis[p]?.max?.toFixed(p==='pH'?2:1) ?? '—'} · n={kpis[p]?.count ?? 0}</div>
            </div>
          ))}
        </div>
        {/* Controls */}
        {plantId === '' ? (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded border px-3 py-2">
            <span className="text-sm text-gray-600 mr-2">Parámetro:</span>
            {['DQO', 'pH', 'SS'].map(p => (
              <label key={p} className="flex items-center gap-1 text-sm">
                <input type="radio" name="param-all" checked={selectedParams[0] === p} onChange={()=> setSelectedParams([p])} />
                {p}
              </label>
            ))}
            <span className="text-xs text-gray-500 ml-3">Mostrando 1 parámetro en todas las plantas</span>
            <span className="ml-3 text-sm text-gray-600">Modo:</span>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="flow-mode-all" checked={flowMode==='single'} onChange={()=>setFlowMode('single')} /> Unificado
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="flow-mode-all" checked={flowMode==='split'} onChange={()=>setFlowMode('split')} /> Afluente/Efluente
            </label>
            {flowMode==='split' && (
              <>
                <span className="ml-3 text-sm text-gray-600">Flujo:</span>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-all" checked={streamFilter==='both'} onChange={()=>setStreamFilter('both')} /> Ambos
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-all" checked={streamFilter==='influent'} onChange={()=>setStreamFilter('influent')} /> Afluente
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-all" checked={streamFilter==='effluent'} onChange={()=>setStreamFilter('effluent')} /> Efluente
                </label>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded border px-3 py-2">
            <span className="text-sm text-gray-600 mr-2">Parámetro:</span>
            {['DQO', 'pH', 'SS'].map(p => (
              <label key={p} className="flex items-center gap-1 text-sm">
                <input type="radio" name="param-one" checked={selectedParams[0] === p} onChange={()=> setSelectedParams([p])} />
                {p}
              </label>
            ))}
            <span className="ml-3 text-sm text-gray-600">Modo:</span>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="flow-mode" checked={flowMode==='single'} onChange={()=>setFlowMode('single')} /> Unificado
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="flow-mode" checked={flowMode==='split'} onChange={()=>setFlowMode('split')} /> Afluente/Efluente
            </label>
            {flowMode==='split' && (
              <>
                <span className="ml-3 text-sm text-gray-600">Flujo:</span>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-one" checked={streamFilter==='both'} onChange={()=>setStreamFilter('both')} /> Ambos
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-one" checked={streamFilter==='influent'} onChange={()=>setStreamFilter('influent')} /> Afluente
                </label>
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="stream-filter-one" checked={streamFilter==='effluent'} onChange={()=>setStreamFilter('effluent')} /> Efluente
                </label>
              </>
            )}
          </div>
        )}
        <select value={plantId} onChange={e=>setPlantId(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-gray-800">
          <option value="">Todas las plantas</option>
          {plants.map(pl=> <option key={pl.id} value={pl.id}>{pl.name}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-gray-800" />
        <span className="text-gray-500">—</span>
        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-gray-800" />
        <button onClick={exportCSV} className="ml-auto px-3 py-1 rounded border flex items-center gap-1"><Download size={16}/> CSV</button>
        <button onClick={exportPDF} className="px-3 py-1 rounded border flex items-center gap-1"><Download size={16}/> PDF</button>
      </div>
      {plantId === '' && data.length > 0 && (
        (() => {
          const keys = Object.keys(data[0] || {}).filter(k => k !== 'measurement_date')
          const last = data[data.length - 1]
          const param = selectedParams[0]
          const check = (val: number|null|undefined) => {
            if (val == null) return false
            if (param === 'DQO') return val < 200
            if (param === 'SS') return val < 100
            return val >= 6 && val <= 8
          }
          const ok = keys.filter(k => check(last[k] as any)).length
          return (
            <div className="mb-2 text-sm text-gray-600">Cumplen {param}: {ok}/{keys.length}</div>
          )
        })()
      )}
      {loading && <div>Cargando...</div>}
      {error && !usingDemo && <div className="text-red-600">{error}</div>}
      {!loading && !error && (
        <div id="chart-container" className="h-96 bg-white dark:bg-gray-800 rounded shadow p-2">
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="gradDQO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradpH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                 <linearGradient id="gradSS" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                   <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                 </linearGradient>
                {/* Gradientes por flujo: afluente verde, efluente azul */}
                <linearGradient id="gradInfluent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradEffluent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="measurement_date" tickFormatter={(v: string) => new Date(v).toLocaleDateString('es-EC', { month: 'short' })} />
              <YAxis />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} />
              <Legend
                verticalAlign="top"
                align="left"
                wrapperStyle={{ paddingBottom: 8 }}
                content={() => {
                  if (flowMode !== 'split') return null
                  // Mostrar leyenda de flujo y de plantas cuando se ven todas las plantas
                  if (plantId === '' && data.length > 0) {
                    const keys = Object.keys(data[0] || {}).filter(k => k !== 'measurement_date')
                    const uniquePlantNames = Array.from(new Set(keys.map(k => k.replace(' (afluente)', '').replace(' (efluente)', ''))))
                    const palette = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#a855f7', '#06b6d4', '#84cc16']
                    return (
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex items-center gap-4">
                          {(streamFilter !== 'effluent') && (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                              Afluente (relleno verde)
                            </span>
                          )}
                          {(streamFilter !== 'influent') && (
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2563eb' }} />
                              Efluente (relleno azul)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {uniquePlantNames.map((name, idx) => (
                            <span key={name} className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: palette[idx % palette.length] }} />
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  // Si es una sola planta en split: mostrar solo leyenda de flujo
                  return (
                    <div className="flex items-center gap-4 text-sm">
                      {(streamFilter !== 'effluent') && (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
                          Afluente (relleno verde)
                        </span>
                      )}
                      {(streamFilter !== 'influent') && (
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2563eb' }} />
                          Efluente (relleno azul)
                        </span>
                      )}
                    </div>
                  )
                }}
              />
              {plantId === '' ? (
                // Líneas por planta para el primer parámetro seleccionado
                (() => {
                  const keys = Object.keys(data[0] || {}).filter(k => k !== 'measurement_date')
                  const param = selectedParams[0] || 'DQO'
                  const overlays = (
                    <>
                      {param === 'DQO' && <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="3 3" label="200 ppm" />}
                      {param === 'SS' && <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" label="100 ppm" />}
                      {param === 'pH' && <ReferenceArea y1={6} y2={8} fill="#86efac" fillOpacity={0.2} />}
                    </>
                  )
                  return (
                    <>
                      {overlays}
                      {keys.map((key) => {
                        if (flowMode === 'split') {
                          const isInfluent = key.endsWith('(afluente)')
                          const plantName = key.replace(' (afluente)', '').replace(' (efluente)', '')
                          const uniquePlantNames = Array.from(new Set(keys.map(k => k.replace(' (afluente)', '').replace(' (efluente)', ''))))
                          const palette = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#a855f7', '#06b6d4', '#84cc16']
                          const idx = uniquePlantNames.indexOf(plantName)
                          const color = palette[idx % palette.length]
                          const fill = isInfluent ? 'url(#gradInfluent)' : 'url(#gradEffluent)'
                          return <Area key={key} type="monotone" dataKey={key} name={key} stroke={color} fillOpacity={0.2} fill={fill} />
                        }
                        // Unificado: usar paleta neutra por planta
                        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#14b8a6', '#ef4444']
                        const idx = keys.indexOf(key)
                        return <Area key={key} type="monotone" dataKey={key} name={key} stroke={palette[idx % palette.length]} fillOpacity={0.2} fill={palette[idx % palette.length]} />
                      })}
                    </>
                  )
                })()
              ) : (
                (() => {
                  const p = selectedParams[0]
                  if (flowMode === 'split') {
                    // Mostrar según filtro de flujo
                    return (<>
                      {(streamFilter !== 'effluent') && (
                        <Area type="monotone" dataKey={`${p}_influent`} name={`${p} (afluente)`} stroke="#10b981" fillOpacity={0.2} fill="url(#gradInfluent)" />
                      )}
                      {(streamFilter !== 'influent') && (
                        <Area type="monotone" dataKey={`${p}_effluent`} name={`${p} (efluente)`} stroke="#2563eb" fillOpacity={0.2} fill="url(#gradEffluent)" />
                      )}
                    </>)
                  } else {
                    if (p === 'DQO') return (<Area type="monotone" dataKey="DQO" name="DQO" stroke="#3b82f6" fillOpacity={1} fill="url(#gradDQO)" />)
                    if (p === 'pH') return (<Area type="monotone" dataKey="pH" name="pH" stroke="#10b981" fillOpacity={1} fill="url(#gradpH)" />)
                    return (<Area type="monotone" dataKey="SS" name="SS" stroke="#f59e0b" fillOpacity={1} fill="url(#gradSS)" />)
                  }
                })()
              )}
              <Brush dataKey="measurement_date" height={20} travellerWidth={10}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sección de Gestión de Analíticas */}
      <div className="mt-6">
        <button
          onClick={() => setShowManagement(!showManagement)}
          className="px-4 py-2 rounded border bg-blue-500 text-white hover:bg-blue-600"
        >
          {showManagement ? 'Ocultar' : 'Mostrar'} Gestión de Analíticas
        </button>
      </div>

      {showManagement && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded shadow p-4">
          <h2 className="text-xl font-semibold mb-4">Gestión de Analíticas</h2>

          {!isAdmin && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
              Modo demostración: Configure Supabase en el .env para habilitar operaciones de escritura
            </div>
          )}

          {!plantId && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
              Seleccione una planta específica para añadir nuevas analíticas. Viendo todas las analíticas de todas las plantas.
            </div>
          )}

          {/* Formulario para nueva analítica - solo cuando hay planta seleccionada */}
          {plantId && (
            <div className="mb-6 p-4 border rounded bg-gray-50 dark:bg-gray-700">
              <h3 className="text-lg font-semibold mb-3">Nueva Analítica</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <label className="block text-sm mb-1">Parámetro</label>
                  <select
                    value={newRecord.parameter_type}
                    onChange={e => setNewRecord({ ...newRecord, parameter_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                  >
                    <option value="DQO">DQO</option>
                    <option value="pH">pH</option>
                    <option value="SS">SS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Fecha</label>
                  <input
                    type="date"
                    value={newRecord.measurement_date}
                    onChange={e => setNewRecord({ ...newRecord, measurement_date: e.target.value })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.value}
                    onChange={e => setNewRecord({ ...newRecord, value: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Unidad</label>
                  <input
                    type="text"
                    value={newRecord.unit}
                    onChange={e => setNewRecord({ ...newRecord, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                    placeholder="mg/L"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Flujo</label>
                  <select
                    value={newRecord.stream || ''}
                    onChange={e => setNewRecord({ ...newRecord, stream: (e.target.value || null) as any })}
                    className="w-full px-3 py-2 rounded border bg-white dark:bg-gray-800"
                  >
                    <option value="">Sin especificar</option>
                    <option value="influent">Afluente</option>
                    <option value="effluent">Efluente</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={createAnalytic}
                    className="w-full px-4 py-2 rounded border bg-green-500 text-white hover:bg-green-600"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de analíticas - siempre visible */}
          <div className="overflow-x-auto">
                {loadingAnalytics ? (
                  <div className="text-center py-4">Cargando analíticas...</div>
                ) : analytics.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No hay analíticas registradas para esta planta</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                      <tr>
                        {!plantId && <th className="p-2 text-left">Planta</th>}
                        <th className="p-2 text-left">Parámetro</th>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Valor</th>
                        <th className="p-2 text-left">Unidad</th>
                        <th className="p-2 text-left">Flujo</th>
                        <th className="p-2 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.map(record => (
                        <tr key={record.id} className="border-t">
                          {editingId === record.id ? (
                            <>
                              {!plantId && <td className="p-2 text-gray-500">{plants.find(p => p.id === record.plant_id)?.name || record.plant_id}</td>}
                              <td className="p-2">
                                <select
                                  value={record.parameter_type}
                                  onChange={e => setAnalytics(prev => prev.map(r => r.id === record.id ? { ...r, parameter_type: e.target.value as any } : r))}
                                  className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800"
                                >
                                  <option value="DQO">DQO</option>
                                  <option value="pH">pH</option>
                                  <option value="SS">SS</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={record.measurement_date.slice(0, 10)}
                                  onChange={e => setAnalytics(prev => prev.map(r => r.id === record.id ? { ...r, measurement_date: e.target.value } : r))}
                                  className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={record.value}
                                  onChange={e => setAnalytics(prev => prev.map(r => r.id === record.id ? { ...r, value: parseFloat(e.target.value) } : r))}
                                  className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={record.unit}
                                  onChange={e => setAnalytics(prev => prev.map(r => r.id === record.id ? { ...r, unit: e.target.value } : r))}
                                  className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={record.stream || ''}
                                  onChange={e => setAnalytics(prev => prev.map(r => r.id === record.id ? { ...r, stream: (e.target.value || null) as any } : r))}
                                  className="w-full px-2 py-1 rounded border bg-white dark:bg-gray-800"
                                >
                                  <option value="">Sin especificar</option>
                                  <option value="influent">Afluente</option>
                                  <option value="effluent">Efluente</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => updateAnalytic(record)}
                                    className="px-2 py-1 rounded border bg-blue-500 text-white text-xs hover:bg-blue-600"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-2 py-1 rounded border bg-gray-500 text-white text-xs hover:bg-gray-600"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {!plantId && <td className="p-2">{plants.find(p => p.id === record.plant_id)?.name || record.plant_id}</td>}
                              <td className="p-2">{record.parameter_type}</td>
                              <td className="p-2">{new Date(record.measurement_date).toLocaleDateString()}</td>
                              <td className="p-2">{record.value}</td>
                              <td className="p-2">{record.unit}</td>
                              <td className="p-2">
                                {record.stream === 'influent' ? 'Afluente' : record.stream === 'effluent' ? 'Efluente' : '-'}
                              </td>
                              <td className="p-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditingId(record.id)}
                                    className="px-2 py-1 rounded border bg-yellow-500 text-white text-xs hover:bg-yellow-600"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => deleteAnalytic(record.id)}
                                    className="px-2 py-1 rounded border bg-red-500 text-white text-xs hover:bg-red-600"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
          </div>
        </div>
      )}
    </div>
  )
}