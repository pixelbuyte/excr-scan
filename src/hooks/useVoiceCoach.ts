import { useRef, useCallback } from 'react'

const MIN_INTERVAL = 3500 // ms

export function useVoiceCoach(enabled: boolean) {
  const lastSpokeRef = useRef(0)
  const enabledRef   = useRef(enabled)
  enabledRef.current = enabled

  const speak = useCallback((text: string, priority = false) => {
    if (!enabledRef.current) return
    if (!('speechSynthesis' in window)) return
    const now = Date.now()
    if (!priority && now - lastSpokeRef.current < MIN_INTERVAL) return
    lastSpokeRef.current = now
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    u.pitch = 1.0
    u.volume = 0.85
    window.speechSynthesis.speak(u)
  }, [])

  return { speak }
}
