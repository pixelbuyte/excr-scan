import { useState, useRef, useCallback } from 'react'

const MILESTONES: Record<number, string> = {
  5:  'ON FIRE 🔥',
  10: 'UNSTOPPABLE 💥',
  15: 'BEAST MODE 🦁',
  20: 'LEGENDARY ⚡',
  25: 'GODLIKE 👑',
  30: 'ELITE 🏆',
}
const MS_LEVELS = Object.keys(MILESTONES).map(Number)

// Edge glow colors by streak level
export function streakGlow(streak: number): string | null {
  if (streak >= 15) return '0 0 0 4px rgba(255,215,0,0.6)'    // gold
  if (streak >= 10) return '0 0 0 4px rgba(57,255,20,0.5)'    // green
  if (streak >= 5)  return '0 0 0 4px rgba(0,240,255,0.4)'    // cyan
  return null
}

export function useStreak() {
  const [streak,    setStreak]    = useState(0)
  const [milestone, setMilestone] = useState<string | null>(null)
  const milestoneTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bestStreakRef              = useRef(parseInt(localStorage.getItem('excr_best_streak') ?? '0'))

  const addGood = useCallback(() => {
    setStreak(s => {
      const next = s + 1
      if (next > bestStreakRef.current) {
        bestStreakRef.current = next
        localStorage.setItem('excr_best_streak', String(next))
      }
      if (MS_LEVELS.includes(next)) {
        setMilestone(MILESTONES[next])
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current)
        milestoneTimerRef.current = setTimeout(() => setMilestone(null), 2500)
      }
      return next
    })
  }, [])

  const breakStreak = useCallback(() => setStreak(0), [])
  const reset       = useCallback(() => { setStreak(0); setMilestone(null) }, [])

  return { streak, milestone, bestStreak: bestStreakRef.current, addGood, breakStreak, reset }
}
