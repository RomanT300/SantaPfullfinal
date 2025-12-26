/**
 * Data Access Layer for SQLite
 * Provides CRUD operations for all entities
 */
import { db } from './database.js'
import { randomUUID } from 'crypto'

/**
 * Plants DAL
 */
export const plantsDAL = {
  getAll: (filters?: { search?: string; status?: string }) => {
    let query = 'SELECT * FROM plants WHERE 1=1'
    const params: any[] = []

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters?.search) {
      query += ' AND (name LIKE ? OR location LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY name ASC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM plants WHERE id = ?').get(id)
  },

  create: (plant: { name: string; location: string; latitude?: number; longitude?: number; status?: string }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO plants (id, name, location, latitude, longitude, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, plant.name, plant.location, plant.latitude || null, plant.longitude || null, plant.status || 'active')
    return plantsDAL.getById(id)
  },

  update: (id: string, updates: Partial<{ name: string; location: string; latitude: number; longitude: number; status: string }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      params.push(updates.name)
    }
    if (updates.location !== undefined) {
      fields.push('location = ?')
      params.push(updates.location)
    }
    if (updates.latitude !== undefined) {
      fields.push('latitude = ?')
      params.push(updates.latitude)
    }
    if (updates.longitude !== undefined) {
      fields.push('longitude = ?')
      params.push(updates.longitude)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      params.push(updates.status)
    }

    if (fields.length === 0) return plantsDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE plants SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return plantsDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM plants WHERE id = ?')
    return stmt.run(id)
  }
}

/**
 * Environmental Data DAL
 */
export const environmentalDAL = {
  getAll: (filters?: {
    plantId?: string
    parameter?: string
    stream?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) => {
    let query = 'SELECT * FROM environmental_data WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.parameter) {
      query += ' AND parameter_type = ?'
      params.push(filters.parameter)
    }

    if (filters?.stream) {
      query += ' AND stream = ?'
      params.push(filters.stream)
    }

    if (filters?.startDate) {
      query += ' AND measurement_date >= ?'
      params.push(filters.startDate)
    }

    if (filters?.endDate) {
      query += ' AND measurement_date <= ?'
      params.push(filters.endDate)
    }

    query += ' ORDER BY measurement_date ASC'

    if (filters?.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)

      if (filters?.offset) {
        query += ' OFFSET ?'
        params.push(filters.offset)
      }
    }

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM environmental_data WHERE id = ?').get(id)
  },

  create: (data: {
    plantId: string
    parameter: string
    value: number
    measurementDate: string
    unit?: string
    stream?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO environmental_data (id, plant_id, parameter_type, value, measurement_date, unit, stream)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, data.plantId, data.parameter, data.value, data.measurementDate, data.unit || null, data.stream || null)
    return environmentalDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    plantId: string
    parameter: string
    value: number
    measurementDate: string
    unit: string
    stream: string
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.plantId !== undefined) {
      fields.push('plant_id = ?')
      params.push(updates.plantId)
    }
    if (updates.parameter !== undefined) {
      fields.push('parameter_type = ?')
      params.push(updates.parameter)
    }
    if (updates.value !== undefined) {
      fields.push('value = ?')
      params.push(updates.value)
    }
    if (updates.measurementDate !== undefined) {
      fields.push('measurement_date = ?')
      params.push(updates.measurementDate)
    }
    if (updates.unit !== undefined) {
      fields.push('unit = ?')
      params.push(updates.unit)
    }
    if (updates.stream !== undefined) {
      fields.push('stream = ?')
      params.push(updates.stream)
    }

    if (fields.length === 0) return environmentalDAL.getById(id)

    params.push(id)

    const stmt = db.prepare(`UPDATE environmental_data SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return environmentalDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM environmental_data WHERE id = ?')
    return stmt.run(id)
  },

  findByKeys: (plantId: string, parameter: string, measurementDate: string, stream?: string) => {
    let query = 'SELECT * FROM environmental_data WHERE plant_id = ? AND parameter_type = ? AND measurement_date = ?'
    const params: any[] = [plantId, parameter, measurementDate]

    if (stream) {
      query += ' AND stream = ?'
      params.push(stream)
    }

    return db.prepare(query).get(...params)
  }
}

/**
 * Maintenance Emergencies DAL
 */
export const emergenciesDAL = {
  getAll: (filters?: {
    plantId?: string
    solved?: boolean
    severity?: string
    from?: string
    to?: string
    sortBy?: string
    order?: string
  }) => {
    let query = 'SELECT * FROM maintenance_emergencies WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.solved !== undefined) {
      query += ' AND solved = ?'
      params.push(filters.solved ? 1 : 0)
    }

    if (filters?.severity) {
      query += ' AND severity = ?'
      params.push(filters.severity)
    }

    if (filters?.from) {
      query += ' AND reported_at >= ?'
      params.push(filters.from)
    }

    if (filters?.to) {
      query += ' AND reported_at <= ?'
      params.push(filters.to)
    }

    // Whitelist allowed sort fields to prevent SQL injection
    const allowedSortFields = ['reported_at', 'severity', 'plant_id', 'solved']
    const sortBy = allowedSortFields.includes(filters?.sortBy as string) ? filters?.sortBy : 'reported_at'
    const order = filters?.order === 'asc' ? 'ASC' : 'DESC'
    query += ` ORDER BY ${sortBy} ${order}`

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM maintenance_emergencies WHERE id = ?').get(id)
  },

  create: (emergency: {
    plantId: string
    reason: string
    solved?: boolean
    resolveTimeHours?: number
    reportedAt?: string
    severity?: string
    observations?: string
    operatorId?: string
    operatorName?: string
    locationDescription?: string
    photoPath?: string
    source?: 'admin' | 'mobile'
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO maintenance_emergencies (
        id, plant_id, reason, solved, resolve_time_hours, reported_at,
        severity, observations, operator_id, operator_name,
        location_description, photo_path, source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      emergency.plantId,
      emergency.reason,
      emergency.solved ? 1 : 0,
      emergency.resolveTimeHours || null,
      emergency.reportedAt || new Date().toISOString(),
      emergency.severity || null,
      emergency.observations || null,
      emergency.operatorId || null,
      emergency.operatorName || null,
      emergency.locationDescription || null,
      emergency.photoPath || null,
      emergency.source || 'admin'
    )
    return emergenciesDAL.getById(id)
  },

  // Mark email as sent for an emergency
  markEmailSent: (id: string) => {
    db.prepare('UPDATE maintenance_emergencies SET email_sent = 1 WHERE id = ?').run(id)
    return emergenciesDAL.getById(id)
  },

  // Acknowledge an emergency
  acknowledge: (id: string, acknowledgedBy: string) => {
    db.prepare(`
      UPDATE maintenance_emergencies
      SET acknowledged_at = datetime('now'), acknowledged_by = ?
      WHERE id = ?
    `).run(acknowledgedBy, id)
    return emergenciesDAL.getById(id)
  },

  // Get recent unacknowledged emergencies (for real-time notifications)
  getUnacknowledged: () => {
    return db.prepare(`
      SELECT me.*, p.name as plant_name
      FROM maintenance_emergencies me
      JOIN plants p ON me.plant_id = p.id
      WHERE me.acknowledged_at IS NULL AND me.solved = 0
      ORDER BY me.reported_at DESC
    `).all()
  },

  update: (id: string, updates: Partial<{
    plantId: string
    reason: string
    solved: boolean
    resolveTimeHours: number
    resolvedAt: string
    resolvedBy: string
    severity: string
    observations: string
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.plantId !== undefined) {
      fields.push('plant_id = ?')
      params.push(updates.plantId)
    }
    if (updates.reason !== undefined) {
      fields.push('reason = ?')
      params.push(updates.reason)
    }
    if (updates.solved !== undefined) {
      fields.push('solved = ?')
      params.push(updates.solved ? 1 : 0)
    }
    if (updates.resolveTimeHours !== undefined) {
      fields.push('resolve_time_hours = ?')
      params.push(updates.resolveTimeHours)
    }
    if (updates.resolvedAt !== undefined) {
      fields.push('resolved_at = ?')
      params.push(updates.resolvedAt)
    }
    if (updates.resolvedBy !== undefined) {
      fields.push('resolved_by = ?')
      params.push(updates.resolvedBy)
    }
    if (updates.severity !== undefined) {
      fields.push('severity = ?')
      params.push(updates.severity)
    }
    if (updates.observations !== undefined) {
      fields.push('observations = ?')
      params.push(updates.observations)
    }

    if (fields.length === 0) return emergenciesDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE maintenance_emergencies SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return emergenciesDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM maintenance_emergencies WHERE id = ?')
    return stmt.run(id)
  }
}

/**
 * Maintenance Tasks DAL
 */
export const maintenanceTasksDAL = {
  getAll: (filters?: {
    plantId?: string
    status?: string
    periodicity?: string
    from?: string
    to?: string
    year?: number
  }) => {
    let query = 'SELECT mt.*, p.name as plant_name FROM maintenance_tasks mt LEFT JOIN plants p ON mt.plant_id = p.id WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND mt.plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.status) {
      query += ' AND mt.status = ?'
      params.push(filters.status)
    }

    if (filters?.periodicity) {
      query += ' AND mt.periodicity = ?'
      params.push(filters.periodicity)
    }

    if (filters?.from) {
      query += ' AND mt.scheduled_date >= ?'
      params.push(filters.from)
    }

    if (filters?.to) {
      query += ' AND mt.scheduled_date <= ?'
      params.push(filters.to)
    }

    if (filters?.year) {
      query += " AND strftime('%Y', mt.scheduled_date) = ?"
      params.push(String(filters.year))
    }

    query += ' ORDER BY mt.scheduled_date ASC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare(`
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.id = ?
    `).get(id)
  },

  create: (task: {
    plantId: string
    taskType: string
    description: string
    scheduledDate: string
    status?: string
    periodicity?: string
    vendorName?: string
    estimatedCost?: number
    notes?: string
  }) => {
    const id = randomUUID()
    const reminderDate = task.scheduledDate
      ? new Date(new Date(task.scheduledDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : null
    const stmt = db.prepare(`
      INSERT INTO maintenance_tasks (id, plant_id, task_type, description, scheduled_date, status, periodicity, vendor_name, estimated_cost, notes, reminder_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      task.plantId,
      task.taskType,
      task.description,
      task.scheduledDate,
      task.status || 'pending',
      task.periodicity || 'annual',
      task.vendorName || null,
      task.estimatedCost || null,
      task.notes || null,
      reminderDate
    )
    return maintenanceTasksDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    plantId: string
    taskType: string
    description: string
    scheduledDate: string
    completedDate: string
    completedBy: string
    status: string
    periodicity: string
    vendorName: string
    estimatedCost: number
    notes: string
    reminderSent: boolean
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.plantId !== undefined) {
      fields.push('plant_id = ?')
      params.push(updates.plantId)
    }
    if (updates.taskType !== undefined) {
      fields.push('task_type = ?')
      params.push(updates.taskType)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      params.push(updates.description)
    }
    if (updates.scheduledDate !== undefined) {
      fields.push('scheduled_date = ?')
      params.push(updates.scheduledDate)
      // Recalculate reminder date
      const reminderDate = new Date(new Date(updates.scheduledDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      fields.push('reminder_date = ?')
      params.push(reminderDate)
    }
    if (updates.completedDate !== undefined) {
      fields.push('completed_date = ?')
      params.push(updates.completedDate)
    }
    if (updates.completedBy !== undefined) {
      fields.push('completed_by = ?')
      params.push(updates.completedBy)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      params.push(updates.status)
    }
    if (updates.periodicity !== undefined) {
      fields.push('periodicity = ?')
      params.push(updates.periodicity)
    }
    if (updates.vendorName !== undefined) {
      fields.push('vendor_name = ?')
      params.push(updates.vendorName)
    }
    if (updates.estimatedCost !== undefined) {
      fields.push('estimated_cost = ?')
      params.push(updates.estimatedCost)
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?')
      params.push(updates.notes)
    }
    if (updates.reminderSent !== undefined) {
      fields.push('reminder_sent = ?')
      params.push(updates.reminderSent ? 1 : 0)
    }

    if (fields.length === 0) return maintenanceTasksDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE maintenance_tasks SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return maintenanceTasksDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM maintenance_tasks WHERE id = ?')
    return stmt.run(id)
  },

  // Get tasks that need reminder (30 days before scheduled)
  getPendingReminders: () => {
    return db.prepare(`
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.status = 'pending'
        AND mt.reminder_sent = 0
        AND mt.reminder_date IS NOT NULL
        AND mt.reminder_date <= datetime('now')
        AND mt.scheduled_date > datetime('now')
    `).all()
  },

  // Mark reminder as sent
  markReminderSent: (id: string) => {
    db.prepare("UPDATE maintenance_tasks SET reminder_sent = 1, updated_at = datetime('now') WHERE id = ?").run(id)
    return maintenanceTasksDAL.getById(id)
  },

  // Get completed tasks history with filters
  getHistory: (filters?: {
    plantId?: string
    periodicity?: string
    from?: string
    to?: string
    year?: number
  }) => {
    let query = `
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.status = 'completed'
    `
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND mt.plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.periodicity) {
      query += ' AND mt.periodicity = ?'
      params.push(filters.periodicity)
    }

    if (filters?.from) {
      query += ' AND mt.completed_date >= ?'
      params.push(filters.from)
    }

    if (filters?.to) {
      query += ' AND mt.completed_date <= ?'
      params.push(filters.to)
    }

    if (filters?.year) {
      query += " AND strftime('%Y', mt.completed_date) = ?"
      params.push(String(filters.year))
    }

    query += ' ORDER BY mt.completed_date DESC'

    return db.prepare(query).all(...params)
  },

  // Get daily maintenance tasks for checklist integration
  getDailyTasks: (plantId?: string) => {
    let query = `
      SELECT mt.*, p.name as plant_name
      FROM maintenance_tasks mt
      LEFT JOIN plants p ON mt.plant_id = p.id
      WHERE mt.periodicity = 'daily'
    `
    const params: any[] = []

    if (plantId) {
      query += ' AND mt.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY mt.description ASC'

    return db.prepare(query).all(...params)
  },

  // Update overdue status for past-due pending tasks
  updateOverdueStatus: () => {
    const stmt = db.prepare(`
      UPDATE maintenance_tasks
      SET status = 'overdue', updated_at = datetime('now')
      WHERE status = 'pending' AND scheduled_date < date('now') AND periodicity != 'daily'
    `)
    return stmt.run()
  }
}

/**
 * Documents DAL
 */
export const documentsDAL = {
  getAll: (filters?: {
    plantId?: string
    category?: string
    search?: string
    sortBy?: string
    order?: string
  }) => {
    let query = 'SELECT * FROM documents WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.category) {
      query += ' AND category = ?'
      params.push(filters.category)
    }

    if (filters?.search) {
      query += ' AND file_name LIKE ?'
      params.push(`%${filters.search}%`)
    }

    // Whitelist allowed sort fields to prevent SQL injection
    const allowedSortFields = ['uploaded_at', 'file_name', 'category', 'plant_id']
    const sortBy = allowedSortFields.includes(filters?.sortBy as string) ? filters?.sortBy : 'uploaded_at'
    const order = filters?.order === 'asc' ? 'ASC' : 'DESC'
    query += ` ORDER BY ${sortBy} ${order}`

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM documents WHERE id = ?').get(id)
  },

  create: (document: {
    plantId: string
    fileName: string
    filePath: string
    category: string
    description?: string
    uploadedBy?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO documents (id, plant_id, file_name, file_path, category, description, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, document.plantId, document.fileName, document.filePath, document.category, document.description || null, document.uploadedBy || null)
    return documentsDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM documents WHERE id = ?')
    return stmt.run(id)
  }
}

// OPEX Costs DAL
export const opexCostsDAL = {
  getAll: (filters: { plantId?: string; startDate?: string; endDate?: string; year?: number } = {}) => {
    let query = 'SELECT * FROM opex_costs WHERE 1=1'
    const params: any[] = []

    if (filters.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters.startDate) {
      query += ' AND period_date >= ?'
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      query += ' AND period_date <= ?'
      params.push(filters.endDate)
    }

    if (filters.year) {
      query += " AND strftime('%Y', period_date) = ?"
      params.push(String(filters.year))
    }

    query += ' ORDER BY period_date DESC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM opex_costs WHERE id = ?').get(id)
  },

  getByPlantAndPeriod: (plantId: string, periodDate: string) => {
    return db.prepare('SELECT * FROM opex_costs WHERE plant_id = ? AND period_date = ?').get(plantId, periodDate)
  },

  create: (cost: {
    plantId: string
    periodDate: string
    volumeM3: number
    costAgua?: number
    costPersonal?: number
    costMantenimiento?: number
    costEnergia?: number
    costFloculante?: number
    costCoagulante?: number
    costEstabilizadorPh?: number
    costDap?: number
    costUrea?: number
    costMelaza?: number
    notes?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO opex_costs (
        id, plant_id, period_date, volume_m3,
        cost_agua, cost_personal, cost_mantenimiento, cost_energia,
        cost_floculante, cost_coagulante, cost_estabilizador_ph,
        cost_dap, cost_urea, cost_melaza, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id, cost.plantId, cost.periodDate, cost.volumeM3,
      cost.costAgua || 0, cost.costPersonal || 0, cost.costMantenimiento || 0, cost.costEnergia || 0,
      cost.costFloculante || 0, cost.costCoagulante || 0, cost.costEstabilizadorPh || 0,
      cost.costDap || 0, cost.costUrea || 0, cost.costMelaza || 0, cost.notes || null
    )
    return opexCostsDAL.getById(id)
  },

  update: (id: string, updates: {
    volumeM3?: number
    costAgua?: number
    costPersonal?: number
    costMantenimiento?: number
    costEnergia?: number
    costFloculante?: number
    costCoagulante?: number
    costEstabilizadorPh?: number
    costDap?: number
    costUrea?: number
    costMelaza?: number
    notes?: string
  }) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.volumeM3 !== undefined) { fields.push('volume_m3 = ?'); params.push(updates.volumeM3) }
    if (updates.costAgua !== undefined) { fields.push('cost_agua = ?'); params.push(updates.costAgua) }
    if (updates.costPersonal !== undefined) { fields.push('cost_personal = ?'); params.push(updates.costPersonal) }
    if (updates.costMantenimiento !== undefined) { fields.push('cost_mantenimiento = ?'); params.push(updates.costMantenimiento) }
    if (updates.costEnergia !== undefined) { fields.push('cost_energia = ?'); params.push(updates.costEnergia) }
    if (updates.costFloculante !== undefined) { fields.push('cost_floculante = ?'); params.push(updates.costFloculante) }
    if (updates.costCoagulante !== undefined) { fields.push('cost_coagulante = ?'); params.push(updates.costCoagulante) }
    if (updates.costEstabilizadorPh !== undefined) { fields.push('cost_estabilizador_ph = ?'); params.push(updates.costEstabilizadorPh) }
    if (updates.costDap !== undefined) { fields.push('cost_dap = ?'); params.push(updates.costDap) }
    if (updates.costUrea !== undefined) { fields.push('cost_urea = ?'); params.push(updates.costUrea) }
    if (updates.costMelaza !== undefined) { fields.push('cost_melaza = ?'); params.push(updates.costMelaza) }
    if (updates.notes !== undefined) { fields.push('notes = ?'); params.push(updates.notes) }

    if (fields.length === 0) return opexCostsDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE opex_costs SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return opexCostsDAL.getById(id)
  },

  upsert: (cost: {
    plantId: string
    periodDate: string
    volumeM3: number
    costAgua?: number
    costPersonal?: number
    costMantenimiento?: number
    costEnergia?: number
    costFloculante?: number
    costCoagulante?: number
    costEstabilizadorPh?: number
    costDap?: number
    costUrea?: number
    costMelaza?: number
    notes?: string
  }) => {
    const existing = opexCostsDAL.getByPlantAndPeriod(cost.plantId, cost.periodDate) as any
    if (existing) {
      return opexCostsDAL.update(existing.id, {
        volumeM3: cost.volumeM3,
        costAgua: cost.costAgua,
        costPersonal: cost.costPersonal,
        costMantenimiento: cost.costMantenimiento,
        costEnergia: cost.costEnergia,
        costFloculante: cost.costFloculante,
        costCoagulante: cost.costCoagulante,
        costEstabilizadorPh: cost.costEstabilizadorPh,
        costDap: cost.costDap,
        costUrea: cost.costUrea,
        costMelaza: cost.costMelaza,
        notes: cost.notes
      })
    }
    return opexCostsDAL.create(cost)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM opex_costs WHERE id = ?')
    return stmt.run(id)
  },

  // Get summary stats per plant
  getSummaryByPlant: (plantId: string, year?: number) => {
    let query = `
      SELECT
        plant_id,
        COUNT(*) as record_count,
        SUM(volume_m3) as total_volume,
        SUM(cost_agua) as total_agua,
        SUM(cost_personal) as total_personal,
        SUM(cost_mantenimiento) as total_mantenimiento,
        SUM(cost_energia) as total_energia,
        SUM(cost_floculante) as total_floculante,
        SUM(cost_coagulante) as total_coagulante,
        SUM(cost_estabilizador_ph) as total_estabilizador_ph,
        SUM(cost_dap) as total_dap,
        SUM(cost_urea) as total_urea,
        SUM(cost_melaza) as total_melaza,
        SUM(cost_agua + cost_personal + cost_mantenimiento + cost_energia +
            cost_floculante + cost_coagulante + cost_estabilizador_ph +
            cost_dap + cost_urea + cost_melaza) as total_cost
      FROM opex_costs
      WHERE plant_id = ?
    `
    const params: any[] = [plantId]

    if (year) {
      query += " AND strftime('%Y', period_date) = ?"
      params.push(String(year))
    }

    query += ' GROUP BY plant_id'

    return db.prepare(query).get(...params)
  }
}

/**
 * Equipment DAL (for Tropack Industrial maintenance plan)
 */
export const equipmentDAL = {
  getAll: (filters?: { plantId?: string; category?: string; search?: string }) => {
    let query = 'SELECT * FROM equipment WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.category) {
      query += ' AND category = ?'
      params.push(filters.category)
    }

    if (filters?.search) {
      query += ' AND (description LIKE ? OR item_code LIKE ? OR location LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }

    query += ' ORDER BY item_code ASC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM equipment WHERE id = ?').get(id)
  },

  getByPlant: (plantId: string) => {
    return db.prepare('SELECT * FROM equipment WHERE plant_id = ? ORDER BY category, item_code').all(plantId)
  },

  getCategories: (plantId: string) => {
    return db.prepare('SELECT DISTINCT category FROM equipment WHERE plant_id = ? ORDER BY category').all(plantId)
  },

  create: (equipment: {
    plantId: string
    itemCode: string
    description: string
    reference?: string
    location?: string
    quantity?: number
    category?: string
    dailyCheck?: string
    monthlyCheck?: string
    quarterlyCheck?: string
    biannualCheck?: string
    annualCheck?: string
    timeBasedReference?: string
    spareParts?: string
    extras?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO equipment (id, plant_id, item_code, description, reference, location, quantity, category, daily_check, monthly_check, quarterly_check, biannual_check, annual_check, time_based_reference, spare_parts, extras)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id, equipment.plantId, equipment.itemCode, equipment.description,
      equipment.reference || null, equipment.location || null, equipment.quantity || 1,
      equipment.category || 'otros', equipment.dailyCheck || null, equipment.monthlyCheck || null,
      equipment.quarterlyCheck || null, equipment.biannualCheck || null, equipment.annualCheck || null,
      equipment.timeBasedReference || null, equipment.spareParts || null, equipment.extras || null
    )
    return equipmentDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    itemCode: string
    description: string
    reference: string
    location: string
    quantity: number
    category: string
    dailyCheck: string
    monthlyCheck: string
    quarterlyCheck: string
    biannualCheck: string
    annualCheck: string
    timeBasedReference: string
    spareParts: string
    extras: string
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.itemCode !== undefined) { fields.push('item_code = ?'); params.push(updates.itemCode) }
    if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description) }
    if (updates.reference !== undefined) { fields.push('reference = ?'); params.push(updates.reference) }
    if (updates.location !== undefined) { fields.push('location = ?'); params.push(updates.location) }
    if (updates.quantity !== undefined) { fields.push('quantity = ?'); params.push(updates.quantity) }
    if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category) }
    if (updates.dailyCheck !== undefined) { fields.push('daily_check = ?'); params.push(updates.dailyCheck) }
    if (updates.monthlyCheck !== undefined) { fields.push('monthly_check = ?'); params.push(updates.monthlyCheck) }
    if (updates.quarterlyCheck !== undefined) { fields.push('quarterly_check = ?'); params.push(updates.quarterlyCheck) }
    if (updates.biannualCheck !== undefined) { fields.push('biannual_check = ?'); params.push(updates.biannualCheck) }
    if (updates.annualCheck !== undefined) { fields.push('annual_check = ?'); params.push(updates.annualCheck) }
    if (updates.timeBasedReference !== undefined) { fields.push('time_based_reference = ?'); params.push(updates.timeBasedReference) }
    if (updates.spareParts !== undefined) { fields.push('spare_parts = ?'); params.push(updates.spareParts) }
    if (updates.extras !== undefined) { fields.push('extras = ?'); params.push(updates.extras) }

    if (fields.length === 0) return equipmentDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE equipment SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return equipmentDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM equipment WHERE id = ?')
    return stmt.run(id)
  }
}

/**
 * Equipment Maintenance Log DAL
 */
export const equipmentMaintenanceLogDAL = {
  getAll: (filters?: { equipmentId?: string; maintenanceType?: string; startDate?: string; endDate?: string }) => {
    let query = 'SELECT * FROM equipment_maintenance_log WHERE 1=1'
    const params: any[] = []

    if (filters?.equipmentId) {
      query += ' AND equipment_id = ?'
      params.push(filters.equipmentId)
    }

    if (filters?.maintenanceType) {
      query += ' AND maintenance_type = ?'
      params.push(filters.maintenanceType)
    }

    if (filters?.startDate) {
      query += ' AND maintenance_date >= ?'
      params.push(filters.startDate)
    }

    if (filters?.endDate) {
      query += ' AND maintenance_date <= ?'
      params.push(filters.endDate)
    }

    query += ' ORDER BY maintenance_date DESC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM equipment_maintenance_log WHERE id = ?').get(id)
  },

  getByEquipment: (equipmentId: string) => {
    return db.prepare('SELECT * FROM equipment_maintenance_log WHERE equipment_id = ? ORDER BY maintenance_date DESC').all(equipmentId)
  },

  create: (log: {
    equipmentId: string
    maintenanceType: 'preventivo' | 'correctivo'
    operation: string
    maintenanceDate: string
    descriptionAveria?: string
    descriptionRealizado?: string
    nextMaintenanceDate?: string
    operatorName?: string
    responsibleName?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO equipment_maintenance_log (id, equipment_id, maintenance_type, operation, maintenance_date, description_averia, description_realizado, next_maintenance_date, operator_name, responsible_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id, log.equipmentId, log.maintenanceType, log.operation, log.maintenanceDate,
      log.descriptionAveria || null, log.descriptionRealizado || null,
      log.nextMaintenanceDate || null, log.operatorName || null, log.responsibleName || null
    )
    return equipmentMaintenanceLogDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    maintenanceType: string
    operation: string
    maintenanceDate: string
    descriptionAveria: string
    descriptionRealizado: string
    nextMaintenanceDate: string
    operatorName: string
    responsibleName: string
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.maintenanceType !== undefined) { fields.push('maintenance_type = ?'); params.push(updates.maintenanceType) }
    if (updates.operation !== undefined) { fields.push('operation = ?'); params.push(updates.operation) }
    if (updates.maintenanceDate !== undefined) { fields.push('maintenance_date = ?'); params.push(updates.maintenanceDate) }
    if (updates.descriptionAveria !== undefined) { fields.push('description_averia = ?'); params.push(updates.descriptionAveria) }
    if (updates.descriptionRealizado !== undefined) { fields.push('description_realizado = ?'); params.push(updates.descriptionRealizado) }
    if (updates.nextMaintenanceDate !== undefined) { fields.push('next_maintenance_date = ?'); params.push(updates.nextMaintenanceDate) }
    if (updates.operatorName !== undefined) { fields.push('operator_name = ?'); params.push(updates.operatorName) }
    if (updates.responsibleName !== undefined) { fields.push('responsible_name = ?'); params.push(updates.responsibleName) }

    if (fields.length === 0) return equipmentMaintenanceLogDAL.getById(id)

    params.push(id)

    const stmt = db.prepare(`UPDATE equipment_maintenance_log SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return equipmentMaintenanceLogDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM equipment_maintenance_log WHERE id = ?')
    return stmt.run(id)
  }
}

/**
 * Equipment Scheduled Maintenance DAL (annual planning)
 */
export const equipmentScheduledMaintenanceDAL = {
  getAll: (filters?: { equipmentId?: string; year?: number; status?: string; frequency?: string }) => {
    let query = 'SELECT * FROM equipment_scheduled_maintenance WHERE 1=1'
    const params: any[] = []

    if (filters?.equipmentId) {
      query += ' AND equipment_id = ?'
      params.push(filters.equipmentId)
    }

    if (filters?.year) {
      query += ' AND year = ?'
      params.push(filters.year)
    }

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters?.frequency) {
      query += ' AND frequency = ?'
      params.push(filters.frequency)
    }

    query += ' ORDER BY scheduled_date ASC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM equipment_scheduled_maintenance WHERE id = ?').get(id)
  },

  getByEquipmentAndYear: (equipmentId: string, year: number) => {
    return db.prepare('SELECT * FROM equipment_scheduled_maintenance WHERE equipment_id = ? AND year = ? ORDER BY scheduled_date ASC').all(equipmentId, year)
  },

  getByPlantAndYear: (plantId: string, year: number) => {
    return db.prepare(`
      SELECT esm.*, e.item_code, e.description as equipment_description, e.category
      FROM equipment_scheduled_maintenance esm
      JOIN equipment e ON esm.equipment_id = e.id
      WHERE e.plant_id = ? AND esm.year = ?
      ORDER BY esm.scheduled_date ASC
    `).all(plantId, year)
  },

  create: (task: {
    equipmentId: string
    frequency: 'diario' | 'mensual' | 'trimestral' | 'semestral' | 'anual'
    scheduledDate: string
    year: number
    description?: string
    notes?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO equipment_scheduled_maintenance (id, equipment_id, frequency, scheduled_date, year, description, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `)
    stmt.run(id, task.equipmentId, task.frequency, task.scheduledDate, task.year, task.description || null, task.notes || null)
    return equipmentScheduledMaintenanceDAL.getById(id)
  },

  markCompleted: (id: string, completedDate: string, completedBy?: string, notes?: string) => {
    const stmt = db.prepare(`
      UPDATE equipment_scheduled_maintenance
      SET status = 'completed', completed_date = ?, completed_by = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(completedDate, completedBy || null, notes, id)
    return equipmentScheduledMaintenanceDAL.getById(id)
  },

  markPending: (id: string) => {
    const stmt = db.prepare(`
      UPDATE equipment_scheduled_maintenance
      SET status = 'pending', completed_date = NULL, completed_by = NULL, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(id)
    return equipmentScheduledMaintenanceDAL.getById(id)
  },

  updateOverdueStatus: () => {
    // Mark tasks as overdue if scheduled_date < today and status is pending
    const stmt = db.prepare(`
      UPDATE equipment_scheduled_maintenance
      SET status = 'overdue', updated_at = datetime('now')
      WHERE status = 'pending' AND scheduled_date < date('now')
    `)
    return stmt.run()
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM equipment_scheduled_maintenance WHERE id = ?')
    return stmt.run(id)
  },

  deleteByPlantAndYear: (plantId: string, year: number) => {
    // Delete all scheduled tasks for equipment belonging to a plant for a specific year
    const stmt = db.prepare(`
      DELETE FROM equipment_scheduled_maintenance
      WHERE equipment_id IN (SELECT id FROM equipment WHERE plant_id = ?) AND year = ?
    `)
    const result = stmt.run(plantId, year)
    return result.changes
  },

  updateScheduledDate: (id: string, scheduledDate: string) => {
    // Get current task to check for conflicts
    const currentTask = equipmentScheduledMaintenanceDAL.getById(id) as any
    if (!currentTask) return null

    // Check if moving to this date would create a conflict
    const conflict = db.prepare(`
      SELECT id FROM equipment_scheduled_maintenance
      WHERE equipment_id = ? AND frequency = ? AND scheduled_date = ? AND id != ?
    `).get(currentTask.equipment_id, currentTask.frequency, scheduledDate, id)

    if (conflict) {
      // Delete the conflicting task (the one at the destination)
      db.prepare('DELETE FROM equipment_scheduled_maintenance WHERE id = ?').run((conflict as any).id)
    }

    const stmt = db.prepare(`
      UPDATE equipment_scheduled_maintenance
      SET scheduled_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(scheduledDate, id)
    return equipmentScheduledMaintenanceDAL.getById(id)
  },

  // Generate scheduled tasks for a year based on equipment maintenance frequencies
  generateYearPlan: (equipmentId: string, year: number) => {
    const equipment = equipmentDAL.getById(equipmentId) as any
    if (!equipment) return []

    const tasks: any[] = []
    const frequencies = [
      { freq: 'mensual', check: equipment.monthly_check, months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { freq: 'trimestral', check: equipment.quarterly_check, months: [2, 5, 8, 11] }, // Mar, Jun, Sep, Dec
      { freq: 'semestral', check: equipment.biannual_check, months: [5, 11] }, // Jun, Dec
      { freq: 'anual', check: equipment.annual_check, months: [11] } // December
    ]

    frequencies.forEach(({ freq, check, months }) => {
      if (!check) return
      months.forEach(month => {
        const scheduledDate = `${year}-${String(month + 1).padStart(2, '0')}-15`
        // Check if already exists
        const existing = db.prepare(
          'SELECT id FROM equipment_scheduled_maintenance WHERE equipment_id = ? AND frequency = ? AND scheduled_date = ?'
        ).get(equipmentId, freq, scheduledDate)

        if (!existing) {
          const id = randomUUID()
          db.prepare(`
            INSERT INTO equipment_scheduled_maintenance (id, equipment_id, frequency, scheduled_date, year, description, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
          `).run(id, equipmentId, freq, scheduledDate, year, check)
          tasks.push({ id, equipmentId, frequency: freq, scheduledDate, year, description: check })
        }
      })
    })

    return tasks
  }
}

/**
 * Tickets DAL
 */
export const ticketsDAL = {
  generateTicketNumber: () => {
    const year = new Date().getFullYear()
    const count = db.prepare(
      "SELECT COUNT(*) as count FROM tickets WHERE strftime('%Y', created_at) = ?"
    ).get(String(year)) as { count: number }
    return `TKT-${year}-${String(count.count + 1).padStart(5, '0')}`
  },

  getAll: (filters?: {
    plantId?: string
    status?: string
    category?: string
    priority?: string
    from?: string
    to?: string
    search?: string
  }) => {
    let query = `
      SELECT t.*, p.name as plant_name
      FROM tickets t
      LEFT JOIN plants p ON t.plant_id = p.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND t.plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.status) {
      query += ' AND t.status = ?'
      params.push(filters.status)
    }

    if (filters?.category) {
      query += ' AND t.category = ?'
      params.push(filters.category)
    }

    if (filters?.priority) {
      query += ' AND t.priority = ?'
      params.push(filters.priority)
    }

    if (filters?.from) {
      query += ' AND t.created_at >= ?'
      params.push(filters.from)
    }

    if (filters?.to) {
      query += ' AND t.created_at <= ?'
      params.push(filters.to)
    }

    if (filters?.search) {
      query += ' AND (t.subject LIKE ? OR t.description LIKE ? OR t.ticket_number LIKE ?)'
      const searchTerm = `%${filters.search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    query += ' ORDER BY t.created_at DESC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare(`
      SELECT t.*, p.name as plant_name
      FROM tickets t
      LEFT JOIN plants p ON t.plant_id = p.id
      WHERE t.id = ?
    `).get(id)
  },

  getByTicketNumber: (ticketNumber: string) => {
    return db.prepare(`
      SELECT t.*, p.name as plant_name
      FROM tickets t
      LEFT JOIN plants p ON t.plant_id = p.id
      WHERE t.ticket_number = ?
    `).get(ticketNumber)
  },

  create: (ticket: {
    plantId: string
    subject: string
    description: string
    category: string
    priority?: string
    requesterName: string
    requesterEmail?: string
    requesterPhone?: string
    assignedTo?: string
  }) => {
    const id = randomUUID()
    const ticketNumber = ticketsDAL.generateTicketNumber()
    const stmt = db.prepare(`
      INSERT INTO tickets (id, plant_id, ticket_number, subject, description, category, priority, requester_name, requester_email, requester_phone, assigned_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      ticket.plantId,
      ticketNumber,
      ticket.subject,
      ticket.description,
      ticket.category,
      ticket.priority || 'medium',
      ticket.requesterName,
      ticket.requesterEmail || null,
      ticket.requesterPhone || null,
      ticket.assignedTo || null
    )
    return ticketsDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    subject: string
    description: string
    category: string
    priority: string
    status: string
    requesterName: string
    requesterEmail: string
    requesterPhone: string
    assignedTo: string
    sentViaEmail: boolean
    sentViaWhatsapp: boolean
    emailSentAt: string
    whatsappSentAt: string
    resolvedAt: string
    resolutionNotes: string
  }>) => {
    const fields: string[] = []
    const params: any[] = []

    if (updates.subject !== undefined) { fields.push('subject = ?'); params.push(updates.subject) }
    if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description) }
    if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category) }
    if (updates.priority !== undefined) { fields.push('priority = ?'); params.push(updates.priority) }
    if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status) }
    if (updates.requesterName !== undefined) { fields.push('requester_name = ?'); params.push(updates.requesterName) }
    if (updates.requesterEmail !== undefined) { fields.push('requester_email = ?'); params.push(updates.requesterEmail) }
    if (updates.requesterPhone !== undefined) { fields.push('requester_phone = ?'); params.push(updates.requesterPhone) }
    if (updates.assignedTo !== undefined) { fields.push('assigned_to = ?'); params.push(updates.assignedTo) }
    if (updates.sentViaEmail !== undefined) { fields.push('sent_via_email = ?'); params.push(updates.sentViaEmail ? 1 : 0) }
    if (updates.sentViaWhatsapp !== undefined) { fields.push('sent_via_whatsapp = ?'); params.push(updates.sentViaWhatsapp ? 1 : 0) }
    if (updates.emailSentAt !== undefined) { fields.push('email_sent_at = ?'); params.push(updates.emailSentAt) }
    if (updates.whatsappSentAt !== undefined) { fields.push('whatsapp_sent_at = ?'); params.push(updates.whatsappSentAt) }
    if (updates.resolvedAt !== undefined) { fields.push('resolved_at = ?'); params.push(updates.resolvedAt) }
    if (updates.resolutionNotes !== undefined) { fields.push('resolution_notes = ?'); params.push(updates.resolutionNotes) }

    if (fields.length === 0) return ticketsDAL.getById(id)

    fields.push("updated_at = datetime('now')")
    params.push(id)

    const stmt = db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`)
    stmt.run(...params)
    return ticketsDAL.getById(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM tickets WHERE id = ?')
    return stmt.run(id)
  },

  getStats: (plantId?: string) => {
    let whereClause = ''
    const params: any[] = []
    if (plantId) {
      whereClause = ' WHERE plant_id = ?'
      params.push(plantId)
    }

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN sent_via_email = 1 THEN 1 ELSE 0 END) as sent_email,
        SUM(CASE WHEN sent_via_whatsapp = 1 THEN 1 ELSE 0 END) as sent_whatsapp
      FROM tickets${whereClause}
    `).get(...params) as any

    return {
      total: stats.total || 0,
      open: stats.open || 0,
      inProgress: stats.in_progress || 0,
      waiting: stats.waiting || 0,
      resolved: stats.resolved || 0,
      closed: stats.closed || 0,
      urgent: stats.urgent || 0,
      high: stats.high || 0,
      sentEmail: stats.sent_email || 0,
      sentWhatsapp: stats.sent_whatsapp || 0
    }
  }
}

/**
 * Ticket Comments DAL
 */
export const ticketCommentsDAL = {
  getByTicketId: (ticketId: string) => {
    return db.prepare(`
      SELECT * FROM ticket_comments
      WHERE ticket_id = ?
      ORDER BY created_at ASC
    `).all(ticketId)
  },

  create: (comment: {
    ticketId: string
    authorName: string
    authorEmail?: string
    comment: string
    isInternal?: boolean
    sentNotification?: boolean
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO ticket_comments (id, ticket_id, author_name, author_email, comment, is_internal, sent_notification)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      comment.ticketId,
      comment.authorName,
      comment.authorEmail || null,
      comment.comment,
      comment.isInternal ? 1 : 0,
      comment.sentNotification ? 1 : 0
    )
    return db.prepare('SELECT * FROM ticket_comments WHERE id = ?').get(id)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM ticket_comments WHERE id = ?')
    return stmt.run(id)
  }
}

/**
 * Daily Checklists DAL - for historical search
 */
export const dailyChecklistsDAL = {
  getByDate: (date: string, plantId?: string) => {
    let query = `
      SELECT dc.*, p.name as plant_name, ct.template_name
      FROM daily_checklists dc
      LEFT JOIN plants p ON dc.plant_id = p.id
      LEFT JOIN checklist_templates ct ON dc.template_id = ct.id
      WHERE DATE(dc.checklist_date) = DATE(?)
    `
    const params: any[] = [date]

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY dc.checklist_date DESC'

    return db.prepare(query).all(...params)
  },

  getByDateRange: (from: string, to: string, plantId?: string) => {
    let query = `
      SELECT dc.*, p.name as plant_name, ct.template_name
      FROM daily_checklists dc
      LEFT JOIN plants p ON dc.plant_id = p.id
      LEFT JOIN checklist_templates ct ON dc.template_id = ct.id
      WHERE DATE(dc.checklist_date) >= DATE(?) AND DATE(dc.checklist_date) <= DATE(?)
    `
    const params: any[] = [from, to]

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY dc.checklist_date DESC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare(`
      SELECT dc.*, p.name as plant_name, ct.template_name
      FROM daily_checklists dc
      LEFT JOIN plants p ON dc.plant_id = p.id
      LEFT JOIN checklist_templates ct ON dc.template_id = ct.id
      WHERE dc.id = ?
    `).get(id)
  },

  getItemsByChecklistId: (checklistId: string) => {
    return db.prepare(`
      SELECT dci.*, cti.element, cti.activity, cti.section
      FROM daily_checklist_items dci
      LEFT JOIN checklist_template_items cti ON dci.template_item_id = cti.id
      WHERE dci.checklist_id = ?
      ORDER BY cti.display_order ASC
    `).all(checklistId)
  },

  searchByOperator: (operatorName: string, plantId?: string) => {
    let query = `
      SELECT dc.*, p.name as plant_name, ct.template_name
      FROM daily_checklists dc
      LEFT JOIN plants p ON dc.plant_id = p.id
      LEFT JOIN checklist_templates ct ON dc.template_id = ct.id
      WHERE dc.operator_name LIKE ?
    `
    const params: any[] = [`%${operatorName}%`]

    if (plantId) {
      query += ' AND dc.plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY dc.checklist_date DESC LIMIT 100'

    return db.prepare(query).all(...params)
  },

  getAvailableDates: (plantId?: string) => {
    let query = `
      SELECT DISTINCT DATE(checklist_date) as date
      FROM daily_checklists
      WHERE 1=1
    `
    const params: any[] = []

    if (plantId) {
      query += ' AND plant_id = ?'
      params.push(plantId)
    }

    query += ' ORDER BY date DESC LIMIT 365'

    return db.prepare(query).all(...params)
  }
}
