import { gradeForScore, type AgeGroup, type FitnessLevel } from '../utils/profile'
import { glass, glassTint, fontHead, fontMono, softGlow, ACCENT, ACCENT_GREEN, ACCENT_GOLD } from '../styles/glass'

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
  ageGroup?: AgeGroup
  fitnessLevel?: FitnessLevel
  onClose: () => void
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Simple inline SVG bar chart of form scores per rep
function FormChart({ records }: { records: RepRecord[] }) {
  if (!records.length) return null
  const W = 260, H = 60, BAR_W = Math.max(4, Math.floor((W - 4) / Math.max(records.length, 1)) - 2)

  return (
    <div className="rounded-3xl p-4" style={glass}>
      <p style={{ ...fontMono, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Form per rep
      </p>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {records.map((r, i) => {
          const bh     = Math.max(2, (r.score / 100) * H)
          const color  = r.score >= 70 ? ACCENT_GREEN : r.score >= 50 ? ACCENT_GOLD : '#f87171'
          const x      = i * (BAR_W + 2)
          return (
            <g key={i}>
              <rect x={x} y={H - bh} width={BAR_W} height={bh} fill={color} rx={3} opacity={0.9} />
            </g>
          )
        })}
        <line x1={0} y1={H * 0.3} x2={W} y2={H * 0.3} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="3,3" />
      </svg>
    </div>
  )
}

export function SessionSummary({
  reps, halfReps, avgFormScore, elapsedSeconds, bestStreak,
  calories, tut, volume, unit, repRecords, ageGroup, fitnessLevel, onClose,
}: Props) {
  const g = gradeForScore(avgFormScore, ageGroup ?? 'adult', fitnessLevel ?? 'intermediate')
  const volLbl  = unit === 'imperial' ? `${Math.round(volume * 2.205)} lbs` : `${volume} kg`
  const tutFmt  = tut >= 60 ? `${Math.floor(tut/60)}m ${tut%60}s` : `${tut}s`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3 overflow-y-auto py-4"
      style={{ background: 'rgba(7,8,16,0.6)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      <div className="w-full max-w-sm rounded-[28px] p-5 space-y-4" style={glass}>
        <div className="text-center">
          <h2 style={{ ...fontHead, fontSize: 20, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', background: `linear-gradient(135deg,#fff,${ACCENT})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Session Complete
          </h2>
          <p style={{ ...fontMono, fontSize: 12, color: g.c, marginTop: 4 }}>{g.label}</p>
        </div>

        {/* Main stats */}
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { lbl: 'Reps',        val: halfReps > 0 ? `${reps} (+${halfReps}½)` : String(reps), c: ACCENT       },
            { lbl: 'Time',        val: fmt(elapsedSeconds),                                       c: ACCENT       },
            { lbl: 'Form Score',  val: `${avgFormScore}%`,                                        c: g.c          },
            { lbl: 'Best Streak', val: `${bestStreak}🔥`,                                          c: ACCENT_GREEN },
            { lbl: 'Calories',    val: `${calories} kcal`,                                         c: ACCENT_GOLD  },
            { lbl: 'TUT',         val: tutFmt,                                                     c: ACCENT_GOLD  },
            { lbl: 'Volume',      val: volLbl,                                                     c: ACCENT_GREEN },
          ].map(({ lbl, val, c }) => (
            <div key={lbl} className="rounded-2xl p-3 text-center" style={glassTint(c)}>
              <div style={{ ...fontHead, fontSize: 15, fontWeight: 900, color: c, lineHeight: 1 }}>{val}</div>
              <div style={{ ...fontMono, fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Form chart */}
        <FormChart records={repRecords} />

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-3xl font-black uppercase tracking-widest active:scale-[0.97] transition-transform"
          style={{ ...fontHead, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, boxShadow: softGlow(ACCENT), fontSize: 13 }}
        >
          Train Again
        </button>
      </div>
    </div>
  )
}
