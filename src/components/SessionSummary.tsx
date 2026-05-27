interface Props {
  reps: number
  avgFormScore: number
  elapsedSeconds: number
  bestStreak: number
  onClose: () => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = String(s % 60).padStart(2, '0')
  return `${m}:${sec}`
}

const scoreGrade = (s: number) =>
  s >= 85 ? { label: 'Elite', color: '#39ff14' }
  : s >= 70 ? { label: 'Good',  color: '#00f0ff' }
  : s >= 50 ? { label: 'Fair',  color: '#ffd700' }
  : { label: 'Keep training', color: '#ff4d4d' }

export function SessionSummary({ reps, avgFormScore, elapsedSeconds, bestStreak, onClose }: Props) {
  const grade = scoreGrade(avgFormScore)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div
        className="w-full max-w-sm rounded-2xl border p-6 space-y-5"
        style={{
          background: '#0a0a0a',
          borderColor: 'rgba(0,240,255,0.3)',
          boxShadow: '0 0 40px rgba(0,240,255,0.1)',
        }}
      >
        {/* Title */}
        <div className="text-center">
          <h2
            className="text-2xl font-black tracking-widest uppercase"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#00f0ff' }}
          >
            Session Complete
          </h2>
          <p className="text-white/30 text-sm mt-1" style={{ fontFamily: '"Space Mono", monospace' }}>
            {grade.label}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Reps',         value: String(reps),           accent: '#00f0ff' },
            { label: 'Time',         value: fmt(elapsedSeconds),    accent: '#00f0ff' },
            { label: 'Form Score',   value: `${avgFormScore}%`,     accent: grade.color },
            { label: 'Best Streak',  value: `${bestStreak} reps`,   accent: '#39ff14' },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}22` }}
            >
              <div className="text-2xl font-black tabular-nums" style={{ fontFamily: '"Orbitron", sans-serif', color: accent }}>
                {value}
              </div>
              <div className="text-white/30 text-xs uppercase tracking-wider mt-0.5" style={{ fontFamily: '"Space Mono", monospace' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-black uppercase tracking-widest transition-all active:scale-95"
          style={{
            fontFamily: '"Orbitron", sans-serif',
            background: '#00f0ff',
            boxShadow: '0 0 16px rgba(0,240,255,0.5)',
          }}
        >
          Train Again
        </button>
      </div>
    </div>
  )
}
