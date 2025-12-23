/**
 * PTAR Checklist Mobile App
 * Santa Priscila - Aplicación para operadores de campo
 * UX MEJORADA v3.0:
 * - Feedback háptico en todas las interacciones
 * - Auto-advance entre campos de valor
 * - Botón red flag visible (no solo swipe)
 * - Botón "Completar sección"
 * - Mejor accesibilidad y contraste
 * - Indicador de último item editado
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
  FlatList,
  Vibration,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import { registerRootComponent } from 'expo'
import axios from 'axios'

// API base URL - configurable for production
// Detecta automáticamente si estamos en túnel o localhost
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // Si NO es localhost, usar la misma URL base (el backend sirve todo)
    if (host !== 'localhost') {
      return `${window.location.protocol}//${window.location.host}/api`
    }
  }
  return 'http://localhost:8080/api'
}
const API_URL = getApiUrl()

// Platform-safe haptic feedback
const triggerHaptic = async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
  try {
    if (Platform.OS === 'web') {
      // Web fallback - use vibration if available
      if ('vibrate' in navigator) {
        navigator.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30)
      }
      return
    }

    switch (type) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        break
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        break
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        break
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        break
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        break
      default:
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  } catch (e) {
    // Silently fail if haptics not available
  }
}

// Platform-safe storage
const Storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    return null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
    }
  },
}

// Types
type User = { id: string; name: string; email: string; role: string }
type Plant = { id: string; name: string; location: string; status: string }

type ChecklistItem = {
  id: string
  checklist_id: string
  item_description: string
  category: string
  section: string
  is_checked: number
  is_red_flag: number
  red_flag_comment: string | null
  numeric_value: number | null
  unit: string | null
  observation: string | null
  photo_path: string | null
  requires_value: number
  template_unit: string | null
}

type ChecklistData = {
  checklist: {
    id: string
    plant_id: string
    check_date: string
    operator_name: string
    completed_at: string | null
  }
  items: Record<string, ChecklistItem[]>
  progress: number
  total: number
  checked: number
  redFlags: number
}

// Emergency types
type EmergencySeverity = 'low' | 'medium' | 'high'
type Emergency = {
  id: string
  plant_id: string
  plant_name?: string
  reason: string
  severity: EmergencySeverity
  solved: boolean
  reported_at: string
  operator_name?: string
  source?: 'admin' | 'mobile'
}

// Context for auto-advance functionality
type ItemRefs = Map<string, TextInput>

// Swipeable Item Component with all UX improvements
function SwipeableItem({
  item,
  onCheck,
  onValueChange,
  onRedFlag,
  onCommentPress,
  token,
  inputRef,
  onSubmitEditing,
  isLastEdited,
}: {
  item: ChecklistItem
  onCheck: () => void
  onValueChange: (value: string) => void
  onRedFlag: () => void
  onCommentPress: () => void
  token: string | null
  inputRef?: (ref: TextInput | null) => void
  onSubmitEditing?: () => void
  isLastEdited?: boolean
}) {
  const translateX = useRef(new Animated.Value(0)).current
  const highlightAnim = useRef(new Animated.Value(isLastEdited ? 1 : 0)).current
  const [inputValue, setInputValue] = useState(item.numeric_value?.toString() || '')
  const [isSaving, setIsSaving] = useState(false)
  const localInputRef = useRef<TextInput | null>(null)

  // Highlight animation for last edited item
  useEffect(() => {
    if (isLastEdited) {
      highlightAnim.setValue(1)
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: false,
      }).start()
    }
  }, [isLastEdited])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -80))
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          triggerHaptic('medium')
          Animated.spring(translateX, {
            toValue: -80,
            useNativeDriver: true,
          }).start()
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start()
        }
      },
    })
  ).current

  const resetSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start()
  }

  const handleValueBlur = async () => {
    if (inputValue !== (item.numeric_value?.toString() || '')) {
      setIsSaving(true)
      triggerHaptic('light')
      await onValueChange(inputValue)
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (inputValue !== (item.numeric_value?.toString() || '')) {
      setIsSaving(true)
      triggerHaptic('success')
      await onValueChange(inputValue)
      setIsSaving(false)
    }
    onSubmitEditing?.()
  }

  const handleRedFlagPress = () => {
    resetSwipe()
    triggerHaptic('warning')
    onRedFlag()
  }

  const handleCheckPress = () => {
    triggerHaptic('light')
    onCheck()
  }

  const backgroundColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#DBEAFE'],
  })

  // Determine status for visual feedback
  const isOk = item.is_checked === 1 && item.is_red_flag !== 1
  const hasProblem = item.is_red_flag === 1

  return (
    <View style={styles.swipeContainer}>
      {/* Red flag action background (swipe) */}
      <View style={styles.swipeActionRight}>
        <TouchableOpacity
          style={styles.redFlagAction}
          onPress={handleRedFlagPress}
          accessibilityLabel="Marcar como problema"
          accessibilityHint="Reporta un problema con este equipo"
        >
          <Text style={styles.redFlagActionText}>⚠️</Text>
          <Text style={styles.redFlagActionLabel}>Problema</Text>
        </TouchableOpacity>
      </View>

      {/* Main item content */}
      <Animated.View
        style={[
          styles.checklistItem,
          { transform: [{ translateX }], backgroundColor },
          hasProblem && styles.itemRedFlagBg,
          isOk && styles.itemOkBg,
        ]}
        {...panResponder.panHandlers}
      >
        {/* Item content - description first */}
        <View style={styles.itemContentFull}>
          <Text
            style={[
              styles.itemDescription,
              isOk && styles.itemDescriptionOk,
              hasProblem && styles.itemDescriptionProblem,
            ]}
            accessibilityRole="text"
          >
            {item.item_description}
          </Text>

          {/* INLINE value input - auto-advance enabled */}
          {item.requires_value === 1 && (
            <View style={styles.inlineValueContainer}>
              <TextInput
                ref={(ref) => {
                  if (ref) localInputRef.current = ref
                  inputRef?.(ref)
                }}
                style={[
                  styles.inlineValueInput,
                  isSaving && styles.inputSaving,
                ]}
                placeholder="Valor"
                placeholderTextColor="#6B7280"
                value={inputValue}
                onChangeText={setInputValue}
                onBlur={handleValueBlur}
                onSubmitEditing={handleSubmit}
                keyboardType="decimal-pad"
                returnKeyType="next"
                selectTextOnFocus
                accessibilityLabel={`Valor para ${item.item_description}`}
                accessibilityHint="Ingresa el valor numérico y presiona siguiente"
              />
              <Text style={styles.inlineUnit}>
                {item.template_unit || item.unit || ''}
              </Text>
              {isSaving && (
                <ActivityIndicator size="small" color="#2563EB" style={styles.savingIndicator} />
              )}
            </View>
          )}

          {/* STATUS BUTTONS - Main UX change */}
          <View style={styles.statusButtonsRow}>
            {/* FUNCIONA CORRECTO button */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                styles.okButton,
                isOk && styles.okButtonActive,
              ]}
              onPress={handleCheckPress}
              accessibilityLabel={isOk ? 'Funcionamiento correcto confirmado' : 'Confirmar funcionamiento correcto'}
              accessibilityRole="button"
            >
              <Text style={[styles.statusButtonText, isOk && styles.okButtonTextActive]}>
                {isOk ? '✓ Correcto' : 'Funciona OK'}
              </Text>
            </TouchableOpacity>

            {/* PROBLEMA button */}
            <TouchableOpacity
              style={[
                styles.statusButton,
                styles.problemButton,
                hasProblem && styles.problemButtonActive,
              ]}
              onPress={handleRedFlagPress}
              accessibilityLabel={hasProblem ? 'Problema reportado - toca para editar' : 'Reportar problema'}
              accessibilityRole="button"
            >
              <Text style={[styles.statusButtonText, hasProblem && styles.problemButtonTextActive]}>
                {hasProblem ? '⚠️ Problema' : 'Problema'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show problem comment if exists */}
          {hasProblem && item.red_flag_comment && (
            <TouchableOpacity
              style={styles.problemCommentBox}
              onPress={handleRedFlagPress}
              accessibilityLabel="Editar comentario del problema"
            >
              <Text style={styles.problemCommentText}>
                ⚠️ {item.red_flag_comment}
              </Text>
            </TouchableOpacity>
          )}

          {/* Show observation if exists (optional note for OK items) */}
          {item.observation && !hasProblem && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light')
                onCommentPress()
              }}
              style={styles.observationPreview}
              accessibilityLabel="Editar nota"
            >
              <Text style={styles.observationText}>📝 {item.observation}</Text>
            </TouchableOpacity>
          )}

          {/* Add optional note link (only shown if OK and no observation) */}
          {isOk && !item.observation && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light')
                onCommentPress()
              }}
              style={styles.addNoteButton}
              accessibilityLabel="Agregar nota opcional"
            >
              <Text style={styles.addNoteText}>+ Agregar nota (opcional)</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

export default function App() {
  const [screen, setScreen] = useState<'login' | 'plants' | 'checklist'>('login')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [plants, setPlants] = useState<Plant[]>([])
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Checklist state
  const [checklistData, setChecklistData] = useState<ChecklistData | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Track last edited item for highlight
  const [lastEditedItemId, setLastEditedItemId] = useState<string | null>(null)

  // Input refs for auto-advance
  const itemInputRefs = useRef<ItemRefs>(new Map())

  // Simple comment modal
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentText, setCommentText] = useState('')

  // Red flag modal
  const [showRedFlagModal, setShowRedFlagModal] = useState(false)
  const [redFlagComment, setRedFlagComment] = useState('')

  // Complete checklist modal
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')

  // Emergency modal state
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [emergencySeverity, setEmergencySeverity] = useState<EmergencySeverity>('medium')
  const [emergencyLocation, setEmergencyLocation] = useState('')
  const [emergencySubmitting, setEmergencySubmitting] = useState(false)

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Get all items with requires_value in order
  const getValueItems = useCallback((): ChecklistItem[] => {
    if (!checklistData) return []
    const allItems: ChecklistItem[] = []
    for (const section of Object.keys(checklistData.items)) {
      if (expandedSections.has(section)) {
        allItems.push(...checklistData.items[section].filter(i => i.requires_value === 1))
      }
    }
    return allItems
  }, [checklistData, expandedSections])

  // Focus next value input (auto-advance)
  const focusNextInput = useCallback((currentItemId: string) => {
    const valueItems = getValueItems()
    const currentIndex = valueItems.findIndex(i => i.id === currentItemId)
    if (currentIndex >= 0 && currentIndex < valueItems.length - 1) {
      const nextItem = valueItems[currentIndex + 1]
      const nextRef = itemInputRefs.current.get(nextItem.id)
      if (nextRef) {
        nextRef.focus()
        triggerHaptic('light')
      }
    } else {
      // Last item - show success
      triggerHaptic('success')
    }
  }, [getValueItems])

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const savedToken = await Storage.getItem('auth_token')
        if (savedToken) {
          const response = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
          if (response.data.success) {
            setUser(response.data.user)
            setToken(savedToken)
            await loadPlants(savedToken)
            setScreen('plants')
          }
        }
      } catch (err) {
        await Storage.removeItem('auth_token')
      }
    }
    checkSession()
  }, [])

  const loadPlants = async (authToken: string) => {
    try {
      const plantsResponse = await axios.get(`${API_URL}/plants`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (plantsResponse.data.success) {
        const activePlants = plantsResponse.data.data.filter(
          (p: Plant) => p.status === 'active'
        )
        setPlants(activePlants)
      }
    } catch (err) {
      console.error('Error loading plants:', err)
    }
  }

  const loadChecklist = async (plantId: string, authToken: string) => {
    setChecklistLoading(true)
    try {
      const response = await axios.get(`${API_URL}/checklist/today/${plantId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })

      if (response.data.success) {
        setChecklistData(response.data.data)
        // Expand ALL sections by default for faster access
        const sections = Object.keys(response.data.data.items)
        setExpandedSections(new Set(sections))
      }
    } catch (err: any) {
      console.error('Error loading checklist:', err)
      setChecklistData(null)
    } finally {
      setChecklistLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Por favor ingresa tu correo y contraseña')
      triggerHaptic('error')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email.trim(),
        password,
      })

      if (response.data.success) {
        const userData = response.data.user
        const authToken = response.data.token

        setUser(userData)
        setToken(authToken)
        await Storage.setItem('auth_token', authToken)
        await loadPlants(authToken)
        triggerHaptic('success')
        setScreen('plants')
      } else {
        setError(response.data.error || 'Error de autenticación')
        triggerHaptic('error')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error de conexión')
      triggerHaptic('error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPlant = async (plant: Plant) => {
    triggerHaptic('medium')
    setSelectedPlant(plant)
    setScreen('checklist')
    if (token) {
      await loadChecklist(plant.id, token)
    }
  }

  const toggleSection = (section: string) => {
    triggerHaptic('light')
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  // Quick check - solo un tap
  const handleQuickCheck = async (item: ChecklistItem) => {
    if (!token || !checklistData) return

    const newChecked = item.is_checked === 1 ? 0 : 1
    triggerHaptic(newChecked === 1 ? 'success' : 'light')

    // Optimistic update
    updateItemInState(item.id, { is_checked: newChecked })
    setLastEditedItemId(item.id)

    try {
      await axios.patch(
        `${API_URL}/checklist/item/${item.id}`,
        { is_checked: newChecked === 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (err) {
      // Revert on error
      updateItemInState(item.id, { is_checked: item.is_checked })
      triggerHaptic('error')
      console.error('Error updating item:', err)
    }
  }

  // Inline value change - auto-marks as checked
  const handleValueChange = async (item: ChecklistItem, value: string) => {
    if (!token || !checklistData) return

    const numValue = value ? parseFloat(value) : null

    // Optimistic update
    updateItemInState(item.id, { numeric_value: numValue, is_checked: 1 })
    setLastEditedItemId(item.id)

    try {
      await axios.patch(
        `${API_URL}/checklist/item/${item.id}`,
        { numeric_value: numValue, is_checked: true },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch (err) {
      triggerHaptic('error')
      console.error('Error updating value:', err)
    }
  }

  // Complete all items in a section (without values)
  const handleCompleteSection = async (section: string) => {
    if (!token || !checklistData) return

    const items = checklistData.items[section]
    const uncheckedItems = items.filter(i => i.is_checked !== 1 && i.requires_value !== 1)

    if (uncheckedItems.length === 0) {
      triggerHaptic('warning')
      return
    }

    triggerHaptic('medium')

    // Optimistic update all
    for (const item of uncheckedItems) {
      updateItemInState(item.id, { is_checked: 1 })
    }

    // Update all on server
    try {
      await Promise.all(
        uncheckedItems.map(item =>
          axios.patch(
            `${API_URL}/checklist/item/${item.id}`,
            { is_checked: true },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      )
      triggerHaptic('success')
    } catch (err) {
      triggerHaptic('error')
      console.error('Error completing section:', err)
      // Reload checklist on error
      if (selectedPlant) {
        await loadChecklist(selectedPlant.id, token)
      }
    }
  }

  // Open comment modal
  const handleCommentPress = (item: ChecklistItem) => {
    setSelectedItem(item)
    setCommentText(item.observation || '')
    setShowCommentModal(true)
  }

  // Save comment
  const handleSaveComment = async () => {
    if (!selectedItem || !token) return

    setIsLoading(true)
    try {
      await axios.patch(
        `${API_URL}/checklist/item/${selectedItem.id}`,
        { observation: commentText || null, is_checked: true },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      updateItemInState(selectedItem.id, {
        observation: commentText || null,
        is_checked: 1,
      })

      triggerHaptic('success')
      setShowCommentModal(false)
      setSelectedItem(null)
      setLastEditedItemId(selectedItem.id)
    } catch (err) {
      triggerHaptic('error')
      console.error('Error saving comment:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Open red flag modal
  const handleRedFlagPress = (item: ChecklistItem) => {
    setSelectedItem(item)
    setRedFlagComment(item.red_flag_comment || '')
    setShowRedFlagModal(true)
  }

  // Save red flag
  const handleSaveRedFlag = async () => {
    if (!selectedItem || !token || !redFlagComment.trim()) return

    setIsLoading(true)
    try {
      await axios.patch(
        `${API_URL}/checklist/item/${selectedItem.id}`,
        {
          is_red_flag: true,
          red_flag_comment: redFlagComment,
          is_checked: true,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      updateItemInState(selectedItem.id, {
        is_red_flag: 1,
        red_flag_comment: redFlagComment,
        is_checked: 1,
      })

      triggerHaptic('warning')
      setShowRedFlagModal(false)
      setSelectedItem(null)
      setRedFlagComment('')
      setLastEditedItemId(selectedItem.id)
    } catch (err) {
      triggerHaptic('error')
      console.error('Error saving red flag:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Remove red flag
  const handleRemoveRedFlag = async () => {
    if (!selectedItem || !token) return

    setIsLoading(true)
    try {
      await axios.patch(
        `${API_URL}/checklist/item/${selectedItem.id}`,
        { is_red_flag: false, red_flag_comment: null },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      updateItemInState(selectedItem.id, {
        is_red_flag: 0,
        red_flag_comment: null,
      })

      triggerHaptic('success')
      setShowRedFlagModal(false)
      setSelectedItem(null)
      setRedFlagComment('')
    } catch (err) {
      triggerHaptic('error')
      console.error('Error removing red flag:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to update item in state
  const updateItemInState = (itemId: string, updates: Partial<ChecklistItem>) => {
    setChecklistData((prev) => {
      if (!prev) return prev
      const newItems = { ...prev.items }
      for (const section of Object.keys(newItems)) {
        newItems[section] = newItems[section].map((i) =>
          i.id === itemId ? { ...i, ...updates } : i
        )
      }
      const allItems = Object.values(newItems).flat()
      const checked = allItems.filter((i) => i.is_checked === 1).length
      const redFlags = allItems.filter((i) => i.is_red_flag === 1).length
      return {
        ...prev,
        items: newItems,
        checked,
        redFlags,
        progress: Math.round((checked / prev.total) * 100),
      }
    })
  }

  const handleCompleteChecklist = async () => {
    if (!token || !checklistData) return

    setIsLoading(true)
    try {
      await axios.post(
        `${API_URL}/checklist/${checklistData.checklist.id}/complete`,
        { notes: completionNotes, notify_supervisor: true },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      triggerHaptic('success')
      setShowCompleteModal(false)
      if (Platform.OS === 'web') {
        alert('✅ Checklist completado y enviado al supervisor!')
      }

      // Reload checklist
      if (selectedPlant) {
        await loadChecklist(selectedPlant.id, token)
      }
    } catch (err) {
      triggerHaptic('error')
      console.error('Error completing checklist:', err)
      if (Platform.OS === 'web') {
        alert('Error al completar checklist')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Report emergency - sends to backend and triggers email notification
  const handleReportEmergency = async () => {
    if (!token || !selectedPlant || !emergencyReason.trim()) {
      triggerHaptic('error')
      if (Platform.OS === 'web') {
        alert('Por favor describe la emergencia')
      }
      return
    }

    setEmergencySubmitting(true)
    try {
      await axios.post(
        `${API_URL}/maintenance/emergencies/report`,
        {
          plantId: selectedPlant.id,
          reason: emergencyReason.trim(),
          severity: emergencySeverity,
          operatorName: user?.name || user?.email || 'Operador',
          operatorId: user?.id,
          locationDescription: emergencyLocation.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      triggerHaptic('success')
      setShowEmergencyModal(false)
      setEmergencyReason('')
      setEmergencySeverity('medium')
      setEmergencyLocation('')

      if (Platform.OS === 'web') {
        alert('🚨 Emergencia reportada exitosamente!\n\nSe ha enviado una notificación al equipo de supervisión.')
      }
    } catch (err: any) {
      triggerHaptic('error')
      console.error('Error reporting emergency:', err)
      if (Platform.OS === 'web') {
        alert('Error al reportar emergencia: ' + (err.response?.data?.error || err.message))
      }
    } finally {
      setEmergencySubmitting(false)
    }
  }

  const openEmergencyModal = () => {
    triggerHaptic('heavy')
    setShowEmergencyModal(true)
  }

  const handleLogout = async () => {
    triggerHaptic('medium')
    setUser(null)
    setToken(null)
    setSelectedPlant(null)
    setPlants([])
    setChecklistData(null)
    await Storage.removeItem('auth_token')
    setScreen('login')
    setEmail('')
    setPassword('')
  }

  const handleBackToPlants = () => {
    triggerHaptic('light')
    setSelectedPlant(null)
    setChecklistData(null)
    setExpandedSections(new Set())
    setLastEditedItemId(null)
    setScreen('plants')
  }

  // ==================== RENDER ====================

  // LOGIN SCREEN
  if (screen === 'login') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loginContainer}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>PTAR</Text>
            </View>
            <Text style={styles.title}>Santa Priscila</Text>
            <Text style={styles.subtitle}>Sistema de Checklist Operativo</Text>
          </View>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="operador@santapriscila.com"
              placeholderTextColor="#6B7280"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              accessibilityLabel="Correo electrónico"
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
              accessibilityLabel="Contraseña"
            />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Iniciar Sesión</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>PTAR Checklist v3.0 - UX Mejorada</Text>
        </View>
      </View>
    )
  }

  // PLANT SELECT SCREEN
  if (screen === 'plants') {
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hola, {user?.name || 'Operador'}</Text>
            <Text style={styles.headerSubtitle}>Selecciona la planta</Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
          >
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateBanner}>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('es-EC', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        <ScrollView style={styles.plantsList}>
          {plants.map((plant) => (
            <TouchableOpacity
              key={plant.id}
              style={styles.plantCard}
              onPress={() => handleSelectPlant(plant)}
              accessibilityRole="button"
              accessibilityLabel={`Seleccionar planta ${plant.name}`}
            >
              <View style={styles.plantIcon}>
                <Text style={styles.plantIconText}>💧</Text>
              </View>
              <View style={styles.plantInfo}>
                <Text style={styles.plantName}>{plant.name}</Text>
                <Text style={styles.plantLocation}>{plant.location}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.plantsFooter}>
          <Text style={styles.plantsFooterText}>
            {plants.length} plantas disponibles
          </Text>
        </View>
      </View>
    )
  }

  // CHECKLIST SCREEN - UX MEJORADA v3.0
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.checklistHeader}>
        <TouchableOpacity
          onPress={handleBackToPlants}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Volver a lista de plantas"
        >
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.plantTitle}>{selectedPlant?.name}</Text>
          <Text style={styles.checklistDate}>
            {new Date().toLocaleDateString('es-EC', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        {/* Emergency button - always visible */}
        <TouchableOpacity
          onPress={openEmergencyModal}
          style={styles.emergencyButton}
          accessibilityRole="button"
          accessibilityLabel="Reportar emergencia"
        >
          <Text style={styles.emergencyButtonText}>🚨</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {checklistData && (
        <View style={styles.progressContainer}>
          <View style={styles.progressStats}>
            <Text style={styles.progressText}>
              {checklistData.checked}/{checklistData.total} completados
            </Text>
            {checklistData.redFlags > 0 && (
              <View style={styles.redFlagBadge} accessibilityLabel={`${checklistData.redFlags} red flags`}>
                <Text style={styles.redFlagBadgeText}>
                  🚩 {checklistData.redFlags}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.progressBar} accessibilityRole="progressbar" accessibilityValue={{ now: checklistData.progress, min: 0, max: 100 }}>
            <View
              style={[
                styles.progressFill,
                { width: `${checklistData.progress}%` },
                checklistData.progress === 100 && styles.progressFillComplete,
              ]}
            />
          </View>
          {/* UX Tips */}
          <View style={styles.uxTipContainer}>
            <Text style={styles.uxTip}>
              ✓ Funciona OK = verde • ⚠️ Problema = rojo + comentario obligatorio
            </Text>
          </View>
        </View>
      )}

      {/* Checklist content */}
      {checklistLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Cargando checklist...</Text>
        </View>
      ) : !checklistData || Object.keys(checklistData.items).length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Sin checklist configurado</Text>
          <Text style={styles.emptyStateText}>
            Contacta al administrador para configurar la plantilla.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.checklistContent} keyboardShouldPersistTaps="handled">
          {Object.entries(checklistData.items).map(([section, items]) => {
            const checkedCount = items.filter(i => i.is_checked === 1).length
            const uncheckedNoValue = items.filter(i => i.is_checked !== 1 && i.requires_value !== 1).length

            return (
              <View key={section} style={styles.section}>
                {/* Section header */}
                <View style={styles.sectionHeaderContainer}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(section)}
                    accessibilityRole="button"
                    accessibilityLabel={`Sección ${section}, ${checkedCount} de ${items.length} completados`}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <Text style={styles.sectionTitle}>{section}</Text>
                      <View style={[
                        styles.sectionCountBadge,
                        checkedCount === items.length && styles.sectionCountComplete
                      ]}>
                        <Text style={[
                          styles.sectionCount,
                          checkedCount === items.length && styles.sectionCountTextComplete
                        ]}>
                          {checkedCount}/{items.length}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sectionArrow}>
                      {expandedSections.has(section) ? '▼' : '▶'}
                    </Text>
                  </TouchableOpacity>

                  {/* Complete section button - shows when section is expanded and has unchecked items */}
                  {expandedSections.has(section) && uncheckedNoValue > 0 && (
                    <TouchableOpacity
                      style={styles.completeSectionButton}
                      onPress={() => handleCompleteSection(section)}
                      accessibilityRole="button"
                      accessibilityLabel={`Completar ${uncheckedNoValue} items de ${section}`}
                    >
                      <Text style={styles.completeSectionText}>
                        ✓ Completar {uncheckedNoValue}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Section items */}
                {expandedSections.has(section) && (
                  <View style={styles.sectionItems}>
                    {items.map((item) => (
                      <SwipeableItem
                        key={item.id}
                        item={item}
                        token={token}
                        onCheck={() => handleQuickCheck(item)}
                        onValueChange={(value) => handleValueChange(item, value)}
                        onRedFlag={() => handleRedFlagPress(item)}
                        onCommentPress={() => handleCommentPress(item)}
                        inputRef={(ref) => {
                          if (ref) {
                            itemInputRefs.current.set(item.id, ref)
                          } else {
                            itemInputRefs.current.delete(item.id)
                          }
                        }}
                        onSubmitEditing={() => focusNextInput(item.id)}
                        isLastEdited={lastEditedItemId === item.id}
                      />
                    ))}
                  </View>
                )}
              </View>
            )
          })}

          {/* Spacer for footer */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Footer with complete button */}
      {checklistData && !checklistData.checklist.completed_at && (
        <View style={styles.checklistFooter}>
          <TouchableOpacity
            style={[
              styles.completeButton,
              checklistData.progress < 100 && styles.completeButtonDisabled,
            ]}
            onPress={() => {
              triggerHaptic('medium')
              setShowCompleteModal(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={checklistData.progress < 100 ? `Completar checklist, ${checklistData.progress}% completado` : 'Finalizar y enviar checklist'}
          >
            <Text style={styles.completeButtonText}>
              {checklistData.progress < 100
                ? `Completar (${checklistData.progress}%)`
                : '✅ Finalizar y Enviar'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {checklistData?.checklist.completed_at && (
        <View style={styles.completedBanner} accessibilityRole="alert">
          <Text style={styles.completedText}>
            ✅ Checklist completado - {new Date(checklistData.checklist.completed_at).toLocaleTimeString('es-EC')}
          </Text>
        </View>
      )}

      {/* Simple Comment Modal */}
      <Modal
        visible={showCommentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCommentModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentSmall}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💬 Comentario</Text>
              <TouchableOpacity
                onPress={() => setShowCommentModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalItemDescription} numberOfLines={2}>
                {selectedItem?.item_description}
              </Text>

              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Escribe tu observación..."
                placeholderTextColor="#6B7280"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={3}
                autoFocus
                accessibilityLabel="Comentario"
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCommentModal(false)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.buttonDisabled]}
                onPress={handleSaveComment}
                disabled={isLoading}
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Problem Modal - Para reportar problemas con equipos */}
      <Modal
        visible={showRedFlagModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRedFlagModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentSmall}>
            <View style={[styles.modalHeader, styles.redFlagModalHeader]}>
              <Text style={styles.modalTitle}>⚠️ Reportar Problema</Text>
              <TouchableOpacity
                onPress={() => setShowRedFlagModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalItemDescription} numberOfLines={2}>
                {selectedItem?.item_description}
              </Text>

              <Text style={styles.inputLabel}>Describe el problema (obligatorio)</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="¿Qué problema tiene el equipo? Ej: No funciona, hace ruido, fuga de agua..."
                placeholderTextColor="#6B7280"
                value={redFlagComment}
                onChangeText={setRedFlagComment}
                multiline
                numberOfLines={4}
                autoFocus
                accessibilityLabel="Descripción del problema"
              />
              <Text style={styles.requiredHint}>* El comentario es obligatorio para reportar un problema</Text>
            </View>

            <View style={styles.modalFooter}>
              {selectedItem?.is_red_flag === 1 && (
                <TouchableOpacity
                  style={[styles.cancelButton, styles.removeRedFlagButton]}
                  onPress={handleRemoveRedFlag}
                  disabled={isLoading}
                  accessibilityRole="button"
                  accessibilityLabel="Marcar como funcionando correctamente"
                >
                  <Text style={styles.removeRedFlagText}>Funciona OK</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowRedFlagModal(false)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  styles.redFlagSaveButton,
                  (isLoading || !redFlagComment.trim()) && styles.buttonDisabled,
                ]}
                onPress={handleSaveRedFlag}
                disabled={isLoading || !redFlagComment.trim()}
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Complete Checklist Modal */}
      <Modal
        visible={showCompleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finalizar Checklist</Text>
              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.completeSummary}>
                <Text style={styles.completeSummaryTitle}>Resumen</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items completados:</Text>
                  <Text style={styles.summaryValue}>
                    {checklistData?.checked}/{checklistData?.total}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Red Flags:</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      checklistData?.redFlags && checklistData.redFlags > 0
                        ? styles.summaryValueRed
                        : null,
                    ]}
                  >
                    {checklistData?.redFlags || 0}
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notas finales (opcional)</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  placeholder="Agrega notas adicionales..."
                  placeholderTextColor="#6B7280"
                  value={completionNotes}
                  onChangeText={setCompletionNotes}
                  multiline
                  numberOfLines={4}
                  accessibilityLabel="Notas finales"
                />
              </View>

              <View style={styles.completeWarningBox}>
                <Text style={styles.completeWarning}>
                  ⚠️ Se enviará un reporte al supervisor
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCompleteModal(false)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isLoading && styles.buttonDisabled]}
                onPress={handleCompleteChecklist}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Enviar reporte"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Enviar Reporte</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Emergency Report Modal */}
      <Modal
        visible={showEmergencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEmergencyModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContentSmall}>
            <View style={[styles.modalHeader, styles.emergencyModalHeader]}>
              <Text style={styles.emergencyModalTitle}>🚨 Reportar Emergencia</Text>
              <TouchableOpacity
                onPress={() => setShowEmergencyModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.emergencyModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Warning banner */}
              <View style={styles.emergencyWarningBanner}>
                <Text style={styles.emergencyWarningText}>
                  ⚠️ Las emergencias se notifican inmediatamente al equipo de supervisión por correo electrónico.
                  Use esta función solo para situaciones que requieran atención urgente.
                </Text>
              </View>

              {/* Plant info */}
              <Text style={styles.inputLabel}>Planta</Text>
              <View style={[styles.modalInput, { backgroundColor: '#F3F4F6', paddingVertical: 14 }]}>
                <Text style={{ color: '#374151', fontSize: 16 }}>{selectedPlant?.name}</Text>
              </View>

              {/* Severity selector */}
              <View style={styles.severityContainer}>
                <Text style={styles.severityLabel}>Nivel de urgencia</Text>
                <View style={styles.severityOptions}>
                  <TouchableOpacity
                    style={[
                      styles.severityOption,
                      emergencySeverity === 'low' ? styles.severityOptionLowActive : styles.severityOptionLow,
                    ]}
                    onPress={() => { setEmergencySeverity('low'); triggerHaptic('light') }}
                  >
                    <Text style={[
                      styles.severityOptionText,
                      emergencySeverity === 'low' && styles.severityOptionTextActive,
                      emergencySeverity !== 'low' && { color: '#22C55E' },
                    ]}>🟢 Baja</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.severityOption,
                      emergencySeverity === 'medium' ? styles.severityOptionMediumActive : styles.severityOptionMedium,
                    ]}
                    onPress={() => { setEmergencySeverity('medium'); triggerHaptic('medium') }}
                  >
                    <Text style={[
                      styles.severityOptionText,
                      emergencySeverity === 'medium' && styles.severityOptionTextActive,
                      emergencySeverity !== 'medium' && { color: '#F59E0B' },
                    ]}>🟡 Media</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.severityOption,
                      emergencySeverity === 'high' ? styles.severityOptionHighActive : styles.severityOptionHigh,
                    ]}
                    onPress={() => { setEmergencySeverity('high'); triggerHaptic('heavy') }}
                  >
                    <Text style={[
                      styles.severityOptionText,
                      emergencySeverity === 'high' && styles.severityOptionTextActive,
                      emergencySeverity !== 'high' && { color: '#DC2626' },
                    ]}>🔴 Alta</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.inputLabel}>Descripción de la emergencia *</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Describa qué está pasando y dónde..."
                placeholderTextColor="#9CA3AF"
                value={emergencyReason}
                onChangeText={setEmergencyReason}
                multiline
                numberOfLines={4}
                autoFocus
              />

              {/* Location */}
              <Text style={styles.inputLabel}>Ubicación específica (opcional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ej: Reactor 1, Sala de bombas..."
                placeholderTextColor="#9CA3AF"
                value={emergencyLocation}
                onChangeText={setEmergencyLocation}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEmergencyModal(false)}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.emergencySubmitButton,
                  (emergencySubmitting || !emergencyReason.trim()) && styles.emergencySubmitButtonDisabled,
                ]}
                onPress={handleReportEmergency}
                disabled={emergencySubmitting || !emergencyReason.trim()}
                accessibilityRole="button"
              >
                {emergencySubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.emergencySubmitButtonText}>🚨 Enviar Emergencia</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  // Login styles
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    color: '#6B7280',
    marginTop: 32,
    fontSize: 12,
  },
  // Header styles
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 16,
  },
  plantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  logoutButton: {
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 16,
  },
  // Date banner
  dateBanner: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dateText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  // Plants list
  plantsList: {
    flex: 1,
    padding: 16,
  },
  plantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  plantIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plantIconText: {
    fontSize: 24,
  },
  plantInfo: {
    flex: 1,
  },
  plantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  plantLocation: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 2,
  },
  arrow: {
    fontSize: 20,
    color: '#6B7280',
  },
  plantsFooter: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  plantsFooterText: {
    color: '#4B5563',
    fontSize: 14,
    textAlign: 'center',
  },
  // Checklist styles
  checklistHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  checklistDate: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  redFlagBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  redFlagBadgeText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  progressFillComplete: {
    backgroundColor: '#10B981',
  },
  uxTipContainer: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
  },
  uxTip: {
    fontSize: 12,
    color: '#0369A1',
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
  },
  checklistContent: {
    flex: 1,
  },
  section: {
    marginBottom: 1,
  },
  sectionHeaderContainer: {
    backgroundColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  sectionCountBadge: {
    backgroundColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  sectionCountComplete: {
    backgroundColor: '#10B981',
  },
  sectionCount: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  sectionCountTextComplete: {
    color: '#FFFFFF',
  },
  sectionArrow: {
    fontSize: 12,
    color: '#4B5563',
  },
  completeSectionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
  },
  completeSectionText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  sectionItems: {
    backgroundColor: '#FFFFFF',
  },
  // Swipeable item styles
  swipeContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  swipeActionRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redFlagAction: {
    alignItems: 'center',
  },
  redFlagActionText: {
    fontSize: 24,
  },
  redFlagActionLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  itemRedFlagBg: {
    backgroundColor: '#FEF2F2',
  },
  itemOkBg: {
    backgroundColor: '#F0FDF4',
  },
  // Full width content (no checkbox)
  itemContentFull: {
    flex: 1,
  },
  itemDescription: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  itemDescriptionOk: {
    color: '#166534',
  },
  itemDescriptionProblem: {
    color: '#991B1B',
  },
  // Status buttons row
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // OK button styles
  okButton: {
    borderColor: '#22C55E',
    backgroundColor: '#FFFFFF',
  },
  okButtonActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  okButtonTextActive: {
    color: '#FFFFFF',
  },
  // Problem button styles
  problemButton: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  problemButtonActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  problemButtonTextActive: {
    color: '#FFFFFF',
  },
  // Problem comment box
  problemCommentBox: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  problemCommentText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  // Optional note button
  addNoteButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  addNoteText: {
    fontSize: 12,
    color: '#6B7280',
  },
  // Legacy styles (kept for compatibility)
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  checkboxRedFlag: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemContent: {
    flex: 1,
  },
  itemChecked: {
    color: '#4B5563',
  },
  // Inline value input
  inlineValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  inlineValueInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    minWidth: 80,
    maxWidth: 140,
    textAlign: 'center',
  },
  inputSaving: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  inlineUnit: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  savingIndicator: {
    marginLeft: 8,
  },
  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  observationPreview: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 1,
  },
  observationText: {
    fontSize: 12,
    color: '#1D4ED8',
  },
  addCommentButton: {
    paddingVertical: 6,
  },
  addCommentText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  redFlagQuickButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  redFlagQuickText: {
    fontSize: 14,
  },
  redFlagIndicator: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  redFlagText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  checklistFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completeButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  completedBanner: {
    backgroundColor: '#D1FAE5',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  completedText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalContentSmall: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  redFlagModalHeader: {
    backgroundColor: '#FEF2F2',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalClose: {
    fontSize: 24,
    color: '#4B5563',
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalItemDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  requiredHint: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  removeRedFlagButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  removeRedFlagText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  redFlagSaveButton: {
    backgroundColor: '#DC2626',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Complete modal
  completeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  completeSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  summaryValueRed: {
    color: '#DC2626',
  },
  completeWarningBox: {
    marginTop: 8,
  },
  completeWarning: {
    fontSize: 13,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    fontWeight: '500',
  },
  // Emergency button and modal styles
  emergencyButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emergencyButtonText: {
    fontSize: 20,
  },
  emergencyModalHeader: {
    backgroundColor: '#DC2626',
  },
  emergencyModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emergencyModalClose: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  emergencyWarningBanner: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    padding: 12,
    marginBottom: 16,
  },
  emergencyWarningText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  severityContainer: {
    marginBottom: 16,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  severityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  severityOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  severityOptionLow: {
    borderColor: '#22C55E',
    backgroundColor: '#FFFFFF',
  },
  severityOptionLowActive: {
    borderColor: '#22C55E',
    backgroundColor: '#22C55E',
  },
  severityOptionMedium: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
  },
  severityOptionMediumActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B',
  },
  severityOptionHigh: {
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
  },
  severityOptionHighActive: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  severityOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  severityOptionTextActive: {
    color: '#FFFFFF',
  },
  emergencySubmitButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  emergencySubmitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  emergencySubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
})

// Register the root component for Expo
registerRootComponent(App)
