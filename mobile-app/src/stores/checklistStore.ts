/**
 * Checklist Store using Zustand
 * Manages current checklist state and sync with server
 */
import { create } from 'zustand'
import * as api from '../services/api'
import type { ChecklistData, ChecklistItem } from '../types'

interface ChecklistState {
  checklist: ChecklistData | null
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  lastSync: Date | null

  // Actions
  loadChecklist: (plantId: string, templateId?: string) => Promise<void>
  updateItem: (itemId: string, data: Partial<ChecklistItem>) => Promise<void>
  uploadPhoto: (itemId: string, photoUri: string) => Promise<string>
  completeChecklist: (notes?: string, notifySupervisor?: boolean) => Promise<void>
  refresh: () => Promise<void>
  clearChecklist: () => void
}

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  checklist: null,
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSync: null,

  loadChecklist: async (plantId: string, templateId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const data = await api.getTodayChecklist(plantId, templateId)
      set({
        checklist: data,
        isLoading: false,
        lastSync: new Date(),
      })
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar checklist',
        isLoading: false,
      })
    }
  },

  updateItem: async (itemId: string, data: Partial<ChecklistItem>) => {
    set({ isSyncing: true })
    try {
      await api.updateChecklistItem(itemId, data)

      // Update local state optimistically
      const { checklist } = get()
      if (checklist) {
        const updatedItems = { ...checklist.items }
        for (const section of Object.keys(updatedItems)) {
          updatedItems[section] = updatedItems[section].map(item =>
            item.id === itemId ? { ...item, ...data } : item
          )
        }

        // Recalculate progress
        const allItems = Object.values(updatedItems).flat()
        const checked = allItems.filter(i => i.is_checked).length
        const redFlags = allItems.filter(i => i.is_red_flag).length
        const progress = allItems.length > 0 ? Math.round((checked / allItems.length) * 100) : 0

        set({
          checklist: {
            ...checklist,
            items: updatedItems,
            progress,
            checked,
            redFlags,
          },
          isSyncing: false,
          lastSync: new Date(),
        })
      } else {
        set({ isSyncing: false })
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar item',
        isSyncing: false,
      })
      throw error
    }
  },

  uploadPhoto: async (itemId: string, photoUri: string) => {
    set({ isSyncing: true })
    try {
      const photoPath = await api.uploadItemPhoto(itemId, photoUri)

      // Update local state
      const { checklist } = get()
      if (checklist) {
        const updatedItems = { ...checklist.items }
        for (const section of Object.keys(updatedItems)) {
          updatedItems[section] = updatedItems[section].map(item =>
            item.id === itemId ? { ...item, photo_path: photoPath } : item
          )
        }
        set({
          checklist: { ...checklist, items: updatedItems },
          isSyncing: false,
          lastSync: new Date(),
        })
      } else {
        set({ isSyncing: false })
      }

      return photoPath
    } catch (error: any) {
      set({
        error: error.message || 'Error al subir foto',
        isSyncing: false,
      })
      throw error
    }
  },

  completeChecklist: async (notes?: string, notifySupervisor: boolean = true) => {
    const { checklist } = get()
    if (!checklist) return

    set({ isSyncing: true })
    try {
      await api.completeChecklist(checklist.checklist.id, notes, notifySupervisor)

      // Reload checklist to get updated state
      await get().loadChecklist(checklist.checklist.plant_id)
      set({ isSyncing: false })
    } catch (error: any) {
      set({
        error: error.message || 'Error al completar checklist',
        isSyncing: false,
      })
      throw error
    }
  },

  refresh: async () => {
    const { checklist } = get()
    if (checklist) {
      await get().loadChecklist(checklist.checklist.plant_id)
    }
  },

  clearChecklist: () => {
    set({
      checklist: null,
      error: null,
      lastSync: null,
    })
  },
}))
