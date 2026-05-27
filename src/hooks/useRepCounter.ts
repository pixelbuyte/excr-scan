import { useRef, useState, useCallback, useEffect } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { REP_THRESHOLDS, type ExerciseId } from '../utils/exercises'

export type RepState = 'STANDING' | 'DESCENDING' | 'SQUATTING'

const COOLDOWN_MS      = 700
const SMOOTH_ALPHA     = 0.25
const HISTORY_SIZE     = 5
const VARIANCE_THRESH  = 10   // degrees — below this = stationary
const MIN_ANGLE_CHANGE = 30   // degrees — must deviate this far from rest to start a rep

export function useRepCounter(
  exercise: ExerciseId,
  onRep?: () => void,
  onHalfRep?: () => void,
  downAdjust = 0,   // positive = more forgiving (less depth needed)
) {
  const [reps,       setReps]       = useState(0)
  const [halfReps,   setHalfReps]   = useState(0)
  const [depth,      setDepth]      = useState(0)
  const [repState,   setRepState]   = useState<RepState>('STANDING')
  const [isStationary, setIsStationary] = useState(true)

  const stateRef       = useRef<RepState>('STANDING')
  const smoothRef      = useRef<number | null>(null)   // null until first frame
  const lastRepRef     = useRef(0)
  const minAngleRef    = useRef(9999)       // min metric reached in current descent
  const restAngleRef   = useRef<number | null>(null)   // angle when standing still
  const historyRef     = useRef<number[]>([])
  const onRepRef       = useRef(onRep)
  const onHalfRef      = useRef(onHalfRep)
  onRepRef.current     = onRep
  onHalfRef.current    = onHalfRep

  useEffect(() => {
    stateRef.current    = 'STANDING'
    smoothRef.current   = null
    lastRepRef.current  = 0
    minAngleRef.current = 9999
    restAngleRef.current = null
    historyRef.current  = []
    setRepState('STANDING')
    setDepth(0)
    setReps(0)
    setHalfReps(0)
    setIsStationary(true)
  }, [exercise])

  const process = useCallback((lm: NormalizedLandmark[]) => {
    const base = REP_THRESHOLDS[exercise]
    const down     = base.down + downAdjust
    const up       = base.up
    const fullDepth = base.fullDepth + downAdjust
    const halfDown  = base.halfDown !== undefined ? base.halfDown + downAdjust : undefined
    const getMetric = base.getMetric
    const raw = getMetric(lm)

    // Initialize smooth value at first frame to avoid large initial swing
    if (smoothRef.current === null) smoothRef.current = raw
    smoothRef.current = smoothRef.current * (1 - SMOOTH_ALPHA) + raw * SMOOTH_ALPHA
    const metric = smoothRef.current

    // Rolling history for stationarity check
    const hist = historyRef.current
    hist.push(raw)
    if (hist.length > HISTORY_SIZE) hist.shift()
    const spread   = hist.length >= HISTORY_SIZE ? Math.max(...hist) - Math.min(...hist) : 99
    const stationary = spread < VARIANCE_THRESH
    setIsStationary(stationary)

    // Battery depth %
    const pct = Math.max(0, Math.min(100,
      Math.round(((up - metric) / (up - fullDepth)) * 100)
    ))
    setDepth(pct)

    const now = performance.now()
    const s = stateRef.current

    if (s === 'STANDING') {
      // Track resting angle while stationary
      if (stationary) restAngleRef.current = metric

      const restAngle = restAngleRef.current ?? up
      const threshold = Math.min(up - 15, restAngle - MIN_ANGLE_CHANGE)

      if (!stationary && metric < threshold) {
        stateRef.current    = 'DESCENDING'
        minAngleRef.current = metric
        setRepState('DESCENDING')
      }
    } else if (s === 'DESCENDING') {
      minAngleRef.current = Math.min(minAngleRef.current, metric)

      if (metric > up) {
        // Returned without full depth
        if (halfDown !== undefined && minAngleRef.current < halfDown) {
          setHalfReps(h => h + 1)
          onHalfRef.current?.()
        }
        stateRef.current    = 'STANDING'
        minAngleRef.current = 9999
        setRepState('STANDING')
      } else if (metric < down) {
        stateRef.current = 'SQUATTING'
        setRepState('SQUATTING')
      }
    } else if (s === 'SQUATTING') {
      if (metric > up && now - lastRepRef.current > COOLDOWN_MS) {
        stateRef.current    = 'STANDING'
        minAngleRef.current = 9999
        lastRepRef.current  = now
        setRepState('STANDING')
        setReps(r => r + 1)
        onRepRef.current?.()
      }
    }
  }, [exercise])

  const reset = useCallback(() => {
    stateRef.current     = 'STANDING'
    smoothRef.current    = null
    lastRepRef.current   = 0
    minAngleRef.current  = 9999
    restAngleRef.current = null
    historyRef.current   = []
    setRepState('STANDING')
    setDepth(0)
    setReps(0)
    setHalfReps(0)
    setIsStationary(true)
  }, [])

  return { reps, halfReps, depth, repState, isStationary, process, reset }
}
