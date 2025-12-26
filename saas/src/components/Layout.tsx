/**
 * Layout Components with Sidebar Navigation
 * Professional layout for SaaS multi-tenant app
 */
import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useAuthStore, useHasHydrated } from '../stores/authStore'
import { useState } from 'react'

export function ProtectedLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoading = useAuthStore((state) => state.isLoading)
  const hasHydrated = useHasHydrated()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Wait for hydration from localStorage
  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

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
            <Sidebar collapsed={false} />
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

/**
 * Admin Layout for Super Admin pages
 * Requires super_admin role
 */
export function AdminLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)
  const hasHydrated = useHasHydrated()

  // Wait for hydration
  if (!hasHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-purple-300">Cargando panel de administración...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check for super_admin or owner role
  if (user?.role !== 'owner' && user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Admin Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-purple-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold">Super Admin</h1>
              <p className="text-purple-300 text-xs">Panel de administración global</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <a href="/super-admin" className="text-purple-300 hover:text-white transition text-sm">
              Dashboard
            </a>
            <a href="/super-admin/organizations" className="text-purple-300 hover:text-white transition text-sm">
              Organizaciones
            </a>
            <a href="/super-admin/users" className="text-purple-300 hover:text-white transition text-sm">
              Usuarios
            </a>
            <div className="h-6 w-px bg-purple-500/30" />
            <a href="/" className="text-purple-300 hover:text-white transition text-sm">
              Volver a la app
            </a>
          </nav>
        </div>
      </header>
      <main className="text-white">
        <Outlet />
      </main>
    </div>
  )
}
