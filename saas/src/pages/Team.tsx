/**
 * Team Management Page
 * Manage users, invitations, and roles for the organization
 */
import { useState, useEffect } from 'react'
import {
  Users,
  Mail,
  Shield,
  Trash2,
  Clock,
  UserPlus,
  MoreVertical,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronDown
} from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  last_login_at: string | null
  created_at: string
  avatar_url?: string
}

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

const ROLES = [
  { id: 'owner', name: 'Propietario', description: 'Control total de la organización' },
  { id: 'admin', name: 'Administrador', description: 'Gestionar usuarios y configuración' },
  { id: 'supervisor', name: 'Supervisor', description: 'Supervisar operaciones y aprobar' },
  { id: 'operator', name: 'Operador', description: 'Realizar tareas operativas' },
  { id: 'viewer', name: 'Visor', description: 'Solo lectura' }
]

export default function Team() {
  const [users, setUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('operator')
  const [inviting, setInviting] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [usersRes, invitesRes] = await Promise.all([
        fetch('/api/users', { credentials: 'include' }),
        fetch('/api/users/invitations', { credentials: 'include' })
      ])

      const usersData = await usersRes.json()
      const invitesData = await invitesRes.json()

      if (usersData.success) setUsers(usersData.data || [])
      if (invitesData.success) setInvitations(invitesData.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) return

    setInviting(true)
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar invitación')

      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('operator')
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      })

      if (!res.ok) throw new Error('Error al cambiar rol')

      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setEditingUserId(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSuspendUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de suspender este usuario?')) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'suspended' })
      })

      if (!res.ok) throw new Error('Error al suspender usuario')
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/users/invitations/${invitationId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!res.ok) throw new Error('Error al cancelar invitación')
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
      case 'admin': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
      case 'supervisor': return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
      case 'operator': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getRoleName = (roleId: string) => {
    return ROLES.find(r => r.id === roleId)?.name || roleId
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users size={28} />
            Equipo
          </h1>
          <p className="text-gray-500 mt-1">
            {users.length} usuarios | {invitations.length} invitaciones pendientes
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <UserPlus size={18} />
          Invitar miembro
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="font-semibold">Miembros</h2>
        </div>

        <div className="divide-y dark:divide-gray-700">
          {users.map(user => (
            <div key={user.id} className="px-6 py-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 font-medium">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{user.name}</span>
                  {user.status === 'suspended' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                      Suspendido
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate">{user.email}</div>
              </div>

              {/* Role */}
              <div className="relative">
                {editingUserId === user.id ? (
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeRole(user.id, e.target.value)}
                    onBlur={() => setEditingUserId(null)}
                    autoFocus
                    className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  >
                    {ROLES.filter(r => r.id !== 'owner').map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => user.role !== 'owner' && setEditingUserId(user.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 ${getRoleBadgeColor(user.role)} ${
                      user.role !== 'owner' ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <Shield size={14} />
                    {getRoleName(user.role)}
                    {user.role !== 'owner' && <ChevronDown size={14} />}
                  </button>
                )}
              </div>

              {/* Last login */}
              <div className="text-sm text-gray-500 w-32 text-right">
                {user.last_login_at ? (
                  <span title={new Date(user.last_login_at).toLocaleString()}>
                    {new Date(user.last_login_at).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-gray-400">Nunca</span>
                )}
              </div>

              {/* Actions */}
              {user.role !== 'owner' && (
                <button
                  onClick={() => handleSuspendUser(user.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  title="Suspender usuario"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}

          {users.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              No hay usuarios aún
            </div>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock size={18} className="text-yellow-500" />
              Invitaciones pendientes
            </h2>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {invitations.map(inv => (
              <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Mail size={18} className="text-yellow-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{inv.email}</div>
                  <div className="text-sm text-gray-500">
                    Expira: {new Date(inv.expires_at).toLocaleDateString()}
                  </div>
                </div>

                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getRoleBadgeColor(inv.role)}`}>
                  {getRoleName(inv.role)}
                </span>

                <button
                  onClick={() => handleCancelInvitation(inv.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  title="Cancelar invitación"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold mb-4">Invitar miembro</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                >
                  {ROLES.filter(r => r.id !== 'owner').map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.includes('@') || inviting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {inviting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Mail size={18} />
                )}
                Enviar invitación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
