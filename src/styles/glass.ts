import type { CSSProperties } from 'react'

// ── Glassmorphism design tokens ──────────────────────────────────────────────
// Frosted translucent surfaces, soft depth, no hard neon borders.

export const ACCENT       = '#22d3ee'   // softened cyan
export const ACCENT_GREEN = '#4ade80'   // softened green
export const ACCENT_GOLD  = '#fbbf24'
export const ACCENT_RED   = '#f87171'

export const fontHead = { fontFamily: '"Orbitron", sans-serif' } as const
export const fontMono = { fontFamily: '"Space Mono", monospace' } as const

// Base frosted-glass panel
export const glass: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.14)',
  borderRadius: 24,
}

// Stronger/darker glass for overlays on bright camera feed
export const glassDark: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(20,24,40,0.55), rgba(10,12,22,0.35))',
  backdropFilter: 'blur(16px) saturate(130%)',
  WebkitBackdropFilter: 'blur(16px) saturate(130%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)',
  borderRadius: 20,
}

// Small frosted pill
export const glassPill: CSSProperties = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 999,
}

// Accent-tinted glass (pass a hex)
export function glassTint(hex: string): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${hex}22, ${hex}08)`,
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    border: `1px solid ${hex}40`,
    boxShadow: `0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 ${hex}30`,
    borderRadius: 24,
  }
}

// Soft glow for accent buttons
export function softGlow(hex: string): string {
  return `0 4px 24px ${hex}55, 0 1px 0 rgba(255,255,255,0.3) inset`
}

// Page background — deep gradient with ambient color blooms
export const pageBg: CSSProperties = {
  background:
    'radial-gradient(ellipse 90% 60% at 20% -10%, rgba(34,211,238,0.14), transparent 60%),' +
    'radial-gradient(ellipse 80% 50% at 90% 10%, rgba(168,85,247,0.12), transparent 55%),' +
    'radial-gradient(ellipse 70% 60% at 50% 110%, rgba(74,222,128,0.10), transparent 60%),' +
    'linear-gradient(180deg, #0b0d16 0%, #070810 100%)',
}
