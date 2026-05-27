import { pageBg } from '../styles/glass'

// Full-screen frosted-glass backdrop: deep gradient + floating colour blobs.
export function Ambient() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={pageBg}>
      <div className="glass-blob" style={{ width: 360, height: 360, top: '-8%',  left: '-12%', background: '#22d3ee', animationDelay: '0s' }} />
      <div className="glass-blob" style={{ width: 300, height: 300, top: '30%',  right: '-15%', background: '#a855f7', animationDelay: '-5s' }} />
      <div className="glass-blob" style={{ width: 320, height: 320, bottom: '-12%', left: '20%', background: '#4ade80', animationDelay: '-9s' }} />
    </div>
  )
}
