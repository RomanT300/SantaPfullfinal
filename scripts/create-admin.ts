/**
 * Script to create admin user for production
 */
import { db } from '../api/lib/database.js'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

async function createAdminUser() {
  console.log('Creating admin user for production...')

  const email = 'admin@santapriscila.com'
  const password = 'Admin2025!'
  const name = 'Administrator'
  const role = 'admin'

  // Check if admin already exists
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

  if (existing) {
    console.log('⚠️  Admin user already exists')
    console.log('Email:', email)
    return
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create admin user
  const id = randomUUID()
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmt.run(id, email, passwordHash, name, role)

  console.log('\n✅ Admin user created successfully!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Email:    ', email)
  console.log('Password: ', password)
  console.log('Role:     ', role)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  IMPORTANT: Change this password after first login!')
  console.log('Store these credentials securely.\n')
}

createAdminUser()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error creating admin user:', error)
    process.exit(1)
  })
