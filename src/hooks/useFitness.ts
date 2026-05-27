import { useState, useRef, useCallback } from 'react'
import type { ExerciseId } from '../utils/exercises'

const MET: Record<ExerciseId, number> = {
  squat: 5.0, pushup: 3.8, plank: 3.0,
  lunge: 4.0, jumping_jacks: 8.0, shoulder_press: 3.5,
}

const VOLUME_FACTOR: Record<ExerciseId, number> = {
  squat: 0.70, pushup: 0.65, lunge: 0.60,
  shoulder_press: 0.30, plank: 0, jumping_jacks: 0.30,
}

type HRZone = 'Rest' | 'Fat Burn' | 'Cardio' | 'Peak'

export function useFitness(exercise: ExerciseId, reps: number, weightKg: number) {
  const [calories,     setCalories]     = useState(0)
  const [tut,          setTut]          = useState(0)   // time under tension (s)
  const [paceHistory,  setPaceHistory]  = useState<number[]>([])

  const lastRepTimeRef  = useRef(0)
  const downStartRef    = useRef(0)

  const onEnterDown = useCallback(() => {
    downStartRef.current = performance.now()
  }, [])

  const onExitDown = useCallback(() => {
    const d = downStartRef.current
    if (d > 0) {
      const secs = (performance.now() - d) / 1000
      if (secs > 0.1 && secs < 15) setTut(t => t + secs)
    }
    downStartRef.current = 0
  }, [])

  const onRepComplete = useCallback(() => {
    const now  = performance.now()
    const pace = lastRepTimeRef.current ? (now - lastRepTimeRef.current) / 1000 : 2.5
    lastRepTimeRef.current = now
    const cal = MET[exercise] * 0.0175 * weightKg * (pace / 60)
    setCalories(c => c + cal)
    setPaceHistory(h => [...h.slice(-9), pace])
  }, [exercise, weightKg])

  const reset = useCallback(() => {
    setCalories(0)
    setTut(0)
    setPaceHistory([])
    lastRepTimeRef.current = 0
    downStartRef.current   = 0
  }, [])

  const avgPace = paceHistory.length
    ? paceHistory.reduce((a, b) => a + b, 0) / paceHistory.length : 0

  const hrZone: HRZone = avgPace < 1.5 ? 'Peak'
    : avgPace < 2.5 ? 'Cardio'
    : avgPace < 4.0 ? 'Fat Burn'
    : 'Rest'

  const volume = Math.round(reps * VOLUME_FACTOR[exercise] * weightKg)

  return {
    calories: Math.round(calories * 10) / 10,
    tut: Math.round(tut),
    paceHistory,
    avgPace: Math.round(avgPace * 10) / 10,
    hrZone,
    volume,
    onEnterDown,
    onExitDown,
    onRepComplete,
    reset,
  }
}
