/**
 * Admin Organizations List
 * View and manage all organizations in the system
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Search,
  Filter,
  ChevronRight,
  Users,
  Loader2,
  AlertCircle,
  MoreVertical,
  Pause,
  Play,
  Eye,
  Plus,
  X,
  Wrench,
  Shirt,
  Check
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  plant_types: string
  created_at: string
  users_count: number
  plants_count: number
  stripe_customer_id: string | null
}

interface CreateOrgForm {
  name: string
  ownerEmail: string
  ownerName: string
  ownerPassword: string
  plan: 'starter' | 'pro'
  plantTypes: 'biosems' | 'textiles' | 'both'
}

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  // Create org modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateOrgForm>({
    name: '',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
    plan: 'starter',
    plantTypes: 'both'
  })

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/admin/organizations', { credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setOrganizations(data.data || [])
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSuspend = async (orgId: string) => {
    if (!confirm('¿Suspender esta organización?')) return

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'suspended' })
      })

      if (!res.ok) throw new Error('Error al suspender')
      loadOrganizations()
    } catch (err: any) {
      setError(err.message)
    }
    setActionMenuId(null)
  }

  const handleActivate = async (orgId: string) => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'active' })
      })

      if (!res.ok) throw new Error('Error al activar')
      loadOrganizations()
    } catch (err: any) {
      setError(err.message)
    }
    setActionMenuId(null)
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear organización')

      setSuccess(`Organización "${createForm.name}" creada exitosamente`)
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        ownerEmail: '',
        ownerName: '',
        ownerPassword: '',
        plan: 'starter',
        plantTypes: 'both'
      })
      loadOrganizations()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const filteredOrgs = organizations.filter(org => {
    if (search && !org.name.toLowerCase().includes(search.toLowerCase()) && !org.slug.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (planFilter && org.plan !== planFilter) return false
    if (statusFilter && org.status !== statusFilter) return false
    return true
  })

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'pro': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
      case 'starter': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'suspended': return 'bg-red-100 text-red-700'
      case 'cancelled': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 size={28} />
            Organizaciones
          </h1>
          <p className="text-gray-500 mt-1">
            {organizations.length} organizaciones en total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          Nueva Organización
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center gap-2">
          <Check size={18} />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o slug..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Todos los planes</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organización</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuarios</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plantas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creado</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron organizaciones
                  </td>
                </tr>
              ) : (
                filteredOrgs.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <Building2 size={20} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-gray-500">{org.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPlanBadgeColor(org.plan)}`}>
                        {org.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(org.status)}`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1">
                        <Users size={14} className="text-gray-400" />
                        {org.users_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">{org.plants_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuId(actionMenuId === org.id ? null : org.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {actionMenuId === org.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-10">
                            <Link
                              to={`/admin/organizations/${org.id}`}
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Eye size={16} />
                              Ver detalles
                            </Link>
                            {org.status === 'active' ? (
                              <button
                                onClick={() => handleSuspend(org.id)}
                                className="flex items-center gap-2 px-4 py-2 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Pause size={16} />
                                Suspender
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivate(org.id)}
                                className="flex items-center gap-2 px-4 py-2 w-full text-left text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                <Play size={16} />
                                Activar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold">Nueva Organización</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
              {/* Organization Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Nombre de la organización *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  placeholder="Empresa ABC"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              {/* Owner Info */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400">Datos del propietario</h3>

                <div>
                  <label className="block text-sm font-medium mb-1">Nombre completo *</label>
                  <input
                    type="text"
                    value={createForm.ownerName}
                    onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    required
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={createForm.ownerEmail}
                    onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                    required
                    placeholder="admin@empresa.com"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contraseña *</label>
                  <input
                    type="password"
                    value={createForm.ownerPassword}
                    onChange={(e) => setCreateForm({ ...createForm, ownerPassword: e.target.value })}
                    required
                    minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-sm font-medium mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`
                    flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${createForm.plan === 'starter'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="plan"
                      value="starter"
                      checked={createForm.plan === 'starter'}
                      onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value as any })}
                      className="sr-only"
                    />
                    <span className="font-medium">Starter</span>
                    <span className="text-sm text-gray-500">$49/mes</span>
                    <span className="text-xs text-gray-400">3 plantas, 5 usuarios</span>
                  </label>

                  <label className={`
                    flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${createForm.plan === 'pro'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="plan"
                      value="pro"
                      checked={createForm.plan === 'pro'}
                      onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value as any })}
                      className="sr-only"
                    />
                    <span className="font-medium">Pro</span>
                    <span className="text-sm text-gray-500">$149/mes</span>
                    <span className="text-xs text-gray-400">10 plantas, 25 usuarios</span>
                  </label>
                </div>
              </div>

              {/* Plant Types */}
              <div>
                <label className="block text-sm font-medium mb-2">Tipos de Planta</label>
                <div className="grid gap-2">
                  <label className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${createForm.plantTypes === 'biosems'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="plantTypes"
                      value="biosems"
                      checked={createForm.plantTypes === 'biosems'}
                      onChange={(e) => setCreateForm({ ...createForm, plantTypes: e.target.value as any })}
                      className="sr-only"
                    />
                    <Wrench size={18} className="text-blue-600" />
                    <span className="font-medium">Solo Biosems</span>
                  </label>

                  <label className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${createForm.plantTypes === 'textiles'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="plantTypes"
                      value="textiles"
                      checked={createForm.plantTypes === 'textiles'}
                      onChange={(e) => setCreateForm({ ...createForm, plantTypes: e.target.value as any })}
                      className="sr-only"
                    />
                    <Shirt size={18} className="text-purple-600" />
                    <span className="font-medium">Solo Textiles</span>
                  </label>

                  <label className={`
                    flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${createForm.plantTypes === 'both'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                  `}>
                    <input
                      type="radio"
                      name="plantTypes"
                      value="both"
                      checked={createForm.plantTypes === 'both'}
                      onChange={(e) => setCreateForm({ ...createForm, plantTypes: e.target.value as any })}
                      className="sr-only"
                    />
                    <div className="flex gap-1">
                      <Wrench size={18} className="text-blue-600" />
                      <Shirt size={18} className="text-purple-600" />
                    </div>
                    <span className="font-medium">Ambos tipos</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {creating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Crear Organización
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
