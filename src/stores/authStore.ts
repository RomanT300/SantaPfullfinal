/**
 * Global Auth Store using Zustand
 * Manages user authentication state across the app
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type User = {
  id: string
  email: string
  name: string
  role: 'admin' | 'standard'
}

type AuthState = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false
      }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
          })
        } catch {
          // Ignore errors on logout
        }
        set({ user: null, isAuthenticated: false })
      },

      checkAuth: async () => {
        set({ isLoading: true })
        try {
          const res = await fetch('/api/auth/me', { credentials: 'include' })
          const json = await res.json()
          if (json.success && json.user) {
            set({
              user: json.user,
              isAuthenticated: true,
              isLoading: false
            })
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === 'admin')
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
