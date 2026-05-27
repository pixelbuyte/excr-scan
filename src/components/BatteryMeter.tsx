interface Props {
  depth: number // 0–100
}

function depthColor(pct: number) {
  if (pct >= 80) return '#4ade80'
  if (pct >= 45) return '#fbbf24'
  return '#f87171'
}

export function BatteryMeter({ depth }: Props) {
  const color    = depthColor(depth)
  const isFull   = depth >= 90
  const isEmpty  = depth <= 2

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      {/* Outer shell */}
      <div
        className="relative rounded-xl"
        style={{
          width: 28, height: 180,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
        }}
      >
        {/* Battery tip */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-t-sm"
          style={{ top: -8, width: 14, height: 8, background: 'rgba(255,255,255,0.25)' }}
        />

        {/* Tick marks */}
        {[25, 50, 75].map(pct => (
          <div
            key={pct}
            className="absolute left-0 right-0"
            style={{ bottom: `${pct}%`, height: 1, background: 'rgba(255,255,255,0.15)' }}
          />
        ))}

        {/* Fill */}
        {!isEmpty && (
          <div
            className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-100"
            style={{
              height: `${depth}%`,
              background: color,
              boxShadow: isFull
                ? `0 0 10px ${color}, 0 0 24px ${color}`
                : `0 0 6px ${color}44`,
              animation: isFull ? 'battery-pulse 0.8s ease-in-out 2' : undefined,
            }}
          />
        )}
      </div>

      {/* Percentage label */}
      <span
        className="text-xs tabular-nums font-bold"
        style={{ fontFamily: '"Space Mono", monospace', color: isEmpty ? 'rgba(255,255,255,0.2)' : color }}
      >
        {depth}%
      </span>
    </div>
  )
}
