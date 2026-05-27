// Faint human silhouette shown until a pose is detected
interface Props { visible: boolean }

export function CameraGuide({ visible }: Props) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1] transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <svg
        viewBox="0 0 120 260"
        width="140"
        style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.4))' }}
      >
        {/* Silhouette body */}
        <circle cx="60" cy="22" r="18" fill="none" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="60" y1="40" x2="60" y2="130" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="60" y1="60" x2="20" y2="100" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="60" y1="60" x2="100" y2="100" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="60" y1="130" x2="35" y2="200" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="60" y1="130" x2="85" y2="200" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="35" y1="200" x2="30" y2="255" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
        <line x1="85" y1="200" x2="90" y2="255" stroke="rgba(0,240,255,0.25)" strokeWidth="2" />
      </svg>

      <p
        className="absolute bottom-16 text-center text-xs uppercase tracking-widest"
        style={{ fontFamily: '"Space Mono", monospace', color: 'rgba(0,240,255,0.4)' }}
      >
        Stand in frame
      </p>
    </div>
  )
}
