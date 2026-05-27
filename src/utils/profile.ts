export type AgeGroup    = 'youth' | 'adult' | 'senior'
export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

// How much to shift the "down" rep-threshold for each profile.
// Positive = more forgiving (less depth required to count a rep).
export function getDownAdjust(ageGroup: AgeGroup, fitnessLevel: FitnessLevel): number {
  let adj = 0
  if (ageGroup === 'senior') adj += 14
  if (ageGroup === 'youth')  adj +=  5
  if (fitnessLevel === 'beginner')     adj += 10
  if (fitnessLevel === 'advanced')     adj -=  8
  return adj
}

// Grade label / colour tuned per demographic
export function gradeForScore(
  score: number,
  ageGroup: AgeGroup,
  fitnessLevel: FitnessLevel,
): { label: string; c: string } {
  // More forgiving score thresholds for seniors and beginners
  const boost = (ageGroup === 'senior' ? 12 : 0) + (fitnessLevel === 'beginner' ? 8 : 0)

  const isKid     = ageGroup === 'youth'
  const isSenior  = ageGroup === 'senior'
  const isBeginner = fitnessLevel === 'beginner'

  if (score >= 85 - boost)
    return { label: isSenior ? 'Senior Elite 🏅' : isBeginner ? 'Crushing It! 🔥' : isKid ? 'You Rock! ⭐' : 'Elite', c: '#39ff14' }
  if (score >= 70 - boost)
    return { label: isSenior ? 'Strong Form 💪' : isBeginner ? 'Great Job! 👍' : isKid ? 'Nice Work! 🌟' : 'Good', c: '#00f0ff' }
  if (score >= 50 - boost)
    return { label: isSenior ? 'Keep Going 🌟' : isBeginner ? 'Getting There 💫' : isKid ? 'Keep Going! ⚡' : 'Fair', c: '#ffd700' }
  return   { label: isSenior ? 'Take Your Time' : isBeginner ? 'Keep Trying! 🌱' : isKid ? 'Try Again! 💪' : 'Keep Training', c: '#ff4d4d' }
}

// Demographic description for display
export const AGE_LABELS: Record<AgeGroup, string>    = { youth: 'Youth (≤17)', adult: 'Adult', senior: 'Senior (60+)' }
export const FITNESS_LABELS: Record<FitnessLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced / Athlete' }
