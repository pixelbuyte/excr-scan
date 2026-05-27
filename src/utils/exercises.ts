import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getAngle } from './angles'

export type ExerciseId = 'squat' | 'pushup'

export interface FormResult {
  feedback: string
  color: 'green' | 'yellow' | 'red'
}

// Rep-counting thresholds with a wide dead zone.
// A rep requires: angle drops below `down` (SQUATTING) then rises above `up` (STANDING).
// `fullDepth` is the reference angle for battery 100% (can be same as or lower than `down`).
export const REP_THRESHOLDS: Record<ExerciseId, {
  down: number
  up: number
  fullDepth: number
  getAngle: (lm: NormalizedLandmark[]) => number
}> = {
  squat: {
    down: 105,     // knee angle below this = confirmed squat
    up: 155,       // knee angle above this = standing (rep counted)
    fullDepth: 85, // 85° = battery 100%
    getAngle: (lm) => getAngle(lm[24], lm[26], lm[28]), // hip–knee–ankle
  },
  pushup: {
    down: 100,
    up: 155,
    fullDepth: 75,
    getAngle: (lm) => getAngle(lm[12], lm[14], lm[16]), // shoulder–elbow–wrist
  },
}

export const EXERCISES: Record<ExerciseId, { name: string }> = {
  squat:  { name: 'Squat'   },
  pushup: { name: 'Push-up' },
}

// Landmark indices (MediaPipe Pose)
// 11=L shoulder, 12=R shoulder | 13=L elbow, 14=R elbow | 15=L wrist, 16=R wrist
// 23=L hip, 24=R hip | 25=L knee, 26=R knee | 27=L ankle, 28=R ankle

export function analyzeForm(exercise: ExerciseId, lm: NormalizedLandmark[]): FormResult {
  if (exercise === 'squat') {
    const shoulder = lm[12], hip = lm[24], knee = lm[26], ankle = lm[28]
    const kneeAngle = getAngle(hip, knee, ankle)
    const hipAngle  = getAngle(shoulder, hip, knee)
    if (kneeAngle > 160)  return { feedback: 'Lower your hips',        color: 'yellow' }
    if (hipAngle  < 45)   return { feedback: 'Keep your chest up',      color: 'red'    }
    if (kneeAngle < 60)   return { feedback: 'Too deep — come up',       color: 'yellow' }
    if (kneeAngle < 110)  return { feedback: 'Good depth!',              color: 'green'  }
    return                       { feedback: 'Good form',                color: 'green'  }
  } else {
    const shoulder = lm[12], elbow = lm[14], wrist = lm[16]
    const hip = lm[24], ankle = lm[28]
    const elbowAngle = getAngle(shoulder, elbow, wrist)
    const bodyAngle  = getAngle(shoulder, hip, ankle)
    if (bodyAngle  < 150) return { feedback: 'Keep your body straight', color: 'red'    }
    if (elbowAngle > 160) return { feedback: 'Lower your chest',         color: 'yellow' }
    if (elbowAngle < 60)  return { feedback: 'Too low — push up',        color: 'yellow' }
    if (elbowAngle < 100) return { feedback: 'Good depth!',              color: 'green'  }
    return                       { feedback: 'Good form',                color: 'green'  }
  }
}

// 0–100 score based on how close joint angles are to ideal depth angles.
export function getFormScore(exercise: ExerciseId, lm: NormalizedLandmark[]): number {
  if (exercise === 'squat') {
    const kneeAngle = getAngle(lm[24], lm[26], lm[28])
    const hipAngle  = getAngle(lm[12], lm[24], lm[26])
    const kneeScore = Math.max(0, 100 - Math.abs(kneeAngle - 90) * 1.4)
    const hipScore  = Math.max(0, 100 - Math.abs(hipAngle  - 85) * 1.6)
    return Math.round((kneeScore * 0.6 + hipScore * 0.4))
  } else {
    const elbowAngle = getAngle(lm[12], lm[14], lm[16])
    const bodyAngle  = getAngle(lm[12], lm[24], lm[28])
    const elbowScore = Math.max(0, 100 - Math.abs(elbowAngle - 90) * 1.4)
    const bodyScore  = Math.max(0, 100 - Math.abs(bodyAngle - 180) * 2.0)
    return Math.round((elbowScore * 0.6 + bodyScore * 0.4))
  }
}
