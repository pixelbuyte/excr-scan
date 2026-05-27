import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { analyzeForm, EXERCISES, REP_THRESHOLDS, type ExerciseId, type FormResult } from '../utils/exercises'

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const BANNER_BG: Record<FormResult['color'], string> = {
  green:  'bg-green-950/80 border-green-500/40',
  yellow: 'bg-yellow-950/80 border-yellow-500/40',
  red:    'bg-red-950/80 border-red-500/40',
}
const BANNER_TEXT: Record<FormResult['color'], string> = {
  green:  'text-green-300',
  yellow: 'text-yellow-300',
  red:    'text-red-300',
}
const PHASE_MESSAGES = ['Down ↓', 'Up ↑'] as const

export default function Scanner() {
  const navigate = useNavigate()
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef      = useRef(0)
  const lastTime    = useRef(-1)
  const repPhaseRef = useRef<'up' | 'down'>('up')
  const exerciseRef = useRef<ExerciseId>('squat')
  const flashTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [exercise, setExercise] = useState<ExerciseId>('squat')
  const [reps, setReps]         = useState(0)
  const [feedback, setFeedback] = useState<FormResult | null>(null)
  const [phase, setPhase]       = useState<'up' | 'down'>('up')
  const [niceFlash, setNiceFlash] = useState(false)
  const [flashKey, setFlashKey]   = useState(0)
  const [status, setStatus]     = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  exerciseRef.current = exercise

  // Init MediaPipe + camera
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) { landmarker.close(); return }
        landmarkerRef.current = landmarker

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
          setStatus('error')
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Detection loop
  useEffect(() => {
    if (status !== 'ready') return

    const video   = videoRef.current!
    const canvas  = canvasRef.current!
    const ctx     = canvas.getContext('2d')!
    const drawing = new DrawingUtils(ctx)

    function loop() {
      if (!landmarkerRef.current || video.paused || video.ended) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight

      if (video.currentTime !== lastTime.current) {
        lastTime.current = video.currentTime
        const result = landmarkerRef.current.detectForVideo(video, performance.now())

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (result.landmarks.length > 0) {
          const lm: NormalizedLandmark[] = result.landmarks[0]

          drawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
            color: 'rgba(255,255,255,0.5)',
            lineWidth: 2,
          })
          drawing.drawLandmarks(lm, {
            radius: 4,
            color: 'rgba(255,255,255,0.9)',
            fillColor: 'rgba(0,0,0,0.4)',
          })

          const form = analyzeForm(exerciseRef.current, lm)
          setFeedback(form)

          // Hysteresis rep counting — phase only flips when angle crosses the FAR threshold.
          // The 50° dead zone (105°→155° for squat) prevents boundary flicker from double-counting.
          const { down: downThresh, up: upThresh, getAngle: getRawAngle } = REP_THRESHOLDS[exerciseRef.current]
          const rawAngle = getRawAngle(lm)

          if (repPhaseRef.current === 'up' && rawAngle < downThresh) {
            repPhaseRef.current = 'down'
            setPhase('down')
          } else if (repPhaseRef.current === 'down' && rawAngle > upThresh) {
            repPhaseRef.current = 'up'
            setPhase('up')
            setReps(r => r + 1)
            if (flashTimer.current) clearTimeout(flashTimer.current)
            setNiceFlash(true)
            setFlashKey(k => k + 1)
            flashTimer.current = setTimeout(() => setNiceFlash(false), 900)
          }
        } else {
          setFeedback(null)
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      const video = videoRef.current
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
      landmarkerRef.current?.close()
    }
  }, [])

  const handleExerciseChange = useCallback((ex: ExerciseId) => {
    setExercise(ex)
    setReps(0)
    setFeedback(null)
    setPhase('up')
    repPhaseRef.current = 'up'
  }, [])

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10 shrink-0 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <span className="font-semibold text-sm">ExcrScan</span>

        <select
          value={exercise}
          onChange={e => handleExerciseChange(e.target.value as ExerciseId)}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white
                     focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
        >
          {(Object.entries(EXERCISES) as [ExerciseId, { name: string }][]).map(([id, { name }]) => (
            <option key={id} value={id} className="bg-zinc-900">{name}</option>
          ))}
        </select>
      </div>

      {/* Camera + overlay stack */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading */}
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/50 z-20">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span>Loading pose model…</span>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-20">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-red-400 font-medium">Camera error</span>
            <span className="text-white/40 text-sm">{errorMsg}</span>
            <button onClick={() => navigate('/')} className="mt-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm">
              Go back
            </button>
          </div>
        )}

        {/* Video + skeleton canvas */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline muted
          style={{ display: status === 'ready' ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[1]"
          style={{ display: status === 'ready' ? 'block' : 'none', transform: 'scaleX(-1)' }}
        />

        {/* ── HUD (all z-[2] so it sits above canvas) ── */}
        {status === 'ready' && (
          <>
            {/* Top-left: rep counter + phase badge */}
            <div className="absolute top-3 left-3 z-[2] flex items-start gap-2">
              {/* Rep counter */}
              <div className="bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center min-w-[72px]">
                <div className="text-5xl font-black tabular-nums leading-none">{reps}</div>
                <div className="text-white/40 text-[11px] uppercase tracking-widest mt-1 font-medium">Reps</div>
              </div>

              {/* Phase badge */}
              {feedback && (
                <div
                  key={phase}
                  className="bg-black/70 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10"
                  style={{ animation: 'phase-pop 0.25s ease-out' }}
                >
                  <div className="text-white font-bold text-sm tabular-nums">
                    {phase === 'down' ? PHASE_MESSAGES[0] : PHASE_MESSAGES[1]}
                  </div>
                </div>
              )}
            </div>

            {/* Center "Nice!" flash */}
            {niceFlash && (
              <div
                key={flashKey}
                className="absolute inset-0 flex items-center justify-center z-[3] pointer-events-none"
                style={{ animation: 'nice-flash 0.9s ease-out forwards' }}
              >
                <span
                  className="text-7xl font-black text-green-400 select-none"
                  style={{ textShadow: '0 0 40px rgba(74,222,128,0.9), 0 0 80px rgba(74,222,128,0.5)' }}
                >
                  Nice! 🎉
                </span>
              </div>
            )}

            {/* Bottom feedback banner */}
            <div className="absolute bottom-0 inset-x-0 z-[2]">
              {feedback ? (
                <div
                  className={`mx-3 mb-3 rounded-2xl border backdrop-blur-md px-6 py-4 ${BANNER_BG[feedback.color]}`}
                >
                  <p className={`text-3xl font-black leading-tight ${BANNER_TEXT[feedback.color]}`}>
                    {feedback.feedback}
                  </p>
                  <p className="text-white/30 text-sm mt-1 font-medium">
                    {EXERCISES[exercise].name} · {phase === 'down' ? 'going down' : 'coming up'}
                  </p>
                </div>
              ) : (
                <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md px-6 py-4">
                  <p className="text-2xl font-bold text-white/50">Stand in frame to begin</p>
                  <p className="text-white/20 text-sm mt-1">
                    Position yourself so your full body is visible
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
