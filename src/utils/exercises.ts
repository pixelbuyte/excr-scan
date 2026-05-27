import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getAngle } from './angles'

export type ExerciseId = 'squat' | 'pushup'

export interface FormResult {
  feedback: string
  color: 'green' | 'yellow' | 'red'
}

// Separate rep-counting thresholds with a wide dead zone to prevent flicker.
// Phase only changes when angle crosses the far threshold — never near the middle.
export const REP_THRESHOLDS: Record<
  ExerciseId,
  { down: number; up: number; getAngle: (lm: NormalizedLandmark[]) => number }
> = {
  squat: {
    down: 105, // knee angle must drop BELOW this to enter 'down'
    up: 155,   // knee angle must rise ABOVE this to count rep
    getAngle: (lm) => getAngle(lm[24], lm[26], lm[28]), // hip–knee–ankle
  },
  pushup: {
    down: 100, // elbow angle must drop BELOW this to enter 'down'
    up: 155,   // elbow angle must rise ABOVE this to count rep
    getAngle: (lm) => getAngle(lm[12], lm[14], lm[16]), // shoulder–elbow–wrist
  },
}

export const EXERCISES: Record<ExerciseId, { name: string }> = {
  squat: { name: 'Squat' },
  pushup: { name: 'Push-up' },
}

// Landmark indices (MediaPipe Pose)
// 11=L shoulder, 12=R shoulder
// 13=L elbow,    14=R elbow
// 15=L wrist,    16=R wrist
// 23=L hip,      24=R hip
// 25=L knee,     26=R knee
// 27=L ankle,    28=R ankle

function analyzeSquat(lm: NormalizedLandmark[]): FormResult {
  const shoulder = lm[12], hip = lm[24], knee = lm[26], ankle = lm[28]
  const kneeAngle = getAngle(hip, knee, ankle)
  const hipAngle  = getAngle(shoulder, hip, knee)

  if (kneeAngle > 160)  return { feedback: 'Lower your hips',         color: 'yellow' }
  if (hipAngle  < 45)   return { feedback: 'Keep your chest up',       color: 'red'    }
  if (kneeAngle < 60)   return { feedback: 'Too deep — come up',        color: 'yellow' }
  if (kneeAngle < 110)  return { feedback: 'Good depth!',               color: 'green'  }
  return                       { feedback: 'Good form',                 color: 'green'  }
}

function analyzePushup(lm: NormalizedLandmark[]): FormResult {
  const shoulder = lm[12], elbow = lm[14], wrist = lm[16]
  const hip = lm[24], ankle = lm[28]
  const elbowAngle = getAngle(shoulder, elbow, wrist)
  const bodyAngle  = getAngle(shoulder, hip, ankle)

  if (bodyAngle  < 150) return { feedback: 'Keep your body straight',  color: 'red'    }
  if (elbowAngle > 160) return { feedback: 'Lower your chest',          color: 'yellow' }
  if (elbowAngle < 60)  return { feedback: 'Too low — push up',         color: 'yellow' }
  if (elbowAngle < 100) return { feedback: 'Good depth!',               color: 'green'  }
  return                       { feedback: 'Good form',                 color: 'green'  }
}

export function analyzeForm(exercise: ExerciseId, lm: NormalizedLandmark[]): FormResult {
  if (exercise === 'squat') return analyzeSquat(lm)
  return analyzePushup(lm)
}
