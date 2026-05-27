import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHistory, getTotalStats, getActiveDays, clearHistory, type WorkoutSession } from '../utils/workoutHistory'
import { EXERCISES } from '../utils/exercises'

const mono = { fontFamily: '"Space Mono", monospace' }
const orb  = { fontFamily: '"Orbitron", sans-serif' }

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}
function fmtDur(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

function StatBox({ label, value, c = '#00f0ff' }: { label: string; value: string | number; c?: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c}22` }}>
      <div style={{ ...orb, fontSize: 18, fontWeight: 900, color: c, lineHeight: 1 }}>{value}</div>
      <div style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 3, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label}</div>
    </div>
  )
}

function SessionCard({ s }: { s: WorkoutSession }) {
  const ex = EXERCISES[s.exercise]
  const scoreColor = s.avgFormScore >= 70 ? '#39ff14' : s.avgFormScore >= 50 ? '#ffd700' : '#ff4d4d'
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{ex.icon}</span>
          <div>
            <div style={{ ...orb, fontSize: 12, fontWeight: 700, color: '#fff' }}>{ex.name}</div>
            <div style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{fmtDate(s.date)}</div>
          </div>
        </div>
        <div style={{ ...orb, fontSize: 13, fontWeight: 900, color: scoreColor }}>{s.avgFormScore}%</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { l: 'Reps',    v: s.reps,                      c: '#00f0ff' },
          { l: 'Time',    v: fmtDur(s.durationSeconds),   c: '#00f0ff' },
          { l: 'Cals',    v: `${s.calories}`,             c: '#ffd700' },
          { l: 'Streak',  v: `${s.bestStreak}🔥`,          c: '#39ff14' },
        ].map(({ l, v, c }) => (
          <div key={l} className="rounded-lg py-1.5 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ ...orb, fontSize: 11, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ ...mono, fontSize: 8, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' as const, letterSpacing: 1, marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function History() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(() => getHistory())
  const stats = getTotalStats()
  const days  = getActiveDays()

  function handleClear() {
    if (confirm('Delete all workout history?')) {
      clearHistory()
      setSessions([])
    }
  }

  // Group sessions by date for display
  const grouped = sessions.reduce<Record<string, WorkoutSession[]>>((acc, s) => {
    const key = s.date.slice(0, 10)
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all"
          style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.2)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 style={{ ...orb, fontSize: 14, fontWeight: 900, color: '#00f0ff', letterSpacing: 3, textTransform: 'uppercase' }}>
            Workout History
          </h1>
          <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {days} active day{days !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-sm mx-auto w-full">

        {/* Totals */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Total Reps"    value={stats.reps}            c="#00f0ff" />
            <StatBox label="Minutes"       value={stats.minutes}         c="#ffd700" />
            <StatBox label="Calories"      value={stats.calories}        c="#ff4d4d" />
            <StatBox label="Sessions"      value={stats.sessions}        c="#39ff14" />
            <StatBox label="Active Days"   value={days}                  c="#39ff14" />
            <StatBox label="Avg Form"      value={`${stats.avgForm}%`}   c="#00f0ff" />
          </div>
        )}

        {/* Session list */}
        {sessions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div style={{ fontSize: 48 }}>📊</div>
            <p style={{ ...orb, fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No sessions yet</p>
            <p style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Complete a workout to start tracking</p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-4 px-6 py-3 rounded-xl uppercase tracking-widest transition-all active:scale-95"
              style={{ ...orb, fontSize: 12, background: '#00f0ff', color: '#000', fontWeight: 900 }}
            >
              Start Training
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, daySessions]) => (
              <div key={date} className="space-y-2">
                <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2 }}>
                  {fmtDate(date)}
                </p>
                {daySessions.map(s => <SessionCard key={s.id} s={s} />)}
              </div>
            ))}
          </div>
        )}

        {/* Clear */}
        {sessions.length > 0 && (
          <button
            onClick={handleClear}
            className="w-full py-3 rounded-xl uppercase tracking-widest transition-all active:scale-95"
            style={{ ...orb, fontSize: 11, color: '#ff4d4d', background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.2)' }}
          >
            Clear All History
          </button>
        )}
      </div>
    </div>
  )
}
