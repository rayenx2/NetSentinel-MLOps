import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Shield, Activity, Cpu, Database, Zap } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import StatusBadge from './StatusBadge'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8090'

function useCounter(target, duration = 1200) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target == null) return
    const diff = target - prev.current
    if (diff === 0) return
    const start = prev.current
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(start + diff * eased))
      if (p < 1) requestAnimationFrame(tick)
      else prev.current = target
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return val
}

function StatCard({ label, value, sub, color, icon: Icon, glow }) {
  return (
    <div className={`relative rounded-2xl border bg-[#0a1628]/80 p-5 overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
      glow === 'cyan'   ? 'border-cyan-500/20  shadow-[0_0_30px_rgba(6,182,212,0.06)]'   :
      glow === 'red'    ? 'border-red-500/20   shadow-[0_0_30px_rgba(239,68,68,0.06)]'    :
      glow === 'green'  ? 'border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.06)]' :
      glow === 'violet' ? 'border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.06)]'  :
                          'border-white/6'
    }`}>
      <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${
        glow === 'cyan'   ? 'from-cyan-500'    :
        glow === 'red'    ? 'from-red-500'     :
        glow === 'green'  ? 'from-emerald-500' :
        glow === 'violet' ? 'from-violet-500'  : ''
      }`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">{label}</span>
          {Icon && <Icon size={15} className={
            glow === 'cyan'   ? 'text-cyan-500/60'    :
            glow === 'red'    ? 'text-red-500/60'     :
            glow === 'green'  ? 'text-emerald-500/60' :
                                'text-violet-500/60'
          } />}
        </div>
        <div className={`text-3xl font-bold font-mono tabular-nums ${color}`}>
          {value ?? <span className="text-slate-700">—</span>}
        </div>
        {sub && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-[#0f1f38] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <span className="text-slate-400">{name}: </span>
      <span className="text-white font-bold">{value.toLocaleString()}</span>
    </div>
  )
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1f38] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1 truncate max-w-[160px]">{label}</p>
      <p className="text-violet-300 font-bold">{payload[0].value}%</p>
    </div>
  )
}

export default function Dashboard() {
  const [health,  setHealth]  = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [mstats,  setMstats]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [mloading, setMloading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  const fetchLive = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [hRes, mRes] = await Promise.all([
        fetch(`${API}/health`),
        fetch(`${API}/metrics`),
      ])
      if (!hRes.ok) throw new Error(`Health: ${hRes.status}`)
      if (!mRes.ok) throw new Error(`Metrics: ${mRes.status}`)
      const [h, m] = await Promise.all([hRes.json(), mRes.json()])
      setHealth(h); setMetrics(m); setLastUpdated(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const fetchModelStats = useCallback(async () => {
    setMloading(true)
    try {
      const res = await fetch(`${API}/api/model-stats`)
      if (!res.ok) throw new Error(`model-stats: ${res.status}`)
      setMstats(await res.json())
    } catch {
      // non-critical — silently skip
    } finally { setMloading(false) }
  }, [])

  useEffect(() => {
    fetchLive()
    fetchModelStats()
    const id = setInterval(fetchLive, 10000)
    return () => clearInterval(id)
  }, [fetchLive, fetchModelStats])

  function handleRefresh() { fetchLive(); fetchModelStats() }

  const stats    = metrics?.prediction_stats ?? {}
  const total    = stats.total_predictions_served ?? 0
  const phishing = stats.phishing_detected        ?? 0
  const legit    = stats.legitimate_classified    ?? 0
  const rate     = stats.phishing_rate            ?? 0

  const cTotal    = useCounter(total)
  const cPhishing = useCounter(phishing)
  const cLegit    = useCounter(legit)

  const donutData = [
    { name: 'Phishing',   value: phishing || 1 },
    { name: 'Legitimate', value: legit    || 1 },
  ]

  // real feature importances from model — top 8 for readability
  const fiData = (mstats?.feature_importances ?? []).slice(0, 8).map((d) => ({
    name: d.feature.replace(/_/g, ' '),
    pct: d.importance,
  }))

  const realMetrics = mstats?.metrics

  return (
    <div className="space-y-6 animate-[fadeIn_0.4s_ease]">

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">System Dashboard</h1>
          <p className="text-xs text-slate-600 mt-0.5">Real-time phishing detection pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && !loading && (
            <span className="text-[11px] text-slate-600 font-mono">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 text-xs hover:bg-white/8 hover:text-slate-200 transition-all disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* prediction counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Analyzed"  value={cTotal.toLocaleString()}    color="text-cyan-400"    glow="cyan"   icon={Activity} sub="URLs processed" />
        <StatCard label="Phishing Caught" value={cPhishing.toLocaleString()} color="text-red-400"     glow="red"    icon={Shield}   sub={`${(rate*100).toFixed(1)}% of total`} />
        <StatCard label="Legitimate"      value={cLegit.toLocaleString()}    color="text-emerald-400" glow="green"  icon={Shield}   sub="safe URLs" />
        <StatCard label="Avg Latency"     value={stats.avg_latency_ms != null ? `${stats.avg_latency_ms.toFixed(1)}ms` : '—'} color="text-violet-400" glow="violet" icon={Zap} sub="per prediction" />
      </div>

      {/* real model eval metrics */}
      {(realMetrics || mloading) && (
        <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu size={15} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-200">Model Evaluation</h3>
              <span className="text-[10px] text-slate-600 font-mono">
                {mstats ? `${mstats.test_set_size.toLocaleString()} held-out URLs · ${mstats.model_type}` : ''}
              </span>
            </div>
            {mloading && <span className="text-[10px] text-slate-600 animate-pulse">computing…</span>}
          </div>
          {mloading && !realMetrics ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-white/4 animate-pulse" />
              ))}
            </div>
          ) : realMetrics && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: 'Accuracy',    value: `${realMetrics.accuracy}%`,    color: 'text-cyan-400' },
                { label: 'F1 Score',    value: `${realMetrics.f1_weighted}%`, color: 'text-violet-400' },
                { label: 'F1 Phishing', value: `${realMetrics.f1_phishing}%`, color: 'text-red-400' },
                { label: 'F1 Legit',    value: `${realMetrics.f1_legit}%`,    color: 'text-emerald-400' },
                { label: 'Precision',   value: `${realMetrics.precision}%`,   color: 'text-blue-400' },
                { label: 'Recall',      value: `${realMetrics.recall}%`,      color: 'text-amber-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center rounded-xl bg-white/3 border border-white/6 py-3 px-2">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* detection split + feature importances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* donut */}
        <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-200">Detection Split</h3>
            <span className="text-[10px] text-slate-600">live predictions</span>
          </div>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
                  dataKey="value" strokeWidth={0} paddingAngle={3}>
                  <Cell fill="#ef4444" fillOpacity={0.85} />
                  <Cell fill="#10b981" fillOpacity={0.85} />
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Phishing',   value: cPhishing, color: 'text-red-400',     dot: 'bg-red-500/85' },
                { label: 'Legitimate', value: cLegit,    color: 'text-emerald-400', dot: 'bg-emerald-500/85' },
              ].map(({ label, value, color, dot }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-sm ${dot} shrink-0`} />
                  <div>
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className={`text-sm font-bold font-mono ${color}`}>{value.toLocaleString()}</p>
                  </div>
                </div>
              ))}
              <div className="mt-1 pt-3 border-t border-white/6">
                <p className="text-[11px] text-slate-500">Phishing Rate</p>
                <p className={`text-lg font-bold font-mono ${rate > 0.5 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {(rate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* feature importances — real from model.pkl */}
        <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu size={15} className="text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-200">Feature Importances</h3>
            <span className="text-[10px] text-slate-600">from model.pkl</span>
          </div>
          {mloading && fiData.length === 0 ? (
            <div className="h-36 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-400 rounded-full animate-spin" />
            </div>
          ) : fiData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={fiData} layout="vertical" barSize={10} margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" domain={[0, 40]} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="pct" fill="url(#fiGrad)" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: '#64748b', fontSize: 10, formatter: (v) => `${v}%` }}>
                  <defs>
                    <linearGradient id="fiGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-36 flex items-center justify-center text-xs text-slate-600">
              Feature data unavailable
            </div>
          )}
        </div>
      </div>

      {/* system status */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={15} className="text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-200">System Status</h3>
        </div>
        {health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'API Status',   value: <StatusBadge status={health.status} /> },
              { label: 'Database',     value: <StatusBadge status={health.database === 'connected' ? 'healthy' : 'degraded'} /> },
              { label: 'Model Loaded', value: <span className={`text-sm font-bold font-mono ${health.model_loaded ? 'text-emerald-400' : 'text-red-400'}`}>{health.model_loaded ? 'Yes' : 'No'}</span> },
              { label: 'Version',      value: <span className="text-sm font-mono text-slate-300">{health.version ?? 'n/a'}</span> },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">{label}</p>
                {value}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[0,1,2,3].map((i) => <div key={i} className="h-8 rounded-lg bg-white/4 animate-pulse" />)}
          </div>
        )}
      </div>

      {/* model info */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={15} className="text-cyan-500" />
          <h3 className="text-sm font-semibold text-slate-200">Model Info</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Algorithm',    value: mstats?.model_type ?? metrics?.algorithm ?? '—' },
            { label: 'Estimators',   value: mstats?.n_estimators != null ? `${mstats.n_estimators} trees` : '—' },
            { label: 'Features',     value: mstats?.n_features != null ? `${mstats.n_features} attributes` : '—' },
            { label: 'Dataset',      value: mstats?.dataset_size != null ? `${mstats.dataset_size.toLocaleString()} URLs` : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-mono text-slate-300 truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
