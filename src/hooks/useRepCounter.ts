import { useRef, useState, useCallback, useEffect } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { REP_THRESHOLDS, type ExerciseId } from '../utils/exercises'

export type RepState = 'STANDING' | 'DESCENDING' | 'SQUATTING'

const COOLDOWN_MS = 500
const SMOOTH_ALPHA = 0.25 // EMA coefficient — lower = smoother but more lag

export function useRepCounter(exercise: ExerciseId, onRep?: () => void) {
  const [reps, setReps]         = useState(0)
  const [depth, setDepth]       = useState(0)  // 0–100 for battery meter
  const [repState, setRepState] = useState<RepState>('STANDING')

  const stateRef    = useRef<RepState>('STANDING')
  const smoothRef   = useRef(180)
  const lastRepRef  = useRef(0)
  const onRepRef    = useRef(onRep)
  onRepRef.current  = onRep

  // Reset everything when exercise changes
  useEffect(() => {
    stateRef.current  = 'STANDING'
    smoothRef.current = 180
    lastRepRef.current = 0
    setRepState('STANDING')
    setDepth(0)
    setReps(0)
  }, [exercise])

  const process = useCallback((lm: NormalizedLandmark[]) => {
    const { down, up, fullDepth, getAngle: getRaw } = REP_THRESHOLDS[exercise]
    const raw = getRaw(lm)

    // Exponential moving average for noise suppression
    smoothRef.current = smoothRef.current * (1 - SMOOTH_ALPHA) + raw * SMOOTH_ALPHA
    const angle = smoothRef.current

    // Battery depth % — 0 when at `up` threshold, 100 when at `fullDepth`
    const pct = Math.max(0, Math.min(100,
      Math.round(((up - angle) / (up - fullDepth)) * 100)
    ))
    setDepth(pct)

    const now = performance.now()
    const s = stateRef.current

    if (s === 'STANDING') {
      // Only enter DESCENDING when angle drops meaningfully (15° buffer prevents idle jitter)
      if (angle < up - 15) {
        stateRef.current = 'DESCENDING'
        setRepState('DESCENDING')
      }
    } else if (s === 'DESCENDING') {
      if (angle > up) {
        // Went back up without reaching depth — reset, no rep
        stateRef.current = 'STANDING'
        setRepState('STANDING')
      } else if (angle < down) {
        // Reached squat/pushup depth — confirmed
        stateRef.current = 'SQUATTING'
        setRepState('SQUATTING')
      }
    } else if (s === 'SQUATTING') {
      if (angle > up && now - lastRepRef.current > COOLDOWN_MS) {
        // Returned to standing — count the rep
        stateRef.current  = 'STANDING'
        setRepState('STANDING')
        lastRepRef.current = now
        setReps(r => r + 1)
        onRepRef.current?.()
      }
    }
  }, [exercise])

  const reset = useCallback(() => {
    stateRef.current   = 'STANDING'
    smoothRef.current  = 180
    lastRepRef.current = 0
    setRepState('STANDING')
    setDepth(0)
    setReps(0)
  }, [])

  return { reps, depth, repState, process, reset }
}
