/**
 * Main App Component for Multi-Tenant SaaS
 * Full feature parity with original software
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { ProtectedLayout, PublicLayout, AdminLayout } from './components/Layout'
import ToastProvider from './components/Toast'

// Create Query Client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))

// SaaS management pages
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Team = lazy(() => import('./pages/Team'))
const Billing = lazy(() => import('./pages/Billing'))
const Settings = lazy(() => import('./pages/Settings'))

// Super Admin pages
const SuperAdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminOrganizations = lazy(() => import('./pages/admin/Organizations'))
const AdminOrganizationDetail = lazy(() => import('./pages/admin/OrganizationDetail'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail'))

// App pages (from original software)
const Home = lazy(() => import('./pages/app/Home'))
const Dashboard = lazy(() => import('./pages/app/Dashboard'))
const Maintenance = lazy(() => import('./pages/app/Maintenance'))
const Documents = lazy(() => import('./pages/app/Documents'))
const MapPage = lazy(() => import('./pages/app/Map'))
const Admin = lazy(() => import('./pages/app/Admin'))
const Emergencies = lazy(() => import('./pages/app/Emergencies'))
const OpexCosts = lazy(() => import('./pages/app/OpexCosts'))
const TextilesMaintenancePlan = lazy(() => import('./pages/app/TextilesMaintenancePlan'))
const ExecutiveDashboard = lazy(() => import('./pages/app/ExecutiveDashboard'))
const DailyChecklist = lazy(() => import('./pages/app/DailyChecklist'))
const SupervisorReports = lazy(() => import('./pages/app/SupervisorReports'))
const ChecklistMeasurements = lazy(() => import('./pages/app/ChecklistMeasurements'))
const Tickets = lazy(() => import('./pages/app/Tickets'))
const ChecklistHistory = lazy(() => import('./pages/app/ChecklistHistory'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider />
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>

            {/* Protected routes - Full app functionality */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/executive" element={<ExecutiveDashboard />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/emergencies" element={<Emergencies />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/opex" element={<OpexCosts />} />
              <Route path="/textiles-maintenance" element={<TextilesMaintenancePlan />} />
              <Route path="/checklist" element={<DailyChecklist />} />
              <Route path="/checklist/:plantId" element={<DailyChecklist />} />
              <Route path="/supervisor" element={<SupervisorReports />} />
              <Route path="/measurements" element={<ChecklistMeasurements />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/checklist-history" element={<ChecklistHistory />} />

              {/* SaaS Management routes */}
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/team" element={<Team />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Super Admin routes */}
            <Route element={<AdminLayout />}>
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/organizations" element={<AdminOrganizations />} />
              <Route path="/super-admin/organizations/:id" element={<AdminOrganizationDetail />} />
              <Route path="/super-admin/users" element={<AdminUsers />} />
              <Route path="/super-admin/users/:id" element={<AdminUserDetail />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  )
}
