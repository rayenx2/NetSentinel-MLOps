import { Shield, Database, Cpu, Globe, Github, Linkedin, ExternalLink } from 'lucide-react'

const TECH = [
  { tech: 'Python 3.10',        purpose: 'Core language',                    color: 'text-yellow-400' },
  { tech: 'FastAPI',            purpose: 'Async REST API',                   color: 'text-emerald-400' },
  { tech: 'scikit-learn 1.7',  purpose: 'Ensemble classifiers + GridSearchCV', color: 'text-orange-400' },
  { tech: 'MLflow 2.19',       purpose: 'Experiment tracking + model registry', color: 'text-blue-400' },
  { tech: 'MongoDB 7.0',       purpose: 'Raw data ingestion',                color: 'text-green-400' },
  { tech: 'React + Vite',      purpose: 'This dashboard',                    color: 'text-cyan-400' },
  { tech: 'Recharts',          purpose: 'Charts & data visualization',        color: 'text-violet-400' },
  { tech: 'Docker Compose',    purpose: 'Local orchestration',                color: 'text-sky-400' },
]

const ENDPOINTS = [
  { method: 'GET',  path: '/health',      desc: 'System health check' },
  { method: 'GET',  path: '/metrics',     desc: 'Prediction statistics + model info' },
  { method: 'POST', path: '/api/predict', desc: 'Batch CSV classification (JSON)' },
  { method: 'GET',  path: '/train',       desc: 'Trigger retraining pipeline' },
  { method: 'GET',  path: '/docs',        desc: 'Interactive Swagger UI' },
]

const PIPELINE = [
  { step: '01', label: 'Ingest',    desc: 'Raw URL dataset loaded into MongoDB' },
  { step: '02', label: 'Validate',  desc: 'Schema check + KS drift detection' },
  { step: '03', label: 'Engineer',  desc: '30 URL feature extraction' },
  { step: '04', label: 'Train',     desc: '5-model ensemble, GridSearchCV F1 selection' },
  { step: '05', label: 'Register',  desc: 'MLflow staging → production promotion' },
  { step: '06', label: 'Serve',     desc: 'FastAPI async inference endpoint' },
]

const METHOD_STYLE = {
  GET:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  POST: 'bg-blue-500/10   text-blue-400   border-blue-500/25',
}

export default function AboutTab() {
  return (
    <div className="space-y-5 animate-[fadeIn_0.4s_ease]">

      {/* ── overview ── */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-200">Project Overview</h2>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          <span className="text-slate-200 font-semibold">NetSentinel-MLOps</span> is an end-to-end MLOps pipeline that
          classifies URLs as{' '}
          <span className="text-red-400 font-semibold">PHISHING</span> or{' '}
          <span className="text-emerald-400 font-semibold">LEGITIMATE</span> using an ensemble of five classifiers
          (RandomForest, GradientBoosting, AdaBoost, DecisionTree, LogisticRegression) trained on{' '}
          <span className="text-cyan-400">11,055 URLs</span> from the UCI Phishing Websites Detection dataset
          with 30 engineered URL features. The best model is automatically selected by GridSearchCV F1
          and registered in MLflow.
        </p>
      </div>

      {/* ── pipeline steps ── */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Cpu className="w-4 h-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-200">MLOps Pipeline</h2>
        </div>
        <div className="relative">
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-violet-500/20 to-transparent" />
          <div className="space-y-4">
            {PIPELINE.map(({ step, label, desc }) => (
              <div key={step} className="flex items-start gap-4 pl-1">
                <div className="w-10 h-10 rounded-full border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center flex-shrink-0 z-10">
                  <span className="text-[10px] font-bold font-mono text-cyan-400">{step}</span>
                </div>
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-200 mr-2">{label}</span>
                  <span className="text-xs text-slate-500">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── tech stack ── */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-200">Tech Stack</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {TECH.map(({ tech, purpose, color }) => (
            <div key={tech} className="flex items-center gap-3 rounded-xl bg-white/3 border border-white/5 px-4 py-3 hover:bg-white/5 transition-colors">
              <span className={`font-mono text-xs font-bold w-32 flex-shrink-0 ${color}`}>{tech}</span>
              <span className="text-xs text-slate-500">{purpose}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── api reference ── */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-slate-200">API Reference</h2>
        </div>
        <div className="space-y-2">
          {ENDPOINTS.map(({ method, path, desc }) => (
            <div key={path} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/2 px-4 py-3 hover:bg-white/4 transition-colors">
              <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider border ${METHOD_STYLE[method]}`}>
                {method}
              </span>
              <code className="shrink-0 font-mono text-xs text-slate-300">{path}</code>
              <span className="text-slate-600">—</span>
              <span className="text-xs text-slate-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── results ── */}
      <div className="rounded-2xl border border-white/6 bg-[#0a1628]/80 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-200">Results</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Dataset',          value: '11,055 URLs',   sub: 'UCI Phishing Dataset' },
            { label: 'Features',         value: '30',            sub: 'URL attributes' },
            { label: 'Phishing Recall',  value: '94%+',          sub: 'on test set' },
            { label: 'False Positive',   value: '< 5%',          sub: 'legit flagged as phishing' },
            { label: 'Inference',        value: '< 1ms',         sub: 'per URL batch' },
            { label: 'Drift Detection',  value: 'KS p < 0.05',   sub: '30 features monitored' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl bg-white/3 border border-white/5 p-4 text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-base font-bold font-mono text-cyan-400">{value}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── author ── */}
      <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center font-bold text-sm text-cyan-400">
              RL
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Rayen Lassoued</p>
              <p className="text-xs text-slate-500">AI / ML Engineer · Bonn, Germany</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://github.com/rayenx2" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all text-xs">
              <Github size={13} /> github.com/rayenx2
            </a>
            <a href="https://linkedin.com/in/Rayen-Lassoued" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-all text-xs">
              <Linkedin size={13} /> LinkedIn
            </a>
          </div>
        </div>
      </div>

    </div>
  )
}
