/**
 * Multi-tenant SaaS Database Schema
 * All tables include organization_id for tenant isolation
 */
import Database, { type Database as DatabaseType } from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/saas.db')
export const db: DatabaseType = new Database(dbPath)

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDatabase() {
  // ======================
  // CORE SAAS TABLES
  // ======================

  // Organizations (tenants) - Only paid plans: starter and pro
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#0ea5e9',
      plan TEXT NOT NULL CHECK(plan IN ('starter', 'pro')) DEFAULT 'starter',
      status TEXT NOT NULL CHECK(status IN ('active', 'suspended', 'cancelled')) DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT CHECK(subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', NULL)),
      trial_ends_at TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      billing_email TEXT,
      settings TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Users (moved from JSON to database)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'supervisor', 'operator', 'viewer')),
      plant_id TEXT,
      avatar_url TEXT,
      email_verified INTEGER DEFAULT 0,
      last_login_at TEXT,
      refresh_token TEXT,
      refresh_token_expires_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'invited', 'suspended')) DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(organization_id, email)
    )
  `)

  // Add columns if they don't exist (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN refresh_token TEXT`)
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN refresh_token_expires_at TEXT`)
  } catch (e) { /* column already exists */ }

  // 2FA columns migration
  try {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0`)
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT`)
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_pending INTEGER DEFAULT 0`)
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN two_factor_recovery_codes TEXT`)
  } catch (e) { /* column already exists */ }

  // Migration: Add new organization columns
  try {
    db.exec(`ALTER TABLE organizations ADD COLUMN current_period_end TEXT`)
  } catch (e) { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE organizations ADD COLUMN cancel_at_period_end INTEGER DEFAULT 0`)
  } catch (e) { /* column already exists */ }

  // Migration: Add plant_types column (biosems, textiles, or both)
  try {
    db.exec(`ALTER TABLE organizations ADD COLUMN plant_types TEXT DEFAULT 'both' CHECK(plant_types IN ('biosems', 'textiles', 'both'))`)
  } catch (e) { /* column already exists */ }

  // Migration: Update old plan names to new ones
  try {
    db.exec(`UPDATE organizations SET plan = 'starter' WHERE plan IN ('free', 'professional')`)
    db.exec(`UPDATE organizations SET plan = 'pro' WHERE plan = 'enterprise'`)
  } catch (e) { /* migration already done */ }

  // Invitations
  db.exec(`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'supervisor', 'operator', 'viewer')),
      plant_id TEXT,
      token TEXT UNIQUE NOT NULL,
      invited_by TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (invited_by) REFERENCES users(id)
    )
  `)

  // API Keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      rate_limit INTEGER DEFAULT 1000,
      last_used_at TEXT,
      expires_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'revoked')) DEFAULT 'active',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // Webhooks
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      secret TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'failed')) DEFAULT 'active',
      failure_count INTEGER DEFAULT 0,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `)

  // Webhook Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    )
  `)

  // Audit Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `)

  // Subscription History
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL,
      stripe_invoice_id TEXT,
      plan TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `)

  // ======================
  // BUSINESS DATA TABLES (with organization_id)
  // ======================

  // Plants
  db.exec(`
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'maintenance')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `)

  // Environmental Data (analytics)
  db.exec(`
    CREATE TABLE IF NOT EXISTS environmental_data (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      date TEXT NOT NULL,
      parameter TEXT NOT NULL,
      stream TEXT NOT NULL CHECK(stream IN ('influent', 'effluent')),
      value REAL NOT NULL,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Maintenance Tasks
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      description TEXT,
      periodicity TEXT CHECK(periodicity IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
      last_completed TEXT,
      next_due TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'overdue', 'skipped')),
      assigned_to TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Maintenance Emergencies
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_emergencies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
      reported_by TEXT,
      reported_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Documents
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      category TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE SET NULL
    )
  `)

  // OPEX Costs
  db.exec(`
    CREATE TABLE IF NOT EXISTS opex_costs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      volume_m3 REAL,
      cost_per_m3 REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Equipment
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      description TEXT NOT NULL,
      reference TEXT,
      location TEXT,
      category TEXT,
      maintenance_frequency TEXT,
      last_maintenance TEXT,
      next_maintenance TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'maintenance', 'retired')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Equipment Maintenance Log
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_maintenance_log (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      maintenance_type TEXT CHECK(maintenance_type IN ('preventivo', 'correctivo')),
      operation TEXT,
      maintenance_date TEXT NOT NULL,
      description_averia TEXT,
      description_realizado TEXT,
      next_maintenance_date TEXT,
      operator_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
    )
  `)

  // Equipment Scheduled Maintenance
  db.exec(`
    CREATE TABLE IF NOT EXISTS equipment_scheduled_maintenance (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      frequency TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'overdue', 'skipped')),
      completed_date TEXT,
      completed_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
      UNIQUE(equipment_id, frequency, scheduled_date)
    )
  `)

  // Checklist Templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      UNIQUE(organization_id, plant_id, code)
    )
  `)

  // Checklist Template Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_template_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      section TEXT NOT NULL,
      element TEXT NOT NULL,
      activity TEXT NOT NULL,
      requires_value INTEGER DEFAULT 0,
      value_unit TEXT,
      min_value REAL,
      max_value REAL,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE
    )
  `)

  // Daily Checklists
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_checklists (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      checklist_date TEXT NOT NULL,
      shift TEXT,
      operator_name TEXT,
      supervisor_name TEXT,
      status TEXT DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'reviewed')),
      has_red_flags INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id) ON DELETE CASCADE,
      UNIQUE(organization_id, plant_id, template_id, checklist_date)
    )
  `)

  // Daily Checklist Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_checklist_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      checklist_id TEXT NOT NULL,
      template_item_id TEXT NOT NULL,
      is_checked INTEGER DEFAULT 0,
      value REAL,
      notes TEXT,
      photo_url TEXT,
      is_red_flag INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_id) REFERENCES daily_checklists(id) ON DELETE CASCADE,
      FOREIGN KEY (template_item_id) REFERENCES checklist_template_items(id) ON DELETE CASCADE
    )
  `)

  // Red Flag History
  db.exec(`
    CREATE TABLE IF NOT EXISTS red_flag_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      checklist_id TEXT NOT NULL,
      template_item_id TEXT NOT NULL,
      reason TEXT,
      flagged_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_notes TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_id) REFERENCES daily_checklists(id) ON DELETE CASCADE
    )
  `)

  // Tickets
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      ticket_number TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      category TEXT CHECK(category IN ('mantenimiento', 'repuestos', 'insumos', 'consulta', 'emergencia', 'otro')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
      requester_name TEXT,
      requester_email TEXT,
      requester_phone TEXT,
      assigned_to TEXT,
      sent_via_email INTEGER DEFAULT 0,
      sent_via_whatsapp INTEGER DEFAULT 0,
      email_sent_at TEXT,
      whatsapp_sent_at TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
    )
  `)

  // Ticket Comments
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_email TEXT,
      comment TEXT NOT NULL,
      is_internal INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `)

  // ======================
  // INDEXES
  // ======================

  // Organization indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status)`)

  // User indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_org_email ON users(organization_id, email)`)

  // Plant indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plants_org ON plants(organization_id)`)

  // Environmental data indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_env_org ON environmental_data(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_env_plant ON environmental_data(plant_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_env_date ON environmental_data(date)`)

  // Maintenance indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_maint_org ON maintenance_tasks(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_emerg_org ON maintenance_emergencies(organization_id)`)

  // Equipment indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_equip_org ON equipment(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_equip_sched_org ON equipment_scheduled_maintenance(organization_id)`)

  // Checklist indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chklist_org ON daily_checklists(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_chklist_date ON daily_checklists(checklist_date)`)

  // Ticket indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number)`)

  // API key indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_apikeys_org ON api_keys(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_apikeys_prefix ON api_keys(key_prefix)`)

  // Webhook indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id)`)

  // Audit log indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`)

  console.log('SaaS database initialized successfully')
}

// Initialize on import
initDatabase()

export default db
