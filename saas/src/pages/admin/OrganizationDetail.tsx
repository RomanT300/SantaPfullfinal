/**
 * Admin Organization Detail Page
 * Full management of a single organization with tabs
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Building2, Users, Leaf, Wrench, DollarSign, FileText,
  ArrowLeft, Loader2, AlertCircle, Edit2, Save, X,
  Plus, Trash2, Eye, LogIn, BarChart2, Settings,
  Calendar, Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react'

type TabType = 'overview' | 'users' | 'plants' | 'maintenance' | 'opex' | 'documents'

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  plant_types: string
  created_at: string
  billing_email: string | null
  admin_notes: string | null
}

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  last_login_at: string | null
  created_at: string
}

interface Plant {
  id: string
  name: string
  location: string | null
  status: string
  created_at: string
}

interface MaintenanceTask {
  id: string
  task_name: string
  plant_name: string
  status: string
  periodicity: string
  next_due: string | null
}

interface OpexEntry {
  id: string
  plant_name: string
  category: string
  amount: number
  year: number
  month: number
}

export default function OrganizationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [org, setOrg] = useState<Organization | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [opex, setOpex] = useState<OpexEntry[]>([])

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Organization>>({})

  useEffect(() => {
    loadOrganization()
  }, [id])

  useEffect(() => {
    if (org) {
      loadTabData()
    }
  }, [activeTab, org])

  const loadOrganization = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/organizations/${id}`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) throw new Error(data.error)

      setOrg(data.data)
      setEditForm(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTabData = async () => {
    if (!org) return

    try {
      switch (activeTab) {
        case 'users':
          const usersRes = await fetch(`/api/admin/users?organizationId=${org.id}`, { credentials: 'include' })
          const usersData = await usersRes.json()
          if (usersData.success) setUsers(usersData.data || [])
          break

        case 'plants':
          // Use impersonation token to get plants
          const plantsRes = await fetch(`/api/admin/organizations/${org.id}/plants`, { credentials: 'include' })
          const plantsData = await plantsRes.json()
          if (plantsData.success) setPlants(plantsData.data || [])
          break

        case 'maintenance':
          const maintRes = await fetch(`/api/admin/organizations/${org.id}/maintenance`, { credentials: 'include' })
          const maintData = await maintRes.json()
          if (maintData.success) setTasks(maintData.data || [])
          break

        case 'opex':
          const opexRes = await fetch(`/api/admin/organizations/${org.id}/opex`, { credentials: 'include' })
          const opexData = await opexRes.json()
          if (opexData.success) setOpex(opexData.data || [])
          break
      }
    } catch (err: any) {
      console.error('Error loading tab data:', err)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editForm.name,
          plan: editForm.plan,
          status: editForm.status,
          adminNotes: editForm.admin_notes
        })
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      setOrg(data.data)
      setEditing(false)
      setSuccess('Organización actualizada')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleImpersonate = async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${id}/impersonate`, {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      // Store impersonation token and redirect
      localStorage.setItem('impersonation_token', data.data.token)
      window.location.href = '/' // Redirect to main app
    } catch (err: any) {
      setError(err.message)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Resumen', icon: Building2 },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'plants', label: 'Plantas', icon: Leaf },
    { id: 'maintenance', label: 'Mantenimiento', icon: Wrench },
    { id: 'opex', label: 'OPEX', icon: DollarSign },
    { id: 'documents', label: 'Documentos', icon: FileText }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          Organización no encontrada
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/super-admin/organizations"
          className="text-blue-600 hover:underline flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={16} />
          Volver a organizaciones
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Building2 size={32} className="text-blue-600" />
            </div>
            <div>
              {editing ? (
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-2xl font-bold px-2 py-1 border rounded"
                />
              ) : (
                <h1 className="text-2xl font-bold">{org.name}</h1>
              )}
              <p className="text-gray-500">{org.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => { setEditing(false); setEditForm(org) }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Save size={18} />
                  Guardar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 size={18} />
                  Editar
                </button>
                <button
                  onClick={handleImpersonate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <LogIn size={18} />
                  Entrar como admin
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b dark:border-gray-700 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}
              `}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500">Plan</div>
                {editing ? (
                  <select
                    value={editForm.plan}
                    onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border rounded"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                  </select>
                ) : (
                  <div className="text-xl font-bold capitalize">{org.plan}</div>
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500">Estado</div>
                {editing ? (
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border rounded"
                  >
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                ) : (
                  <div className={`text-xl font-bold capitalize ${
                    org.status === 'active' ? 'text-green-600' :
                    org.status === 'suspended' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {org.status}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500">Tipos de Planta</div>
                <div className="text-xl font-bold capitalize">{org.plant_types}</div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500">Creado</div>
                <div className="text-xl font-bold">
                  {new Date(org.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Notas del Admin</label>
              {editing ? (
                <textarea
                  value={editForm.admin_notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Notas internas sobre esta organización..."
                />
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg min-h-[100px]">
                  {org.admin_notes || <span className="text-gray-400 italic">Sin notas</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Usuarios ({users.length})</h3>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ultimo Login</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hay usuarios
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Nunca'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/super-admin/users/${user.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'plants' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Plantas ({plants.length})</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plants.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No hay plantas configuradas
                </div>
              ) : (
                plants.map(plant => (
                  <div key={plant.id} className="p-4 border rounded-lg hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <Leaf size={20} className="text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium">{plant.name}</div>
                          <div className="text-sm text-gray-500">{plant.location || 'Sin ubicación'}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        plant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {plant.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Tareas de Mantenimiento ({tasks.length})</h3>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarea</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodicidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proxima Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hay tareas de mantenimiento
                    </td>
                  </tr>
                ) : (
                  tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium">{task.task_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{task.plant_name}</td>
                      <td className="px-4 py-3 text-sm capitalize">{task.periodicity}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700' :
                          task.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {task.next_due ? new Date(task.next_due).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'opex' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Costos OPEX ({opex.length})</h3>
            </div>

            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planta</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {opex.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay registros de OPEX
                    </td>
                  </tr>
                ) : (
                  opex.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">{entry.plant_name}</td>
                      <td className="px-4 py-3 capitalize">{entry.category}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {entry.month}/{entry.year}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${entry.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>Módulo de documentos próximamente</p>
          </div>
        )}
      </div>
    </div>
  )
}
