import type { CSSProperties } from 'react'

// ── Ethereal Glass design system (Awwwards-tier) ─────────────────────────────
// OLED black, radial mesh orbs, vantablack double-bezel cards, hairline borders.

export const ACCENT       = '#5eeada'  // emerald-cyan
export const ACCENT_CYAN  = '#5eeada'
export const ACCENT_GREEN = '#7dffb0'
export const ACCENT_GOLD  = '#f5c563'
export const ACCENT_RED   = '#ff8a8a'
export const ACCENT_VIOLET = '#a78bfa'

// Spring-physics easing (Apple/Linear feel)
export const EASE = 'cubic-bezier(0.32,0.72,0,1)'

// Typography — Clash Display (headings) + Plus Jakarta Sans (body) + Space Mono (data)
export const fontHead = { fontFamily: '"Clash Display", sans-serif' } as const
export const fontBody = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const
export const fontMono = { fontFamily: '"Space Mono", monospace' } as const

// ── Double-Bezel (Doppelrand) — nested machined-hardware enclosures ──────────
// Outer shell: holds the core like an aluminium tray.
export function bezelShell(radius = 32): CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: radius,
    padding: 6,
  }
}
// Inner core: the actual content plate, with inset top highlight + concentric radius.
export function bezelCore(radius = 32, tint?: string): CSSProperties {
  return {
    background: tint
      ? `linear-gradient(160deg, ${tint}1f, rgba(8,10,16,0.85) 60%)`
      : 'linear-gradient(160deg, rgba(28,32,44,0.9), rgba(8,10,16,0.85))',
    borderRadius: radius - 6,
    boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.14), inset 0 -1px 1px rgba(0,0,0,0.4)',
  }
}

// Flat frosted glass (for overlays on camera feed)
export const glass: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 24px 60px -20px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.12)',
  borderRadius: 28,
}

export const glassDark: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(18,20,30,0.6), rgba(6,8,14,0.4))',
  backdropFilter: 'blur(18px) saturate(140%)',
  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
  border: '1px solid rgba(255,255,255,0.09)',
  boxShadow: '0 16px 40px -16px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.10)',
  borderRadius: 22,
}

export const glassPill: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 999,
}

export function glassTint(hex: string): CSSProperties {
  return {
    background: `linear-gradient(160deg, ${hex}24, ${hex}08)`,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${hex}38`,
    boxShadow: `0 20px 50px -20px ${hex}55, inset 0 1px 1px ${hex}2a`,
    borderRadius: 28,
  }
}

export function softGlow(hex: string): string {
  return `0 8px 30px -6px ${hex}77, inset 0 1px 1px rgba(255,255,255,0.4)`
}

// Eyebrow tag pill (microscopic uppercase badge above headings)
export const eyebrow: CSSProperties = {
  ...fontMono,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: 'rgba(255,255,255,0.5)',
  padding: '5px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  display: 'inline-block',
}

// OLED page background — deepest black + radial mesh orbs
export const pageBg: CSSProperties = {
  background:
    'radial-gradient(ellipse 70% 50% at 15% -5%, rgba(94,234,218,0.10), transparent 55%),' +
    'radial-gradient(ellipse 60% 50% at 95% 15%, rgba(167,139,250,0.10), transparent 55%),' +
    'radial-gradient(ellipse 80% 60% at 50% 115%, rgba(125,255,176,0.07), transparent 60%),' +
    '#050505',
}
