import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

interface Props {
  children: ReactNode
  delay?: number          // ms
  className?: string
  style?: CSSProperties
  as?: 'div' | 'section' | 'li'
}

// Scroll-entry: heavy fade-up + blur via IntersectionObserver (GPU transform/opacity only).
export function Reveal({ children, delay = 0, className = '', style, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setShown(true); io.disconnect() }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const Tag = as as 'div'
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(40px)',
        filter: shown ? 'blur(0)' : 'blur(12px)',
        transition: `opacity 0.9s cubic-bezier(0.32,0.72,0,1) ${delay}ms, transform 0.9s cubic-bezier(0.32,0.72,0,1) ${delay}ms, filter 0.9s cubic-bezier(0.32,0.72,0,1) ${delay}ms`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </Tag>
  )
}
