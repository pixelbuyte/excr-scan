import { useNavigate } from 'react-router-dom'

const FEATURES = [
  { icon: '📹', text: 'Live camera pose detection' },
  { icon: '🦴', text: 'Full-body skeleton overlay' },
  { icon: '✅', text: 'Real-time form feedback' },
  { icon: '🔢', text: 'Automatic rep counter' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-8">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-5xl font-bold tracking-tight">ExcrScan</h1>
            <p className="text-white/50 mt-2 text-lg">Real-time exercise form correction</p>
          </div>
        </div>

        {/* Feature list */}
        <div className="space-y-2">
          {FEATURES.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
              <span className="text-xl">{icon}</span>
              <span className="text-white/70">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/scan')}
            className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-lg
                       hover:bg-white/90 active:scale-95 transition-all"
          >
            Start Scanning
          </button>
          <p className="text-center text-white/20 text-xs">
            All processing is local — no data leaves your device
          </p>
        </div>
      </div>
    </div>
  )
}
