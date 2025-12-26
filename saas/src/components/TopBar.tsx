/**
 * Top Bar Component - Minimal header for use with sidebar
 */
import { useTheme } from '../hooks/useTheme'
import { useAuthStore, useIsAdmin } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import {
  Moon, Sun, LogOut, Bell, AlertTriangle, Shield, Menu, Search
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface TopBarProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export default function TopBar({ onMenuClick, showMenuButton = false }: TopBarProps) {
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const { alerts, unreadAlerts, acknowledgeAlert } = useAppStore()

  const [alertsOpen, setAlertsOpen] = useState(false)
  const alertsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    owner: 'Propietario',
    admin: 'Admin',
    supervisor: 'Supervisor',
    operator: 'Operador',
    viewer: 'Visor'
  }
  const roleColors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    supervisor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    operator: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }

  const isSuperAdmin = user?.role === 'super_admin'
  const roleLabel = roleLabels[user?.role || 'operator'] || 'Usuario'
  const roleColor = roleColors[user?.role || 'operator'] || roleColors.operator

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {/* Search bar */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg w-64">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none outline-none text-sm text-gray-600 dark:text-gray-300 w-full"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Alerts */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Bell size={20} className="text-gray-600 dark:text-gray-300" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadAlerts > 9 ? '9+' : unreadAlerts}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Alertas</h3>
                {alerts.length > 0 && (
                  <span className="text-xs text-gray-500">{alerts.length} total</span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    Sin alertas pendientes
                  </div>
                ) : (
                  alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => acknowledgeAlert(alert.id)}
                      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition-colors ${
                        !alert.acknowledged ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full ${
                          alert.type === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          <AlertTriangle size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {alert.plantName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {alert.parameter}: {alert.value} (límite: {alert.threshold})
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Super Admin link */}
        {isSuperAdmin && (
          <Link
            to="/super-admin"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition text-sm font-medium"
          >
            <Shield size={16} />
            <span className="hidden sm:inline">Super Admin</span>
          </Link>
        )}

        {/* Divider */}
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.name}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${roleColor}`}>
              {roleLabel}
            </span>
          </div>

          {/* Avatar placeholder */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-medium text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Cambiar tema"
        >
          {isDark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-gray-600" />}
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
