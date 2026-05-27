import type { ExerciseId } from './exercises'

export interface WorkoutSession {
  id: string
  date: string           // ISO date string
  exercise: ExerciseId
  reps: number
  halfReps: number
  durationSeconds: number
  avgFormScore: number
  calories: number
  bestStreak: number
  volume: number
}

const KEY = 'excr_workout_history'
const MAX = 200  // ~3 months of daily sessions

export function saveSession(s: Omit<WorkoutSession, 'id'>): void {
  const history = getHistory()
  history.unshift({ ...s, id: `${Date.now()}` })
  try { localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX))) } catch {}
}

export function getHistory(): WorkoutSession[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function clearHistory(): void {
  localStorage.removeItem(KEY)
}

export function getTotalStats() {
  const h = getHistory()
  if (!h.length) return { sessions: 0, reps: 0, calories: 0, minutes: 0, avgForm: 0 }
  return {
    sessions:  h.length,
    reps:      h.reduce((s, r) => s + r.reps, 0),
    calories:  Math.round(h.reduce((s, r) => s + r.calories, 0)),
    minutes:   Math.round(h.reduce((s, r) => s + r.durationSeconds, 0) / 60),
    avgForm:   Math.round(h.reduce((s, r) => s + r.avgFormScore, 0) / h.length),
  }
}

export function getActiveDays(): number {
  const dates = new Set(getHistory().map(h => h.date.slice(0, 10)))
  return dates.size
}
