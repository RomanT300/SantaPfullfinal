/**
 * Migration Script: Santa Priscila to SaaS
 * Migrates existing Santa Priscila data to the multi-tenant SaaS platform
 *
 * Usage: npx tsx scripts/migrate-santa-priscila.ts
 */
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// Paths
const ORIGINAL_DB_PATH = '../data/ptar.db'
const SAAS_DB_PATH = './data/ptar-saas.db'
const USERS_JSON_PATH = '../api/config/users.json'

// Organization ID for Santa Priscila
const SANTA_PRISCILA_ORG_ID = randomUUID()

console.log('🚀 Starting Santa Priscila to SaaS Migration')
console.log('=' .repeat(50))

// Hash password
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

async function migrate() {
  try {
    // Check if original database exists
    const originalDbPath = path.resolve(__dirname, ORIGINAL_DB_PATH)
    if (!fs.existsSync(originalDbPath)) {
      console.error(`❌ Original database not found at: ${originalDbPath}`)
      console.log('Please ensure the original PTAR database exists.')
      process.exit(1)
    }

    // Open databases
    const originalDb = new Database(originalDbPath, { readonly: true })
    const saasDb = new Database(path.resolve(__dirname, SAAS_DB_PATH))

    console.log('✓ Databases opened successfully')

    // Begin transaction
    saasDb.exec('BEGIN TRANSACTION')

    try {
      // 1. Create Santa Priscila organization
      console.log('\n📋 Creating Santa Priscila organization...')

      saasDb.prepare(`
        INSERT INTO organizations (id, name, slug, plan, status, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        SANTA_PRISCILA_ORG_ID,
        'Santa Priscila',
        'santa-priscila',
        'pro', // Changed from 'enterprise' - now only 'starter' and 'pro' plans
        'active',
        JSON.stringify({
          timezone: 'America/Guayaquil',
          language: 'es',
          dateFormat: 'DD/MM/YYYY',
          notifications: { email: true, inApp: true }
        })
      )

      console.log(`✓ Organization created: ${SANTA_PRISCILA_ORG_ID}`)

      // 2. Migrate users from JSON
      console.log('\n👥 Migrating users...')

      const usersJsonPath = path.resolve(__dirname, USERS_JSON_PATH)
      let usersCreated = 0

      if (fs.existsSync(usersJsonPath)) {
        const usersData = JSON.parse(fs.readFileSync(usersJsonPath, 'utf-8'))

        for (const user of usersData.users || []) {
          const userId = randomUUID()
          const role = user.role === 'admin' ? 'owner' : user.role || 'operator'

          saasDb.prepare(`
            INSERT INTO users (id, organization_id, email, password_hash, name, role, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).run(
            userId,
            SANTA_PRISCILA_ORG_ID,
            user.email,
            user.password, // Already hashed in original
            user.name,
            role,
            'active'
          )

          usersCreated++
        }
      }

      console.log(`✓ Users migrated: ${usersCreated}`)

      // 3. Migrate plants
      console.log('\n🏭 Migrating plants...')

      const plants = originalDb.prepare('SELECT * FROM plants').all()
      const plantIdMap: Record<string, string> = {}

      for (const plant of plants as any[]) {
        plantIdMap[plant.id] = plant.id // Keep same IDs for reference

        saasDb.prepare(`
          INSERT INTO plants (id, organization_id, name, location, type, capacity, latitude, longitude, status, settings, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          plant.id,
          SANTA_PRISCILA_ORG_ID,
          plant.name,
          plant.location,
          plant.type || 'ptar',
          plant.capacity,
          plant.latitude,
          plant.longitude,
          plant.status || 'active',
          plant.settings,
          plant.created_at || new Date().toISOString()
        )
      }

      console.log(`✓ Plants migrated: ${plants.length}`)

      // 4. Migrate environmental_data
      console.log('\n📊 Migrating environmental data...')

      const envData = originalDb.prepare('SELECT * FROM environmental_data').all()

      for (const data of envData as any[]) {
        saasDb.prepare(`
          INSERT INTO environmental_data (id, organization_id, plant_id, date, ph, temperature, turbidity, dissolved_oxygen, cod, bod, tss, ammonia, phosphorus, flow_rate, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.id,
          SANTA_PRISCILA_ORG_ID,
          data.plant_id,
          data.date,
          data.ph,
          data.temperature,
          data.turbidity,
          data.dissolved_oxygen,
          data.cod,
          data.bod,
          data.tss,
          data.ammonia,
          data.phosphorus,
          data.flow_rate,
          data.notes,
          data.created_at
        )
      }

      console.log(`✓ Environmental data migrated: ${envData.length}`)

      // 5. Migrate maintenance_tasks
      console.log('\n🔧 Migrating maintenance tasks...')

      const maintenanceTasks = originalDb.prepare('SELECT * FROM maintenance_tasks').all()

      for (const task of maintenanceTasks as any[]) {
        saasDb.prepare(`
          INSERT INTO maintenance_tasks (id, organization_id, plant_id, title, description, category, status, priority, due_date, completed_at, completed_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id,
          SANTA_PRISCILA_ORG_ID,
          task.plant_id,
          task.title,
          task.description,
          task.category,
          task.status,
          task.priority,
          task.due_date,
          task.completed_at,
          task.completed_by,
          task.created_at
        )
      }

      console.log(`✓ Maintenance tasks migrated: ${maintenanceTasks.length}`)

      // 6. Migrate maintenance_emergencies
      console.log('\n🚨 Migrating emergencies...')

      try {
        const emergencies = originalDb.prepare('SELECT * FROM maintenance_emergencies').all()

        for (const emergency of emergencies as any[]) {
          saasDb.prepare(`
            INSERT INTO maintenance_emergencies (id, organization_id, plant_id, title, description, severity, status, reported_by, resolved_by, resolved_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            emergency.id,
            SANTA_PRISCILA_ORG_ID,
            emergency.plant_id,
            emergency.title,
            emergency.description,
            emergency.severity,
            emergency.status,
            emergency.reported_by,
            emergency.resolved_by,
            emergency.resolved_at,
            emergency.created_at
          )
        }

        console.log(`✓ Emergencies migrated: ${emergencies.length}`)
      } catch (e) {
        console.log('⚠ No emergencies table found, skipping')
      }

      // 7. Migrate documents
      console.log('\n📄 Migrating documents...')

      try {
        const documents = originalDb.prepare('SELECT * FROM documents').all()

        for (const doc of documents as any[]) {
          saasDb.prepare(`
            INSERT INTO documents (id, organization_id, plant_id, name, type, category, file_path, file_size, mime_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            doc.id,
            SANTA_PRISCILA_ORG_ID,
            doc.plant_id,
            doc.name,
            doc.type,
            doc.category,
            doc.file_path,
            doc.file_size,
            doc.mime_type,
            doc.created_at
          )
        }

        console.log(`✓ Documents migrated: ${documents.length}`)
      } catch (e) {
        console.log('⚠ No documents table found, skipping')
      }

      // 8. Migrate equipment
      console.log('\n⚙️ Migrating equipment...')

      try {
        const equipment = originalDb.prepare('SELECT * FROM equipment').all()

        for (const eq of equipment as any[]) {
          saasDb.prepare(`
            INSERT INTO equipment (id, organization_id, plant_id, name, type, model, serial_number, manufacturer, installation_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            eq.id,
            SANTA_PRISCILA_ORG_ID,
            eq.plant_id,
            eq.name,
            eq.type,
            eq.model,
            eq.serial_number,
            eq.manufacturer,
            eq.installation_date,
            eq.status,
            eq.created_at
          )
        }

        console.log(`✓ Equipment migrated: ${equipment.length}`)
      } catch (e) {
        console.log('⚠ No equipment table found, skipping')
      }

      // 9. Migrate checklist_templates
      console.log('\n📋 Migrating checklist templates...')

      try {
        const templates = originalDb.prepare('SELECT * FROM checklist_templates').all()

        for (const template of templates as any[]) {
          saasDb.prepare(`
            INSERT INTO checklist_templates (id, organization_id, plant_id, name, description, items, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            template.id,
            SANTA_PRISCILA_ORG_ID,
            template.plant_id,
            template.name,
            template.description,
            template.items,
            template.is_active,
            template.created_at
          )
        }

        console.log(`✓ Checklist templates migrated: ${templates.length}`)
      } catch (e) {
        console.log('⚠ No checklist_templates table found, skipping')
      }

      // 10. Migrate daily_checklists
      console.log('\n✅ Migrating daily checklists...')

      try {
        const checklists = originalDb.prepare('SELECT * FROM daily_checklists').all()

        for (const checklist of checklists as any[]) {
          saasDb.prepare(`
            INSERT INTO daily_checklists (id, organization_id, plant_id, template_id, date, submitted_by, responses, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            checklist.id,
            SANTA_PRISCILA_ORG_ID,
            checklist.plant_id,
            checklist.template_id,
            checklist.date,
            checklist.submitted_by,
            checklist.responses,
            checklist.notes,
            checklist.created_at
          )
        }

        console.log(`✓ Daily checklists migrated: ${checklists.length}`)
      } catch (e) {
        console.log('⚠ No daily_checklists table found, skipping')
      }

      // 11. Migrate tickets
      console.log('\n🎫 Migrating tickets...')

      try {
        const tickets = originalDb.prepare('SELECT * FROM tickets').all()

        for (const ticket of tickets as any[]) {
          saasDb.prepare(`
            INSERT INTO tickets (id, organization_id, plant_id, ticket_number, subject, description, category, priority, status, requester_name, requester_email, requester_phone, assigned_to, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ticket.id,
            SANTA_PRISCILA_ORG_ID,
            ticket.plant_id,
            ticket.ticket_number,
            ticket.subject,
            ticket.description,
            ticket.category,
            ticket.priority,
            ticket.status,
            ticket.requester_name,
            ticket.requester_email,
            ticket.requester_phone,
            ticket.assigned_to,
            ticket.created_at
          )
        }

        console.log(`✓ Tickets migrated: ${tickets.length}`)
      } catch (e) {
        console.log('⚠ No tickets table found, skipping')
      }

      // 12. Migrate opex_costs
      console.log('\n💰 Migrating OPEX costs...')

      try {
        const opexCosts = originalDb.prepare('SELECT * FROM opex_costs').all()

        for (const cost of opexCosts as any[]) {
          saasDb.prepare(`
            INSERT INTO opex_costs (id, organization_id, plant_id, date, category, description, amount, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            cost.id,
            SANTA_PRISCILA_ORG_ID,
            cost.plant_id,
            cost.date,
            cost.category,
            cost.description,
            cost.amount,
            cost.notes,
            cost.created_at
          )
        }

        console.log(`✓ OPEX costs migrated: ${opexCosts.length}`)
      } catch (e) {
        console.log('⚠ No opex_costs table found, skipping')
      }

      // 13. Migrate equipment_scheduled_maintenance
      console.log('\n📅 Migrating equipment scheduled maintenance...')

      try {
        const scheduledMaint = originalDb.prepare('SELECT * FROM equipment_scheduled_maintenance').all()

        for (const maint of scheduledMaint as any[]) {
          saasDb.prepare(`
            INSERT INTO equipment_scheduled_maintenance (id, organization_id, plant_id, equipment_id, task_name, frequency, last_completed, next_due, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            maint.id,
            SANTA_PRISCILA_ORG_ID,
            maint.plant_id,
            maint.equipment_id,
            maint.task_name,
            maint.frequency,
            maint.last_completed,
            maint.next_due,
            maint.status || 'pending',
            maint.notes,
            maint.created_at
          )
        }

        console.log(`✓ Equipment scheduled maintenance migrated: ${scheduledMaint.length}`)
      } catch (e) {
        console.log('⚠ No equipment_scheduled_maintenance table found, skipping')
      }

      // 14. Migrate red_flag_history
      console.log('\n🚩 Migrating red flag history...')

      try {
        const redFlags = originalDb.prepare('SELECT * FROM red_flag_history').all()

        for (const flag of redFlags as any[]) {
          saasDb.prepare(`
            INSERT INTO red_flag_history (id, organization_id, plant_id, parameter, value, threshold, severity, resolved_at, resolved_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            flag.id,
            SANTA_PRISCILA_ORG_ID,
            flag.plant_id,
            flag.parameter,
            flag.value,
            flag.threshold,
            flag.severity || 'high',
            flag.resolved_at,
            flag.resolved_by,
            flag.created_at
          )
        }

        console.log(`✓ Red flag history migrated: ${redFlags.length}`)
      } catch (e) {
        console.log('⚠ No red_flag_history table found, skipping')
      }

      // 15. Migrate supervisor_reports
      console.log('\n📝 Migrating supervisor reports...')

      try {
        const reports = originalDb.prepare('SELECT * FROM supervisor_reports').all()

        for (const report of reports as any[]) {
          saasDb.prepare(`
            INSERT INTO supervisor_reports (id, organization_id, plant_id, supervisor_id, date, shift, summary, issues, actions_taken, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            report.id,
            SANTA_PRISCILA_ORG_ID,
            report.plant_id,
            report.supervisor_id,
            report.date,
            report.shift,
            report.summary,
            report.issues,
            report.actions_taken,
            report.created_at
          )
        }

        console.log(`✓ Supervisor reports migrated: ${reports.length}`)
      } catch (e) {
        console.log('⚠ No supervisor_reports table found, skipping')
      }

      // Commit transaction
      saasDb.exec('COMMIT')

      // Verification
      console.log('\n' + '='.repeat(50))
      console.log('📊 Verifying migration...')

      const verifyTables = [
        'organizations',
        'users',
        'plants',
        'environmental_data',
        'maintenance_tasks',
        'maintenance_emergencies',
        'documents',
        'equipment',
        'checklist_templates',
        'daily_checklists',
        'tickets',
        'opex_costs'
      ]

      for (const table of verifyTables) {
        try {
          const count = saasDb.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE organization_id = ?`).get(SANTA_PRISCILA_ORG_ID) as any
          console.log(`  ${table}: ${count?.count || 0} records`)
        } catch (e) {
          console.log(`  ${table}: table not found`)
        }
      }

      console.log('\n' + '='.repeat(50))
      console.log('✅ Migration completed successfully!')
      console.log(`\nOrganization ID: ${SANTA_PRISCILA_ORG_ID}`)
      console.log('Slug: santa-priscila')
      console.log('Plan: pro (10 plants, 25 users)')
      console.log('\nNext steps:')
      console.log('1. Start the SaaS server: pnpm dev')
      console.log('2. Login with existing credentials')
      console.log('3. Configure Stripe for billing (optional)')
      console.log('\nYou can now access the SaaS platform at: http://localhost:5174/')

    } catch (error) {
      // Rollback on error
      saasDb.exec('ROLLBACK')
      throw error
    }

    // Close databases
    originalDb.close()
    saasDb.close()

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
migrate()
