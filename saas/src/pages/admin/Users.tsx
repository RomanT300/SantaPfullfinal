/**
 * Super Admin - Users Management
 * View and manage all users across all organizations
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users as UsersIcon,
  Search,
  Filter,
  User,
  Building2,
  Loader2,
  AlertCircle,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Key,
  UserCheck,
  UserX,
  LogIn,
  Check,
  X
} from 'lucide-react'

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  status: string
  plantId: string | null
  organizationId: string
  organizationName: string
  organizationSlug: string
  lastLoginAt: string | null
  createdAt: string
}

interface Organization {
  id: string
  name: string
}

const ROLES = [
  { value: '', label: 'Todos los roles' },
  { value: 'owner', label: 'Propietario' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visor' }
]

const STATUS = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'suspended', label: 'Suspendido' },
  { value: 'inactive', label: 'Inactivo' }
]

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')

  // Action menu
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  // Pagination
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 20

  // Modal states
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null)

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    loadUsers()
  }, [search, roleFilter, statusFilter, orgFilter, page])

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/admin/organizations', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setOrganizations(data.data.map((o: any) => ({ id: o.id, name: o.name })))
      }
    } catch (err) {
      console.error('Error loading organizations:', err)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (roleFilter) params.append('role', roleFilter)
      if (statusFilter) params.append('status', statusFilter)
      if (orgFilter) params.append('organizationId', orgFilter)
      params.append('limit', String(limit))
      params.append('offset', String(page * limit))

      const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' })
      const data = await res.json()

      if (data.success) {
        setUsers(data.data)
        setTotal(data.pagination?.total || data.data.length)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return

    try {
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
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

  const handleDeleteUser = async () => {
    if (!deleteUser) return

    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(`Usuario ${deleteUser.email} eliminado`)
        setDeleteUser(null)
        loadUsers()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSuspend = async (user: UserItem) => {
    try {
      const newStatus = user.status === 'suspended' ? 'active' : 'suspended'
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      })
      const data = await res.json()

      if (data.success) {
        setSuccess(`Usuario ${newStatus === 'suspended' ? 'suspendido' : 'activado'}`)
        loadUsers()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setActionMenuId(null)
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
      admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
      supervisor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
      operator: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
      viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
    const labels: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Admin',
      supervisor: 'Supervisor',
      operator: 'Operador',
      viewer: 'Visor'
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[role] || colors.viewer}`}>
        {labels[role] || role}
      </span>
    )
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
      suspended: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
      inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
    const labels: Record<string, string> = {
      active: 'Activo',
      suspended: 'Suspendido',
      inactive: 'Inactivo'
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || colors.inactive}`}>
        {labels[status] || status}
      </span>
    )
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/super-admin" className="hover:text-blue-600">Super Admin</Link>
          <span>/</span>
          <span>Usuarios</span>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UsersIcon size={28} />
          Usuarios del Sistema
        </h1>
        <p className="text-gray-500 mt-1">
          {total} usuarios en total
        </p>
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
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                placeholder="Buscar por nombre o email..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          {/* Organization Filter */}
          <select
            value={orgFilter}
            onChange={(e) => { setOrgFilter(e.target.value); setPage(0) }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">Todas las organizaciones</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0) }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
          >
            {STATUS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organización</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último login</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : (
                    users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                              <User size={20} className="text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={16} className="text-gray-400" />
                            <Link
                              to={`/super-admin/organizations/${user.organizationId}`}
                              className="text-blue-600 hover:underline"
                            >
                              {user.organizationName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                        <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString()
                            : 'Nunca'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuId(actionMenuId === user.id ? null : user.id)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {actionMenuId === user.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-10">
                                <Link
                                  to={`/super-admin/users/${user.id}`}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Eye size={16} />
                                  Ver detalles
                                </Link>
                                <button
                                  onClick={() => { setResetPasswordUser(user); setActionMenuId(null) }}
                                  className="flex items-center gap-2 px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Key size={16} />
                                  Reset password
                                </button>
                                <button
                                  onClick={() => handleSuspend(user)}
                                  className={`flex items-center gap-2 px-4 py-2 w-full text-left ${
                                    user.status === 'suspended'
                                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                      : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                  }`}
                                >
                                  {user.status === 'suspended' ? (
                                    <><UserCheck size={16} /> Activar</>
                                  ) : (
                                    <><UserX size={16} /> Suspender</>
                                  )}
                                </button>
                                {user.role !== 'owner' && (
                                  <button
                                    onClick={() => { setDeleteUser(user); setActionMenuId(null) }}
                                    className="flex items-center gap-2 px-4 py-2 w-full text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 size={16} />
                                    Eliminar
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Mostrando {page * limit + 1} - {Math.min((page + 1) * limit, total)} de {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold">Reset Password</h2>
            </div>
            <div className="p-6">
              {tempPassword ? (
                <div className="space-y-4">
                  <p>Nueva contraseña temporal para <strong>{resetPasswordUser.email}</strong>:</p>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                    <code className="text-lg font-mono">{tempPassword}</code>
                  </div>
                  <p className="text-sm text-gray-500">
                    El usuario deberá cambiar esta contraseña al iniciar sesión.
                  </p>
                </div>
              ) : (
                <p>
                  ¿Generar una nueva contraseña temporal para <strong>{resetPasswordUser.email}</strong>?
                </p>
              )}
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => { setResetPasswordUser(null); setTempPassword(null) }}
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

      {/* Delete Confirmation Modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-red-600">Eliminar Usuario</h2>
            </div>
            <div className="p-6">
              <p>
                ¿Estás seguro de eliminar a <strong>{deleteUser.name}</strong> ({deleteUser.email})?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteUser(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
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
