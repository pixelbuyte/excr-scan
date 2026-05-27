import type { ReactNode } from 'react'

interface Props {
  calories: number
  tut: number
  avgPace: number
  paceHistory: number[]
  hrZone: string
  volume: number
  unit: 'metric' | 'imperial'
}

const ZONE_COLOR: Record<string, string> = {
  Rest: '#888', 'Fat Burn': '#39ff14', Cardio: '#ffa500', Peak: '#ff4d4d',
}

function Sparkline({ data, w = 80, h = 24 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <div style={{ width: w, height: h }} />
  const max = Math.max(...data, 0.1)
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - (v / max) * h}`
  ).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="#00f0ff" strokeWidth="1.5" />
    </svg>
  )
}

function Row({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <div className="flex flex-col items-end gap-0.5">
        <span style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 12, color: '#00f0ff', fontWeight: 700 }}>
          {value}
        </span>
        {sub}
      </div>
    </div>
  )
}

export function FitnessDashboard({ calories, tut, avgPace, paceHistory, hrZone, volume, unit }: Props) {
  const volLabel = unit === 'imperial' ? `${Math.round(volume * 2.205)} lbs` : `${volume} kg`
  const tutFmt   = tut >= 60 ? `${Math.floor(tut / 60)}m ${tut % 60}s` : `${tut}s`

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col justify-center px-2 py-3 z-[2]"
      style={{ width: 110, background: 'rgba(0,0,0,0.75)', borderLeft: '1px solid rgba(0,240,255,0.1)' }}
    >
      <div className="space-y-0">
        <Row label="Cals"  value={`${calories} kcal`} />
        <Row label="TUT"   value={tutFmt} />
        <Row
          label="Pace"
          value={avgPace > 0 ? `${avgPace}s` : '--'}
          sub={<Sparkline data={paceHistory} />}
        />
        <Row
          label="Est. Zone"
          value={hrZone}
          sub={
            <div className="w-16 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: hrZone === 'Peak' ? '100%' : hrZone === 'Cardio' ? '75%' : hrZone === 'Fat Burn' ? '50%' : '20%',
                  background: ZONE_COLOR[hrZone] ?? '#888',
                }}
              />
            </div>
          }
        />
        <Row label="Volume" value={volLabel} />
      </div>
    </div>
  )
}
