import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'
import { AGE_LABELS, FITNESS_LABELS, type AgeGroup, type FitnessLevel } from '../utils/profile'
import { clearHistory } from '../utils/workoutHistory'
import { Ambient } from '../components/Ambient'
import { glass, glassPill, fontHead, fontMono, ACCENT } from '../styles/glass'

const mono = fontMono
const orb  = fontHead

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ ...mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-12 h-6 rounded-full transition-all active:scale-95"
      style={{
        background: on ? ACCENT : 'rgba(255,255,255,0.1)',
        boxShadow: on ? '0 0 10px rgba(34,211,238,0.45)' : 'none',
      }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-black transition-all"
        style={{ left: on ? '28px' : '4px' }}
      />
    </button>
  )
}

export default function Settings() {
  const navigate  = useNavigate()
  const { settings, update, resetAll } = useSettings()

  function clearData() {
    if (confirm('Clear all workout history and PBs?')) {
      localStorage.removeItem('excr_daily_pb')
      localStorage.removeItem('excr_best_streak')
      clearHistory()
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
        <h1 style={{ ...orb, fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 3, textTransform: 'uppercase' }}>
          Settings
        </h1>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-sm mx-auto w-full">

        {/* Profile — affects thresholds & grade labels */}
        <section>
          <p style={{ ...orb, fontSize: 10, color: 'rgba(34,211,238,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Profile</p>
          <div className="rounded-3xl px-4" style={glass}>
            <Row label="Age Group">
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                {(Object.keys(AGE_LABELS) as AgeGroup[]).map(g => (
                  <button key={g} onClick={() => update('ageGroup', g)} className="px-2 py-1.5 transition-all"
                    style={{ ...mono, fontSize: 9, textTransform: 'uppercase',
                      background: settings.ageGroup === g ? ACCENT : 'transparent',
                      color: settings.ageGroup === g ? '#000' : 'rgba(255,255,255,0.4)',
                      fontWeight: settings.ageGroup === g ? 700 : 400 }}>
                    {g === 'youth' ? 'Youth' : g === 'adult' ? 'Adult' : 'Senior'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Fitness Level">
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                {(Object.keys(FITNESS_LABELS) as FitnessLevel[]).map(f => (
                  <button key={f} onClick={() => update('fitnessLevel', f)} className="px-2 py-1.5 transition-all"
                    style={{ ...mono, fontSize: 9, textTransform: 'uppercase',
                      background: settings.fitnessLevel === f ? ACCENT : 'transparent',
                      color: settings.fitnessLevel === f ? '#000' : 'rgba(255,255,255,0.4)',
                      fontWeight: settings.fitnessLevel === f ? 700 : 400 }}>
                    {f === 'beginner' ? 'Beginner' : f === 'intermediate' ? 'Inter.' : 'Advanced'}
                  </button>
                ))}
              </div>
            </Row>
          </div>
          <p style={{ ...mono, fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>
            Profile adjusts rep depth thresholds and grade labels for your ability level.
          </p>
        </section>

        {/* Body */}
        <section>
          <p style={{ ...orb, fontSize: 10, color: 'rgba(34,211,238,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Body</p>
          <div className="rounded-3xl px-4" style={glass}>
            <Row label="Weight (kg)">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update('weight', Math.max(30, settings.weight - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: 'rgba(34,211,238,0.14)', color: ACCENT, fontSize: 18, fontWeight: 700 }}
                >−</button>
                <span style={{ ...orb, fontSize: 16, fontWeight: 900, color: ACCENT, minWidth: 36, textAlign: 'center' }}>
                  {settings.weight}
                </span>
                <button
                  onClick={() => update('weight', Math.min(200, settings.weight + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: 'rgba(34,211,238,0.14)', color: ACCENT, fontSize: 18, fontWeight: 700 }}
                >+</button>
              </div>
            </Row>
            <Row label="Unit">
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                {(['metric', 'imperial'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => update('unit', u)}
                    className="px-3 py-1.5 transition-all"
                    style={{
                      ...mono,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      background: settings.unit === u ? ACCENT : 'transparent',
                      color: settings.unit === u ? '#000' : 'rgba(255,255,255,0.4)',
                      fontWeight: settings.unit === u ? 700 : 400,
                    }}
                  >{u}</button>
                ))}
              </div>
            </Row>
          </div>
        </section>

        {/* Feedback */}
        <section>
          <p style={{ ...orb, fontSize: 10, color: 'rgba(34,211,238,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Feedback</p>
          <div className="rounded-3xl px-4" style={glass}>
            <Row label="Voice Coach">
              <Toggle on={settings.voiceCoach} onToggle={() => update('voiceCoach', !settings.voiceCoach)} />
            </Row>
            <Row label="Sound Effects">
              <Toggle on={settings.soundEffects} onToggle={() => update('soundEffects', !settings.soundEffects)} />
            </Row>
            <Row label="Haptic Feedback">
              <Toggle on={settings.hapticFeedback} onToggle={() => update('hapticFeedback', !settings.hapticFeedback)} />
            </Row>
          </div>
        </section>

        {/* Display */}
        <section>
          <p style={{ ...orb, fontSize: 10, color: 'rgba(34,211,238,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Display</p>
          <div className="rounded-3xl px-4" style={glass}>
            <Row label="Show Angles">
              <Toggle on={settings.showAngles} onToggle={() => update('showAngles', !settings.showAngles)} />
            </Row>
            <Row label="Low Light Boost">
              <Toggle on={settings.lowLightBoost} onToggle={() => update('lowLightBoost', !settings.lowLightBoost)} />
            </Row>
            <Row label="Camera">
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                {(['user', 'environment'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => update('cameraFacing', f)}
                    className="px-3 py-1.5 transition-all"
                    style={{
                      ...mono,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      background: settings.cameraFacing === f ? ACCENT : 'transparent',
                      color: settings.cameraFacing === f ? '#000' : 'rgba(255,255,255,0.4)',
                      fontWeight: settings.cameraFacing === f ? 700 : 400,
                    }}
                  >{f === 'user' ? 'Front' : 'Back'}</button>
                ))}
              </div>
            </Row>
          </div>
        </section>

        {/* Data */}
        <section>
          <p style={{ ...orb, fontSize: 10, color: 'rgba(34,211,238,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Data</p>
          <div className="space-y-2">
            <button
              onClick={clearData}
              className="w-full py-3 rounded-xl uppercase tracking-widest transition-all active:scale-95"
              style={{ ...orb, fontSize: 11, color: '#ffd700', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)' }}
            >
              Clear History & PBs
            </button>
            <button
              onClick={resetAll}
              className="w-full py-3 rounded-xl uppercase tracking-widest transition-all active:scale-95"
              style={{ ...orb, fontSize: 11, color: '#ff4d4d', background: 'rgba(255,77,77,0.06)', border: '1px solid rgba(255,77,77,0.2)' }}
            >
              Reset All Settings
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
