// Overview page expanded per plant: latest analytics, history, maintenance compliance and KPIs
import { useEffect, useMemo, useState } from 'react'
import { ActivitySquare, Factory, FileText, Wrench, CheckCircle2, XCircle } from 'lucide-react'

type Plant = { id: string; name: string }
type EnvRow = { plant_id: string; parameter_type: 'DQO'|'pH'|'SS'; measurement_date: string; value: number }
type MaintRow = { id: string; plant_id: string; scheduled_date: string; completed_date?: string }

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [envData, setEnvData] = useState<EnvRow[]>([])
  const [maint, setMaint] = useState<MaintRow[]>([])
  const [docsCount, setDocsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/plants', { credentials: 'include' }).then(r => r.json()).catch(()=>({ success: false })),
      fetch('/api/analytics/environmental', { credentials: 'include' }).then(r => r.json()).catch(()=>({ success: false })),
      fetch('/api/maintenance/tasks', { credentials: 'include' }).then(r => r.json()).catch(()=>({ success: false })),
      fetch('/api/documents', { credentials: 'include' }).then(r => r.json()).catch(()=>({ success: false })),
    ])
      .then(([p, a, m, d]) => {
        let demo = false
        if (p?.success && Array.isArray(p.data) && p.data.length) {
          setPlants(p.data.map((x:any)=>({id:x.id,name:x.name})))
        } else {
          demo = true
          setPlants([
            { id: 'LA LUZ', name: 'LA LUZ' },
            { id: 'TAURA', name: 'TAURA' },
            { id: 'SANTA MONICA', name: 'SANTA MONICA' },
            { id: 'SAN DIEGO', name: 'SAN DIEGO' },
            { id: 'CHANDUY', name: 'CHANDUY' },
          ])
        }
        if (a?.success && Array.isArray(a.data)) {
          setEnvData(a.data as EnvRow[])
        } else {
          demo = true
          // Fallback: 12 meses de datos por planta y parámetro
          const now = new Date(); const months = 12
          const dates = Array.from({length:months}).map((_,i)=>{ const d=new Date(now); d.setMonth(now.getMonth()-(months-1-i)); d.setDate(15); return d.toISOString() })
          const baseByPlant: Record<string, { DQO: number; pH: number; SS: number }> = {
            'LA LUZ': { DQO: 110, pH: 7.3, SS: 70 },
            'TAURA': { DQO: 125, pH: 7.4, SS: 80 },
            'SANTA MONICA': { DQO: 95, pH: 7.2, SS: 65 },
            'SAN DIEGO': { DQO: 130, pH: 7.5, SS: 85 },
            'CHANDUY': { DQO: 105, pH: 7.3, SS: 75 },
          }
          const rows: EnvRow[] = []
          const list = plants.length ? plants : [
            { id: 'LA LUZ', name: 'LA LUZ' },
            { id: 'TAURA', name: 'TAURA' },
            { id: 'SANTA MONICA', name: 'SANTA MONICA' },
            { id: 'SAN DIEGO', name: 'SAN DIEGO' },
            { id: 'CHANDUY', name: 'CHANDUY' },
          ]
          list.forEach(pl=>{
            const bases = baseByPlant[pl.name] || baseByPlant['LA LUZ'];
            ['DQO','pH','SS'].forEach((param)=>{
              dates.forEach((d,i)=>{
                const season = Math.sin((i/dates.length)*Math.PI*2)
                const base = (param==='DQO'?bases.DQO:param==='SS'?bases.SS:bases.pH)
                const jitter = param==='pH' ? (Math.random()*0.3-0.15) : (Math.random()*10-5)
                const val = param==='pH' ? (base+season*0.15+jitter) : (base+season*10+jitter)
                rows.push({ plant_id: pl.id, parameter_type: param as any, measurement_date: d, value: Math.max(0, Math.round(val*100)/100) })
              })
            })
          })
          setEnvData(rows)
        }
        if (m?.success && Array.isArray(m.data)) {
          setMaint(m.data as MaintRow[])
        } else {
          demo = true
          // Fallback: usa dos fases por planta
          const today = new Date(); const add = (d:number)=>new Date(today.getTime()+d*86400000).toISOString()
          const make = (plant:string, n:number)=>Array.from({length:n}).map((_,i)=>({id:`${plant}-${i}`, plant_id: plant, scheduled_date: add(i<Math.ceil(n/2)?0:5)}))
          setMaint([
            ...make('LA LUZ',4),
            ...make('TAURA',6),
            ...make('SANTA MONICA',6),
            ...make('SAN DIEGO',6),
            ...make('CHANDUY',4),
          ])
        }
        setDocsCount(d?.success ? (d.data||[]).length : 12)
        setUsingDemo(demo)
      })
      .finally(()=>setLoading(false))
  }, [])

  const perPlant = useMemo(() => {
    const group: Record<string, { name: string; last: {DQO:number|null;pH:number|null;SS:number|null}; history: Record<'DQO'|'pH'|'SS', number[]>; maint: { next?: string; total: number; overdue: number; done: number } }> = {}
    plants.forEach(pl=> group[pl.id] = { name: pl.name, last: { DQO: null, pH: null, SS: null }, history: { DQO: [], pH: [], SS: [] }, maint: { total:0, overdue:0, done:0 } })
    envData.sort((a,b)=> new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime()).forEach(row=>{
      const g = group[row.plant_id] || (group[row.plant_id] = { name: row.plant_id, last: {DQO:null,pH:null,SS:null}, history: { DQO: [], pH: [], SS: [] }, maint: { total:0, overdue:0, done:0 } })
      g.history[row.parameter_type].push(row.value)
      g.last[row.parameter_type] = row.value
    })
    const today = new Date().toISOString().slice(0,10)
    Object.keys(group).forEach(pid=>{
      const rows = maint.filter(m=>m.plant_id===pid).sort((a,b)=> a.scheduled_date.localeCompare(b.scheduled_date))
      group[pid].maint.total = rows.length
      group[pid].maint.next = rows.find(r=>r.scheduled_date.slice(0,10)>=today)?.scheduled_date
      rows.forEach(r=>{
        const done = !!r.completed_date
        const overdue = (!done && r.scheduled_date.slice(0,10)<today) || (done && (r.completed_date!.slice(0,10)>r.scheduled_date.slice(0,10)))
        if (done) group[pid].maint.done++
        if (overdue) group[pid].maint.overdue++
      })
    })
    return group
  }, [plants, envData, maint])

  const compliance = (pl: { last: {DQO:number|null;pH:number|null;SS:number|null} }) => {
    const dq = pl.last.DQO; const ph = pl.last.pH; const ss = pl.last.SS
    const ok = (dq!=null && dq<200) && (ph!=null && ph>=6 && ph<=8) && (ss!=null && ss<100)
    return ok
  }

  const kpis = useMemo(() => {
    const plantIds = Object.keys(perPlant)
    const envOk = plantIds.filter(id=> compliance(perPlant[id])).length
    const maintTotal = plantIds.reduce((acc,id)=> acc+perPlant[id].maint.total,0)
    const maintOver = plantIds.reduce((acc,id)=> acc+perPlant[id].maint.overdue,0)
    const maintDone = plantIds.reduce((acc,id)=> acc+perPlant[id].maint.done,0)
    return {
      envComplianceRate: plantIds.length ? Math.round((envOk/plantIds.length)*100) : 0,
      maintOnTimeRate: maintTotal ? Math.round(((maintTotal - maintOver)/maintTotal)*100) : 0,
      maintDoneRate: maintTotal ? Math.round((maintDone/maintTotal)*100) : 0,
    }
  }, [perPlant])

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold">Visión General</h1>
        {!loading && <span className="text-xs text-gray-500">{usingDemo ? 'Datos de ejemplo' : 'Actualizado ahora'}</span>}
      </div>
      {loading && <div>Cargando...</div>}
      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(perPlant).map(([pid, pl]) => (
              <div key={pid} className="bg-white dark:bg-gray-800 rounded border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{pl.name}</div>
                  {compliance(pl) ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded text-xs"><CheckCircle2 size={14}/> Cumple</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded text-xs"><XCircle size={14}/> No cumple</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">DQO última</div>
                    <div className="font-semibold">{pl.last.DQO ?? '—'}</div>
                    <div className="text-gray-400">Histórico avg {pl.history.DQO.length ? (pl.history.DQO.reduce((a,b)=>a+b,0)/pl.history.DQO.length).toFixed(1) : '—'}</div>
                  </div>
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">pH último</div>
                    <div className="font-semibold">{pl.last.pH ?? '—'}</div>
                    <div className="text-gray-400">Histórico avg {pl.history.pH.length ? (pl.history.pH.reduce((a,b)=>a+b,0)/pl.history.pH.length).toFixed(2) : '—'}</div>
                  </div>
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">SS último</div>
                    <div className="font-semibold">{pl.last.SS ?? '—'}</div>
                    <div className="text-gray-400">Histórico avg {pl.history.SS.length ? (pl.history.SS.reduce((a,b)=>a+b,0)/pl.history.SS.length).toFixed(1) : '—'}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">Mttos realizados</div>
                    <div className="font-semibold">{pl.maint.done}/{pl.maint.total}</div>
                  </div>
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">Retrasos</div>
                    <div className="font-semibold">{pl.maint.overdue}</div>
                  </div>
                  <div className="p-2 rounded border">
                    <div className="text-gray-500">Próximo</div>
                    <div className="font-semibold">{pl.maint.next ? new Date(pl.maint.next).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Cumplimiento ambiental (plantas)</div>
              <div className="text-2xl font-semibold">{kpis.envComplianceRate}%</div>
              <div className="text-xs text-gray-500">DQO &lt; 200 ppm, pH 6–8, SS &lt; 100 ppm</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Mttos realizados</div>
              <div className="text-2xl font-semibold">{kpis.maintDoneRate}%</div>
              <div className="text-xs text-gray-500">Sobre el total programado</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-500">Mttos a tiempo</div>
              <div className="text-2xl font-semibold">{kpis.maintOnTimeRate}%</div>
              <div className="text-xs text-gray-500">Sin retraso vs fecha prevista</div>
            </div>
          </div>

          <div className="mt-6 text-sm text-gray-600">Para ver detalles por planta, entra en <a className="text-blue-600 underline" href="/dashboard">Analíticas</a> y <a className="text-blue-600 underline" href="/maintenance">Mantenimiento</a>.</div>
        </>
      )}
    </div>
  )
}