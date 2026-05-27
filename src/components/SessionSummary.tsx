interface RepRecord { score: number; depth: number }

interface Props {
  reps: number
  halfReps: number
  avgFormScore: number
  elapsedSeconds: number
  bestStreak: number
  calories: number
  tut: number
  volume: number
  unit: 'metric' | 'imperial'
  repRecords: RepRecord[]
  onClose: () => void
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const grade = (s: number) =>
  s >= 85 ? { label: 'Elite',         c: '#39ff14' }
  : s >= 70 ? { label: 'Good',         c: '#00f0ff' }
  : s >= 50 ? { label: 'Fair',         c: '#ffd700' }
  : { label: 'Keep Training',          c: '#ff4d4d' }

// Simple inline SVG bar chart of form scores per rep
function FormChart({ records }: { records: RepRecord[] }) {
  if (!records.length) return null
  const W = 260, H = 60, BAR_W = Math.max(4, Math.floor((W - 4) / Math.max(records.length, 1)) - 2)

  return (
    <div>
      <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        Form per rep
      </p>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {records.map((r, i) => {
          const bh     = Math.max(2, (r.score / 100) * H)
          const color  = r.score >= 70 ? '#39ff14' : r.score >= 50 ? '#ffd700' : '#ff4d4d'
          const x      = i * (BAR_W + 2)
          return (
            <g key={i}>
              <rect x={x} y={H - bh} width={BAR_W} height={bh} fill={color} rx={2} opacity={0.85} />
            </g>
          )
        })}
        {/* Ideal line at 70% */}
        <line x1={0} y1={H * 0.3} x2={W} y2={H * 0.3} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3,3" />
      </svg>
    </div>
  )
}

export function SessionSummary({
  reps, halfReps, avgFormScore, elapsedSeconds, bestStreak,
  calories, tut, volume, unit, repRecords, onClose,
}: Props) {
  const g       = grade(avgFormScore)
  const volLbl  = unit === 'imperial' ? `${Math.round(volume * 2.205)} lbs` : `${volume} kg`
  const tutFmt  = tut >= 60 ? `${Math.floor(tut/60)}m ${tut%60}s` : `${tut}s`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md px-3 overflow-y-auto py-4">
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: '#0a0a0a', border: '1px solid rgba(0,240,255,0.3)', boxShadow: '0 0 40px rgba(0,240,255,0.1)' }}
      >
        <div className="text-center">
          <h2 style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 20, fontWeight: 900, color: '#00f0ff', letterSpacing: 4, textTransform: 'uppercase' }}>
            Session Complete
          </h2>
          <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: g.c, marginTop: 2 }}>{g.label}</p>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { lbl: 'Reps',        val: halfReps > 0 ? `${reps} (+${halfReps}½)` : String(reps), c: '#00f0ff' },
            { lbl: 'Time',        val: fmt(elapsedSeconds),                                       c: '#00f0ff' },
            { lbl: 'Form Score',  val: `${avgFormScore}%`,                                        c: g.c       },
            { lbl: 'Best Streak', val: `${bestStreak}🔥`,                                          c: '#39ff14' },
            { lbl: 'Calories',    val: `${calories} kcal`,                                         c: '#ffd700' },
            { lbl: 'TUT',         val: tutFmt,                                                     c: '#ffd700' },
            { lbl: 'Volume',      val: volLbl,                                                     c: '#39ff14' },
          ].map(({ lbl, val, c }) => (
            <div key={lbl} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c}22` }}>
              <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 14, fontWeight: 900, color: c, lineHeight: 1 }}>{val}</div>
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Form chart */}
        <FormChart records={repRecords} />

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-black text-black uppercase tracking-widest transition-all active:scale-95"
          style={{ fontFamily: '"Orbitron", sans-serif', background: '#00f0ff', boxShadow: '0 0 16px rgba(0,240,255,0.5)', fontSize: 13 }}
        >
          Train Again
        </button>
      </div>
    </div>
  )
}
