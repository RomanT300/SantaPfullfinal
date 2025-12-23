/**
 * Operational Measurements Page
 * Shows energy consumption, chemical usage, pressure, flow, and other operational metrics
 * Water quality parameters (pH, DQO, SS) go to Analytics - this page is for operational control
 */
import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  Zap,
  RefreshCw,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Droplets,
  Gauge,
  Factory,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Activity,
  Clock,
  Beaker,
  Wind,
} from 'lucide-react'
import { usePlants } from '../hooks/useApi'

interface OperationalMeasurement {
  id: string
  checklist_id: string
  item_description: string
  category: string
  numeric_value: number
  unit: string
  observation: string | null
  checked_at: string
  check_date: string
  plant_id: string
  operator_name: string
  plant_name: string
  measurement_category: string
  equipment_type: string
}

interface Deviation extends OperationalMeasurement {
  expected_avg: number
  expected_stdDev: number
  deviation_percent: string
  severity: 'warning' | 'critical'
}

interface CategoryStats {
  totalMeasurements: number
  uniqueMetrics: number
  metrics: Record<string, {
    count: number
    avg: number
    min: number
    max: number
    stdDev: number
    unit: string
    equipment: string
    anomalies: number
  }>
}

interface Summary {
  totalMeasurements: number
  totalDeviations: number
  criticalDeviations: number
  categoryCounts: Record<string, number>
}

// Category configuration
const categoryConfig: Record<string, { label: string; icon: any; color: string; bgColor: string; description: string }> = {
  'reactor_solids': {
    label: 'SS Reactor',
    icon: Factory,
    color: '#ef4444',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    description: 'Sólidos suspendidos en reactor biológico'
  },
  'sludge_solids': {
    label: 'SS Lodos',
    icon: Droplets,
    color: '#a855f7',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Sólidos suspendidos en tanque de lodos'
  },
  'purge': {
    label: 'Purga',
    icon: Clock,
    color: '#f97316',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Minutos de purga diaria'
  },
  'energy': {
    label: 'Energía',
    icon: Zap,
    color: '#f59e0b',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Consumo eléctrico, voltaje, amperaje'
  },
  'chemicals': {
    label: 'Químicos',
    icon: Beaker,
    color: '#8b5cf6',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
    description: 'Dosificación de cloro, coagulantes, floculantes'
  },
  'pressure': {
    label: 'Presión',
    icon: Gauge,
    color: '#ec4899',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
    description: 'Presión de bombas, filtros, líneas'
  },
  'flow': {
    label: 'Caudal',
    icon: Wind,
    color: '#06b6d4',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    description: 'Flujo de agua, aire, lodos'
  },
  'level': {
    label: 'Nivel',
    icon: Droplets,
    color: '#3b82f6',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Niveles de tanques, reactores'
  },
  'runtime': {
    label: 'Tiempo Op.',
    icon: Clock,
    color: '#10b981',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Horas de operación de equipos'
  },
  'other': {
    label: 'Otros',
    icon: Activity,
    color: '#6b7280',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    description: 'Otras mediciones operacionales'
  },
}

export default function ChecklistMeasurements() {
  const [measurements, setMeasurements] = useState<OperationalMeasurement[]>([])
  const [stats, setStats] = useState<Record<string, CategoryStats>>({})
  const [chartData, setChartData] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [byCategory, setByCategory] = useState<Record<string, OperationalMeasurement[]>>({})
  const [deviations, setDeviations] = useState<Deviation[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlant, setSelectedPlant] = useState<string>('')
  const [daysFilter, setDaysFilter] = useState(30)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['energy', 'chemicals']))
  const [activeTab, setActiveTab] = useState<'overview' | 'deviations' | 'details'>('overview')

  const { data: plants } = usePlants()

  // Fetch operational measurements
  const fetchMeasurements = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('days', daysFilter.toString())
      if (selectedPlant) params.set('plantId', selectedPlant)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)

      const response = await fetch(`/api/checklist/operational-measurements?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json()

      if (data.success) {
        setMeasurements(data.data.measurements)
        setStats(data.data.stats)
        setChartData(data.data.chartData)
        setCategories(data.data.categories)
        setByCategory(data.data.byCategory)
        setDeviations(data.data.deviations)
        setSummary(data.data.summary)
      }
    } catch (error) {
      console.error('Error fetching operational measurements:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMeasurements()
  }, [selectedPlant, daysFilter, selectedCategory])

  const toggleSection = (category: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedSections(newExpanded)
  }

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Fecha', 'Planta', 'Categoría', 'Descripción', 'Valor', 'Unidad', 'Equipo', 'Operador', 'Observación']
    const rows = measurements.map(m => [
      m.check_date,
      m.plant_name,
      categoryConfig[m.measurement_category]?.label || m.measurement_category,
      m.item_description,
      m.numeric_value,
      m.unit,
      m.equipment_type,
      m.operator_name,
      m.observation || '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mediciones_operacionales_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
                <Zap className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Mediciones Operacionales
                </h1>
                <p className="text-sm text-gray-500">
                  Energía, químicos, presión y control de desviaciones
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCSV}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <Download size={18} />
                Exportar CSV
              </button>
              <button
                onClick={fetchMeasurements}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
          <Filter size={18} className="text-gray-400" />

          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="">Todas las plantas</option>
            {plants?.map(plant => (
              <option key={plant.id} value={plant.id}>{plant.name}</option>
            ))}
          </select>

          <select
            value={daysFilter}
            onChange={(e) => setDaysFilter(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="all">Todas las categorías</option>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>

          <div className="ml-auto text-sm text-gray-500">
            {measurements.length} mediciones
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Resumen', icon: Activity },
            { id: 'deviations', label: 'Desviaciones', icon: AlertTriangle },
            { id: 'details', label: 'Detalle', icon: Factory },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.id === 'deviations' && deviations.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs rounded-full">
                  {deviations.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <Activity size={16} />
                      Total Mediciones
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {summary.totalMeasurements}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <AlertTriangle size={16} />
                      Desviaciones
                    </div>
                    <div className="text-2xl font-bold text-amber-600">
                      {summary.totalDeviations}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-red-500 text-sm mb-1">
                      <AlertTriangle size={16} />
                      Críticas
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {summary.criticalDeviations}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <Factory size={16} />
                      Categorías
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {categories.length}
                    </div>
                  </div>
                </div>
              )}

              {/* Category Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Object.entries(categoryConfig).map(([key, config]) => {
                  const catStats = stats[key]
                  if (!catStats) return null
                  const Icon = config.icon
                  return (
                    <div key={key} className={`${config.bgColor} rounded-xl p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={18} style={{ color: config.color }} />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {config.label}
                        </span>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: config.color }}>
                        {catStats.totalMeasurements}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {catStats.uniqueMetrics} métricas diferentes
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trend Chart */}
              {chartData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Tendencia por Categoría
                  </h2>
                  <div className="h-80">
                    <ResponsiveContainer>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v) => new Date(v).toLocaleDateString('es-EC', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis />
                        <Tooltip
                          labelFormatter={(v) => new Date(v as string).toLocaleDateString('es-EC')}
                        />
                        <Legend />
                        {categories.map((cat) => (
                          <Bar
                            key={cat}
                            dataKey={cat}
                            name={categoryConfig[cat]?.label || cat}
                            fill={categoryConfig[cat]?.color || '#6b7280'}
                            stackId="a"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Deviations Tab */}
          {activeTab === 'deviations' && (
            <div className="space-y-4">
              {deviations.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <TrendingUp size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Sin desviaciones detectadas
                  </h3>
                  <p className="text-gray-500">
                    Todas las mediciones están dentro de los rangos normales
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-amber-600" size={24} />
                      <div>
                        <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                          {deviations.length} desviaciones detectadas
                        </h3>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          Valores que se desvían significativamente del promedio histórico
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Severidad</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Fecha</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Planta</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Métrica</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Valor</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Esperado</th>
                          <th className="p-3 text-left text-gray-600 dark:text-gray-300">Desviación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviations.map((d) => {
                          const config = categoryConfig[d.measurement_category] || categoryConfig['other']
                          return (
                            <tr key={d.id} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  d.severity === 'critical'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                                }`}>
                                  {d.severity === 'critical' ? 'Crítica' : 'Alerta'}
                                </span>
                              </td>
                              <td className="p-3 text-gray-700 dark:text-gray-300">
                                {new Date(d.check_date).toLocaleDateString('es-EC')}
                              </td>
                              <td className="p-3 text-gray-700 dark:text-gray-300">
                                {d.plant_name}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <config.icon size={14} style={{ color: config.color }} />
                                  <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                                    {d.item_description}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-red-600">
                                  {d.numeric_value} {d.unit}
                                </span>
                              </td>
                              <td className="p-3 text-gray-500">
                                {d.expected_avg.toFixed(2)} {d.unit}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  {parseFloat(d.deviation_percent) > 0 ? (
                                    <TrendingUp size={14} className="text-red-500" />
                                  ) : (
                                    <TrendingDown size={14} className="text-blue-500" />
                                  )}
                                  <span className={parseFloat(d.deviation_percent) > 0 ? 'text-red-600' : 'text-blue-600'}>
                                    {d.deviation_percent}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {categories.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
                  <Zap size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No hay mediciones operacionales
                  </h3>
                  <p className="text-gray-500">
                    Las mediciones de energía, químicos y otros parámetros operacionales aparecerán aquí.
                  </p>
                </div>
              ) : (
                categories.map((cat) => {
                  const catMeasurements = byCategory[cat] || []
                  const config = categoryConfig[cat] || categoryConfig['other']
                  const Icon = config.icon
                  const isExpanded = expandedSections.has(cat)
                  const catStats = stats[cat]

                  return (
                    <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                      <button
                        onClick={() => toggleSection(cat)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.bgColor}`}>
                            <Icon size={20} style={{ color: config.color }} />
                          </div>
                          <div className="text-left">
                            <span className="font-semibold text-gray-900 dark:text-white">{config.label}</span>
                            <span className="ml-2 text-sm text-gray-500">({catMeasurements.length} registros)</span>
                            <p className="text-xs text-gray-400">{config.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {catStats && (
                            <span className="text-sm text-gray-500">
                              {catStats.uniqueMetrics} métricas
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronDown size={20} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && catMeasurements.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700">
                          {/* Stats for this category */}
                          {catStats && Object.keys(catStats.metrics).length > 0 && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Estadísticas por métrica
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(catStats.metrics).slice(0, 6).map(([desc, stat]) => (
                                  <div key={desc} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                                    <div className="text-xs text-gray-500 truncate mb-1" title={desc}>
                                      {desc}
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-lg font-semibold" style={{ color: config.color }}>
                                        {stat.avg.toFixed(1)}
                                      </span>
                                      <span className="text-xs text-gray-400">{stat.unit}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      min {stat.min.toFixed(1)} · max {stat.max.toFixed(1)}
                                      {stat.anomalies > 0 && (
                                        <span className="ml-2 text-amber-500">
                                          {stat.anomalies} anomalías
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Fecha</th>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Planta</th>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Valor</th>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Descripción</th>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Equipo</th>
                                  <th className="p-3 text-left text-gray-600 dark:text-gray-300">Operador</th>
                                </tr>
                              </thead>
                              <tbody>
                                {catMeasurements.slice(0, 20).map((m) => (
                                  <tr key={m.id} className="border-t border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                        <Calendar size={14} className="text-gray-400" />
                                        {new Date(m.check_date).toLocaleDateString('es-EC')}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                        <Factory size={14} className="text-gray-400" />
                                        {m.plant_name}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className="font-semibold" style={{ color: config.color }}>
                                        {m.numeric_value} {m.unit}
                                      </span>
                                    </td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                      {m.item_description}
                                    </td>
                                    <td className="p-3">
                                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                                        {m.equipment_type}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                        <User size={14} className="text-gray-400" />
                                        {m.operator_name}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {catMeasurements.length > 20 && (
                              <div className="p-3 text-center text-sm text-gray-500">
                                Mostrando 20 de {catMeasurements.length} registros
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Empty state */}
          {measurements.length === 0 && !isLoading && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
              <Zap size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay mediciones operacionales
              </h3>
              <p className="text-gray-500 mb-4">
                Las mediciones de energía, químicos, presión y otros parámetros operacionales aparecerán aquí
                cuando los operadores completen los checklists desde la app móvil.
              </p>
              <p className="text-sm text-gray-400">
                Nota: Los parámetros de calidad de agua (pH, DQO, SS) se registran en la sección de Analíticas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
