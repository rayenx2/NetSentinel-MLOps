import { useState, useRef } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8090'

// Feature metadata: importance = real weight from model.pkl feature_importances_
const FEATURE_META = [
  { key: 'having_IP_Address',           label: 'IP in URL',              importance: 0.47,  phish: 'Raw IP address used',         safe: 'Normal domain name' },
  { key: 'URL_Length',                  label: 'URL Length',             importance: 1.34,  phish: 'Suspiciously long URL',        safe: 'Normal length' },
  { key: 'Shortining_Service',          label: 'URL Shortener',          importance: 0.38,  phish: 'Shortener detected',           safe: 'No shortener used' },
  { key: 'having_At_Symbol',            label: '@ Symbol',               importance: 0.30,  phish: '@ found — hides real domain',  safe: 'No @ symbol' },
  { key: 'double_slash_redirecting',    label: 'Double Slash Redirect',  importance: 0.34,  phish: 'Redirect via //',              safe: 'No redirect' },
  { key: 'Prefix_Suffix',               label: 'Hyphen in Domain',       importance: 5.42,  phish: 'Typosquat hyphen (pay-pal)',   safe: 'Clean domain' },
  { key: 'having_Sub_Domain',           label: 'Subdomain Depth',        importance: 5.97,  phish: 'Suspicious subdomain depth',   safe: 'Normal subdomains' },
  { key: 'SSLfinal_State',              label: 'SSL Certificate',        importance: 33.81, phish: 'Invalid / self-signed cert',   safe: 'Valid SSL certificate' },
  { key: 'Domain_registeration_length', label: 'Domain Age',             importance: 1.95,  phish: 'Domain < 1 year old',         safe: 'Established domain' },
  { key: 'Favicon',                     label: 'Favicon Source',         importance: 0.68,  phish: 'Favicon from external domain', safe: 'Same-domain favicon' },
  { key: 'port',                        label: 'Non-standard Port',      importance: 0.73,  phish: 'Unusual port used',            safe: 'Standard port (80/443)' },
  { key: 'HTTPS_token',                 label: '"HTTPS" in Domain Name', importance: 0.64,  phish: 'Fake "https" in domain',      safe: 'No deceptive token' },
  { key: 'Request_URL',                 label: 'External Resources',     importance: 1.87,  phish: 'Page loads from other sites',  safe: 'Self-hosted resources' },
  { key: 'URL_of_Anchor',               label: 'Anchor Link Targets',    importance: 21.09, phish: 'Links point to other domains', safe: 'Links stay on this site' },
  { key: 'Links_in_tags',               label: 'Tag Link Targets',       importance: 4.09,  phish: 'Scripts load from elsewhere',  safe: 'Scripts from own server' },
  { key: 'SFH',                         label: 'Form Submission Target', importance: 2.35,  phish: 'Form posts to another site',   safe: 'Form stays on same site' },
  { key: 'Submitting_to_email',         label: 'Form Emails Your Input', importance: 0.29,  phish: 'mailto: in form action',      safe: 'Normal form submit' },
  { key: 'Abnormal_URL',                label: 'Abnormal URL',           importance: 0.51,  phish: 'URL mismatches WHOIS data',    safe: 'URL matches WHOIS' },
  { key: 'Redirect',                    label: 'Redirect Count',         importance: 0.56,  phish: 'More than 4 redirects',        safe: '0–1 redirects' },
  { key: 'on_mouseover',                label: 'Mouseover Status Trick', importance: 0.22,  phish: 'Status bar is manipulated',    safe: 'No mouseover trick' },
  { key: 'RightClick',                  label: 'Right-click Disabled',   importance: 0.19,  phish: 'Inspect disabled',             safe: 'Right-click works' },
  { key: 'popUpWidnow',                 label: 'Credential Popup',       importance: 0.24,  phish: 'Popup asks for credentials',   safe: 'No credential popup' },
  { key: 'Iframe',                      label: 'Hidden IFrame',          importance: 0.31,  phish: 'Invisible iframe present',     safe: 'No hidden iFrame' },
  { key: 'age_of_domain',               label: 'Domain Age (WHOIS)',     importance: 1.28,  phish: 'Domain < 6 months old',       safe: 'Domain > 6 months' },
  { key: 'DNSRecord',                   label: 'DNS Record',             importance: 1.23,  phish: 'No DNS record found',          safe: 'DNS record exists' },
  { key: 'web_traffic',                 label: 'Web Traffic Rank',       importance: 7.83,  phish: 'No measurable traffic',        safe: 'Known & ranked site' },
  { key: 'Page_Rank',                   label: 'Google PageRank',        importance: 1.05,  phish: 'PageRank = 0',                 safe: 'Has PageRank' },
  { key: 'Google_Index',                label: 'Google Indexed',         importance: 0.63,  phish: 'Not in Google index',          safe: 'Google has indexed it' },
  { key: 'Links_pointing_to_page',      label: 'Backlinks',              importance: 1.93,  phish: 'Almost no backlinks',          safe: 'Has external backlinks' },
  { key: 'Statistical_report',          label: 'Blacklist Status',       importance: 0.70,  phish: 'IP/domain on a blacklist',     safe: 'Not blacklisted' },
]


function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].replace(/"/g, '').split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line, i) => ({
    _idx: i,
    vals: line.split(',').map((v) => parseFloat(v.trim())),
  }))
  return { headers, rows }
}

function truthLabel(val) {
  if (val === 1)  return 'PHISHING'
  if (val === -1) return 'LEGITIMATE'
  return null
}

export default function ClassifyTab() {
  const [rows, setRows]           = useState([])
  const [headers, setHeaders]     = useState([])
  const [resultIdx, setResultIdx] = useState(-1)
  const [selected, setSelected]   = useState(null)
  const [result, setResult]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [fileName, setFileName]   = useState(null)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result)
      const ri = headers.findIndex((h) => h.toLowerCase() === 'result')
      setHeaders(headers)
      setRows(rows.slice(0, 200))
      setResultIdx(ri)
      setSelected(null)
      setResult(null)
      setError(null)
    }
    reader.readAsText(file)
  }

  async function classify(row) {
    setSelected(row)
    setLoading(true)
    setError(null)
    setResult(null)

    const featureCols = headers
      .map((h, i) => ({ h: h.trim(), i }))
      .filter(({ h }) => h.toLowerCase() !== 'result')
    const features = featureCols.map(({ i }) => row.vals[i] ?? 0)

    if (features.length !== 30) {
      setError(`Expected 30 feature columns, got ${features.length}.`)
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`${API}/api/predict-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const trueVal = resultIdx >= 0 ? row.vals[resultIdx] : null
      setResult({ ...data, features, trueLabel: truthLabel(trueVal) })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isPhishing = result?.label === 'PHISHING'
  const correct    = result?.trueLabel ? result.label === result.trueLabel : null

  // Sort features by importance desc, split into suspicious/safe
  const withVals = result
    ? FEATURE_META.map((f, i) => ({ ...f, val: result.features[i] }))
        .sort((a, b) => b.importance - a.importance)
    : []
  const suspiciousFeatures = withVals.filter((f) => f.val === 1)
  const safeFeatures       = withVals.filter((f) => f.val === -1)

  // Top 3 decisive features (highest importance, any direction)
  const topDecisive = withVals.slice(0, 3)

  // Actual model probabilities from API
  const pPhishing   = result?.p_phishing   ?? null
  const pLegitimate = result?.p_legitimate ?? null

  function rowSignalCounts(row) {
    const featureCols = headers
      .map((h, i) => ({ h: h.trim(), i }))
      .filter(({ h }) => h.toLowerCase() !== 'result')
    const features = featureCols.map(({ i }) => row.vals[i] ?? 0)
    const sus = features.filter((v) => v === 1).length
    const saf = features.filter((v) => v === -1).length
    return { sus, saf, total: features.length }
  }

  function sigDot(val) {
    return (
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
        val === 1 ? 'bg-red-500' : val === -1 ? 'bg-emerald-500' : 'bg-slate-600'
      }`} />
    )
  }

  const sslIdx = headers.findIndex((h) => h.trim() === 'SSLfinal_State')
  const ancIdx = headers.findIndex((h) => h.trim() === 'URL_of_Anchor')
  const trfIdx = headers.findIndex((h) => h.trim() === 'web_traffic')

  return (
    <div className="space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100">URL Threat Classifier</h2>
        <p className="text-sm text-slate-400 mt-1">
          Upload the phishing CSV — each row is one URL reduced to 30 security signals. Click any row to classify it.
        </p>
      </div>

      {/* signal legend */}
      <div className="flex flex-wrap items-center gap-5 text-xs rounded-xl border border-white/5 bg-white/2 px-5 py-3">
        <span className="font-semibold text-slate-500 uppercase tracking-wide">Signal values:</span>
        {[
          { val: '1',  dot: 'bg-red-500',     label: 'Suspicious — phishing indicator' },
          { val: '-1', dot: 'bg-emerald-500',  label: 'Safe — legitimate indicator' },
          { val: '0',  dot: 'bg-slate-600',    label: 'Neutral — not conclusive' },
        ].map(({ val, dot, label }) => (
          <span key={val} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="font-mono font-bold text-slate-300">{val}</span>
            <span className="text-slate-600">= {label}</span>
          </span>
        ))}
      </div>

      {/* important note */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300/80 leading-relaxed">
        <span className="font-semibold text-amber-300">Why can a row look risky but classify as LEGITIMATE?</span>
        {' '}The model doesn't count signals equally.{' '}
        <span className="text-amber-200 font-semibold">SSL Certificate alone = 33.8%</span> of the model's decision weight,
        and <span className="text-amber-200 font-semibold">Anchor Links = 21.1%</span>.
        {' '}If those two are green, they can outweigh 18 other red signals.
        The <span className="font-semibold">Risk bar uses real importance weights</span>, not raw counts.
      </div>

      {/* upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="relative rounded-xl border-2 border-dashed border-white/10 bg-white/2 hover:border-cyan-500/30 hover:bg-cyan-500/3 transition-all cursor-pointer p-6 text-center"
      >
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-slate-600 mx-auto mb-2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {fileName
          ? <p className="text-sm text-cyan-400 font-semibold">{fileName} — {rows.length} rows loaded</p>
          : <p className="text-sm text-slate-500">Click to upload <code className="text-slate-400">phisingData.csv</code></p>
        }
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 text-xs">{error}</div>
      )}

      {rows.length === 0 && !error && (
        <div className="rounded-xl border border-white/5 bg-white/2 p-10 text-center space-y-2">
          <p className="text-sm text-slate-600">Upload the CSV to start classifying rows</p>
          <p className="text-xs text-slate-700">11,055 rows · 30 security signals per URL · ground truth labels included</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* table */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                URLs (first {rows.length}) — click to classify
              </p>
            </div>
            <div className="rounded-xl border border-white/6 overflow-hidden">
              <div className="overflow-y-auto max-h-[540px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0a1628] border-b border-white/6 z-10">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-slate-600 w-10">#</th>
                      <th className="text-left px-3 py-2.5 text-slate-500">
                        Signals
                        <span className="text-[10px] text-slate-700 font-normal ml-1">(red / green)</span>
                      </th>
                      <th className="text-center px-2 py-2.5 text-slate-600" title="SSLfinal_State — 33.8% weight">SSL</th>
                      <th className="text-center px-2 py-2.5 text-slate-600" title="URL_of_Anchor — 21.1% weight">Anchor</th>
                      <th className="text-center px-2 py-2.5 text-slate-600" title="web_traffic — 7.8% weight">Traffic</th>
                      {resultIdx >= 0 && (
                        <th className="text-left px-3 py-2.5 text-slate-600">Truth</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isActive = selected?._idx === row._idx
                      const { sus, saf } = rowSignalCounts(row)
                      const truth = resultIdx >= 0 ? row.vals[resultIdx] : null
                      return (
                        <tr
                          key={row._idx}
                          onClick={() => classify(row)}
                          className={`border-b border-white/4 cursor-pointer transition-colors ${
                            isActive ? 'bg-cyan-500/10' : 'hover:bg-white/3'
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-600 font-mono">{row._idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-red-400">{sus}🔴</span>
                              <span className="text-slate-700">/</span>
                              <span className="text-[10px] font-mono text-emerald-400">{saf}🟢</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">{sigDot(row.vals[sslIdx])}</td>
                          <td className="px-2 py-2 text-center">{sigDot(row.vals[ancIdx])}</td>
                          <td className="px-2 py-2 text-center">{sigDot(row.vals[trfIdx])}</td>
                          {resultIdx >= 0 && (
                            <td className="px-3 py-2">
                              <span className={`font-semibold text-[10px] ${truth === 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {truth === 1 ? 'PHISH' : 'LEGIT'}
                              </span>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* result */}
          <div className="flex flex-col space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Classification Result
            </p>

            {!result && !loading && (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-white/5 bg-white/2 min-h-[300px]">
                <p className="text-sm text-slate-600">← Click any row to classify it</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/5 min-h-[300px]">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-cyan-400">Classifying…</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                {/* verdict */}
                <div className={`rounded-xl border p-5 ${
                  isPhishing ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-2xl font-black ${isPhishing ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isPhishing ? '🚨 PHISHING' : '✅ LEGITIMATE'}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        30 signals evaluated in <span className="text-slate-300 font-mono">{result.latency_ms}ms</span>
                      </p>
                    </div>
                    {result.trueLabel && (
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-600 mb-1">Ground truth (CSV)</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                          result.trueLabel === 'PHISHING'
                            ? 'bg-red-500/10 border-red-500/25 text-red-400'
                            : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        }`}>
                          {result.trueLabel}
                        </span>
                        <p className={`text-[10px] mt-1 font-bold ${correct ? 'text-emerald-400' : 'text-red-400'}`}>
                          {correct ? '✓ Correct' : '✗ Misclassified'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* actual model confidence from predict_proba */}
                  {pPhishing !== null && (
                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
                        Model confidence — 16 trees voting
                      </p>
                      {/* phishing bar */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] text-red-400">Phishing</span>
                          <span className="text-[11px] font-mono font-bold text-red-400">{pPhishing}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-red-500 transition-all duration-700" style={{ width: `${pPhishing}%` }} />
                        </div>
                      </div>
                      {/* legitimate bar */}
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] text-emerald-400">Legitimate</span>
                          <span className="text-[11px] font-mono font-bold text-emerald-400">{pLegitimate}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pLegitimate}%` }} />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-600">
                        These are real votes from {16} decision trees — not a weighted estimate
                      </p>
                    </div>
                  )}
                </div>

                {/* top 3 decisive features */}
                <div className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">3 most decisive signals</p>
                  {topDecisive.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          f.val === 1 ? 'bg-red-500' : f.val === -1 ? 'bg-emerald-500' : 'bg-slate-600'
                        }`} />
                        <span className="text-xs text-slate-300 truncate">{f.label}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-16 h-1 rounded-full bg-white/8 overflow-hidden">
                          <div className="h-full rounded-full bg-violet-500" style={{ width: `${(f.importance / 33.81) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 w-10 text-right">{f.importance}%</span>
                        <span className={`text-[10px] font-semibold w-20 text-right ${
                          f.val === 1 ? 'text-red-400' : f.val === -1 ? 'text-emerald-400' : 'text-slate-600'
                        }`}>
                          {f.val === 1 ? f.phish : f.val === -1 ? f.safe : 'neutral'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* suspicious signals */}
                {suspiciousFeatures.length > 0 && (
                  <div className="rounded-xl border border-red-500/15 bg-red-500/4 p-4 space-y-2">
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                      {suspiciousFeatures.length} suspicious signals
                    </p>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {suspiciousFeatures.map((f) => (
                        <div key={f.key} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-300">{f.label}</span>
                              <span className="text-xs text-slate-500"> — {f.phish}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 shrink-0">{f.importance}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* safe signals */}
                {safeFeatures.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/4 p-4 space-y-2">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                      {safeFeatures.length} safe signals
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {safeFeatures.map((f) => (
                        <div key={f.key} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-300">{f.label}</span>
                              <span className="text-xs text-slate-500"> — {f.safe}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 shrink-0">{f.importance}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
