import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDailyChallenge, markDailyComplete, getWeeklyStreak } from '../utils/dailyChallenge'

const mono = { fontFamily: '"Space Mono", monospace' }
const orb  = { fontFamily: '"Orbitron", sans-serif' }

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
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: '1px solid rgba(0,240,255,0.15)' }}
      >
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
            Daily Challenge
          </h1>
          <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{challenge.date}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 max-w-sm mx-auto w-full">

        {/* Weekly streak */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.2)' }}
        >
          <div>
            <p style={{ ...orb, fontSize: 10, color: 'rgba(255,215,0,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>Weekly Streak</p>
            <p style={{ ...orb, fontSize: 28, fontWeight: 900, color: '#ffd700', lineHeight: 1.1, marginTop: 2 }}>{streak} days</p>
          </div>
          <div style={{ fontSize: 40 }}>🔥</div>
        </div>

        {/* Challenge card */}
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: 'rgba(0,240,255,0.04)', border: '1px solid rgba(0,240,255,0.2)' }}
        >
          <div>
            <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Today's Workout</p>
            <h2 style={{ ...orb, fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4 }}>{challenge.title}</h2>
          </div>

          <div className="space-y-2">
            {challenge.tasks.map((task, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 rounded-xl p-3 transition-all active:scale-[0.98]"
                style={{
                  background: done[i] ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done[i] ? 'rgba(57,255,20,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  textAlign: 'left',
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    background: done[i] ? '#39ff14' : 'transparent',
                    border: `2px solid ${done[i] ? '#39ff14' : 'rgba(255,255,255,0.2)'}`,
                  }}
                >
                  {done[i] && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    ...mono,
                    fontSize: 12,
                    color: done[i] ? '#39ff14' : 'rgba(255,255,255,0.8)',
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
            className="rounded-2xl p-5 text-center"
            style={{
              background: 'rgba(57,255,20,0.06)',
              border: '1px solid rgba(57,255,20,0.4)',
              boxShadow: '0 0 24px rgba(57,255,20,0.12)',
              animation: 'winner-pop 0.4s ease-out',
            }}
          >
            <div style={{ fontSize: 48 }}>🏆</div>
            <h3 style={{ ...orb, fontSize: 16, fontWeight: 900, color: '#39ff14', marginTop: 8 }}>Challenge Complete!</h3>
            <p style={{ ...mono, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Streak extended · Come back tomorrow</p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/scan')}
          className="w-full py-4 rounded-xl font-black text-black uppercase tracking-widest transition-all active:scale-95"
          style={{
            ...orb,
            fontSize: 13,
            background: '#00f0ff',
            boxShadow: '0 0 20px rgba(0,240,255,0.5)',
          }}
        >
          Start Training
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {challenge.tasks.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all"
              style={{ background: done[i] ? '#39ff14' : 'rgba(255,255,255,0.15)' }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
