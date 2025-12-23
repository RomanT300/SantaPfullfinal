/**
 * Custom hooks for API calls with React Query
 * Provides caching, error handling, and loading states
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAppStore } from '../stores/appStore'
import type { Plant } from '../stores/appStore'

// Base fetch helper with error handling
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const json = await res.json()

  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Error en la solicitud')
  }

  return json.data
}

// ============ PLANTS ============

export function usePlants() {
  const setPlants = useAppStore((state) => state.setPlants)
  const setPlantsLoading = useAppStore((state) => state.setPlantsLoading)

  return useQuery({
    queryKey: ['plants'],
    queryFn: async () => {
      setPlantsLoading(true)
      try {
        const plants = await apiFetch<Plant[]>('/api/plants')
        setPlants(plants)
        return plants
      } finally {
        setPlantsLoading(false)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  })
}

export function usePlant(id: string) {
  return useQuery({
    queryKey: ['plant', id],
    queryFn: () => apiFetch<Plant>(`/api/plants/${id}`),
    enabled: !!id,
  })
}

// ============ ENVIRONMENTAL DATA ============

type EnvDataFilters = {
  plantId?: string
  startDate?: string
  endDate?: string
  parameter?: string
  stream?: string
}

export type EnvData = {
  id: string
  plant_id: string
  parameter_type: 'DQO' | 'pH' | 'SS'
  value: number
  measurement_date: string
  unit: string
  stream: 'influent' | 'effluent'
}

export function useEnvironmentalData(filters?: EnvDataFilters) {
  const params = new URLSearchParams()
  if (filters?.plantId) params.set('plantId', filters.plantId)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.parameter) params.set('parameter', filters.parameter)
  if (filters?.stream) params.set('stream', filters.stream)

  const queryString = params.toString()

  return useQuery({
    queryKey: ['environmental', filters],
    queryFn: () => apiFetch<EnvData[]>(`/api/analytics/environmental${queryString ? `?${queryString}` : ''}`),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// ============ MAINTENANCE ============

export type MaintenanceTask = {
  id: string
  plant_id: string
  task_type: 'preventive' | 'corrective' | 'general'
  description: string
  scheduled_date: string
  completed_date?: string
  status: 'pending' | 'completed' | 'overdue'
}

export function useMaintenanceTasks(plantId?: string) {
  const params = plantId ? `?plantId=${plantId}` : ''

  return useQuery({
    queryKey: ['maintenance', plantId],
    queryFn: () => apiFetch<MaintenanceTask[]>(`/api/maintenance/tasks${params}`),
    staleTime: 2 * 60 * 1000,
  })
}

export function useUpdateMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<MaintenanceTask>) => {
      const res = await fetch(`/api/maintenance/tasks/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success('Tarea actualizada')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<MaintenanceTask, 'id' | 'status'>) => {
      const res = await fetch('/api/maintenance/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plantId: data.plant_id,
          type: data.task_type,
          description: data.description,
          scheduledDate: data.scheduled_date,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      toast.success('Tarea creada')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ============ EMERGENCIES ============

export type Emergency = {
  id: string
  plant_id: string
  reason: string
  reported_at: string
  solved: boolean
  resolve_time_hours?: number
  severity: 'low' | 'medium' | 'high'
  observations?: string
}

export function useEmergencies(plantId?: string) {
  const params = plantId ? `?plantId=${plantId}` : ''

  return useQuery({
    queryKey: ['emergencies', plantId],
    queryFn: () => apiFetch<Emergency[]>(`/api/maintenance/emergencies${params}`),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// ============ DOCUMENTS ============

export type Document = {
  id: string
  plant_id: string
  file_name: string
  file_path: string
  category: string
  uploaded_at: string
}

export function useDocuments(plantId?: string) {
  const params = plantId ? `?plantId=${plantId}` : ''

  return useQuery({
    queryKey: ['documents', plantId],
    queryFn: () => apiFetch<Document[]>(`/api/documents${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

// ============ OPEX ============

export type OpexCost = {
  id: string
  plant_id: string
  period_date: string
  volume_m3: number
  cost_agua: number
  cost_personal: number
  cost_mantenimiento: number
  cost_energia: number
  cost_floculante: number
  cost_coagulante: number
  cost_estabilizador_ph: number
  cost_dap: number
  cost_urea: number
  cost_melaza: number
}

export function useOpexCosts(plantId?: string) {
  const params = plantId ? `?plantId=${plantId}` : ''

  return useQuery({
    queryKey: ['opex', plantId],
    queryFn: () => apiFetch<OpexCost[]>(`/api/opex${params}`),
    staleTime: 5 * 60 * 1000,
  })
}

// ============ DASHBOARD SUMMARY ============

export type DashboardSummary = {
  totalPlants: number
  activePlants: number
  envComplianceRate: number
  maintenanceCompletionRate: number
  pendingEmergencies: number
  recentAlerts: Array<{
    plantName: string
    parameter: string
    value: number
    threshold: number
    type: 'warning' | 'critical'
  }>
}

export function useDashboardSummary() {
  const { data: plants } = usePlants()
  const { data: envData } = useEnvironmentalData()
  const { data: maintenance } = useMaintenanceTasks()
  const { data: emergencies } = useEmergencies()

  // Calculate summary from fetched data
  const summary: DashboardSummary | null = plants && envData && maintenance && emergencies ? {
    totalPlants: plants.length,
    activePlants: plants.filter(p => p.status === 'active').length,
    envComplianceRate: calculateEnvCompliance(envData, plants),
    maintenanceCompletionRate: calculateMaintenanceRate(maintenance),
    pendingEmergencies: emergencies.filter(e => !e.solved).length,
    recentAlerts: generateAlerts(envData, plants),
  } : null

  return {
    data: summary,
    isLoading: !plants || !envData || !maintenance || !emergencies,
  }
}

// Helper functions for dashboard calculations
function calculateEnvCompliance(envData: EnvData[], plants: Plant[]): number {
  const plantIds = plants.map(p => p.id)
  const compliantPlants = plantIds.filter(plantId => {
    const plantData = envData.filter(e => e.plant_id === plantId && e.stream === 'effluent')
    if (plantData.length === 0) return true

    const latestByParam: Record<string, number | string> = {}
    plantData.forEach(d => {
      const dateKey = d.parameter_type + '_date'
      if (!latestByParam[d.parameter_type] || d.measurement_date > (latestByParam[dateKey] as string || '')) {
        latestByParam[d.parameter_type] = d.value
        latestByParam[dateKey] = d.measurement_date
      }
    })

    const dqoOk = !latestByParam.DQO || (latestByParam.DQO as number) < 200
    const phOk = !latestByParam.pH || ((latestByParam.pH as number) >= 6 && (latestByParam.pH as number) <= 8)
    const ssOk = !latestByParam.SS || (latestByParam.SS as number) < 100

    return dqoOk && phOk && ssOk
  }).length

  return plantIds.length ? Math.round((compliantPlants / plantIds.length) * 100) : 0
}

function calculateMaintenanceRate(tasks: MaintenanceTask[]): number {
  if (tasks.length === 0) return 0
  const completed = tasks.filter(t => t.status === 'completed').length
  return Math.round((completed / tasks.length) * 100)
}

// ============ DASHBOARD WIDGETS ============

export type UpcomingMaintenance = {
  id: string
  plant_id: string
  plant_name: string
  plant_location: string
  task_type: string
  description: string
  scheduled_date: string
  days_until: number
  status: string
}

export type UpcomingMaintenanceResponse = {
  all: UpcomingMaintenance[]
  urgent: UpcomingMaintenance[]
  soon: UpcomingMaintenance[]
  planned: UpcomingMaintenance[]
  total: number
}

export function useUpcomingMaintenance(days = 45) {
  return useQuery({
    queryKey: ['upcoming-maintenance', days],
    queryFn: () => apiFetch<UpcomingMaintenanceResponse>(`/api/dashboard/upcoming-maintenance?days=${days}`),
    staleTime: 5 * 60 * 1000,
  })
}

export type CostPerM3Data = {
  byPlant: Array<{
    plant_id: string
    plant_name: string
    avg_cost_per_m3: number
    total_volume: number
    total_cost: number
    months: number
  }>
  overall: {
    avg_cost_per_m3: number
    total_volume: number
    total_cost: number
  }
  history: Array<{
    plant_id: string
    plant_name: string
    period_date: string
    volume_m3: number
    total_cost: number
    cost_per_m3: number
  }>
}

export function useCostPerM3(months = 6) {
  return useQuery({
    queryKey: ['cost-per-m3', months],
    queryFn: () => apiFetch<CostPerM3Data>(`/api/dashboard/cost-per-m3?months=${months}`),
    staleTime: 10 * 60 * 1000,
  })
}

export type EnvironmentalAlert = {
  id: string
  plant_id: string
  plant_name: string
  parameter_type: string
  value: number
  unit: string
  measurement_date: string
  threshold: number
  alert_type: 'warning' | 'critical'
}

export type EnvironmentalAlertsResponse = {
  alerts: EnvironmentalAlert[]
  total: number
  critical: number
  warning: number
}

export function useEnvironmentalAlerts() {
  return useQuery({
    queryKey: ['environmental-alerts'],
    queryFn: () => apiFetch<EnvironmentalAlertsResponse>('/api/dashboard/environmental-alerts'),
    staleTime: 2 * 60 * 1000,
  })
}

export type DashboardWidgetSummary = {
  plants: { total: number; active: number; in_maintenance: number }
  emergencies: { total: number; high: number; medium: number; low: number }
  maintenance: { total: number; urgent: number; soon: number }
  checklists: { total_plants: number; completed: number; started: number; pending: number }
}

export function useDashboardWidgetSummary() {
  return useQuery({
    queryKey: ['dashboard-widget-summary'],
    queryFn: () => apiFetch<DashboardWidgetSummary>('/api/dashboard/summary'),
    staleTime: 2 * 60 * 1000,
  })
}

// ============ CHECKLIST ============

export type ChecklistItem = {
  id: string
  checklist_id: string
  equipment_id: string | null
  item_description: string
  category: string
  is_checked: boolean
  observation: string | null
  item_code?: string
  equipment_description?: string
}

export type DailyChecklist = {
  checklist: {
    id: string
    plant_id: string
    check_date: string
    operator_name: string
    completed_at: string | null
    notes: string | null
  }
  items: Record<string, ChecklistItem[]>
  progress: number
  total: number
  checked: number
}

export function useDailyChecklist(plantId: string) {
  return useQuery({
    queryKey: ['daily-checklist', plantId],
    queryFn: () => apiFetch<DailyChecklist>(`/api/checklist/today/${plantId}`),
    enabled: !!plantId,
    staleTime: 1 * 60 * 1000,
  })
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, is_checked, observation }: { itemId: string; is_checked?: boolean; observation?: string }) => {
      const res = await fetch(`/api/checklist/item/${itemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_checked, observation }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-checklist'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useCompleteChecklist() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ checklistId, notes }: { checklistId: string; notes?: string }) => {
      const res = await fetch(`/api/checklist/${checklistId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-checklist'] })
      toast.success('Checklist completado')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export type ChecklistSummary = {
  plant_id: string
  plant_name: string
  checklist_id: string | null
  completed_at: string | null
  operator_name: string | null
  total_items: number
  checked_items: number
}

export function useChecklistSummary() {
  return useQuery({
    queryKey: ['checklist-summary'],
    queryFn: () => apiFetch<ChecklistSummary[]>('/api/checklist/summary'),
    staleTime: 2 * 60 * 1000,
  })
}

function generateAlerts(envData: EnvData[], plants: Plant[]) {
  const alerts: DashboardSummary['recentAlerts'] = []
  const plantMap = new Map(plants.map(p => [p.id, p.name]))

  // Thresholds
  const thresholds = {
    DQO: { warning: 180, critical: 200 },
    pH: { warningLow: 6.2, warningHigh: 7.8, criticalLow: 6, criticalHigh: 8 },
    SS: { warning: 90, critical: 100 },
  }

  // Get latest effluent readings per plant
  const latestByPlant: Record<string, Record<string, EnvData>> = {}
  envData
    .filter(e => e.stream === 'effluent')
    .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))
    .forEach(e => {
      if (!latestByPlant[e.plant_id]) latestByPlant[e.plant_id] = {}
      if (!latestByPlant[e.plant_id][e.parameter_type]) {
        latestByPlant[e.plant_id][e.parameter_type] = e
      }
    })

  // Check thresholds
  Object.entries(latestByPlant).forEach(([plantId, params]) => {
    const plantName = plantMap.get(plantId) || plantId

    Object.values(params).forEach(data => {
      let type: 'warning' | 'critical' | null = null
      let threshold = 0

      if (data.parameter_type === 'DQO') {
        if (data.value >= thresholds.DQO.critical) {
          type = 'critical'
          threshold = thresholds.DQO.critical
        } else if (data.value >= thresholds.DQO.warning) {
          type = 'warning'
          threshold = thresholds.DQO.warning
        }
      } else if (data.parameter_type === 'pH') {
        if (data.value < thresholds.pH.criticalLow || data.value > thresholds.pH.criticalHigh) {
          type = 'critical'
          threshold = data.value < 7 ? thresholds.pH.criticalLow : thresholds.pH.criticalHigh
        } else if (data.value < thresholds.pH.warningLow || data.value > thresholds.pH.warningHigh) {
          type = 'warning'
          threshold = data.value < 7 ? thresholds.pH.warningLow : thresholds.pH.warningHigh
        }
      } else if (data.parameter_type === 'SS') {
        if (data.value >= thresholds.SS.critical) {
          type = 'critical'
          threshold = thresholds.SS.critical
        } else if (data.value >= thresholds.SS.warning) {
          type = 'warning'
          threshold = thresholds.SS.warning
        }
      }

      if (type) {
        alerts.push({
          plantName,
          parameter: data.parameter_type,
          value: data.value,
          threshold,
          type,
        })
      }
    })
  })

  return alerts.slice(0, 10) // Max 10 alerts
}
