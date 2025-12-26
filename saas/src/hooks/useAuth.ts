import { useState, useEffect } from 'react'

interface User {
  id: number
  email: string
  name: string | null
  role: string
}

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      })

      if (!res.ok) {
        setState({ user: null, loading: false, error: null })
        return
      }

      const json = await res.json()
      if (json.success && json.user) {
        setState({ user: json.user, loading: false, error: null })
      } else {
        setState({ user: null, loading: false, error: null })
      }
    } catch (error) {
      setState({ user: null, loading: false, error: 'Error al verificar autenticación' })
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      setState({ user: null, loading: false, error: null })
      window.location.href = '/login'
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    logout,
    refetch: checkAuth,
  }
}
