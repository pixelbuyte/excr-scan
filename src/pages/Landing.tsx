import { useNavigate } from 'react-router-dom'
import { Ambient } from '../components/Ambient'
import { glass, glassTint, fontHead, fontMono, softGlow, ACCENT, ACCENT_GREEN, ACCENT_GOLD } from '../styles/glass'

const FEATURES = [
  { icon: '🦴', label: 'Pose Detection',  desc: 'Full-body skeleton' },
  { icon: '📐', label: 'Form Analysis',   desc: 'Live joint angles' },
  { icon: '🔢', label: 'Rep Counter',     desc: 'Zero false counts' },
  { icon: '⚔️', label: 'Compete',         desc: 'Challenge a friend' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-5 py-8" style={{ color: '#fff' }}>
      <Ambient />

      <div className="relative z-10 w-full max-w-sm space-y-7">

        {/* Logo + title */}
        <div className="text-center space-y-4">
          <div
            className="relative inline-flex items-center justify-center w-24 h-24 rounded-[28px] overflow-hidden sheen"
            style={glassTint(ACCENT)}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" style={{ filter: `drop-shadow(0 0 8px ${ACCENT})` }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
          </div>

          <div>
            <h1
              className="text-5xl font-black tracking-tight"
              style={{ ...fontHead, background: `linear-gradient(135deg, #fff 20%, ${ACCENT} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              ExcrScan
            </h1>
            <p className="mt-2 text-sm tracking-widest uppercase" style={{ ...fontMono, color: 'rgba(255,255,255,0.4)' }}>
              Real-time form correction
            </p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon, label, desc }) => (
            <div key={label} className="rounded-3xl p-4" style={glass}>
              <div className="text-2xl mb-1.5">{icon}</div>
              <div className="text-sm font-bold text-white/90" style={fontHead}>{label}</div>
              <div className="text-xs text-white/40 mt-0.5" style={fontMono}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/scan')}
          className="relative w-full py-4 rounded-3xl font-black uppercase tracking-widest text-lg overflow-hidden sheen active:scale-[0.97] transition-transform"
          style={{ ...fontHead, color: '#04121a', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, boxShadow: softGlow(ACCENT) }}
        >
          Start Training
        </button>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/compete')}
            className="py-3.5 rounded-2xl font-bold uppercase tracking-wider text-sm active:scale-[0.97] transition-transform"
            style={{ ...fontHead, color: ACCENT_GREEN, ...glassTint(ACCENT_GREEN) }}
          >
            ⚔️ Compete
          </button>
          <button
            onClick={() => navigate('/daily')}
            className="py-3.5 rounded-2xl font-bold uppercase tracking-wider text-sm active:scale-[0.97] transition-transform"
            style={{ ...fontHead, color: ACCENT_GOLD, ...glassTint(ACCENT_GOLD) }}
          >
            🔥 Daily
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/history')}
            className="py-3 rounded-2xl uppercase tracking-wider text-xs active:scale-[0.97] transition-transform"
            style={{ ...fontHead, color: 'rgba(255,255,255,0.6)', ...glass }}
          >
            📊 History
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="py-3 rounded-2xl uppercase tracking-wider text-xs active:scale-[0.97] transition-transform"
            style={{ ...fontHead, color: 'rgba(255,255,255,0.6)', ...glass }}
          >
            ⚙ Settings
          </button>
        </div>

        <p className="text-center text-white/25 text-xs" style={fontMono}>
          100% local · no data leaves device
        </p>
      </div>
    </div>
  )
}
