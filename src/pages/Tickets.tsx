import { useState, useEffect, useMemo } from 'react'
import {
  Ticket, Plus, Search, Filter, Mail, MessageSquare, Clock, CheckCircle,
  AlertTriangle, XCircle, ChevronDown, ChevronRight, Send, Phone, User,
  Building2, Tag, RefreshCw, ExternalLink, MessageCircle, X
} from 'lucide-react'

type Ticket = {
  id: string
  plant_id: string
  plant_name: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  requester_name: string
  requester_email: string | null
  requester_phone: string | null
  assigned_to: string | null
  sent_via_email: number
  sent_via_whatsapp: number
  email_sent_at: string | null
  whatsapp_sent_at: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
  updated_at: string
}

type TicketComment = {
  id: string
  ticket_id: string
  author_name: string
  author_email: string | null
  comment: string
  is_internal: number
  created_at: string
}

type Plant = {
  id: string
  name: string
}

type Stats = {
  total: number
  open: number
  inProgress: number
  waiting: number
  resolved: number
  closed: number
  urgent: number
  high: number
  sentEmail: number
  sentWhatsapp: number
}

const CATEGORY_OPTIONS = [
  { value: 'mantenimiento', label: 'Mantenimiento', color: 'bg-blue-500' },
  { value: 'repuestos', label: 'Repuestos', color: 'bg-orange-500' },
  { value: 'insumos', label: 'Insumos', color: 'bg-green-500' },
  { value: 'consulta', label: 'Consulta', color: 'bg-purple-500' },
  { value: 'emergencia', label: 'Emergencia', color: 'bg-red-500' },
  { value: 'otro', label: 'Otro', color: 'bg-gray-500' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja', color: 'text-green-600 bg-green-100' },
  { value: 'medium', label: 'Media', color: 'text-yellow-600 bg-yellow-100' },
  { value: 'high', label: 'Alta', color: 'text-orange-600 bg-orange-100' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600 bg-red-100' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abierto', color: 'text-blue-600 bg-blue-100', icon: Clock },
  { value: 'in_progress', label: 'En Progreso', color: 'text-yellow-600 bg-yellow-100', icon: RefreshCw },
  { value: 'waiting', label: 'En Espera', color: 'text-purple-600 bg-purple-100', icon: Clock },
  { value: 'resolved', label: 'Resuelto', color: 'text-green-600 bg-green-100', icon: CheckCircle },
  { value: 'closed', label: 'Cerrado', color: 'text-gray-600 bg-gray-100', icon: XCircle },
]

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [plants, setPlants] = useState<Plant[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [plantFilter, setPlantFilter] = useState<string>('all')

  // Modal states
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)

  // New ticket form
  const [newTicket, setNewTicket] = useState({
    plantId: '',
    subject: '',
    description: '',
    category: 'consulta',
    priority: 'medium',
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    sendEmail: false,
    sendWhatsapp: false,
  })

  useEffect(() => {
    loadTickets()
    loadPlants()
    loadStats()
  }, [])

  const loadTickets = async () => {
    try {
      const res = await fetch('/api/tickets', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setTickets(json.data)
      }
    } catch (e) {
      console.error('Error loading tickets:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadPlants = async () => {
    try {
      const res = await fetch('/api/plants', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setPlants(json.data)
      }
    } catch (e) {
      console.error('Error loading plants:', e)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/tickets/stats', { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setStats(json.data)
      }
    } catch (e) {
      console.error('Error loading stats:', e)
    }
  }

  const loadTicketComments = async (ticketId: string) => {
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, { credentials: 'include' })
      const json = await res.json()
      if (json.success) {
        setTicketComments(json.data)
      }
    } catch (e) {
      console.error('Error loading comments:', e)
    } finally {
      setLoadingComments(false)
    }
  }

  const createTicket = async () => {
    if (!newTicket.plantId || !newTicket.subject || !newTicket.description || !newTicket.requesterName) {
      alert('Por favor complete todos los campos requeridos')
      return
    }

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newTicket),
      })
      const json = await res.json()
      if (json.success) {
        await loadTickets()
        await loadStats()
        setShowNewTicketForm(false)
        setNewTicket({
          plantId: '',
          subject: '',
          description: '',
          category: 'consulta',
          priority: 'medium',
          requesterName: '',
          requesterEmail: '',
          requesterPhone: '',
          sendEmail: false,
          sendWhatsapp: false,
        })
        alert(`Ticket ${json.data.ticket_number} creado exitosamente`)
      } else {
        alert('Error: ' + (json.error || 'Error desconocido'))
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) {
        await loadTickets()
        await loadStats()
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(json.data)
        }
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const addComment = async () => {
    if (!selectedTicket || !newComment.trim()) return

    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment: newComment }),
      })
      const json = await res.json()
      if (json.success) {
        await loadTicketComments(selectedTicket.id)
        setNewComment('')
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const sendWhatsApp = async (ticket: Ticket) => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/whatsapp-link?phone=${process.env.WHATSAPP_SUPPORT_NUMBER || ''}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        window.open(json.data.link, '_blank')
        await loadTickets()
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const sendEmail = async (ticket: Ticket) => {
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/send-email`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        alert('Email enviado exitosamente')
        await loadTickets()
      } else {
        alert('Error: ' + (json.error || 'No se pudo enviar el email'))
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false
      if (plantFilter !== 'all' && ticket.plant_id !== plantFilter) return false
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return (
          ticket.ticket_number.toLowerCase().includes(search) ||
          ticket.subject.toLowerCase().includes(search) ||
          ticket.description.toLowerCase().includes(search) ||
          ticket.requester_name.toLowerCase().includes(search)
        )
      }
      return true
    })
  }, [tickets, statusFilter, categoryFilter, plantFilter, searchTerm])

  const openTicketDetails = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    loadTicketComments(ticket.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ticket size={32} />
              <div>
                <h1 className="text-2xl font-bold">Sistema de Tickets</h1>
                <p className="text-indigo-200 text-sm">Gestiona solicitudes de soporte y seguimiento</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewTicketForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
            >
              <Plus size={20} />
              Nuevo Ticket
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">Abiertos</div>
              <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-yellow-500">
              <div className="text-sm text-gray-500">En Progreso</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-sm text-gray-500">Resueltos</div>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-red-500">
              <div className="text-sm text-gray-500">Urgentes</div>
              <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por numero, asunto, descripcion..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="all">Todos los estados</option>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="all">Todas las categorias</option>
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select
            value={plantFilter}
            onChange={e => setPlantFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          >
            <option value="all">Todas las plantas</option>
            {plants.map(plant => (
              <option key={plant.id} value={plant.id}>{plant.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Tickets ({filteredTickets.length})
            </h2>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center">
              <Ticket className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No hay tickets que mostrar</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTickets.map(ticket => {
                const statusConfig = STATUS_OPTIONS.find(s => s.value === ticket.status)
                const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === ticket.priority)
                const categoryConfig = CATEGORY_OPTIONS.find(c => c.value === ticket.category)
                const StatusIcon = statusConfig?.icon || Clock

                return (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => openTicketDetails(ticket)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${categoryConfig?.color || 'bg-gray-500'} text-white`}>
                        <Tag size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                            {ticket.ticket_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color}`}>
                            {statusConfig?.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig?.color}`}>
                            {priorityConfig?.label}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {ticket.subject}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">{ticket.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {ticket.plant_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {ticket.requester_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(ticket.created_at).toLocaleDateString('es-EC')}
                          </span>
                          {ticket.sent_via_email === 1 && (
                            <span className="flex items-center gap-1 text-green-500">
                              <Mail size={12} /> Email
                            </span>
                          )}
                          {ticket.sent_via_whatsapp === 1 && (
                            <span className="flex items-center gap-1 text-green-500">
                              <MessageSquare size={12} /> WhatsApp
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); sendWhatsApp(ticket) }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Enviar por WhatsApp"
                        >
                          <MessageSquare size={18} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); sendEmail(ticket) }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Enviar por Email"
                        >
                          <Mail size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicketForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Ticket size={24} className="text-indigo-600" />
                  Nuevo Ticket de Soporte
                </h2>
                <button
                  onClick={() => setShowNewTicketForm(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Planta *
                  </label>
                  <select
                    value={newTicket.plantId}
                    onChange={e => setNewTicket(s => ({ ...s, plantId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option value="">Seleccione planta</option>
                    {plants.map(plant => (
                      <option key={plant.id} value={plant.id}>{plant.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={newTicket.category}
                    onChange={e => setNewTicket(s => ({ ...s, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Asunto *
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={e => setNewTicket(s => ({ ...s, subject: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Describa brevemente su solicitud"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descripcion detallada *
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={e => setNewTicket(s => ({ ...s, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  rows={4}
                  placeholder="Proporcione todos los detalles de su solicitud..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={e => setNewTicket(s => ({ ...s, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del solicitante *
                  </label>
                  <input
                    type="text"
                    value={newTicket.requesterName}
                    onChange={e => setNewTicket(s => ({ ...s, requesterName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="Nombre completo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newTicket.requesterEmail}
                    onChange={e => setNewTicket(s => ({ ...s, requesterEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={newTicket.requesterPhone}
                    onChange={e => setNewTicket(s => ({ ...s, requesterPhone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="+593 99 999 9999"
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Enviar notificacion al crear:
                </p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTicket.sendEmail}
                      onChange={e => setNewTicket(s => ({ ...s, sendEmail: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <Mail size={16} className="text-blue-500" />
                    <span className="text-sm">Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTicket.sendWhatsapp}
                      onChange={e => setNewTicket(s => ({ ...s, sendWhatsapp: e.target.checked }))}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <MessageSquare size={16} className="text-green-500" />
                    <span className="text-sm">WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowNewTicketForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={createTicket}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Crear Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-indigo-600 dark:text-indigo-400 mb-1">
                    {selectedTicket.ticket_number}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedTicket.subject}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status and Actions */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={selectedTicket.status}
                  onChange={e => updateTicketStatus(selectedTicket.id, e.target.value)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm font-medium"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                <button
                  onClick={() => sendWhatsApp(selectedTicket)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg flex items-center gap-2 hover:bg-green-600"
                >
                  <MessageSquare size={16} />
                  WhatsApp
                </button>

                <button
                  onClick={() => sendEmail(selectedTicket)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
                >
                  <Mail size={16} />
                  Email
                </button>
              </div>

              {/* Details */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <p className="text-gray-700 dark:text-gray-300">{selectedTicket.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Planta:</span>{' '}
                    <span className="font-medium">{selectedTicket.plant_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Categoria:</span>{' '}
                    <span className="font-medium">
                      {CATEGORY_OPTIONS.find(c => c.value === selectedTicket.category)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Prioridad:</span>{' '}
                    <span className={`font-medium px-2 py-0.5 rounded ${PRIORITY_OPTIONS.find(p => p.value === selectedTicket.priority)?.color}`}>
                      {PRIORITY_OPTIONS.find(p => p.value === selectedTicket.priority)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Creado:</span>{' '}
                    <span className="font-medium">
                      {new Date(selectedTicket.created_at).toLocaleString('es-EC')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requester Info */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                  <User size={16} />
                  Solicitante
                </h4>
                <div className="text-sm space-y-1">
                  <p><strong>{selectedTicket.requester_name}</strong></p>
                  {selectedTicket.requester_email && (
                    <p className="flex items-center gap-2">
                      <Mail size={14} /> {selectedTicket.requester_email}
                    </p>
                  )}
                  {selectedTicket.requester_phone && (
                    <p className="flex items-center gap-2">
                      <Phone size={14} /> {selectedTicket.requester_phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageCircle size={16} />
                  Comentarios ({ticketComments.length})
                </h4>

                {loadingComments ? (
                  <div className="text-center py-4">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    {ticketComments.map(comment => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.is_internal
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                            : 'bg-gray-50 dark:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                          <span className="font-medium">{comment.author_name}</span>
                          <span>-</span>
                          <span>{new Date(comment.created_at).toLocaleString('es-EC')}</span>
                          {comment.is_internal === 1 && (
                            <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded text-xs">
                              Interno
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribir comentario..."
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    onKeyPress={e => e.key === 'Enter' && addComment()}
                  />
                  <button
                    onClick={addComment}
                    disabled={!newComment.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center gap-2"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
