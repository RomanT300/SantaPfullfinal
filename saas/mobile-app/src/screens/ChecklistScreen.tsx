/**
 * Checklist Screen
 * Main screen where operators fill out the daily checklist
 * Supports checking items, red flags, photos, and observations
 */
import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../stores/authStore'
import { useChecklistStore } from '../stores/checklistStore'
import type { ChecklistItem } from '../types'

// Section labels in Spanish
const sectionLabels: Record<string, string> = {
  pozo_bombeo: 'Pozo de Bombeo',
  pretratamiento: 'Pretratamiento',
  homogeneizacion: 'Homogeneización',
  bombeo: 'Bombeo',
  distribucion: 'Distribución',
  reactor_biologico: 'Reactor Biológico',
  decantacion: 'Decantación',
  lodos: 'Lodos',
  cloracion: 'Cloración',
  efluente: 'Efluente',
  control: 'Control',
  general: 'General',
}

export default function ChecklistScreen() {
  const { selectedPlant, clearPlant, user } = useAuthStore()
  const {
    checklist,
    isLoading,
    isSyncing,
    error,
    loadChecklist,
    updateItem,
    uploadPhoto,
    completeChecklist,
    refresh,
  } = useChecklistStore()

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null)
  const [showRedFlagModal, setShowRedFlagModal] = useState(false)
  const [redFlagComment, setRedFlagComment] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (selectedPlant) {
      loadChecklist(selectedPlant.id)
    }
  }, [selectedPlant])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleCheckItem = async (item: ChecklistItem) => {
    if (checklist?.checklist.completed_at) return

    try {
      await updateItem(item.id, { is_checked: !item.is_checked })
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el item')
    }
  }

  const handleRedFlag = (item: ChecklistItem) => {
    if (checklist?.checklist.completed_at) return

    setSelectedItem(item)
    setRedFlagComment(item.red_flag_comment || '')
    setShowRedFlagModal(true)
  }

  const confirmRedFlag = async () => {
    if (!selectedItem) return

    try {
      await updateItem(selectedItem.id, {
        is_red_flag: true,
        red_flag_comment: redFlagComment,
      })
      setShowRedFlagModal(false)
      setSelectedItem(null)
      setRedFlagComment('')
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo guardar el red flag')
    }
  }

  const removeRedFlag = async () => {
    if (!selectedItem) return

    try {
      await updateItem(selectedItem.id, {
        is_red_flag: false,
        red_flag_comment: '',
      })
      setShowRedFlagModal(false)
      setSelectedItem(null)
      setRedFlagComment('')
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo quitar el red flag')
    }
  }

  const handleTakePhoto = async (item: ChecklistItem) => {
    if (checklist?.checklist.completed_at) return

    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara para tomar fotos')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      try {
        await uploadPhoto(item.id, result.assets[0].uri)
        Alert.alert('Éxito', 'Foto guardada correctamente')
      } catch (error: any) {
        Alert.alert('Error', error.message || 'No se pudo subir la foto')
      }
    }
  }

  const handleComplete = () => {
    if (!checklist) return

    if (checklist.progress < 100) {
      Alert.alert(
        'Checklist incompleto',
        `Faltan ${checklist.total - checklist.checked} items por completar. ¿Deseas finalizar de todas formas?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Finalizar', onPress: () => finishChecklist() },
        ]
      )
    } else {
      finishChecklist()
    }
  }

  const finishChecklist = async () => {
    try {
      await completeChecklist(notes, true)
      Alert.alert(
        'Checklist Completado',
        'El reporte ha sido enviado al supervisor.',
        [{ text: 'OK' }]
      )
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo completar el checklist')
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    await refresh()
    setIsRefreshing(false)
  }, [refresh])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando checklist...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => selectedPlant && loadChecklist(selectedPlant.id)}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!checklist) return null

  const isCompleted = checklist.checklist.completed_at !== null

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={clearPlant} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.plantName}>{selectedPlant?.name}</Text>
          <Text style={styles.dateText}>
            {new Date().toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>
        {isSyncing && <ActivityIndicator size="small" color="#2563EB" />}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressStats}>
          <Text style={styles.progressText}>{checklist.checked} de {checklist.total}</Text>
          <Text style={[styles.progressPercent, isCompleted && styles.progressComplete]}>
            {checklist.progress}%
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${checklist.progress}%` },
              isCompleted && styles.progressFillComplete,
            ]}
          />
        </View>
        {checklist.redFlags > 0 && (
          <View style={styles.redFlagBadge}>
            <Ionicons name="flag" size={14} color="#EF4444" />
            <Text style={styles.redFlagText}>{checklist.redFlags} Red Flag{checklist.redFlags > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Completed Banner */}
      {isCompleted && (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <View style={styles.completedInfo}>
            <Text style={styles.completedTitle}>Checklist Completado</Text>
            <Text style={styles.completedDate}>
              {new Date(checklist.checklist.completed_at!).toLocaleString('es-EC')}
            </Text>
          </View>
        </View>
      )}

      {/* Checklist Items */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#2563EB']} />
        }
      >
        {Object.entries(checklist.items).map(([section, items]) => (
          <View key={section} style={styles.sectionContainer}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section)}
            >
              <Text style={styles.sectionTitle}>
                {sectionLabels[section] || section}
              </Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {(items as ChecklistItem[]).filter(i => i.is_checked).length}/{(items as ChecklistItem[]).length}
                </Text>
              </View>
              <Ionicons
                name={expandedSections.has(section) ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {expandedSections.has(section) && (
              <View style={styles.itemsList}>
                {(items as ChecklistItem[]).map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    disabled={isCompleted}
                    onCheck={() => handleCheckItem(item)}
                    onRedFlag={() => handleRedFlag(item)}
                    onPhoto={() => handleTakePhoto(item)}
                  />
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Notes Section */}
        {!isCompleted && (
          <View style={styles.notesSection}>
            <TouchableOpacity
              style={styles.notesHeader}
              onPress={() => setShowNotes(!showNotes)}
            >
              <Ionicons name="document-text-outline" size={20} color="#6B7280" />
              <Text style={styles.notesTitle}>Notas generales</Text>
              <Ionicons name={showNotes ? 'chevron-up' : 'chevron-down'} size={20} color="#6B7280" />
            </TouchableOpacity>
            {showNotes && (
              <TextInput
                style={styles.notesInput}
                placeholder="Agregar notas o comentarios..."
                placeholderTextColor="#9CA3AF"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Complete Button */}
      {!isCompleted && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.completeButton,
              checklist.progress >= 100 && styles.completeButtonReady,
            ]}
            onPress={handleComplete}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>
                  {checklist.progress >= 100 ? 'Finalizar Inspección' : `Faltan ${checklist.total - checklist.checked} items`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Red Flag Modal */}
      <Modal
        visible={showRedFlagModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRedFlagModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="flag" size={24} color="#EF4444" />
              <Text style={styles.modalTitle}>Red Flag</Text>
            </View>
            <Text style={styles.modalDescription}>
              {selectedItem?.item_description}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Describe el problema encontrado..."
              placeholderTextColor="#9CA3AF"
              value={redFlagComment}
              onChangeText={setRedFlagComment}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowRedFlagModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              {selectedItem?.is_red_flag && (
                <TouchableOpacity
                  style={styles.modalButtonRemove}
                  onPress={removeRedFlag}
                >
                  <Text style={styles.modalButtonRemoveText}>Quitar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={confirmRedFlag}
              >
                <Text style={styles.modalButtonConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// Individual checklist item row component
function ChecklistItemRow({
  item,
  disabled,
  onCheck,
  onRedFlag,
  onPhoto,
}: {
  item: ChecklistItem
  disabled: boolean
  onCheck: () => void
  onRedFlag: () => void
  onPhoto: () => void
}) {
  return (
    <View style={[styles.itemRow, item.is_red_flag && styles.itemRowRedFlag]}>
      <TouchableOpacity
        onPress={onCheck}
        disabled={disabled}
        style={styles.checkButton}
      >
        <Ionicons
          name={item.is_checked ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={item.is_checked ? '#10B981' : '#D1D5DB'}
        />
      </TouchableOpacity>
      <View style={styles.itemContent}>
        <Text style={[styles.itemText, item.is_checked && styles.itemTextChecked]}>
          {item.item_description}
        </Text>
        {item.observation && (
          <Text style={styles.itemObservation}>{item.observation}</Text>
        )}
        {item.is_red_flag && item.red_flag_comment && (
          <View style={styles.redFlagComment}>
            <Ionicons name="flag" size={12} color="#EF4444" />
            <Text style={styles.redFlagCommentText}>{item.red_flag_comment}</Text>
          </View>
        )}
      </View>
      {!disabled && (
        <View style={styles.itemActions}>
          <TouchableOpacity onPress={onRedFlag} style={styles.actionButton}>
            <Ionicons
              name="flag"
              size={20}
              color={item.is_red_flag ? '#EF4444' : '#9CA3AF'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onPhoto} style={styles.actionButton}>
            <Ionicons
              name={item.photo_path ? 'image' : 'camera-outline'}
              size={20}
              color={item.photo_path ? '#2563EB' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  plantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    color: '#6B7280',
    fontSize: 14,
  },
  progressPercent: {
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressComplete: {
    color: '#10B981',
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
  redFlagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  redFlagText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 16,
    gap: 12,
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 16,
  },
  completedDate: {
    color: '#6EE7B7',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sectionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  sectionBadgeText: {
    color: '#6B7280',
    fontSize: 12,
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemRowRedFlag: {
    backgroundColor: '#FEF2F2',
  },
  checkButton: {
    marginRight: 12,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  itemTextChecked: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  itemObservation: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 4,
  },
  redFlagComment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  redFlagCommentText: {
    fontSize: 12,
    color: '#EF4444',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  notesSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  notesTitle: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  notesInput: {
    padding: 16,
    paddingTop: 0,
    fontSize: 14,
    color: '#374151',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  completeButton: {
    backgroundColor: '#9CA3AF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  completeButtonReady: {
    backgroundColor: '#10B981',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: '#374151',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  modalButtonRemove: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  modalButtonRemoveText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
