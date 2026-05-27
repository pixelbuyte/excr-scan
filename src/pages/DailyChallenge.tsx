import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDailyChallenge, markDailyComplete, getWeeklyStreak } from '../utils/dailyChallenge'
import { Ambient } from '../components/Ambient'
import { glassTint, glassPill, fontHead, fontMono, softGlow, ACCENT, ACCENT_GREEN, ACCENT_GOLD } from '../styles/glass'

const mono = fontMono
const orb  = fontHead

export default function DailyChallenge() {
  const navigate  = useNavigate()
  const challenge = getDailyChallenge()
  const streak    = getWeeklyStreak()

  const [done, setDone] = useState<boolean[]>(() => challenge.tasks.map(() => false))
  const [completed, setCompleted]   = useState(false)

  function toggle(i: number) {
    if (completed) return
    const next = done.map((v, idx) => idx === i ? !v : v)
    setDone(next)
    if (next.every(Boolean) && !completed) {
      markDailyComplete()
      setCompleted(true)
    }
  }

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
            Daily Challenge
          </h1>
          <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{challenge.date}</p>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-sm mx-auto w-full">

        {/* Weekly streak */}
        <div className="rounded-3xl p-4 flex items-center justify-between" style={glassTint(ACCENT_GOLD)}>
          <div>
            <p style={{ ...orb, fontSize: 10, color: 'rgba(251,191,36,0.7)', letterSpacing: 2, textTransform: 'uppercase' }}>Weekly Streak</p>
            <p style={{ ...orb, fontSize: 28, fontWeight: 900, color: ACCENT_GOLD, lineHeight: 1.1, marginTop: 2 }}>{streak} days</p>
          </div>
          <div style={{ fontSize: 40 }}>🔥</div>
        </div>

        {/* Challenge card */}
        <div className="rounded-3xl p-4 space-y-4" style={glassTint(ACCENT)}>
          <div>
            <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Today's Workout</p>
            <h2 style={{ ...orb, fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4 }}>{challenge.title}</h2>
          </div>

          <div className="space-y-2">
            {challenge.tasks.map((task, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 rounded-2xl p-3 transition-all active:scale-[0.98]"
                style={done[i] ? { ...glassTint(ACCENT_GREEN), textAlign: 'left' } : { ...glassPill, borderRadius: 16, textAlign: 'left' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: done[i] ? ACCENT_GREEN : 'transparent',
                    border: `2px solid ${done[i] ? ACCENT_GREEN : 'rgba(255,255,255,0.25)'}`,
                  }}
                >
                  {done[i] && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#04121a" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    ...mono,
                    fontSize: 12,
                    color: done[i] ? ACCENT_GREEN : 'rgba(255,255,255,0.85)',
                    textDecoration: done[i] ? 'line-through' : 'none',
                  }}
                >
                  {task.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Completion card */}
        {completed && (
          <div
            className="rounded-3xl p-5 text-center"
            style={{ ...glassTint(ACCENT_GREEN), animation: 'winner-pop 0.4s ease-out' }}
          >
            <div style={{ fontSize: 48 }}>🏆</div>
            <h3 style={{ ...orb, fontSize: 16, fontWeight: 900, color: ACCENT_GREEN, marginTop: 8 }}>Challenge Complete!</h3>
            <p style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>Streak extended · Come back tomorrow</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/scan')}
          className="w-full py-4 rounded-3xl font-black uppercase tracking-widest active:scale-[0.97] transition-transform"
          style={{ ...orb, fontSize: 13, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, boxShadow: softGlow(ACCENT) }}
        >
          Start Training
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {challenge.tasks.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{ background: done[i] ? ACCENT_GREEN : 'rgba(255,255,255,0.18)' }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
