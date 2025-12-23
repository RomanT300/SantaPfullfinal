/**
 * Authentication Store using Zustand
 * Manages user session, token, and selected plant
 */
import { create } from 'zustand'
import { Platform } from 'react-native'
import { login as apiLogin, logout as apiLogout, loadStoredToken, checkAuth } from '../services/api'
import type { User, Plant } from '../types'

// Storage wrapper that works on both web and native
const Storage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.setItemAsync(key, value)
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.deleteItemAsync(key)
  }
}

interface AuthState {
  user: User | null
  token: string | null
  selectedPlant: Plant | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<boolean>
  selectPlant: (plant: Plant) => Promise<void>
  clearPlant: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  selectedPlant: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const { user, token } = await apiLogin(email, password)
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await apiLogout()
    } finally {
      // Clear stored plant selection
      await Storage.deleteItemAsync('selected_plant')
      set({
        user: null,
        token: null,
        selectedPlant: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },

  checkSession: async () => {
    set({ isLoading: true })
    try {
      const token = await loadStoredToken()
      if (token) {
        const user = await checkAuth()
        if (user) {
          // Try to restore selected plant
          const plantJson = await Storage.getItemAsync('selected_plant')
          const selectedPlant = plantJson ? JSON.parse(plantJson) : null

          set({
            user,
            token,
            selectedPlant,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        }
      }
      set({ isLoading: false, isAuthenticated: false })
      return false
    } catch (error) {
      set({ isLoading: false, isAuthenticated: false })
      return false
    }
  },

  selectPlant: async (plant: Plant) => {
    // Store plant selection persistently
    await Storage.setItemAsync('selected_plant', JSON.stringify(plant))
    set({ selectedPlant: plant })
  },

  clearPlant: () => {
    Storage.deleteItemAsync('selected_plant')
    set({ selectedPlant: null })
  },
}))
