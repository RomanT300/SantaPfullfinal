/**
 * Admin Dashboard (Super Admin)
 * Overview of all organizations, usage metrics, and system health
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Loader2,
  Activity,
  HardDrive,
  Zap
} from 'lucide-react'

interface AdminStats {
  organizations: {
    total: number
    active: number
    new_this_month: number
  }
  users: {
    total: number
    active_today: number
  }
  revenue: {
    mrr: number
    this_month: number
  }
  usage: {
    total_plants: number
    total_documents: number
    storage_used_gb: number
    api_calls_today: number
  }
}

interface RecentOrg {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
  users_count: number
  plants_count: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, orgsRes] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }),
        fetch('/api/admin/organizations?limit=5&sort=created_at:desc', { credentials: 'include' })
      ])

      const statsData = await statsRes.json()
      const orgsData = await orgsRes.json()

      if (statsData.success) setStats(statsData.data)
      if (orgsData.success) setRecentOrgs(orgsData.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  // Mock data for demo
  const mockStats: AdminStats = stats || {
    organizations: { total: 24, active: 22, new_this_month: 5 },
    users: { total: 156, active_today: 34 },
    revenue: { mrr: 3451, this_month: 980 },
    usage: { total_plants: 87, total_documents: 1243, storage_used_gb: 12.4, api_calls_today: 15420 }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutDashboard size={28} />
          Panel de Administración
        </h1>
        <p className="text-gray-500 mt-1">
          Vista general del sistema
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {/* Organizations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Building2 size={24} className="text-blue-600" />
            </div>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <TrendingUp size={14} />
              +{mockStats.organizations.new_this_month}
            </span>
          </div>
          <div className="text-3xl font-bold">{mockStats.organizations.total}</div>
          <div className="text-sm text-gray-500">Organizaciones</div>
          <div className="text-xs text-gray-400 mt-1">
            {mockStats.organizations.active} activas
          </div>
        </div>

        {/* Users */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Users size={24} className="text-green-600" />
            </div>
            <span className="text-sm text-blue-600 flex items-center gap-1">
              <Activity size={14} />
              {mockStats.users.active_today} hoy
            </span>
          </div>
          <div className="text-3xl font-bold">{mockStats.users.total}</div>
          <div className="text-sm text-gray-500">Usuarios totales</div>
        </div>

        {/* MRR */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <DollarSign size={24} className="text-purple-600" />
            </div>
            <span className="text-sm text-green-600 flex items-center gap-1">
              <TrendingUp size={14} />
              +${mockStats.revenue.this_month}
            </span>
          </div>
          <div className="text-3xl font-bold">${mockStats.revenue.mrr}</div>
          <div className="text-sm text-gray-500">MRR</div>
        </div>

        {/* API Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
              <Zap size={24} className="text-yellow-600" />
            </div>
          </div>
          <div className="text-3xl font-bold">{mockStats.usage.api_calls_today.toLocaleString()}</div>
          <div className="text-sm text-gray-500">API calls hoy</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Organizations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
          <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold">Organizaciones recientes</h2>
            <Link
              to="/admin/organizations"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver todas <ChevronRight size={16} />
            </Link>
          </div>
          <div className="divide-y dark:divide-gray-700">
            {recentOrgs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No hay organizaciones aún
              </div>
            ) : (
              recentOrgs.map(org => (
                <Link
                  key={org.id}
                  to={`/admin/organizations/${org.id}`}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{org.name}</div>
                    <div className="text-sm text-gray-500">
                      {org.plants_count} plantas | {org.users_count} usuarios
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    org.plan === 'pro'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {org.plan}
                  </span>
                  <ChevronRight size={18} className="text-gray-400" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* System Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="font-semibold">Uso del sistema</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Plants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Building2 size={16} className="text-blue-500" />
                  Total plantas
                </span>
                <span className="font-bold">{mockStats.usage.total_plants}</span>
              </div>
            </div>

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <HardDrive size={16} className="text-green-500" />
                  Documentos
                </span>
                <span className="font-bold">{mockStats.usage.total_documents.toLocaleString()}</span>
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <HardDrive size={16} className="text-purple-500" />
                  Almacenamiento
                </span>
                <span className="font-bold">{mockStats.usage.storage_used_gb.toFixed(1)} GB</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${Math.min(100, (mockStats.usage.storage_used_gb / 100) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">de 100 GB total</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
