/**
 * Plant Selection Screen
 * Allows operator to select which plant they will inspect today
 */
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../stores/authStore'
import { getPlants } from '../services/api'
import type { Plant } from '../types'

export default function PlantSelectScreen() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { user, selectPlant, logout } = useAuthStore()

  const loadPlants = async () => {
    try {
      const data = await getPlants()
      // Filter only active plants
      setPlants(data.filter(p => p.status === 'active'))
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron cargar las plantas')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadPlants()
  }, [])

  const handleSelectPlant = async (plant: Plant) => {
    await selectPlant(plant)
  }

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Sesión', style: 'destructive', onPress: () => logout() },
      ]
    )
  }

  const renderPlantItem = ({ item }: { item: Plant }) => (
    <TouchableOpacity
      style={styles.plantCard}
      onPress={() => handleSelectPlant(item)}
      activeOpacity={0.7}
    >
      <View style={styles.plantIcon}>
        <Ionicons name="water" size={28} color="#2563EB" />
      </View>
      <View style={styles.plantInfo}>
        <Text style={styles.plantName}>{item.name}</Text>
        <Text style={styles.plantLocation}>{item.location}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  )

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando plantas...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {user?.name || 'Operador'}</Text>
          {user?.organizationName && (
            <Text style={styles.orgName}>{user.organizationName}</Text>
          )}
          <Text style={styles.headerSubtitle}>Selecciona la planta a inspeccionar</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Date Banner */}
      <View style={styles.dateBanner}>
        <Ionicons name="calendar-outline" size={20} color="#2563EB" />
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('es-EC', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Plants List */}
      <FlatList
        data={plants}
        keyExtractor={(item) => item.id}
        renderItem={renderPlantItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true)
              loadPlants()
            }}
            colors={['#2563EB']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No hay plantas disponibles</Text>
          </View>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {plants.length} planta{plants.length !== 1 ? 's' : ''} disponible{plants.length !== 1 ? 's' : ''}
        </Text>
      </View>
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  orgName: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  dateText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  plantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
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
    color: '#6B7280',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
})
