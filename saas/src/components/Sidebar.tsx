/**
 * Sidebar Navigation Component
 * Professional sidebar with collapsible sections
 * Dynamic based on organization's plant types
 */
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore, useIsAdmin, useOrganization } from '../stores/authStore'
import {
  LayoutDashboard, Wrench, AlertTriangle, DollarSign,
  FileText, Map, Settings, Factory, Home, Activity, ClipboardCheck, Eye, Smartphone, Shirt,
  Ticket, History, Users, CreditCard, ChevronDown, ChevronRight, ShieldCheck
} from 'lucide-react'
import { useState, useMemo } from 'react'

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  plantType?: 'biosems' | 'textiles' // If specified, only show for that plant type
}

type NavSection = {
  title: string
  adminOnly?: boolean
  items: NavItem[]
}

// Base navigation sections - will be filtered based on org settings
const getNavSections = (plantTypes: string): NavSection[] => [
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
      // Show Biosems if plantTypes is 'biosems' or 'both'
      ...(plantTypes === 'biosems' || plantTypes === 'both' ? [
        { to: '/maintenance', label: 'Biosems', icon: <Wrench size={18} />, plantType: 'biosems' as const }
      ] : []),
      // Show Textiles if plantTypes is 'textiles' or 'both'
      ...(plantTypes === 'textiles' || plantTypes === 'both' ? [
        { to: '/textiles-maintenance', label: 'Textiles', icon: <Shirt size={18} />, plantType: 'textiles' as const }
      ] : []),
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
      { to: '/team', label: 'Equipo', icon: <Users size={18} />, adminOnly: true },
      { to: '/billing', label: 'Facturación', icon: <CreditCard size={18} />, adminOnly: true },
      { to: '/settings', label: 'Configuración', icon: <Settings size={18} />, adminOnly: true },
      { to: '/admin', label: 'Admin Plantas', icon: <Factory size={18} />, adminOnly: true },
      { to: '/super-admin', label: 'Super Admin', icon: <ShieldCheck size={18} />, adminOnly: true },
    ]
  },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const organization = useOrganization()
  const isAdmin = useIsAdmin()
  const location = useLocation()

  // Get plant types from organization settings (default to 'both')
  const plantTypes = (organization as any)?.plantTypes || 'both'

  // Generate navigation sections based on plant types
  const navSections = useMemo(() => getNavSections(plantTypes), [plantTypes])

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
                PTAR SaaS
              </span>
              {organization && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {organization.name}
                </span>
              )}
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

      {/* Footer with plan info */}
      {!collapsed && organization && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Plan actual</span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                {organization.plan}
              </span>
            </div>
            <NavLink
              to="/billing"
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Actualizar plan →
            </NavLink>
          </div>
        </div>
      )}
    </aside>
  )
}
