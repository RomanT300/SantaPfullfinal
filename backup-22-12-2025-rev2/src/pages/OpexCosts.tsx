import { useEffect, useState, useMemo, useRef } from 'react'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Upload, Download, Droplets, Users, Wrench, Zap, FlaskConical, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell, Area, AreaChart, RadialBarChart, RadialBar } from 'recharts'

type OpexCost = {
  id: string
  plant_id: string
  period_date: string
  volume_m3: number
  cost_agua: number
  cost_personal: number
  cost_mantenimiento: number
  cost_energia: number
  cost_floculante: number
  cost_coagulante: number
  cost_estabilizador_ph: number
  cost_dap: number
  cost_urea: number
  cost_melaza: number
  notes: string | null
  created_at: string
  updated_at: string
}

type Plant = {
  id: string
  name: string
}

export default function OpexCosts() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allPlantsData, setAllPlantsData] = useState<OpexCost[]>([])
  const [loadingAllPlants, setLoadingAllPlants] = useState(false)

  // CSV upload state
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: boolean; message: string; errors?: string[] } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Años disponibles para filtro
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - i)
  }, [])

  // Cargar plantas y verificar admin
  useEffect(() => {
    Promise.all([
      fetch('/api/plants', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()),
    ]).then(([plantsRes, authRes]) => {
      if (plantsRes.success && plantsRes.data) {
        setPlants(plantsRes.data)
      }
      setIsAdmin(authRes?.user?.role === 'admin')
    }).catch(err => {
      console.error('Error loading initial data:', err)
      setError('Error al cargar datos iniciales')
    })
  }, [])

  // Cargar datos de todas las plantas
  useEffect(() => {
    setLoadingAllPlants(true)
    const params = new URLSearchParams({ year: selectedYear.toString() })

    fetch(`/api/opex?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setAllPlantsData(res.data || [])
        }
      })
      .catch(err => console.error('Error loading all plants data:', err))
      .finally(() => setLoadingAllPlants(false))
  }, [selectedYear])

  // Datos agregados por planta para gráficos comparativos
  const plantComparisonData = useMemo(() => {
    if (allPlantsData.length === 0 || plants.length === 0) return []

    const plantMap = new Map<string, string>()
    plants.forEach(p => plantMap.set(p.id, p.name))

    const grouped = new Map<string, {
      totalVolume: number
      totalCosts: number
      costs: { agua: number; personal: number; mantenimiento: number; energia: number; quimicos: number }
      records: number
    }>()

    allPlantsData.forEach(cost => {
      const plantName = plantMap.get(cost.plant_id) || cost.plant_id
      const existing = grouped.get(plantName) || {
        totalVolume: 0,
        totalCosts: 0,
        costs: { agua: 0, personal: 0, mantenimiento: 0, energia: 0, quimicos: 0 },
        records: 0
      }

      const totalCost =
        cost.cost_agua + cost.cost_personal + cost.cost_mantenimiento + cost.cost_energia +
        cost.cost_floculante + cost.cost_coagulante + cost.cost_estabilizador_ph +
        cost.cost_dap + cost.cost_urea + cost.cost_melaza

      const quimicos = cost.cost_floculante + cost.cost_coagulante + cost.cost_estabilizador_ph +
        cost.cost_dap + cost.cost_urea + cost.cost_melaza

      existing.totalVolume += cost.volume_m3
      existing.totalCosts += totalCost
      existing.costs.agua += cost.cost_agua
      existing.costs.personal += cost.cost_personal
      existing.costs.mantenimiento += cost.cost_mantenimiento
      existing.costs.energia += cost.cost_energia
      existing.costs.quimicos += quimicos
      existing.records++

      grouped.set(plantName, existing)
    })

    return Array.from(grouped.entries()).map(([name, data]) => ({
      name,
      shortName: name.length > 12 ? name.slice(0, 10) + '...' : name,
      costPerM3: data.totalVolume > 0 ? data.totalCosts / data.totalVolume : 0,
      totalVolume: data.totalVolume,
      totalCosts: data.totalCosts,
      aguaPerM3: data.totalVolume > 0 ? data.costs.agua / data.totalVolume : 0,
      personalPerM3: data.totalVolume > 0 ? data.costs.personal / data.totalVolume : 0,
      mantenimientoPerM3: data.totalVolume > 0 ? data.costs.mantenimiento / data.totalVolume : 0,
      energiaPerM3: data.totalVolume > 0 ? data.costs.energia / data.totalVolume : 0,
      quimicosPerM3: data.totalVolume > 0 ? data.costs.quimicos / data.totalVolume : 0,
      records: data.records,
    })).sort((a, b) => a.costPerM3 - b.costPerM3)
  }, [allPlantsData, plants])

  // Datos mensuales para evolución temporal
  const monthlyTrendData = useMemo(() => {
    if (allPlantsData.length === 0 || plants.length === 0) return []

    const plantMap = new Map<string, string>()
    plants.forEach(p => plantMap.set(p.id, p.name))

    const months = new Map<string, Map<string, { volume: number; cost: number }>>()

    allPlantsData.forEach(cost => {
      const month = cost.period_date.slice(0, 7)
      const plantName = plantMap.get(cost.plant_id) || cost.plant_id

      if (!months.has(month)) {
        months.set(month, new Map())
      }

      const monthData = months.get(month)!
      const totalCost =
        cost.cost_agua + cost.cost_personal + cost.cost_mantenimiento + cost.cost_energia +
        cost.cost_floculante + cost.cost_coagulante + cost.cost_estabilizador_ph +
        cost.cost_dap + cost.cost_urea + cost.cost_melaza

      const existing = monthData.get(plantName) || { volume: 0, cost: 0 }
      existing.volume += cost.volume_m3
      existing.cost += totalCost
      monthData.set(plantName, existing)
    })

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, plantData]) => {
        const row: any = { month: new Date(month + '-01').toLocaleDateString('es-EC', { month: 'short' }) }
        plantData.forEach((data, plantName) => {
          row[plantName] = data.volume > 0 ? Number((data.cost / data.volume).toFixed(2)) : 0
        })
        return row
      })
  }, [allPlantsData, plants])

  // Calcular totales globales
  const globalStats = useMemo(() => {
    if (plantComparisonData.length === 0) return null

    const totalVolume = plantComparisonData.reduce((sum, p) => sum + p.totalVolume, 0)
    const totalCosts = plantComparisonData.reduce((sum, p) => sum + p.totalCosts, 0)
    const avgCostPerM3 = plantComparisonData.reduce((sum, p) => sum + p.costPerM3, 0) / plantComparisonData.length

    return {
      totalVolume,
      totalCosts,
      avgCostPerM3,
      minCost: plantComparisonData[0],
      maxCost: plantComparisonData[plantComparisonData.length - 1],
      plantCount: plantComparisonData.length
    }
  }, [plantComparisonData])

  // Colores suaves y armónicos (azules, verdes, turquesas, morados claros)
  const CHART_COLORS = [
    '#60a5fa', // azul claro
    '#34d399', // verde menta
    '#5eead4', // turquesa
    '#a78bfa', // morado lavanda
    '#67e8f9', // cyan claro
    '#86efac', // verde claro
    '#93c5fd', // azul cielo
    '#c4b5fd', // violeta claro
    '#6ee7b7', // esmeralda claro
    '#7dd3fc', // azul agua
    '#a5b4fc', // índigo claro
  ]

  const CATEGORY_CONFIG = {
    agua: { color: '#60a5fa', gradient: ['#93c5fd', '#60a5fa'], icon: Droplets, label: 'Agua' },
    personal: { color: '#a78bfa', gradient: ['#c4b5fd', '#a78bfa'], icon: Users, label: 'Personal' },
    mantenimiento: { color: '#fb923c', gradient: ['#fdba74', '#fb923c'], icon: Wrench, label: 'Mantenimiento' },
    energia: { color: '#facc15', gradient: ['#fef08a', '#facc15'], icon: Zap, label: 'Energía' },
    quimicos: { color: '#34d399', gradient: ['#6ee7b7', '#34d399'], icon: FlaskConical, label: 'Químicos' }
  }

  // Formatear moneda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  // Upload CSV file
  const uploadCSV = async (file: File) => {
    setCsvUploading(true)
    setCsvResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/opex/upload-csv', {
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
        // Reload data
        const allPlantsParams = new URLSearchParams({ year: selectedYear.toString() })
        const allPlantsRes = await fetch(`/api/opex?${allPlantsParams}`, { credentials: 'include' }).then(r => r.json())
        if (allPlantsRes.success) setAllPlantsData(allPlantsRes.data || [])
      } else {
        setCsvResult({
          success: false,
          message: result.error || 'Error al procesar el archivo',
          errors: result.errors,
        })
      }
    } catch (err: any) {
      setCsvResult({
        success: false,
        message: err.message || 'Error de conexión',
      })
    } finally {
      setCsvUploading(false)
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadCSV(file)
    }
  }

  const downloadTemplate = () => {
    window.location.href = '/api/opex/csv-template'
  }

  // Custom tooltip para gráficos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600 dark:text-gray-300">{entry.name}:</span>
              <span className="font-medium">${entry.value?.toFixed(2)}/m³</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header moderno */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/30">
                <DollarSign className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Costos OPEX
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Análisis comparativo de costos operacionales por m³
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de año */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-xl border-0 bg-white dark:bg-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-none text-gray-700 dark:text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Botones CSV */}
            {isAdmin && (
              <>
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
                  className={`px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2 font-medium transition-all ${
                    csvUploading
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                  }`}
                >
                  <Upload size={18} />
                  {csvUploading ? 'Subiendo...' : 'Importar CSV'}
                </label>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 shadow-lg shadow-gray-200/50 dark:shadow-none hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200"
                >
                  <Download size={18} />
                  Plantilla
                </button>
              </>
            )}
          </div>
        </div>

        {/* CSV Result */}
        {csvResult && (
          <div className={`mb-6 p-4 rounded-xl ${
            csvResult.success
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
          }`}>
            <p className={`font-medium ${csvResult.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {csvResult.message}
            </p>
            {csvResult.errors && csvResult.errors.length > 0 && (
              <ul className="mt-2 text-sm list-disc list-inside max-h-24 overflow-y-auto">
                {csvResult.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx} className="text-amber-600 dark:text-amber-400">{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-red-500" size={20} />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {loadingAllPlants ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-gray-500">Cargando datos...</p>
            </div>
          </div>
        ) : plantComparisonData.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <DollarSign className="text-gray-400" size={40} />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Sin datos para {selectedYear}</h3>
            <p className="text-gray-500">Suba un archivo CSV para comenzar a visualizar los costos OPEX.</p>
          </div>
        ) : globalStats && (
          <>
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Menor Costo */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Más Eficiente</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(globalStats.minCost.costPerM3)}
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                      {globalStats.minCost.name}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg shadow-emerald-500/30">
                    <TrendingDown className="text-white" size={22} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <ArrowDownRight size={14} />
                  <span>Menor costo por m³</span>
                </div>
              </div>

              {/* Mayor Costo */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Menos Eficiente</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(globalStats.maxCost.costPerM3)}
                    </p>
                    <p className="text-sm text-rose-600 dark:text-rose-400 font-medium mt-1">
                      {globalStats.maxCost.name}
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl shadow-lg shadow-rose-500/30">
                    <TrendingUp className="text-white" size={22} />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs text-rose-600 dark:text-rose-400">
                  <ArrowUpRight size={14} />
                  <span>Mayor costo por m³</span>
                </div>
              </div>

              {/* Promedio */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Promedio General</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(globalStats.avgCostPerM3)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      por m³ tratado
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/30">
                    <DollarSign className="text-white" size={22} />
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Basado en {globalStats.plantCount} plantas
                </div>
              </div>

              {/* Volumen Total */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Volumen Total</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(globalStats.totalVolume / 1000).toFixed(1)}k
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      m³ procesados
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
                    <Droplets className="text-white" size={22} />
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Costo total: {formatCurrency(globalStats.totalCosts)}
                </div>
              </div>
            </div>

            {/* Gráficos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Ranking de plantas */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Ranking de Eficiencia</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Costo por m³ ordenado de menor a mayor</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={plantComparisonData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                      <defs>
                        {plantComparisonData.map((_, index) => (
                          <linearGradient key={`grad-${index}`} id={`colorGrad-${index}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(1)}`} fontSize={12} stroke="#9ca3af" />
                      <YAxis type="category" dataKey="shortName" width={85} fontSize={11} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="costPerM3" radius={[0, 8, 8, 0]} barSize={20}>
                        {plantComparisonData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#colorGrad-${index})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Desglose por categoría */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Composición de Costos</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Desglose por categoría ($/m³)</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={plantComparisonData} margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="shortName" fontSize={10} stroke="#9ca3af" angle={-45} textAnchor="end" height={60} />
                      <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} fontSize={12} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: 20 }}
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                      <Bar dataKey="aguaPerM3" name="Agua" stackId="a" fill={CATEGORY_CONFIG.agua.color} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="personalPerM3" name="Personal" stackId="a" fill={CATEGORY_CONFIG.personal.color} />
                      <Bar dataKey="mantenimientoPerM3" name="Mant." stackId="a" fill={CATEGORY_CONFIG.mantenimiento.color} />
                      <Bar dataKey="energiaPerM3" name="Energía" stackId="a" fill={CATEGORY_CONFIG.energia.color} />
                      <Bar dataKey="quimicosPerM3" name="Químicos" stackId="a" fill={CATEGORY_CONFIG.quimicos.color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Evolución mensual */}
            {monthlyTrendData.length > 1 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Tendencia Mensual</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Evolución del costo por m³ a lo largo del año ({plants.length} plantas)</p>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrendData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                      <defs>
                        {plants.map((plant, index) => (
                          <linearGradient key={plant.id} id={`areaGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="month" fontSize={12} stroke="#9ca3af" />
                      <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} fontSize={12} stroke="#9ca3af" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ paddingTop: 10, fontSize: 11 }}
                        formatter={(value) => <span className="text-[10px]">{value}</span>}
                      />
                      {plants.map((plant, index) => (
                        <Area
                          key={plant.id}
                          type="monotone"
                          dataKey={plant.name}
                          stroke={CHART_COLORS[index % CHART_COLORS.length]}
                          strokeWidth={2}
                          fill={`url(#areaGrad-${index})`}
                          connectNulls
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tabla de resumen moderna */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detalle por Planta</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Resumen completo de costos OPEX {selectedYear}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Planta</th>
                      <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Vol. Total</th>
                      <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Costo Total</th>
                      <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">$/m³</th>
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <th key={key} className="px-3 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          <div className="flex items-center justify-end gap-1">
                            <config.icon size={12} style={{ color: config.color }} />
                            <span>{config.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {plantComparisonData.map((plant, idx) => (
                      <tr
                        key={plant.name}
                        className={`transition-colors ${
                          idx === 0
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            : idx === plantComparisonData.length - 1
                              ? 'bg-rose-50/50 dark:bg-rose-900/10 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                            />
                            <span className="font-medium text-gray-900 dark:text-white">{plant.name}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                                Mejor
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-600 dark:text-gray-300">
                          {plant.totalVolume.toLocaleString()} m³
                        </td>
                        <td className="px-4 py-4 text-right text-sm text-gray-600 dark:text-gray-300">
                          {formatCurrency(plant.totalCosts)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${
                            idx === 0 ? 'text-emerald-600 dark:text-emerald-400' :
                            idx === plantComparisonData.length - 1 ? 'text-rose-600 dark:text-rose-400' :
                            'text-gray-900 dark:text-white'
                          }`}>
                            {formatCurrency(plant.costPerM3)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(plant.aguaPerM3)}</td>
                        <td className="px-3 py-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(plant.personalPerM3)}</td>
                        <td className="px-3 py-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(plant.mantenimientoPerM3)}</td>
                        <td className="px-3 py-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(plant.energiaPerM3)}</td>
                        <td className="px-3 py-4 text-right text-sm text-gray-600 dark:text-gray-300">{formatCurrency(plant.quimicosPerM3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info para no-admin */}
            {!isAdmin && (
              <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 text-sm flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                  <AlertCircle size={18} />
                </div>
                Solo los administradores pueden importar datos de costos OPEX.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
