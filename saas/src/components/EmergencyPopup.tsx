/**
 * Emergency Popup Component
 * Shows a modal when new emergencies are reported
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X, Bell, Clock, MapPin, CheckCircle } from 'lucide-react'
import { useEmergencyStore, Emergency } from '../stores/emergencyStore'

const SEVERITY_CONFIG = {
  low: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Baja' },
  medium: { color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Media' },
  high: { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', label: 'Alta' },
  critical: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Crítica' },
}

export default function EmergencyPopup() {
  const navigate = useNavigate()
  const { newEmergencies, showPopup, dismissPopup, acknowledgeEmergency, startPolling, stopPolling } = useEmergencyStore()

  // Start polling on mount
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [startPolling, stopPolling])

  if (!showPopup || newEmergencies.length === 0) return null

  const handleViewAll = () => {
    dismissPopup()
    navigate('/app/emergencies')
  }

  const handleAcknowledge = async (id: string) => {
    await acknowledgeEmergency(id)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={dismissPopup}
      />

      {/* Popup */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-slideDown">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full animate-pulse">
              <Bell className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {newEmergencies.length === 1 ? 'Nueva Emergencia' : `${newEmergencies.length} Nuevas Emergencias`}
              </h2>
              <p className="text-red-100 text-sm">Requiere atención inmediata</p>
            </div>
          </div>
          <button
            onClick={dismissPopup}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="text-white" size={20} />
          </button>
        </div>

        {/* Emergency List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {newEmergencies.map((emergency, index) => (
            <EmergencyCard
              key={emergency.id}
              emergency={emergency}
              onAcknowledge={handleAcknowledge}
              isLast={index === newEmergencies.length - 1}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={dismissPopup}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleViewAll}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <AlertTriangle size={18} />
            Ver Emergencias
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>
    </div>
  )
}

function EmergencyCard({
  emergency,
  onAcknowledge,
  isLast,
}: {
  emergency: Emergency
  onAcknowledge: (id: string) => void
  isLast: boolean
}) {
  const severity = SEVERITY_CONFIG[emergency.severity] || SEVERITY_CONFIG.medium
  const reportedAt = new Date(emergency.reported_at)
  const timeAgo = getTimeAgo(reportedAt)

  return (
    <div className={`p-5 ${!isLast ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
      <div className="flex items-start gap-4">
        {/* Severity indicator */}
        <div className={`p-3 rounded-full ${severity.bg} flex-shrink-0`}>
          <AlertTriangle className={severity.text} size={24} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${severity.color} text-white`}>
              {severity.label.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={12} />
              {timeAgo}
            </span>
          </div>

          <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">
            {emergency.reason}
          </h3>

          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <MapPin size={14} />
            <span>{emergency.plant_name}</span>
          </div>

          {emergency.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {emergency.description}
            </p>
          )}

          {/* Acknowledge button */}
          <button
            onClick={() => onAcknowledge(emergency.id)}
            className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            <CheckCircle size={16} />
            Reconocer Emergencia
          </button>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  return `Hace ${diffDays}d`
}
