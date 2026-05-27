import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { label: 'Pose Detection',     desc: 'Full-body MediaPipe skeleton' },
  { label: 'Form Correction',    desc: 'Real-time joint angle analysis' },
  { label: 'Rep Counter',        desc: '3-state machine, zero false counts' },
  { label: 'Compete Mode',       desc: 'Challenge a friend with a room code' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden relative"
      style={{ background: '#0a0a0a', color: '#fff' }}
    >
      {/* Mesh gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,240,255,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 80% 110%, rgba(57,255,20,0.08) 0%, transparent 70%)',
          animation: 'mesh-drift 12s ease-in-out infinite',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl"
            style={{
              background: 'rgba(0,240,255,0.08)',
              border: '1px solid rgba(0,240,255,0.3)',
              boxShadow: '0 0 24px rgba(0,240,255,0.15)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
          </div>

          <div>
            <h1
              className="text-5xl font-black tracking-widest uppercase"
              style={{ fontFamily: '"Orbitron", sans-serif', color: '#00f0ff', textShadow: '0 0 20px rgba(0,240,255,0.5)' }}
            >
              ExcrScan
            </h1>
            <p className="text-white/40 mt-2 text-sm tracking-widest uppercase" style={{ fontFamily: '"Space Mono", monospace' }}>
              Real-time form correction
            </p>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="text-xs font-bold text-white/80 mb-0.5" style={{ fontFamily: '"Orbitron", sans-serif' }}>
                {label}
              </div>
              <div className="text-xs text-white/30" style={{ fontFamily: '"Space Mono", monospace' }}>
                {desc}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/scan')}
            className="w-full py-4 rounded-xl font-black text-black uppercase tracking-widest text-lg
                       active:scale-95 transition-all"
            style={{
              fontFamily: '"Orbitron", sans-serif',
              background: '#00f0ff',
              boxShadow: '0 0 24px rgba(0,240,255,0.6), 0 0 48px rgba(0,240,255,0.2)',
            }}
          >
            Start Training
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/compete')}
              className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm
                         active:scale-95 transition-all"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#39ff14',
                background: 'rgba(57,255,20,0.06)',
                border: '1px solid rgba(57,255,20,0.3)',
                boxShadow: '0 0 12px rgba(57,255,20,0.1)',
              }}
            >
              ⚡ Compete
            </button>

            <button
              onClick={() => navigate('/daily')}
              className="py-3 rounded-xl font-bold uppercase tracking-widest text-sm
                         active:scale-95 transition-all"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                color: '#ffd700',
                background: 'rgba(255,215,0,0.06)',
                border: '1px solid rgba(255,215,0,0.3)',
                boxShadow: '0 0 12px rgba(255,215,0,0.1)',
              }}
            >
              🔥 Daily
            </button>
          </div>

          <button
            onClick={() => navigate('/settings')}
            className="w-full py-2.5 rounded-xl uppercase tracking-widest text-xs
                       active:scale-95 transition-all"
            style={{
              fontFamily: '"Orbitron", sans-serif',
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ⚙ Settings
          </button>
        </div>

        <p className="text-center text-white/15 text-xs" style={{ fontFamily: '"Space Mono", monospace' }}>
          100% local · no data leaves device
        </p>
      </div>
    </div>
  )
}
