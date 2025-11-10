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

  console.log(`[database] Seeded ${plants.length} plants, ${envData.length} environmental records, ${emergencies.length} emergencies`)
}

// Initialize database on module load
initializeDatabase()
seedDatabase()

export default db
