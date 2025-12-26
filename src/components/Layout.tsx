/**
 * Layout Components with Sidebar Navigation
 * Professional layout matching SaaS design
 */
import { Outlet, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import EmergencyPopup from './EmergencyPopup'
import { useAuthStore } from '../stores/authStore'

export function ProtectedLayout() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Emergency Popup - Shows when new emergencies are reported */}
      <EmergencyPopup />

      {/* Sidebar - Hidden on mobile, shown on lg+ */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10">
            <Sidebar collapsed={false} onClose={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className={`
        transition-all duration-300
        ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
      `}>
        <TopBar
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={true}
        />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Outlet />
    </div>
  )
}
