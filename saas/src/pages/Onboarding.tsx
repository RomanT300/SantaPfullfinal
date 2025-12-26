/**
 * Onboarding Wizard
 * Guides new users through initial setup: plant, team, plan selection
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Users,
  CreditCard,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Mail,
  Loader2,
  Sparkles
} from 'lucide-react'

interface PlantData {
  name: string
  location: string
  latitude: string
  longitude: string
}

interface InviteData {
  email: string
  role: 'admin' | 'supervisor' | 'operator'
}

const STEPS = [
  { id: 'welcome', title: 'Bienvenido', icon: Sparkles },
  { id: 'plant', title: 'Primera Planta', icon: Building2 },
  { id: 'team', title: 'Invitar Equipo', icon: Users },
  { id: 'plan', title: 'Elegir Plan', icon: CreditCard }
]

const PLANS = {
  starter: {
    name: 'Starter',
    price: 49,
    features: ['3 plantas', '5 usuarios', 'Visor AutoCAD', 'Soporte por email', 'API access']
  },
  pro: {
    name: 'Pro',
    price: 149,
    features: ['10 plantas', '25 usuarios', 'Visor AutoCAD', 'Soporte prioritario', 'API access', 'Webhooks', 'Marca personalizada']
  }
}

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [plantData, setPlantData] = useState<PlantData>({
    name: '',
    location: '',
    latitude: '',
    longitude: ''
  })

  const [invites, setInvites] = useState<InviteData[]>([
    { email: '', role: 'operator' }
  ])

  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro'>('starter')

  const navigate = useNavigate()

  const addInvite = () => {
    if (invites.length < 5) {
      setInvites([...invites, { email: '', role: 'operator' }])
    }
  }

  const removeInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index))
  }

  const updateInvite = (index: number, field: keyof InviteData, value: string) => {
    setInvites(invites.map((inv, i) =>
      i === index ? { ...inv, [field]: value } : inv
    ))
  }

  const handleComplete = async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Create first plant
      if (plantData.name) {
        const plantRes = await fetch('/api/plants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: plantData.name,
            location: plantData.location,
            latitude: plantData.latitude ? parseFloat(plantData.latitude) : null,
            longitude: plantData.longitude ? parseFloat(plantData.longitude) : null
          })
        })
        if (!plantRes.ok) {
          const data = await plantRes.json()
          throw new Error(data.error || 'Error al crear planta')
        }
      }

      // 2. Send invitations
      const validInvites = invites.filter(inv => inv.email.includes('@'))
      for (const invite of validInvites) {
        await fetch('/api/users/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: invite.email,
            role: invite.role
          })
        })
      }

      // 3. Mark onboarding as completed
      await fetch('/api/organizations/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: { onboardingCompleted: true }
        })
      })

      // 4. If pro plan selected, redirect to billing
      if (selectedPlan === 'pro') {
        const checkoutRes = await fetch('/api/subscriptions/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ plan: 'pro' })
        })
        const checkoutData = await checkoutRes.json()
        if (checkoutData.data?.url) {
          window.location.href = checkoutData.data.url
          return
        }
      }

      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return true
      case 'plant':
        return plantData.name.length >= 2
      case 'team':
        return true // Optional step
      case 'plan':
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    index < currentStep
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}
                >
                  {index < currentStep ? (
                    <Check size={20} />
                  ) : (
                    <step.icon size={20} />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-16 h-1 mx-2 transition-all ${
                      index < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-500">
            Paso {currentStep + 1} de {STEPS.length}: {STEPS[currentStep].title}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* Step: Welcome */}
          {STEPS[currentStep].id === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles size={40} className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold mb-4">Bienvenido a PTAR SaaS</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Vamos a configurar tu cuenta en unos pocos pasos. Podrás gestionar tus plantas de tratamiento,
                equipos, checklists y mucho más.
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left">
                <h3 className="font-medium mb-2">Lo que haremos:</h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    Crear tu primera planta de tratamiento
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    Invitar a tu equipo (opcional)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-500" />
                    Elegir tu plan
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Step: Plant */}
          {STEPS[currentStep].id === 'plant' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Configura tu primera planta</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Ingresa los datos de tu primera planta de tratamiento. Podrás agregar más plantas después.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nombre de la planta *
                  </label>
                  <input
                    type="text"
                    value={plantData.name}
                    onChange={(e) => setPlantData({ ...plantData, name: e.target.value })}
                    placeholder="Ej: PTAR Norte"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    <MapPin size={14} className="inline mr-1" />
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={plantData.location}
                    onChange={(e) => setPlantData({ ...plantData, location: e.target.value })}
                    placeholder="Ej: Guayaquil, Ecuador"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Latitud</label>
                    <input
                      type="text"
                      value={plantData.latitude}
                      onChange={(e) => setPlantData({ ...plantData, latitude: e.target.value })}
                      placeholder="-2.1894"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Longitud</label>
                    <input
                      type="text"
                      value={plantData.longitude}
                      onChange={(e) => setPlantData({ ...plantData, longitude: e.target.value })}
                      placeholder="-79.8891"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Team */}
          {STEPS[currentStep].id === 'team' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Invita a tu equipo</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Agrega a los miembros de tu equipo. Recibirán un correo con instrucciones para unirse.
              </p>

              <div className="space-y-3">
                {invites.map((invite, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={invite.email}
                        onChange={(e) => updateInvite(index, 'email', e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <select
                      value={invite.role}
                      onChange={(e) => updateInvite(index, 'role', e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    >
                      <option value="admin">Administrador</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="operator">Operador</option>
                    </select>
                    {invites.length > 1 && (
                      <button
                        onClick={() => removeInvite(index)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {invites.length < 5 && (
                <button
                  onClick={addInvite}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                >
                  <Mail size={14} />
                  Agregar otra invitación
                </button>
              )}

              <p className="mt-4 text-sm text-gray-500">
                Este paso es opcional. Puedes invitar a más personas después.
              </p>
            </div>
          )}

          {/* Step: Plan */}
          {STEPS[currentStep].id === 'plan' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Elige tu plan</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Selecciona el plan que mejor se adapte a tus necesidades.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(PLANS).map(([key, plan]) => (
                  <div
                    key={key}
                    onClick={() => setSelectedPlan(key as 'starter' | 'pro')}
                    className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedPlan === key
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === key
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedPlan === key && <Check size={12} className="text-white" />}
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-4">
                      ${plan.price}
                      <span className="text-sm font-normal text-gray-500">/mes</span>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check size={14} className="text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t dark:border-gray-700">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <ChevronLeft size={18} />
              Anterior
            </button>

            <button
              onClick={nextStep}
              disabled={!canProceed() || loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Procesando...
                </>
              ) : currentStep === STEPS.length - 1 ? (
                <>
                  Completar
                  <Check size={18} />
                </>
              ) : (
                <>
                  Siguiente
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skip */}
        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <div className="text-center mt-4">
            <button
              onClick={() => setCurrentStep(STEPS.length - 1)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Saltar configuración inicial
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
