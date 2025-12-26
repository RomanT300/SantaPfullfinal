/**
 * App Navigation
 * Simple state-based navigation for web compatibility
 * No external navigation library required
 */
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import LoginScreen from '../screens/LoginScreen'
import PlantSelectScreen from '../screens/PlantSelectScreen'
import ChecklistScreen from '../screens/ChecklistScreen'

export default function AppNavigator() {
  const { isLoading, isAuthenticated, selectedPlant, checkSession } = useAuthStore()
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        await checkSession()
      } catch (e: any) {
        console.error('Session check error:', e)
        setError(e.message || 'Error checking session')
      } finally {
        setIsReady(true)
      }
    }
    init()
  }, [])

  if (!isReady || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    )
  }

  // Simple state-based navigation
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  if (!selectedPlant) {
    return <PlantSelectScreen />
  }

  return <ChecklistScreen />
}

const styles = StyleSheet.create({
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
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
})
