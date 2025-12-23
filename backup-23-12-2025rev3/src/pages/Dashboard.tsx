import { useEffect, useMemo, useState, useRef } from 'react'
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Brush, ReferenceLine, ReferenceArea } from 'recharts'
import { Download, Upload, FileSpreadsheet, RefreshCw, Eye, FolderOpen } from 'lucide-react'
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
  stream?: 'influent' | 'reactor' | 'effluent' | null
}

export default function Dashboard() {
  const [data, setData] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingDemo, setUsingDemo] = useState(false)
  const [selectedParams, setSelectedParams] = useState<string[]>(['DQO', 'pH', 'SS'])
  const [plantId, setPlantId] = useState<string>('')
  const [plants, setPlants] = useState<{id:string;name:string}[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [kpis, setKpis] = useState<Record<string, { count: number; avg: number; min: number; max: number }>>({})
  const [flowMode, setFlowMode] = useState<'single'|'split'>( 'split' )
  const [streamFilter, setStreamFilter] = useState<'all'|'influent'|'reactor'|'effluent'>('all')

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

  // Estados para subida CSV
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: boolean; message: string; errors?: string[] } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Estados para CSV automático (watcher)
  const [watcherStatus, setWatcherStatus] = useState<{
    active: boolean
    csvPath: string
    lastResult: { timestamp: string; inserted: number; updated: number; errors: string[]; skipped: number } | null
    isProcessing: boolean
  } | null>(null)
  const [processingManual, setProcessingManual] = useState(false)

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

    // Cargar estado del watcher CSV
    loadWatcherStatus()
  }, [])

  // Cargar estado del watcher
  const loadWatcherStatus = async () => {
    try {
      const res = await fetch('/api/analytics/csv-watcher/status', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setWatcherStatus({
          active: json.active,
          csvPath: json.csvPath,
          lastResult: json.lastResult,
          isProcessing: json.isProcessing
        })
      }
    } catch (e) {
      console.error('Error loading watcher status:', e)
    }
  }

  // Procesar CSV manualmente
  const processCSVManually = async () => {
    setProcessingManual(true)
    try {
      const res = await fetch('/api/analytics/csv-watcher/process', {
        method: 'POST',
        credentials: 'include'
      })
      const json = await res.json()
      if (json.success) {
        setCsvResult({
          success: true,
          message: json.message,
          errors: json.errors
        })
        await loadWatcherStatus()
        await loadAnalytics()
      } else {
        setCsvResult({
          success: false,
          message: json.message || json.error || 'Error al procesar'
        })
      }
    } catch (e: any) {
      setCsvResult({
        success: false,
        message: e.message || 'Error de conexión'
      })
    } finally {
      setProcessingManual(false)
    }
  }

  useEffect(() => {
    if (selectedParams.length === 0) {
      setData([])
      setKpis({})
      setLoading(false)
      return
    }
    setLoading(true)
    const isAllPlants = plantId === ''

    const fetchParam = (param: string, stream?: 'influent'|'reactor'|'effluent') => {
      const qs = new URLSearchParams({ parameter: param, ...(plantId ? { plantId } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(stream ? { stream } : {}) }).toString()
      const url = `/api/analytics/environmental?${qs}`
      return fetch(url, { credentials: 'include' })
        .then(r => r.json())
        .then(json => {
          if (!json.success) throw new Error(json.error || 'Error')
          return { param, stream, data: json.data || [] }
        })
        .catch(() => ({ param, stream, data: [] }))
    }

    // Build fetch list for ALL selected params
    const fetchList: Array<{param:string;stream?:'influent'|'reactor'|'effluent'}> = []
    selectedParams.forEach(param => {
      if (flowMode === 'split') {
        if (streamFilter === 'influent') {
          fetchList.push({ param, stream: 'influent' })
        } else if (streamFilter === 'reactor') {
          fetchList.push({ param, stream: 'reactor' })
        } else if (streamFilter === 'effluent') {
          fetchList.push({ param, stream: 'effluent' })
        } else {
          // all - fetch all three streams
          fetchList.push({ param, stream: 'influent' })
          fetchList.push({ param, stream: 'reactor' })
          fetchList.push({ param, stream: 'effluent' })
        }
      } else {
        fetchList.push({ param })
      }
    })

    Promise.all(fetchList.map(item => fetchParam(item.param, item.stream)))
      .then(results => {
        const anyEmpty = results.every(r => r.data.length === 0)
        setUsingDemo(anyEmpty)
        setError(null)

        // Collect all dates
        const allDates = new Set<string>()
        results.forEach(r => r.data.forEach((row: any) => allDates.add(row.measurement_date)))
        let dates = Array.from(allDates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        if (dates.length === 0) {
          const now = new Date()
          const months = 12
          dates = Array.from({ length: months }).map((_, i) => {
            const d = new Date(now); d.setMonth(now.getMonth() - (months - 1 - i)); d.setDate(15); return d.toISOString()
          })
        }

        const baseByPlant: Record<string, { DQO: number; pH: number; SS: number }> = {
          'LA LUZ': { DQO: 110, pH: 7.3, SS: 70 },
          'TAURA': { DQO: 125, pH: 7.4, SS: 80 },
          'SANTA MONICA': { DQO: 95, pH: 7.2, SS: 65 },
          'SAN DIEGO': { DQO: 130, pH: 7.5, SS: 85 },
          'CHANDUY': { DQO: 105, pH: 7.3, SS: 75 },
        }

        let merged: any[] = []
        const newKpis: Record<string, { count: number; avg: number; min: number; max: number }> = {}

        if (!isAllPlants) {
          // Single plant: show all params together
          const plantName = plants.find(pl=>pl.id===plantId)?.name || plantId || 'LA LUZ'
          const bases = baseByPlant[plantName] || baseByPlant['LA LUZ']

          // Build series for each param
          const seriesByKey: Record<string, Record<string, number>> = {}

          selectedParams.forEach(param => {
            if (flowMode === 'split') {
              const influentResult = results.find(r => r.param === param && r.stream === 'influent')
              const reactorResult = results.find(r => r.param === param && r.stream === 'reactor')
              const effluentResult = results.find(r => r.param === param && r.stream === 'effluent')

              // Influent (afluente)
              if (streamFilter === 'all' || streamFilter === 'influent') {
                const key = `${param}_influent`
                seriesByKey[key] = {}
                if (influentResult && influentResult.data.length) {
                  influentResult.data.forEach((row: any) => { seriesByKey[key][row.measurement_date] = row.value })
                } else {
                  // Demo data - afluente (valores más altos)
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const base = param === 'DQO' ? 1000 : param === 'SS' ? (bases.SS || 100) : (bases.pH || 7.3)
                    const jitter = param === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 40 - 20)
                    const val = param === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 50 + jitter)
                    seriesByKey[key][d] = Math.max(0, Math.round(val * 100)/100)
                  })
                }
              }

              // Reactor (valores intermedios)
              if (streamFilter === 'all' || streamFilter === 'reactor') {
                const key = `${param}_reactor`
                seriesByKey[key] = {}
                if (reactorResult && reactorResult.data.length) {
                  reactorResult.data.forEach((row: any) => { seriesByKey[key][row.measurement_date] = row.value })
                } else {
                  // Demo data - reactor (valores intermedios entre afluente y efluente)
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const base = param === 'DQO' ? 500 : param === 'SS' ? (bases.SS ? bases.SS * 0.7 : 70) : (bases.pH || 7.3)
                    const jitter = param === 'pH' ? (Math.random() * 0.25 - 0.125) : (Math.random() * 30 - 15)
                    const val = param === 'pH' ? (base + season * 0.12 + jitter) : (base + season * 35 + jitter)
                    seriesByKey[key][d] = Math.max(0, Math.round(val * 100)/100)
                  })
                }
              }

              // Effluent (efluente - valores más bajos)
              if (streamFilter === 'all' || streamFilter === 'effluent') {
                const key = `${param}_effluent`
                seriesByKey[key] = {}
                if (effluentResult && effluentResult.data.length) {
                  effluentResult.data.forEach((row: any) => { seriesByKey[key][row.measurement_date] = row.value })
                } else {
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const base = param === 'DQO' ? 180 : param === 'SS' ? (bases.SS ? Math.max(30, bases.SS * 0.5) : 40) : (bases.pH || 7.3)
                    const jitter = param === 'pH' ? (Math.random() * 0.2 - 0.1) : (Math.random() * 20 - 10)
                    const val = param === 'pH' ? (base + season * 0.1 + jitter) : (base + season * 20 + jitter)
                    seriesByKey[key][d] = Math.max(0, Math.round(val * 100)/100)
                  })
                }
              }
            } else {
              // Single flow mode
              const key = param
              seriesByKey[key] = {}
              const result = results.find(r => r.param === param && !r.stream)
              if (result && result.data.length) {
                result.data.forEach((row: any) => { seriesByKey[key][row.measurement_date] = row.value })
              } else {
                dates.forEach((d, i) => {
                  const season = Math.sin((i / dates.length) * Math.PI * 2)
                  const base = param === 'DQO' ? bases.DQO : param === 'SS' ? bases.SS : bases.pH
                  const jitter = param === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 10 - 5)
                  const val = param === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 10 + jitter)
                  seriesByKey[key][d] = Math.max(0, Math.round(val * 100)/100)
                })
              }
            }
          })

          // Merge all series
          merged = dates.map(d => {
            const obj: any = { measurement_date: d }
            Object.keys(seriesByKey).forEach(key => { obj[key] = seriesByKey[key][d] ?? null })
            return obj
          })

          // Compute KPIs for each param
          selectedParams.forEach(param => {
            let vals: number[] = []
            if (flowMode === 'split') {
              if (streamFilter === 'all' || streamFilter === 'influent') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_influent`]).filter((v: any) => typeof v === 'number'))
              }
              if (streamFilter === 'all' || streamFilter === 'reactor') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_reactor`]).filter((v: any) => typeof v === 'number'))
              }
              if (streamFilter === 'all' || streamFilter === 'effluent') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_effluent`]).filter((v: any) => typeof v === 'number'))
              }
            } else {
              vals = merged.map((row: any) => row[param]).filter((v: any) => typeof v === 'number')
            }
            const count = vals.length
            const sum = vals.reduce((a, b) => a + b, 0)
            const min = vals.length ? Math.min(...vals) : 0
            const max = vals.length ? Math.max(...vals) : 0
            newKpis[param] = { count, avg: count ? sum / count : 0, min, max }
          })
        } else {
          // All plants: show all selected params with average across plants
          const seriesByKey: Record<string, Record<string, number[]>> = {}

          // Process each selected parameter
          selectedParams.forEach(param => {
            if (flowMode === 'split') {
              // Collect values per date for averaging - Influent
              if (streamFilter === 'all' || streamFilter === 'influent') {
                const key = `${param}_influent`
                seriesByKey[key] = {}
                const influentResult = results.find(r => r.param === param && r.stream === 'influent')
                if (influentResult && influentResult.data.length) {
                  influentResult.data.forEach((row: any) => {
                    if (!seriesByKey[key][row.measurement_date]) seriesByKey[key][row.measurement_date] = []
                    seriesByKey[key][row.measurement_date].push(row.value)
                  })
                }
              }
              // Reactor
              if (streamFilter === 'all' || streamFilter === 'reactor') {
                const key = `${param}_reactor`
                seriesByKey[key] = {}
                const reactorResult = results.find(r => r.param === param && r.stream === 'reactor')
                if (reactorResult && reactorResult.data.length) {
                  reactorResult.data.forEach((row: any) => {
                    if (!seriesByKey[key][row.measurement_date]) seriesByKey[key][row.measurement_date] = []
                    seriesByKey[key][row.measurement_date].push(row.value)
                  })
                }
              }
              // Effluent
              if (streamFilter === 'all' || streamFilter === 'effluent') {
                const key = `${param}_effluent`
                seriesByKey[key] = {}
                const effluentResult = results.find(r => r.param === param && r.stream === 'effluent')
                if (effluentResult && effluentResult.data.length) {
                  effluentResult.data.forEach((row: any) => {
                    if (!seriesByKey[key][row.measurement_date]) seriesByKey[key][row.measurement_date] = []
                    seriesByKey[key][row.measurement_date].push(row.value)
                  })
                }
              }
            } else {
              const key = param
              seriesByKey[key] = {}
              const result = results.find(r => r.param === param && !r.stream)
              if (result && result.data.length) {
                result.data.forEach((row: any) => {
                  if (!seriesByKey[key][row.measurement_date]) seriesByKey[key][row.measurement_date] = []
                  seriesByKey[key][row.measurement_date].push(row.value)
                })
              }
            }
          })

          // Generate demo data if empty
          const hasData = Object.values(seriesByKey).some(series => Object.keys(series).length > 0)
          if (!hasData) {
            selectedParams.forEach(param => {
              if (flowMode === 'split') {
                // Influent demo data
                if (streamFilter === 'all' || streamFilter === 'influent') {
                  const key = `${param}_influent`
                  seriesByKey[key] = {}
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const values = plants.map(pl => {
                      const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                      const base = param === 'DQO' ? 1000 : param === 'SS' ? (bases.SS || 100) : (bases.pH || 7.3)
                      const jitter = param === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 40 - 20)
                      return param === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 50 + jitter)
                    })
                    seriesByKey[key][d] = values
                  })
                }
                // Reactor demo data
                if (streamFilter === 'all' || streamFilter === 'reactor') {
                  const key = `${param}_reactor`
                  seriesByKey[key] = {}
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const values = plants.map(pl => {
                      const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                      const base = param === 'DQO' ? 500 : param === 'SS' ? (bases.SS ? bases.SS * 0.7 : 70) : (bases.pH || 7.3)
                      const jitter = param === 'pH' ? (Math.random() * 0.25 - 0.125) : (Math.random() * 30 - 15)
                      return param === 'pH' ? (base + season * 0.12 + jitter) : (base + season * 35 + jitter)
                    })
                    seriesByKey[key][d] = values
                  })
                }
                // Effluent demo data
                if (streamFilter === 'all' || streamFilter === 'effluent') {
                  const key = `${param}_effluent`
                  seriesByKey[key] = {}
                  dates.forEach((d, i) => {
                    const season = Math.sin((i / dates.length) * Math.PI * 2)
                    const values = plants.map(pl => {
                      const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                      const base = param === 'DQO' ? 180 : param === 'SS' ? (bases.SS ? Math.max(30, bases.SS * 0.5) : 40) : (bases.pH || 7.3)
                      const jitter = param === 'pH' ? (Math.random() * 0.2 - 0.1) : (Math.random() * 20 - 10)
                      return param === 'pH' ? (base + season * 0.1 + jitter) : (base + season * 20 + jitter)
                    })
                    seriesByKey[key][d] = values
                  })
                }
              } else {
                const key = param
                seriesByKey[key] = {}
                dates.forEach((d, i) => {
                  const season = Math.sin((i / dates.length) * Math.PI * 2)
                  const values = plants.map(pl => {
                    const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ']
                    const base = param === 'DQO' ? bases.DQO : param === 'SS' ? bases.SS : bases.pH
                    const jitter = param === 'pH' ? (Math.random() * 0.3 - 0.15) : (Math.random() * 10 - 5)
                    return param === 'pH' ? (base + season * 0.15 + jitter) : (base + season * 10 + jitter)
                  })
                  seriesByKey[key][d] = values
                })
              }
            })
          }

          // Merge: average values per date
          merged = dates.map(d => {
            const obj: any = { measurement_date: d }
            Object.keys(seriesByKey).forEach(key => {
              const values = seriesByKey[key][d] || []
              if (values.length > 0) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length
                obj[key] = Math.round(avg * 100) / 100
              } else {
                obj[key] = null
              }
            })
            return obj
          })

          // KPIs for all plants mode - one per param
          selectedParams.forEach(param => {
            let vals: number[] = []
            if (flowMode === 'split') {
              if (streamFilter === 'all' || streamFilter === 'influent') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_influent`]).filter((v: any) => typeof v === 'number'))
              }
              if (streamFilter === 'all' || streamFilter === 'reactor') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_reactor`]).filter((v: any) => typeof v === 'number'))
              }
              if (streamFilter === 'all' || streamFilter === 'effluent') {
                vals = vals.concat(merged.map((row: any) => row[`${param}_effluent`]).filter((v: any) => typeof v === 'number'))
              }
            } else {
              vals = merged.map((row: any) => row[param]).filter((v: any) => typeof v === 'number')
            }
            const count = vals.length
            const sum = vals.reduce((a, b) => a + b, 0)
            const min = vals.length ? Math.min(...vals) : 0
            const max = vals.length ? Math.max(...vals) : 0
            newKpis[param] = { count, avg: count ? sum / count : 0, min, max }
          })
        }

        setData(merged)
        setKpis(newKpis)
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

  // Función para subir archivo CSV
  const uploadCSV = async (file: File) => {
    setCsvUploading(true)
    setCsvResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/analytics/upload-csv', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setCsvResult({
          success: true,
          message: result.message,
          errors: result.errors,
        })
        // Recargar datos después de subir
        loadAnalytics()
      } else {
        setCsvResult({
          success: false,
          message: result.error || 'Error al procesar el archivo',
          errors: result.errors,
        })
      }
    } catch (error: any) {
      setCsvResult({
        success: false,
        message: error.message || 'Error de conexión',
      })
    } finally {
      setCsvUploading(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  // Función para descargar plantilla CSV
  const downloadTemplate = () => {
    window.location.href = '/api/analytics/csv-template'
  }

  // Función para manejar cambio de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadCSV(file)
    }
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
          {selectedParams.map((p) => (
            <div key={p} className={`bg-white dark:bg-gray-800 rounded border p-3 shadow-sm ${
              p === 'DQO' ? 'border-l-4 border-l-blue-500' :
              p === 'pH' ? 'border-l-4 border-l-green-500' :
              'border-l-4 border-l-amber-500'
            }`}>
              <div className="text-xs text-gray-500">{p} · promedio</div>
              <div className="text-xl font-semibold">{(kpis[p]?.avg ?? 0).toFixed(p==='pH'?2:1)}</div>
              <div className="text-xs text-gray-500">min {kpis[p]?.min?.toFixed(p==='pH'?2:1) ?? '—'} · max {kpis[p]?.max?.toFixed(p==='pH'?2:1) ?? '—'} · n={kpis[p]?.count ?? 0}</div>
            </div>
          ))}
        </div>
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 rounded border px-3 py-2">
          <span className="text-sm text-gray-600 mr-2">Parámetros:</span>
          {['DQO', 'pH', 'SS'].map(p => (
            <label key={p} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={selectedParams.includes(p)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedParams(prev => [...prev, p])
                  } else {
                    setSelectedParams(prev => prev.filter(x => x !== p))
                  }
                }}
              />
              {p}
            </label>
          ))}
          <button
            onClick={() => setSelectedParams(['DQO', 'pH', 'SS'])}
            className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Todos
          </button>
          <span className="ml-3 text-sm text-gray-600">Modo:</span>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="flow-mode" checked={flowMode==='single'} onChange={()=>setFlowMode('single')} /> Unificado
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="flow-mode" checked={flowMode==='split'} onChange={()=>setFlowMode('split')} /> Por Punto
          </label>
          {flowMode==='split' && (
            <>
              <span className="ml-3 text-sm text-gray-600">Punto:</span>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="stream-filter" checked={streamFilter==='all'} onChange={()=>setStreamFilter('all')} /> Todos
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="stream-filter" checked={streamFilter==='influent'} onChange={()=>setStreamFilter('influent')} /> Afluente
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="stream-filter" checked={streamFilter==='reactor'} onChange={()=>setStreamFilter('reactor')} /> Reactor
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="stream-filter" checked={streamFilter==='effluent'} onChange={()=>setStreamFilter('effluent')} /> Efluente
              </label>
            </>
          )}
        </div>
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
            <ComposedChart data={data}>
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
              {/* Primary Y-axis for DQO and SS (mg/L) */}
              <YAxis
                yAxisId="left"
                orientation="left"
                label={{ value: 'DQO / SS (mg/L)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              />
              {/* Secondary Y-axis for pH (scale 0-14) */}
              {selectedParams.includes('pH') && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 14]}
                  label={{ value: 'pH', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                />
              )}
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleString()}
                formatter={(value: number, name: string) => {
                  const unit = name.toLowerCase().includes('ph') ? '' : ' mg/L'
                  return [value?.toFixed(2) + unit, name]
                }}
              />
              <Legend
                verticalAlign="top"
                align="center"
                wrapperStyle={{ paddingBottom: 8 }}
              />
              {/* Reference lines for limits */}
              {selectedParams.includes('DQO') && <ReferenceLine yAxisId="left" y={200} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'DQO límite 200', position: 'right', fill: '#ef4444', fontSize: 10 }} />}
              {selectedParams.includes('SS') && <ReferenceLine yAxisId="left" y={100} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'SS límite 100', position: 'right', fill: '#f59e0b', fontSize: 10 }} />}
              {selectedParams.includes('pH') && <ReferenceArea yAxisId="right" y1={6} y2={8} fill="#86efac" fillOpacity={0.15} />}

              {plantId === '' ? (
                // All plants mode: show all selected params with average across plants
                <>
                  {flowMode === 'split' ? (
                    <>
                      {/* DQO series - average all plants: afluente, reactor, efluente */}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Area yAxisId="left" type="monotone" dataKey="DQO_influent" name="DQO Promedio (afluente)" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.3} fill="url(#gradDQO)" />
                      )}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="left" type="monotone" dataKey="DQO_reactor" name="DQO Promedio (reactor)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" dot={{ fill: '#8b5cf6', r: 2 }} />
                      )}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="left" type="monotone" dataKey="DQO_effluent" name="DQO Promedio (efluente)" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                      )}
                      {/* SS series - average all plants: afluente, reactor, efluente */}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Area yAxisId="left" type="monotone" dataKey="SS_influent" name="SS Promedio (afluente)" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.3} fill="url(#gradSS)" />
                      )}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="left" type="monotone" dataKey="SS_reactor" name="SS Promedio (reactor)" stroke="#ea580c" strokeWidth={2} strokeDasharray="3 3" dot={{ fill: '#ea580c', r: 2 }} />
                      )}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="left" type="monotone" dataKey="SS_effluent" name="SS Promedio (efluente)" stroke="#d97706" strokeWidth={2} dot={false} />
                      )}
                      {/* pH series - on right axis: afluente, reactor, efluente */}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_influent" name="pH Promedio (afluente)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#10b981', r: 3 }} />
                      )}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_reactor" name="pH Promedio (reactor)" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                      )}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_effluent" name="pH Promedio (efluente)" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 3 }} />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Unified mode: show each param as average of all plants */}
                      {selectedParams.includes('DQO') && (
                        <Area yAxisId="left" type="monotone" dataKey="DQO" name="DQO Promedio" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.4} fill="url(#gradDQO)" />
                      )}
                      {selectedParams.includes('SS') && (
                        <Area yAxisId="left" type="monotone" dataKey="SS" name="SS Promedio" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.4} fill="url(#gradSS)" />
                      )}
                      {selectedParams.includes('pH') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH" name="pH Promedio" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                      )}
                    </>
                  )}
                </>
              ) : (
                // Single plant mode: show all selected params together
                <>
                  {flowMode === 'split' ? (
                    <>
                      {/* DQO series: afluente, reactor, efluente */}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Area yAxisId="left" type="monotone" dataKey="DQO_influent" name="DQO (afluente)" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.3} fill="url(#gradDQO)" />
                      )}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="left" type="monotone" dataKey="DQO_reactor" name="DQO (reactor)" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="3 3" dot={{ fill: '#8b5cf6', r: 2 }} />
                      )}
                      {selectedParams.includes('DQO') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="left" type="monotone" dataKey="DQO_effluent" name="DQO (efluente)" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                      )}
                      {/* SS series: afluente, reactor, efluente */}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Area yAxisId="left" type="monotone" dataKey="SS_influent" name="SS (afluente)" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.3} fill="url(#gradSS)" />
                      )}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="left" type="monotone" dataKey="SS_reactor" name="SS (reactor)" stroke="#ea580c" strokeWidth={2} strokeDasharray="3 3" dot={{ fill: '#ea580c', r: 2 }} />
                      )}
                      {selectedParams.includes('SS') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="left" type="monotone" dataKey="SS_effluent" name="SS (efluente)" stroke="#d97706" strokeWidth={2} dot={false} />
                      )}
                      {/* pH series - on right axis: afluente, reactor, efluente */}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'influent') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_influent" name="pH (afluente)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#10b981', r: 3 }} />
                      )}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'reactor') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_reactor" name="pH (reactor)" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                      )}
                      {selectedParams.includes('pH') && (streamFilter === 'all' || streamFilter === 'effluent') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH_effluent" name="pH (efluente)" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 3 }} />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Unified mode: show each param */}
                      {selectedParams.includes('DQO') && (
                        <Area yAxisId="left" type="monotone" dataKey="DQO" name="DQO" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.4} fill="url(#gradDQO)" />
                      )}
                      {selectedParams.includes('SS') && (
                        <Area yAxisId="left" type="monotone" dataKey="SS" name="SS" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.4} fill="url(#gradSS)" />
                      )}
                      {selectedParams.includes('pH') && (
                        <Line yAxisId="right" type="monotone" dataKey="pH" name="pH" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                      )}
                    </>
                  )}
                </>
              )}
              <Brush dataKey="measurement_date" height={20} travellerWidth={10}/>
            </ComposedChart>
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

          {/* Sección de importación CSV automática */}
          {isAdmin && (
            <div className="mb-6 p-4 border rounded bg-green-50 dark:bg-green-900/20">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Eye size={20} />
                Importación Automática (CSV en carpeta)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                El sistema monitorea automáticamente el archivo <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">plantilla_analiticas.csv</code> en la carpeta del proyecto.
                Cuando modifiques y guardes el archivo, los datos se importarán automáticamente.
              </p>

              {watcherStatus && (
                <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-3 h-3 rounded-full ${watcherStatus.active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span className="font-medium">
                      {watcherStatus.active ? 'Watcher activo' : 'Watcher inactivo'}
                    </span>
                    {watcherStatus.isProcessing && (
                      <span className="text-sm text-blue-600 flex items-center gap-1">
                        <RefreshCw size={14} className="animate-spin" /> Procesando...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Archivo: {watcherStatus.csvPath}
                  </p>
                  {watcherStatus.lastResult && (
                    <div className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <p className="font-medium">Última importación: {new Date(watcherStatus.lastResult.timestamp).toLocaleString()}</p>
                      <p>Insertados: {watcherStatus.lastResult.inserted} | Actualizados: {watcherStatus.lastResult.updated} | Omitidos: {watcherStatus.lastResult.skipped}</p>
                      {watcherStatus.lastResult.errors.length > 0 && (
                        <p className="text-orange-600">Errores: {watcherStatus.lastResult.errors.length}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-center">
                <button
                  onClick={processCSVManually}
                  disabled={processingManual}
                  className={`px-4 py-2 rounded border flex items-center gap-2 ${
                    processingManual
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  <RefreshCw size={16} className={processingManual ? 'animate-spin' : ''} />
                  {processingManual ? 'Procesando...' : 'Procesar CSV ahora'}
                </button>
                <a
                  href="/api/analytics/csv-watcher/download"
                  className="px-4 py-2 rounded border bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download size={16} />
                  Descargar CSV actual
                </a>
                <button
                  onClick={() => {
                    // Abrir carpeta del proyecto (solo informativo)
                    alert('El archivo CSV está en:\n\n' + (watcherStatus?.csvPath || 'plantilla_analiticas.csv') + '\n\nÁbrelo con Excel o LibreOffice para editarlo.')
                  }}
                  className="px-4 py-2 rounded border bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <FolderOpen size={16} />
                  Ver ubicación
                </button>
              </div>
            </div>
          )}

          {/* Sección de importación CSV manual */}
          {isAdmin && (
            <div className="mb-6 p-4 border rounded bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileSpreadsheet size={20} />
                Importar desde CSV (subida manual)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Sube un archivo CSV desde cualquier ubicación para importar datos.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className={`px-4 py-2 rounded border cursor-pointer flex items-center gap-2 ${
                    csvUploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <Upload size={16} />
                  {csvUploading ? 'Subiendo...' : 'Subir archivo CSV'}
                </label>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 rounded border bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <Download size={16} />
                  Descargar plantilla
                </button>
              </div>
            </div>
          )}

          {/* Resultado de la subida/proceso */}
          {csvResult && (
            <div className={`mb-6 p-3 rounded ${
              csvResult.success
                ? 'bg-green-100 border border-green-300 text-green-800'
                : 'bg-yellow-100 border border-yellow-300 text-yellow-800'
            }`}>
              <p className="font-medium">{csvResult.message}</p>
              {csvResult.errors && csvResult.errors.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Errores encontrados:</p>
                  <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                    {csvResult.errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {csvResult.errors.length > 10 && (
                      <li>... y {csvResult.errors.length - 10} errores más</li>
                    )}
                  </ul>
                </div>
              )}
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