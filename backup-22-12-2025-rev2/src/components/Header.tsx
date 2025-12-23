/**
 * Improved Header with responsive navigation and alerts
 */
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { useAuthStore, useIsAdmin } from '../stores/authStore'
import { useAppStore } from '../stores/appStore'
import {
  Moon, Sun, LogOut, Menu, X, Bell, ChevronDown,
  LayoutDashboard, Wrench, AlertTriangle, DollarSign,
  FileText, Map, Settings, Factory, Home, Activity, ClipboardCheck, Eye, Smartphone
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Inicio', icon: <Home size={16} /> },
  { to: '/executive', label: 'Ejecutivo', icon: <Activity size={16} /> },
  { to: '/dashboard', label: 'Analíticas', icon: <LayoutDashboard size={16} /> },
  { to: '/maintenance', label: 'Mantenimiento', icon: <Wrench size={16} /> },
  { to: '/checklist', label: 'Checklist', icon: <ClipboardCheck size={16} /> },
  { to: '/measurements', label: 'Operacional', icon: <Smartphone size={16} /> },
  { to: '/supervisor', label: 'Supervisor', icon: <Eye size={16} /> },
  { to: '/emergencies', label: 'Emergencias', icon: <AlertTriangle size={16} /> },
  { to: '/opex', label: 'OPEX', icon: <DollarSign size={16} /> },
  { to: '/documents', label: 'Documentos', icon: <FileText size={16} /> },
  { to: '/map', label: 'Mapa', icon: <Map size={16} /> },
  { to: '/admin', label: 'Admin', icon: <Settings size={16} />, adminOnly: true },
]

export default function Header() {
  const { isDark, toggleTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const isAdmin = useIsAdmin()
  const { alerts, unreadAlerts, acknowledgeAlert } = useAppStore()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const alertsRef = useRef<HTMLDivElement>(null)

  // Close alerts dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setAlertsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  const roleLabel = user?.role === 'admin' ? 'Admin' : 'Operador'
  const roleColor = user?.role === 'admin'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'

  return (
    <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
              <Factory className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              PTAR
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Alerts dropdown */}
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

            {/* User info - desktop */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800">
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${roleColor}`}>
                {roleLabel}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[120px] truncate">
                {user?.email}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Cambiar tema"
            >
              {isDark ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-gray-600" />}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Mobile user info */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="px-4 flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${roleColor}`}>
                  {roleLabel}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.email}
                </span>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
