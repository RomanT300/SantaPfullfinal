/**
 * Main App component with React Query, lazy loading, and improved routing
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Suspense, lazy } from "react"
import { ProtectedLayout, PublicLayout } from "@/components/Layout"
import ToastProvider from "@/components/Toast"

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
const Home = lazy(() => import("@/pages/Home"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const Maintenance = lazy(() => import("@/pages/Maintenance"))
const Documents = lazy(() => import("@/pages/Documents"))
const MapPage = lazy(() => import("@/pages/Map"))
const Admin = lazy(() => import("@/pages/Admin"))
const Login = lazy(() => import("@/pages/Login"))
const Emergencies = lazy(() => import("@/pages/Emergencies"))
const OpexCosts = lazy(() => import("@/pages/OpexCosts"))
const TropackMaintenancePlan = lazy(() => import("@/pages/TropackMaintenancePlan"))
const ExecutiveDashboard = lazy(() => import("@/pages/ExecutiveDashboard"))
const DailyChecklist = lazy(() => import("@/pages/DailyChecklist"))
const SupervisorReports = lazy(() => import("@/pages/SupervisorReports"))
const ChecklistMeasurements = lazy(() => import("@/pages/ChecklistMeasurements"))

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
            </Route>

            {/* Protected routes */}
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
              <Route path="/tropack-maintenance" element={<TropackMaintenancePlan />} />
              <Route path="/checklist" element={<DailyChecklist />} />
              <Route path="/checklist/:plantId" element={<DailyChecklist />} />
              <Route path="/supervisor" element={<SupervisorReports />} />
              <Route path="/measurements" element={<ChecklistMeasurements />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  )
}
