import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getAngle } from './angles'

export type ExerciseId = 'squat' | 'pushup' | 'lunge' | 'shoulder_press' | 'plank' | 'jumping_jacks'

export interface FormResult {
  feedback: string
  color: 'green' | 'yellow' | 'red'
}

export interface ExerciseConfig {
  name: string
  icon: string
  tip: string
  isTimeBased?: boolean
}

export const EXERCISES: Record<ExerciseId, ExerciseConfig> = {
  squat:          { name: 'Squat',          icon: '🏋️', tip: 'Feet shoulder-width, chest up, drive through heels' },
  pushup:         { name: 'Push-up',        icon: '💪', tip: 'Place phone to your side for best tracking' },
  lunge:          { name: 'Lunge',          icon: '🦵', tip: 'Front knee over toes, torso upright' },
  shoulder_press: { name: 'Shoulder Press', icon: '🙌', tip: 'Core braced, full arm extension overhead' },
  plank:          { name: 'Plank',          icon: '📏', tip: 'Body straight — hold the position', isTimeBased: true },
  jumping_jacks:  { name: 'Jumping Jacks',  icon: '⭐', tip: 'Full arm reach overhead, feet wide' },
}

// Body-only landmark indices (skip face: 0–10)
export const BODY_START = 11

// Filter POSE_CONNECTIONS to body only (no face) and offset for sliced landmark arrays
export function bodyConnections(allConns: ReadonlyArray<{ start: number; end: number }>) {
  return allConns
    .filter(c => c.start >= BODY_START && c.end >= BODY_START)
    .map(c => ({ start: c.start - BODY_START, end: c.end - BODY_START }))
}

function vis(lm: NormalizedLandmark) { return lm.visibility ?? 1 }

// --- Per-exercise metric functions (LOWER value = DEEPER into exercise) ---

function squatMetric(lm: NormalizedLandmark[])         { return getAngle(lm[24], lm[26], lm[28]) }
function lungeMetric(lm: NormalizedLandmark[])          { return getAngle(lm[23], lm[25], lm[27]) }
function plankMetric(lm: NormalizedLandmark[])          { return Math.abs(getAngle(lm[12], lm[24], lm[28]) - 180) }

function bestArmElbow(lm: NormalizedLandmark[]) {
  const lv = Math.min(vis(lm[11]), vis(lm[13]), vis(lm[15]))
  const rv = Math.min(vis(lm[12]), vis(lm[14]), vis(lm[16]))
  return rv >= lv ? getAngle(lm[12], lm[14], lm[16]) : getAngle(lm[11], lm[13], lm[15])
}

function pushupMetric(lm: NormalizedLandmark[])         { return bestArmElbow(lm) }
function shoulderPressMetric(lm: NormalizedLandmark[])  { return 180 - bestArmElbow(lm) }

function jumpingJacksMetric(lm: NormalizedLandmark[]) {
  // wrist-Y / shoulder-Y × 100  →  lower = wrists above shoulders = open position
  const wy = (lm[15].y + lm[16].y) / 2
  const sy = Math.max((lm[11].y + lm[12].y) / 2, 0.01)
  return (wy / sy) * 100
}

// Thresholds: lower metric = deeper. down = "confirmed depth", up = "back to standing".
export const REP_THRESHOLDS: Record<ExerciseId, {
  down: number
  up: number
  fullDepth: number
  halfDown?: number   // half-rep threshold (pushup only)
  getMetric: (lm: NormalizedLandmark[]) => number
}> = {
  squat:          { down: 105, up: 155, fullDepth: 85,  getMetric: squatMetric         },
  pushup:         { down: 100, up: 155, fullDepth: 70,  halfDown: 120, getMetric: pushupMetric  },
  lunge:          { down: 100, up: 150, fullDepth: 75,  getMetric: lungeMetric         },
  shoulder_press: { down: 25,  up: 90,  fullDepth: 10,  getMetric: shoulderPressMetric },
  plank:          { down: 30,  up: 60,  fullDepth: 0,   getMetric: plankMetric         },
  jumping_jacks:  { down: 70,  up: 105, fullDepth: 35,  getMetric: jumpingJacksMetric  },
}

// --- Form analysis (body-only, no face landmarks required) ---

export function analyzeForm(exercise: ExerciseId, lm: NormalizedLandmark[]): FormResult {
  switch (exercise) {
    case 'squat': {
      const kn = getAngle(lm[24], lm[26], lm[28])
      const hi = getAngle(lm[12], lm[24], lm[26])
      if (kn > 160) return { feedback: 'Lower your hips',        color: 'yellow' }
      if (hi < 45)  return { feedback: 'Keep your chest up',      color: 'red'    }
      if (kn < 60)  return { feedback: 'Too deep — come up',       color: 'yellow' }
      if (kn < 110) return { feedback: 'Good depth!',              color: 'green'  }
      return               { feedback: 'Good form',                color: 'green'  }
    }
    case 'pushup': {
      const el = bestArmElbow(lm)
      // Only check body alignment when legs are visible
      const legsOk = vis(lm[24]) > 0.3 && vis(lm[28]) > 0.3
      if (legsOk && getAngle(lm[12], lm[24], lm[28]) < 150)
        return { feedback: 'Keep your body straight', color: 'red' }
      if (el > 155) return { feedback: 'Lower your chest',         color: 'yellow' }
      if (el < 60)  return { feedback: 'Too low — push up',         color: 'yellow' }
      if (el < 100) return { feedback: 'Good depth!',               color: 'green'  }
      return               { feedback: 'Good form',                 color: 'green'  }
    }
    case 'lunge': {
      const kn = getAngle(lm[23], lm[25], lm[27])
      if (kn > 155) return { feedback: 'Lunge deeper',             color: 'yellow' }
      if (kn < 70)  return { feedback: 'Too deep — come up',        color: 'yellow' }
      if (kn < 110) return { feedback: 'Good depth!',               color: 'green'  }
      return               { feedback: 'Good form',                 color: 'green'  }
    }
    case 'shoulder_press': {
      const el = bestArmElbow(lm)
      if (el < 80)  return { feedback: 'Press up fully!',           color: 'yellow' }
      if (el > 165) return { feedback: 'Good — bring arms down',    color: 'yellow' }
      if (el > 150) return { feedback: 'Arms fully extended!',       color: 'green'  }
      return               { feedback: 'Good form',                 color: 'green'  }
    }
    case 'plank': {
      const body = getAngle(lm[12], lm[24], lm[28])
      if (body < 155) return { feedback: 'Raise your hips!',        color: 'red'    }
      if (body > 195) return { feedback: 'Lower your hips!',         color: 'yellow' }
      return                 { feedback: 'Perfect plank hold',       color: 'green'  }
    }
    case 'jumping_jacks': {
      const wy = (lm[15].y + lm[16].y) / 2
      const sy = (lm[11].y + lm[12].y) / 2
      if (wy < sy - 0.05) return { feedback: 'Full extension!',     color: 'green'  }
      return                     { feedback: 'Reach higher!',        color: 'yellow' }
    }
  }
}

// 0–100 form quality score based on angle proximity to ideal depth
export function getFormScore(exercise: ExerciseId, lm: NormalizedLandmark[]): number {
  switch (exercise) {
    case 'squat': {
      const ks = Math.max(0, 100 - Math.abs(getAngle(lm[24], lm[26], lm[28]) - 90) * 1.4)
      const hs = Math.max(0, 100 - Math.abs(getAngle(lm[12], lm[24], lm[26]) - 85) * 1.6)
      return Math.round(ks * 0.6 + hs * 0.4)
    }
    case 'pushup': {
      const el = bestArmElbow(lm)
      const es = Math.max(0, 100 - Math.abs(el - 90) * 1.4)
      const bs = vis(lm[24]) > 0.3 && vis(lm[28]) > 0.3
        ? Math.max(0, 100 - Math.abs(getAngle(lm[12], lm[24], lm[28]) - 180) * 2)
        : 80
      return Math.round(es * 0.7 + bs * 0.3)
    }
    case 'lunge':
      return Math.max(0, Math.round(100 - Math.abs(getAngle(lm[23], lm[25], lm[27]) - 90) * 1.4))
    case 'shoulder_press':
      return Math.max(0, Math.round(100 - Math.abs(bestArmElbow(lm) - 160) * 1.8))
    case 'plank':
      return Math.max(0, Math.round(100 - Math.abs(getAngle(lm[12], lm[24], lm[28]) - 180) * 3))
    case 'jumping_jacks':
      return 80
    default:
      return 80
  }
}

// Key joint angles for HUD display
export interface AngleLabel { landmark: NormalizedLandmark; value: number; idealMin: number; idealMax: number }

export function getDisplayAngles(exercise: ExerciseId, lm: NormalizedLandmark[]): AngleLabel[] {
  switch (exercise) {
    case 'squat':
      return [
        { landmark: lm[26], value: getAngle(lm[24], lm[26], lm[28]), idealMin: 85,  idealMax: 110 },
        { landmark: lm[24], value: getAngle(lm[12], lm[24], lm[26]), idealMin: 75,  idealMax: 100 },
      ]
    case 'pushup':
      return [
        { landmark: lm[14], value: bestArmElbow(lm), idealMin: 80, idealMax: 100 },
      ]
    case 'lunge':
      return [
        { landmark: lm[25], value: getAngle(lm[23], lm[25], lm[27]), idealMin: 85, idealMax: 110 },
      ]
    case 'shoulder_press':
      return [
        { landmark: lm[14], value: bestArmElbow(lm), idealMin: 155, idealMax: 175 },
      ]
    case 'plank':
      return [
        { landmark: lm[24], value: getAngle(lm[12], lm[24], lm[28]), idealMin: 165, idealMax: 195 },
      ]
    default:
      return []
  }
}
