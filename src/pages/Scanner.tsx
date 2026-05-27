import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  PoseLandmarker, FilesetResolver, DrawingUtils,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import {
  analyzeForm, EXERCISES, getFormScore, getDisplayAngles,
  bodyConnections, BODY_START,
  type ExerciseId, type FormResult, type AngleLabel,
} from '../utils/exercises'
import { useRepCounter, type RepState }   from '../hooks/useRepCounter'
import { useAudio }                        from '../hooks/useAudio'
import { useCompete, type OpponentState }  from '../hooks/useCompete'
import { useStreak, streakGlow }           from '../hooks/useStreak'
import { useVoiceCoach }                   from '../hooks/useVoiceCoach'
import { useFitness }                      from '../hooks/useFitness'
import { useSettings }                     from '../hooks/useSettings'
import { BatteryMeter }                    from '../components/BatteryMeter'
import { SessionSummary }                  from '../components/SessionSummary'
import { ScanlineFx }                      from '../components/ScanlineFx'
import { CameraGuide }                     from '../components/CameraGuide'
import { FitnessDashboard }                from '../components/FitnessDashboard'

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const POSE_MODEL     = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const EXERCISES_LIST = Object.entries(EXERCISES) as [ExerciseId, typeof EXERCISES[ExerciseId]][]
const REP_TARGET     = 10

const BANNER: Record<FormResult['color'], { bg: string; border: string; text: string }> = {
  green:  { bg: 'rgba(0,30,0,0.85)',  border: 'rgba(57,255,20,0.5)',  text: '#39ff14' },
  yellow: { bg: 'rgba(30,25,0,0.85)', border: 'rgba(255,215,0,0.5)',  text: '#ffd700' },
  red:    { bg: 'rgba(30,0,0,0.85)',  border: 'rgba(255,60,60,0.5)',   text: '#ff4d4d' },
}

// Computed once at module load (PoseLandmarker is a static import)
const BODY_CONNS = bodyConnections(PoseLandmarker.POSE_CONNECTIONS)

export default function Scanner() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const competeCtx = location.state as { compete?: boolean } | null

  const { settings } = useSettings()

  // ── Camera ────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef        = useRef(0)
  const lastTimeRef   = useRef(-1)

  const [status,       setStatus]       = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [poseDetected, setPoseDetected] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [exercise,      setExercise]      = useState<ExerciseId>('squat')
  const [feedback,      setFeedback]      = useState<FormResult | null>(null)
  const [formScore,     setFormScore]     = useState(0)
  const [mirrorMode,    setMirrorMode]    = useState(true)
  const [showSummary,   setShowSummary]   = useState(false)
  const [niceKey,       setNiceKey]       = useState(0)
  const [niceVisible,   setNiceVisible]   = useState(false)
  const [angleLabels,   setAngleLabels]   = useState<AngleLabel[]>([])
  const [isResting,     setIsResting]     = useState(false)
  const [holdSec,       setHoldSec]       = useState(0)

  const flashTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mirrorRef       = useRef(mirrorMode)
  mirrorRef.current     = mirrorMode

  // ── Session ───────────────────────────────────────────────────────────────
  const [elapsed,      setElapsed]      = useState(0)
  const sessionStartRef = useRef(0)
  const repRecordsRef   = useRef<{ score: number; depth: number }[]>([])
  const scoreAtFrameRef = useRef(0)
  const lastRepMsRef    = useRef(0)
  const prevRepStateRef = useRef<RepState>('STANDING')
  const prevRepsRef     = useRef(0)

  // ── Audio / compete ───────────────────────────────────────────────────────
  const { repSound, warnSound }  = useAudio()
  const streak                   = useStreak()
  const { speak }                = useVoiceCoach(settings.voiceCoach)
  const compete                  = useCompete()
  const isCompete                = !!competeCtx?.compete
  const broadcastRef             = useRef<(d: Partial<OpponentState>) => void>(compete.broadcast)
  broadcastRef.current           = compete.broadcast

  // ── Rep callbacks ─────────────────────────────────────────────────────────
  const handleRep = useCallback(() => {
    if (settings.soundEffects) repSound()
    if (settings.hapticFeedback) { try { navigator.vibrate?.(120) } catch {} }
    lastRepMsRef.current = Date.now()
    setNiceKey(k => k + 1)
    setNiceVisible(true)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setNiceVisible(false), 950)
  }, [repSound, settings.soundEffects, settings.hapticFeedback])

  const handleHalfRep = useCallback(() => {
    if (settings.hapticFeedback) { try { navigator.vibrate?.(60) } catch {} }
  }, [settings.hapticFeedback])

  const { reps, halfReps, depth, repState, isStationary, process: processRep, reset: resetRep } =
    useRepCounter(exercise, handleRep, handleHalfRep)

  const fitness = useFitness(exercise, reps, settings.weight)

  // Keep stable refs to fitness / streak for callbacks
  const fitnessRef = useRef(fitness)
  fitnessRef.current = fitness
  const streakRef = useRef(streak)
  streakRef.current = streak

  // ── TUT on repState transitions ───────────────────────────────────────────
  useEffect(() => {
    const prev = prevRepStateRef.current
    if (repState === 'SQUATTING' && prev !== 'SQUATTING') fitnessRef.current.onEnterDown()
    if (prev === 'SQUATTING' && repState !== 'SQUATTING') fitnessRef.current.onExitDown()
    prevRepStateRef.current = repState
  }, [repState])

  // ── Rep count change → fitness + streak ───────────────────────────────────
  useEffect(() => {
    if (reps > prevRepsRef.current) {
      fitnessRef.current.onRepComplete()
      repRecordsRef.current.push({ score: scoreAtFrameRef.current, depth })
      if (scoreAtFrameRef.current >= 65) {
        streakRef.current.addGood()
        speak(`Rep ${reps}`)
      } else {
        streakRef.current.breakStreak()
      }
    }
    prevRepsRef.current = reps
  }, [reps, depth, speak])

  // ── Milestone → voice ─────────────────────────────────────────────────────
  useEffect(() => {
    if (streak.milestone) speak(streak.milestone.replace(/[^\w\s]/g, ''), true)
  }, [streak.milestone, speak])

  // ── Rest timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (reps === 0) { setIsResting(false); return }
      setIsResting(Date.now() - lastRepMsRef.current > 5000)
    }, 500)
    return () => clearInterval(id)
  }, [reps])

  // ── Plank hold timer ──────────────────────────────────────────────────────
  const holdStartRef = useRef<number | null>(null)
  useEffect(() => {
    if (exercise !== 'plank') { setHoldSec(0); return }
    if (repState === 'SQUATTING') {
      if (!holdStartRef.current) holdStartRef.current = Date.now()
      const id = setInterval(() => {
        if (holdStartRef.current) setHoldSec(Math.floor((Date.now() - holdStartRef.current) / 1000))
      }, 250)
      return () => clearInterval(id)
    } else {
      holdStartRef.current = null
      setHoldSec(0)
    }
  }, [repState, exercise])

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return
    sessionStartRef.current = performance.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  // ── Compete broadcast ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCompete || !compete.connected) return
    const id = setInterval(() => {
      broadcastRef.current({ reps, formScore, exercise, phase: repState === 'SQUATTING' ? 'down' : 'up' })
    }, 800)
    return () => clearInterval(id)
  }, [isCompete, compete.connected, reps, formScore, exercise, repState])

  // ── MediaPipe + camera init ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM)
        const lm = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) { lm.close(); return }
        landmarkerRef.current = lm

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: settings.cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStatus('ready')
      } catch (e) {
        if (!cancelled) { setErrorMsg(e instanceof Error ? e.message : 'Unknown'); setStatus('error') }
      }
    }
    init()
    return () => { cancelled = true }
  }, []) // eslint-disable-line

  // ── Detection loop ────────────────────────────────────────────────────────
  const exerciseRef = useRef(exercise)
  exerciseRef.current = exercise
  const showAnglesRef = useRef(settings.showAngles)
  showAnglesRef.current = settings.showAngles

  useEffect(() => {
    if (status !== 'ready') return
    const video  = videoRef.current!
    const canvas = canvasRef.current!
    const ctx    = canvas.getContext('2d')!
    const draw   = new DrawingUtils(ctx)

    function loop() {
      if (!landmarkerRef.current || video.paused || video.ended) {
        rafRef.current = requestAnimationFrame(loop); return
      }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight

      if (video.currentTime !== lastTimeRef.current) {
        lastTimeRef.current = video.currentTime
        const result = landmarkerRef.current.detectForVideo(video, performance.now())
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (result.landmarks.length > 0) {
          const lm: NormalizedLandmark[] = result.landmarks[0]
          const bodyLm = lm.slice(BODY_START)

          ctx.save()
          ctx.shadowBlur  = 10
          ctx.shadowColor = '#00f0ff'
          draw.drawConnectors(bodyLm, BODY_CONNS, { color: '#00f0ff', lineWidth: 2 })
          ctx.shadowBlur = 0
          draw.drawLandmarks(bodyLm, { radius: 3, color: 'rgba(0,240,255,0.9)', fillColor: 'rgba(0,0,0,0.5)' })
          ctx.restore()

          processRep(lm)
          const form  = analyzeForm(exerciseRef.current, lm)
          const score = getFormScore(exerciseRef.current, lm)
          scoreAtFrameRef.current = score
          setFeedback(form)
          setFormScore(score)
          setPoseDetected(true)
          if (showAnglesRef.current) {
            setAngleLabels(getDisplayAngles(exerciseRef.current, lm))
          }
        } else {
          setPoseDetected(false)
          setFeedback(null)
          setAngleLabels([])
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [status, processRep])

  // ── Form change → voice + warn sound ─────────────────────────────────────
  const lastFbRef = useRef('')
  useEffect(() => {
    if (!feedback) return
    if (feedback.feedback !== lastFbRef.current) {
      lastFbRef.current = feedback.feedback
      if (feedback.color !== 'green') {
        speak(feedback.feedback)
        if (feedback.color === 'red' && settings.soundEffects) warnSound()
      }
    }
  }, [feedback, speak, warnSound, settings.soundEffects])

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      const video = videoRef.current
      if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      landmarkerRef.current?.close()
    }
  }, [])

  // ── Actions ───────────────────────────────────────────────────────────────
  const changeExercise = useCallback((ex: ExerciseId) => {
    setExercise(ex)
    setFeedback(null)
    setFormScore(0)
    setAngleLabels([])
    resetRep()
    fitnessRef.current.reset()
    streakRef.current.reset()
  }, [resetRep])

  function handleEnd() { setShowSummary(true) }

  function handleSummaryClose() {
    setShowSummary(false)
    resetRep()
    fitnessRef.current.reset()
    streakRef.current.reset()
    setElapsed(0)
    sessionStartRef.current = performance.now()
    repRecordsRef.current = []
    lastRepMsRef.current  = 0
    prevRepsRef.current   = 0
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const transform   = mirrorMode ? 'scaleX(-1)' : 'none'
  const fmtTime     = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const isTimeBased = EXERCISES[exercise].isTimeBased
  const winnerState = isCompete && reps >= REP_TARGET ? 'win'
    : isCompete && (compete.opponent?.reps ?? 0) >= REP_TARGET ? 'lose'
    : null
  const bannerStyle = feedback ? BANNER[feedback.color] : null
  const glow        = streakGlow(streak.streak)
  const avgScore    = repRecordsRef.current.length
    ? Math.round(repRecordsRef.current.reduce((s, r) => s + r.score, 0) / repRecordsRef.current.length)
    : formScore

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: '#0a0a0a', ...(glow ? { boxShadow: glow } : {}) }}
    >

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0 z-10 gap-2"
        style={{ background: 'rgba(0,0,0,0.9)', borderBottom: '1px solid rgba(0,240,255,0.12)' }}
      >
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white transition-colors shrink-0"
          style={{ fontFamily: '"Space Mono", monospace', fontSize: 14 }}
        >
          ←
        </button>

        {/* Exercise pills — horizontal scroll */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0">
          {EXERCISES_LIST.map(([id, cfg]) => (
            <button
              key={id}
              onClick={() => changeExercise(id)}
              className="flex-shrink-0 px-2 py-1 rounded-full uppercase tracking-widest transition-all active:scale-95"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 8,
                fontWeight: 700,
                background: exercise === id ? '#00f0ff' : 'rgba(0,240,255,0.06)',
                color: exercise === id ? '#000' : 'rgba(0,240,255,0.6)',
                border: `1px solid ${exercise === id ? '#00f0ff' : 'rgba(0,240,255,0.2)'}`,
              }}
            >
              {cfg.icon} {cfg.name}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {fmtTime(elapsed)}
          </span>
          <span style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 14, fontWeight: 900, color: '#00f0ff' }}>
            {isTimeBased ? `${holdSec}s` : reps}
          </span>
          <button
            onClick={handleEnd}
            className="px-2 py-1 rounded text-xs text-white/30 hover:text-white/60 transition-colors"
            style={{ fontFamily: '"Space Mono", monospace', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            End
          </button>
          <button onClick={() => setMirrorMode(m => !m)} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">
            ⇔
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="relative flex-1 overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: 'rgba(0,240,255,0.5)' }}>
              Initialising pose model…
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-20">
            <span style={{ fontFamily: '"Orbitron", sans-serif', color: '#ff4d4d', fontWeight: 700 }}>Camera Error</span>
            <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{errorMsg}</span>
            <button onClick={() => navigate('/')} className="mt-2 px-4 py-2 rounded bg-white/10 text-sm" style={{ fontFamily: '"Space Mono", monospace' }}>
              ← Back
            </button>
          </div>
        )}

        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted
          style={{ display: status === 'ready' ? 'block' : 'none', transform }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[1]"
          style={{ display: status === 'ready' ? 'block' : 'none', transform }} />

        <CameraGuide visible={status === 'ready' && !poseDetected} />
        {status === 'ready' && <ScanlineFx />}

        {status === 'ready' && (
          <>
            {/* Angle overlays (HTML, not canvas — avoids mirror-text issue) */}
            {settings.showAngles && angleLabels.map((a, i) => {
              const inRange = a.value >= a.idealMin && a.value <= a.idealMax
              const c = inRange ? '#39ff14' : a.value < a.idealMin ? '#ff4d4d' : '#ffd700'
              const lx = mirrorMode ? (1 - a.landmark.x) * 100 : a.landmark.x * 100
              const ly = a.landmark.y * 100
              return (
                <div
                  key={i}
                  className="absolute pointer-events-none z-[3]"
                  style={{
                    left: `${lx}%`, top: `${ly}%`,
                    transform: 'translate(8px, -50%)',
                    fontFamily: '"Space Mono", monospace',
                    fontSize: 11, fontWeight: 700, color: c,
                    textShadow: '0 0 6px rgba(0,0,0,1)',
                  }}
                >
                  {Math.round(a.value)}°
                </div>
              )
            })}

            {/* Battery — left edge */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-[2]">
              <BatteryMeter depth={depth} />
            </div>

            {/* Phase badge */}
            <div
              key={repState}
              className="absolute top-3 left-14 z-[2] px-3 py-1.5 rounded-lg"
              style={{
                fontFamily: '"Orbitron", sans-serif', fontSize: 10, fontWeight: 700,
                color: repState === 'SQUATTING' ? '#39ff14' : 'rgba(255,255,255,0.4)',
                background: 'rgba(0,0,0,0.65)',
                border: `1px solid ${repState === 'SQUATTING' ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.1)'}`,
                animation: 'phase-pop 0.25s ease-out',
              }}
            >
              {repState === 'SQUATTING' ? '▼ DOWN' : repState === 'DESCENDING' ? '↓ GO' : '▲ STAND'}
            </div>

            {/* Rep / hold counter — top centre */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[2] text-center">
              {isTimeBased ? (
                <div style={{
                  fontFamily: '"Orbitron", sans-serif',
                  fontSize: holdSec > 0 ? 28 : 18, fontWeight: 900,
                  color: repState === 'SQUATTING' ? '#39ff14' : '#00f0ff',
                  textShadow: repState === 'SQUATTING' ? '0 0 20px rgba(57,255,20,0.6)' : 'none',
                  lineHeight: 1,
                }}>
                  {holdSec > 0 ? `${holdSec}s` : 'HOLD'}
                </div>
              ) : (
                <div style={{
                  fontFamily: '"Orbitron", sans-serif', fontSize: 32, fontWeight: 900,
                  color: '#00f0ff', textShadow: '0 0 16px rgba(0,240,255,0.5)', lineHeight: 1,
                }}>
                  {reps}
                  {halfReps > 0 && (
                    <span style={{ fontSize: 13, color: 'rgba(0,240,255,0.5)', marginLeft: 3 }}>
                      +{halfReps}½
                    </span>
                  )}
                </div>
              )}
              {streak.streak >= 3 && (
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 9, color: '#ffd700', marginTop: 1 }}>
                  🔥×{streak.streak}
                </div>
              )}
            </div>

            {/* Form score — top right (offset left of FitnessDashboard) */}
            <div
              className="absolute top-3 z-[2] px-3 py-1.5 rounded-lg text-center"
              style={{ right: 118, background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,240,255,0.15)' }}
            >
              <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 14, fontWeight: 900, color: '#00f0ff' }}>
                {poseDetected ? `${formScore}%` : '--'}
              </div>
              <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 8, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Form
              </div>
            </div>

            {/* Fitness dashboard */}
            <FitnessDashboard
              calories={fitness.calories}
              tut={fitness.tut}
              avgPace={fitness.avgPace}
              paceHistory={fitness.paceHistory}
              hrZone={fitness.hrZone}
              volume={fitness.volume}
              unit={settings.unit}
            />

            {/* Rest indicator */}
            {isResting && (
              <div
                className="absolute z-[3] px-4 py-2 rounded-xl"
                style={{
                  bottom: 110, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: '"Orbitron", sans-serif', fontSize: 11,
                  color: '#ffd700', background: 'rgba(0,0,0,0.7)',
                  border: '1px solid rgba(255,215,0,0.3)',
                }}
              >
                REST
              </div>
            )}

            {/* Exercise tip when no pose */}
            {!poseDetected && (
              <div
                className="absolute top-16 z-[2] px-4 py-2 rounded-xl text-center whitespace-nowrap"
                style={{
                  left: '50%', transform: 'translateX(-50%)',
                  fontFamily: '"Space Mono", monospace', fontSize: 10,
                  color: 'rgba(255,215,0,0.7)', background: 'rgba(0,0,0,0.65)',
                  border: '1px solid rgba(255,215,0,0.15)',
                }}
              >
                {EXERCISES[exercise].tip}
              </div>
            )}

            {/* Streak milestone flash */}
            {streak.milestone && (
              <div
                className="absolute z-[4] pointer-events-none"
                style={{
                  top: '25%', left: '50%', transform: 'translateX(-50%)',
                  animation: 'winner-pop 0.4s ease-out',
                  fontFamily: '"Orbitron", sans-serif', fontSize: 22, fontWeight: 900,
                  color: '#ffd700', textShadow: '0 0 30px rgba(255,215,0,0.8)',
                  whiteSpace: 'nowrap',
                }}
              >
                {streak.milestone}
              </div>
            )}

            {/* Compete rival panel */}
            {isCompete && compete.connected && (
              <div
                className="absolute top-14 z-[2] px-4 py-3 rounded-xl space-y-1 text-center"
                style={{
                  right: 118, background: 'rgba(0,0,0,0.75)',
                  border: '1px solid rgba(57,255,20,0.3)', minWidth: 80,
                }}
              >
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Rival</div>
                <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 28, fontWeight: 900, color: '#39ff14' }}>
                  {compete.opponent?.reps ?? 0}
                </div>
                <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                  {compete.opponent?.formScore ?? 0}% form
                </div>
              </div>
            )}

            {/* NICE flash */}
            {niceVisible && (
              <div
                key={niceKey}
                className="absolute inset-0 flex items-center justify-center z-[3] pointer-events-none"
                style={{ animation: 'nice-flash 0.95s ease-out forwards' }}
              >
                <span style={{
                  fontFamily: '"Orbitron", sans-serif', fontSize: 64, fontWeight: 900,
                  color: '#39ff14', textShadow: '0 0 30px rgba(57,255,20,0.9), 0 0 70px rgba(57,255,20,0.5)',
                }}>
                  NICE! 💪
                </span>
              </div>
            )}

            {/* Compete winner overlay */}
            {winnerState && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-[5]" style={{ background: 'rgba(0,0,0,0.85)' }}>
                <div style={{
                  fontFamily: '"Orbitron", sans-serif', fontSize: 52, fontWeight: 900,
                  color: winnerState === 'win' ? '#39ff14' : '#ff4d4d',
                  textShadow: `0 0 40px ${winnerState === 'win' ? 'rgba(57,255,20,0.9)' : 'rgba(255,77,77,0.9)'}`,
                  animation: 'winner-pop 0.5s ease-out',
                }}>
                  {winnerState === 'win' ? '🏆 WINNER!' : '💀 DEFEATED'}
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="mt-8 px-8 py-3 rounded-xl font-black uppercase tracking-widest"
                  style={{ fontFamily: '"Orbitron", sans-serif', background: '#00f0ff', color: '#000' }}
                >
                  Home
                </button>
              </div>
            )}

            {/* Feedback banner */}
            <div className="absolute bottom-0 inset-x-0 z-[2] px-3 pb-3">
              {feedback ? (
                <div
                  className="rounded-2xl px-5 py-4 backdrop-blur-md"
                  style={{ background: bannerStyle!.bg, border: `1px solid ${bannerStyle!.border}` }}
                >
                  <p style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 24, fontWeight: 900, color: bannerStyle!.text, lineHeight: 1.1 }}>
                    {feedback.feedback}
                  </p>
                  <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                    {EXERCISES[exercise].name}
                    {isStationary && reps > 0 ? ' · stationary' : ''}
                    {isCompete ? ` · You ${reps} vs ${compete.opponent?.reps ?? 0}` : ''}
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-2xl px-5 py-4 backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
                    Stand in frame to begin
                  </p>
                  <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
                    {EXERCISES[exercise].tip}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Session summary */}
      {showSummary && (
        <SessionSummary
          reps={reps}
          halfReps={halfReps}
          avgFormScore={avgScore}
          elapsedSeconds={elapsed}
          bestStreak={streak.bestStreak}
          calories={fitness.calories}
          tut={fitness.tut}
          volume={fitness.volume}
          unit={settings.unit}
          repRecords={repRecordsRef.current}
          onClose={handleSummaryClose}
        />
      )}
    </div>
  )
}
