import { useEffect, useRef } from 'react'

import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery'
import { subscribeTheme } from '../lib/theme'

interface Particle {
  x: number
  y: number
  /** Constant drift, px/s. */
  vx: number
  vy: number
  /** Extra velocity from the mouse, decays back to zero. */
  ex: number
  ey: number
  r: number
}

const MOUSE_RADIUS = 130
const FALLBACK_RGB = '55, 48, 163'

const readRgb = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--particle-rgb').trim() || FALLBACK_RGB

/**
 * Drifting dots joined by thin lines when close, gently pushed away from the pointer.
 * Fills its (positioned) parent. Pauses off-screen and when the tab is hidden; under
 * prefers-reduced-motion it draws one static frame instead.
 */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const reduced = useReducedMotion()
  const isMobile = useMediaQuery('(max-width: 767px)')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const host = canvas.parentElement ?? canvas

    const count = isMobile ? 25 : 60
    const linkDistance = isMobile ? 95 : 130
    const mouse = { x: -9999, y: -9999 }
    let width = 0
    let height = 0
    let rgb = readRgb()
    let frame = 0
    let running = false
    let inView = true
    let last = 0

    const seed = () => {
      particlesRef.current = Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2
        const speed = 5 + Math.random() * 11
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ex: 0,
          ey: 0,
          r: 1.2 + Math.random() * 1.4,
        }
      })
    }

    const draw = () => {
      const particles = particlesRef.current
      ctx.clearRect(0, 0, width, height)

      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist < linkDistance) {
            ctx.strokeStyle = `rgba(${rgb}, ${((1 - dist / linkDistance) * 0.2).toFixed(3)})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      ctx.fillStyle = `rgba(${rgb}, 0.4)`
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const step = (dt: number) => {
      const decay = Math.pow(0.05, dt)
      for (const p of particlesRef.current) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < MOUSE_RADIUS && dist > 0.01) {
          const push = (1 - dist / MOUSE_RADIUS) * 120 * dt
          p.ex += (dx / dist) * push
          p.ey += (dy / dist) * push
        }
        p.ex *= decay
        p.ey *= decay
        p.x += (p.vx + p.ex) * dt
        p.y += (p.vy + p.ey) * dt

        // Wrap around the edges.
        if (p.x < -10) p.x = width + 10
        else if (p.x > width + 10) p.x = -10
        if (p.y < -10) p.y = height + 10
        else if (p.y > height + 10) p.y = -10
      }
    }

    const tick = (now: number) => {
      if (!running) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      step(dt)
      draw()
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (running || reduced || !inView || document.hidden) return
      running = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const nextW = Math.max(1, Math.round(rect.width))
      const nextH = Math.max(1, Math.round(rect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(nextW * dpr)
      canvas.height = Math.round(nextH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (particlesRef.current.length !== count) {
        width = nextW
        height = nextH
        seed()
      } else if (width > 0 && height > 0) {
        const sx = nextW / width
        const sy = nextH / height
        for (const p of particlesRef.current) {
          p.x *= sx
          p.y *= sy
        }
      }
      width = nextW
      height = nextH
      if (!running) draw()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (reduced || event.pointerType === 'touch') return
      const rect = canvas.getBoundingClientRect()
      mouse.x = event.clientX - rect.left
      mouse.y = event.clientY - rect.top
    }
    const onPointerLeave = () => {
      mouse.x = mouse.y = -9999
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)

    const viewObserver = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true
      if (inView) start()
      else stop()
    })
    viewObserver.observe(canvas)

    const unsubscribeTheme = subscribeTheme(() => {
      rgb = readRgb()
      if (!running) draw()
    })

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)
    start()

    return () => {
      stop()
      resizeObserver.disconnect()
      viewObserver.disconnect()
      unsubscribeTheme()
      window.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced, isMobile])

  return <canvas ref={canvasRef} aria-hidden="true" className="block size-full" />
}
