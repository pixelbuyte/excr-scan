import { useRef, useCallback } from 'react'

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)

  function ctx() {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    // Resume if suspended (browsers suspend AudioContext until user gesture)
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  function beep(freq: number, duration: number, vol = 0.35, type: OscillatorType = 'sine') {
    try {
      const ac  = ctx()
      const osc = ac.createOscillator()
      const amp = ac.createGain()
      osc.connect(amp)
      amp.connect(ac.destination)
      osc.type             = type
      osc.frequency.value  = freq
      amp.gain.setValueAtTime(vol, ac.currentTime)
      amp.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
      osc.start(ac.currentTime)
      osc.stop(ac.currentTime + duration)
    } catch { /* ignore if AudioContext unavailable */ }
  }

  // Short blip on rep count
  const repSound = useCallback(() => {
    beep(660, 0.12, 0.4, 'sine')
  }, [])

  // Ascending chime for perfect form rep
  const perfectSound = useCallback(() => {
    beep(523, 0.1, 0.3)
    setTimeout(() => beep(659, 0.1, 0.3), 110)
    setTimeout(() => beep(784, 0.18, 0.3), 220)
  }, [])

  // Low thud for warning
  const warnSound = useCallback(() => {
    beep(220, 0.15, 0.2, 'triangle')
  }, [])

  // Countdown beep
  const countSound = useCallback((final: boolean) => {
    beep(final ? 880 : 440, 0.2, 0.4)
  }, [])

  return { repSound, perfectSound, warnSound, countSound }
}
