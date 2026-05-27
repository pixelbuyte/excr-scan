import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHistory, getTotalStats, getActiveDays, clearHistory, type WorkoutSession } from '../utils/workoutHistory'
import { EXERCISES } from '../utils/exercises'
import { Ambient } from '../components/Ambient'
import { glass, glassTint, glassPill, fontHead, fontMono, softGlow, ACCENT, ACCENT_GREEN } from '../styles/glass'

const mono = fontMono
const orb  = fontHead

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}
function fmtDur(s: number) {
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

function StatBox({ label, value, c = ACCENT }: { label: string; value: string | number; c?: string }) {
  return (
    <div className="rounded-2xl p-3 text-center" style={glassTint(c)}>
      <div style={{ ...orb, fontSize: 18, fontWeight: 900, color: c, lineHeight: 1 }}>{value}</div>
      <div style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label}</div>
    </div>
  )
}

function SessionCard({ s }: { s: WorkoutSession }) {
  const ex = EXERCISES[s.exercise]
  const scoreColor = s.avgFormScore >= 70 ? '#4ade80' : s.avgFormScore >= 50 ? '#fbbf24' : '#f87171'
  return (
    <div className="rounded-3xl p-4 space-y-2.5" style={glass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 22 }}>{ex.icon}</span>
          <div>
            <div style={{ ...orb, fontSize: 12, fontWeight: 700, color: '#fff' }}>{ex.name}</div>
            <div style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{fmtDate(s.date)}</div>
          </div>
        </div>
        <div style={{ ...orb, fontSize: 14, fontWeight: 900, color: scoreColor }}>{s.avgFormScore}%</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { l: 'Reps',    v: s.reps,                      c: '#22d3ee' },
          { l: 'Time',    v: fmtDur(s.durationSeconds),   c: '#22d3ee' },
          { l: 'Cals',    v: `${s.calories}`,             c: '#fbbf24' },
          { l: 'Streak',  v: `${s.bestStreak}🔥`,          c: '#4ade80' },
        ].map(({ l, v, c }) => (
          <div key={l} className="rounded-xl py-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div style={{ ...orb, fontSize: 11, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
            <div style={{ ...mono, fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' as const, letterSpacing: 1, marginTop: 2 }}>{l}</div>
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
    <div className="min-h-[100dvh] flex flex-col relative" style={{ color: '#fff' }}>
      <Ambient />
      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-4 py-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{ ...glassPill, color: ACCENT }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 style={{ ...orb, fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase' }}>
            Workout History
          </h1>
          <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {days} active day{days !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-sm mx-auto w-full">

        {/* Totals */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Total Reps"    value={stats.reps}            c="#22d3ee" />
            <StatBox label="Minutes"       value={stats.minutes}         c="#fbbf24" />
            <StatBox label="Calories"      value={stats.calories}        c="#f87171" />
            <StatBox label="Sessions"      value={stats.sessions}        c="#4ade80" />
            <StatBox label="Active Days"   value={days}                  c="#4ade80" />
            <StatBox label="Avg Form"      value={`${stats.avgForm}%`}   c="#22d3ee" />
          </div>
        )}

        {/* Session list */}
        {sessions.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div style={{ fontSize: 48 }}>📊</div>
            <p style={{ ...orb, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>No sessions yet</p>
            <p style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Complete a workout to start tracking</p>
            <button
              onClick={() => navigate('/scan')}
              className="mt-4 px-6 py-3.5 rounded-3xl uppercase tracking-widest active:scale-[0.97] transition-transform"
              style={{ ...orb, fontSize: 12, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, fontWeight: 900, boxShadow: softGlow(ACCENT) }}
            >
              Start Training
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, daySessions]) => (
              <div key={date} className="space-y-2">
                <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>
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
            className="w-full py-3 rounded-3xl uppercase tracking-widest active:scale-[0.97] transition-transform"
            style={{ ...orb, fontSize: 11, color: '#f87171', ...glassTint('#f87171') }}
          >
            Clear All History
          </button>
        )}
      </div>
    </div>
  )
}
