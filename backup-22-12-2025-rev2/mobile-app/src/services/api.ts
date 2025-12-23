/**
 * API Service for PTAR Checklist App
 * Connects to the main Santa Priscila backend
 */
import axios from 'axios'
import { Platform } from 'react-native'
import type { Plant, ChecklistData, User, ChecklistHistory, ChecklistTemplate, ChecklistItem } from '../types'

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

// Configure base URL - change this to your server IP when deploying
// For local development, use your computer's local IP address
// Find your IP: hostname -I (Linux) or ipconfig (Windows)
const API_BASE_URL = __DEV__
  ? 'http://localhost:8080/api'  // Use localhost for web preview, change to IP for mobile
  : 'https://ptar.santapriscila.com/api' // Production URL

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token management
let authToken: string | null = null

export const setAuthToken = async (token: string) => {
  authToken = token
  await Storage.setItemAsync('auth_token', token)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const clearAuthToken = async () => {
  authToken = null
  await Storage.deleteItemAsync('auth_token')
  delete api.defaults.headers.common['Authorization']
}

export const loadStoredToken = async (): Promise<string | null> => {
  const token = await Storage.getItemAsync('auth_token')
  if (token) {
    authToken = token
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }
  return token
}

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthToken()
    }
    return Promise.reject(error)
  }
)

// ============ AUTH ============

export const login = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  const response = await api.post('/auth/login', { email, password })
  if (!response.data.success) {
    throw new Error(response.data.error || 'Error de autenticación')
  }
  const { user, token } = response.data.data
  await setAuthToken(token)
  return { user, token }
}

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout')
  } finally {
    await clearAuthToken()
  }
}

export const checkAuth = async (): Promise<User | null> => {
  try {
    const response = await api.get('/auth/me')
    if (response.data.success) {
      return response.data.data
    }
    return null
  } catch {
    return null
  }
}

// ============ PLANTS ============

export const getPlants = async (): Promise<Plant[]> => {
  const response = await api.get('/plants')
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

// ============ CHECKLIST TEMPLATES ============

export const getChecklistTemplates = async (plantId: string): Promise<ChecklistTemplate[]> => {
  const response = await api.get(`/checklist/templates/${plantId}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

// ============ CHECKLIST ============

export const getTodayChecklist = async (plantId: string, templateId?: string): Promise<ChecklistData> => {
  const params = templateId ? `?templateId=${templateId}` : ''
  const response = await api.get(`/checklist/today/${plantId}${params}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const updateChecklistItem = async (
  itemId: string,
  data: {
    is_checked?: boolean
    is_red_flag?: boolean
    red_flag_comment?: string
    observation?: string
    numeric_value?: number
  }
): Promise<void> => {
  const response = await api.patch(`/checklist/item/${itemId}`, data)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
}

export const uploadItemPhoto = async (itemId: string, photoUri: string): Promise<string> => {
  const formData = new FormData()
  const filename = photoUri.split('/').pop() || 'photo.jpg'

  // Get the file extension
  const match = /\.(\w+)$/.exec(filename)
  const type = match ? `image/${match[1]}` : 'image/jpeg'

  formData.append('photo', {
    uri: photoUri,
    type,
    name: filename,
  } as any)

  const response = await api.post(`/checklist/item/${itemId}/photo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  if (!response.data.success) {
    throw new Error(response.data.error)
  }

  return response.data.data.photo_path
}

export const completeChecklist = async (
  checklistId: string,
  notes?: string,
  notifySupervisor: boolean = true
): Promise<{ total: number; checked: number; red_flags: number; report_sent: boolean }> => {
  const response = await api.post(`/checklist/${checklistId}/complete`, {
    notes,
    notify_supervisor: notifySupervisor,
  })
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const getChecklistHistory = async (
  plantId?: string,
  days?: number
): Promise<ChecklistHistory[]> => {
  const params = new URLSearchParams()
  if (days) params.set('days', days.toString())

  const url = plantId
    ? `/checklist/history/${plantId}?${params.toString()}`
    : `/checklist/summary`

  const response = await api.get(url)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const getChecklistSummary = async (): Promise<any[]> => {
  const response = await api.get('/checklist/summary')
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

// ============ SUPERVISOR ENDPOINTS ============

export const getSupervisorReports = async (
  days?: number,
  plantId?: string
): Promise<any[]> => {
  const params = new URLSearchParams()
  if (days) params.set('days', days.toString())
  if (plantId) params.set('plantId', plantId)

  const response = await api.get(`/checklist/supervisor/reports?${params.toString()}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const getReportDetails = async (reportId: string): Promise<any> => {
  const response = await api.get(`/checklist/supervisor/report/${reportId}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const markReportAsRead = async (reportId: string): Promise<void> => {
  const response = await api.patch(`/checklist/supervisor/report/${reportId}/read`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
}

// ============ RED FLAGS ============

export const getRedFlagReports = async (
  days?: number,
  plantId?: string,
  resolved?: boolean
): Promise<{ redFlags: any[]; stats: any }> => {
  const params = new URLSearchParams()
  if (days) params.set('days', days.toString())
  if (plantId) params.set('plantId', plantId)
  if (resolved !== undefined) params.set('resolved', resolved.toString())

  const response = await api.get(`/checklist/red-flags?${params.toString()}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export const resolveRedFlag = async (flagId: string, resolution_notes?: string): Promise<void> => {
  const response = await api.patch(`/checklist/red-flag/${flagId}/resolve`, {
    resolution_notes,
  })
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
}

// ============ STATS ============

export const getChecklistStats = async (
  days?: number,
  plantId?: string
): Promise<any> => {
  const params = new URLSearchParams()
  if (days) params.set('days', days.toString())
  if (plantId) params.set('plantId', plantId)

  const response = await api.get(`/checklist/stats?${params.toString()}`)
  if (!response.data.success) {
    throw new Error(response.data.error)
  }
  return response.data.data
}

export default api
