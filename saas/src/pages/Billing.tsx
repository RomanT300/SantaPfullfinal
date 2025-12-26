/**
 * Billing Page
 * Manage subscription, view invoices, upgrade/downgrade plan
 */
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCard,
  Check,
  AlertCircle,
  ExternalLink,
  Download,
  Loader2,
  Star,
  Zap,
  Building2,
  Users,
  HardDrive,
  Webhook
} from 'lucide-react'

interface Subscription {
  plan: string
  planDetails: {
    name: string
    price: number
    limits: {
      plants: number
      users: number
      apiCalls: number
    }
    features: string[]
  }
  status: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

interface Invoice {
  id: string
  number: string
  status: string
  amount: number
  currency: string
  date: string
  pdfUrl: string
  hostedUrl: string
}

interface Usage {
  plants: { current: number; limit: number }
  users: { current: number; limit: number }
  apiCalls: { current: number; limit: number }
  storage: { current: number; limit: number }
}

const PLANS: Record<string, { name: string; price: number; plants: number; users: number; storage: string; features: string[]; popular?: boolean }> = {
  starter: {
    name: 'Starter',
    price: 49,
    plants: 3,
    users: 5,
    storage: '5GB',
    features: [
      'Hasta 3 plantas',
      '5 usuarios',
      'Visor AutoCAD (DWG/DXF)',
      'Soporte por email',
      'API access',
      '5GB almacenamiento'
    ]
  },
  pro: {
    name: 'Pro',
    price: 149,
    plants: 10,
    users: 25,
    storage: '50GB',
    features: [
      'Hasta 10 plantas',
      '25 usuarios',
      'Visor AutoCAD (DWG/DXF)',
      'Soporte prioritario',
      'API access',
      'Webhooks',
      'Marca personalizada',
      '50GB almacenamiento'
    ],
    popular: true
  }
}

export default function Billing() {
  const [searchParams] = useSearchParams()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    // Check for success from Stripe redirect
    if (searchParams.get('success') === 'true') {
      setSuccess('Tu suscripción ha sido actualizada correctamente.')
    }

    loadData()
  }, [searchParams])

  const loadData = async () => {
    try {
      setLoading(true)
      const [subRes, invRes, usageRes] = await Promise.all([
        fetch('/api/subscriptions/current', { credentials: 'include' }),
        fetch('/api/subscriptions/invoices', { credentials: 'include' }),
        fetch('/api/organizations/current/usage', { credentials: 'include' })
      ])

      const subData = await subRes.json()
      const invData = await invRes.json()
      const usageData = await usageRes.json()

      if (subData.success) setSubscription(subData.data)
      if (invData.success) setInvoices(invData.data || [])
      if (usageData.success) setUsage(usageData.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (plan: 'starter' | 'pro') => {
    setUpgrading(plan)
    try {
      const res = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar')

      if (data.data?.url) {
        window.location.href = data.data.url
      }
    } catch (err: any) {
      setError(err.message)
      setUpgrading(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/subscriptions/create-portal', {
        method: 'POST',
        credentials: 'include'
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al abrir portal')

      if (data.data?.url) {
        window.location.href = data.data.url
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getUsagePercent = (current: number, limit: number) => {
    if (limit <= 0) return 0
    return Math.min(100, (current / limit) * 100)
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard size={28} />
          Facturación
        </h1>
        <p className="text-gray-500 mt-1">
          Gestiona tu suscripción y revisa tu historial de pagos
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

      {/* Current Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Plan actual</h2>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-blue-600">
                {subscription?.planDetails?.name || 'Starter'}
              </span>
              <span className="text-gray-500">
                ${subscription?.planDetails?.price || 49}/mes
              </span>
              {subscription?.status === 'active' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                  Activo
                </span>
              )}
            </div>
            {subscription?.currentPeriodEnd && (
              <p className="text-sm text-gray-500 mt-2">
                Próximo cobro: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <p className="text-sm text-yellow-600 mt-2">
                Se cancelará al final del período actual
              </p>
            )}
          </div>

          {subscription?.status === 'active' && (
            <button
              onClick={handleManageSubscription}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Administrar suscripción
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Uso actual</h2>

          <div className="grid md:grid-cols-4 gap-6">
            {/* Plants */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={18} className="text-blue-500" />
                <span className="text-sm font-medium">Plantas</span>
              </div>
              <div className="text-2xl font-bold">
                {usage.plants.current} / {usage.plants.limit}
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUsageColor(getUsagePercent(usage.plants.current, usage.plants.limit))}`}
                  style={{ width: `${getUsagePercent(usage.plants.current, usage.plants.limit)}%` }}
                />
              </div>
            </div>

            {/* Users */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-green-500" />
                <span className="text-sm font-medium">Usuarios</span>
              </div>
              <div className="text-2xl font-bold">
                {usage.users.current} / {usage.users.limit}
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUsageColor(getUsagePercent(usage.users.current, usage.users.limit))}`}
                  style={{ width: `${getUsagePercent(usage.users.current, usage.users.limit)}%` }}
                />
              </div>
            </div>

            {/* API Calls */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={18} className="text-yellow-500" />
                <span className="text-sm font-medium">API Calls</span>
              </div>
              <div className="text-2xl font-bold">
                {usage.apiCalls.current.toLocaleString()} / {usage.apiCalls.limit.toLocaleString()}
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUsageColor(getUsagePercent(usage.apiCalls.current, usage.apiCalls.limit))}`}
                  style={{ width: `${getUsagePercent(usage.apiCalls.current, usage.apiCalls.limit)}%` }}
                />
              </div>
            </div>

            {/* Storage */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HardDrive size={18} className="text-purple-500" />
                <span className="text-sm font-medium">Almacenamiento</span>
              </div>
              <div className="text-2xl font-bold">
                {(usage.storage.current / 1024 / 1024 / 1024).toFixed(1)} / {(usage.storage.limit / 1024 / 1024 / 1024).toFixed(0)} GB
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getUsageColor(getUsagePercent(usage.storage.current, usage.storage.limit))}`}
                  style={{ width: `${getUsagePercent(usage.storage.current, usage.storage.limit)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Planes disponibles</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {Object.entries(PLANS).map(([key, plan]) => {
            const isCurrentPlan = subscription?.plan === key
            const isPro = key === 'pro'

            return (
              <div
                key={key}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-6 relative ${
                  isCurrentPlan
                    ? 'border-blue-500'
                    : plan.popular
                    ? 'border-purple-300 dark:border-purple-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-sm rounded-full flex items-center gap-1">
                    <Star size={14} />
                    Popular
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-sm rounded-full flex items-center gap-1">
                    <Check size={14} />
                    Plan actual
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="text-4xl font-bold mb-4">
                  ${plan.price}
                  <span className="text-sm font-normal text-gray-500">/mes</span>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check size={16} className="text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {!isCurrentPlan && (
                  <button
                    onClick={() => handleUpgrade(key as 'starter' | 'pro')}
                    disabled={upgrading === key}
                    className={`w-full py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                      isPro
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } disabled:opacity-50`}
                  >
                    {upgrading === key ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        {isPro ? <Zap size={18} /> : null}
                        {isPro ? 'Upgrade a Pro' : 'Cambiar a Starter'}
                      </>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="font-semibold">Historial de facturas</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Número</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-sm font-medium">{invoice.number}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      ${invoice.amount} {invoice.currency}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 justify-end"
                        >
                          <Download size={14} />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
