/**
 * Script para crear plantilla de checklist para las plantas Tropack
 * Ejecutar con: npx tsx scripts/seed-tropack-checklist.ts
 */
import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'

const dbPath = path.join(process.cwd(), 'data', 'ptar.db')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

// Plantillas de checklist para plantas Tropack
interface ChecklistItem {
  section: string
  element: string
  activity: string
  requires_value: boolean
  value_unit: string | null
}

const tropackChecklistItems: ChecklistItem[] = [
  // === SECCIÓN: TANQUES ===
  { section: 'TANQUES', element: 'Tanque de Ecualización', activity: 'Verificar nivel de agua', requires_value: true, value_unit: '%' },
  { section: 'TANQUES', element: 'Tanque de Ecualización', activity: 'Inspeccionar bomba sumergible', requires_value: false, value_unit: null },
  { section: 'TANQUES', element: 'Tanque de Ecualización', activity: 'Verificar funcionamiento de agitador', requires_value: false, value_unit: null },
  { section: 'TANQUES', element: 'Tanque de Ecualización', activity: 'Revisar olores anormales', requires_value: false, value_unit: null },

  { section: 'TANQUES', element: 'Reactor Biológico', activity: 'Verificar nivel de lodo', requires_value: true, value_unit: 'mL/L' },
  { section: 'TANQUES', element: 'Reactor Biológico', activity: 'Medir oxígeno disuelto', requires_value: true, value_unit: 'mg/L' },
  { section: 'TANQUES', element: 'Reactor Biológico', activity: 'Verificar color del licor mezclado', requires_value: false, value_unit: null },
  { section: 'TANQUES', element: 'Reactor Biológico', activity: 'Inspeccionar difusores de aire', requires_value: false, value_unit: null },

  { section: 'TANQUES', element: 'Sedimentador', activity: 'Verificar claridad del efluente', requires_value: false, value_unit: null },
  { section: 'TANQUES', element: 'Sedimentador', activity: 'Medir altura del manto de lodos', requires_value: true, value_unit: 'cm' },
  { section: 'TANQUES', element: 'Sedimentador', activity: 'Inspeccionar rastras/barredores', requires_value: false, value_unit: null },
  { section: 'TANQUES', element: 'Sedimentador', activity: 'Verificar recirculación de lodos', requires_value: false, value_unit: null },

  { section: 'TANQUES', element: 'Tanque de Lodos', activity: 'Verificar nivel de lodos', requires_value: true, value_unit: '%' },
  { section: 'TANQUES', element: 'Tanque de Lodos', activity: 'Verificar funcionamiento de bomba de lodos', requires_value: false, value_unit: null },

  // === SECCIÓN: PARÁMETROS DE PROCESO ===
  { section: 'PARÁMETROS', element: 'Influente', activity: 'Medir pH de entrada', requires_value: true, value_unit: 'pH' },
  { section: 'PARÁMETROS', element: 'Influente', activity: 'Medir temperatura de entrada', requires_value: true, value_unit: '°C' },
  { section: 'PARÁMETROS', element: 'Influente', activity: 'Observar color del agua', requires_value: false, value_unit: null },
  { section: 'PARÁMETROS', element: 'Influente', activity: 'Detectar olores anormales', requires_value: false, value_unit: null },

  { section: 'PARÁMETROS', element: 'Efluente', activity: 'Medir pH de salida', requires_value: true, value_unit: 'pH' },
  { section: 'PARÁMETROS', element: 'Efluente', activity: 'Medir temperatura de salida', requires_value: true, value_unit: '°C' },
  { section: 'PARÁMETROS', element: 'Efluente', activity: 'Verificar claridad del efluente', requires_value: false, value_unit: null },
  { section: 'PARÁMETROS', element: 'Efluente', activity: 'Tomar muestra para laboratorio', requires_value: false, value_unit: null },

  { section: 'PARÁMETROS', element: 'Caudal', activity: 'Registrar caudal de entrada', requires_value: true, value_unit: 'm³/h' },
  { section: 'PARÁMETROS', element: 'Caudal', activity: 'Registrar caudal de salida', requires_value: true, value_unit: 'm³/h' },

  // === SECCIÓN: EQUIPOS MECÁNICOS ===
  { section: 'EQUIPOS', element: 'Sopladores', activity: 'Verificar presión de operación', requires_value: true, value_unit: 'bar' },
  { section: 'EQUIPOS', element: 'Sopladores', activity: 'Verificar temperatura del motor', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Sopladores', activity: 'Escuchar ruidos anormales', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Sopladores', activity: 'Verificar vibraciones', requires_value: false, value_unit: null },

  { section: 'EQUIPOS', element: 'Bombas', activity: 'Verificar funcionamiento de bombas de alimentación', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Bombas', activity: 'Verificar funcionamiento de bombas de recirculación', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Bombas', activity: 'Verificar funcionamiento de bombas de lodos', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Bombas', activity: 'Revisar sellos y empaquetaduras', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Bombas', activity: 'Verificar que no hay fugas', requires_value: false, value_unit: null },

  { section: 'EQUIPOS', element: 'Motores', activity: 'Verificar temperatura de motores', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Motores', activity: 'Escuchar ruidos anormales en motores', requires_value: false, value_unit: null },
  { section: 'EQUIPOS', element: 'Motores', activity: 'Verificar conexiones eléctricas', requires_value: false, value_unit: null },

  // === SECCIÓN: CUADRO ELÉCTRICO ===
  { section: 'ELÉCTRICO', element: 'Tablero Principal', activity: 'Verificar estado de indicadores/pilotos', requires_value: false, value_unit: null },
  { section: 'ELÉCTRICO', element: 'Tablero Principal', activity: 'Verificar que no hay alarmas activas', requires_value: false, value_unit: null },
  { section: 'ELÉCTRICO', element: 'Tablero Principal', activity: 'Registrar consumo eléctrico', requires_value: true, value_unit: 'kWh' },
  { section: 'ELÉCTRICO', element: 'Tablero Principal', activity: 'Verificar estado de variadores de frecuencia', requires_value: false, value_unit: null },
  { section: 'ELÉCTRICO', element: 'Tablero Principal', activity: 'Verificar ventilación del tablero', requires_value: false, value_unit: null },

  // === SECCIÓN: QUÍMICOS ===
  { section: 'QUÍMICOS', element: 'Dosificación', activity: 'Verificar nivel de coagulante', requires_value: true, value_unit: '%' },
  { section: 'QUÍMICOS', element: 'Dosificación', activity: 'Verificar nivel de floculante', requires_value: true, value_unit: '%' },
  { section: 'QUÍMICOS', element: 'Dosificación', activity: 'Verificar nivel de soda cáustica/ácido', requires_value: true, value_unit: '%' },
  { section: 'QUÍMICOS', element: 'Dosificación', activity: 'Verificar funcionamiento de bombas dosificadoras', requires_value: false, value_unit: null },
  { section: 'QUÍMICOS', element: 'Dosificación', activity: 'Verificar tasa de dosificación', requires_value: true, value_unit: 'mL/min' },

  // === SECCIÓN: SEGURIDAD ===
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar orden y limpieza del área', requires_value: false, value_unit: null },
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar señalización de seguridad', requires_value: false, value_unit: null },
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar disponibilidad de EPP', requires_value: false, value_unit: null },
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar iluminación adecuada', requires_value: false, value_unit: null },
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar accesos y pasarelas libres', requires_value: false, value_unit: null },
  { section: 'SEGURIDAD', element: 'Área General', activity: 'Verificar estado de extintores', requires_value: false, value_unit: null },

  // === SECCIÓN: MANTENIMIENTO PREVENTIVO ===
  { section: 'MANTENIMIENTO', element: 'Lubricación', activity: 'Verificar nivel de aceite en reductores', requires_value: false, value_unit: null },
  { section: 'MANTENIMIENTO', element: 'Lubricación', activity: 'Verificar puntos de engrase', requires_value: false, value_unit: null },
  { section: 'MANTENIMIENTO', element: 'Filtros', activity: 'Verificar estado de filtros de aire', requires_value: false, value_unit: null },
  { section: 'MANTENIMIENTO', element: 'Correas', activity: 'Verificar tensión de correas', requires_value: false, value_unit: null },
]

// Plantas Tropack
const tropackPlants = [
  { id: '88888888-8888-8888-8888-888888888883', name: 'TROPACK BIOSEM 1' },
  { id: '88888888-8888-8888-8888-888888888884', name: 'TROPACK BIOSEM 2' },
  { id: '88888888-8888-8888-8888-888888888885', name: 'TROPACK INDUSTRIAL' },
  { id: '88888888-8888-8888-8888-888888888886', name: 'TROPACK TILAPIA' },
]

console.log('🚀 Iniciando creación de plantillas de checklist para plantas Tropack...\n')

// Crear plantillas para cada planta Tropack
for (const plant of tropackPlants) {
  console.log(`📋 Creando plantilla para ${plant.name}...`)

  const templateId = `template-${plant.id}-tropack`
  const templateCode = `CK-${plant.name.replace(/\s+/g, '-').toUpperCase()}`

  // Desactivar plantillas existentes
  db.prepare(`UPDATE checklist_templates SET is_active = 0 WHERE plant_id = ?`).run(plant.id)

  // Verificar si ya existe la plantilla
  const existing = db.prepare(`SELECT id FROM checklist_templates WHERE id = ?`).get(templateId)

  if (existing) {
    // Eliminar items existentes
    db.prepare(`DELETE FROM checklist_template_items WHERE template_id = ?`).run(templateId)
    // Actualizar plantilla
    db.prepare(`
      UPDATE checklist_templates
      SET template_name = ?, template_code = ?, is_active = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(`Checklist Operativo ${plant.name}`, templateCode, templateId)
    console.log(`  ✓ Plantilla actualizada`)
  } else {
    // Crear nueva plantilla
    db.prepare(`
      INSERT INTO checklist_templates (id, plant_id, template_name, template_code, description, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      templateId,
      plant.id,
      `Checklist Operativo ${plant.name}`,
      templateCode,
      `Checklist diario para operadores de ${plant.name}`
    )
    console.log(`  ✓ Plantilla creada`)
  }

  // Insertar items
  const insertItem = db.prepare(`
    INSERT INTO checklist_template_items (id, template_id, section, element, activity, requires_value, value_unit, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let order = 0
  for (const item of tropackChecklistItems) {
    const itemId = `item-${templateId}-${order}`
    insertItem.run(
      itemId,
      templateId,
      item.section,
      item.element,
      item.activity,
      item.requires_value ? 1 : 0,
      item.value_unit,
      order
    )
    order++
  }

  console.log(`  ✓ ${order} items insertados\n`)
}

// Mostrar resumen
const summary = db.prepare(`
  SELECT
    ct.template_name,
    p.name as plant_name,
    (SELECT COUNT(*) FROM checklist_template_items WHERE template_id = ct.id) as item_count
  FROM checklist_templates ct
  JOIN plants p ON ct.plant_id = p.id
  WHERE ct.is_active = 1
  ORDER BY p.name
`).all()

console.log('📊 RESUMEN DE PLANTILLAS ACTIVAS:')
console.log('================================')
for (const t of summary as any[]) {
  console.log(`  ${t.plant_name}: ${t.item_count} items`)
}

console.log('\n✅ Proceso completado exitosamente!')
db.close()
