import { useState, useCallback } from 'react'
import type { AgeGroup, FitnessLevel } from '../utils/profile'

export type { AgeGroup, FitnessLevel }

export interface Settings {
  weight: number
  unit: 'metric' | 'imperial'
  voiceCoach: boolean
  soundEffects: boolean
  hapticFeedback: boolean
  cameraFacing: 'user' | 'environment'
  showAngles: boolean
  ageGroup: AgeGroup
  fitnessLevel: FitnessLevel
  lowLightBoost: boolean   // auto-detect + boost when dark
}

const DEFAULTS: Settings = {
  weight: 70, unit: 'metric',
  voiceCoach: true, soundEffects: true, hapticFeedback: true,
  cameraFacing: 'user', showAngles: false,
  ageGroup: 'adult', fitnessLevel: 'intermediate',
  lowLightBoost: true,
}

const KEY = 'excrscan_settings'

function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } }
  catch { return DEFAULTS }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    localStorage.removeItem(KEY)
    setSettings(DEFAULTS)
  }, [])

  return { settings, update, resetAll }
}
