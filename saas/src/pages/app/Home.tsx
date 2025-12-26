// Overview page expanded per plant: latest analytics, history, maintenance compliance and KPIs
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Factory, Droplets, Gauge, FlaskConical, Wrench, CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, Calendar, Clock, Activity, Leaf, Shield, DollarSign, ClipboardCheck, Bell, ChevronRight, ShoppingCart } from 'lucide-react'
import { useUpcomingMaintenance, useCostPerM3, useEnvironmentalAlerts, useDashboardWidgetSummary, useChecklistSummary } from '../../hooks/useApi'

type Plant = { id: string; name: string }
type EnvRow = { plant_id: string; parameter_type: 'DQO'|'pH'|'SS'; measurement_date: string; value: number }
type MaintRow = { id: string; plant_id: string; scheduled_date: string; completed_date?: string }

// Mini sparkline component
const Sparkline = ({ data, color = '#60a5fa' }: { data: number[]; color?: string }) => {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 60
  const height = 24
  const points = data.slice(-8).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

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
      totalPlants: plantIds.length,
      compliantPlants: envOk,
    }
  }, [perPlant])

  // Colores para parámetros
  const paramColors = {
    DQO: '#60a5fa',
    pH: '#34d399',
    SS: '#a78bfa'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl shadow-lg shadow-blue-500/30">
                <Factory className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Visión General PTARS
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  Monitoreo en tiempo real de plantas de tratamiento
                </p>
              </div>
            </div>
          </div>
          {!loading && (
            <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
              usingDemo
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
            }`}>
              {usingDemo ? 'Datos de demostración' : 'Datos en tiempo real'}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPIs Principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Plantas totales */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Plantas Activas</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.totalPlants}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
                      En operación
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/30">
                    <Factory className="text-white" size={22} />
                  </div>
                </div>
              </div>

              {/* Cumplimiento ambiental */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Cumplimiento Ambiental</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.envComplianceRate}%</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                      {kpis.compliantPlants}/{kpis.totalPlants} plantas
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg shadow-emerald-500/30">
                    <Leaf className="text-white" size={22} />
                  </div>
                </div>
              </div>

              {/* Mantenimientos realizados */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Mttos Realizados</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.maintDoneRate}%</p>
                    <p className="text-sm text-violet-600 dark:text-violet-400 font-medium mt-1">
                      Del total programado
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/30">
                    <Wrench className="text-white" size={22} />
                  </div>
                </div>
              </div>

              {/* Mantenimientos a tiempo */}
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Mttos a Tiempo</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.maintOnTimeRate}%</p>
                    <p className="text-sm text-cyan-600 dark:text-cyan-400 font-medium mt-1">
                      Sin retrasos
                    </p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-lg shadow-cyan-500/30">
                    <Clock className="text-white" size={22} />
                  </div>
                </div>
              </div>
            </div>

            {/* Leyenda de parámetros */}
            <div className="mb-6 flex flex-wrap items-center gap-6 px-2">
              <span className="text-sm text-gray-500 font-medium">Parámetros:</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">DQO &lt; 200 mg/L</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">pH 6-8</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-violet-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">SS &lt; 100 mg/L</span>
              </div>
            </div>

            {/* Tarjetas de plantas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Object.entries(perPlant).map(([pid, pl]) => {
                const isCompliant = compliance(pl)
                return (
                  <div
                    key={pid}
                    className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border transition-all hover:shadow-2xl hover:-translate-y-1 ${
                      isCompliant
                        ? 'border-emerald-200 dark:border-emerald-800'
                        : 'border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {/* Header de la tarjeta */}
                    <div className={`px-5 py-4 border-b ${
                      isCompliant
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-100 dark:border-emerald-800'
                        : 'bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-900/20 dark:to-orange-900/20 border-rose-100 dark:border-rose-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            isCompliant
                              ? 'bg-emerald-100 dark:bg-emerald-900/50'
                              : 'bg-rose-100 dark:bg-rose-900/50'
                          }`}>
                            <Factory size={20} className={isCompliant ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{pl.name}</h3>
                        </div>
                        {isCompliant ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1.5 rounded-full text-xs font-semibold">
                            <CheckCircle2 size={14} />
                            Cumple
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50 px-3 py-1.5 rounded-full text-xs font-semibold">
                            <AlertTriangle size={14} />
                            Alerta
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Parámetros ambientales */}
                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {/* DQO */}
                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Droplets size={14} className="text-blue-500" />
                              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">DQO</span>
                            </div>
                            <Sparkline data={pl.history.DQO} color={paramColors.DQO} />
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {pl.last.DQO ?? '—'}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Prom: {pl.history.DQO.length ? (pl.history.DQO.reduce((a,b)=>a+b,0)/pl.history.DQO.length).toFixed(0) : '—'}
                          </div>
                        </div>

                        {/* pH */}
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Gauge size={14} className="text-emerald-500" />
                              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">pH</span>
                            </div>
                            <Sparkline data={pl.history.pH} color={paramColors.pH} />
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {pl.last.pH?.toFixed(1) ?? '—'}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Prom: {pl.history.pH.length ? (pl.history.pH.reduce((a,b)=>a+b,0)/pl.history.pH.length).toFixed(2) : '—'}
                          </div>
                        </div>

                        {/* SS */}
                        <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <FlaskConical size={14} className="text-violet-500" />
                              <span className="text-xs font-medium text-violet-600 dark:text-violet-400">SS</span>
                            </div>
                            <Sparkline data={pl.history.SS} color={paramColors.SS} />
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {pl.last.SS ?? '—'}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1">
                            Prom: {pl.history.SS.length ? (pl.history.SS.reduce((a,b)=>a+b,0)/pl.history.SS.length).toFixed(0) : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Mantenimiento */}
                      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Realizados</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {pl.maint.done}<span className="text-gray-400 text-sm">/{pl.maint.total}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Retrasos</div>
                          <div className={`text-lg font-bold ${pl.maint.overdue > 0 ? 'text-rose-600' : 'text-gray-900 dark:text-white'}`}>
                            {pl.maint.overdue}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Próximo</div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {pl.maint.next ? new Date(pl.maint.next).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }) : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ============ WIDGETS SECTION ============ */}
            <WidgetsSection />

            {/* Enlaces rápidos */}
            <div className="mt-8 p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                    <Activity size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Explora más detalles</p>
                    <p className="text-sm text-gray-500">Accede a los módulos especializados para análisis detallado</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/dashboard"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  >
                    Ver Analíticas
                  </Link>
                  <Link
                    to="/maintenance"
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                  >
                    Ver Mantenimiento
                  </Link>
                  <Link
                    to="/opex"
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                  >
                    Ver Costos OPEX
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============ WIDGETS COMPONENTS ============

function WidgetsSection() {
  const { data: upcomingMaint, isLoading: loadingMaint } = useUpcomingMaintenance(45)
  const { data: costData, isLoading: loadingCost } = useCostPerM3(6)
  const { data: envAlerts, isLoading: loadingAlerts } = useEnvironmentalAlerts()
  const { data: checklistSummary, isLoading: loadingChecklists } = useChecklistSummary()

  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Widget: Mantenimientos Próximos (45 días) - Para Órdenes de Compra */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                <ShoppingCart size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Mantenimientos Próximos</h3>
                <p className="text-xs text-gray-500">Preparar Órdenes de Compra (45 días)</p>
              </div>
            </div>
            {upcomingMaint && (
              <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-sm font-semibold rounded-full">
                {upcomingMaint.total}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          {loadingMaint ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
            </div>
          ) : upcomingMaint && upcomingMaint.all.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {upcomingMaint.all.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-xl border ${
                    task.days_until <= 7
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : task.days_until <= 30
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{task.plant_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        task.days_until <= 7
                          ? 'text-red-600 dark:text-red-400'
                          : task.days_until <= 30
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {task.days_until} días
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(task.scheduled_date).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {upcomingMaint.all.length > 5 && (
                <Link
                  to="/maintenance"
                  className="flex items-center justify-center gap-2 p-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                >
                  Ver todos ({upcomingMaint.total})
                  <ChevronRight size={16} />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Wrench size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin mantenimientos programados</p>
            </div>
          )}
        </div>
      </div>

      {/* Widget: Alertas Ambientales */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
                <Bell size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Alertas Ambientales</h3>
                <p className="text-xs text-gray-500">Parámetros fuera de rango</p>
              </div>
            </div>
            {envAlerts && envAlerts.total > 0 && (
              <span className="px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-sm font-semibold rounded-full">
                {envAlerts.total}
              </span>
            )}
          </div>
        </div>
        <div className="p-5">
          {loadingAlerts ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : envAlerts && envAlerts.alerts.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {envAlerts.alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border ${
                    alert.alert_type === 'critical'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className={
                        alert.alert_type === 'critical' ? 'text-red-500' : 'text-amber-500'
                      } />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{alert.plant_name}</p>
                        <p className="text-xs text-gray-500">{alert.parameter_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        alert.alert_type === 'critical' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {alert.value} {alert.unit}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Límite: {alert.threshold} {alert.unit}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={32} className="mx-auto mb-2" />
              <p className="text-sm font-medium">Todos los parámetros en rango</p>
            </div>
          )}
        </div>
      </div>

      {/* Widget: Costo por m³ */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
                <DollarSign size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Costo por m³</h3>
                <p className="text-xs text-gray-500">Promedio últimos 6 meses</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5">
          {loadingCost ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : costData ? (
            <div>
              {/* KPI principal */}
              <div className="text-center mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${costData.overall.avg_cost_per_m3.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Promedio general por m³</p>
              </div>
              {/* Top 3 plantas por costo */}
              <div className="space-y-2">
                {costData.byPlant
                  .sort((a, b) => b.avg_cost_per_m3 - a.avg_cost_per_m3)
                  .slice(0, 3)
                  .map((plant) => (
                    <div key={plant.plant_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{plant.plant_name}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">${plant.avg_cost_per_m3.toFixed(2)}/m³</span>
                    </div>
                  ))}
              </div>
              <Link
                to="/opex"
                className="flex items-center justify-center gap-2 mt-4 p-2 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
              >
                Ver detalles OPEX
                <ChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin datos de costos</p>
            </div>
          )}
        </div>
      </div>

      {/* Widget: Estado de Checklists */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
                <ClipboardCheck size={20} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Inspecciones del Día</h3>
                <p className="text-xs text-gray-500">Checklists diarios por planta</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5">
          {loadingChecklists ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : checklistSummary && checklistSummary.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {checklistSummary.map((plant) => {
                const progress = plant.total_items > 0
                  ? Math.round((plant.checked_items / plant.total_items) * 100)
                  : 0
                const isComplete = plant.completed_at !== null

                return (
                  <div
                    key={plant.plant_id}
                    className={`p-3 rounded-xl border ${
                      isComplete
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : plant.checklist_id
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{plant.plant_name}</span>
                      {isComplete ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : plant.checklist_id ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{progress}%</span>
                      ) : (
                        <span className="text-xs text-gray-400">No iniciado</span>
                      )}
                    </div>
                    {plant.checklist_id && (
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <ClipboardCheck size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin checklists configurados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
