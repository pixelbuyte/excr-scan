import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { getAngle } from './angles'

export type ExerciseId = 'squat' | 'pushup'

export interface FormResult {
  feedback: string
  color: 'green' | 'yellow' | 'red'
  repPhase: 'up' | 'down'
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
  const hipAngle = getAngle(shoulder, hip, knee)

  if (kneeAngle > 160) {
    return { feedback: 'Lower your hips', color: 'yellow', repPhase: 'up' }
  }
  if (hipAngle < 45) {
    return { feedback: 'Keep your chest up', color: 'red', repPhase: kneeAngle < 120 ? 'down' : 'up' }
  }
  if (kneeAngle < 60) {
    return { feedback: 'Too deep — come up slightly', color: 'yellow', repPhase: 'down' }
  }
  if (kneeAngle < 110) {
    return { feedback: 'Good depth!', color: 'green', repPhase: 'down' }
  }
  return { feedback: 'Good form', color: 'green', repPhase: 'up' }
}

function analyzePushup(lm: NormalizedLandmark[]): FormResult {
  const shoulder = lm[12], elbow = lm[14], wrist = lm[16]
  const hip = lm[24], ankle = lm[28]

  const elbowAngle = getAngle(shoulder, elbow, wrist)
  const bodyAngle = getAngle(shoulder, hip, ankle)

  if (bodyAngle < 150) {
    return { feedback: 'Keep your body straight', color: 'red', repPhase: 'up' }
  }
  if (elbowAngle > 160) {
    return { feedback: 'Lower your chest', color: 'yellow', repPhase: 'up' }
  }
  if (elbowAngle < 60) {
    return { feedback: 'Too low — push up', color: 'yellow', repPhase: 'down' }
  }
  if (elbowAngle < 100) {
    return { feedback: 'Good depth!', color: 'green', repPhase: 'down' }
  }
  return { feedback: 'Good form', color: 'green', repPhase: 'up' }
}

export function analyzeForm(exercise: ExerciseId, lm: NormalizedLandmark[]): FormResult {
  if (exercise === 'squat') return analyzeSquat(lm)
  return analyzePushup(lm)
}
