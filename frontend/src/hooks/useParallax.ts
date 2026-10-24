import { useEffect, useRef } from 'react'

import { useIsTouch, useReducedMotion } from './useMediaQuery'

type Mode = 'scroll' | 'center'

/**
 * Moves an element vertically with scroll using transform: translate3d only.
 *
 * - `scroll`: offset = scrollY * speed (positive speed = the layer lags behind the page).
 * - `center`: offset follows the parent's distance from the viewport centre, for mid-page elements.
 *
 * Does nothing under prefers-reduced-motion or on touch devices.
 */
export function useParallax<T extends HTMLElement>(speed: number, mode: Mode = 'scroll') {
  const ref = useRef<T>(null)
  const reduced = useReducedMotion()
  const touch = useIsTouch()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced || touch) {
      el.style.transform = ''
      return
    }

    let frame = 0
    let queued = false

    const update = () => {
      queued = false
      let offset: number
      if (mode === 'scroll') {
        offset = Math.min(window.scrollY, window.innerHeight * 1.2) * speed
      } else {
        // Measure the (untransformed) parent so the element's own offset doesn't feed back.
        const box = (el.parentElement ?? el).getBoundingClientRect()
        offset = -(box.top + box.height / 2 - window.innerHeight / 2) * speed
      }
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      el.style.transform = ''
    }
  }, [speed, mode, reduced, touch])

  return ref
}
