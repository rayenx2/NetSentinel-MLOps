import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8090'
const POLL_MS = 5000

function useFetch(url, intervalMs) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (alive) { setData(json); setError(null); setLoading(false) }
      } catch (e) {
        if (alive) { setError(e.message); setLoading(false) }
      }
    }
    load()
    const id = setInterval(load, intervalMs)
    return () => { alive = false; clearInterval(id) }
  }, [url, intervalMs])

  return { data, loading, error }
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0d1525] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }} className="font-mono">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function MonitorTab() {
  const { data: feed, loading: feedLoading } = useFetch(`${API}/api/recent-predictions?limit=20`, POLL_MS)
  const { data: timeline, loading: tlLoading } = useFetch(`${API}/api/timeline`, POLL_MS)
  const [tick, setTick] = useState(0)
  const tickRef = useRef(null)

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

  const entries = feed?.entries ?? []
  const total = feed?.total ?? 0
  const phishingCount = entries.filter((e) => e.label === 'PHISHING').length
  const tlData = timeline?.timeline ?? []

  const phishingTotal = tlData.reduce((s, d) => s + d.phishing, 0)
  const legitTotal = tlData.reduce((s, d) => s + d.legitimate, 0)
  const grandTotal = phishingTotal + legitTotal
  const phishRate = grandTotal > 0 ? ((phishingTotal / grandTotal) * 100).toFixed(1) : '0.0'

  function timeSince(iso) {
    try {
      const diff = (Date.now() - new Date(iso).getTime()) / 1000
      if (diff < 60) return `${Math.floor(diff)}s ago`
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
      return `${Math.floor(diff / 3600)}h ago`
    } catch {
      return '—'
    }
  }

  return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Live Threat Monitor</h2>
          <p className="text-sm text-slate-400 mt-1">
            Auto-refreshes every {POLL_MS / 1000}s — real predictions from the running model
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '24h Phishing', value: phishingTotal, color: 'text-red-400' },
          { label: '24h Legitimate', value: legitTotal, color: 'text-emerald-400' },
          { label: 'Phishing Rate', value: `${phishRate}%`, color: phishRate > 30 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Log Total', value: total, color: 'text-cyan-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/6 bg-white/3 px-4 py-3">
            <div className="text-[11px] text-slate-500 mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>
              {tlLoading && c.label !== 'Log Total' ? '—' : feedLoading && c.label === 'Log Total' ? '—' : c.value}
            </div>
          </div>
        ))}
      </div>

      {/* 24h timeline chart */}
      <div className="rounded-xl border border-white/6 bg-white/2 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-300">Threat Severity — Last 24 Hours</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/80" />Phishing</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" />Legitimate</span>
          </div>
        </div>

        {tlLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-slate-600">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tlData} barSize={8} barGap={2}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: '#475569' }}
                interval={3}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
                width={24}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="phishing" name="Phishing" fill="#ef444480" radius={[2, 2, 0, 0]}>
                {tlData.map((entry, i) => (
                  <Cell key={i} fill={entry.phishing > 0 ? '#ef4444' : '#ef444430'} />
                ))}
              </Bar>
              <Bar dataKey="legitimate" name="Legitimate" fill="#10b98160" radius={[2, 2, 0, 0]}>
                {tlData.map((entry, i) => (
                  <Cell key={i} fill={entry.legitimate > 0 ? '#10b981' : '#10b98130'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* live feed */}
      <div className="rounded-xl border border-white/6 bg-white/2 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-300">
            Recent Predictions
            {entries.length > 0 && (
              <span className="ml-2 text-xs text-slate-600 font-normal">
                (showing last {entries.length})
              </span>
            )}
          </p>
          <span className="text-[10px] text-slate-600 font-mono">
            {new Date().toLocaleTimeString()}
          </span>
        </div>

        {feedLoading ? (
          <div className="h-20 flex items-center justify-center text-sm text-slate-600">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="h-20 flex items-center justify-center">
            <p className="text-sm text-slate-600">
              No predictions logged yet — run a classification first
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {entries.map((e, i) => {
              const isP = e.label === 'PHISHING'
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-lg border text-xs ${
                    isP
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-emerald-500/15 bg-emerald-500/4'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isP ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <span className={`font-bold ${isP ? 'text-red-400' : 'text-emerald-400'}`}>
                      {e.label}
                    </span>
                    <span className="text-slate-600 font-mono truncate text-[10px]">
                      {e.model_version ?? '1.0.0'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {e.latency_ms != null && (
                      <span className="text-slate-600 font-mono">{e.latency_ms.toFixed(1)}ms</span>
                    )}
                    <span className="text-slate-600">{timeSince(e.timestamp)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
