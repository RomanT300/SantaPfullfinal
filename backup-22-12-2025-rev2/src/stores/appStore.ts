/**
 * Global App Store using Zustand
 * Manages app-wide state like plants, theme, and UI preferences
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Plant = {
  id: string
  name: string
  location: string
  latitude?: number
  longitude?: number
  status: 'active' | 'inactive' | 'maintenance'
}

export type Alert = {
  id: string
  plantId: string
  plantName: string
  parameter: 'DQO' | 'pH' | 'SS'
  value: number
  threshold: number
  type: 'warning' | 'critical'
  message: string
  timestamp: Date
  acknowledged: boolean
}

type AppState = {
  // Plants
  plants: Plant[]
  selectedPlantId: string | null
  plantsLoading: boolean

  // Alerts
  alerts: Alert[]
  unreadAlerts: number

  // UI Preferences
  sidebarOpen: boolean
  compactMode: boolean

  // Actions
  setPlants: (plants: Plant[]) => void
  setSelectedPlant: (plantId: string | null) => void
  setPlantsLoading: (loading: boolean) => void
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void
  acknowledgeAlert: (alertId: string) => void
  clearAlerts: () => void
  toggleSidebar: () => void
  setCompactMode: (compact: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      plants: [],
      selectedPlantId: null,
      plantsLoading: false,
      alerts: [],
      unreadAlerts: 0,
      sidebarOpen: true,
      compactMode: false,

      // Plant actions
      setPlants: (plants) => set({ plants }),
      setSelectedPlant: (selectedPlantId) => set({ selectedPlantId }),
      setPlantsLoading: (plantsLoading) => set({ plantsLoading }),

      // Alert actions
      addAlert: (alertData) => {
        const alert: Alert = {
          ...alertData,
          id: crypto.randomUUID(),
          timestamp: new Date(),
          acknowledged: false,
        }
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, 50), // Keep last 50 alerts
          unreadAlerts: state.unreadAlerts + 1,
        }))
      },

      acknowledgeAlert: (alertId) => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, acknowledged: true } : a
          ),
          unreadAlerts: Math.max(0, state.unreadAlerts - 1),
        }))
      },

      clearAlerts: () => set({ alerts: [], unreadAlerts: 0 }),

      // UI actions
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setCompactMode: (compactMode) => set({ compactMode }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        selectedPlantId: state.selectedPlantId,
        sidebarOpen: state.sidebarOpen,
        compactMode: state.compactMode,
      }),
    }
  )
)

// Selector hooks
export const usePlants = () => useAppStore((state) => state.plants)
export const useSelectedPlant = () => {
  const plants = useAppStore((state) => state.plants)
  const selectedId = useAppStore((state) => state.selectedPlantId)
  return plants.find((p) => p.id === selectedId) || null
}
export const useAlerts = () => useAppStore((state) => state.alerts)
export const useUnreadAlerts = () => useAppStore((state) => state.unreadAlerts)
