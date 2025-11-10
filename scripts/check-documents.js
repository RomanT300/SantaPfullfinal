import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'ptar.db')
const db = new Database(dbPath)

const total = db.prepare('SELECT COUNT(*) as count FROM documents').get()
console.log('Total documentos:', total.count)

const byPlant = db.prepare(`
  SELECT p.name as plant_name, COUNT(d.id) as doc_count
  FROM plants p
  LEFT JOIN documents d ON p.id = d.plant_id
  GROUP BY p.name
  ORDER BY p.name
`).all()

console.log('\nDocumentos por planta:')
byPlant.forEach(row => {
  console.log(`  ${row.plant_name}: ${row.doc_count}`)
})

const byCategory = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM documents
  GROUP BY category
  ORDER BY count DESC
`).all()

console.log('\nDocumentos por categoría:')
byCategory.forEach(row => {
  console.log(`  ${row.category}: ${row.count}`)
})

db.close()
