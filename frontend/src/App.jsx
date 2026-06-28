import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import PredictTab from './components/PredictTab'
import ClassifyTab from './components/ClassifyTab'
import MonitorTab from './components/MonitorTab'
import AboutTab from './components/AboutTab'

const TABS = [
  { path: '/dashboard', label: 'Dashboard'    },
  { path: '/predict',   label: 'Batch Predict' },
  { path: '/classify',  label: 'Classify'      },
  { path: '/monitor',   label: 'Monitor'       },
  { path: '/about',     label: 'About'         },
]

export default function App() {
  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 antialiased">

      {/* ── top glow ── */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[1px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[400px] h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

      {/* ── navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#060b14]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">

            {/* logo */}
            <NavLink to="/dashboard" className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-cyan-400">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-sm tracking-tight">
                  Net<span className="text-cyan-400">Sentinel</span>
                  <span className="text-slate-500 font-normal text-[11px] ml-1">MLOps</span>
                </span>
                <span className="text-[9px] text-slate-600 font-mono tracking-[0.15em] uppercase mt-0.5">
                  Phishing Detection
                </span>
              </div>
            </NavLink>

            {/* tabs */}
            <div className="flex items-center gap-0.5 bg-white/5 border border-white/8 rounded-xl p-1">
              {TABS.map((tab) => (
                <NavLink
                  key={tab.path}
                  to={tab.path}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>

          </div>
        </div>
      </nav>

      {/* ── content ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/predict"   element={<PredictTab />} />
          <Route path="/classify"  element={<ClassifyTab />} />
          <Route path="/monitor"   element={<MonitorTab />} />
          <Route path="/about"     element={<AboutTab />} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}
