import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
import { getDownAdjust }                   from '../utils/profile'
import { saveSession }                     from '../utils/workoutHistory'
import { glassDark, glassPill, glassTint, fontHead, fontBody, fontMono, EASE, ACCENT, ACCENT_GREEN, ACCENT_GOLD, ACCENT_RED } from '../styles/glass'
import { BatteryMeter }                    from '../components/BatteryMeter'
import { SessionSummary }                  from '../components/SessionSummary'
import { ScanlineFx }                      from '../components/ScanlineFx'
import { CameraGuide }                     from '../components/CameraGuide'
import { FitnessDashboard }                from '../components/FitnessDashboard'

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const POSE_MODEL     = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const EXERCISES_LIST = Object.entries(EXERCISES) as [ExerciseId, typeof EXERCISES[ExerciseId]][]
const REP_TARGET     = 10

const BANNER: Record<FormResult['color'], { text: string }> = {
  green:  { text: '#4ade80' },
  yellow: { text: '#fbbf24' },
  red:    { text: '#f87171' },
}

// Computed once at module load (PoseLandmarker is a static import)
const BODY_CONNS = bodyConnections(PoseLandmarker.POSE_CONNECTIONS)

export default function Scanner() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const competeCtx = location.state as { compete?: boolean } | null

  const { settings } = useSettings()

  // Adaptive threshold offset based on user profile
  const downAdjust = useMemo(
    () => getDownAdjust(settings.ageGroup, settings.fitnessLevel),
    [settings.ageGroup, settings.fitnessLevel],
  )

  // ── Dark / low-light detection ────────────────────────────────────────────
  const [isDark,       setIsDark]       = useState(false)
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameCountRef   = useRef(0)

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
  const [showStats,     setShowStats]     = useState(false)   // fitness panel collapsed by default on phones

  const flashTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mirrorRef       = useRef(mirrorMode)
  mirrorRef.current     = mirrorMode
  const lowLightRef     = useRef(settings.lowLightBoost)
  lowLightRef.current   = settings.lowLightBoost

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
  // Reps only count once the round is live (frozen during the pre-match countdown).
  const matchLiveRef             = useRef(true)
  matchLiveRef.current           = !isCompete || compete.matchPhase === 'live'

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
    useRepCounter(exercise, handleRep, handleHalfRep, downAdjust)

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
    }, 1500)
    return () => clearInterval(id)
  }, [isCompete, compete.connected, reps, formScore, exercise, repState])

  // ── Compete round reset ───────────────────────────────────────────────────
  // A new round (initial match or a rematch) bumps roundId — wipe local scores.
  const prevRoundRef = useRef(0)
  useEffect(() => {
    if (!isCompete || compete.roundId === prevRoundRef.current) return
    prevRoundRef.current = compete.roundId
    resetRep()
    fitnessRef.current.reset()
    streakRef.current.reset()
    repRecordsRef.current = []
    lastRepMsRef.current  = 0
    prevRepsRef.current   = 0
    setElapsed(0)
    sessionStartRef.current = performance.now()
    setShowSummary(false)
  }, [compete.roundId, isCompete, resetRep])

  // ── MediaPipe + camera init ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM)
        // Try GPU first; fall back to CPU on devices without a usable GPU (older phones, headless)
        let lm: PoseLandmarker
        try {
          lm = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        } catch {
          lm = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          })
        }
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

        // ── Low-light sampling every 30 frames ───────────────────────────
        frameCountRef.current++
        if (frameCountRef.current % 30 === 0 && lowLightRef.current) {
          if (!sampleCanvasRef.current) {
            sampleCanvasRef.current = document.createElement('canvas')
            sampleCanvasRef.current.width  = 8
            sampleCanvasRef.current.height = 8
          }
          const sc = sampleCanvasRef.current.getContext('2d')!
          sc.drawImage(video, 0, 0, 8, 8)
          const px = sc.getImageData(0, 0, 8, 8).data
          let lum = 0
          for (let i = 0; i < px.length; i += 4)
            lum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
          setIsDark((lum / 64) < 40)
        }

        if (result.landmarks.length > 0) {
          const lm: NormalizedLandmark[] = result.landmarks[0]
          const bodyLm = lm.slice(BODY_START)

          ctx.save()
          ctx.shadowBlur  = 10
          ctx.shadowColor = '#22d3ee'
          draw.drawConnectors(bodyLm, BODY_CONNS, { color: '#67e8f9', lineWidth: 3 })
          ctx.shadowBlur = 0
          draw.drawLandmarks(bodyLm, { radius: 4, color: 'rgba(255,255,255,0.95)', fillColor: 'rgba(34,211,238,0.6)' })
          ctx.restore()

          if (matchLiveRef.current) processRep(lm)
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

  function handleEnd() {
    // Persist session before showing summary
    if (reps > 0 || elapsed > 10) {
      saveSession({
        date: new Date().toISOString(),
        exercise,
        reps,
        halfReps,
        durationSeconds: elapsed,
        avgFormScore: avgScore,
        calories: fitness.calories,
        bestStreak: streak.bestStreak,
        volume: fitness.volume,
      })
    }
    setShowSummary(true)
  }

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
  const isTimeBased = EXERCISES[exercise].isTimeBased
  const winnerState = isCompete && compete.matchPhase !== 'countdown' && reps >= REP_TARGET ? 'win'
    : isCompete && compete.matchPhase !== 'countdown' && (compete.opponent?.reps ?? 0) >= REP_TARGET ? 'lose'
    : null

  // First to the target ⇒ tell both sides the round ended.
  const endMatch = compete.endMatch
  useEffect(() => {
    if (winnerState) endMatch()
  }, [winnerState, endMatch])
  const bannerStyle = feedback ? BANNER[feedback.color] : null
  const glow        = streakGlow(streak.streak)
  const avgScore    = repRecordsRef.current.length
    ? Math.round(repRecordsRef.current.reduce((s, r) => s + r.score, 0) / repRecordsRef.current.length)
    : formScore

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{ background: '#050505', ...(glow ? { boxShadow: glow } : {}) }}
    >

      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0 z-10 gap-2"
        style={{ ...glassDark, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', paddingTop: 'max(10px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          style={{ ...glassPill, color: 'rgba(255,255,255,0.7)', fontSize: 16 }}
        >
          ←
        </button>

        {/* Exercise pills — horizontal scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
          {EXERCISES_LIST.map(([id, cfg]) => (
            <button
              key={id}
              onClick={() => changeExercise(id)}
              className="flex-shrink-0 px-3.5 py-2 rounded-full uppercase tracking-wider transition-all active:scale-95"
              style={
                exercise === id
                  ? { ...fontBody, fontSize: 10, fontWeight: 700, color: '#04201c', background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, border: 'none', boxShadow: `0 2px 14px ${ACCENT}66`, whiteSpace: 'nowrap' }
                  : { ...fontBody, fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', ...glassPill, whiteSpace: 'nowrap' }
              }
            >
              {cfg.icon} {cfg.name}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowStats(s => !s)}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform text-base leading-none"
            style={{ ...glassPill, color: showStats ? ACCENT : 'rgba(255,255,255,0.6)' }}
            title="Stats"
          >
            ◫
          </button>
          <button
            onClick={() => setMirrorMode(m => !m)}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform text-base leading-none"
            style={{ ...glassPill, color: mirrorMode ? ACCENT : 'rgba(255,255,255,0.6)' }}
            title="Mirror"
          >
            ⇔
          </button>
          <button
            onClick={handleEnd}
            className="px-4 h-10 rounded-full text-xs active:scale-95 transition-transform"
            style={{ ...fontMono, ...glassPill, color: 'rgba(255,255,255,0.7)' }}
          >
            End
          </button>
        </div>
      </div>

      {/* Camera area */}
      <div className="relative flex-1 overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
            <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <span style={{ ...fontMono, fontSize: 13, color: 'rgba(34,211,238,0.6)' }}>
              Initialising pose model…
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-20">
            <span style={{ fontFamily: fontHead.fontFamily, color: '#ff4d4d', fontWeight: 700 }}>Camera Error</span>
            <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{errorMsg}</span>
            <button onClick={() => navigate('/')} className="mt-2 px-4 py-2 rounded bg-white/10 text-sm" style={{ fontFamily: '"Space Mono", monospace' }}>
              ← Back
            </button>
          </div>
        )}

        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted
          style={{
            display: status === 'ready' ? 'block' : 'none',
            transform,
            filter: isDark && settings.lowLightBoost ? 'brightness(2.4) contrast(1.3) saturate(1.4)' : 'none',
          }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[1]"
          style={{ display: status === 'ready' ? 'block' : 'none', transform }} />

        <CameraGuide visible={status === 'ready' && !poseDetected && compete.matchPhase !== 'countdown'} />
        {status === 'ready' && <ScanlineFx />}

        {/* Pre-match countdown — synced across both peers; Start Now skips it if both tap */}
        {isCompete && compete.matchPhase === 'countdown' && (
          <div
            className="absolute inset-0 z-[6] flex flex-col items-center justify-center px-8 text-center"
            style={{ background: 'rgba(5,5,5,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          >
            <p style={{ ...fontMono, fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.4)' }}>GET READY</p>
            <div
              key={compete.countdownSec}
              style={{
                ...fontHead, fontSize: 116, fontWeight: 900, lineHeight: 1,
                color: ACCENT_GREEN, textShadow: `0 0 50px ${ACCENT_GREEN}aa`,
                animation: 'winner-pop 0.4s ease-out', margin: '8px 0',
              }}
            >
              {compete.countdownSec > 0 ? compete.countdownSec : 'GO'}
            </div>
            <p style={{ ...fontMono, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              First to {REP_TARGET} {EXERCISES[exercise].name} wins
            </p>
            <button
              onClick={() => compete.startNow()}
              disabled={compete.startedEarly}
              className="mt-8 px-8 py-3.5 rounded-3xl font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
              style={{ ...fontHead, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, color: '#04121a' }}
            >
              {compete.startedEarly ? 'Waiting for rival…' : 'Start now'}
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Angle overlays (HTML, not canvas — avoids mirror-text issue) */}
            {settings.showAngles && angleLabels.map((a, i) => {
              const inRange = a.value >= a.idealMin && a.value <= a.idealMax
              const c = inRange ? '#4ade80' : a.value < a.idealMin ? '#f87171' : '#fbbf24'
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
              className="absolute top-3 left-14 z-[2] px-3.5 py-1.5 rounded-full"
              style={{
                ...fontHead, fontSize: 10, fontWeight: 700,
                color: repState === 'SQUATTING' ? ACCENT_GREEN : 'rgba(255,255,255,0.55)',
                ...(repState === 'SQUATTING' ? glassTint(ACCENT_GREEN) : glassPill),
                borderRadius: 999,
                animation: 'phase-pop 0.25s ease-out',
              }}
            >
              {repState === 'SQUATTING' ? '▼ DOWN' : repState === 'DESCENDING' ? '↓ GO' : '▲ STAND'}
            </div>

            {/* Rep / hold counter — top centre */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[2] text-center px-4 py-1.5 rounded-3xl" style={glassDark}>
              {isTimeBased ? (
                <div style={{
                  ...fontHead,
                  fontSize: holdSec > 0 ? 28 : 18, fontWeight: 900,
                  color: repState === 'SQUATTING' ? ACCENT_GREEN : '#fff',
                  textShadow: repState === 'SQUATTING' ? `0 0 24px ${ACCENT_GREEN}88` : 'none',
                  lineHeight: 1.1,
                }}>
                  {holdSec > 0 ? `${holdSec}s` : 'HOLD'}
                </div>
              ) : (
                <div style={{
                  ...fontHead, fontSize: 32, fontWeight: 900,
                  color: '#fff', textShadow: `0 0 20px ${ACCENT}66`, lineHeight: 1,
                }}>
                  {reps}
                  {halfReps > 0 && (
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginLeft: 3 }}>
                      +{halfReps}½
                    </span>
                  )}
                </div>
              )}
              {streak.streak >= 3 && (
                <div style={{ ...fontMono, fontSize: 9, color: ACCENT_GOLD, marginTop: 1 }}>
                  🔥×{streak.streak}
                </div>
              )}
            </div>

            {/* Form score — top right (offset left of FitnessDashboard when open) */}
            <div
              className="absolute top-3 z-[2] px-3.5 py-1.5 rounded-3xl text-center"
              style={{ right: showStats ? 120 : 12, ...glassDark, transition: `right 0.4s ${EASE}` }}
            >
              <div style={{ ...fontHead, fontSize: 15, fontWeight: 900, color: poseDetected ? ACCENT : 'rgba(255,255,255,0.4)' }}>
                {poseDetected ? `${formScore}%` : '--'}
              </div>
              <div style={{ ...fontMono, fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Form
              </div>
            </div>

            {/* Fitness dashboard — toggle (hidden by default so camera is unobstructed on phones) */}
            {showStats && (
              <FitnessDashboard
                calories={fitness.calories}
                tut={fitness.tut}
                avgPace={fitness.avgPace}
                paceHistory={fitness.paceHistory}
                hrZone={fitness.hrZone}
                volume={fitness.volume}
                unit={settings.unit}
              />
            )}

            {/* Low-light badge */}
            {isDark && settings.lowLightBoost && (
              <div
                className="absolute top-3 z-[3] px-3 py-1 rounded-full"
                style={{
                  left: '50%', transform: 'translateX(-50%)', marginTop: 44,
                  ...fontMono, fontSize: 9, color: ACCENT_GOLD,
                  ...glassTint(ACCENT_GOLD), borderRadius: 999,
                }}
              >
                🌙 Low Light Boost
              </div>
            )}

            {/* Rest indicator */}
            {isResting && (
              <div
                className="absolute z-[3] px-5 py-2 rounded-full"
                style={{
                  bottom: 116, left: '50%', transform: 'translateX(-50%)',
                  ...fontHead, fontSize: 11, fontWeight: 700, letterSpacing: 2,
                  color: ACCENT_GOLD, ...glassTint(ACCENT_GOLD), borderRadius: 999,
                }}
              >
                REST
              </div>
            )}

            {/* Exercise tip when no pose */}
            {!poseDetected && (
              <div
                className="absolute top-16 z-[2] px-4 py-2 rounded-full text-center whitespace-nowrap"
                style={{
                  left: '50%', transform: 'translateX(-50%)',
                  ...fontMono, fontSize: 10, color: 'rgba(255,255,255,0.65)',
                  ...glassDark, borderRadius: 999,
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
                  fontFamily: fontHead.fontFamily, fontSize: 22, fontWeight: 900,
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
                className="absolute z-[2] px-4 py-3 rounded-3xl space-y-1 text-center"
                style={{ top: 64, right: showStats ? 120 : 12, ...glassTint(ACCENT_GREEN), minWidth: 80, transition: `right 0.4s ${EASE}` }}
              >
                <div style={{ ...fontMono, fontSize: 8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>Rival</div>
                <div style={{ ...fontHead, fontSize: 28, fontWeight: 900, color: ACCENT_GREEN }}>
                  {compete.opponent?.reps ?? 0}
                </div>
                <div style={{ ...fontMono, fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
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
                  fontFamily: fontHead.fontFamily, fontSize: 64, fontWeight: 900,
                  color: ACCENT_GREEN, textShadow: '0 0 30px rgba(74,222,128,0.9), 0 0 70px rgba(74,222,128,0.5)',
                }}>
                  NICE! 💪
                </span>
              </div>
            )}

            {/* Compete winner overlay */}
            {winnerState && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-[5]" style={{ background: 'rgba(7,8,16,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                <div style={{
                  ...fontHead, fontSize: 52, fontWeight: 900,
                  color: winnerState === 'win' ? ACCENT_GREEN : ACCENT_RED,
                  textShadow: `0 0 40px ${winnerState === 'win' ? ACCENT_GREEN : ACCENT_RED}aa`,
                  animation: 'winner-pop 0.5s ease-out',
                }}>
                  {winnerState === 'win' ? '🏆 WINNER!' : '💀 DEFEATED'}
                </div>
                <p style={{ ...fontMono, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                  You {reps} · Rival {compete.opponent?.reps ?? 0}
                </p>
                <div className="mt-8 flex items-center gap-3">
                  <button
                    onClick={() => compete.rematch()}
                    className="px-7 py-3.5 rounded-3xl font-black uppercase tracking-widest active:scale-95 transition-transform"
                    style={{ ...fontHead, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_GREEN})`, color: '#04121a', boxShadow: `0 6px 24px ${ACCENT}55` }}
                  >
                    ⟳ Rematch
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="px-7 py-3.5 rounded-3xl font-black uppercase tracking-widest active:scale-95 transition-transform"
                    style={{ ...fontHead, ...glassTint(ACCENT_GREEN), color: ACCENT_GREEN }}
                  >
                    Home
                  </button>
                </div>
              </div>
            )}

            {/* Feedback banner */}
            <div className="absolute bottom-0 inset-x-0 z-[2] px-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {feedback ? (
                <div className="rounded-3xl px-5 py-4" style={glassTint(bannerStyle!.text)}>
                  <p style={{ ...fontHead, fontSize: 24, fontWeight: 900, color: bannerStyle!.text, lineHeight: 1.1 }}>
                    {feedback.feedback}
                  </p>
                  <p style={{ ...fontMono, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {EXERCISES[exercise].name}
                    {isStationary && reps > 0 ? ' · stationary' : ''}
                    {isCompete ? ` · You ${reps} vs ${compete.opponent?.reps ?? 0}` : ''}
                  </p>
                </div>
              ) : (
                <div className="rounded-3xl px-5 py-4" style={glassDark}>
                  <p style={{ ...fontHead, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                    Stand in frame to begin
                  </p>
                  <p style={{ ...fontMono, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
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
          ageGroup={settings.ageGroup}
          fitnessLevel={settings.fitnessLevel}
          onClose={handleSummaryClose}
        />
      )}
    </div>
  )
}
