/**
 * Dashboard API Routes
 * Personalized dashboard widgets and user preferences
 */
import { Router, Request, Response } from 'express'
import { db } from '../lib/database'

const router = Router()

// Available widget types
const AVAILABLE_WIDGETS = [
  { type: 'upcoming_maintenance', name: 'Mantenimientos Próximos', description: 'Tareas en los próximos 45 días', defaultVisible: true },
  { type: 'environmental_alerts', name: 'Alertas Ambientales', description: 'Parámetros fuera de rango', defaultVisible: true },
  { type: 'emergency_status', name: 'Estado de Emergencias', description: 'Emergencias activas', defaultVisible: true },
  { type: 'cost_per_m3', name: 'Costo por m³', description: 'KPI de costo de tratamiento', defaultVisible: true },
  { type: 'compliance_rate', name: 'Cumplimiento Ambiental', description: 'Porcentaje de plantas en cumplimiento', defaultVisible: true },
  { type: 'checklist_status', name: 'Estado de Checklists', description: 'Progreso de inspecciones diarias', defaultVisible: true },
  { type: 'plant_map', name: 'Mapa de Plantas', description: 'Ubicación geográfica', defaultVisible: false },
  { type: 'recent_documents', name: 'Documentos Recientes', description: 'Últimos documentos subidos', defaultVisible: false },
]

interface UserWidget {
  id: string
  user_id: string
  widget_type: string
  position: number
  config: string | null
  is_visible: number
}

/**
 * GET /api/dashboard/widgets
 * Get user's dashboard widget configuration
 */
router.get('/widgets', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub

    if (!userId) {
      return res.json({ success: false, error: 'No autenticado' })
    }

    // Get user's saved widgets
    const savedWidgets = db.prepare(`
      SELECT * FROM user_dashboard_widgets WHERE user_id = ? ORDER BY position
    `).all(userId) as UserWidget[]

    // If no saved widgets, return defaults
    if (savedWidgets.length === 0) {
      const defaults = AVAILABLE_WIDGETS.map((w, i) => ({
        id: `default-${w.type}`,
        widget_type: w.type,
        name: w.name,
        description: w.description,
        position: i,
        is_visible: w.defaultVisible,
        config: null,
      }))

      return res.json({ success: true, data: defaults, available: AVAILABLE_WIDGETS })
    }

    // Merge with widget metadata
    const widgets = savedWidgets.map(sw => {
      const meta = AVAILABLE_WIDGETS.find(aw => aw.type === sw.widget_type)
      return {
        id: sw.id,
        widget_type: sw.widget_type,
        name: meta?.name || sw.widget_type,
        description: meta?.description || '',
        position: sw.position,
        is_visible: sw.is_visible === 1,
        config: sw.config ? JSON.parse(sw.config) : null,
      }
    })

    res.json({ success: true, data: widgets, available: AVAILABLE_WIDGETS })
  } catch (error) {
    console.error('Error getting widgets:', error)
    res.status(500).json({ success: false, error: 'Error al obtener widgets' })
  }
})

/**
 * PUT /api/dashboard/widgets
 * Update user's widget configuration
 */
router.put('/widgets', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.sub
    const { widgets } = req.body as { widgets: Array<{ widget_type: string; position: number; is_visible: boolean; config?: any }> }

    if (!userId) {
      return res.json({ success: false, error: 'No autenticado' })
    }

    // Delete existing widgets
    db.prepare('DELETE FROM user_dashboard_widgets WHERE user_id = ?').run(userId)

    // Insert new configuration
    const insert = db.prepare(`
      INSERT INTO user_dashboard_widgets (id, user_id, widget_type, position, is_visible, config)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    for (const widget of widgets) {
      const id = `widget-${userId}-${widget.widget_type}`
      insert.run(
        id,
        userId,
        widget.widget_type,
        widget.position,
        widget.is_visible ? 1 : 0,
        widget.config ? JSON.stringify(widget.config) : null
      )
    }

    res.json({ success: true, message: 'Widgets actualizados' })
  } catch (error) {
    console.error('Error updating widgets:', error)
    res.status(500).json({ success: false, error: 'Error al actualizar widgets' })
  }
})

/**
 * GET /api/dashboard/upcoming-maintenance
 * Get maintenance tasks due in 45 days (for widget and purchase order reminders)
 */
router.get('/upcoming-maintenance', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 45

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]

    const today = new Date().toISOString().split('T')[0]

    const tasks = db.prepare(`
      SELECT
        mt.*,
        p.name as plant_name,
        p.location as plant_location,
        CAST((julianday(mt.scheduled_date) - julianday('now')) AS INTEGER) as days_until
      FROM maintenance_tasks mt
      JOIN plants p ON mt.plant_id = p.id
      WHERE mt.status = 'pending'
      AND DATE(mt.scheduled_date) >= DATE(?)
      AND DATE(mt.scheduled_date) <= DATE(?)
      ORDER BY mt.scheduled_date ASC
    `).all(today, futureDateStr)

    // Group by urgency
    const urgent = (tasks as any[]).filter(t => t.days_until <= 7)
    const soon = (tasks as any[]).filter(t => t.days_until > 7 && t.days_until <= 30)
    const planned = (tasks as any[]).filter(t => t.days_until > 30)

    res.json({
      success: true,
      data: {
        all: tasks,
        urgent,
        soon,
        planned,
        total: tasks.length,
      },
    })
  } catch (error) {
    console.error('Error getting upcoming maintenance:', error)
    res.status(500).json({ success: false, error: 'Error al obtener mantenimientos' })
  }
})

/**
 * GET /api/dashboard/cost-per-m3
 * Get cost per m³ KPI for all plants
 */
router.get('/cost-per-m3', (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6

    const since = new Date()
    since.setMonth(since.getMonth() - months)
    const sinceStr = since.toISOString().split('T')[0].substring(0, 7) + '-01'

    const costs = db.prepare(`
      SELECT
        p.id as plant_id,
        p.name as plant_name,
        o.period_date,
        o.volume_m3,
        (o.cost_agua + o.cost_personal + o.cost_mantenimiento + o.cost_energia +
         o.cost_floculante + o.cost_coagulante + o.cost_estabilizador_ph +
         o.cost_dap + o.cost_urea + o.cost_melaza) as total_cost,
        CASE
          WHEN o.volume_m3 > 0 THEN
            ROUND((o.cost_agua + o.cost_personal + o.cost_mantenimiento + o.cost_energia +
                   o.cost_floculante + o.cost_coagulante + o.cost_estabilizador_ph +
                   o.cost_dap + o.cost_urea + o.cost_melaza) / o.volume_m3, 2)
          ELSE 0
        END as cost_per_m3
      FROM opex_costs o
      JOIN plants p ON o.plant_id = p.id
      WHERE o.period_date >= ?
      ORDER BY p.name, o.period_date
    `).all(sinceStr)

    // Calculate averages by plant
    const plantAverages: Record<string, { plant_name: string; avg_cost_per_m3: number; total_volume: number; total_cost: number; months: number }> = {}

    for (const row of costs as any[]) {
      if (!plantAverages[row.plant_id]) {
        plantAverages[row.plant_id] = {
          plant_name: row.plant_name,
          avg_cost_per_m3: 0,
          total_volume: 0,
          total_cost: 0,
          months: 0,
        }
      }
      plantAverages[row.plant_id].total_volume += row.volume_m3
      plantAverages[row.plant_id].total_cost += row.total_cost
      plantAverages[row.plant_id].months++
    }

    for (const plantId of Object.keys(plantAverages)) {
      const plant = plantAverages[plantId]
      plant.avg_cost_per_m3 = plant.total_volume > 0
        ? Math.round((plant.total_cost / plant.total_volume) * 100) / 100
        : 0
    }

    // Overall average
    const totalVolume = Object.values(plantAverages).reduce((sum, p) => sum + p.total_volume, 0)
    const totalCost = Object.values(plantAverages).reduce((sum, p) => sum + p.total_cost, 0)
    const overallAvg = totalVolume > 0 ? Math.round((totalCost / totalVolume) * 100) / 100 : 0

    res.json({
      success: true,
      data: {
        byPlant: Object.entries(plantAverages).map(([id, data]) => ({ plant_id: id, ...data })),
        overall: {
          avg_cost_per_m3: overallAvg,
          total_volume: totalVolume,
          total_cost: Math.round(totalCost * 100) / 100,
        },
        history: costs,
      },
    })
  } catch (error) {
    console.error('Error getting cost per m3:', error)
    res.status(500).json({ success: false, error: 'Error al obtener costo por m³' })
  }
})

/**
 * GET /api/dashboard/environmental-alerts
 * Get current environmental alerts (parameters out of range)
 */
router.get('/environmental-alerts', (req: Request, res: Response) => {
  try {
    // Get latest effluent readings per plant per parameter
    const latestReadings = db.prepare(`
      SELECT
        ed.id,
        ed.plant_id,
        p.name as plant_name,
        ed.parameter_type,
        ed.value,
        ed.unit,
        ed.measurement_date,
        ed.stream
      FROM environmental_data ed
      JOIN plants p ON ed.plant_id = p.id
      WHERE ed.stream = 'effluent'
      AND ed.measurement_date = (
        SELECT MAX(ed2.measurement_date)
        FROM environmental_data ed2
        WHERE ed2.plant_id = ed.plant_id
        AND ed2.parameter_type = ed.parameter_type
        AND ed2.stream = 'effluent'
      )
      ORDER BY ed.measurement_date DESC
    `).all()

    // Check thresholds
    const thresholds = {
      DQO: { max: 200, unit: 'mg/L' },
      pH: { min: 6, max: 8, unit: '' },
      SS: { max: 100, unit: 'mg/L' },
    }

    const alerts = []
    for (const reading of latestReadings as any[]) {
      const threshold = thresholds[reading.parameter_type as keyof typeof thresholds]
      if (!threshold) continue

      let isAlert = false
      let alertType: 'warning' | 'critical' = 'warning'
      let limitValue = 0

      if ('max' in threshold && reading.value > threshold.max) {
        isAlert = true
        limitValue = threshold.max
        alertType = reading.value > threshold.max * 1.1 ? 'critical' : 'warning'
      }
      if ('min' in threshold && reading.value < threshold.min) {
        isAlert = true
        limitValue = threshold.min
        alertType = reading.value < threshold.min * 0.9 ? 'critical' : 'warning'
      }

      if (isAlert) {
        alerts.push({
          ...reading,
          threshold: limitValue,
          alert_type: alertType,
        })
      }
    }

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        critical: alerts.filter(a => a.alert_type === 'critical').length,
        warning: alerts.filter(a => a.alert_type === 'warning').length,
      },
    })
  } catch (error) {
    console.error('Error getting environmental alerts:', error)
    res.status(500).json({ success: false, error: 'Error al obtener alertas' })
  }
})

/**
 * GET /api/dashboard/summary
 * Get complete dashboard summary for the home page
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    // Plants count
    const plantStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance
      FROM plants
    `).get() as any

    // Pending emergencies
    const emergencyStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low
      FROM maintenance_emergencies
      WHERE solved = 0
    `).get() as any

    // Upcoming maintenance (45 days)
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 45)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const maintenanceStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN CAST((julianday(scheduled_date) - julianday('now')) AS INTEGER) <= 7 THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN CAST((julianday(scheduled_date) - julianday('now')) AS INTEGER) > 7
                  AND CAST((julianday(scheduled_date) - julianday('now')) AS INTEGER) <= 30 THEN 1 ELSE 0 END) as soon
      FROM maintenance_tasks
      WHERE status = 'pending'
      AND DATE(scheduled_date) >= DATE(?)
      AND DATE(scheduled_date) <= DATE(?)
    `).get(today, futureDateStr) as any

    // Today's checklists
    const checklistStats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM plants WHERE status = 'active') as total_plants,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
        COUNT(*) as started
      FROM daily_checklists
      WHERE check_date = ?
    `).get(today) as any

    res.json({
      success: true,
      data: {
        plants: plantStats,
        emergencies: emergencyStats,
        maintenance: maintenanceStats,
        checklists: {
          total_plants: checklistStats.total_plants,
          completed: checklistStats.completed,
          started: checklistStats.started,
          pending: checklistStats.total_plants - checklistStats.started,
        },
      },
    })
  } catch (error) {
    console.error('Error getting dashboard summary:', error)
    res.status(500).json({ success: false, error: 'Error al obtener resumen' })
  }
})

export default router
