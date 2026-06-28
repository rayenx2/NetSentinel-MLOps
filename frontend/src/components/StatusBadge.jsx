export default function StatusBadge({ status }) {
  const ok = status === 'healthy' || status === 'connected' || status === 'ok'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
      ok
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
        : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
      {status ?? 'unknown'}
    </span>
  )
}
