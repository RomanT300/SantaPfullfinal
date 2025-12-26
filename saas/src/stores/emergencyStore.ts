/**
 * Emergency Store - Manages real-time emergency notifications
 * Uses polling to check for new unacknowledged emergencies
 */
import { create } from 'zustand'

export type Emergency = {
  id: string
  plant_id: string
  plant_name: string
  reason: string
  description: string | null
  reported_by: string | null
  reported_at: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'resolved'
  solved: boolean
  acknowledged: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
}

type EmergencyState = {
  // State
  emergencies: Emergency[]
  newEmergencies: Emergency[]
  showPopup: boolean
  lastChecked: Date | null
  isPolling: boolean

  // Actions
  setEmergencies: (emergencies: Emergency[]) => void
  addNewEmergency: (emergency: Emergency) => void
  dismissPopup: () => void
  acknowledgeEmergency: (id: string) => Promise<void>
  startPolling: () => void
  stopPolling: () => void
  checkForEmergencies: () => Promise<void>
}

let pollingInterval: NodeJS.Timeout | null = null

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  emergencies: [],
  newEmergencies: [],
  showPopup: false,
  lastChecked: null,
  isPolling: false,

  setEmergencies: (emergencies) => set({ emergencies }),

  addNewEmergency: (emergency) => {
    set((state) => ({
      newEmergencies: [...state.newEmergencies, emergency],
      showPopup: true,
    }))
  },

  dismissPopup: () => {
    set({ showPopup: false, newEmergencies: [] })
  },

  acknowledgeEmergency: async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      await fetch(`/api/maintenance/emergencies/${id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      // Remove from new emergencies and refresh
      set((state) => ({
        newEmergencies: state.newEmergencies.filter(e => e.id !== id),
        showPopup: state.newEmergencies.filter(e => e.id !== id).length > 0,
      }))

      // Refresh the list
      get().checkForEmergencies()
    } catch (error) {
      console.error('Error acknowledging emergency:', error)
    }
  },

  checkForEmergencies: async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) return

      const response = await fetch('/api/maintenance/emergencies/unacknowledged', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      })

      if (!response.ok) return

      const json = await response.json()
      if (!json.success) return

      const unacknowledged: Emergency[] = json.data || []
      const currentEmergencies = get().emergencies
      const lastChecked = get().lastChecked

      // First time loading - show all unacknowledged emergencies
      if (!lastChecked && unacknowledged.length > 0) {
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3')
          audio.volume = 0.5
          audio.play().catch(() => {})
        } catch {}

        set({
          emergencies: unacknowledged,
          newEmergencies: unacknowledged,
          showPopup: true,
          lastChecked: new Date(),
        })
        return
      }

      // Subsequent checks - only show truly new ones
      const currentIds = new Set(currentEmergencies.map(e => e.id))
      const newOnes = unacknowledged.filter(e => !currentIds.has(e.id))

      if (newOnes.length > 0) {
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3')
          audio.volume = 0.5
          audio.play().catch(() => {})
        } catch {}

        set({
          emergencies: unacknowledged,
          newEmergencies: newOnes,
          showPopup: true,
          lastChecked: new Date(),
        })
      } else {
        set({
          emergencies: unacknowledged,
          lastChecked: new Date(),
        })
      }
    } catch (error) {
      console.error('Error checking emergencies:', error)
    }
  },

  startPolling: () => {
    if (get().isPolling) return

    set({ isPolling: true })

    // Check immediately
    get().checkForEmergencies()

    // Then poll every 30 seconds
    pollingInterval = setInterval(() => {
      get().checkForEmergencies()
    }, 30000)
  },

  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      pollingInterval = null
    }
    set({ isPolling: false })
  },
}))
