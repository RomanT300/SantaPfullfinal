import { Link, NavLink } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { Moon, Sun, Info, LogOut } from 'lucide-react'
import { useMemo } from 'react'

export default function Header() {
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const linkClass = ({ isActive }: any) =>
    `px-3 py-2 rounded hover:bg-blue-100 dark:hover:bg-blue-900 ${isActive ? 'text-blue-600 font-semibold' : ''}`

  const role = useMemo(() => {
    if (user?.role === 'admin') return 'Admin'
    if (user?.role === 'standard') return 'Operador'
    return 'Invitado'
  }, [user])

  const tooltip = useMemo(() => {
    if (role === 'Admin') return 'Permisos: editar planificación de mantenimiento, crear tareas y plantas, subir documentos.'
    if (role === 'Operador') return 'Permisos: marcar realizado/no realizado y editar fecha real del mantenimiento.'
    return 'Inicia sesión para acceder a funcionalidades de mantenimiento y analíticas.'
  }, [role])

  return (
    <header className="border-b bg-gradient-to-r from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link to="/" className="text-xl font-bold text-blue-700 dark:text-teal-300">PTAR</Link>
        <nav className="flex gap-2 text-sm">
          <NavLink to="/dashboard" className={linkClass}>Analíticas</NavLink>
          <NavLink to="/maintenance" className={linkClass}>Mantenimiento</NavLink>
          <NavLink to="/emergencies" className={linkClass}>Emergencias</NavLink>
          <NavLink to="/documents" className={linkClass}>Documentos</NavLink>
          <NavLink to="/map" className={linkClass}>Mapa</NavLink>
          <NavLink to="/admin" className={linkClass}>Admin</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 px-2 py-1 rounded border bg-white/70 dark:bg-gray-800/50" title={tooltip}>
            <span className="text-xs text-gray-600">Rol:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${role==='Admin' ? 'bg-emerald-100 text-emerald-700' : role==='Operador' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{role}</span>
            <Info size={14} className="text-gray-500" />
          </div>
          {user && (
            <span className="text-xs text-gray-600 px-2">{user.email}</span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1 px-3 py-2 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            <span className="text-xs">Salir</span>
          </button>
          <button onClick={toggleTheme} aria-label="Cambiar tema" className="px-2 py-2 rounded border hover:bg-blue-100 dark:hover:bg-blue-900">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  )
}