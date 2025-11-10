import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_KEY as string
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env')
  process.exit(1)
}
const db = createClient(url, serviceKey)

async function upsert(table: string, rows: any[]) {
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

function rand(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

async function seed() {
  console.log('Seeding plants...')
  const plants = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'PTAR Norte', location: 'Quito', latitude: -0.1807, longitude: -78.4678, status: 'active' },
    { id: '22222222-2222-2222-2222-222222222222', name: 'PTAR Sur', location: 'Guayaquil', latitude: -2.1700, longitude: -79.9224, status: 'maintenance' },
    { id: '33333333-3333-3333-3333-333333333333', name: 'LA LUZ', location: 'La Libertad', latitude: -2.234, longitude: -80.901, status: 'active' },
    { id: '44444444-4444-4444-4444-444444444444', name: 'TAURA', location: 'Taura', latitude: -2.393, longitude: -79.760, status: 'active' },
    { id: '55555555-5555-5555-5555-555555555555', name: 'SANTA MONICA', location: 'Santa Elena', latitude: -2.226, longitude: -80.855, status: 'active' },
    { id: '66666666-6666-6666-6666-666666666666', name: 'SAN DIEGO', location: 'San Diego', latitude: -1.956, longitude: -79.827, status: 'active' },
    { id: '77777777-7777-7777-7777-777777777777', name: 'CHANDUY', location: 'Chanduy', latitude: -2.439, longitude: -80.629, status: 'active' },
  ]
  await upsert('plants', plants)

  console.log('Seeding environmental_data with influent/effluent streams...')
  const params = [
    { type: 'DQO', unit: 'mg/L' },
    { type: 'pH', unit: '' },
    { type: 'SS', unit: 'mg/L' },
  ]
  const now = new Date()
  const months = 12 // 1 año muestral
  const envRows: any[] = []
  const targetNames = new Set(['LA LUZ','TAURA','SANTA MONICA','SAN DIEGO','CHANDUY'])

  // Valores base por planta (realistas para PTAR Ecuador)
  const baseByPlant: Record<string, {
    DQO_influent: number; DQO_effluent: number;
    pH_influent: number; pH_effluent: number;
    SS_influent: number; SS_effluent: number;
  }> = {
    'LA LUZ': { DQO_influent: 850, DQO_effluent: 110, pH_influent: 7.1, pH_effluent: 7.3, SS_influent: 420, SS_effluent: 70 },
    'TAURA': { DQO_influent: 920, DQO_effluent: 125, pH_influent: 7.0, pH_effluent: 7.4, SS_influent: 480, SS_effluent: 80 },
    'SANTA MONICA': { DQO_influent: 780, DQO_effluent: 95, pH_influent: 7.2, pH_effluent: 7.2, SS_influent: 390, SS_effluent: 65 },
    'SAN DIEGO': { DQO_influent: 950, DQO_effluent: 130, pH_influent: 6.9, pH_effluent: 7.5, SS_influent: 510, SS_effluent: 85 },
    'CHANDUY': { DQO_influent: 810, DQO_effluent: 105, pH_influent: 7.1, pH_effluent: 7.3, SS_influent: 430, SS_effluent: 75 },
  }

  for (const plant of plants.filter(p=>targetNames.has(p.name))) {
    const bases = baseByPlant[plant.name]
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setMonth(now.getMonth() - i)
      date.setDate(15) // muestra de mitad de mes
      const season = Math.sin((12 - i) / 12 * Math.PI * 2) // patrón suave anual

      // DQO - Afluente (entrada cruda, valores altos)
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'DQO',
        value: Math.round((bases.DQO_influent + season * 80 + rand(-50,50)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'influent'
      })

      // DQO - Efluente (salida tratada, valores bajos)
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'DQO',
        value: Math.round((bases.DQO_effluent + season * 15 + rand(-8,8)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'effluent'
      })

      // pH - Afluente
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'pH',
        value: Math.round((bases.pH_influent + season * 0.2 + rand(-0.3,0.3)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: '',
        stream: 'influent'
      })

      // pH - Efluente
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'pH',
        value: Math.round((bases.pH_effluent + season * 0.15 + rand(-0.25,0.25)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: '',
        stream: 'effluent'
      })

      // SS - Afluente (sólidos suspendidos entrada alta)
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'SS',
        value: Math.round((bases.SS_influent + season * 60 + rand(-30,30)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'influent'
      })

      // SS - Efluente (sólidos suspendidos salida baja)
      envRows.push({
        id: crypto.randomUUID(),
        plant_id: plant.id,
        parameter_type: 'SS',
        value: Math.round((bases.SS_effluent + season * 10 + rand(-6,6)) * 100)/100,
        measurement_date: date.toISOString(),
        unit: 'mg/L',
        stream: 'effluent'
      })
    }
  }

  console.log(`Generated ${envRows.length} environmental data records (with influent/effluent)`)
  await upsert('environmental_data', envRows)

  console.log('Seeding maintenance_tasks...')
  const addDays = (base: number, days: number) => new Date(base + 86400000 * days)
  const idByName = Object.fromEntries(plants.map(p => [p.name, p.id])) as Record<string, string>
  const dataset: { plant: string; items: string[] }[] = [
    { plant: 'LA LUZ', items: [
      '2 Bombas sumergibles de pozo de bombeo 1.1 kW',
      '1 Bomba sumergible de extracción de lodos del digestor 0.8 kW',
      '2 Soplantes del canal lateral - blower 1,7 kW',
      '1 Bomba dosificadora de hipoclorito de sodio',
    ]},
    { plant: 'TAURA', items: [
      '2 Bombas sumergibles de pozo de bombeo 1.1 kW',
      '1 Bomba sumergible de extracción de lodos decantador primari 0.6 kW',
      '3 Soplantes del canal lateral - blower 1,75 kW',
      '1 Bomba sumergible de extracción de lodos del decantador secundario 0.6 kW',
      '1 Bomba sumergible de extracción de lodos del digestor 0.6 kW',
      '1 Bomba dosificadora de hipoclorito de sodio',
    ]},
    { plant: 'SANTA MONICA', items: [
      '2 Bombas sumergibles de pozo de bombeo 1.1 kW',
      '1 Bomba sumergible de extracción de lodos decantador primari 0.6 kW',
      '2 Soplantes del canal lateral - blower 1,7 kW',
      '1 Bomba sumergible de extracción de lodos del decantador secundario 0.6 kW',
      '1 Bomba sumergible de extracción de lodos del digestor 0.6 kW',
      '1 Bomba dosificadora de hipoclorito de sodio',
    ]},
    { plant: 'SAN DIEGO', items: [
      '1 Bomba sumergible del pozo de bombeo 1.1 kW',
      '1 Bomba sumergible de extracción de lodos decantador primari 0.6 kW',
      '3 Soplantes del canal lateral - blower 1,75 kW',
      '1 Bomba sumergible de extracción de lodos del decantador secundario 0.6 kW',
      '1 Bomba sumergible de extracción de lodos del digestor 0.6 kW',
      '1 Bomba dosificadora de hipoclorito de sodio',
    ]},
    { plant: 'CHANDUY', items: [
      '1 Bomba sumergible del pozo de bombeo 1.1 kW',
      '1 Bomba sumergible de extracción de lodos decantador primari 0.6 kW',
      '2 Soplantes del canal lateral - blower 1,75 kW',
      '1 Bomba dosificadora de hipoclorito de sodio',
    ]},
  ]
  const maintRows: any[] = []
  // Configuración: periodicidad anual, tiempo total 10 días en 2 entradas (5 + 5)
  const phase1Start = addDays(Date.now(), 0)
  const phase2Start = addDays(Date.now(), 5)
  const phase1End = addDays(phase1Start.getTime(), 5)
  const phase2End = addDays(phase2Start.getTime(), 5)
  for (const group of dataset) {
    const plantId = idByName[group.plant]
    if (!plantId) continue
    const half = Math.ceil(group.items.length / 2)
    group.items.forEach((item, idx) => {
      const isFirstHalf = idx < half
      const start = isFirstHalf ? phase1Start : phase2Start
      const end = isFirstHalf ? phase1End : phase2End
      maintRows.push({
        id: crypto.randomUUID(),
        plant_id: plantId,
        task_type: 'preventive',
        description: `${group.plant} · ${item}`,
        scheduled_date: start.toISOString().slice(0,10),
        completed_date: end.toISOString().slice(0,10),
        status: 'pending',
      })
    })
  }
  await upsert('maintenance_tasks', maintRows)

  console.log('Seeding documents...')
  const docs = [
    { id: crypto.randomUUID(), plant_id: plants[0].id, file_name: 'Informe_Tecnico_PTAR_Norte.pdf', file_path: '/uploads/demo-informe-norte.pdf', category: 'technical_report', description: 'Informe técnico anual', uploaded_by: plants[0].id, uploaded_at: new Date().toISOString() },
    { id: crypto.randomUUID(), plant_id: plants[1].id, file_name: 'Plano_PTAR_Sur.dwg', file_path: '/uploads/demo-plano-sur.dwg', category: 'blueprint', description: 'Plano actualizado', uploaded_by: plants[1].id, uploaded_at: new Date().toISOString() },
  ]
  await upsert('documents', docs)

  console.log('Seed completed.')
}

seed().catch(err => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})