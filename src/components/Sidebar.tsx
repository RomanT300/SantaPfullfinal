/**
 * Sidebar Navigation Component
 * Professional sidebar with collapsible sections
 */
import { NavLink, useLocation } from 'react-router-dom'
import { useIsAdmin } from '../stores/authStore'
import {
  LayoutDashboard, Wrench, AlertTriangle, DollarSign,
  FileText, Map, Settings, Factory, Home, Activity, ClipboardCheck, Eye, Smartphone, Shirt,
  Ticket, History, ChevronDown, ChevronRight
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

type NavSection = {
  title: string
  adminOnly?: boolean
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { to: '/', label: 'Inicio', icon: <Home size={18} /> },
      { to: '/executive', label: 'Ejecutivo', icon: <Activity size={18} /> },
      { to: '/dashboard', label: 'Analíticas', icon: <LayoutDashboard size={18} /> },
    ]
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/checklist', label: 'Checklist Diario', icon: <ClipboardCheck size={18} /> },
      { to: '/checklist-history', label: 'Historial Checklist', icon: <History size={18} /> },
      { to: '/measurements', label: 'Operacional', icon: <Smartphone size={18} /> },
      { to: '/supervisor', label: 'Supervisor', icon: <Eye size={18} /> },
      { to: '/tickets', label: 'Tickets', icon: <Ticket size={18} /> },
    ]
  },
  {
    title: 'Mantenimiento',
    items: [
      { to: '/maintenance', label: 'Biosems', icon: <Wrench size={18} /> },
      { to: '/tropack-maintenance', label: 'Plan Tropack', icon: <Factory size={18} /> },
      { to: '/textiles-maintenance', label: 'Plan Textiles', icon: <Shirt size={18} /> },
      { to: '/emergencies', label: 'Emergencias', icon: <AlertTriangle size={18} /> },
    ]
  },
  {
    title: 'Recursos',
    items: [
      { to: '/opex', label: 'Costos OPEX', icon: <DollarSign size={18} /> },
      { to: '/documents', label: 'Documentos', icon: <FileText size={18} /> },
      { to: '/map', label: 'Mapa', icon: <Map size={18} /> },
    ]
  },
  {
    title: 'Administración',
    adminOnly: true,
    items: [
      { to: '/admin', label: 'Admin Plantas', icon: <Settings size={18} />, adminOnly: true },
    ]
  },
]

interface SidebarProps {
  collapsed?: boolean
  onClose?: () => void
}

export default function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const isAdmin = useIsAdmin()
  const location = useLocation()

  const [expandedSections, setExpandedSections] = useState<string[]>(
    navSections.map(s => s.title)
  )

  const toggleSection = (title: string) => {
    setExpandedSections(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    )
  }

  const filteredSections = navSections
    .filter(section => !section.adminOnly || isAdmin)
    .map(section => ({
      ...section,
      items: section.items.filter(item => !item.adminOnly || isAdmin)
    }))
    .filter(section => section.items.length > 0)

  const handleNavClick = () => {
    // Close mobile menu when navigating
    if (onClose) onClose()
  }

  return (
    <aside className={`
      ${collapsed ? 'w-16' : 'w-64'}
      h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
      flex flex-col transition-all duration-300 fixed left-0 top-0 z-40
    `}>
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-800 px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg flex-shrink-0">
            <Factory className="text-white" size={20} />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Santa Priscila
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Sistema PTAR
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {filteredSections.map((section) => (
          <div key={section.title} className="mb-4">
            {/* Section header */}
            {!collapsed && (
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-400"
              >
                {section.title}
                {expandedSections.includes(section.title)
                  ? <ChevronDown size={14} />
                  : <ChevronRight size={14} />
                }
              </button>
            )}

            {/* Section items */}
            {(collapsed || expandedSections.includes(section.title)) && (
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={handleNavClick}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                      }
                      ${collapsed ? 'justify-center' : ''}
                    `}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Gestión de Plantas de Tratamiento
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
