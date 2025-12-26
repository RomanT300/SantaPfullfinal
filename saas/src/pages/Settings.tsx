/**
 * Settings Page
 * Organization settings, branding, and configuration
 */
import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Building2,
  Palette,
  Globe,
  Save,
  Loader2,
  AlertCircle,
  Check,
  Upload,
  Trash2,
  Factory,
  Shirt,
  Wrench
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  settings: {
    timezone?: string
    language?: string
    dateFormat?: string
    notifications?: {
      email?: boolean
      slack?: boolean
    }
  }
}

const TIMEZONES = [
  { id: 'America/Guayaquil', name: 'Ecuador (GMT-5)' },
  { id: 'America/Lima', name: 'Perú (GMT-5)' },
  { id: 'America/Bogota', name: 'Colombia (GMT-5)' },
  { id: 'America/Mexico_City', name: 'México (GMT-6)' },
  { id: 'America/Santiago', name: 'Chile (GMT-4)' },
  { id: 'America/Buenos_Aires', name: 'Argentina (GMT-3)' },
  { id: 'America/Sao_Paulo', name: 'Brasil (GMT-3)' },
  { id: 'Europe/Madrid', name: 'España (GMT+1)' }
]

const DATE_FORMATS = [
  { id: 'DD/MM/YYYY', example: '25/12/2025' },
  { id: 'MM/DD/YYYY', example: '12/25/2025' },
  { id: 'YYYY-MM-DD', example: '2025-12-25' }
]

const COLORS = [
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
]

export default function Settings() {
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9')
  const [timezone, setTimezone] = useState('America/Guayaquil')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [plantTypes, setPlantTypes] = useState<'biosems' | 'textiles' | 'both'>('both')

  useEffect(() => {
    loadOrganization()
  }, [])

  const loadOrganization = async () => {
    try {
      const res = await fetch('/api/organizations/current', { credentials: 'include' })
      const data = await res.json()

      if (data.success && data.data) {
        const o = data.data
        setOrg(o)
        setName(o.name)
        setPrimaryColor(o.primary_color || '#0ea5e9')
        setTimezone(o.settings?.timezone || 'America/Guayaquil')
        setDateFormat(o.settings?.dateFormat || 'DD/MM/YYYY')
        setEmailNotifications(o.settings?.notifications?.email !== false)
        setPlantTypes(o.plant_types || 'both')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/organizations/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          primaryColor,
          plantTypes,
          settings: {
            timezone,
            dateFormat,
            notifications: {
              email: emailNotifications
            }
          }
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      setSuccess('Configuración guardada correctamente')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    try {
      const res = await fetch('/api/organizations/current/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (!res.ok) throw new Error('Error al subir logo')

      loadOrganization()
      setSuccess('Logo actualizado')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon size={28} />
          Configuración
        </h1>
        <p className="text-gray-500 mt-1">
          Personaliza tu organización
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center gap-2">
          <Check size={18} />
          {success}
        </div>
      )}

      {/* Organization Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 size={20} />
          Información de la organización
        </h2>

        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {org?.logo_url ? (
                  <img src={org.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Building2 size={32} className="text-gray-400" />
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  <Upload size={16} />
                  Subir logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG hasta 2MB</p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre de la organización</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-1">URL de la organización</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">app.ptar.io/org/</span>
              <input
                type="text"
                value={org?.slug || ''}
                disabled
                className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-600 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">El slug no se puede cambiar</p>
          </div>
        </div>
      </div>

      {/* Plant Types */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Factory size={20} />
          Tipos de Planta
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Selecciona los tipos de planta que maneja tu organización. Esto determina las opciones de mantenimiento disponibles.
        </p>

        <div className="grid gap-3">
          <label className={`
            flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
            ${plantTypes === 'biosems'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
          `}>
            <input
              type="radio"
              name="plantTypes"
              value="biosems"
              checked={plantTypes === 'biosems'}
              onChange={(e) => setPlantTypes(e.target.value as any)}
              className="w-4 h-4 text-blue-600"
            />
            <Wrench size={20} className="text-blue-600" />
            <div>
              <div className="font-medium">Solo Biosems</div>
              <div className="text-sm text-gray-500">Plantas de tratamiento de aguas residuales industriales</div>
            </div>
          </label>

          <label className={`
            flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
            ${plantTypes === 'textiles'
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
          `}>
            <input
              type="radio"
              name="plantTypes"
              value="textiles"
              checked={plantTypes === 'textiles'}
              onChange={(e) => setPlantTypes(e.target.value as any)}
              className="w-4 h-4 text-purple-600"
            />
            <Shirt size={20} className="text-purple-600" />
            <div>
              <div className="font-medium">Solo Textiles</div>
              <div className="text-sm text-gray-500">Plantas de tratamiento para industria textil</div>
            </div>
          </label>

          <label className={`
            flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
            ${plantTypes === 'both'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
          `}>
            <input
              type="radio"
              name="plantTypes"
              value="both"
              checked={plantTypes === 'both'}
              onChange={(e) => setPlantTypes(e.target.value as any)}
              className="w-4 h-4 text-green-600"
            />
            <div className="flex gap-1">
              <Wrench size={20} className="text-blue-600" />
              <Shirt size={20} className="text-purple-600" />
            </div>
            <div>
              <div className="font-medium">Ambos tipos</div>
              <div className="text-sm text-gray-500">Gestiona plantas de tipo Biosems y Textiles</div>
            </div>
          </label>
        </div>
      </div>

      {/* Branding */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette size={20} />
          Marca
        </h2>

        <div>
          <label className="block text-sm font-medium mb-2">Color principal</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                className={`w-10 h-10 rounded-lg transition-transform ${
                  primaryColor === color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-28 px-3 py-2 border rounded-lg font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Regional */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Globe size={20} />
          Regional
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Zona horaria</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.id} value={tz.id}>{tz.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Formato de fecha</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
            >
              {DATE_FORMATS.map(df => (
                <option key={df.id} value={df.id}>{df.id} ({df.example})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Notificaciones</h2>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="font-medium">Notificaciones por email</div>
            <div className="text-sm text-gray-500">Recibir alertas y reportes por correo electrónico</div>
          </div>
        </label>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          Guardar cambios
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Zona de peligro</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Estas acciones son permanentes y no se pueden deshacer.
        </p>
        <button className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
          <Trash2 size={16} />
          Eliminar organización
        </button>
      </div>
    </div>
  )
}
