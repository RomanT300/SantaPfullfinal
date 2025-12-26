/**
 * Supervisor Reports Page - Complete Checklist Monitoring System
 * - View checklists by plant and day
 * - See overall status and red flags
 * - Monitor operator compliance
 * - Track plant performance metrics
 */
import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardCheck,
  Flag,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  RefreshCw,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  X,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Users,
  Building2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Percent,
} from 'lucide-react'
import { usePlants } from '../../hooks/useApi'

// Types
interface SupervisorReport {
  id: string
  checklist_id: string
  plant_id: string
  plant_name: string
  plant_location: string
  operator_name: string
  report_date: string
  total_items: number
  checked_items: number
  red_flag_count: number
  notes: string | null
  sent_at: string
  read_at: string | null
  read_by: string | null
}

interface RedFlag {
  id: string
  checklist_item_id: string
  checklist_id: string
  plant_id: string
  plant_name: string
  operator_name: string
  section: string
  element: string
  activity: string
  comment: string | null
  photo_path: string | null
  flagged_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_notes: string | null
}

interface ChecklistSummary {
  id: string
  plant_id: string
  plant_name: string
  date: string
  operator_name: string
  total_items: number
  checked_items: number
  red_flags: number
  progress: number
  completed_at: string | null
  items?: any[]
}

interface OperatorStats {
  operator_name: string
  total_checklists: number
  completed_checklists: number
  completion_rate: number
  avg_completion_percent: number
  total_red_flags: number
  avg_items_per_checklist: number
}

interface PlantPerformance {
  id: string
  name: string
  total_checklists: number
  completed_checklists: number
  compliance_rate: number | null
  total_red_flags: number
  pending_red_flags: number
  avg_items_completion: number | null
  active_operators: number
  status: 'excellent' | 'good' | 'needs_attention' | 'critical'
}

interface ReportDetails {
  report: SupervisorReport
  items: Record<string, any[]>
  allItems: any[]
}

type TabType = 'overview' | 'redflags' | 'operators' | 'performance'

export default function SupervisorReports() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [checklists, setChecklists] = useState<ChecklistSummary[]>([])
  const [redFlags, setRedFlags] = useState<RedFlag[]>([])
  const [redFlagStats, setRedFlagStats] = useState({ total: 0, pending: 0, resolved: 0 })
  const [operatorStats, setOperatorStats] = useState<OperatorStats[]>([])
  const [plantPerformance, setPlantPerformance] = useState<PlantPerformance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlant, setSelectedPlant] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [daysFilter, setDaysFilter] = useState(30)
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [selectedChecklist, setSelectedChecklist] = useState<any | null>(null)
  const [showChecklistModal, setShowChecklistModal] = useState(false)

  const { data: plants } = usePlants()

  // Fetch all checklists
  const fetchChecklists = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('days', daysFilter.toString())
      if (selectedPlant) params.set('plantId', selectedPlant)

      const response = await fetch(`/api/checklist/supervisor/all?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setChecklists(data.data.checklists || [])
        setOperatorStats(data.data.operatorStats || [])
        setPlantPerformance(data.data.plantPerformance || [])
      }
    } catch (error) {
      console.error('Error fetching checklists:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch red flags
  const fetchRedFlags = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('days', daysFilter.toString())
      if (selectedPlant) params.set('plantId', selectedPlant)
      if (showOnlyPending) params.set('resolved', 'false')

      const response = await fetch(`/api/checklist/red-flags?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setRedFlags(data.data.redFlags || [])
        setRedFlagStats(data.data.stats || { total: 0, pending: 0, resolved: 0 })
      }
    } catch (error) {
      console.error('Error fetching red flags:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchChecklists()
    fetchRedFlags()
  }, [selectedPlant, daysFilter])

  useEffect(() => {
    if (activeTab === 'redflags') {
      fetchRedFlags()
    }
  }, [showOnlyPending])

  // View checklist details
  const viewChecklist = async (checklistId: string) => {
    try {
      const response = await fetch(`/api/checklist/${checklistId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedChecklist(data.data)
        setShowChecklistModal(true)
      }
    } catch (error) {
      console.error('Error fetching checklist details:', error)
    }
  }

  // Resolve red flag
  const resolveRedFlag = async (flagId: string, notes?: string) => {
    try {
      await fetch(`/api/checklist/red-flag/${flagId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: notes }),
      })
      fetchRedFlags()
    } catch (error) {
      console.error('Error resolving red flag:', error)
    }
  }

  // Filter checklists by date
  const filteredChecklists = useMemo(() => {
    if (!selectedDate) return checklists
    return checklists.filter(c => c.date === selectedDate)
  }, [checklists, selectedDate])

  // Group checklists by date
  const checklistsByDate = useMemo(() => {
    const grouped: Record<string, ChecklistSummary[]> = {}
    checklists.forEach(c => {
      if (!grouped[c.date]) grouped[c.date] = []
      grouped[c.date].push(c)
    })
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
  }, [checklists])

  // Overall stats
  const overallStats = useMemo(() => {
    const total = checklists.length
    const completed = checklists.filter(c => c.completed_at).length
    const withProblems = checklists.filter(c => c.red_flags > 0).length
    const avgCompletion = total > 0 ? checklists.reduce((acc, c) => acc + c.progress, 0) / total : 0
    return { total, completed, withProblems, avgCompletion }
  }, [checklists])

  const pendingRedFlags = redFlagStats.pending || 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg">
                <Eye className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Panel de Supervisor
                </h1>
                <p className="text-sm text-gray-500">
                  Monitoreo de checklists, problemas y cumplimiento
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchChecklists()
                fetchRedFlags()
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon={<ClipboardCheck size={18} />}
              label="Checklists"
              badge={overallStats.total}
            />
            <TabButton
              active={activeTab === 'redflags'}
              onClick={() => setActiveTab('redflags')}
              icon={<Flag size={18} />}
              label="Problemas"
              badge={pendingRedFlags}
              badgeColor="red"
            />
            <TabButton
              active={activeTab === 'operators'}
              onClick={() => setActiveTab('operators')}
              icon={<Users size={18} />}
              label="Operadores"
            />
            <TabButton
              active={activeTab === 'performance'}
              onClick={() => setActiveTab('performance')}
              icon={<TrendingUp size={18} />}
              label="Performance"
            />
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

          {activeTab === 'overview' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200"
            />
          )}

          {activeTab === 'redflags' && (
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
                className="rounded border-gray-300"
              />
              Solo pendientes
            </label>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                checklists={filteredChecklists}
                checklistsByDate={checklistsByDate}
                overallStats={overallStats}
                selectedDate={selectedDate}
                onViewChecklist={viewChecklist}
              />
            )}
            {activeTab === 'redflags' && (
              <RedFlagsTab redFlags={redFlags} stats={redFlagStats} onResolve={resolveRedFlag} />
            )}
            {activeTab === 'operators' && (
              <OperatorsTab operators={operatorStats} />
            )}
            {activeTab === 'performance' && (
              <PerformanceTab plants={plantPerformance} />
            )}
          </>
        )}
      </div>

      {/* Checklist Detail Modal */}
      {showChecklistModal && selectedChecklist && (
        <ChecklistModal
          checklist={selectedChecklist}
          onClose={() => {
            setShowChecklistModal(false)
            setSelectedChecklist(null)
          }}
        />
      )}
    </div>
  )
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = 'blue',
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
  badgeColor?: 'blue' | 'red' | 'green'
}) {
  const badgeColors = {
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className={`px-2 py-0.5 text-xs ${badgeColors[badgeColor]} text-white rounded-full`}>
          {badge}
        </span>
      )}
    </button>
  )
}

// Overview Tab Component
function OverviewTab({
  checklists,
  checklistsByDate,
  overallStats,
  selectedDate,
  onViewChecklist,
}: {
  checklists: ChecklistSummary[]
  checklistsByDate: [string, ChecklistSummary[]][]
  overallStats: { total: number; completed: number; withProblems: number; avgCompletion: number }
  selectedDate: string
  onViewChecklist: (id: string) => void
}) {
  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<ClipboardCheck size={20} />}
          label="Total Checklists"
          value={overallStats.total}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Completados"
          value={overallStats.completed}
          color="green"
        />
        <StatCard
          icon={<AlertCircle size={20} />}
          label="Con Problemas"
          value={overallStats.withProblems}
          color="red"
        />
        <StatCard
          icon={<Percent size={20} />}
          label="Promedio Completado"
          value={`${Math.round(overallStats.avgCompletion)}%`}
          color="purple"
        />
      </div>

      {/* Checklists for selected date */}
      {selectedDate && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar size={20} />
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>

          {checklists.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
              <ClipboardCheck size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No hay checklists para esta fecha</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {checklists.map(checklist => (
                <ChecklistCard
                  key={checklist.id}
                  checklist={checklist}
                  onView={() => onViewChecklist(checklist.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent checklists by date */}
      {!selectedDate && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Historial de Checklists
          </h3>
          {checklistsByDate.map(([date, dateChecklists]) => (
            <div key={date} className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                <Calendar size={16} />
                {new Date(date + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'short' })}
                <span className="text-gray-400">({dateChecklists.length} checklists)</span>
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                {dateChecklists.map(checklist => (
                  <ChecklistCard
                    key={checklist.id}
                    checklist={checklist}
                    onView={() => onViewChecklist(checklist.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: 'blue' | 'green' | 'red' | 'purple' | 'amber'
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  )
}

// Checklist Card Component
function ChecklistCard({
  checklist,
  onView,
}: {
  checklist: ChecklistSummary
  onView: () => void
}) {
  const hasProblems = checklist.red_flags > 0
  const isComplete = checklist.progress === 100
  const okItems = checklist.checked_items - checklist.red_flags

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${
        hasProblems ? 'border-l-4 border-red-500' : isComplete ? 'border-l-4 border-green-500' : ''
      }`}
      onClick={onView}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${
            hasProblems
              ? 'bg-red-100 dark:bg-red-900/30'
              : isComplete
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {hasProblems ? (
              <AlertTriangle className="text-red-600 dark:text-red-400" size={20} />
            ) : isComplete ? (
              <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
            ) : (
              <ClipboardCheck className="text-blue-600 dark:text-blue-400" size={20} />
            )}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {checklist.plant_name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <User size={14} />
              {checklist.operator_name}
            </div>
          </div>
        </div>
        <Eye size={18} className="text-gray-400" />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-500">Progreso</span>
          <span className={`font-medium ${
            hasProblems ? 'text-red-600' : isComplete ? 'text-green-600' : 'text-blue-600'
          }`}>
            {checklist.checked_items}/{checklist.total_items} ({checklist.progress || 0}%)
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              hasProblems ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${checklist.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 mt-3">
        {okItems > 0 && (
          <span className="px-2 py-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center gap-1">
            <CheckCircle2 size={12} />
            {okItems} OK
          </span>
        )}
        {checklist.red_flags > 0 && (
          <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full flex items-center gap-1">
            <Flag size={12} />
            {checklist.red_flags} Problemas
          </span>
        )}
        {checklist.completed_at && (
          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
            Enviado
          </span>
        )}
      </div>
    </div>
  )
}

// Red Flags Tab Component
function RedFlagsTab({
  redFlags,
  stats,
  onResolve,
}: {
  redFlags: RedFlag[]
  stats: { total: number; pending: number; resolved: number }
  onResolve: (id: string, notes?: string) => void
}) {
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')

  const handleResolve = (flagId: string) => {
    onResolve(flagId, resolutionNotes)
    setResolvingId(null)
    setResolutionNotes('')
  }

  // Group by plant
  const redFlagsByPlant = useMemo(() => {
    const grouped: Record<string, RedFlag[]> = {}
    redFlags.forEach(flag => {
      if (!grouped[flag.plant_name]) grouped[flag.plant_name] = []
      grouped[flag.plant_name].push(flag)
    })
    return Object.entries(grouped)
  }, [redFlags])

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Flag size={20} />}
          label="Total Problemas"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={<AlertCircle size={20} />}
          label="Pendientes"
          value={stats.pending}
          color="red"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Resueltos"
          value={stats.resolved}
          color="green"
        />
      </div>

      {redFlags.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-gray-500">No hay problemas reportados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {redFlagsByPlant.map(([plantName, flags]) => (
            <div key={plantName}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Building2 size={20} />
                {plantName}
                <span className="text-sm font-normal text-gray-500">({flags.length} problemas)</span>
              </h3>
              <div className="space-y-3">
                {flags.map(flag => (
                  <div
                    key={flag.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 ${
                      !flag.resolved_at ? 'border-l-4 border-red-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Flag size={16} className={flag.resolved_at ? 'text-gray-400' : 'text-red-500'} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {flag.element}
                          </span>
                          {flag.resolved_at && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                              Resuelto
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {flag.activity}
                        </p>
                        {flag.comment && (
                          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-400">{flag.comment}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {flag.operator_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(flag.flagged_at).toLocaleDateString('es-EC')}
                          </span>
                        </div>
                      </div>

                      {!flag.resolved_at && (
                        <button
                          onClick={() => setResolvingId(flag.id)}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          Resolver
                        </button>
                      )}
                    </div>

                    {flag.resolved_at && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs text-gray-500">
                          Resuelto por {flag.resolved_by} el {new Date(flag.resolved_at).toLocaleString('es-EC')}
                        </p>
                        {flag.resolution_notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{flag.resolution_notes}</p>
                        )}
                      </div>
                    )}

                    {resolvingId === flag.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Notas de resolución (opcional)..."
                          className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              setResolvingId(null)
                              setResolutionNotes('')
                            }}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleResolve(flag.id)}
                            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Confirmar Resolución
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Operators Tab Component
function OperatorsTab({ operators }: { operators: OperatorStats[] }) {
  const sortedOperators = useMemo(() => {
    return [...operators].sort((a, b) => b.completion_rate - a.completion_rate)
  }, [operators])

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Cumplimiento de Operadores
      </h3>

      {operators.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No hay datos de operadores</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedOperators.map((op, index) => (
            <div
              key={op.operator_name}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {op.operator_name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {op.total_checklists} checklists realizados
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${
                    op.completion_rate >= 90 ? 'text-green-600' : op.completion_rate >= 70 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {Math.round(op.completion_rate)}%
                  </p>
                  <p className="text-xs text-gray-500">Tasa de completado</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500">Completados</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{op.completed_checklists}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Promedio Items</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{Math.round(op.avg_completion_percent)}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Red Flags</p>
                  <p className={`font-semibold ${op.total_red_flags > 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {op.total_red_flags}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Items/Checklist</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{Math.round(op.avg_items_per_checklist)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      op.completion_rate >= 90 ? 'bg-green-500' : op.completion_rate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${op.completion_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Performance Tab Component
function PerformanceTab({ plants }: { plants: PlantPerformance[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-500' }
      case 'good': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500' }
      case 'needs_attention': return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500' }
      default: return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-500' }
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent': return 'Excelente'
      case 'good': return 'Bueno'
      case 'needs_attention': return 'Requiere Atención'
      default: return 'Crítico'
    }
  }

  const sortedPlants = useMemo(() => {
    return [...plants].sort((a, b) => (b.compliance_rate || 0) - (a.compliance_rate || 0))
  }, [plants])

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Performance por Planta
      </h3>

      {plants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No hay datos de plantas</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedPlants.map((plant, index) => {
            const colors = getStatusColor(plant.status)
            const complianceRate = plant.compliance_rate || 0
            const avgCompletion = plant.avg_items_completion || 0

            return (
              <div
                key={plant.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 ${
                  index === 0 && plant.status === 'excellent' ? `md:col-span-2 border-2 ${colors.border}` : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${colors.bg}`}>
                      <Building2 className={colors.text} size={24} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {plant.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${colors.bg} ${colors.text}`}>
                          {getStatusLabel(plant.status)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {plant.active_operators} operador{plant.active_operators !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${colors.text}`}>
                      {Math.round(complianceRate)}%
                    </p>
                    <p className="text-xs text-gray-500">Cumplimiento</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Tasa de completado</span>
                    <span>{Math.round(avgCompletion)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        avgCompletion >= 90 ? 'bg-green-500' : avgCompletion >= 70 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${avgCompletion}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-500">Checklists</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{plant.total_checklists}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Completados</p>
                    <p className="font-semibold text-green-600">{plant.completed_checklists}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Red Flags</p>
                    <p className={`font-semibold ${plant.total_red_flags > 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                      {plant.total_red_flags}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pendientes</p>
                    <p className={`font-semibold ${plant.pending_red_flags > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {plant.pending_red_flags}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Checklist Detail Modal
function ChecklistModal({
  checklist,
  onClose,
}: {
  checklist: any
  onClose: () => void
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const info = checklist.checklist || checklist
  const items = checklist.items || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Detalle del Checklist
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {info.operator_name} - {new Date((info.check_date || info.date) + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {Object.entries(items).length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay items en este checklist</p>
          ) : (
            Object.entries(items).map(([section, sectionItems]) => (
              <div key={section} className="mb-4">
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {section.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {(sectionItems as any[]).filter((i: any) => i.is_checked).length}/{(sectionItems as any[]).length}
                    </span>
                    {expandedSections.has(section) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </button>

                {expandedSections.has(section) && (
                  <div className="mt-2 space-y-2">
                    {(sectionItems as any[]).map((item: any) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${
                          item.is_red_flag
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : item.is_checked
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {item.is_red_flag ? (
                            <Flag size={18} className="text-red-600 mt-0.5" />
                          ) : item.is_checked ? (
                            <CheckCircle size={18} className="text-green-600 mt-0.5" />
                          ) : (
                            <XCircle size={18} className="text-gray-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-white">
                              {item.item_description}
                            </p>
                            {item.observation && (
                              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <MessageSquare size={12} />
                                {item.observation}
                              </p>
                            )}
                            {item.red_flag_comment && (
                              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <Flag size={12} />
                                {item.red_flag_comment}
                              </p>
                            )}
                            {item.numeric_value !== null && item.numeric_value !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                Valor: <span className="font-medium">{item.numeric_value}</span> {item.unit || item.template_unit || ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
