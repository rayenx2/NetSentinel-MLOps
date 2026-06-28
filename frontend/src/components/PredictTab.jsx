import { useState, useRef } from 'react'
import { Upload, AlertCircle, Download, CheckCircle, Shield, X, FileText } from 'lucide-react'

function buildCSV(rows) {
  if (!rows?.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n')
}

function ConfidenceBar({ label, isPhishing }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
      isPhishing
        ? 'bg-red-500/10 text-red-400 border-red-500/25'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isPhishing ? 'bg-red-400' : 'bg-emerald-400'}`} />
      {label}
    </span>
  )
}

export default function PredictTab() {
  const [file,    setFile]    = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [dragging,setDragging]= useState(false)
  const fileInputRef = useRef(null)

  function handleFileSelect(f) {
    if (!f) return
    if (!f.name.endsWith('.csv')) { setError('Only .csv files are accepted.'); return }
    setFile(f); setError(null); setResults(null)
  }

  async function runPrediction() {
    if (!file) return
    setLoading(true); setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/predict', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text() || `Server error ${res.status}`)
      setResults(await res.json())
    } catch (e) { setError(e.message || 'Prediction failed.') }
    finally { setLoading(false) }
  }

  function downloadCSV() {
    if (!results?.rows) return
    const blob = new Blob([buildCSV(results.rows)], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'netsentinel_results.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const featureCols = results?.rows?.length
    ? Object.keys(results.rows[0]).filter(k => k !== 'prediction' && k !== 'prediction_label')
    : []

  const rate = results ? (results.phishing_rate * 100).toFixed(1) : null

  return (
    <div className="space-y-5 animate-[fadeIn_0.4s_ease]">

      {/* ── upload zone ── */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]) }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        className={`relative rounded-2xl border-2 border-dashed p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-cyan-500 bg-cyan-500/5 scale-[1.01]'
            : file
            ? 'border-cyan-500/40 bg-cyan-500/4'
            : 'border-white/8 bg-[#0a1628]/50 hover:border-cyan-500/30 hover:bg-cyan-500/3'
        }`}
      >
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={e => handleFileSelect(e.target.files[0])} />

        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
          file ? 'bg-cyan-500/15 border border-cyan-500/30' : 'bg-white/5 border border-white/8'
        }`}>
          {file ? <FileText className="w-6 h-6 text-cyan-400" /> : <Upload className="w-6 h-6 text-slate-500" />}
        </div>

        {file ? (
          <div className="text-center">
            <p className="text-cyan-400 font-semibold text-sm">{file.name}</p>
            <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB — click Run to analyze</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-300 font-semibold text-sm">Drop CSV here or click to browse</p>
            <p className="text-slate-600 text-xs mt-1">30-feature URL vectors · UCI Phishing format</p>
          </div>
        )}

        {file && (
          <button onClick={e => { e.stopPropagation(); setFile(null); setResults(null) }}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── error ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── run button ── */}
      <button onClick={runPrediction} disabled={!file || loading}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
          !file || loading
            ? 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/6'
            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.4)]'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analyzing…
          </>
        ) : (
          <>
            <Shield size={15} />
            Run Detection
          </>
        )}
      </button>

      {/* ── summary cards ── */}
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total URLs',        value: results.total?.toLocaleString(),    color: 'text-slate-200',   border: 'border-white/8' },
            { label: 'Phishing Detected', value: results.phishing?.toLocaleString(), color: 'text-red-400',     border: 'border-red-500/20' },
            { label: 'Legitimate',        value: results.legitimate?.toLocaleString(),color: 'text-emerald-400', border: 'border-emerald-500/20' },
            { label: 'Phishing Rate',     value: `${rate}%`,                          color: parseFloat(rate) > 30 ? 'text-red-400' : 'text-emerald-400', border: 'border-white/8' },
          ].map(({ label, value, color, border }) => (
            <div key={label} className={`rounded-xl border ${border} bg-[#0a1628]/80 p-4 text-center`}>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* inference time pill */}
      {results?.latency_ms != null && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-mono">Inference:</span>
          <span className="font-mono text-violet-400 font-semibold">{results.latency_ms.toFixed(1)}ms</span>
          <span>·</span>
          <span>{results.total?.toLocaleString()} rows processed</span>
        </div>
      )}

      {/* truncation notice */}
      {results?.rows_truncated && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Showing first 500 rows — download CSV below for all {results.total?.toLocaleString()} results.
        </div>
      )}

      {/* ── results table ── */}
      {results?.rows?.length > 0 && (
        <div className="rounded-2xl border border-white/6 overflow-hidden bg-[#0a1628]/80">
          <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              Results — {results.rows.length.toLocaleString()} rows shown
            </span>
            <div className="flex gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-sm bg-red-400/80" /> Phishing
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-sm bg-emerald-400/80" /> Legitimate
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="max-h-[480px] overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0a1628]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] text-slate-600 font-semibold uppercase tracking-widest border-b border-white/5 w-10">#</th>
                    <th className="px-4 py-2.5 text-left text-[10px] text-slate-600 font-semibold uppercase tracking-widest border-b border-white/5 whitespace-nowrap">Label</th>
                    {featureCols.slice(0, 10).map(col => (
                      <th key={col} className="px-3 py-2.5 text-left text-[10px] text-slate-600 font-semibold uppercase tracking-widest border-b border-white/5 whitespace-nowrap">{col.replace(/_/g,' ')}</th>
                    ))}
                    {featureCols.length > 10 && (
                      <th className="px-3 py-2.5 text-left text-[10px] text-slate-600 border-b border-white/5 whitespace-nowrap">+{featureCols.length - 10} more</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, i) => {
                    const isPhishing = row.prediction_label === 'PHISHING'
                    return (
                      <tr key={i} className={`border-b border-white/3 transition-colors hover:bg-white/3 ${
                        isPhishing ? 'bg-red-500/3' : 'bg-emerald-500/3'
                      }`}>
                        <td className="px-4 py-2 text-slate-700 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <ConfidenceBar label={row.prediction_label ?? '—'} isPhishing={isPhishing} />
                        </td>
                        {featureCols.slice(0, 10).map(col => (
                          <td key={col} className={`px-3 py-2 text-center tabular-nums font-mono ${
                            row[col] === 1 ? 'text-cyan-500' : row[col] === -1 ? 'text-slate-600' : 'text-slate-400'
                          }`}>
                            {row[col]}
                          </td>
                        ))}
                        {featureCols.length > 10 && <td className="px-3 py-2 text-slate-700">…</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── download ── */}
      {results?.rows?.length > 0 && (
        <button onClick={downloadCSV}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/8 bg-white/4 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-xs font-semibold">
          <Download className="w-4 h-4" />
          Download Results CSV
        </button>
      )}
    </div>
  )
}
