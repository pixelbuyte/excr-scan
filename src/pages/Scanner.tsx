import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  PoseLandmarker, FilesetResolver, DrawingUtils,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import { analyzeForm, EXERCISES, getFormScore, type ExerciseId, type FormResult } from '../utils/exercises'
import { useRepCounter } from '../hooks/useRepCounter'
import { useAudio }      from '../hooks/useAudio'
import { useCompete, type OpponentState } from '../hooks/useCompete'
import { BatteryMeter }  from '../components/BatteryMeter'
import { SessionSummary } from '../components/SessionSummary'
import { ScanlineFx }   from '../components/ScanlineFx'

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const POSE_MODEL     = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const EXERCISES_LIST = Object.entries(EXERCISES) as [ExerciseId, { name: string }][]
const REP_TARGET     = 10  // first to this in compete mode wins

const BANNER_STYLE: Record<FormResult['color'], { bg: string; border: string; text: string }> = {
  green:  { bg: 'rgba(0,30,0,0.85)',  border: 'rgba(57,255,20,0.5)',  text: '#39ff14' },
  yellow: { bg: 'rgba(30,25,0,0.85)', border: 'rgba(255,215,0,0.5)',  text: '#ffd700' },
  red:    { bg: 'rgba(30,0,0,0.85)',  border: 'rgba(255,60,60,0.5)',   text: '#ff4d4d' },
}

export default function Scanner() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const competeCtx = (location.state as { compete?: boolean; roomCode?: string } | null)

  // ── Camera + MediaPipe ──────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const rafRef        = useRef(0)
  const lastTimeRef   = useRef(-1)

  const [status,    setStatus]   = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMsg,  setErrorMsg] = useState('')

  // ── Exercise & UI state ─────────────────────────────────────────────────────
  const [exercise,    setExercise]    = useState<ExerciseId>('squat')
  const [feedback,    setFeedback]    = useState<FormResult | null>(null)
  const [formScore,   setFormScore]   = useState(0)
  const [mirrorMode,  setMirrorMode]  = useState(true)
  const [showSummary, setShowSummary] = useState(false)
  const [niceKey,     setNiceKey]     = useState(0)
  const [niceVisible, setNiceVisible] = useState(false)
  const flashTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Session tracking ────────────────────────────────────────────────────────
  const [elapsed, setElapsed]   = useState(0)
  const sessionStart            = useRef(0)
  const formScoreHistory        = useRef<number[]>([])
  const bestStreakRef            = useRef(0)
  const currentStreakRef         = useRef(0)

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const { repSound } = useAudio()

  const handleRep = useCallback(() => {
    repSound()
    try { navigator.vibrate?.(120) } catch {}
    setNiceKey(k => k + 1)
    setNiceVisible(true)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setNiceVisible(false), 950)
  }, [repSound])

  const { reps, depth, repState, process: processRep, reset: resetRep } =
    useRepCounter(exercise, handleRep)

  // Compete mode
  const compete = useCompete()
  const isCompete = !!competeCtx?.compete
  const broadcastRef = useRef<(data: Partial<OpponentState>) => void>(compete.broadcast)
  broadcastRef.current = compete.broadcast

  // ── Session timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return
    sessionStart.current = performance.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - sessionStart.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  // Broadcast to opponent every 800ms
  useEffect(() => {
    if (!isCompete || !compete.connected) return
    const id = setInterval(() => {
      broadcastRef.current({ reps, formScore, exercise, phase: repState === 'SQUATTING' ? 'down' : 'up' })
    }, 800)
    return () => clearInterval(id)
  }, [isCompete, compete.connected, reps, formScore, exercise, repState])

  // ── MediaPipe + camera init ──────────────────────────────────────────────────
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
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setStatus('ready')
      } catch (e) {
        if (!cancelled) { setErrorMsg(e instanceof Error ? e.message : 'Unknown error'); setStatus('error') }
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  // ── Detection loop ────────────────────────────────────────────────────────────
  const exerciseRef = useRef(exercise)
  exerciseRef.current = exercise

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

          // Neon cyan skeleton with glow
          ctx.save()
          ctx.shadowBlur  = 10
          ctx.shadowColor = '#00f0ff'
          draw.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, { color: '#00f0ff', lineWidth: 2 })
          ctx.shadowBlur = 0
          draw.drawLandmarks(lm, { radius: 4, color: 'rgba(0,240,255,0.9)', fillColor: 'rgba(0,0,0,0.5)' })
          ctx.restore()

          processRep(lm)
          const form  = analyzeForm(exerciseRef.current, lm)
          const score = getFormScore(exerciseRef.current, lm)
          setFeedback(form)
          setFormScore(score)

          // Track form score history on each rep phase entry
          if (form.color === 'green') {
            currentStreakRef.current += 1
            if (currentStreakRef.current > bestStreakRef.current) bestStreakRef.current = currentStreakRef.current
          } else {
            currentStreakRef.current = 0
          }
        } else {
          setFeedback(null)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    loop()
    return () => cancelAnimationFrame(rafRef.current)
  }, [status, processRep])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      const video = videoRef.current
      if (video?.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      landmarkerRef.current?.close()
    }
  }, [])

  const changeExercise = useCallback((ex: ExerciseId) => {
    setExercise(ex)
    setFeedback(null)
    setFormScore(0)
    resetRep()
  }, [resetRep])

  function handleEnd() {
    formScoreHistory.current.push(formScore)
    setShowSummary(true)
  }

  function handleSummaryClose() {
    setShowSummary(false)
    resetRep()
    setElapsed(0)
    sessionStart.current = performance.now()
    formScoreHistory.current = []
    bestStreakRef.current = 0
    currentStreakRef.current = 0
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const transform = mirrorMode ? 'scaleX(-1)' : 'none'
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const avgScore = formScoreHistory.current.length
    ? Math.round(formScoreHistory.current.reduce((a, b) => a + b, 0) / formScoreHistory.current.length)
    : formScore
  const bannerStyle = feedback ? BANNER_STYLE[feedback.color] : null

  const winnerState = isCompete && reps >= REP_TARGET ? 'win'
    : isCompete && compete.opponent.reps >= REP_TARGET ? 'lose'
    : null

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0 z-10"
        style={{ background: 'rgba(0,0,0,0.9)', borderBottom: '1px solid rgba(0,240,255,0.12)' }}
      >
        {/* Back + exercise pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="text-white/40 hover:text-white transition-colors mr-1"
            style={{ fontFamily: '"Space Mono", monospace', fontSize: 12 }}
          >
            ←
          </button>
          {EXERCISES_LIST.map(([id, { name }]) => (
            <button
              key={id}
              onClick={() => changeExercise(id)}
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                background: exercise === id ? '#00f0ff' : 'rgba(0,240,255,0.06)',
                color: exercise === id ? '#000' : 'rgba(0,240,255,0.6)',
                border: `1px solid ${exercise === id ? '#00f0ff' : 'rgba(0,240,255,0.2)'}`,
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Timer */}
        <span
          className="text-white/50 tabular-nums text-sm"
          style={{ fontFamily: '"Space Mono", monospace' }}
        >
          {fmtTime(elapsed)}
        </span>

        {/* Reps */}
        <div className="flex items-center gap-2">
          {isCompete && (
            <span
              className="text-xs font-bold tabular-nums"
              style={{ fontFamily: '"Orbitron", sans-serif', color: '#39ff14' }}
            >
              {compete.opponent.reps}
            </span>
          )}
          <div
            className="text-xl font-black tabular-nums"
            style={{ fontFamily: '"Orbitron", sans-serif', color: '#00f0ff' }}
          >
            {reps}
          </div>
          <span className="text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: '"Space Mono", monospace' }}>
            reps
          </span>
          <button
            onClick={handleEnd}
            className="ml-2 px-2 py-1 rounded text-xs text-white/30 hover:text-white/70 transition-colors"
            style={{ fontFamily: '"Space Mono", monospace', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            End
          </button>
          <button
            onClick={() => setMirrorMode(m => !m)}
            title="Mirror mode"
            className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
          >
            ⇔
          </button>
        </div>
      </div>

      {/* ── Camera area ── */}
      <div className="relative flex-1 overflow-hidden">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20" style={{ color: 'rgba(0,240,255,0.5)' }}>
            <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
            <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 13 }}>Initialising pose model…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center z-20">
            <span className="text-red-400 font-bold" style={{ fontFamily: '"Orbitron", sans-serif' }}>Camera Error</span>
            <span className="text-white/30 text-sm" style={{ fontFamily: '"Space Mono", monospace' }}>{errorMsg}</span>
            <button onClick={() => navigate('/')} className="mt-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition text-sm" style={{ fontFamily: '"Space Mono", monospace' }}>
              ← Back
            </button>
          </div>
        )}

        {/* Video + canvas */}
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted
          style={{ display: status === 'ready' ? 'block' : 'none', transform }} />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[1]"
          style={{ display: status === 'ready' ? 'block' : 'none', transform }} />

        {status === 'ready' && <ScanlineFx />}

        {/* ── HUD ── */}
        {status === 'ready' && (
          <>
            {/* Battery meter — left edge */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-[2]">
              <BatteryMeter depth={depth} />
            </div>

            {/* Phase badge — top left */}
            <div
              className="absolute top-3 left-14 z-[2] px-3 py-1.5 rounded-lg"
              style={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: 11,
                fontWeight: 700,
                color: repState === 'SQUATTING' ? '#39ff14' : 'rgba(255,255,255,0.4)',
                background: 'rgba(0,0,0,0.65)',
                border: `1px solid ${repState === 'SQUATTING' ? 'rgba(57,255,20,0.4)' : 'rgba(255,255,255,0.1)'}`,
                animation: 'phase-pop 0.25s ease-out',
              }}
              key={repState}
            >
              {repState === 'SQUATTING' ? '▼ DOWN' : repState === 'DESCENDING' ? '↓ GO' : '▲ STAND'}
            </div>

            {/* Form score — top right */}
            <div
              className="absolute top-3 right-3 z-[2] px-3 py-1.5 rounded-lg text-center"
              style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,240,255,0.15)' }}
            >
              <div className="text-sm font-black tabular-nums" style={{ fontFamily: '"Orbitron", sans-serif', color: '#00f0ff' }}>
                {feedback ? `${formScore}%` : '--'}
              </div>
              <div className="text-white/25 uppercase tracking-widest" style={{ fontFamily: '"Space Mono", monospace', fontSize: 9 }}>
                Form
              </div>
            </div>

            {/* Compete opponent panel */}
            {isCompete && compete.connected && (
              <div
                className="absolute top-14 right-3 z-[2] px-4 py-3 rounded-xl space-y-1"
                style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(57,255,20,0.3)', minWidth: 80 }}
              >
                <div className="text-white/30 text-center uppercase tracking-widest" style={{ fontFamily: '"Space Mono", monospace', fontSize: 9 }}>Rival</div>
                <div className="text-3xl font-black text-center tabular-nums" style={{ fontFamily: '"Orbitron", sans-serif', color: '#39ff14' }}>
                  {compete.opponent.reps}
                </div>
                <div className="text-white/30 text-center" style={{ fontFamily: '"Space Mono", monospace', fontSize: 9 }}>
                  Form {compete.opponent.formScore}%
                </div>
              </div>
            )}

            {/* Center "Nice!" flash */}
            {niceVisible && (
              <div
                key={niceKey}
                className="absolute inset-0 flex items-center justify-center z-[3] pointer-events-none"
                style={{ animation: 'nice-flash 0.95s ease-out forwards' }}
              >
                <span
                  className="font-black select-none"
                  style={{
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: 64,
                    color: '#39ff14',
                    textShadow: '0 0 30px rgba(57,255,20,0.9), 0 0 70px rgba(57,255,20,0.5)',
                  }}
                >
                  NICE! 💪
                </span>
              </div>
            )}

            {/* Winner overlay */}
            {winnerState && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center z-[4]"
                style={{ background: 'rgba(0,0,0,0.85)' }}
              >
                <div
                  className="font-black text-center"
                  style={{
                    fontFamily: '"Orbitron", sans-serif',
                    fontSize: 56,
                    color: winnerState === 'win' ? '#39ff14' : '#ff4d4d',
                    textShadow: `0 0 40px ${winnerState === 'win' ? 'rgba(57,255,20,0.9)' : 'rgba(255,77,77,0.9)'}`,
                    animation: 'winner-pop 0.5s ease-out forwards',
                  }}
                >
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

            {/* Bottom feedback banner */}
            <div className="absolute bottom-0 inset-x-0 z-[2] px-3 pb-3">
              {feedback ? (
                <div
                  className="rounded-2xl px-5 py-4 backdrop-blur-md"
                  style={{
                    background: bannerStyle!.bg,
                    border: `1px solid ${bannerStyle!.border}`,
                  }}
                >
                  <p
                    className="font-black leading-tight"
                    style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 26, color: bannerStyle!.text }}
                  >
                    {feedback.feedback}
                  </p>
                  <p className="mt-1 text-white/30" style={{ fontFamily: '"Space Mono", monospace', fontSize: 11 }}>
                    {EXERCISES[exercise].name} · {repState === 'SQUATTING' ? 'at depth' : repState === 'DESCENDING' ? 'descending' : 'standing'}
                    {isCompete && ` · You ${reps} vs ${compete.opponent.reps}`}
                  </p>
                </div>
              ) : (
                <div
                  className="rounded-2xl px-5 py-4 backdrop-blur-md"
                  style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <p className="font-bold" style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 18, color: 'rgba(255,255,255,0.35)' }}>
                    Stand in frame to begin
                  </p>
                  <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
                    Position your full body in view
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Session Summary modal */}
      {showSummary && (
        <SessionSummary
          reps={reps}
          avgFormScore={avgScore}
          elapsedSeconds={elapsed}
          bestStreak={bestStreakRef.current}
          onClose={handleSummaryClose}
        />
      )}
    </div>
  )
}
