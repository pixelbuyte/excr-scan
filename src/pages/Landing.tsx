import { useNavigate } from 'react-router-dom'
import { Ambient } from '../components/Ambient'
import { Reveal } from '../components/Reveal'
import {
  bezelShell, bezelCore, eyebrow,
  fontHead, fontBody, fontMono, softGlow, EASE,
  ACCENT, ACCENT_GREEN, ACCENT_GOLD, ACCENT_VIOLET,
} from '../styles/glass'

const FEATURES = [
  { icon: '◴', label: 'Real-time Pose',   desc: 'Full-body skeleton tracking at 30fps, fully on-device', big: true,  tint: ACCENT },
  { icon: '∠', label: 'Form Analysis',    desc: 'Live joint angles',  big: false, tint: ACCENT_VIOLET },
  { icon: '#', label: 'Rep Counter',      desc: 'Zero false counts',  big: false, tint: ACCENT_GREEN },
]

// Button-in-button trailing icon — nested circle, magnetic on hover
function ArrowChip({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className="magnet-icon w-8 h-8 rounded-full flex items-center justify-center"
      style={{ background: dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
      </svg>
    </span>
  )
}

function Tile({ icon, label, desc, tint }: { icon: string; label: string; desc: string; tint: string }) {
  return (
    <div className="h-full" style={bezelShell(28)}>
      <div className="h-full p-5 flex flex-col justify-between" style={bezelCore(28, tint)}>
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
          style={{ background: `${tint}1f`, border: `1px solid ${tint}33`, color: tint }}
        >
          {icon}
        </div>
        <div className="mt-4">
          <div className="text-[15px] font-semibold text-white" style={fontBody}>{label}</div>
          <div className="text-xs text-white/45 mt-1 leading-snug" style={fontBody}>{desc}</div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  const secondary = [
    { to: '/compete',  icon: '⚔', label: 'Compete',  tint: ACCENT_GREEN  },
    { to: '/daily',    icon: '◎', label: 'Daily',    tint: ACCENT_GOLD   },
    { to: '/history',  icon: '◷', label: 'History',  tint: ACCENT_VIOLET },
    { to: '/settings', icon: '⚙', label: 'Settings', tint: ACCENT        },
  ]

  return (
    <div className="min-h-[100dvh] relative flex flex-col justify-center px-5 py-16" style={{ color: '#fff' }}>
      <Ambient />

      <div className="relative w-full max-w-md mx-auto">

        {/* Hero */}
        <Reveal>
          <div className="flex items-center justify-between mb-7">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: `${ACCENT}1f`, border: `1px solid ${ACCENT}38` }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
            </div>
            <span style={eyebrow}>On-device · Private</span>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1
            className="leading-[0.95] tracking-tight"
            style={{ ...fontHead, fontSize: 'clamp(48px, 14vw, 68px)', fontWeight: 700 }}
          >
            Train with
            <br />
            <span style={{ background: `linear-gradient(110deg, ${ACCENT} 10%, ${ACCENT_VIOLET} 90%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              precision.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55 max-w-xs" style={fontBody}>
            Your camera becomes a personal form coach. Real-time feedback on every rep — no wearables, no cloud.
          </p>
        </Reveal>

        {/* Bento feature grid */}
        <Reveal delay={200}>
          <div className="grid grid-cols-2 gap-3 mt-9">
            <div className="col-span-2">
              <Tile {...FEATURES[0]} />
            </div>
            <Tile {...FEATURES[1]} />
            <Tile {...FEATURES[2]} />
          </div>
        </Reveal>

        {/* Primary CTA — magnetic, button-in-button */}
        <Reveal delay={280}>
          <button
            onClick={() => navigate('/scan')}
            className="magnetic group w-full mt-7 pl-7 pr-3 py-3 rounded-full flex items-center justify-between active:scale-[0.98]"
            style={{
              ...fontBody, fontWeight: 700, fontSize: 17, color: '#04201c',
              background: `linear-gradient(110deg, ${ACCENT}, ${ACCENT_GREEN})`,
              boxShadow: softGlow(ACCENT),
              transition: `transform 0.5s ${EASE}`,
            }}
          >
            Start Training
            <ArrowChip dark />
          </button>
        </Reveal>

        {/* Secondary — double-bezel pills */}
        <Reveal delay={340}>
          <div className="grid grid-cols-2 gap-3 mt-3">
            {secondary.map(({ to, icon, label, tint }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group active:scale-[0.98]"
                style={{ ...bezelShell(20), transition: `transform 0.4s ${EASE}` }}
              >
                <div
                  className="flex items-center gap-2.5 px-4 py-3"
                  style={bezelCore(20)}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                    style={{ background: `${tint}1f`, color: tint }}
                  >
                    {icon}
                  </span>
                  <span className="text-sm font-medium text-white/85" style={fontBody}>{label}</span>
                </div>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={400}>
          <p className="text-center text-white/25 text-xs mt-8 tracking-wide" style={fontMono}>
            100% local · no data leaves device
          </p>
        </Reveal>
      </div>
    </div>
  )
}
