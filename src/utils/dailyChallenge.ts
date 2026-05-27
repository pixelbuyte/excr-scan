export interface ChallengeTask {
  exercise: string
  reps?: number
  seconds?: number
  label: string
}
export interface DailyChallenge {
  title: string
  tasks: ChallengeTask[]
  date: string
}

const POOL: Array<{ title: string; tasks: ChallengeTask[] }> = [
  { title: 'Power Circuit',      tasks: [{ exercise: 'squat',         reps: 20,    label: '20 Squats'        }, { exercise: 'pushup', reps: 15,    label: '15 Push-ups'  }, { exercise: 'plank', seconds: 30, label: '30s Plank' }] },
  { title: 'Leg Day',            tasks: [{ exercise: 'squat',         reps: 25,    label: '25 Squats'        }, { exercise: 'lunge',  reps: 20,    label: '20 Lunges'    }] },
  { title: 'Upper Body Burn',    tasks: [{ exercise: 'pushup',        reps: 20,    label: '20 Push-ups'      }, { exercise: 'shoulder_press', reps: 15, label: '15 Shoulder Press' }, { exercise: 'plank', seconds: 45, label: '45s Plank' }] },
  { title: 'Cardio Blast',       tasks: [{ exercise: 'jumping_jacks', reps: 30,    label: '30 Jumping Jacks' }, { exercise: 'squat',  reps: 15,    label: '15 Squats'    }, { exercise: 'pushup', reps: 10, label: '10 Push-ups' }] },
  { title: 'Full Body Express',  tasks: [{ exercise: 'squat',         reps: 15,    label: '15 Squats'        }, { exercise: 'pushup', reps: 15,    label: '15 Push-ups'  }, { exercise: 'lunge', reps: 15, label: '15 Lunges'   }, { exercise: 'plank', seconds: 30, label: '30s Plank' }] },
  { title: 'Strength & Burn',    tasks: [{ exercise: 'squat',         reps: 30,    label: '30 Squats'        }, { exercise: 'shoulder_press', reps: 20, label: '20 Shoulder Press' }] },
  { title: 'Cardio Endurance',   tasks: [{ exercise: 'jumping_jacks', reps: 50,    label: '50 Jumping Jacks' }, { exercise: 'plank', seconds: 60, label: '60s Plank'    }] },
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

export function getDailyChallenge(): DailyChallenge {
  const today = new Date()
  const seed  = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const idx   = Math.floor(seededRandom(seed) * POOL.length)
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return { ...POOL[idx], date: dateStr }
}

const PB_KEY = 'excr_daily_pb'

export interface DailyPB {
  date: string
  completed: boolean
}

export function getDailyPBs(): DailyPB[] {
  try { return JSON.parse(localStorage.getItem(PB_KEY) ?? '[]') } catch { return [] }
}

export function markDailyComplete() {
  const today = new Date().toISOString().split('T')[0]
  const pbs   = getDailyPBs().filter(p => p.date !== today)
  pbs.push({ date: today, completed: true })
  localStorage.setItem(PB_KEY, JSON.stringify(pbs.slice(-30)))
}

export function getWeeklyStreak(): number {
  const pbs = getDailyPBs()
  let streak = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    if (pbs.some(p => p.date === key && p.completed)) streak++
    else break
  }
  return streak
}
