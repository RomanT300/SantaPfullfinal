/**
 * Super Admin - User Detail
 * View and edit any user details
 */
import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  User,
  Building2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Save,
  Key,
  LogIn,
  Trash2,
  Check,
  X,
  MapPin,
  Calendar,
  Clock,
  Activity
} from 'lucide-react'

interface UserData {
  id: string
  email: string
  name: string
  role: string
  status: string
  plantId: string | null
  avatarUrl: string | null
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
}

interface Plant {
  id: string
  name: string
  location: string
}

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  created_at: string
}

const ROLES = [
  { value: 'owner', label: 'Propietario' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visor' }
]

const STATUS = [
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'inactive', label: 'Inactivo' }
]

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [user, setUser] = useState<UserData | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [plant, setPlant] = useState<Plant | null>(null)
  const [availablePlants, setAvailablePlants] = useState<Plant[]>([])
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([])

  // Editable fields
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [plantId, setPlantId] = useState<string>('')

  // Modals
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (id) loadUser()
  }, [id])

  const loadUser = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setUser(data.data.user)
        setOrganization(data.data.organization)
        setPlant(data.data.plant)
        setAvailablePlants(data.data.availablePlants || [])
        setRecentActivity(data.data.recentActivity || [])

        // Set editable fields
        setName(data.data.user.name)
        setRole(data.data.user.role)
        setStatus(data.data.user.status)
        setPlantId(data.data.user.plantId || '')
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          role,
          status,
          plantId: plantId || null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess('Usuario actualizado correctamente')
      loadUser()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        setTempPassword(data.data.temporaryPassword)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        navigate('/super-admin/users', { replace: true })
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
      setShowDelete(false)
    }
  }

  const handleImpersonate = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}/impersonate`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        // Store impersonation token and redirect
        localStorage.setItem('impersonation_token', data.data.token)
        window.open('/', '_blank')
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold">Usuario no encontrado</h2>
          <Link to="/super-admin/users" className="text-blue-600 hover:underline mt-4 inline-block">
            Volver a usuarios
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/super-admin/users"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-4"
        >
          <ArrowLeft size={16} />
          Volver a usuarios
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <User size={32} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleImpersonate}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <LogIn size={18} />
              Impersonar
            </button>
            {user.role !== 'owner' && (
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={18} />
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={18} /></button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center gap-2">
          <Check size={18} />
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="md:col-span-2 space-y-6">
          {/* User Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">Información del usuario</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Rol</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    {STATUS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Planta asignada</label>
                <select
                  value={plantId}
                  onChange={(e) => setPlantId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  <option value="">Sin planta asignada</option>
                  {availablePlants.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setShowResetPassword(true)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Key size={18} />
                  Reset Password
                </button>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} />
              Actividad reciente
            </h2>

            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Sin actividad registrada</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-gray-500">
                        {log.entity_type} • {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Organization Card */}
          {organization && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Organización</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                  <Building2 size={20} className="text-purple-600" />
                </div>
                <div>
                  <Link
                    to={`/super-admin/organizations/${organization.id}`}
                    className="font-medium hover:text-blue-600"
                  >
                    {organization.name}
                  </Link>
                  <p className="text-xs text-gray-500">{organization.slug}</p>
                </div>
              </div>
              <div className="mt-3">
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {organization.plan}
                </span>
              </div>
            </div>
          )}

          {/* Plant Card */}
          {plant && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Planta asignada</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <MapPin size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-medium">{plant.name}</p>
                  <p className="text-xs text-gray-500">{plant.location}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Fechas</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-gray-500">Creado:</span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} className="text-gray-400" />
                <span className="text-gray-500">Último login:</span>
                <span>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold">Reset Password</h2>
            </div>
            <div className="p-6">
              {tempPassword ? (
                <div className="space-y-4">
                  <p>Nueva contraseña temporal:</p>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                    <code className="text-lg font-mono">{tempPassword}</code>
                  </div>
                  <p className="text-sm text-gray-500">
                    El usuario deberá cambiar esta contraseña al iniciar sesión.
                  </p>
                </div>
              ) : (
                <p>¿Generar una nueva contraseña temporal para <strong>{user.email}</strong>?</p>
              )}
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => { setShowResetPassword(false); setTempPassword(null) }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {tempPassword ? 'Cerrar' : 'Cancelar'}
              </button>
              {!tempPassword && (
                <button
                  onClick={handleResetPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Generar contraseña
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-red-600">Eliminar Usuario</h2>
            </div>
            <div className="p-6">
              <p>¿Estás seguro de eliminar a <strong>{user.name}</strong>?</p>
              <p className="text-sm text-gray-500 mt-2">Esta acción no se puede deshacer.</p>
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowDelete(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
