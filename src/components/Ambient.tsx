import { pageBg } from '../styles/glass'

// OLED backdrop: deepest black + slow-drifting radial mesh orbs + fixed film grain.
export function Ambient() {
  return (
    <>
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10" style={pageBg}>
        <div className="glass-blob" style={{ width: 420, height: 420, top: '-10%',  left: '-14%',  background: '#5eeada', opacity: 0.4, animationDelay: '0s' }} />
        <div className="glass-blob" style={{ width: 360, height: 360, top: '24%',   right: '-18%', background: '#a78bfa', opacity: 0.38, animationDelay: '-5s' }} />
        <div className="glass-blob" style={{ width: 380, height: 380, bottom: '-14%', left: '18%',  background: '#7dffb0', opacity: 0.28, animationDelay: '-9s' }} />
      </div>
      {/* Film grain — fixed, never repaints */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          opacity: 0.04, mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  )
}
