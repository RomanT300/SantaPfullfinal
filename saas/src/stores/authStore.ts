/**
 * Authentication Store for Multi-Tenant SaaS
 * Manages user session, tokens, and organization context
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'owner' | 'admin' | 'supervisor' | 'operator' | 'viewer'
  plantId?: string
}

interface Organization {
  id: string
  name: string
  slug: string
  plan: 'starter' | 'pro'
  status: string
  logoUrl?: string
  primaryColor?: string
  plantTypes?: 'biosems' | 'textiles' | 'both'
}

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

interface AuthState {
  user: User | null
  organization: Organization | null
  tokens: Tokens | null
  isAuthenticated: boolean
  isLoading: boolean
  _hasHydrated: boolean

  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshTokens: () => Promise<void>
  updateUser: (user: Partial<User>) => void
  updateOrganization: (org: Partial<Organization>) => void
  setLoading: (loading: boolean) => void
  setHasHydrated: (state: boolean) => void
}

interface RegisterData {
  organizationName: string
  email: string
  password: string
  name: string
}

const API_URL = import.meta.env.VITE_API_URL || ''

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state })
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })

        try {
          const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Login failed')
          }

          set({
            user: data.data.user,
            organization: data.data.organization,
            tokens: data.data.tokens,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      register: async (registerData: RegisterData) => {
        set({ isLoading: true })

        try {
          const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerData)
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Registration failed')
          }

          set({
            user: data.data.user,
            organization: data.data.organization,
            tokens: data.data.tokens,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        const { tokens } = get()

        // Call logout endpoint (fire and forget)
        if (tokens?.accessToken) {
          fetch(`${API_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokens.accessToken}`
            }
          }).catch(() => {})
        }

        set({
          user: null,
          organization: null,
          tokens: null,
          isAuthenticated: false
        })
      },

      refreshTokens: async () => {
        const { tokens } = get()

        if (!tokens?.refreshToken) {
          throw new Error('No refresh token')
        }

        try {
          const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: tokens.refreshToken })
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || 'Token refresh failed')
          }

          set({
            tokens: data.data.tokens
          })
        } catch (error) {
          // On refresh failure, logout
          get().logout()
          throw error
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...userData } })
        }
      },

      updateOrganization: (orgData: Partial<Organization>) => {
        const { organization } = get()
        if (organization) {
          set({ organization: { ...organization, ...orgData } })
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      }
    }),
    {
      name: 'ptar-saas-auth',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      }
    }
  )
)

// Helper hooks
export const useUser = () => useAuthStore((state) => state.user)
export const useOrganization = () => useAuthStore((state) => state.organization)
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated)
export const useHasHydrated = () => useAuthStore((state) => state._hasHydrated)
export const useIsAdmin = () => {
  const user = useAuthStore((state) => state.user)
  return user?.role === 'owner' || user?.role === 'admin'
}
export const useIsOwner = () => {
  const user = useAuthStore((state) => state.user)
  return user?.role === 'owner'
}
