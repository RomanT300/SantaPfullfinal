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
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO maintenance_emergencies (id, plant_id, reason, solved, resolve_time_hours, reported_at, severity, observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      id,
      emergency.plantId,
      emergency.reason,
      emergency.solved ? 1 : 0,
      emergency.resolveTimeHours || null,
      emergency.reportedAt || new Date().toISOString(),
      emergency.severity || null,
      emergency.observations || null
    )
    return emergenciesDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    plantId: string
    reason: string
    solved: boolean
    resolveTimeHours: number
    resolvedAt: string
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
    from?: string
    to?: string
  }) => {
    let query = 'SELECT * FROM maintenance_tasks WHERE 1=1'
    const params: any[] = []

    if (filters?.plantId) {
      query += ' AND plant_id = ?'
      params.push(filters.plantId)
    }

    if (filters?.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters?.from) {
      query += ' AND scheduled_date >= ?'
      params.push(filters.from)
    }

    if (filters?.to) {
      query += ' AND scheduled_date <= ?'
      params.push(filters.to)
    }

    query += ' ORDER BY scheduled_date ASC'

    return db.prepare(query).all(...params)
  },

  getById: (id: string) => {
    return db.prepare('SELECT * FROM maintenance_tasks WHERE id = ?').get(id)
  },

  create: (task: {
    plantId: string
    taskType: string
    description: string
    scheduledDate: string
    status?: string
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO maintenance_tasks (id, plant_id, task_type, description, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(id, task.plantId, task.taskType, task.description, task.scheduledDate, task.status || 'pending')
    return maintenanceTasksDAL.getById(id)
  },

  update: (id: string, updates: Partial<{
    plantId: string
    taskType: string
    description: string
    scheduledDate: string
    completedDate: string
    status: string
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
    }
    if (updates.completedDate !== undefined) {
      fields.push('completed_date = ?')
      params.push(updates.completedDate)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      params.push(updates.status)
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
