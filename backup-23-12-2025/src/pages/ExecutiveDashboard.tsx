/**
 * Executive Dashboard - High-level KPI view for management
 * Quick overview of all plants' performance
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Factory, Leaf, Wrench, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Clock, ArrowRight, Activity
} from 'lucide-react'
import { usePlants, useEnvironmentalData, useMaintenanceTasks, useEmergencies } from '../hooks/useApi'

// Thresholds for environmental parameters
const THRESHOLDS = {
  DQO: { ok: 150, warning: 180, critical: 200, unit: 'mg/L' },
  pH: { okMin: 6.5, okMax: 7.5, warningMin: 6, warningMax: 8, unit: '' },
  SS: { ok: 80, warning: 90, critical: 100, unit: 'mg/L' },
}

export default function ExecutiveDashboard() {
  const { data: plants, isLoading: plantsLoading } = usePlants()
  const { data: envData, isLoading: envLoading } = useEnvironmentalData()
  const { data: maintenance, isLoading: maintLoading } = useMaintenanceTasks()
  const { data: emergencies, isLoading: emergLoading } = useEmergencies()

  const isLoading = plantsLoading || envLoading || maintLoading || emergLoading

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!plants || !envData || !maintenance || !emergencies) return null

    // Environment compliance
    const plantCompliance = plants.map(plant => {
      const plantEnv = envData.filter(e => e.plant_id === plant.id && e.stream === 'effluent')
      if (plantEnv.length === 0) return { plant, compliant: true, issues: [] }

      const latest: Record<string, number> = {}
      plantEnv.forEach(e => {
        if (!latest[e.parameter_type]) latest[e.parameter_type] = e.value
      })

      const issues: string[] = []
      if (latest.DQO && latest.DQO >= THRESHOLDS.DQO.critical) issues.push('DQO')
      if (latest.pH && (latest.pH < THRESHOLDS.pH.warningMin || latest.pH > THRESHOLDS.pH.warningMax)) issues.push('pH')
      if (latest.SS && latest.SS >= THRESHOLDS.SS.critical) issues.push('SS')

      return { plant, compliant: issues.length === 0, issues, latest }
    })

    const compliantCount = plantCompliance.filter(p => p.compliant).length
    const envComplianceRate = plants.length ? Math.round((compliantCount / plants.length) * 100) : 0

    // Maintenance stats
    const completedTasks = maintenance.filter(t => t.status === 'completed').length
    const overdueTasks = maintenance.filter(t => t.status === 'overdue').length
    const maintCompletionRate = maintenance.length ? Math.round((completedTasks / maintenance.length) * 100) : 0

    // Emergency stats
    const activeEmergencies = emergencies.filter(e => !e.solved)
    const criticalEmergencies = activeEmergencies.filter(e => e.severity === 'high')
    const avgResolveTime = emergencies
      .filter(e => e.solved && e.resolve_time_hours)
      .reduce((sum, e, _, arr) => sum + (e.resolve_time_hours || 0) / arr.length, 0)

    return {
      envComplianceRate,
      compliantCount,
      totalPlants: plants.length,
      plantCompliance,
      maintCompletionRate,
      completedTasks,
      totalTasks: maintenance.length,
      overdueTasks,
      activeEmergencies: activeEmergencies.length,
      criticalEmergencies: criticalEmergencies.length,
      avgResolveTime: Math.round(avgResolveTime),
    }
  }, [plants, envData, maintenance, emergencies])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!kpis) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-20 text-gray-500">
          No se pudieron cargar los datos
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Panel Ejecutivo
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Resumen de rendimiento de todas las plantas PTAR
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={16} />
          Actualizado: {new Date().toLocaleString('es-EC')}
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Environmental Compliance */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Cumplimiento Ambiental</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-bold ${
                  kpis.envComplianceRate >= 80 ? 'text-emerald-600' :
                  kpis.envComplianceRate >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {kpis.envComplianceRate}%
                </p>
                {kpis.envComplianceRate >= 80 ? (
                  <TrendingUp className="text-emerald-500" size={20} />
                ) : (
                  <TrendingDown className="text-red-500" size={20} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {kpis.compliantCount}/{kpis.totalPlants} plantas en norma
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
              <Leaf className="text-white" size={24} />
            </div>
          </div>
        </div>

        {/* Maintenance Completion */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Mantenimientos</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-bold ${
                  kpis.maintCompletionRate >= 80 ? 'text-blue-600' :
                  kpis.maintCompletionRate >= 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {kpis.maintCompletionRate}%
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {kpis.completedTasks} completados de {kpis.totalTasks}
              </p>
              {kpis.overdueTasks > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {kpis.overdueTasks} atrasados
                </p>
              )}
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Wrench className="text-white" size={24} />
            </div>
          </div>
        </div>

        {/* Active Emergencies */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Emergencias Activas</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-bold ${
                  kpis.activeEmergencies === 0 ? 'text-emerald-600' :
                  kpis.criticalEmergencies > 0 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {kpis.activeEmergencies}
                </p>
                {kpis.activeEmergencies === 0 && <CheckCircle2 className="text-emerald-500" size={20} />}
              </div>
              {kpis.criticalEmergencies > 0 && (
                <p className="text-sm text-red-500 mt-2">
                  {kpis.criticalEmergencies} críticas
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Tiempo promedio: {kpis.avgResolveTime}h
              </p>
            </div>
            <div className={`p-3 rounded-xl shadow-lg ${
              kpis.activeEmergencies > 0
                ? 'bg-gradient-to-br from-red-500 to-rose-600'
                : 'bg-gradient-to-br from-emerald-500 to-green-600'
            }`}>
              <AlertTriangle className="text-white" size={24} />
            </div>
          </div>
        </div>

        {/* Plants Overview */}
        <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Plantas PTAR</p>
              <p className="text-4xl font-bold text-violet-600">{kpis.totalPlants}</p>
              <p className="text-sm text-gray-500 mt-2">
                Operando normalmente
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <Factory className="text-white" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Plant Status Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Estado por Planta
          </h2>
          <Link
            to="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Ver detalles <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Planta</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">DQO</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">pH</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SS</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {kpis.plantCompliance.map(({ plant, compliant, issues, latest }) => (
                <tr key={plant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${compliant ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        <Factory size={16} className={compliant ? 'text-emerald-600' : 'text-red-600'} />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{plant.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {latest?.DQO !== undefined ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        latest.DQO >= THRESHOLDS.DQO.critical ? 'bg-red-100 text-red-800' :
                        latest.DQO >= THRESHOLDS.DQO.warning ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {latest.DQO.toFixed(0)} mg/L
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {latest?.pH !== undefined ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        latest.pH < THRESHOLDS.pH.warningMin || latest.pH > THRESHOLDS.pH.warningMax
                          ? 'bg-red-100 text-red-800'
                          : latest.pH < THRESHOLDS.pH.okMin || latest.pH > THRESHOLDS.pH.okMax
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {latest.pH.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {latest?.SS !== undefined ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        latest.SS >= THRESHOLDS.SS.critical ? 'bg-red-100 text-red-800' :
                        latest.SS >= THRESHOLDS.SS.warning ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {latest.SS.toFixed(0)} mg/L
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {compliant ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} /> En norma
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircle size={12} /> Alerta: {issues.join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          to="/dashboard"
          className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1 transition-all"
        >
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Ver Analíticas</h3>
            <p className="text-sm text-gray-500">Gráficos y tendencias detalladas</p>
          </div>
          <ArrowRight className="ml-auto text-gray-400" size={20} />
        </Link>

        <Link
          to="/maintenance"
          className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1 transition-all"
        >
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <Wrench className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Cronograma</h3>
            <p className="text-sm text-gray-500">Plan de mantenimiento anual</p>
          </div>
          <ArrowRight className="ml-auto text-gray-400" size={20} />
        </Link>

        <Link
          to="/emergencies"
          className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:-translate-y-1 transition-all"
        >
          <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl">
            <AlertTriangle className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Emergencias</h3>
            <p className="text-sm text-gray-500">Gestión de incidentes</p>
          </div>
          <ArrowRight className="ml-auto text-gray-400" size={20} />
        </Link>
      </div>
    </div>
  )
}
