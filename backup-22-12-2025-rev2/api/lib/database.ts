/**
 * SQLite Database Layer
 * Embedded database for production use without external dependencies
 */
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dbDir, 'ptar.db')

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

// Initialize database (disable verbose logging in production for security)
const isProd = process.env.NODE_ENV === 'production'
export const db = new Database(dbPath, {
  verbose: isProd ? undefined : console.log
})

// Enable foreign keys
db.pragma('foreign_keys = ON')

/**
 * Initialize database schema
 */
export function initializeDatabase() {
  console.log('[database] Initializing SQLite database schema...')

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'standard')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Plants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL CHECK(status IN ('active', 'inactive', 'maintenance')) DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Environmental data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS environmental_data (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      parameter_type TEXT NOT NULL CHECK(parameter_type IN ('DQO', 'pH', 'SS')),
      value REAL NOT NULL,
      measurement_date TEXT NOT NULL,
      unit TEXT,
      stream TEXT CHECK(stream IN ('influent', 'effluent')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for environmental_data
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_env_plant ON environmental_data(plant_id);
    CREATE INDEX IF NOT EXISTS idx_env_param ON environmental_data(parameter_type);
    CREATE INDEX IF NOT EXISTS idx_env_date ON environmental_data(measurement_date);
    CREATE INDEX IF NOT EXISTS idx_env_stream ON environmental_data(stream);
  `)

  // Maintenance tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      task_type TEXT NOT NULL,
      description TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      completed_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'overdue')) DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for maintenance_tasks
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_maint_plant ON maintenance_tasks(plant_id);
    CREATE INDEX IF NOT EXISTS idx_maint_status ON maintenance_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_maint_date ON maintenance_tasks(scheduled_date);
  `)

  // Maintenance emergencies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_emergencies (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      solved INTEGER NOT NULL DEFAULT 0,
      resolve_time_hours INTEGER,
      reported_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high')),
      observations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for maintenance_emergencies
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_emerg_plant ON maintenance_emergencies(plant_id);
    CREATE INDEX IF NOT EXISTS idx_emerg_solved ON maintenance_emergencies(solved);
    CREATE INDEX IF NOT EXISTS idx_emerg_reported ON maintenance_emergencies(reported_at);
  `)

  // Documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for documents
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_doc_plant ON documents(plant_id);
    CREATE INDEX IF NOT EXISTS idx_doc_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_doc_uploaded ON documents(uploaded_at);
  `)

  // OPEX costs table - costs per m³
  db.exec(`
    CREATE TABLE IF NOT EXISTS opex_costs (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      period_date TEXT NOT NULL,
      volume_m3 REAL NOT NULL DEFAULT 0,
      cost_agua REAL DEFAULT 0,
      cost_personal REAL DEFAULT 0,
      cost_mantenimiento REAL DEFAULT 0,
      cost_energia REAL DEFAULT 0,
      cost_floculante REAL DEFAULT 0,
      cost_coagulante REAL DEFAULT 0,
      cost_estabilizador_ph REAL DEFAULT 0,
      cost_dap REAL DEFAULT 0,
      cost_urea REAL DEFAULT 0,
      cost_melaza REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      UNIQUE(plant_id, period_date)
    );
  `)

  // Create indexes for opex_costs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_opex_plant ON opex_costs(plant_id);
    CREATE INDEX IF NOT EXISTS idx_opex_period ON opex_costs(period_date);
  `)

  // Equipment maintenance plan (for Tropack Industrial)
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      location TEXT,
      quantity INTEGER DEFAULT 1,
      category TEXT CHECK(category IN ('difusores', 'ductos', 'cuadro_electrico', 'lamelas', 'motores', 'sensores', 'tanques', 'valvulas', 'otros')),
      daily_check TEXT,
      monthly_check TEXT,
      quarterly_check TEXT,
      biannual_check TEXT,
      annual_check TEXT,
      time_based_reference TEXT,
      spare_parts TEXT,
      extras TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Equipment maintenance log (historical records)
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_maintenance_log (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      maintenance_type TEXT NOT NULL CHECK(maintenance_type IN ('preventivo', 'correctivo')),
      operation TEXT NOT NULL,
      maintenance_date TEXT NOT NULL,
      description_averia TEXT,
      description_realizado TEXT,
      next_maintenance_date TEXT,
      operator_name TEXT,
      responsible_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for equipment tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_equip_plant ON equipment(plant_id);
    CREATE INDEX IF NOT EXISTS idx_equip_category ON equipment(category);
    CREATE INDEX IF NOT EXISTS idx_equip_log_equip ON equipment_maintenance_log(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_log_date ON equipment_maintenance_log(maintenance_date);
  `)

  // Scheduled maintenance tasks for equipment (annual planning)
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_scheduled_maintenance (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      frequency TEXT NOT NULL CHECK(frequency IN ('diario', 'mensual', 'trimestral', 'semestral', 'anual')),
      scheduled_date TEXT NOT NULL,
      completed_date TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'overdue')) DEFAULT 'pending',
      description TEXT,
      notes TEXT,
      completed_by TEXT,
      year INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      UNIQUE(equipment_id, frequency, scheduled_date)
    );
  `)

  // Create indexes for scheduled maintenance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sched_equip ON equipment_scheduled_maintenance(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_sched_date ON equipment_scheduled_maintenance(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_sched_status ON equipment_scheduled_maintenance(status);
    CREATE INDEX IF NOT EXISTS idx_sched_year ON equipment_scheduled_maintenance(year);
  `)

  console.log('[database] Database schema initialized successfully')
}

/**
 * Seed database with initial data
 */
export function seedDatabase() {
  console.log('[database] Seeding database with initial data...')

  // Check if plants already exist
  const plantCount = db.prepare('SELECT COUNT(*) as count FROM plants').get() as { count: number }
  if (plantCount.count > 0) {
    console.log('[database] Database already seeded, skipping...')
    return
  }

  // Insert plants
  const insertPlant = db.prepare(`
    INSERT INTO plants (id, name, location, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const plants = [
    { id: '33333333-3333-3333-3333-333333333333', name: 'LA LUZ', location: 'La Libertad', latitude: -2.234, longitude: -80.901, status: 'active' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'TAURA', location: 'Taura', latitude: -2.393, longitude: -79.760, status: 'active' },
    { id: '55555555-5555-5555-5555-555555555555', name: 'SANTA MONICA', location: 'Santa Elena', latitude: -2.226, longitude: -80.855, status: 'active' },
    { id: '66666666-6666-6666-6666-666666666666', name: 'SAN DIEGO', location: 'San Diego', latitude: -1.956, longitude: -79.827, status: 'active' },
    { id: '77777777-7777-7777-7777-777777777777', name: 'CHANDUY', location: 'Chanduy', latitude: -2.439, longitude: -80.629, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888881', name: 'TEXTILES', location: 'Guayaquil', latitude: -2.189, longitude: -79.889, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888882', name: 'TPI', location: 'Guayaquil', latitude: -2.195, longitude: -79.892, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888883', name: 'TROPACK BIOSEM 1', location: 'Durán', latitude: -2.167, longitude: -79.838, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888884', name: 'TROPACK BIOSEM 2', location: 'Durán', latitude: -2.169, longitude: -79.840, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888885', name: 'TROPACK INDUSTRIAL', location: 'Durán', latitude: -2.171, longitude: -79.842, status: 'active' },
    { id: '88888888-8888-8888-8888-888888888886', name: 'TROPACK TILAPIA', location: 'Durán', latitude: -2.173, longitude: -79.844, status: 'active' },
  ]

  const insertMany = db.transaction((plants: any[]) => {
    for (const plant of plants) {
      insertPlant.run(plant.id, plant.name, plant.location, plant.latitude, plant.longitude, plant.status)
    }
  })

  insertMany(plants)

  // Insert environmental data
  const insertEnvData = db.prepare(`
    INSERT INTO environmental_data (id, plant_id, parameter_type, value, measurement_date, unit, stream)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const baseValues: Record<string, any> = {
    'LA LUZ': { DQO_influent: 850, DQO_effluent: 110, pH_influent: 7.1, pH_effluent: 7.3, SS_influent: 420, SS_effluent: 70 },
    'TAURA': { DQO_influent: 920, DQO_effluent: 125, pH_influent: 7.0, pH_effluent: 7.4, SS_influent: 480, SS_effluent: 80 },
    'SANTA MONICA': { DQO_influent: 780, DQO_effluent: 95, pH_influent: 7.2, pH_effluent: 7.2, SS_influent: 390, SS_effluent: 65 },
    'SAN DIEGO': { DQO_influent: 950, DQO_effluent: 130, pH_influent: 6.9, pH_effluent: 7.5, SS_influent: 510, SS_effluent: 85 },
    'CHANDUY': { DQO_influent: 810, DQO_effluent: 105, pH_influent: 7.1, pH_effluent: 7.3, SS_influent: 430, SS_effluent: 75 },
    'TEXTILES': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
    'TPI': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
    'TROPACK BIOSEM 1': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
    'TROPACK BIOSEM 2': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
    'TROPACK INDUSTRIAL': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
    'TROPACK TILAPIA': { DQO_influent: 2500, DQO_effluent: 180, pH_influent: 7.0, pH_effluent: 7.0, SS_influent: 600, SS_effluent: 90 },
  }

  const envData: any[] = []
  const now = new Date()
  const months = 12

  plants.forEach(plant => {
    const base = baseValues[plant.name]
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(now.getMonth() - i)
      date.setDate(15)
      const season = Math.sin((12 - i) / 12 * Math.PI * 2)
      const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 100) / 100

      // DQO
      envData.push({
        id: `${plant.id}-DQO-influent-${i}`,
        plant_id: plant.id,
        parameter_type: 'DQO',
        value: Math.round((base.DQO_influent + season * 80 + rand(-50, 50)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'influent'
      })
      envData.push({
        id: `${plant.id}-DQO-effluent-${i}`,
        plant_id: plant.id,
        parameter_type: 'DQO',
        value: Math.round((base.DQO_effluent + season * 15 + rand(-8, 8)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'effluent'
      })

      // pH
      envData.push({
        id: `${plant.id}-pH-influent-${i}`,
        plant_id: plant.id,
        parameter_type: 'pH',
        value: Math.round((base.pH_influent + season * 0.2 + rand(-0.3, 0.3)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: '',
        stream: 'influent'
      })
      envData.push({
        id: `${plant.id}-pH-effluent-${i}`,
        plant_id: plant.id,
        parameter_type: 'pH',
        value: Math.round((base.pH_effluent + season * 0.15 + rand(-0.25, 0.25)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: '',
        stream: 'effluent'
      })

      // SS
      envData.push({
        id: `${plant.id}-SS-influent-${i}`,
        plant_id: plant.id,
        parameter_type: 'SS',
        value: Math.round((base.SS_influent + season * 60 + rand(-30, 30)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'influent'
      })
      envData.push({
        id: `${plant.id}-SS-effluent-${i}`,
        plant_id: plant.id,
        parameter_type: 'SS',
        value: Math.round((base.SS_effluent + season * 10 + rand(-6, 6)) * 100) / 100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'effluent'
      })
    }
  })

  const insertManyEnv = db.transaction((data: any[]) => {
    for (const row of data) {
      insertEnvData.run(row.id, row.plant_id, row.parameter_type, row.value, row.measurement_date, row.unit, row.stream)
    }
  })

  insertManyEnv(envData)

  // Insert demo emergencies
  const insertEmergency = db.prepare(`
    INSERT INTO maintenance_emergencies (id, plant_id, reason, solved, resolve_time_hours, reported_at, severity, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const emergencies = [
    {
      id: 'emerg-1',
      plant_id: '33333333-3333-3333-3333-333333333333',
      reason: 'Fallo en bomba de lodos',
      solved: 1,
      resolve_time_hours: 4,
      reported_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      severity: 'high',
      observations: 'Se reemplazó el motor de la bomba'
    },
    {
      id: 'emerg-2',
      plant_id: '44444444-4444-4444-4444-444444444444',
      reason: 'Obstrucción en filtro primario',
      solved: 1,
      resolve_time_hours: 2,
      reported_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      severity: 'medium',
      observations: 'Limpieza manual realizada'
    },
    {
      id: 'emerg-3',
      plant_id: '55555555-5555-5555-5555-555555555555',
      reason: 'Niveles altos de DQO en efluente',
      solved: 0,
      resolve_time_hours: null,
      reported_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      severity: 'high',
      observations: 'En investigación, ajustando aireación'
    }
  ]

  for (const emerg of emergencies) {
    insertEmergency.run(emerg.id, emerg.plant_id, emerg.reason, emerg.solved, emerg.resolve_time_hours, emerg.reported_at, emerg.severity, emerg.observations)
  }

  // Insert demo maintenance tasks
  const insertMaintenanceTask = db.prepare(`
    INSERT INTO maintenance_tasks (id, plant_id, task_type, description, scheduled_date, completed_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const maintenanceTasks: any[] = []
  const currentYear = new Date().getFullYear()

  plants.forEach(plant => {
    // Una tarea por planta para el año actual
    maintenanceTasks.push({
      id: `maint-${plant.id}-${currentYear}`,
      plant_id: plant.id,
      task_type: 'general',
      description: 'Mantenimiento completo',
      scheduled_date: new Date(currentYear, 6, 1).toISOString(), // 1 de julio
      completed_date: null,
      status: 'pending'
    })
  })

  for (const task of maintenanceTasks) {
    insertMaintenanceTask.run(task.id, task.plant_id, task.task_type, task.description, task.scheduled_date, task.completed_date, task.status)
  }

  // Insert demo OPEX costs data
  const insertOpex = db.prepare(`
    INSERT INTO opex_costs (id, plant_id, period_date, volume_m3, cost_agua, cost_personal, cost_mantenimiento, cost_energia, cost_floculante, cost_coagulante, cost_estabilizador_ph, cost_dap, cost_urea, cost_melaza, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Base OPEX values per plant (realistic variation)
  const opexBaseValues: Record<string, any> = {
    'LA LUZ': { volume: 1500, agua: 120, personal: 850, mant: 200, energia: 450, floc: 50, coag: 45, ph: 30, dap: 25, urea: 20, melaza: 15 },
    'TAURA': { volume: 2200, agua: 180, personal: 1200, mant: 350, energia: 680, floc: 75, coag: 68, ph: 45, dap: 38, urea: 32, melaza: 22 },
    'SANTA MONICA': { volume: 1100, agua: 95, personal: 680, mant: 160, energia: 380, floc: 42, coag: 38, ph: 25, dap: 20, urea: 16, melaza: 12 },
    'SAN DIEGO': { volume: 1800, agua: 150, personal: 950, mant: 280, energia: 550, floc: 62, coag: 56, ph: 38, dap: 32, urea: 26, melaza: 18 },
    'CHANDUY': { volume: 900, agua: 75, personal: 520, mant: 120, energia: 290, floc: 32, coag: 28, ph: 18, dap: 15, urea: 12, melaza: 9 },
    'TEXTILES': { volume: 3500, agua: 280, personal: 1800, mant: 520, energia: 980, floc: 110, coag: 95, ph: 65, dap: 55, urea: 45, melaza: 35 },
    'TPI': { volume: 2800, agua: 220, personal: 1450, mant: 420, energia: 780, floc: 88, coag: 78, ph: 52, dap: 44, urea: 36, melaza: 28 },
    'TROPACK BIOSEM 1': { volume: 1600, agua: 130, personal: 900, mant: 220, energia: 480, floc: 55, coag: 48, ph: 32, dap: 28, urea: 22, melaza: 16 },
    'TROPACK BIOSEM 2': { volume: 1400, agua: 115, personal: 780, mant: 190, energia: 420, floc: 48, coag: 42, ph: 28, dap: 24, urea: 18, melaza: 14 },
    'TROPACK INDUSTRIAL': { volume: 4200, agua: 340, personal: 2200, mant: 620, energia: 1150, floc: 135, coag: 115, ph: 78, dap: 65, urea: 55, melaza: 42 },
    'TROPACK TILAPIA': { volume: 1200, agua: 100, personal: 720, mant: 175, energia: 360, floc: 40, coag: 36, ph: 24, dap: 20, urea: 16, melaza: 12 },
  }

  const opexData: any[] = []
  const opexMonths = 12 // 12 months of OPEX data

  plants.forEach(plant => {
    const base = opexBaseValues[plant.name]
    if (!base) return

    for (let i = opexMonths - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(now.getMonth() - i)
      const periodDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`

      // Add seasonal and random variation
      const seasonFactor = 1 + Math.sin((12 - i) / 12 * Math.PI * 2) * 0.15
      const randFactor = () => 0.9 + Math.random() * 0.2 // 0.9 to 1.1

      opexData.push({
        id: `opex-${plant.id}-${periodDate}`,
        plant_id: plant.id,
        period_date: periodDate,
        volume_m3: Math.round(base.volume * seasonFactor * randFactor()),
        cost_agua: Math.round(base.agua * seasonFactor * randFactor() * 100) / 100,
        cost_personal: Math.round(base.personal * randFactor() * 100) / 100,
        cost_mantenimiento: Math.round(base.mant * randFactor() * 100) / 100,
        cost_energia: Math.round(base.energia * seasonFactor * randFactor() * 100) / 100,
        cost_floculante: Math.round(base.floc * seasonFactor * randFactor() * 100) / 100,
        cost_coagulante: Math.round(base.coag * seasonFactor * randFactor() * 100) / 100,
        cost_estabilizador_ph: Math.round(base.ph * randFactor() * 100) / 100,
        cost_dap: Math.round(base.dap * randFactor() * 100) / 100,
        cost_urea: Math.round(base.urea * randFactor() * 100) / 100,
        cost_melaza: Math.round(base.melaza * randFactor() * 100) / 100,
        notes: i === 0 ? 'Mes actual' : null
      })
    }
  })

  const insertManyOpex = db.transaction((data: any[]) => {
    for (const row of data) {
      insertOpex.run(
        row.id, row.plant_id, row.period_date, row.volume_m3,
        row.cost_agua, row.cost_personal, row.cost_mantenimiento, row.cost_energia,
        row.cost_floculante, row.cost_coagulante, row.cost_estabilizador_ph,
        row.cost_dap, row.cost_urea, row.cost_melaza, row.notes
      )
    }
  })

  insertManyOpex(opexData)

  // Seed Tropack Industrial equipment from maintenance plan
  const tropackIndustrialId = '88888888-8888-8888-8888-888888888885'

  const insertEquipment = db.prepare(`
    INSERT INTO equipment (id, plant_id, item_code, description, reference, location, quantity, category, daily_check, monthly_check, quarterly_check, biannual_check, annual_check, time_based_reference, spare_parts, extras)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const equipmentData = [
    // DIFUSORES
    {
      id: 'equip-di01',
      item_code: 'DI01',
      description: 'DIFUSORES TUBULARES TIPO MAGNUM 1000. REACTOR MBBR 1. MARCA OTT',
      reference: 'T02',
      location: 'Reactor MBBR 1',
      quantity: 336,
      category: 'difusores',
      daily_check: 'Control visual de aireación homogenea y lodo activo',
      monthly_check: null,
      quarterly_check: null,
      biannual_check: null,
      annual_check: 'Control de estado en general',
      time_based_reference: 'Reemplazar elementos en caso de daño o cada 6-7 años',
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-di02',
      item_code: 'DI02',
      description: 'DIFUSORES TUBULARES TIPO MAGNUM 2000. REACTOR MBBR 2. MARCA OTT',
      reference: 'T03',
      location: 'Reactor MBBR 2',
      quantity: 216,
      category: 'difusores',
      daily_check: 'Control visual de aireación homogenea y lodo activo',
      monthly_check: null,
      quarterly_check: null,
      biannual_check: null,
      annual_check: 'Control de estado en general',
      time_based_reference: 'Reemplazar elementos en caso de daño o cada 6-7 años',
      spare_parts: null,
      extras: null
    },
    // DUCTO
    {
      id: 'equip-du01',
      item_code: 'DU01',
      description: 'DUCTO DE DECANTACIÓN FORZADA EN DECANTADOR SECUNDARIO',
      reference: 'T04',
      location: 'Decantador Secundario',
      quantity: 1,
      category: 'ductos',
      daily_check: 'Inspección visual, posición',
      monthly_check: 'Control de niveles del agua, suciedades, estado soportes',
      quarterly_check: null,
      biannual_check: 'Control de estado y ajustes',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    // CUADRO ELECTRICO
    {
      id: 'equip-e01',
      item_code: 'E01',
      description: 'CUADRO ELECTRICO PTARI',
      reference: 'Fuerza y control',
      location: 'Área de Control',
      quantity: 1,
      category: 'cuadro_electrico',
      daily_check: 'Inspección visual, buen funcionamiento, Temperaturas',
      monthly_check: 'Limpieza interna y externa (polvo y suciedades)',
      quarterly_check: 'Ajuste de elementos y controles en general',
      biannual_check: null,
      annual_check: 'Control de apriete de tornillos en borneras y elementos. Spray de conductividad',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    // LAMELAS
    {
      id: 'equip-la01',
      item_code: 'LA01/1-25',
      description: 'LAMELAS EN DECANTADOR SECUNDARIO',
      reference: 'T04',
      location: 'Decantador Secundario',
      quantity: 25,
      category: 'lamelas',
      daily_check: 'Inspección visual, posición, estado del agua',
      monthly_check: null,
      quarterly_check: 'Controlar elementos de antiflotación y ubicación de estos y lamelas',
      biannual_check: null,
      annual_check: 'Control de estado, limpieza general',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    // MOTORES/BOMBAS
    {
      id: 'equip-m01',
      item_code: 'M01/1-2',
      description: 'BOMBAS SUMERGIBLES EN TANQUE DE HOMOGENIZACIÓN. MARCA: FAGGIOLATI, G409H1M1-M65AA0; 2.8 KW',
      reference: 'T01',
      location: 'Tanque de Homogenización',
      quantity: 2,
      category: 'motores',
      daily_check: 'Inspección visual de correcto funcionamiento',
      monthly_check: null,
      quarterly_check: 'Levantamiento o inspección del equipo, limpieza de ser necesario',
      biannual_check: null,
      annual_check: 'Cambio de aceite, estado de tubo guia, cadena, equipo, conexiones eléctricas y elementos en general',
      time_based_reference: 'Cada 3 años realizar un mantenimiento completo al equipo',
      spare_parts: 'aceite tipo: Diekan 1640 o similar',
      extras: 'Cantidad aceite: 0,33 Lts'
    },
    {
      id: 'equip-m02',
      item_code: 'M02',
      description: 'BOMBA SUMERGIBLES EN DECANTADOR SECUNDARIO: RECIRCULACIÓN/EXTRACCIÓN. MARCA: FAGGIOLATI, G409H1M1-M65AA0; 2.8 KW',
      reference: 'T04',
      location: 'Decantador Secundario',
      quantity: 1,
      category: 'motores',
      daily_check: 'Inspección visual de correcto funcionamiento',
      monthly_check: null,
      quarterly_check: 'Levantamiento o inspección del equipo, limpieza de ser necesario',
      biannual_check: null,
      annual_check: 'Cambio de aceite, estado de tubo guia, cadena, equipo, conexiones eléctricas y elementos en general',
      time_based_reference: 'Cada 3 años realizar un mantenimiento completo al equipo',
      spare_parts: 'aceite tipo: Diekan 1640 o similar',
      extras: 'Cantidad aceite: 0,33 Lts'
    },
    {
      id: 'equip-m03',
      item_code: 'M03/1-3',
      description: 'SOPLANTES DE ÉMBOLOS ROTATIVOS MARCA MAPNER. TIPO SEM.60; 110 KW',
      reference: 'AREA DE BLOWERS',
      location: 'Área de Blowers',
      quantity: 3,
      category: 'motores',
      daily_check: 'Control de funcionamiento, presión, fugas, sonido. Purgar posibles condensados en las valvulas del manifold',
      monthly_check: 'Control de temperatura en descarga, nivel y color de aceite',
      quarterly_check: 'Limpieza general, incluye filtro de aspiración, lubricación de rodamientos',
      biannual_check: 'Control de tension de banda, alineación de poleas, cambio de filtro de aspiración',
      annual_check: 'Cambio de aceite, limpieza de valvulas de retención. Inspección de estado general del equipo. Cambiar elemento filtrante. Sustituir las correas de transmisión.',
      time_based_reference: 'Cada 3-4 años realizar mantenimiento completo al equipo incluyendo motor',
      spare_parts: 'Usar aceite sintetico Meropa 220 o similar. En el manual del equipo indica las cantidades para cada carter del blower. Cada blower cuenta con 2 cárters.',
      extras: 'Cantidad de aceite aproximada para cada blower (2 cárters): 17 litros. Llenar hasta media mirilla sería lo ideal'
    },
    {
      id: 'equip-m04',
      item_code: 'M04',
      description: 'AGITADOR DE SUPERFICIE. MEZCLADOR VERTICAL DE LODOS. MARCA: SCM; MX VER 1.5 3T',
      reference: 'T05',
      location: 'Tanque de Lodos',
      quantity: 1,
      category: 'motores',
      daily_check: 'Control de funcionamiento, sonido, fugas de aceite',
      monthly_check: 'Control de temperaturas y consumo',
      quarterly_check: null,
      biannual_check: 'Cambio de aceite, limpieza, ajustes',
      annual_check: 'Control de estado en general',
      time_based_reference: 'Cada 3-4 años realizar mantenimiento completo al equipo',
      spare_parts: 'Usar aceite sintético tipo ISO VG 320, como meropa o similar.',
      extras: 'Llenar hasta media mirilla con el motor en su posicicón vertical de trabajo.'
    },
    // SENSORES
    {
      id: 'equip-s01',
      item_code: 'S01',
      description: 'SENSOR DE NIVEL TIPO RADAR EN TANQUE HOMOGENIZACIÓN. MARCA: ENDRESS HAUSER, TIPO FMR-20',
      reference: 'T01',
      location: 'Tanque de Homogenización',
      quantity: 1,
      category: 'sensores',
      daily_check: 'Inspección visual de correcta ubicación y medida y buen funcionamiento',
      monthly_check: 'limpieza',
      quarterly_check: 'Control de estado del cable y conexiones + soportería del mismo',
      biannual_check: null,
      annual_check: 'Contoles y ajustes generales. Control de estado',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-s02',
      item_code: 'S02',
      description: 'SENSOR DE OXÍGENO DISUELTO EN REACTOR MBBR 2. MARCA ENDRESS HAUSER. TIPO: COS51D-AS810',
      reference: 'T03',
      location: 'Reactor MBBR 2',
      quantity: 1,
      category: 'sensores',
      daily_check: 'Inspección visual de correcta ubicación y medida y buen funcionamiento',
      monthly_check: 'limpieza del elemento de ser necesario',
      quarterly_check: 'Control de estado del cable y conexiones + soportería del mismo',
      biannual_check: null,
      annual_check: 'Contoles y ajustes generales. Control de estado',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    // TANQUES
    {
      id: 'equip-t01',
      item_code: 'T01',
      description: 'TANQUE DE HOMOGENIZACIÓN (CLIENTE)',
      reference: 'METÁLICO EXISTENTE',
      location: 'Área de Pretratamiento',
      quantity: 1,
      category: 'tanques',
      daily_check: 'Inspección visual del agua: color y olor fuera de lo normal. Control de niveles',
      monthly_check: 'Control de correcta ubicación de elementos y buen funcionamiento del sistema',
      quarterly_check: 'Control de estado en zona de purgas y pasantes, posibles fallos o fugas',
      biannual_check: 'Control de estado en general',
      annual_check: 'Limpieza general del tanque, Aplica pintura de ser necesario',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-t02',
      item_code: 'T02',
      description: 'REACTOR BIOLÓGICO MBBR 1',
      reference: 'PEQUEÑO',
      location: 'Área de Tratamiento Biológico',
      quantity: 1,
      category: 'tanques',
      daily_check: 'Inspección visual: correcta aireación, nivel y lodo activo, elementos mbbr',
      monthly_check: null,
      quarterly_check: 'Control de estado en zona de purgas y pasantes, posibles fallos o fugas',
      biannual_check: null,
      annual_check: 'Control de estado en general y ajustes necesarios',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-t03',
      item_code: 'T03',
      description: 'REACTOR BIOLÓGICO MBBR 2',
      reference: 'GRANDE',
      location: 'Área de Tratamiento Biológico',
      quantity: 1,
      category: 'tanques',
      daily_check: 'Inspección visual: correcta aireación, nivel y lodo activo, elementos mbbr',
      monthly_check: null,
      quarterly_check: 'Control de estado en zona de purgas y pasantes, posibles fallos o fugas',
      biannual_check: null,
      annual_check: 'Control de estado en general y ajustes necesarios',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-t04',
      item_code: 'T04',
      description: 'DECANTADOR SECUNDARIO LAMELAR',
      reference: 'CLARIFICADOR',
      location: 'Área de Sedimentación',
      quantity: 1,
      category: 'tanques',
      daily_check: 'Inspección visual: salida de agua clara, presencia de lodos flotantes',
      monthly_check: 'Comprobar nivel de fangos, pesados y flotantes',
      quarterly_check: 'Limpieza de paredes o elementos de ser necesario',
      biannual_check: null,
      annual_check: 'Control de estado en general',
      time_based_reference: 'Retirar fangos flotantes en caso de encontrarlos',
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-t05',
      item_code: 'T05',
      description: 'TANQUE DE LODOS',
      reference: 'LODOS EXTRAIDOS',
      location: 'Área de Lodos',
      quantity: 1,
      category: 'tanques',
      daily_check: 'Control de nivel, correcta agitación',
      monthly_check: null,
      quarterly_check: 'Limpieza de ser necesario',
      biannual_check: null,
      annual_check: 'Control de estado en general',
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    // VALVULERIA
    {
      id: 'equip-v01',
      item_code: 'V01/1-2',
      description: 'VÁLVULAS DE BOLA EN TANQUE DE HOMOGENIZACIÓN',
      reference: 'T01',
      location: 'Tanque de Homogenización',
      quantity: 2,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-v02',
      item_code: 'V02/1-3',
      description: 'VÁLVULAS DE BOLA EN REACTOR MBBR 1',
      reference: 'T02',
      location: 'Reactor MBBR 1',
      quantity: 3,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-v03',
      item_code: 'V03/1-3',
      description: 'VÁLVULAS DE BOLA EN REACTOR MBBR 2',
      reference: 'T03',
      location: 'Reactor MBBR 2',
      quantity: 3,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-v04',
      item_code: 'V04/1-3',
      description: 'VÁLVULAS DE BOLA EN DECANTADOR SECUNDARIO',
      reference: 'T04',
      location: 'Decantador Secundario',
      quantity: 3,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-v05',
      item_code: 'V05/1-3',
      description: 'VÁLVULAS DE BOLA EN TANQUE DE LODOS',
      reference: 'T05',
      location: 'Tanque de Lodos',
      quantity: 3,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    },
    {
      id: 'equip-v06',
      item_code: 'V06/1-7',
      description: 'VÁLVULAS EN ÁREA DE BLOWERS',
      reference: 'AREA DE BLOWERS',
      location: 'Área de Blowers',
      quantity: 7,
      category: 'valvulas',
      daily_check: 'Inspección visual de correcta posición (abierta/cerrada)',
      monthly_check: null,
      quarterly_check: 'Accionamiento de válvulas',
      biannual_check: 'Control de estado en general. Engrasado en caso de requerirlo',
      annual_check: null,
      time_based_reference: null,
      spare_parts: null,
      extras: null
    }
  ]

  const insertManyEquipment = db.transaction((data: any[]) => {
    for (const equip of data) {
      insertEquipment.run(
        equip.id, tropackIndustrialId, equip.item_code, equip.description, equip.reference, equip.location,
        equip.quantity, equip.category, equip.daily_check, equip.monthly_check, equip.quarterly_check,
        equip.biannual_check, equip.annual_check, equip.time_based_reference, equip.spare_parts, equip.extras
      )
    }
  })

  insertManyEquipment(equipmentData)

  console.log(`[database] Seeded ${plants.length} plants, ${envData.length} environmental records, ${emergencies.length} emergencies, ${maintenanceTasks.length} maintenance tasks, ${opexData.length} OPEX records, ${equipmentData.length} equipment items`)
}

/**
 * Create additional tables (notification, checklist, dashboard)
 */
export function createAdditionalTables() {
  // Notification settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      maintenance_reminders INTEGER NOT NULL DEFAULT 1,
      parameter_alerts INTEGER NOT NULL DEFAULT 1,
      emergency_alerts INTEGER NOT NULL DEFAULT 1,
      reminder_days INTEGER NOT NULL DEFAULT 45,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Daily checklist table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_checklists (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      completed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      UNIQUE(plant_id, check_date)
    );
  `)

  // Daily checklist items table (with red flag support for mobile app)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL,
      equipment_id TEXT,
      template_item_id TEXT,
      item_description TEXT NOT NULL,
      category TEXT NOT NULL,
      section TEXT,
      is_checked INTEGER NOT NULL DEFAULT 0,
      is_red_flag INTEGER NOT NULL DEFAULT 0,
      red_flag_comment TEXT,
      numeric_value REAL,
      unit TEXT,
      observation TEXT,
      photo_path TEXT,
      checked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (checklist_id) REFERENCES daily_checklists(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
    );
  `)

  // Create indexes for checklist tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_checklist_plant ON daily_checklists(plant_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_date ON daily_checklists(check_date);
    CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON daily_checklist_items(checklist_id);
  `)

  // Migration: Add missing columns to daily_checklist_items if they don't exist
  // This is needed for existing databases that were created before these columns were added
  try {
    const tableInfo = db.prepare("PRAGMA table_info(daily_checklist_items)").all() as { name: string }[]
    const existingColumns = tableInfo.map(col => col.name)

    const columnsToAdd = [
      { name: 'section', type: 'TEXT' },
      { name: 'is_red_flag', type: 'INTEGER NOT NULL DEFAULT 0' },
      { name: 'red_flag_comment', type: 'TEXT' },
      { name: 'numeric_value', type: 'REAL' },
      { name: 'unit', type: 'TEXT' },
      { name: 'observation', type: 'TEXT' },
      { name: 'photo_path', type: 'TEXT' },
      { name: 'checked_at', type: 'TEXT' },
      { name: 'template_item_id', type: 'TEXT' },
    ]

    for (const col of columnsToAdd) {
      if (!existingColumns.includes(col.name)) {
        console.log(`[database] Adding missing column: daily_checklist_items.${col.name}`)
        db.exec(`ALTER TABLE daily_checklist_items ADD COLUMN ${col.name} ${col.type}`)
      }
    }
  } catch (e) {
    // Table might not exist yet, that's OK
    console.log('[database] daily_checklist_items migration check skipped (table may not exist yet)')
  }

  // Migration: Add operator columns to maintenance_emergencies if they don't exist
  // This supports emergency reports from mobile app operators
  try {
    const emergencyTableInfo = db.prepare("PRAGMA table_info(maintenance_emergencies)").all() as { name: string }[]
    const existingEmergencyColumns = emergencyTableInfo.map(col => col.name)

    const emergencyColumnsToAdd = [
      { name: 'operator_id', type: 'TEXT' },
      { name: 'operator_name', type: 'TEXT' },
      { name: 'location_description', type: 'TEXT' },
      { name: 'photo_path', type: 'TEXT' },
      { name: 'source', type: 'TEXT DEFAULT \'admin\'' }, // 'admin' or 'mobile'
      { name: 'email_sent', type: 'INTEGER DEFAULT 0' },
      { name: 'acknowledged_at', type: 'TEXT' },
      { name: 'acknowledged_by', type: 'TEXT' },
      { name: 'resolved_by', type: 'TEXT' }, // Who resolved the emergency
    ]

    for (const col of emergencyColumnsToAdd) {
      if (!existingEmergencyColumns.includes(col.name)) {
        console.log(`[database] Adding missing column: maintenance_emergencies.${col.name}`)
        db.exec(`ALTER TABLE maintenance_emergencies ADD COLUMN ${col.name} ${col.type}`)
      }
    }
  } catch (e) {
    console.log('[database] maintenance_emergencies migration check skipped (table may not exist yet)')
  }

  // User dashboard widgets table (for personalization)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_dashboard_widgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      widget_type TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      config TEXT,
      is_visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, widget_type)
    );
  `)

  // Create index for user widgets
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_widgets_user ON user_dashboard_widgets(user_id);
  `)

  // Checklist templates table (based on Tropack Excel document)
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      template_name TEXT NOT NULL,
      template_code TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      UNIQUE(plant_id, template_code)
    );
  `)

  // Checklist template items (the individual checks)
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_template_items (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      section TEXT NOT NULL,
      element TEXT NOT NULL,
      activity TEXT NOT NULL,
      requires_value INTEGER NOT NULL DEFAULT 0,
      value_unit TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for checklist templates
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_template_plant ON checklist_templates(plant_id);
    CREATE INDEX IF NOT EXISTS idx_template_items_template ON checklist_template_items(template_id);
  `)

  // Supervisor reports (when operator sends completed checklist)
  db.exec(`
    CREATE TABLE IF NOT EXISTS supervisor_reports (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      report_date TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 0,
      checked_items INTEGER NOT NULL DEFAULT 0,
      red_flag_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT,
      read_by TEXT,
      FOREIGN KEY (checklist_id) REFERENCES daily_checklists(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for supervisor reports
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_report_checklist ON supervisor_reports(checklist_id);
    CREATE INDEX IF NOT EXISTS idx_report_plant ON supervisor_reports(plant_id);
    CREATE INDEX IF NOT EXISTS idx_report_date ON supervisor_reports(report_date);
    CREATE INDEX IF NOT EXISTS idx_report_operator ON supervisor_reports(operator_id);
    CREATE INDEX IF NOT EXISTS idx_report_read ON supervisor_reports(read_at);
  `)

  // Red flag history (detailed log of red flags for analytics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS red_flag_history (
      id TEXT PRIMARY KEY,
      checklist_item_id TEXT NOT NULL,
      checklist_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      section TEXT NOT NULL,
      element TEXT NOT NULL,
      activity TEXT NOT NULL,
      comment TEXT,
      photo_path TEXT,
      flagged_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_notes TEXT,
      FOREIGN KEY (checklist_item_id) REFERENCES daily_checklist_items(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_id) REFERENCES daily_checklists(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    );
  `)

  // Create indexes for red flag history
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_redflag_checklist ON red_flag_history(checklist_id);
    CREATE INDEX IF NOT EXISTS idx_redflag_plant ON red_flag_history(plant_id);
    CREATE INDEX IF NOT EXISTS idx_redflag_date ON red_flag_history(flagged_at);
    CREATE INDEX IF NOT EXISTS idx_redflag_resolved ON red_flag_history(resolved_at);
  `)

  console.log('[database] Additional tables created successfully')
}

/**
 * Seed checklist templates based on Tropack Excel document
 */
export function seedChecklistTemplates() {
  console.log('[database] Seeding checklist templates...')

  // Check if templates already exist
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM checklist_templates').get() as { count: number }
  if (templateCount.count > 0) {
    console.log('[database] Checklist templates already seeded, skipping...')
    return
  }

  const tropackIndustrialId = '88888888-8888-8888-8888-888888888885'

  // Insert templates
  const insertTemplate = db.prepare(`
    INSERT INTO checklist_templates (id, plant_id, template_name, template_code, description)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertTemplateItem = db.prepare(`
    INSERT INTO checklist_template_items (id, template_id, section, element, activity, requires_value, value_unit, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Template 1: Pozo de Bombeo (PROC-ACT-001)
  const template1Id = 'template-pozo-bombeo'
  insertTemplate.run(
    template1Id,
    tropackIndustrialId,
    'Check List Operativo Pozo de Bombeo',
    'PROC-ACT-001',
    'Checklist operativo diario para el pozo de bombeo de la PTAR Tropack'
  )

  const pozoBombeoItems = [
    // Cámara de Canastilla
    { section: 'pozo_bombeo', element: 'Cámara de Canastilla', activity: 'Verificar el nivel de agua en la cámara (Evitar rebose)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Canastilla', activity: 'Verificar que la canastilla no esté saturada de sólidos', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Canastilla', activity: 'Verificar estado de cadenas de izaje (Corrosión, colmatación)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Canastilla', activity: 'Verificar estado de estructura para izaje (Corrosión, deformación)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Canastilla', activity: 'Verificar anclaje y sujeción de elementos', requires_value: 0 },
    // Cámara de Bombas
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar el nivel de agua en la cámara (Evitar rebose)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar que la cámara no esté saturada de sólidos', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar estado y niveles de boyas (Niveles, deformación, fisuras)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar estado de cadenas y tubos guías (Corrosión, colmatación)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar estado de cableado de equipos (Bombas / Boyas)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar anclaje y sujeción (Bombas/Boyas/Tuberías)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar estado de conexiones hidráulicas (Evitar fugas)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar que no haya ruidos y vibraciones anormales', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar encendido y apagado de bombas de acuerdo a nivel', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar alternancia de bombas', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Bombas', activity: 'Verificar que no haya alarmas en el tablero (Correcto automatismo)', requires_value: 0 },
    // Cámara de Válvulas
    { section: 'pozo_bombeo', element: 'Cámara de Válvulas', activity: 'Verificar que la válvula de compuerta esté abierta', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Válvulas', activity: 'Verificar que no haya retorno de flujo (válvula check)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Válvulas', activity: 'Verificar que las juntas bridadas estén bien ajustadas y completas', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Válvulas', activity: 'Verificar estado de conexiones hidráulicas (Evitar fugas)', requires_value: 0 },
    { section: 'pozo_bombeo', element: 'Cámara de Válvulas', activity: 'Verificar que no haya ruidos y vibraciones anormales (Cavitación)', requires_value: 0 },
  ]

  pozoBombeoItems.forEach((item, index) => {
    insertTemplateItem.run(
      `item-${template1Id}-${index}`,
      template1Id,
      item.section,
      item.element,
      item.activity,
      item.requires_value,
      null,
      index
    )
  })

  // Template 2: Proceso de Tratamiento (PROC-ACT-002)
  const template2Id = 'template-proceso-tratamiento'
  insertTemplate.run(
    template2Id,
    tropackIndustrialId,
    'Check List Operativo Planta de Tratamiento',
    'PROC-ACT-002',
    'Checklist operativo diario para la planta de tratamiento PTAR Tropack'
  )

  const procesoTratamientoItems = [
    // Canal de Tamizado
    { section: 'pretratamiento', element: 'Canal de Tamizado', activity: 'Verificar que el canal no esté saturado de sólidos (Limpieza)', requires_value: 0 },
    { section: 'pretratamiento', element: 'Canal de Tamizado', activity: 'Verificar estado de tornillo tamiz (Corrosión, colmatación, deformación)', requires_value: 0 },
    // Laguna de Homogeneización
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar el pH en la laguna (indicar hora del día)', requires_value: 1, value_unit: 'pH' },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar el tiempo de encendido de los aireadores superficiales', requires_value: 1, value_unit: 'min' },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar el tiempo de apagado de los aireadores superficiales', requires_value: 1, value_unit: 'min' },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar correcto funcionamiento del aireador superficial 1', requires_value: 0 },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar anclaje y sujeción (aireador 1)', requires_value: 0 },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar correcto funcionamiento del aireador superficial 2', requires_value: 0 },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar anclaje y sujeción (aireador 2)', requires_value: 0 },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar que no haya ruidos y vibraciones anormales en los aireadores', requires_value: 0 },
    { section: 'homogeneizacion', element: 'Laguna de Homogeneización', activity: 'Verificar calidad del agua (color, SST, DQO)', requires_value: 0 },
    // Cámara de Bombeo 2
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Verificar el nivel seteado mínimo de agua en el tanque', requires_value: 1, value_unit: 'm' },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Verificar el nivel seteado máximo de agua en el tanque', requires_value: 1, value_unit: 'm' },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Verificar el nivel actual de agua en el tanque (indicar hora del día)', requires_value: 1, value_unit: 'm' },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Verificar que la cámara no esté saturada de sólidos flotantes', requires_value: 0 },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Verificar frecuencia seteada operativa de bombas', requires_value: 1, value_unit: 'Hz' },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Registrar caudal instantáneo máximo', requires_value: 1, value_unit: 'm³/h' },
    { section: 'bombeo', element: 'Cámara de Bombeo 2', activity: 'Registrar caudal diario', requires_value: 1, value_unit: 'm³/d' },
    // Cámara de distribución
    { section: 'distribucion', element: 'Cámara de distribución', activity: 'Verificar estado de válvula hacia reactor 1', requires_value: 0 },
    { section: 'distribucion', element: 'Cámara de distribución', activity: 'Registrar periodo de cierre de válvula hacia reactor 1', requires_value: 1, value_unit: 'min' },
    { section: 'distribucion', element: 'Cámara de distribución', activity: 'Verificar estado de válvula hacia reactor 2', requires_value: 0 },
    { section: 'distribucion', element: 'Cámara de distribución', activity: 'Verificar periodo de cierre de válvula hacia reactor 2', requires_value: 1, value_unit: 'min' },
    // Reactor Biológico 1
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar el nivel de agua en la laguna (borde libre)', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar sedimentabilidad de la biomasa (Pruebas Operacionales Imhoff)', requires_value: 1, value_unit: 'mL/L' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar sedimentabilidad diluida de la biomasa en caso de altos Ssed', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar calidad de la biomasa (color, olor, pH)', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar MLSS en el reactor (SST)', requires_value: 1, value_unit: 'mg/L' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar que la válvula de mariposa para recirculación esté 100% abierta', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Registrar horas de encendido de los aireadores', requires_value: 1, value_unit: 'h' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar que todos los aireadores se encienden', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar anclaje y sujeción (aireadores)', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar el nivel de oxígeno disuelto (>1 ppm, preferencia 2 ppm)', requires_value: 1, value_unit: 'ppm' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 1', activity: 'Verificar existencia de espuma o aceites en la superficie del reactor', requires_value: 0 },
    // Reactor Biológico 2 (same checks)
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar el nivel de agua en la laguna (borde libre)', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar sedimentabilidad de la biomasa (Pruebas Operacionales Imhoff)', requires_value: 1, value_unit: 'mL/L' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar calidad de la biomasa (color, olor, pH)', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar MLSS en el reactor (SST)', requires_value: 1, value_unit: 'mg/L' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar que la válvula de mariposa para recirculación esté 100% abierta', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Registrar horas de encendido de los aireadores', requires_value: 1, value_unit: 'h' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar que todos los aireadores se encienden', requires_value: 0 },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar el nivel de oxígeno disuelto (>1 ppm, preferencia 2 ppm)', requires_value: 1, value_unit: 'ppm' },
    { section: 'reactor_biologico', element: 'Reactor Biológico 2', activity: 'Verificar existencia de espuma o aceites en la superficie del reactor', requires_value: 0 },
    // Decantador Secundario 1
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar apertura de válvula de ingreso', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Registrar periodo de cierre de válvula hacia decantador', requires_value: 1, value_unit: 'min' },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar que no haya lodos flotantes (Purgar)', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar estado de cableado de equipos (Bombas)', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar que no haya retorno de lodos a la bomba (válvula check)', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar estado de las lamelas', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Realizar limpieza de lamelas', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar estado y limpieza de canal Thomson (Corrosión, colmatación)', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Verificar encendido y apagado de bomba', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 1', activity: 'Registrar horas de encendido de la bomba', requires_value: 1, value_unit: 'h' },
    // Decantador Secundario 2 (same checks)
    { section: 'decantacion', element: 'Decantador Secundario 2', activity: 'Verificar apertura de válvula de ingreso', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 2', activity: 'Verificar que no haya lodos flotantes (Purgar)', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 2', activity: 'Verificar estado de las lamelas', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 2', activity: 'Verificar encendido y apagado de bomba', requires_value: 0 },
    { section: 'decantacion', element: 'Decantador Secundario 2', activity: 'Registrar horas de encendido de la bomba', requires_value: 1, value_unit: 'h' },
    // Tanque de Lodos 1
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Registrar tiempo de encendido de bomba de lodos (horas de deshidratación)', requires_value: 1, value_unit: 'h' },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar el nivel de lodo en la cámara (Evitar rebose)', requires_value: 0 },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar calidad del lodo (SST)', requires_value: 1, value_unit: 'mg/L' },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar estado de base del mixer (Corrosión, colmatación)', requires_value: 0 },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar estado de cableado de equipos (mixer)', requires_value: 0 },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar que la válvula de bola al deshidratador esté abierta', requires_value: 0 },
    { section: 'lodos', element: 'Tanque de Lodos 1', activity: 'Verificar encendido y apagado de bomba de acuerdo a nivel', requires_value: 0 },
    // Tanque de Lodos 2
    { section: 'lodos', element: 'Tanque de Lodos 2', activity: 'Registrar tiempo de encendido de bomba de lodos', requires_value: 1, value_unit: 'h' },
    { section: 'lodos', element: 'Tanque de Lodos 2', activity: 'Verificar el nivel de lodo en la cámara (Evitar rebose)', requires_value: 0 },
    { section: 'lodos', element: 'Tanque de Lodos 2', activity: 'Verificar encendido y apagado de bomba de acuerdo a nivel', requires_value: 0 },
    // Cámara de Cloración
    { section: 'cloracion', element: 'Cámara de Cloración', activity: 'Verificar el nivel de producto químico en el tanque', requires_value: 0 },
    { section: 'cloracion', element: 'Cámara de Cloración', activity: 'Verificar estado de cableado de equipos (Bomba dosificadora)', requires_value: 0 },
    { section: 'cloracion', element: 'Cámara de Cloración', activity: 'Verificar funcionamiento de regulador de nivel mínimo', requires_value: 0 },
    { section: 'cloracion', element: 'Cámara de Cloración', activity: 'Verificar encendido y apagado de bomba dosificadora', requires_value: 0 },
    // Medidor de Caudal
    { section: 'efluente', element: 'Medidor de Caudal', activity: 'Verificar estado y limpieza de vertedero (Corrosión, deformación)', requires_value: 0 },
    { section: 'efluente', element: 'Medidor de Caudal', activity: 'Verificar nivel en vertedero (cumpla caudal de diseño)', requires_value: 0 },
    { section: 'efluente', element: 'Medidor de Caudal', activity: 'Verificar la concentración de cloro en el efluente', requires_value: 1, value_unit: 'mg/L' },
    { section: 'efluente', element: 'Medidor de Caudal', activity: 'Verificar calidad del agua (color, SST, DQO, pH)', requires_value: 0 },
    // Cuarto de Control
    { section: 'control', element: 'Cuarto de Control', activity: 'Verificar funcionamiento general del sistema de control', requires_value: 0 },
    { section: 'control', element: 'Cuarto de Control', activity: 'Verificar indicadores de línea de agua', requires_value: 0 },
    { section: 'control', element: 'Cuarto de Control', activity: 'Verificar indicadores de línea de lodos', requires_value: 0 },
    { section: 'control', element: 'Cuarto de Control', activity: 'Verificar estado de válvulas automatizadas', requires_value: 0 },
  ]

  procesoTratamientoItems.forEach((item, index) => {
    insertTemplateItem.run(
      `item-${template2Id}-${index}`,
      template2Id,
      item.section,
      item.element,
      item.activity,
      item.requires_value,
      item.requires_value ? (item as any).value_unit : null,
      index
    )
  })

  console.log(`[database] Seeded 2 checklist templates with ${pozoBombeoItems.length + procesoTratamientoItems.length} items`)
}

// Initialize database on module load
initializeDatabase()
seedDatabase()
createAdditionalTables()
seedChecklistTemplates()

export default db
